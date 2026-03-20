import { Room } from "../core/room";
import { AbsorptionCoefficients } from "../acoustics/rt60";
import { Position3D, computeRoomFrequencyResponse } from "../frequencyResponse";
import { computeUniformityScore, UniformityScore } from "../analysis/uniformityScore";

export type JointOptimizationResult = {
  readonly bestConfiguration: {
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }[];
  readonly bestScore: UniformityScore;
};

/**
 * optimizeDelayAndGain
 *
 * Performs an exhaustive brute-force joint search over both delay and gain
 * parameter spaces for a specified subset of sources simultaneously,
 * returning the (delay, gain) combination per source that minimises the
 * combined acoustic quality score across the specified frequency band and
 * listener array.
 *
 * ============================================================
 * WHY DELAY AND GAIN INTERACT NON-LINEARLY
 * ============================================================
 *
 * In the modal pressure model, each source contributes a complex amplitude
 * to the room's pressure field at every mode and frequency:
 *
 *   contribution_i =
 *     lorentzianGain × sourceWeight_i × listenerWeight × gain_i × polarity_i
 *     × (cos(2π × f × delay_i) + j × sin(2π × f × delay_i))
 *
 * The delay determines the phase angle of the contribution vector in the
 * complex plane; the gain scales its magnitude. Because the total pressure
 * is the complex sum of all source contributions, changing one source's
 * delay rotates its contribution vector while changing its gain scales it.
 * These two operations do not commute with the summation in a linear way:
 *
 *   PHASE-AMPLITUDE COUPLING
 *     A gain increase on source A reinforces its contribution in the
 *     current phase direction. But if source A's delay is also changed,
 *     the direction of that reinforcement rotates, potentially converting
 *     constructive interference at one frequency into destructive at another.
 *     The net effect on flatness and uniformity depends on both parameters
 *     simultaneously — you cannot optimise delay first and gain second and
 *     expect to find the joint optimum, because the optimal gain for one
 *     delay setting is generally not optimal for another.
 *
 *   FREQUENCY-DEPENDENT INTERACTION
 *     At low frequencies, a given delay produces a small phase shift and
 *     contributions from all sources are nearly co-phasal — gain dominates.
 *     At high frequencies, the same delay produces a large phase shift and
 *     the comb filter structure dominates — delay controls which frequencies
 *     are reinforced or cancelled. The optimal gain-delay combination must
 *     therefore satisfy a frequency-integrated objective (combinedScore)
 *     that captures this frequency-dependent interplay across the full band.
 *
 *   MODAL SPECIFICITY
 *     Each room mode has a specific resonance frequency. Whether a source
 *     reinforces or suppresses a given mode depends on the phase relationship
 *     between its delayed contribution and the mode's spatial weight at the
 *     listener. Gain scales the depth of reinforcement or suppression; delay
 *     controls the sign and magnitude of the phase relationship. Both must
 *     be jointly optimised to achieve the best possible modal balance.
 *
 * Sequential optimisation (delay then gain, or gain then delay) cannot
 * guarantee the global optimum because the landscape in one dimension
 * changes when the other is updated. Only a joint search over the full
 * (delay, gain) product space finds the true joint optimum.
 *
 * ============================================================
 * COMBINED SEARCH SPACE: (D × G)^N
 * ============================================================
 *
 * For each optimised source, the per-source parameter space is the
 * Cartesian product of its delay grid and its gain grid:
 *
 *   D = floor((maxDelayMs - minDelayMs) / delayStepMs) + 1
 *   G = floor((maxGain - minGain) / gainStep) + 1
 *   perSourceCandidates = D × G
 *
 * For N optimised sources, the total joint search space is:
 *
 *   totalCandidates = (D × G)^N
 *
 * This grows exponentially with N. The joint space is always larger than
 * either the delay-only (D^N) or gain-only (G^N) spaces, often dramatically:
 *
 *   N=1, D=10, G=10  →        100 evaluations   (trivial)
 *   N=2, D=10, G=10  →     10,000 evaluations   (fast)
 *   N=3, D=10, G=10  →  1,000,000 evaluations   (slow)
 *   N=4, D=10, G=10  → 10^8      evaluations   (impractical)
 *
 * ============================================================
 * COMPUTATIONAL COMPLEXITY
 * ============================================================
 *
 * Total cost scales as:
 *
 *   O((D × G)^N × listeners × modes × frequencySteps)
 *
 * Where each factor is independent and multiplicative:
 *
 *   (D × G)^N     — joint delay-gain combinations (exponential in N).
 *   listeners     — spatial sampling positions per evaluation.
 *   modes         — room modes below maxFrequencyHz; grows as O(f³).
 *   frequencySteps — maxFrequencyHz / frequencyStepHz.
 *
 * ============================================================
 * WHY BRUTE FORCE IS VALID ONLY FOR SMALL N
 * ============================================================
 *
 * The exponential growth of (D × G)^N makes brute force practical only
 * when N is small (1 or 2) or when D × G is kept small through coarse
 * grids. For N ≥ 3 with moderate resolution, the evaluation count
 * becomes prohibitive and a coarse-to-fine or hierarchical strategy
 * is required.
 *
 * ============================================================
 * WHEN COARSE-TO-FINE IS REQUIRED
 * ============================================================
 *
 * For N ≥ 3 or fine resolution requirements, the following strategy
 * is recommended:
 *
 *   STAGE 1 — Coarse joint search
 *     Use large delayStepMs and gainStep to survey the full parameter
 *     space with manageable evaluation count. Identify the approximate
 *     joint optimum (delay_i*, gain_i*) for each source.
 *
 *   STAGE 2 — Fine joint search per source
 *     Restrict each source i to:
 *       delay ∈ [delay_i* - coarseDelayStep, delay_i* + coarseDelayStep]
 *       gain  ∈ [gain_i* - coarseGainStep,  gain_i* + coarseGainStep]
 *     Run a fine joint search within these local windows.
 *
 *   STAGE 3 — Optional alternating refinement
 *     Alternate between delay-only and gain-only fine passes with the
 *     other parameter held at its current best, repeating until
 *     improvement falls below a threshold. This is a coordinate descent
 *     heuristic — not globally guaranteed, but effective when the
 *     joint landscape is approximately separable near the optimum.
 *
 * ============================================================
 * RECURSIVE COMBINATORIAL SEARCH
 * ============================================================
 *
 * The search assigns both delay and gain to one source per recursion
 * level by iterating over the Cartesian product (delay, gain) for that
 * source before descending. At the leaf, the complete configuration is
 * evaluated. This structure correctly handles any number of optimised
 * sources without statically nested loops.
 *
 * @param room                  - Room defining geometry and boundary surfaces.
 * @param absorption            - Per-surface absorption coefficients.
 * @param baseConfiguration     - Starting source configuration; parameters for
 *                                non-optimised sources are held fixed.
 * @param listeners             - Listener positions for spatial averaging.
 * @param optimizeSourceIndices - Indices of sources whose delay and gain
 *                                will be jointly optimised.
 * @param minDelayMs            - Minimum delay to evaluate (ms).
 * @param maxDelayMs            - Maximum delay to evaluate (ms).
 * @param delayStepMs           - Step size of the delay grid (ms).
 * @param minGain               - Minimum gain value to evaluate.
 * @param maxGain               - Maximum gain value to evaluate.
 * @param gainStep              - Step size of the gain grid.
 * @param maxFrequencyHz        - Upper frequency bound for simulation (Hz).
 * @param frequencyStepHz       - Frequency resolution of each simulation (Hz).
 * @param minBandFrequencyHz    - Lower bound of the scoring analysis band (Hz).
 * @param maxBandFrequencyHz    - Upper bound of the scoring analysis band (Hz).
 * @param flatnessWeight        - Weight applied to flatnessDb in combined score.
 * @param uniformityWeight      - Weight applied to uniformityDb in combined score.
 * @returns JointOptimizationResult containing the best-scoring configuration
 *          and its UniformityScore.
 */
