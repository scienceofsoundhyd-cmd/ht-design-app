import { Room } from "../core/room";
import { ModalRiskRegion } from "./modalRiskMap";
import { ModalRegionSummary } from "./modalIntelligence";
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig";

export type TreatmentPriority = "low" | "moderate" | "high" | "critical";

export type AcousticRecommendation = {
  readonly centerFrequencyHz: number;
  readonly bandwidthHz: number;
  readonly severityScore: number;
  readonly regionType: "modal" | "transition" | "diffuse";
  readonly priority: TreatmentPriority;
};

/**
 * classifyRegionType
 *
 * Maps a centre frequency to one of the three acoustic region types
 * defined by the modal region summary boundaries.
 *
 * @param centerFrequencyHz - Centre frequency of the risk region (Hz).
 * @param regionSummary     - Pre-computed Schroeder-derived region boundaries.
 * @returns The acoustic region type for that frequency.
 */
function classifyRegionType(
  centerFrequencyHz: number,
  regionSummary: ModalRegionSummary
): "modal" | "transition" | "diffuse" {
  if (centerFrequencyHz < regionSummary.modalUpperLimitHz) return "modal";
  if (centerFrequencyHz < regionSummary.transitionUpperLimitHz) return "transition";
  return "diffuse";
}

/**
 * classifyPriority
 *
 * Converts a normalised severity ratio into a treatment priority level.
 *
 * RATIONALE
 * ---------
 * Absolute severity scores are not comparable across rooms of different
 * sizes or with different mode counts. Normalising against the maximum
 * severity in the current analysis produces a relative scale that is
 * stable and meaningful regardless of room geometry.
 *
 * Thresholds are sourced from central engine configuration:
 *
 *   ratio ≥ critical  → "critical" — dominant problem region; treat first.
 *   ratio ≥ high      → "high"     — significant contributor; high return on treatment.
 *   ratio ≥ moderate  → "moderate" — noticeable impact; secondary treatment priority.
 *   ratio  < moderate → "low"      — minor relative contribution.
 *
 * @param severityRatio - severityScore / maxSeverity in [0, 1].
 * @returns Treatment priority level.
 */
function classifyPriority(severityRatio: number): TreatmentPriority {
  if (severityRatio >= DEFAULT_ACOUSTIC_CONFIG.priorityThresholds.critical) return "critical";
  if (severityRatio >= DEFAULT_ACOUSTIC_CONFIG.priorityThresholds.high) return "high";
  if (severityRatio >= DEFAULT_ACOUSTIC_CONFIG.priorityThresholds.moderate) return "moderate";
  return "low";
}

/**
 * generateAcousticRecommendations
 *
 * Produces a prioritised list of acoustic treatment recommendations
 * derived from the modal risk map and the room's frequency region summary.
 *
 * PHYSICS AND RATIONALE
 * ----------------------
 * Modal risk regions identify where room modes cluster and how problematic
 * each cluster is. However, the appropriate treatment strategy depends not
 * only on severity but also on where in the frequency spectrum the cluster
 * sits relative to the Schroeder frequency:
 *
 *   Modal region      — standing waves dominate; bass trapping and
 *                       pressure-zone absorption are most effective.
 *   Transition region — modes begin overlapping; broadband treatment
 *                       at room boundaries is typically needed.
 *   Diffuse region    — statistical energy field; diffusion and
 *                       mid/high-frequency absorption are appropriate.
 *
 * Priority is determined by each region's severity relative to the worst
 * region in the current analysis, ensuring recommendations scale correctly
 * regardless of absolute room dimensions or mode count.
 *
 * The output is sorted by descending severityScore so that the highest-
 * priority treatment target is always the first element.
 *
 * @param room          - Room providing geometry context.
 * @param riskRegions   - Severity-scored modal risk regions (any order).
 * @param regionSummary - Schroeder-derived frequency region boundaries.
 * @returns Recommendations sorted by descending severity score.
 */
export function generateAcousticRecommendations(
  room: Room,
  riskRegions: ReadonlyArray<ModalRiskRegion>,
  regionSummary: ModalRegionSummary
): ReadonlyArray<AcousticRecommendation> {
  if (riskRegions.length === 0) return [];

  let maxSeverity = 0;
  for (const region of riskRegions) {
    if (region.severityScore > maxSeverity) {
      maxSeverity = region.severityScore;
    }
  }

  const recommendations: AcousticRecommendation[] = riskRegions.map((region) => {
    const regionType = classifyRegionType(region.centerFrequencyHz, regionSummary);
    const severityRatio = region.severityScore / maxSeverity;
    const priority = classifyPriority(severityRatio);

    return {
      centerFrequencyHz: region.centerFrequencyHz,
      bandwidthHz: region.bandwidthHz,
      severityScore: region.severityScore,
      regionType,
      priority,
    };
  });

  return recommendations.slice().sort((a, b) => b.severityScore - a.severityScore);
}