import { RoomMode } from "../core/modalAnalysis";

export type ModeCluster = {
  readonly centerFrequencyHz: number;
  readonly bandwidthHz: number;
  readonly modes: ReadonlyArray<RoomMode>;
};

/**
 * detectModeClusters
 *
 * Groups a pre-sorted sequence of room modes into clusters of spectrally
 * adjacent resonances whose frequencies fall within a given tolerance of
 * one another.
 *
 * PHYSICS
 * -------
 * In a real room, modes rarely occur in perfect isolation. When two or more
 * modes fall within a narrow frequency band they interact perceptually and
 * physically — producing additive pressure buildup, extended decay, and
 * coloration that is harder to treat than isolated resonances. Identifying
 * these clusters is a prerequisite for targeted acoustic correction.
 *
 * The clustering criterion is proximity to the immediately preceding mode
 * rather than to the cluster centroid. This preserves a chain-linking
 * behaviour consistent with the physical notion of spectral crowding:
 * if mode B is close to mode A, and mode C is close to mode B, all three
 * are considered a single problematic region even if C and A alone would
 * not meet the tolerance criterion.
 *
 * ALGORITHM
 * ---------
 * Modes are assumed to arrive in ascending frequency order (no internal
 * sort is performed). A greedy single-pass sweep:
 *
 *   1. Open a new cluster with the first mode.
 *   2. For each subsequent mode:
 *        |f_current − f_last_in_cluster| ≤ toleranceHz → extend cluster.
 *        otherwise                                       → close cluster, open new.
 *   3. Close the final open cluster.
 *   4. For each cluster derive:
 *        centerFrequencyHz = arithmetic mean of all member frequencies.
 *        bandwidthHz       = f_max − f_min.
 *
 * Single-mode clusters (bandwidth = 0) are retained without modification.
 * They represent isolated resonances and are acoustically meaningful in
 * their own right.
 *
 * @param modes       - Room modes in ascending frequency order.
 * @param toleranceHz - Maximum frequency gap (Hz) between adjacent modes
 *                      for them to be considered part of the same cluster.
 * @returns Clusters in ascending centre-frequency order, each containing
 *          its member modes, arithmetic centre frequency, and bandwidth.
 */
export function detectModeClusters(
  modes: ReadonlyArray<RoomMode>,
  toleranceHz: number
): ReadonlyArray<ModeCluster> {
  if (modes.length === 0) return [];

  const clusters: ModeCluster[] = [];

  // Working accumulator for the cluster currently being built.
  let currentGroup: RoomMode[] = [modes[0]];

  for (let i = 1; i < modes.length; i++) {
    const previous = currentGroup[currentGroup.length - 1];
    const current = modes[i];
    const gap = Math.abs(current.frequencyHz - previous.frequencyHz);

    if (gap <= toleranceHz) {
      currentGroup = [...currentGroup, current];
    } else {
      clusters.push(buildCluster(currentGroup));
      currentGroup = [current];
    }
  }

  // Close the final open cluster.
  clusters.push(buildCluster(currentGroup));

  return clusters;
}

/**
 * buildCluster
 *
 * Derives a ModeCluster from a non-empty array of grouped RoomModes.
 *
 * centerFrequencyHz is the arithmetic mean of all member frequencies,
 * reflecting the perceptual centre of the cluster's spectral mass.
 *
 * bandwidthHz is the span from the lowest to the highest member frequency,
 * describing the width of the region affected by the cluster.
 *
 * @param group - Non-empty array of modes belonging to a single cluster.
 * @returns Immutable ModeCluster derived from the group.
 */
function buildCluster(group: ReadonlyArray<RoomMode>): ModeCluster {
  let sum = 0;
  let minFreq = group[0].frequencyHz;
  let maxFreq = group[0].frequencyHz;

  for (const mode of group) {
    sum += mode.frequencyHz;
    if (mode.frequencyHz < minFreq) minFreq = mode.frequencyHz;
    if (mode.frequencyHz > maxFreq) maxFreq = mode.frequencyHz;
  }

  const centerFrequencyHz = sum / group.length;
  const bandwidthHz = maxFreq - minFreq;

  return {
    centerFrequencyHz,
    bandwidthHz,
    modes: group,
  };
}