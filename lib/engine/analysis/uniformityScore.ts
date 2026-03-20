import { MultiListenerFrequencyResponse } from "../frequencyResponse";

export type UniformityScore = {
  readonly flatnessDb: number;
  readonly uniformityDb: number;
  readonly combinedScore: number;
  readonly rating: number;
};

/**
 * computeUniformityScore
 *
 * Produces a composite acoustic quality score for a loudspeaker-room
 * system by evaluating two independent dimensions of low-frequency
 * performance — spectral flatness and spatial uniformity — within a
 * specified frequency band.
 *
 * ============================================================
 * WHY TWO METRICS ARE NECESSARY
 * ============================================================
 *
 * A single-axis metric cannot fully characterise low-frequency
 * reproduction quality because the two failure modes of a room are
 * independent and require separate measurement:
 *
 *   FAILURE MODE 1 — SPECTRAL UNEVENNESS
 *     The spatially averaged response varies significantly across
 *     frequency. Some frequencies are boosted (modal peaks) and others
 *     attenuated (modal nulls) relative to the mean. This is perceived
 *     as bass that sounds "one-note", boomy at certain pitches and thin
 *     at others. Flatness measures this axis.
 *
 *   FAILURE MODE 2 — SPATIAL INCONSISTENCY
 *     The response is consistent in frequency but varies dramatically
 *     from seat to seat. Some listeners hear a different tonal balance
 *     than others at the same moment. A system can achieve excellent
 *     average flatness while still having unacceptable seat-to-seat
 *     variation. Uniformity measures this axis.
 *
 * A system that scores well on only one axis still fails to deliver
 * high-quality reproduction. Both axes must be optimised simultaneously.
 *
 * ============================================================
 * FLATNESS — WHY IT MATTERS AND WHY IT IS INSUFFICIENT ALONE
 * ============================================================
 *
 * flatnessDb is the standard deviation of the spatially averaged SPL
 * across the analysis band. It quantifies how much the room-averaged
 * frequency response deviates from a flat target:
 *
 *   flatnessDb = σ(averageSplDb over band)
 *
 * A low flatnessDb means the room-averaged response is spectrally flat
 * — the system delivers approximately equal energy at all frequencies
 * within the band, averaged across all seats. This is the primary
 * target of subwoofer equalisation, room correction DSP, and treatment.
 *
 * WHY FLATNESS ALONE IS INSUFFICIENT:
 * A perfectly flat room-average can be achieved by a system that
 * simultaneously produces +10 dB at seat A and -10 dB at seat B for
 * every modal frequency — the average is flat but every individual seat
 * experiences severe coloration. Flatness describes the mean; it says
 * nothing about the distribution around that mean across space.
 *
 * ============================================================
 * UNIFORMITY — WHY IT MATTERS AND WHY IT IS INSUFFICIENT ALONE
 * ============================================================
 *
 * uniformityDb is the mean of the per-frequency seat-to-seat standard
 * deviation across the analysis band:
 *
 *   uniformityDb = mean(standardDeviationDb over band)
 *
 * A low uniformityDb means all seats receive approximately the same SPL
 * at every frequency in the band. This is the primary target of array
 * optimisation, subwoofer placement, and cardioid configurations designed
 * to smooth the spatial energy distribution.
 *
 * WHY UNIFORMITY ALONE IS INSUFFICIENT:
 * A system can achieve perfect seat-to-seat uniformity while delivering
 * a deeply coloured response at every seat simultaneously. If all seats
 * experience +8 dB at 60 Hz and -8 dB at 80 Hz equally, uniformityDb
 * is zero — but the response is severely uneven. Uniformity describes
 * spatial consistency; it says nothing about whether the consistent
 * response is itself flat.
 *
 * ============================================================
 * COMBINED SCORE
 * ============================================================
 *
 * The combined score is the weighted sum of both metrics:
 *
 *   combinedScore = flatnessWeight × flatnessDb + uniformityWeight × uniformityDb
 *
 * Both terms are in dB, so the weights control the relative importance
 * of each axis. Equal weights (1.0, 1.0) treat flatness and uniformity
 * as equally important. Increasing flatnessWeight prioritises
 * frequency-domain correction; increasing uniformityWeight prioritises
 * spatial distribution.
 *
 * LOWER combinedScore = BETTER SYSTEM.
 * A perfect system (flat response, identical at every seat) would
 * achieve combinedScore ≈ 0. Real rooms typically produce values
 * in the range of 2–15 dB depending on treatment and configuration.
 *
 * ============================================================
 * RATING SCALE (0–100)
 * ============================================================
 *
 * The rating maps the combined score to an intuitive 0–100 scale using
 * a hyperbolic decay:
 *
 *   rating = 100 / (1 + combinedScore)
 *
 * Properties of this mapping:
 *
 *   combinedScore = 0    → rating = 100  (theoretically perfect)
 *   combinedScore = 1    → rating = 50   (moderate problems)
 *   combinedScore = 4    → rating = 20   (significant problems)
 *   combinedScore = 9    → rating = 10   (severe problems)
 *   combinedScore → ∞   → rating → 0    (unusable)
 *
 * The hyperbolic form is appropriate because acoustic quality degrades
 * non-linearly: the improvement from 10 dB to 5 dB combined score is
 * more perceptually significant than from 5 dB to 0 dB. The rating
 * scale reflects this by compressing the upper end and expanding
 * improvements at lower combined scores.
 *
 * This rating is suitable for ranking multiple system configurations
 * (e.g., different subwoofer placements, delay settings, or EQ curves)
 * against each other. The configuration with the highest rating is the
 * best-performing system across both flatness and uniformity dimensions
 * within the analysis band.
 *
 * ============================================================
 * BAND RESTRICTION
 * ============================================================
 *
 * Analysis is restricted to the frequency range [minFrequencyHz,
 * maxFrequencyHz] to allow targeted evaluation of specific acoustic
 * regions — typically the modal bass region below the Schroeder
 * frequency. Frequencies outside the band are excluded from all
 * metric calculations.
 *
 * @param response         - Multi-listener frequency response array from
 *                           computeRoomFrequencyResponse.
 * @param minFrequencyHz   - Lower bound of the analysis band (Hz, inclusive).
 * @param maxFrequencyHz   - Upper bound of the analysis band (Hz, inclusive).
 * @param flatnessWeight   - Relative weight applied to flatnessDb in the
 *                           combined score.
 * @param uniformityWeight - Relative weight applied to uniformityDb in the
 *                           combined score.
 * @returns UniformityScore containing both component metrics, the weighted
 *          combined score, and a 0–100 rating.
 */
