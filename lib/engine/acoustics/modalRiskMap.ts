import { Room } from "../core/room";
import { RoomMode } from "../core/modalAnalysis";
import { ModeCluster, detectModeClusters } from "./modeClustering";
import { evaluateClusterSeverity } from "./modalSeverity";

export type ModalRiskRegion = {
  readonly centerFrequencyHz: number;
  readonly bandwidthHz: number;
  readonly modeCount: number;
  readonly modalDensity: number;
  readonly severityScore: number;
};

export type ModalRiskMap = {
  readonly riskRegions: ReadonlyArray<ModalRiskRegion>;
  readonly clusters: ReadonlyArray<ModeCluster>;
};

/**
 * buildModalRiskMap
 *
 * Produces a severity-ranked map of all modal risk regions in a room
 * by clustering adjacent modes and scoring each cluster.
 *
 * PHYSICS
 * -------
 * Individual room modes become more problematic when they occur in
 * close spectral proximity. Clustering reveals which regions of the
 * frequency spectrum concentrate the most resonant energy, and the
 * severity score (modeCount × (bandwidth + 1) × modalDensity) weights
 * each region by the three independent factors that determine its
 * acoustic impact.
 *
 * Sorting the riskRegions output by descending severity score places
 * the most problematic regions first, giving a direct priority ordering
 * for acoustic treatment decisions. The clusters array is returned in
 * its original ascending-frequency order so that downstream consumers
 * can perform index-stable lookups without re-clustering.
 *
 * PIPELINE
 * --------
 *   1. detectModeClusters  — groups sorted modes into spectral clusters
 *                            within toleranceHz of one another.
 *   2. evaluateClusterSeverity — scores each cluster against the room's
 *                                modal density at its centre frequency.
 *   3. Sort riskRegions descending by severityScore — highest risk first.
 *   4. Return both riskRegions and original clusters.
 *
 * @param room        - Room providing geometry for all derived calculations.
 * @param modes       - All room modes in ascending frequency order.
 * @param toleranceHz - Maximum frequency gap (Hz) between adjacent modes
 *                      for them to be grouped into the same cluster.
 * @returns ModalRiskMap containing severity-ranked risk regions and the
 *          source clusters in ascending frequency order.
 */
export function buildModalRiskMap(
  room: Room,
  modes: ReadonlyArray<RoomMode>,
  toleranceHz: number
): ModalRiskMap {
  const clusters = detectModeClusters(modes, toleranceHz);

  const riskRegions: ModalRiskRegion[] = clusters.map((cluster) => {
    const severity = evaluateClusterSeverity(room, cluster);
    return {
      centerFrequencyHz: severity.centerFrequencyHz,
      bandwidthHz: severity.bandwidthHz,
      modeCount: severity.modeCount,
      modalDensity: severity.modalDensity,
      severityScore: severity.severityScore,
    };
  });

  const sortedRiskRegions = riskRegions
    .slice()
    .sort((a, b) => b.severityScore - a.severityScore);

  return {
    riskRegions: sortedRiskRegions,
    clusters,
  };
}