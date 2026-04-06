import { AcousticAnalysisResult } from "@/lib/engine/acoustics/acousticOrchestrator"
import { ConsultationPayload } from "./generatePdfReport"

export function buildConsultationPayload(params: {
  result: AcousticAnalysisResult
  room: {
    width: number
    height: number
    length: number
  }
  client: {
    name: string
    email: string
    projectType: string
    notes?: string
  }
}): ConsultationPayload {
  const { result, room, client } = params

  return {
  name: client.name,
  email: client.email,
  projectType: client.projectType,
  notes: client.notes ?? "",

  rating: result.acousticScore,
  clusterSeverityScore: result.worstCluster?.severityScore ?? 0,
  rt60Seconds: result.rt60Seconds,

  roomWidth: room.width,
  roomHeight: room.height,
  roomLength: room.length,

  timestamp: new Date().toISOString()
}
}
