import { Room } from "../core/room";
import { ModeCluster } from "./modeClustering";
import { computeModalDensity } from "./modalMetrics";
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig";

export type ModalSeverity = {
  readonly centerFrequencyHz: number;
  readonly bandwidthHz: number;
  readonly modeCount: number;
  readonly modalDensity: number;
  readonly severityScore: number;
};

/**
 * evaluateClusterSeverity
 *
 * Produces a composite severity index for a single mode cluster,
 * quantifying how acoustically problematic that cluster is likely
 * to be in the given room.
 *
 * PHYSICS
 * -------
 * Three independent factors each contribute to the degree to which
 * a cluster degrades low-frequency response:
 *
 *   modeCount
 *     The number of discrete standing waves within the cluster.
 *     More co-located resonances produce greater pressure buildup,
 *     longer combined decay, and more pronounced coloration.
 *     Scaled by modeCountWeight from central engine configuration.
 *
 *   bandwidthHz
 *     The spectral span of the cluster (f_max − f_min).
 *     A wider cluster contaminates a broader region of the frequency
 *     spectrum and is harder to address with narrow-band treatment.
 *     A +1 offset prevents the degenerate case of a single-mode cluster
 *     (bandwidth = 0) from nullifying the score entirely — an isolated
 *     resonance still carries non-zero severity.
 *     Scaled by bandwidthWeight from central engine configuration.
 *
 *   modalDensity
 *     The Weyl-approximated density of modes per Hz at the cluster's
 *     centre frequency. Higher density means modes are packed closer
 *     together, increasing the likelihood of mutual reinforcement and
 *     making individual resonances harder to resolve or suppress.
 *     Scaled by densityWeight from central engine configuration.
 *
 * The three weighted factors are multiplied to form a single dimensionless
 * severity score:
 *
 *   severityScore =
 *     (modeCountWeight × modeCount) ×
 *     (bandwidthWeight × (bandwidthHz + 1)) ×
 *     (densityWeight  × modalDensity)
 *
 * Scores are relative and only meaningful when compared across
 * clusters within the same room at the same analysis resolution.
 *
 * @param room    - Room providing geometry for modal density computation.
 * @param cluster - Pre-computed mode cluster to evaluate.
 * @returns ModalSeverity containing all contributing factors and the
 *          composite severity score.
 */
export function evaluateClusterSeverity(
  room: Room,
  cluster: ModeCluster
): ModalSeverity {
  const { modeCountWeight, bandwidthWeight, densityWeight } =
    DEFAULT_ACOUSTIC_CONFIG.severityWeights;

  const modeCount = cluster.modes.length;
  const modalDensity = computeModalDensity(room, cluster.centerFrequencyHz);

  const severityScore =
    (modeCountWeight * modeCount) *
    (bandwidthWeight * (cluster.bandwidthHz + 1)) *
    (densityWeight * modalDensity);

  return {
    centerFrequencyHz: cluster.centerFrequencyHz,
    bandwidthHz: cluster.bandwidthHz,
    modeCount,
    modalDensity,
    severityScore,
  };
}