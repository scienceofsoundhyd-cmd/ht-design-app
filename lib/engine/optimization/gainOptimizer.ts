import { Room } from "../core/room";
import { AbsorptionCoefficients } from "../acoustics/rt60";
import { Position3D, computeRoomFrequencyResponse } from "../frequencyResponse";
import { computeUniformityScore, UniformityScore } from "../analysis/uniformityScore";

export type GainOptimizationResult = {
  readonly bestConfiguration: {
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }[];
  readonly bestScore: UniformityScore;
};

/**
 * optimizeGains
 *
 * Performs an exhaustive brute-force grid search over the gain parameter
 * space of a specified subset of sources, returning the gain combination
 * that minimises the combined acoustic quality score across the specified
 * frequency band and listener array.
 *
 * ============================================================
 * WHY GAIN AFFECTS MODAL EXCITATION STRENGTH
 * ============================================================
 *
 * In the modal pressure model, each source contributes to the room's
 * standing wave field with an amplitude proportional to its gain:
 *
 *   modePressureContribution_i =
 *     lorentzianGain × sourceWeight_i × listenerWeight × gain_i × polarity_i
 *
 * The gain parameter scales the source's contribution to every mode
 * linearly and simultaneously. A higher gain increases the source's
 * coupling into all modes for which its spatial weight is non-zero;
 * a lower gain reduces it. This has several important consequences:
 *
 *   DIFFERENTIAL MODAL CONTROL
 *     Two sources at different positions have different spatial weight
 *     profiles across the mode set. Adjusting their relative gains
 *     therefore adjusts the relative excitation of different subsets
 *     of modes. A mode strongly coupled to source A but weakly to source B
 *     can be attenuated by reducing source A's gain without equally
 *     affecting modes that are primarily driven by source B.
 *
 *   CONSTRUCTIVE / DESTRUCTIVE BALANCE
 *     When two sources contribute with opposite-sign spatial weights to
 *     a given mode, their contributions partially cancel. The degree of
 *     cancellation is gain-dependent: equal gains produce maximum
 *     cancellation; unequal gains leave a residual. Gain optimisation
 *     can exploit this to selectively suppress problematic modal peaks.
 *
 *   FLATNESS VS LEVEL TRADE-OFF
 *     Reducing a source's gain uniformly attenuates its contribution to
 *     all modes, which may improve flatness if that source was
 *     over-exciting certain modes, but will also reduce overall SPL.
 *     The combinedScore objective penalises spectral unevenness rather
 *     than absolute level, so the optimiser can freely trade overall
 *     level for flatness improvements.
 *
 * ============================================================
 * WHY BRUTE FORCE IS VALID FOR SMALL N
 * ============================================================
 *
 * Exhaustive search is the preferred strategy for small numbers of
 * optimised sources because:
 *
 *   GLOBAL GUARANTEE
 *     Every point in the discretised gain space is evaluated.
 *     The returned result is the true global minimum within the
 *     candidate set, not a local minimum found by a heuristic.
 *     The combinedScore landscape as a function of gains is non-convex
 *     due to multi-modal interference interactions, making gradient-based
 *     methods unreliable without careful initialisation.
 *
 *   DETERMINISM
 *     The search visits candidates in a fixed, arithmetic order derived
 *     from the gain grid. Given identical inputs the output is always
 *     identical, with no dependence on random seeds or convergence state.
 *
 *   TRANSPARENCY
 *     Every gain combination is evaluated. The caller can extend the
 *     function to collect all evaluations for landscape visualisation,
 *     sensitivity analysis, or gain-flatness trade-off studies.
 *
 * ============================================================
 * SEARCH SPACE GROWTH
 * ============================================================
 *
 * The gain search space is the Cartesian product of per-source gain
 * grids. For N sources each with G gain candidates:
 *
 *   totalCandidates = G^N
 *
 * Where:
 *   G = floor((maxGain - minGain) / gainStep) + 1
 *   N = optimizeSourceIndices.length
 *
 * This grows exponentially with N:
 *
 *   N=1, G=10  →       10 evaluations   (trivial)
 *   N=2, G=10  →      100 evaluations   (fast)
 *   N=3, G=10  →    1,000 evaluations   (moderate)
 *   N=4, G=10  →   10,000 evaluations   (slow)
 *   N=5, G=10  →  100,000 evaluations   (expensive)
 *
 * For larger N or finer gain resolution, consider a coarse-to-fine
 * strategy analogous to refinedDelayOptimizer.
 *
 * ============================================================
 * COMPUTATIONAL COMPLEXITY
 * ============================================================
 *
 * Total cost scales as:
 *
 *   O(G^N × listeners × modes × frequencySteps)
 *
 * Where each factor is independent and multiplicative:
 *
 *   G^N           — total gain combinations (exponential in N).
 *   listeners     — spatial sampling positions per evaluation.
 *   modes         — room modes below maxFrequencyHz; grows as O(f³).
 *   frequencySteps — maxFrequencyHz / frequencyStepHz.
 *
 * Non-optimised sources retain their gains from baseConfiguration
 * unchanged throughout the entire search.
 *
 * ============================================================
 * RECURSIVE COMBINATORIAL SEARCH
 * ============================================================
 *
 * The search enumerates all gain combinations for the sources in
 * optimizeSourceIndices using a recursive descent that assigns one
 * source's gain per level. At the leaf, the full configuration is
 * evaluated. This correctly handles any number of optimised sources
 * without statically nested loops.
 *
 * @param room                  - Room defining geometry and boundary surfaces.
 * @param absorption            - Per-surface absorption coefficients.
 * @param baseConfiguration     - Starting source configuration; gains for
 *                                non-optimised sources are held fixed.
 * @param listeners             - Listener positions for spatial averaging.
 * @param optimizeSourceIndices - Indices into baseConfiguration of sources
 *                                whose gains will be optimised.
 * @param minGain               - Minimum gain value to evaluate.
 * @param maxGain               - Maximum gain value to evaluate.
 * @param gainStep              - Step size of the gain grid.
 * @param maxFrequencyHz        - Upper frequency bound for simulation (Hz).
 * @param frequencyStepHz       - Frequency resolution of each simulation (Hz).
 * @param minBandFrequencyHz    - Lower bound of the scoring analysis band (Hz).
 * @param maxBandFrequencyHz    - Upper bound of the scoring analysis band (Hz).
 * @param flatnessWeight        - Weight applied to flatnessDb in combined score.
 * @param uniformityWeight      - Weight applied to uniformityDb in combined score.
 * @returns GainOptimizationResult containing the best-scoring configuration
 *          and its UniformityScore.
 */