export function optimizeDelayAndGain(
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
  minDelayMs: number,
  maxDelayMs: number,
  delayStepMs: number,
  minGain: number,
  maxGain: number,
  gainStep: number,
  maxFrequencyHz: number,
  frequencyStepHz: number,
  minBandFrequencyHz: number,
  maxBandFrequencyHz: number,
  flatnessWeight: number,
  uniformityWeight: number
): JointOptimizationResult {
  const delayGrid: number[] = [];
  for (let d = minDelayMs; d <= maxDelayMs; d += delayStepMs) {
    delayGrid.push(d);
  }

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
   * Recursive descent over optimizeSourceIndices. At depth d, the joint
   * (delay, gain) Cartesian product is enumerated for the corresponding
   * source. At the leaf (depth === optimizeSourceIndices.length), the full
   * configuration is evaluated and compared against the current best.
   *
   * @param depth         - Current recursion depth.
   * @param currentConfig - Working configuration with parameters assigned so far.
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

    for (const delayMs of delayGrid) {
      for (const gain of gainGrid) {
        const updatedConfig = currentConfig.slice();
        updatedConfig[sourceIndex] = {
          position: originalSource.position,
          gain,
          delayMs,
          polarity: originalSource.polarity,
        };
        search(depth + 1, updatedConfig);
      }
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