export function computeUniformityScore(
  response: ReadonlyArray<MultiListenerFrequencyResponse>,
  minFrequencyHz: number,
  maxFrequencyHz: number,
  flatnessWeight: number,
  uniformityWeight: number
): UniformityScore {
  const band = response.filter(
    (point) =>
      point.frequencyHz >= minFrequencyHz &&
      point.frequencyHz <= maxFrequencyHz
  );

  let sumAverageSpl = 0;
  for (const point of band) {
    sumAverageSpl += point.averageSplDb;
  }
  const meanAverage = sumAverageSpl / band.length;

  let sumVarianceAverage = 0;
  for (const point of band) {
    const diff = point.averageSplDb - meanAverage;
    sumVarianceAverage += diff * diff;
  }
  const varianceAverage = sumVarianceAverage / band.length;
  const flatnessDb = Math.sqrt(varianceAverage);

  let sumStandardDeviation = 0;
  for (const point of band) {
    sumStandardDeviation += point.standardDeviationDb;
  }
  const uniformityDb = sumStandardDeviation / band.length;

  const combinedScore = flatnessWeight * flatnessDb + uniformityWeight * uniformityDb;

  const rating = 100 / (1 + combinedScore);

  return {
    flatnessDb,
    uniformityDb,
    combinedScore,
    rating,
  };
}