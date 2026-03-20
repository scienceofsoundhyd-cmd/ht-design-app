import { Room } from "../core/room";
import { AbsorptionCoefficients } from "../acoustics/rt60";
import { computeAllRoomModes } from "../core/modalAnalysis";
import { computeFrequencyDependentRT60 } from "../acoustics/frequencyRT60";
import { Position3D } from "../frequencyResponse";

export type HeatmapPoint = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly splDb: number;
};

export type Heatmap2D = {
  readonly frequencyHz: number;
  readonly points: ReadonlyArray<HeatmapPoint>;
};

/**
 * computeHeatmap2D
 *
 * Computes a two-dimensional map of sound pressure level across a
 * horizontal plane inside a rectangular room at a single frequency,
 * driven by one or more sources with independent gain, delay, and
 * polarity parameters.
 *
 * ============================================================
 * PHYSICAL MODEL — 2D PRESSURE SLICE
 * ============================================================
 *
 * This function produces a spatial snapshot of the room's modal pressure
 * field at one specific frequency. Each point in the output grid represents
 * the complex acoustic pressure magnitude at that location, expressed in dB
 * SPL, under steady-state excitation from the specified sources.
 *
 * The simulation is modal — it sums the Lorentzian contributions of all
 * standing wave resonances below the analysis frequency, spatially weighted
 * by the mode shape at each grid point and at each source position. The
 * physics is identical to the per-listener computation in
 * computeRoomFrequencyResponse (Phase 33), applied here to a dense spatial
 * grid rather than a sparse set of listener seats.
 *
 * ============================================================
 * WHY fixedZ IS USED
 * ============================================================
 *
 * The modal pressure field of a rectangular room is three-dimensional.
 * Visualising the full 3D field requires volumetric rendering, which is
 * computationally expensive and difficult to interpret. A 2D slice at a
 * fixed height z = fixedZ reduces the field to a planar cross-section
 * that can be rendered as a standard heatmap image.
 *
 * The choice of fixedZ determines which features of the pressure field
 * are visible:
 *
 *   fixedZ = 0 (floor plane)
 *     Shows the pressure distribution at the floor boundary. At the floor,
 *     vertical axial modes (ny) are always at a pressure antinode
 *     (cos(0) = 1), so their contribution is maximised. The floor slice
 *     emphasises horizontal modal structure.
 *
 *   fixedZ = room.length / 2 (mid-height plane)
 *     Passes through the nodal planes of all odd-index vertical modes,
 *     making them invisible in the slice. Emphasises even-index vertical
 *     mode structure and horizontal modes.
 *
 *   fixedZ = ear height (~1.2 m)
 *     The most practically relevant slice — represents the pressure field
 *     at seated listener ear level, directly corresponding to what a
 *     listener at any horizontal position in the room would perceive.
 *
 * ============================================================
 * NODES AND ANTINODES BECOME VISIBLE
 * ============================================================
 *
 * At a single frequency, the pressure field is dominated by one or a
 * small number of nearby room modes. The heatmap reveals:
 *
 *   ANTINODES (pressure maxima)
 *     Regions of high SPL where modal contributions add constructively.
 *     For axial modes, antinodes always occur at room boundaries (walls,
 *     floor, ceiling). For oblique modes, antinodes are distributed
 *     throughout the interior.
 *
 *   NODES (pressure minima)
 *     Regions of low or zero SPL where modal contributions cancel. These
 *     are the "dead spots" that make certain seat positions undesirable
 *     at this frequency. A listener at a nodal position cannot perceive
 *     that mode regardless of source output level.
 *
 *   SOURCE COUPLING PATTERNS
 *     With multiple sources, the heatmap also reveals the interference
 *     pattern between sources — constructive regions where sources
 *     reinforce, destructive regions where they cancel. This is
 *     particularly useful for evaluating cardioid subwoofer arrays,
 *     where the goal is to produce directional cancellation toward the
 *     rear of the room while maintaining level at the front.
 *
 * ============================================================
 * SINGLE-FREQUENCY SIMULATION
 * ============================================================
 *
 * Each call to computeHeatmap2D simulates exactly one frequency. This
 * is intentional — the spatial distribution of modal energy changes
 * dramatically from one mode to the next, and each frequency requires
 * an independent RT60 computation (for bandwidth) and independent
 * Lorentzian evaluation. To generate a sequence of heatmaps across a
 * frequency sweep, the caller should invoke this function once per
 * frequency of interest.
 *
 * ============================================================
 * SPATIAL RESOLUTION AND COMPUTATIONAL COST
 * ============================================================
 *
 * The resolution parameter controls the spacing between grid points in
 * both x and y dimensions (in metres). Finer resolution produces a
 * smoother, more detailed heatmap at higher computational cost.
 *
 * The number of grid points is approximately:
 *
 *   gridPointsX = (gridMaxX - gridMinX) / resolution + 1
 *   gridPointsY = (gridMaxY - gridMinY) / resolution + 1
 *   totalPoints = gridPointsX × gridPointsY
 *
 * Total computational cost scales as:
 *
 *   O(gridPoints × modes × sources)
 *
 * Where:
 *   gridPoints — determined by grid extent and resolution. A 5m × 5m
 *                room at 0.1m resolution produces 2601 points; at 0.05m
 *                resolution it produces 10201 points.
 *   modes      — number of room modes below frequencyHz; grows as O(f³)
 *                per the Weyl approximation.
 *   sources    — number of source elements in the array.
 *
 * For interactive visualisation, resolution = 0.1m is a practical
 * starting point. For high-fidelity analysis, resolution = 0.05m or
 * finer may be warranted.
 *
 * ============================================================
 * COMPLEX PRESSURE AND ENERGY
 * ============================================================
 *
 * At each grid point, source contributions are accumulated as complex
 * pressure amplitudes to correctly model delay-induced phase offsets:
 *
 *   sumReal += amplitude × cos(2π × f × delaySeconds)
 *   sumImag += amplitude × sin(2π × f × delaySeconds)
 *
 * Energy is the squared complex magnitude:
 *
 *   energy = sumReal² + sumImag²
 *   splDb  = 10 × log₁₀(energy + 1e-12)
 *
 * The +1e-12 regularisation prevents log₁₀(0) at perfect nodal
 * cancellations, corresponding to a -120 dB floor.
 *
 * @param room        - Room defining geometry and boundary surfaces.
 * @param absorption  - Per-surface absorption coefficients for RT60.
 * @param sources     - Acoustic sources with position, gain, delay, polarity.
 * @param frequencyHz - Single frequency at which the pressure field is mapped (Hz).
 * @param gridMinX    - Left edge of the analysis grid (m).
 * @param gridMaxX    - Right edge of the analysis grid (m).
 * @param gridMinY    - Front edge of the analysis grid (m).
 * @param gridMaxY    - Rear edge of the analysis grid (m).
 * @param fixedZ      - Fixed height of the horizontal slice plane (m).
 * @param resolution  - Spacing between adjacent grid points in x and y (m).
 * @returns Heatmap2D containing the frequency and an array of HeatmapPoints
 *          covering the grid at the specified resolution.
 */
