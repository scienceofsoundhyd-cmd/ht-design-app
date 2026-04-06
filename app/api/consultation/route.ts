export const runtime = "nodejs"

import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { renderToBuffer } from "@react-pdf/renderer"
import { buildDocument, ConsultationPayload } from "@/lib/report/generatePdfReport"

interface ConsultationRequest {
  name: string
  email: string
  projectType: string
  notes?: string
  contact?: string
  company?: string
  projectRef?: string
  speakerBrand?: string
  projectDate?: string
  wallConstruction?: string
  unitSystem?: string
  roomColorScheme?: string
  rating: number
  rt60Seconds: number
  rt60Sabine?: number
  rt60Eyring?: number
  rt60Target?: string
  rt60Status?: string
  schroederHz?: number
  modalRiskLevel?: string
  clusterSeverityScore: number
  roomWidth: number
  roomHeight: number
  roomLength: number
  roomVolume?: number
  treatmentLevel?: string
  designIntent?: string
  acousticDepthFront?: number
  acousticDepthRear?: number
  acousticDepthLeft?: number
  acousticDepthRight?: number
  acousticDepthCeiling?: number
  speakerConfig?: string
  speakerSystem?: string
  mountType?: string
  screenPlacement?: string
  extraSidePairs?: number
  extraCeilingPairs?: number
  viewingStandard?: string
  aspectRatio?: string
  screenDiagonalInches?: number
  screenWidthM?: number
  screenHeightM?: number
  throwRatio?: number
  throwDistanceM?: number
  viewingDistanceM?: number
  seatType?: string
  rowCount?: number
  seatsPerRow?: number
  totalSeats?: number
  riserStepMm?: number
  riserRakeDeg?: number
  sightlineGrade?: string
  totalRiseM?: number
  timestamp: string
}

