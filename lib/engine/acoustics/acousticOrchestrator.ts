import { Room } from "../core/room"
import { AbsorptionCoefficients, computeRT60Sabine, computeRT60Eyring } from "./rt60"
import { analyzeModalRegions, ModalRegionSummary } from "./modalIntelligence"
import { computeAllRoomModes } from "../core/modalAnalysis"
import { detectModeClusters, ModeCluster } from "./modeClustering"
import { evaluateClusterSeverity, ModalSeverity } from "./modalSeverity"
import { buildModalVisualizationData, ModalVisualizationData } from "./modalVisualization"
import { recommendTreatment, TreatmentRecommendation } from "./treatmentAdvisor"
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig"

export type AcousticRiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "critical"

export type AcousticConfidenceLevel =
  | "low"
  | "medium"
  | "high"

export type AcousticAnalysisResult = {
  readonly volumeM3: number
  readonly modeCount: number

  readonly rt60Seconds: number
  readonly rt60SabineSeconds: number
  readonly rt60EyringSeconds: number
  readonly schroederFrequencyHz: number

  readonly modalRegionSummary: ModalRegionSummary

  readonly clusters: ReadonlyArray<ModeCluster>
  readonly clusterSeverities: ReadonlyArray<ModalSeverity>
  readonly worstCluster: ModalSeverity | null

  readonly modalRiskLevel: AcousticRiskLevel

  readonly acousticScore: number
  readonly confidenceLevel: AcousticConfidenceLevel

  readonly modalVisualization: ModalVisualizationData

  readonly recommendedTreatment: TreatmentRecommendation
}

function deriveRiskLevel(worstCluster: ModalSeverity | null): AcousticRiskLevel {
  if (worstCluster === null) {
    return "low"
  }

  const severity = worstCluster.severityScore
  if (severity < 5) return "low"
  if (severity < 20) return "moderate"
  if (severity < 60) return "high"
  return "critical"
}

function computeAcousticScore(
  worstCluster: ModalSeverity | null,
  rt60Seconds: number,
  volumeM3: number
): number {
  const baseScore = 100

  let modalPenalty = 0
  if (worstCluster !== null) {
    modalPenalty = Math.min(worstCluster.severityScore, 100)
  }

  const rt60Target = 0.3 + volumeM3 * 0.002
  const rtDifference = Math.abs(rt60Seconds - rt60Target)
  const rtPenalty = rtDifference * 50

  const totalPenalty = modalPenalty + rtPenalty
  const finalScore = Math.max(0, baseScore - totalPenalty)

  return Math.round(finalScore)
}

function deriveConfidenceLevel(
  riskLevel: AcousticRiskLevel,
  acousticScore: number
): AcousticConfidenceLevel {
  if (riskLevel === "critical") {
    return "low"
  }

  if (acousticScore > 75) return "high"
  if (acousticScore > 50) return "medium"
  return "low"
}
export function analyzeRoomAcoustics(
  room: Room,
  absorption: AbsorptionCoefficients
): AcousticAnalysisResult {

  const volumeM3 =
    room.width * room.height * room.length

  const rt60Sabine =
    computeRT60Sabine(room, absorption)

  const rt60Eyring =
    computeRT60Eyring(room, absorption)

  const rt60Seconds = rt60Eyring

  const modalRegionSummary =
    analyzeModalRegions(room, absorption)

  const modalMaxFrequencyHz =
    modalRegionSummary.transitionUpperLimitHz

  const modes =
    computeAllRoomModes(
      room,
      modalMaxFrequencyHz
    )

  const clusters =
    detectModeClusters(
      modes,
      DEFAULT_ACOUSTIC_CONFIG.matchToleranceHz
    )

  const clusterSeverities =
    clusters.map(cluster =>
      evaluateClusterSeverity(room, cluster)
    )

  let worstCluster: ModalSeverity | null = null

  if (clusterSeverities.length > 0) {
    worstCluster =
      clusterSeverities.reduce((worst, current) =>
        current.severityScore > worst.severityScore
          ? current
          : worst
      )
  }

  const modalRiskLevel =
    deriveRiskLevel(worstCluster)

  const acousticScore =
    computeAcousticScore(
      worstCluster,
      rt60Seconds,
      volumeM3
    )

  const confidenceLevel =
    deriveConfidenceLevel(
      modalRiskLevel,
      acousticScore
    )

  const modalVisualization =
    buildModalVisualizationData(
      modes,
      clusters,
      clusterSeverities,
      modalRegionSummary.schroederFrequencyHz
    )

  const recommendedTreatment =
    recommendTreatment({
      worstClusterSeverity:
        worstCluster?.severityScore ?? 0,
      worstClusterFrequencyHz:
        worstCluster?.centerFrequencyHz ?? null,
      rt60Seconds,
      densityScore:
        modalVisualization.densityScore
    })

  return {
    volumeM3,
    modeCount: modes.length,
    rt60Seconds,
    rt60SabineSeconds: rt60Sabine,
    rt60EyringSeconds: rt60Eyring,
    schroederFrequencyHz:
      modalRegionSummary.schroederFrequencyHz,
    modalRegionSummary,
    clusters,
    clusterSeverities,
    worstCluster,
    modalRiskLevel,
    acousticScore,
    confidenceLevel,
    modalVisualization,
    recommendedTreatment
  }
}