export function computeHeatmap2D(
  room: Room,
  absorption: AbsorptionCoefficients,
  sources: ReadonlyArray<{
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }>,
  frequencyHz: number,
  gridMinX: number,
  gridMaxX: number,
  gridMinY: number,
  gridMaxY: number,
  fixedZ: number,
  resolution: number
): Heatmap2D {
  const modes = computeAllRoomModes(room, frequencyHz);

  const rt60 = computeFrequencyDependentRT60(room, absorption, frequencyHz);
  const bandwidthHz = 2.2 / rt60;

  const points: HeatmapPoint[] = [];

  for (let x = gridMinX; x <= gridMaxX; x += resolution) {
    for (let y = gridMinY; y <= gridMaxY; y += resolution) {
      let sumReal = 0;
      let sumImag = 0;

      for (const mode of modes) {
        const ratio = (frequencyHz - mode.frequencyHz) / bandwidthHz;
        const lorentzianGain = 1 / (1 + ratio * ratio);

        const listenerWeight =
          Math.cos((mode.nx * Math.PI * x) / room.width) *
          Math.cos((mode.ny * Math.PI * y) / room.height) *
          Math.cos((mode.nz * Math.PI * fixedZ) / room.length);

        for (const source of sources) {
          const sourceWeight =
            Math.cos((mode.nx * Math.PI * source.position.x) / room.width) *
            Math.cos((mode.ny * Math.PI * source.position.y) / room.height) *
            Math.cos((mode.nz * Math.PI * source.position.z) / room.length);

          const delaySeconds = source.delayMs / 1000;
          const phaseShift = 2 * Math.PI * frequencyHz * delaySeconds;

          const amplitude =
            lorentzianGain *
            sourceWeight *
            listenerWeight *
            source.gain *
            source.polarity;

          sumReal += amplitude * Math.cos(phaseShift);
          sumImag += amplitude * Math.sin(phaseShift);
        }
      }

      const energy = sumReal * sumReal + sumImag * sumImag;
      const splDb = 10 * Math.log10(energy + 1e-12);

      points.push({ x, y, z: fixedZ, splDb });
    }
  }

  return {
    frequencyHz,
    points,
  };
}