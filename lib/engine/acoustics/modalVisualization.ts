import { RoomMode } from "../core/modalAnalysis"

export type ModalVisualizationData = {
  readonly densityBelowSchroeder: number
  readonly clusterHotspots: ReadonlyArray<{
    readonly frequencyHz: number
    readonly severityScore: number
    readonly normalizedRisk: number
  }>
  readonly densityScore: number
}

export function buildModalVisualizationData(
  modes: ReadonlyArray<RoomMode>,
  clusters: ReadonlyArray<{ centerFrequencyHz: number }>,
  clusterSeverities: ReadonlyArray<{ severityScore: number }>,
  schroederFrequencyHz: number
): ModalVisualizationData {
  // Count modes below Schroeder frequency
  const densityBelowSchroeder = modes.filter(
    mode => mode.frequencyHz <= schroederFrequencyHz
  ).length

  // Build cluster hotspots by zipping clusters and severities
  const clusterHotspots = clusters.map((cluster, index) => {
    const severity = clusterSeverities[index] ?? { severityScore: 0 }
    return {
      frequencyHz: cluster.centerFrequencyHz,
      severityScore: severity.severityScore,
      normalizedRisk: Math.min(severity.severityScore, 100)
    }
  })

  // Calculate density score (0-100)
  const densityScore = Math.min(densityBelowSchroeder * 2, 100)

  return {
    densityBelowSchroeder,
    clusterHotspots,
    densityScore
  }
}
