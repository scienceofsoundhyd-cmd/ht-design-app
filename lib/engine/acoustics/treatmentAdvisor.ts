export type TreatmentPriority =
  | "low"
  | "moderate"
  | "high"
  | "critical"

export type TreatmentRecommendation = {
  readonly bassTrapRequired: boolean
  readonly broadbandRequired: boolean
  readonly diffusionRequired: boolean
  readonly ceilingCloudRequired: boolean

  readonly primaryProblemFrequencyHz: number | null
  readonly priority: TreatmentPriority

  readonly explanation: string
}

export function recommendTreatment(params: {
  worstClusterSeverity: number
  worstClusterFrequencyHz: number | null
  rt60Seconds: number
  densityScore: number
}): TreatmentRecommendation {
  const { worstClusterSeverity, worstClusterFrequencyHz, rt60Seconds, densityScore } = params

  // Treatment requirements based on acoustic parameters
  const bassTrapRequired = worstClusterSeverity > 40
  const broadbandRequired = rt60Seconds > 0.4
  const diffusionRequired = densityScore > 60
  const ceilingCloudRequired = rt60Seconds > 0.35

  // Priority based on worst cluster severity
  let priority: TreatmentPriority
  if (worstClusterSeverity > 60) {
    priority = "critical"
  } else if (worstClusterSeverity > 30) {
    priority = "high"
  } else if (worstClusterSeverity > 10) {
    priority = "moderate"
  } else {
    priority = "low"
  }

  // Build explanation string
  let explanation = ""

  if (priority === "critical") {
    if (worstClusterFrequencyHz) {
      explanation = `Critical modal resonance at ${worstClusterFrequencyHz.toFixed(0)} Hz requires immediate bass trapping.`
    } else {
      explanation = "Critical modal coupling detected. Immediate treatment required."
    }
  } else if (priority === "high") {
    if (worstClusterFrequencyHz) {
      explanation = `Strong modal resonance at ${worstClusterFrequencyHz.toFixed(0)} Hz. Bass trapping and accurate measurement recommended.`
    } else {
      explanation = "Significant modal issues detected. Professional treatment planning recommended."
    }
  } else if (priority === "moderate") {
    const issues: string[] = []
    if (broadbandRequired) issues.push("elevated RT60")
    if (diffusionRequired) issues.push("high modal density")

    if (issues.length > 0) {
      explanation = `Room exhibits ${issues.join(" and ")}. Consider targeted acoustic treatment.`
    } else if (worstClusterFrequencyHz) {
      explanation = `Modest modal resonance at ${worstClusterFrequencyHz.toFixed(0)} Hz. Monitor with measurement.`
    } else {
      explanation = "Moderate acoustic concerns. Evaluation recommended."
    }
  } else {
    explanation = "Room acoustics within acceptable range. Monitoring suggested as reference."
  }

  return {
    bassTrapRequired,
    broadbandRequired,
    diffusionRequired,
    ceilingCloudRequired,
    primaryProblemFrequencyHz: worstClusterFrequencyHz,
    priority,
    explanation
  }
}
