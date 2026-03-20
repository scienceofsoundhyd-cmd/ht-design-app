"use client"

import { buildConsultationPayload } from "./buildConsultationPayload"
import { buildDocument } from "./generatePdfReport"
import { AcousticAnalysisResult } from "@/lib/engine/acoustics/acousticOrchestrator"

export async function downloadAcousticReport(params: {
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
}): Promise<void> {

  const { pdf } = await import("@react-pdf/renderer")

  const payload = buildConsultationPayload(params)
  const documentElement = buildDocument(payload)

  await new Promise(resolve => setTimeout(resolve, 0))

  const instance = pdf(documentElement)
  const blob = await instance.toBlob()

  const url = URL.createObjectURL(blob)

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "Acoustic_Report.pdf"

  document.body.appendChild(anchor)
  anchor.click()

  setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 500)
}