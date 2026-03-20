import { Room } from "../engine/core/room";
import { AbsorptionCoefficients } from "../engine/acoustics/rt60";
import { computeAllRoomModes } from "../engine/core/modalAnalysis";
import { computeFrequencyDependentRT60 } from "../engine/acoustics/frequencyRT60";
import { DEFAULT_ACOUSTIC_CONFIG } from "../engine/config/acousticConfig";

export type FrequencyResponsePoint = {
  readonly frequencyHz: number;
  readonly splDb: number;
};

export type Position3D = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type MultiListenerFrequencyResponse = {
  readonly frequencyHz: number;
  readonly averageSplDb: number;
  readonly seatSplDb: ReadonlyArray<number>;
  readonly standardDeviationDb: number;
};

/**
 * computeRoomFrequencyResponse
 *
 * Produces a frequency-domain spatial average sound pressure level curve
 * for a rectangular room by summing the spatially weighted, delay-shifted,
 * complex Lorentzian contributions of all room modes at each frequency step,
 * driven by one or more sources, evaluated independently at each listener
 * position, then averaged across listeners in the energy domain.
 *
 * ============================================================
 * PHYSICAL MODEL — MODAL DOMAIN SIMULATION
 * ============================================================
 *
 * This function operates entirely in the modal domain. It does NOT use
 * geometric acoustics (ray tracing, image sources) or wave-based numerical
 * methods (FEM, BEM, FDTD). Instead, the room's response is modelled as
 * the linear superposition of all standing wave resonances below the
 * specified frequency limit, each weighted by how strongly it is excited
 * by each source and how strongly it is sensed at each listener position.
 *
 * Sources may carry independent delay offsets and polarity inversions,
 * enabling the simulation of time-aligned arrays, cardioid subwoofer
 * configurations, and delay-steered spatial filtering. Multiple listener
 * positions enable spatial averaging that captures the seat-to-seat
 * variation characteristic of real-world listening environments.
 *
 * ============================================================
 * LORENTZIAN RESONANCE MODEL
 * ============================================================
 *
 * Each room mode behaves as a damped harmonic oscillator. In the frequency
 * domain, the steady-state amplitude response of a single damped resonance
 * is described by the Lorentzian function:
 *
 *   gain(f) = 1 / (1 + ((f - f₀) / Δf)²)
 *
 * Where:
 *   f₀  = modal resonance frequency (Hz)
 *   Δf  = modal half-bandwidth (Hz)
 *   f   = evaluation frequency (Hz)
 *
 * The Lorentzian correctly models the heavy-tailed frequency-domain
 * representation of an exponentially decaying sinusoid, capturing the
 * energy contribution of each mode well beyond its immediate resonance.
 *
 * ============================================================
 * WHY SPATIAL AVERAGING MUST OCCUR IN THE ENERGY DOMAIN
 * ============================================================
 *
 * Sound pressure level is a logarithmic quantity. Averaging SPL values
 * directly (in dB) is physically incorrect because it implies averaging
 * the logarithm of energy rather than averaging energy itself. These
 * are not equivalent operations:
 *
 *   INCORRECT: averageSplDb = (1/N) × Σ splᵢ
 *     This is the arithmetic mean of logarithms. It has no physical
 *     meaning because it does not correspond to any physical quantity
 *     that is conserved or additive in the acoustic field. It also
 *     underweights peaks and overweights nulls because the dB scale
 *     compresses large values and expands small ones.
 *
 *   CORRECT: averageSplDb = 10 × log₁₀((1/N) × Σ energyᵢ)
 *     This is the logarithm of the mean energy — the correct statistical
 *     descriptor for the spatially averaged acoustic power in the room.
 *     It corresponds to a physical quantity: the mean energy density
 *     across the sampled positions, which is what a spatially distributed
 *     measurement microphone array would capture.
 *
 * The distinction matters most in rooms with deep modal nulls. At a null,
 * SPL may be 20–30 dB below average. Averaging in dB would allow a single
 * deep null to pull the spatial average down by many dB, misrepresenting
 * the overall energy distribution. Averaging in the energy domain correctly
 * weights each position by its actual acoustic energy contribution.
 *
 * The pipeline is therefore:
 *   1. For each listener: compute complex pressure → energy_i = |P_i|²
 *   2. Average energy:    averageEnergy = (1/N) × Σ energy_i
 *   3. Convert to dB:     averageSplDb = 10 × log₁₀(averageEnergy + 1e-12)
 *
 * ============================================================
 * MEANING OF SEAT-TO-SEAT STANDARD DEVIATION
 * ============================================================
 *
 * The standardDeviationDb field quantifies how much the SPL varies
 * across listener positions at each frequency. It is computed in the
 * dB domain as the standard deviation of the per-seat SPL values:
 *
 *   meanDb           = (1/N) × Σ splᵢ
 *   variance         = (1/N) × Σ (splᵢ - meanDb)²
 *   standardDeviation = √variance
 *
 * Physical interpretation:
 *
 *   LOW STANDARD DEVIATION (< 3 dB)
 *     All seats receive approximately the same SPL at this frequency.
 *     The mode is either absent, uniformly distributed, or well-damped.
 *     This is the target condition for a well-treated room or an
 *     optimally positioned loudspeaker array.
 *
 *   HIGH STANDARD DEVIATION (> 6 dB)
 *     Large seat-to-seat variation exists at this frequency. Some seats
 *     sit near modal pressure antinodes (high SPL) and others near nodes
 *     (low SPL). This is the hallmark of problematic low-frequency modal
 *     behaviour and indicates that acoustic treatment or source
 *     repositioning would improve consistency.
 *
 * WHY UNIFORM BASS REQUIRES LOW STANDARD DEVIATION
 *     Bass uniformity — the perceptual goal of having all seats in a
 *     room reproduce the same low-frequency content at consistent levels
 *     — is directly measured by this metric. A system that achieves
 *     low averageSplDb variation AND low standardDeviationDb across
 *     all bass frequencies has achieved spatially uniform low-frequency
 *     reproduction. Standard deviation provides the diagnostic that
 *     average SPL alone cannot: two systems with identical averageSplDb
 *     may have wildly different seat-to-seat consistency.
 *
 * Note: standard deviation here is computed in dB (on per-seat SPL values)
 * rather than in the energy domain. This is intentional — it describes
 * the perceptual variability that a listener moving from seat to seat
 * would experience, which is a dB-domain phenomenon.
 *
 * ============================================================
 * DELAY-INDUCED FREQUENCY-DEPENDENT PHASE SHIFT
 * ============================================================
 *
 * A delay of τ seconds applied to a source corresponds to multiplication
 * by the complex exponential e^(-j × 2π × f × τ) in the frequency domain.
 * The phase angle 2π × f × τ grows linearly with frequency, producing
 * alternating constructive and destructive interference bands (comb filter)
 * with notch spacing 1/τ Hz. Complex accumulation is required to correctly
 * represent this frequency-dependent phase relationship.
 *
 * ============================================================
 * COMPLEX SUMMATION AND ENERGY
 * ============================================================
 *
 * At each listener position, modal contributions are accumulated as
 * complex pressure amplitudes:
 *
 *   sumReal += amplitude × cos(phaseShift)
 *   sumImag += amplitude × sin(phaseShift)
 *
 * The acoustic energy at that listener is the squared complex magnitude:
 *
 *   energy_i = sumReal² + sumImag²
 *
 * This is the correct generalisation of real-valued p² energy to the
 * complex domain, required whenever delay offsets move source contributions
 * off the real axis.
 *
 * ============================================================
 * SPATIAL STANDING WAVE WEIGHTING
 * ============================================================
 *
 * Each mode's spatial pressure distribution:
 *
 *   Ψ(x, y, z) =
 *     cos(nx × π × x / W) ×
 *     cos(ny × π × y / H) ×
 *     cos(nz × π × z / L)
 *
 * This is the exact solution to the Helmholtz equation with rigid-wall
 * Neumann boundary conditions. Source and listener coupling weights are
 * evaluated from this expression at their respective positions.
 *
 * ============================================================
 * RELATIONSHIP BETWEEN RT60 AND MODAL BANDWIDTH
 * ============================================================
 *
 * The half-bandwidth of each mode:
 *
 *   Δf ≈ 2.2 / RT60
 *
 * RT60 is frequency-dependent (see computeFrequencyDependentRT60),
 * incorporating both surface absorption and atmospheric air absorption.
 * At high frequencies, shorter RT60 produces wider modes and denser
 * overlap, consistent with the transition toward diffuse-field behaviour.
 *
 * ============================================================
 * REGULARISATION OFFSET (+1e-12)
 * ============================================================
 *
 * The constant 1e-12 prevents log₁₀(0) = -∞ when energy is exactly zero.
 * It corresponds to -120 dB, below the threshold of any physically
 * meaningful acoustic signal. Applied independently to each per-seat
 * energy value and to the spatially averaged energy.
 *
 * @param room             - Room defining geometry and boundary surfaces.
 * @param absorption       - Per-surface absorption coefficients.
 * @param sources          - Array of acoustic sources, each with a 3D
 *                           position, scalar gain, delay in milliseconds,
 *                           and polarity (1 or -1).
 * @param listeners        - Array of listener positions within the room (m).
 * @param maxFrequencyHz   - Upper frequency bound for mode enumeration
 *                           and response evaluation (Hz).
 * @param frequencyStepHz  - Frequency resolution of the output curve (Hz).
 * @returns Immutable array of MultiListenerFrequencyResponse sorted by
 *          frequency, one entry per frequency step from 0 to maxFrequencyHz.
 */
