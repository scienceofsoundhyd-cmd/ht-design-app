import { Room } from "../core/room";
import { computeAllRoomModes } from "../core/modalAnalysis";
import { AbsorptionCoefficients } from "./rt60";
import { analyzeModalRegions } from "./modalIntelligence";
import { buildModalRiskMap } from "./modalRiskMap";
import { generateAcousticRecommendations } from "./acousticRecommendations";
import { deriveTreatmentStrategy, TreatmentStrategy } from "./treatmentStrategy";
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig";

export type AcousticReport = {
  readonly schroederFrequencyHz: number;
  readonly modalUpperLimitHz: number;
  readonly transitionUpperLimitHz: number;
  readonly treatmentStrategies: ReadonlyArray<ReturnType<typeof deriveTreatmentStrategy>>;
};

export function buildAcousticReport(
  room: Room,
  absorption: AbsorptionCoefficients,
  maxFrequencyHz: number,
  clusterToleranceHz: number
): AcousticReport {
  const modes = computeAllRoomModes(room, maxFrequencyHz);

  const regionSummary = analyzeModalRegions(room, absorption);

  const { riskRegions, clusters } = buildModalRiskMap(room, modes, clusterToleranceHz);

  const recommendations = generateAcousticRecommendations(
    room,
    riskRegions,
    regionSummary
  );

  const treatmentStrategies: TreatmentStrategy[] = recommendations.map(
    (recommendation) => {
      const matchingCluster = clusters.find(
        (cluster) =>
          Math.abs(
            cluster.centerFrequencyHz - recommendation.centerFrequencyHz
          ) < DEFAULT_ACOUSTIC_CONFIG.matchToleranceHz
      );

      const contributingModes =
        matchingCluster !== undefined ? matchingCluster.modes : [];

      return deriveTreatmentStrategy(recommendation, contributingModes);
    }
  );

  return {
    schroederFrequencyHz: regionSummary.schroederFrequencyHz,
    modalUpperLimitHz: regionSummary.modalUpperLimitHz,
    transitionUpperLimitHz: regionSummary.transitionUpperLimitHz,
    treatmentStrategies,
  };
}