export function optimizeGains(
  room: Room,
  absorption: AbsorptionCoefficients,
  baseConfiguration: ReadonlyArray<{
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }>,
  listeners: ReadonlyArray<Position3D>,
  optimizeSourceIndices: ReadonlyArray<number>,
  minGain: number,
  maxGain: number,
  gainStep: number,
  maxFrequencyHz: number,
  frequencyStepHz: number,
  minBandFrequencyHz: number,
  maxBandFrequencyHz: number,
  flatnessWeight: number,
  uniformityWeight: number
): GainOptimizationResult {
  const gainGrid: number[] = [];
  for (let g = minGain; g <= maxGain; g += gainStep) {
    gainGrid.push(g);
  }

  let bestCombinedScore = Infinity;
  let bestScore: UniformityScore = {
    flatnessDb: Infinity,
    uniformityDb: Infinity,
    combinedScore: Infinity,
    rating: 0,
  };
  let bestConfiguration: {
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }[] = baseConfiguration.slice() as {
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }[];

  /**
   * search
   *
   * Recursive descent over optimizeSourceIndices. At depth d, one gain
   * value is selected from gainGrid and assigned to the corresponding
   * source. At the leaf (depth === optimizeSourceIndices.length), the
   * full configuration is evaluated and compared against the current best.
   *
   * @param depth         - Current recursion depth (index into optimizeSourceIndices).
   * @param currentConfig - Working configuration with gains assigned so far.
   */
  function search(
    depth: number,
    currentConfig: {
      readonly position: Position3D;
      readonly gain: number;
      readonly delayMs: number;
      readonly polarity: 1 | -1;
    }[]
  ): void {
    if (depth === optimizeSourceIndices.length) {
      const response = computeRoomFrequencyResponse(
        room,
        absorption,
        currentConfig,
        listeners,
        maxFrequencyHz,
        frequencyStepHz
      );

      const score = computeUniformityScore(
        response,
        minBandFrequencyHz,
        maxBandFrequencyHz,
        flatnessWeight,
        uniformityWeight
      );

      if (score.combinedScore < bestCombinedScore) {
        bestCombinedScore = score.combinedScore;
        bestScore = score;
        bestConfiguration = currentConfig.slice();
      }

      return;
    }

    const sourceIndex = optimizeSourceIndices[depth];
    const originalSource = currentConfig[sourceIndex];

    for (const gain of gainGrid) {
      const updatedConfig = currentConfig.slice();
      updatedConfig[sourceIndex] = {
        position: originalSource.position,
        gain,
        delayMs: originalSource.delayMs,
        polarity: originalSource.polarity,
      };
      search(depth + 1, updatedConfig);
    }
  }

  const initialConfig = baseConfiguration.slice() as {
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }[];

  search(0, initialConfig);

  return {
    bestConfiguration,
    bestScore,
  };
}