export function computeRoomFrequencyResponse(
  room: Room,
  absorption: AbsorptionCoefficients,
  sources: ReadonlyArray<{
    readonly position: Position3D;
    readonly gain: number;
    readonly delayMs: number;
    readonly polarity: 1 | -1;
  }>,
  listeners: ReadonlyArray<Position3D>,
  maxFrequencyHz: number,
  frequencyStepHz: number
): ReadonlyArray<MultiListenerFrequencyResponse> {
  const modes = computeAllRoomModes(room, maxFrequencyHz);

  const points: MultiListenerFrequencyResponse[] = [];

  for (let f = 0; f <= maxFrequencyHz; f += frequencyStepHz) {
    const rt60 = computeFrequencyDependentRT60(room, absorption, f);

    const bandwidthHz = 2.2 / rt60;

    const seatEnergies: number[] = [];
    const seatSplDb: number[] = [];

    for (const listener of listeners) {
      let sumReal = 0;
      let sumImag = 0;

      for (const mode of modes) {
        const ratio = (f - mode.frequencyHz) / bandwidthHz;
        const lorentzianGain = 1 / (1 + ratio * ratio);

        const listenerWeight =
          Math.cos((mode.nx * Math.PI * listener.x) / room.width) *
          Math.cos((mode.ny * Math.PI * listener.y) / room.height) *
          Math.cos((mode.nz * Math.PI * listener.z) / room.length);

        for (const source of sources) {
          const sourceWeight =
            Math.cos((mode.nx * Math.PI * source.position.x) / room.width) *
            Math.cos((mode.ny * Math.PI * source.position.y) / room.height) *
            Math.cos((mode.nz * Math.PI * source.position.z) / room.length);

          const delaySeconds = source.delayMs / 1000;
          const phaseShift = 2 * Math.PI * f * delaySeconds;

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
      const spl = 10 * Math.log10(energy + 1e-12);

      seatEnergies.push(energy);
      seatSplDb.push(spl);
    }

    let totalEnergy = 0;
    for (const e of seatEnergies) {
      totalEnergy += e;
    }
    const averageEnergy = totalEnergy / listeners.length;
    const averageSplDb = 10 * Math.log10(averageEnergy + 1e-12);

    let meanDb = 0;
    for (const spl of seatSplDb) {
      meanDb += spl;
    }
    meanDb = meanDb / listeners.length;

    let variance = 0;
    for (const spl of seatSplDb) {
      const diff = spl - meanDb;
      variance += diff * diff;
    }
    variance = variance / listeners.length;
    const standardDeviationDb = Math.sqrt(variance);

    points.push({
      frequencyHz: f,
      averageSplDb,
      seatSplDb,
      standardDeviationDb,
    });
  }

  return points.slice().sort((a, b) => a.frequencyHz - b.frequencyHz);
}