interface ValidationResult {
  valid: boolean
  data?: ConsultationRequest
  error?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null)
    return { valid: false, error: "Invalid request body" }

  const b = body as Record<string, unknown>

  const name               = b["name"]
  const email              = b["email"]
  const projectType        = b["projectType"]
  const notes              = b["notes"]
  const rating             = b["rating"]
  const rt60Seconds        = b["rt60Seconds"]
  const clusterSeverityScore = b["clusterSeverityScore"]
  const roomWidth          = b["roomWidth"]
  const roomHeight         = b["roomHeight"]
  const roomLength         = b["roomLength"]
  const timestamp          = b["timestamp"]

  if (typeof name !== "string" || name.trim().length === 0 || name.length > 60)
    return { valid: false, error: "Name is required and must be max 60 characters" }

  if (
    typeof email !== "string" ||
    email.trim().length === 0 ||
    email.length > 100 ||
    !EMAIL_REGEX.test(email)
  )
    return { valid: false, error: "Valid email is required and must be max 100 characters" }

  if (typeof projectType !== "string" || projectType.trim().length === 0)
    return { valid: false, error: "Project type is required" }

  if (notes && typeof notes === "string" && notes.length > 500)
    return { valid: false, error: "Notes must be max 500 characters" }

  if (typeof rating !== "number" || rating < 0 || rating > 100)
    return { valid: false, error: "Rating must be a number between 0 and 100" }

  if (typeof rt60Seconds !== "number" || rt60Seconds <= 0)
    return { valid: false, error: "RT60 seconds must be a positive number" }

  if (typeof clusterSeverityScore !== "number" || clusterSeverityScore < 0 || clusterSeverityScore > 100)
    return { valid: false, error: "Cluster severity score must be between 0 and 100" }

  if (typeof roomWidth !== "number" || roomWidth <= 0)
    return { valid: false, error: "Room width must be a positive number" }

  if (typeof roomHeight !== "number" || roomHeight <= 0)
    return { valid: false, error: "Room height must be a positive number" }

  if (typeof roomLength !== "number" || roomLength <= 0)
    return { valid: false, error: "Room length must be a positive number" }

  if (typeof timestamp !== "string" || timestamp.trim().length === 0)
    return { valid: false, error: "Timestamp is required" }

  const getString = (k: string) => typeof b[k] === "string" ? b[k] as string : undefined
  const getNum    = (k: string) => typeof b[k] === "number" ? b[k] as number : undefined

  return {
    valid: true,
    data: {
      name:                 (name as string).trim(),
      email:                (email as string).trim(),
      projectType:          (projectType as string).trim(),
      notes:                notes && typeof notes === "string" ? notes.trim() : undefined,
      contact:              getString("contact"),
      company:              getString("company"),
      projectRef:           getString("projectRef"),
      speakerBrand:         getString("speakerBrand"),
      projectDate:          getString("projectDate"),
      wallConstruction:     getString("wallConstruction"),
      unitSystem:           getString("unitSystem"),
      roomColorScheme:      getString("roomColorScheme"),
      rating:               rating as number,
      rt60Seconds:          rt60Seconds as number,
      rt60Sabine:           getNum("rt60Sabine"),
      rt60Eyring:           getNum("rt60Eyring"),
      rt60Target:           getString("rt60Target"),
      rt60Status:           getString("rt60Status"),
      schroederHz:          getNum("schroederHz"),
      modalRiskLevel:       getString("modalRiskLevel"),
      clusterSeverityScore: clusterSeverityScore as number,
      roomWidth:            roomWidth as number,
      roomHeight:           roomHeight as number,
      roomLength:           roomLength as number,
      roomVolume:           getNum("roomVolume"),
      treatmentLevel:       getString("treatmentLevel"),
      designIntent:         getString("designIntent"),
      acousticDepthFront:   getNum("acousticDepthFront"),
      acousticDepthRear:    getNum("acousticDepthRear"),
      acousticDepthLeft:    getNum("acousticDepthLeft"),
      acousticDepthRight:   getNum("acousticDepthRight"),
      acousticDepthCeiling: getNum("acousticDepthCeiling"),
      speakerConfig:        getString("speakerConfig"),
      speakerSystem:        getString("speakerSystem"),
      mountType:            getString("mountType"),
      screenPlacement:      getString("screenPlacement"),
      extraSidePairs:       getNum("extraSidePairs"),
      extraCeilingPairs:    getNum("extraCeilingPairs"),
      viewingStandard:      getString("viewingStandard"),
      aspectRatio:          getString("aspectRatio"),
      screenDiagonalInches: getNum("screenDiagonalInches"),
      screenWidthM:         getNum("screenWidthM"),
      screenHeightM:        getNum("screenHeightM"),
      throwRatio:           getNum("throwRatio"),
      throwDistanceM:       getNum("throwDistanceM"),
      viewingDistanceM:     getNum("viewingDistanceM"),
      seatType:             getString("seatType"),
      rowCount:             getNum("rowCount"),
      seatsPerRow:          getNum("seatsPerRow"),
      totalSeats:           getNum("totalSeats"),
      riserStepMm:          getNum("riserStepMm"),
      riserRakeDeg:         getNum("riserRakeDeg"),
      sightlineGrade:       getString("sightlineGrade"),
      totalRiseM:           getNum("totalRiseM"),
      timestamp:            (timestamp as string).trim(),
    },
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json()

    const validation = validateInput(body)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400 }
      )
    }

    const data = validation.data!

    // ── Build PDF payload ─────────────────────────────────────────────────────
    const payload: ConsultationPayload = {
      // Client
      name:                 data.name,
      email:                data.email,
      contact:              data.contact,
      company:              data.company,
      projectRef:           data.projectRef,
      speakerBrand:         data.speakerBrand,
      projectDate:          data.projectDate,
      wallConstruction:     data.wallConstruction,
      projectType:          data.projectType,
      notes:                data.notes || "",
      unitSystem:           data.unitSystem,
      roomColorScheme:      data.roomColorScheme,
      // Room
      roomWidth:            data.roomWidth,
      roomHeight:           data.roomHeight,
      roomLength:           data.roomLength,
      roomVolume:           data.roomVolume,
      // Treatment
      treatmentLevel:       data.treatmentLevel,
      designIntent:         data.designIntent,
      acousticDepthFront:   data.acousticDepthFront,
      acousticDepthRear:    data.acousticDepthRear,
      acousticDepthLeft:    data.acousticDepthLeft,
      acousticDepthRight:   data.acousticDepthRight,
      acousticDepthCeiling: data.acousticDepthCeiling,
      // Acoustic results
      rating:               data.rating,
      rt60Seconds:          data.rt60Seconds,
      rt60Sabine:           data.rt60Sabine,
      rt60Eyring:           data.rt60Eyring,
      rt60Target:           data.rt60Target,
      rt60Status:           data.rt60Status,
      schroederHz:          data.schroederHz,
      modalRiskLevel:       data.modalRiskLevel,
      clusterSeverityScore: data.clusterSeverityScore,
      // Speakers
      speakerConfig:        data.speakerConfig,
      speakerSystem:        data.speakerSystem,
      mountType:            data.mountType,
      screenPlacement:      data.screenPlacement,
      extraSidePairs:       data.extraSidePairs,
      extraCeilingPairs:    data.extraCeilingPairs,
      // Screen
      viewingStandard:      data.viewingStandard,
      aspectRatio:          data.aspectRatio,
      screenDiagonalInches: data.screenDiagonalInches,
      screenWidthM:         data.screenWidthM,
      screenHeightM:        data.screenHeightM,
      throwRatio:           data.throwRatio,
      throwDistanceM:       data.throwDistanceM,
      viewingDistanceM:     data.viewingDistanceM,
      // Seating
      seatType:             data.seatType,
      rowCount:             data.rowCount,
      seatsPerRow:          data.seatsPerRow,
      totalSeats:           data.totalSeats,
      riserStepMm:          data.riserStepMm,
      riserRakeDeg:         data.riserRakeDeg,
      sightlineGrade:       data.sightlineGrade,
      totalRiseM:           data.totalRiseM,
      timestamp:            data.timestamp,
    }

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const document  = buildDocument(payload)
    const pdfBuffer = await renderToBuffer(document)

    // ── Send email only if SMTP is fully configured ───────────────────────────
    // If SMTP vars are missing the PDF download still works — email is optional
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM

    if (smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom) {
      try {
        const transporter = nodemailer.createTransport({
          host:   smtpHost,
          port:   Number(smtpPort),
          secure: Number(smtpPort) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        })

        await transporter.sendMail({
          from:    smtpFrom,
          to:      data.email,
          subject: `Your Home Theater Design Report — Rating: ${Math.round(data.rating)}/100`,
          text:    `Dear ${data.name},\n\nPlease find attached your acoustic analysis report.\n\nThank you,\nScience of Sound Acoustic Engine`,
          attachments: [
            {
              filename:    "Acoustic_Report.pdf",
              content:     pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        })
      } catch (emailErr) {
        // Email failed — log it, but don't block the PDF download
        console.error("Email delivery failed (PDF still returned):", emailErr)
      }
    }

    // ── Always return PDF for download ────────────────────────────────────────
    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": "attachment; filename=Acoustic_Report.pdf",
      },
    })

  } catch (error: unknown) {
    console.error("Export error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to generate report" },
      { status: 500 }
    )
  }
}
