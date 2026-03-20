"use client"

import { createRoom } from "@/lib/engine/core"
import { useState, useRef, useEffect, useMemo, useDeferredValue } from "react"
import { buildScene } from "@/lib/engine/core/sceneBuilder"
import { ViewingStandard } from "@/lib/engine/core/screen"
import { SpeakerSystemType } from "@/lib/engine/core/types"
import { LCRMode, SurroundMode, CeilingCount } from "@/lib/engine/core/sceneBuilder"
import { analyzeRoomAcoustics } from "@/lib/engine/acoustics/acousticOrchestrator"
import { computePanelLayout } from "@/lib/engine/acoustics/panelEngine"
import { feetInchesToMeters, metersToFeetInches } from "@/lib/engine/core/units"
import { validateRoomDimensions } from "@/lib/engine/validation/roomConstraints"
import { speakerConfigurations } from "@/lib/engine/config/speakerConfigurations"
import { evaluateCeilingSuitability } from "@/lib/engine/validation/ceilingValidation"
import TheatreView3D from "@/app/components/TheatreView3D"

interface CeilingValidationResult {
  id: string
  label?: string
  eligible: boolean
  minHeight?: number
}

const WALL_MATERIAL_COEFF: Record<string, { wall: number; ceiling: number; floor: number }> = {
  drywall:  { wall: 0.05, ceiling: 0.05, floor: 0.02 },
  concrete: { wall: 0.02, ceiling: 0.02, floor: 0.015 },
  timber:   { wall: 0.10, ceiling: 0.08, floor: 0.08  },
  brick:    { wall: 0.03, ceiling: 0.03, floor: 0.02  },
  mixed:    { wall: 0.05, ceiling: 0.04, floor: 0.03  },
}

const RT60_TARGETS: Record<string, { min: number; max: number; label: string }> = {
  dialogue:  { min: 0.15, max: 0.30, label: "Performance / Accuracy" },
  cinematic: { min: 0.20, max: 0.40, label: "Cinematic Reference"    },
  hybrid:    { min: 0.25, max: 0.45, label: "Luxury / Hybrid"        },
  music:     { min: 0.30, max: 0.50, label: "Audiophile / Music"     },
}

const C_VALUES: Record<string, { mm: number; label: string; desc: string }> = {
  economy:   { mm: 60,  label: "Economy",   desc: "Basic sightline — economy standard"          },
  standard:  { mm: 80,  label: "Standard",  desc: "SMPTE / BS EN 13200 home theater standard"   },
  luxury:    { mm: 100, label: "Luxury",    desc: "Premium — clear view over two rows"           },
  reference: { mm: 125, label: "Reference", desc: "THX reference cinema grade"                  },
}

const TREATMENT_BASE: Record<string, { floor: number; surface: number }> = {
  none:     { floor: 0.03, surface: 0.04 },
  basic:    { floor: 0.05, surface: 0.18 },
  standard: { floor: 0.06, surface: 0.32 },
  studio:   { floor: 0.07, surface: 0.52 },
  extreme:  { floor: 0.08, surface: 0.65 },
}

export default function EngineV2() {

  // Hard limits (in meters)
  const LIMITS = {
    length: 30.48,   // 100 ft
    width: 18.29,    // 60 ft
    height: 6.10     // 20 ft
  }

  const clampValue = (value: number, max: number): number => {
    return Math.max(0, Math.min(value, max))
  }

  const updateMetricDimension = (
    key: "length" | "width" | "height",
    value: number
  ): void => {
    const clampedValue = clampValue(value, LIMITS[key])
    setMetricDimensions(prev => ({ ...prev, [key]: clampedValue }))
    const feetInches = metersToFeetInches(clampedValue)
    setImperialDimensions(prev => ({
      ...prev,
      [key + "Feet"]: feetInches.feet,
      [key + "Inches"]: feetInches.inches
    }))
  }

  const updateImperialDimension = (
    key: "length" | "width" | "height",
    feet: number,
    inches: number
  ): void => {
    const clampedFeet = Math.max(0, feet)
    const clampedInches = Math.max(0, Math.min(inches, 11))
    const totalFeet = clampedFeet + Math.floor(clampedInches / 12)
    const normInches = clampedInches % 12
    const meters = feetInchesToMeters(totalFeet, normInches)
    const clampedMeters = clampValue(meters, LIMITS[key])
    setMetricDimensions(prev => ({ ...prev, [key]: clampedMeters }))
    const syncedFeetInches = metersToFeetInches(clampedMeters)
    setImperialDimensions(prev => ({
      ...prev,
      [key + "Feet"]: syncedFeetInches.feet,
      [key + "Inches"]: syncedFeetInches.inches
    }))
  }

  const [standard, setStandard] = useState<ViewingStandard>("THX")
  const [lcrMode,      setLcrMode]      = useState<LCRMode>("lcr")
  const [surroundMode, setSurroundMode] = useState<SurroundMode>("side_rear")
  const [ceilingCount, setCeilingCount] = useState<CeilingCount>(0)
  const speakerConfigEdited = useRef(false)

  type UnitSystem = "metric" | "imperial"
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric")

  const [metricDimensions, setMetricDimensions] = useState({ width: 0, height: 0, length: 0 })
  const [imperialDimensions, setImperialDimensions] = useState({
    widthFeet: 0, widthInches: 0,
    heightFeet: 0, heightInches: 0,
    lengthFeet: 0, lengthInches: 0
  })

  type TreatmentLevel = "none" | "basic" | "standard" | "studio"
  type DesignIntent = "dialogue" | "cinematic" | "music" | "hybrid"

  const [treatmentLevel, setTreatmentLevel] = useState<TreatmentLevel>("none")
  const [designIntent, setDesignIntent] = useState<DesignIntent>("dialogue")
  const [roomColorScheme, setRoomColorScheme] = useState<string>("obsidian")
  const [sideLinked, setSideLinked] = useState<boolean>(true)
  const [acousticDepthMeters, setAcousticDepthMeters] = useState({
    front: 0, rear: 0, left: 0, right: 0, ceiling: 0
  })

  // Deferred values — inputs stay instant, heavy physics chain defers until browser idle
  const deferredMetric   = useDeferredValue(metricDimensions)
  const deferredImperial = useDeferredValue(imperialDimensions)
  const deferredDepths   = useDeferredValue(acousticDepthMeters)
  const [clientInfo, setClientInfo] = useState({
    name: "", email: "", contact: "", company: "", projectRef: "",
    projectType: "Home Theater", notes: "", speakerBrand: "", preparedBy: "",
    projectDate: new Date().toISOString().slice(0, 10),   // YYYY-MM-DD, defaults to today
  })

  const [mountType, setMountType] = useState<"inWall" | "onWall">("onWall")
  const [screenPlacement, setScreenPlacement] = useState<"behindScreen" | "besideScreen">("behindScreen")

  // NOTE: extraSidePairs / extraCeilingPairs are now auto-derived from room physics
  // (see maxExtraSidePairs / maxExtraCeilingPairs below). State retained only for SVG render compat.
  const [extraSidePairs, setExtraSidePairs] = useState<number>(0)
  const [extraCeilingPairs, setExtraCeilingPairs] = useState<number>(0)

  const [seatType, setSeatType] = useState<"standard" | "luxury">("standard")  // kept for SVG compat
  const [rowPitchFt, setRowPitchFt] = useState<number>(5)  // 5–7 ft whole feet
  const [rowCount, setRowCount] = useState<number>(1)
  const [primaryRow, setPrimaryRow] = useState<number>(0)
  const [rightPanelTab, setRightPanelTab] = useState<"acoustics"|"seating"|"screen"|"engineering"|"suggestions">("suggestions")
  const [seatsPerRow, setSeatsPerRow] = useState<number>(3)
  const [sightlineGrade, setSightlineGrade] = useState<"economy"|"standard"|"luxury"|"reference">("standard")
  const [firstRowOffsetM, setFirstRowOffsetM] = useState<number>(0)
  const [aisleConfig, setAisleConfig] = useState<"none"|"center"|"left"|"right"|"both">("none")
  const [aisleWidthM, setAisleWidthM] = useState<number>(0.6096)  // 2ft default
  const [widerBackRow, setWiderBackRow] = useState<boolean>(false)
  const [riserOverrideMm, setRiserOverrideMm] = useState<number | null>(null)
  const [seatWidthMm, setSeatWidthMm] = useState<number>(650)
  const [expandedSpeakerCategory, setExpandedSpeakerCategory] = useState<string>("Standard")

  const [aspectRatioMode, setAspectRatioMode] = useState<"16:9" | "2.35:1" | "4:3" | "custom">("16:9")
  const [customAspectWidth, setCustomAspectWidth] = useState<number>(2.0)
  const [customAspectHeight, setCustomAspectHeight] = useState<number>(1.0)
  const [screenDiagonalInches, setScreenDiagonalInches] = useState<number>(100)
  const [throwRatio, setThrowRatio] = useState<number>(1.4)
  const [screenBottomFromFloor, setScreenBottomFromFloor] = useState<number>(0.609)  // 24" — equipment rack clearance
  const [displayType, setDisplayType] = useState<"projector" | "display">("projector")
  const [screenType, setScreenType] = useState<"fixed" | "motorized" | "retractable">("fixed")
  const [wallConstruction, setWallConstruction] = useState<"drywall" | "concrete" | "timber" | "brick" | "mixed">("drywall")
  const [screenGain, setScreenGain] = useState<number>(1.0)

  const [subCount, setSubCount] = useState<number>(1)
  const [subPlacement, setSubPlacement] = useState<"frontWall" | "frontCorners" | "distributed" | "haas">("frontWall")
  const [subType, setSubType] = useState<"sealed" | "ported">("sealed")

  const [isExporting, setIsExporting] = useState(false)
  const [view3D, setView3D] = useState<boolean>(true)
  const [viewPreset, setViewPreset] = useState<{ name: string; seq: number }>({ name: '', seq: 0 })
  const goToView = (name: string) => setViewPreset(p => ({ name, seq: p.seq + 1 }))

  // ── Apply Gate ────────────────────────────────────────────────────────────
  // appliedRef holds a committed snapshot of all "heavy" inputs.
  // Heavy useMemos only recompute when commitToken increments (Apply pressed).
  // isDirty goes true whenever any input changes after the last Apply.
  type AppliedSnapshot = {
    unitSystem: "metric" | "imperial"
    metricDimensions: { width: number; height: number; length: number }
    imperialDimensions: { widthFeet: number; widthInches: number; heightFeet: number; heightInches: number; lengthFeet: number; lengthInches: number }
    treatmentLevel: TreatmentLevel; designIntent: DesignIntent
    acousticDepthMeters: { front: number; rear: number; left: number; right: number; ceiling: number }
    wallConstruction: "drywall" | "concrete" | "timber" | "brick" | "mixed"
    aspectRatioMode: "16:9" | "2.35:1" | "4:3" | "custom"; customAspectWidth: number; customAspectHeight: number
    screenDiagonalInches: number; throwRatio: number; screenBottomFromFloor: number; displayType: "projector" | "display"
    standard: ViewingStandard; lcrMode: LCRMode; surroundMode: SurroundMode; ceilingCount: CeilingCount
    mountType: "inWall" | "onWall"; screenPlacement: "behindScreen" | "besideScreen"
    rowCount: number; seatsPerRow: number; rowPitchFt: number; sightlineGrade: "economy" | "standard" | "luxury" | "reference"
    firstRowOffsetM: number; aisleConfig: "none" | "center" | "left" | "right" | "both"; aisleWidthM: number
    widerBackRow: boolean; riserOverrideMm: number | null; seatWidthMm: number
    seatType: "standard" | "luxury"; primaryRow: number
    subCount: number; subPlacement: "frontWall" | "frontCorners" | "distributed" | "haas"; subType: "sealed" | "ported"
  }

  const appliedRef = useRef<AppliedSnapshot>({
    unitSystem, metricDimensions, imperialDimensions,
    treatmentLevel, designIntent, acousticDepthMeters, wallConstruction,
    aspectRatioMode, customAspectWidth, customAspectHeight,
    screenDiagonalInches, throwRatio, screenBottomFromFloor, displayType,
    standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement,
    rowCount, seatsPerRow, rowPitchFt, sightlineGrade, firstRowOffsetM,
    aisleConfig, aisleWidthM, widerBackRow, riserOverrideMm, seatWidthMm,
    seatType, primaryRow, subCount, subPlacement, subType,
  })

  const [commitToken, setCommitToken] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const mountedForDirty = useRef(false)

  useEffect(() => {
    if (!mountedForDirty.current) { mountedForDirty.current = true; return }
    setIsDirty(true)
  }, [
    unitSystem, metricDimensions, imperialDimensions,
    treatmentLevel, designIntent, acousticDepthMeters, wallConstruction,
    aspectRatioMode, customAspectWidth, customAspectHeight,
    screenDiagonalInches, throwRatio, screenBottomFromFloor, displayType,
    standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement,
    rowCount, seatsPerRow, rowPitchFt, sightlineGrade, firstRowOffsetM,
    aisleConfig, aisleWidthM, widerBackRow, riserOverrideMm, seatWidthMm,
    seatType, primaryRow, subCount, subPlacement, subType,
  ])

  const handleApply = () => {
    appliedRef.current = {
      unitSystem, metricDimensions, imperialDimensions,
      treatmentLevel, designIntent, acousticDepthMeters, wallConstruction,
      aspectRatioMode, customAspectWidth, customAspectHeight,
      screenDiagonalInches, throwRatio, screenBottomFromFloor, displayType,
      standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement,
      rowCount, seatsPerRow, rowPitchFt, sightlineGrade, firstRowOffsetM,
      aisleConfig, aisleWidthM, widerBackRow, riserOverrideMm, seatWidthMm,
      seatType, primaryRow, subCount, subPlacement, subType,
    }
    setCommitToken(t => t + 1)
    setIsDirty(false)
  }

    const roomInMeters = useMemo(() => {
    const a = appliedRef.current
    if (a.unitSystem === "metric") return a.metricDimensions
    return {
      width:  feetInchesToMeters(a.imperialDimensions.widthFeet,  a.imperialDimensions.widthInches),
      height: feetInchesToMeters(a.imperialDimensions.heightFeet, a.imperialDimensions.heightInches),
      length: feetInchesToMeters(a.imperialDimensions.lengthFeet, a.imperialDimensions.lengthInches),
    }
  }, [commitToken])

  const clampedRoom = useMemo(() => ({
    length: clampValue(roomInMeters.length, LIMITS.length),
    width: clampValue(roomInMeters.width, LIMITS.width),
    height: clampValue(roomInMeters.height, LIMITS.height)
  }), [roomInMeters])

  const updateDepth = (
    key: "front" | "rear" | "left" | "right" | "ceiling",
    valueMeters: number
  ) => {
    const clamped = Math.max(0, valueMeters)
    setAcousticDepthMeters(prev => {
      if (sideLinked && (key === "left" || key === "right")) {
        return { ...prev, left: clamped, right: clamped }
      }
      return { ...prev, [key]: clamped }
    })
  }

  const usableRoom = useMemo(() => {
    const d = appliedRef.current.acousticDepthMeters
    return {
      length: Math.max(0, clampedRoom.length - d.front - d.rear),
      width:  Math.max(0, clampedRoom.width  - d.left  - d.right),
      height: Math.max(0, clampedRoom.height - d.ceiling),
    }
  }, [clampedRoom, commitToken])

  const geometryValid =
    usableRoom.length > 1.5 &&
    usableRoom.width > 1.5 &&
    usableRoom.height > 2

  const roomValidation = useMemo(() => {
    return validateRoomDimensions(
      { width: clampedRoom.width, length: clampedRoom.length, height: clampedRoom.height },
      unitSystem
    )
  }, [clampedRoom, unitSystem])

  const ceilingValidation = useMemo(() => {
    if (!roomValidation.valid) return []
    return evaluateCeilingSuitability(clampedRoom.height, speakerConfigurations) as unknown as CeilingValidationResult[]
  }, [clampedRoom.height, roomValidation.valid])

  const roomVolume = useMemo(() => {
    return clampedRoom.width * clampedRoom.length * clampedRoom.height
  }, [clampedRoom])
  // ── Room ratio quality — used in Room Summary badge ───────────────────────
  const roomRatio = useMemo(() => {
    if (!roomValidation.valid) return null
    const { width, length, height } = clampedRoom
    const tooSquare = Math.abs(length - width) / Math.max(length, width) < 0.05
    const ratios    = [length / height, width / height, length / width].sort((a, b) => a - b)
    const spread    = ratios[2] - ratios[0]
    const status    = tooSquare ? "caution"
      : spread < 0.5  ? "good"
      : spread < 1.2  ? "acceptable"
      : "caution"
    const color  = status === "good" ? "#60A5FA" : status === "acceptable" ? "#202b40" : "#f59e0b"
    const label  = tooSquare ? "Near-square — modal risk"
      : status === "good"       ? "Good ratio"
      : status === "acceptable" ? "Acceptable ratio"
      : "Check ratio"
    return { status, color, label }
  }, [clampedRoom, roomValidation.valid])

  // ── Auto-recommendation: pre-fills all 4 sections based on room ────────────
  const autoRecommended = useMemo((): { lcr: LCRMode; surrounds: SurroundMode; ceilingCount: CeilingCount } => {
    const vol = roomVolume
    const h   = clampedRoom.height
    let surrounds: SurroundMode  = "side"
    let ceilingCount: CeilingCount = 0
    if      (vol > 150 && h >= 4.0) { surrounds = "side_rear"; ceilingCount = 6 }
    else if (vol > 120 && h >= 3.5) { surrounds = "side_rear"; ceilingCount = 4 }
    else if (vol > 80  && h >= 2.7) { surrounds = "side_rear"; ceilingCount = 4 }
    else if (vol > 40)              { surrounds = "side_rear"; ceilingCount = 0 }
    return { lcr: "lcr", surrounds, ceilingCount }
  }, [roomVolume, clampedRoom.height])

  // Apply recommendation only on first valid room entry — not on subsequent edits
  useEffect(() => {
    if (speakerConfigEdited.current) return
    setLcrMode(autoRecommended.lcr)
    setSurroundMode(autoRecommended.surrounds)
    setCeilingCount(autoRecommended.ceilingCount)
  }, [autoRecommended]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Config notation: beds.subs.ceiling (actual speaker counts) ──────────────
  // LCR is now always fixed (standard for HT). beds = 3 LCR + surrounds + extras.
  const configNotation = useMemo(() => {
    const baseBeds  = surroundMode === "none" ? 3 : surroundMode === "side" ? 5 : 7
    const totalBeds = baseBeds + extraSidePairs * 2
    const totalCeil = ceilingCount + extraCeilingPairs * 2
    const base = totalCeil > 0 ? `${totalBeds}.${subCount}.${totalCeil}` : `${totalBeds}.${subCount}`
    const extras: string[] = []
    if (extraSidePairs > 0) extras.push(`+${extraSidePairs * 2}S`)
    if (extraCeilingPairs > 0) extras.push(`+${extraCeilingPairs * 2}OH`)
    return extras.length > 0 ? `${base} (${extras.join(" ")})` : base
  }, [surroundMode, ceilingCount, subCount, extraSidePairs, extraCeilingPairs])

  const configLabel = useMemo(() => {
    const surrPart  = surroundMode === "none" ? "LCR" : surroundMode === "side" ? "LCR + Side" : "LCR + Side & Rear"
    const extraSide = extraSidePairs > 0 ? ` + ${extraSidePairs * 2} ext.` : ""
    const ceilPart  = ceilingCount > 0 ? ` + ${ceilingCount} Overhead` : ""
    const extraCeil = extraCeilingPairs > 0 ? ` + ${extraCeilingPairs * 2} ext.` : ""
    return `${surrPart}${extraSide}${ceilPart}${extraCeil}`
  }, [surroundMode, ceilingCount, extraSidePairs, extraCeilingPairs])

  const EXTENDED_THRESHOLD_M = 7.62  // 25 ft — triggers extended coverage for genuinely long rooms

  const showExtendedSides   = clampedRoom.length > EXTENDED_THRESHOLD_M && surroundMode !== "none"
  const maxExtraSidePairs   = showExtendedSides
    ? Math.min(3, Math.max(1, Math.floor((clampedRoom.length - EXTENDED_THRESHOLD_M) / 3) + 1))
    : 0

  const showExtendedCeiling = clampedRoom.length > EXTENDED_THRESHOLD_M && clampedRoom.height >= 2.7 && ceilingCount > 0
  const maxExtraCeilingPairs = showExtendedCeiling
    ? Math.min(3, Math.max(1, Math.floor((clampedRoom.length - EXTENDED_THRESHOLD_M) / 4) + 1))
    : 0

  const roomSurfaceData = useMemo(() => {
    if (!roomValidation.valid) return null
    const { length, width, height } = clampedRoom
    const floorArea = length * width
    const ceilingArea = floorArea
    const frontWall = width * height
    const rearWall = frontWall
    const leftWall = length * height
    const rightWall = leftWall
    return {
      floorArea, ceilingArea, frontWall, rearWall, leftWall, rightWall,
      totalSurface: floorArea + ceilingArea + frontWall + rearWall + leftWall + rightWall
    }
  }, [clampedRoom, roomValidation.valid])

  const displayUnitArea = unitSystem === "metric" ? "m²" : "ft²"
  const convertArea = (areaM2: number): number =>
    unitSystem === "metric" ? areaM2 : areaM2 * 10.7639

  const screenAspectRatio = useMemo(() => {
    const a = appliedRef.current
    if (a.aspectRatioMode === "16:9")   return 16 / 9
    if (a.aspectRatioMode === "2.35:1") return 2.35
    if (a.aspectRatioMode === "4:3")    return 4 / 3
    return a.customAspectWidth / (a.customAspectHeight || 1)
  }, [commitToken])

  const diagonalToWidthMeters = (diagonalInches: number, ar: number): number => {
    const widthInches = diagonalInches * ar / Math.sqrt(ar * ar + 1)
    return widthInches * 0.0254
  }

  const screenWidthMeters = useMemo(() => {
    return diagonalToWidthMeters(appliedRef.current.screenDiagonalInches, screenAspectRatio)
  }, [screenAspectRatio, commitToken])

  // ── C-value sightline system constants ──────────────────────────────────
  // C_VALUES — module scope

  // ── Seating calculations ──
  const seatingCalcs = useMemo(() => {
    const a = appliedRef.current
    const ROW_DEPTH      = a.rowPitchFt * 0.3048
    const SIDE_CLEARANCE = 0.3
    const SEAT_WIDTH     = a.seatWidthMm / 1000
    const degreesToRadians = (deg: number) => (deg * Math.PI) / 180

    let viewingDistance = 0
    switch (a.standard) {
      case "SMPTE":    viewingDistance = screenWidthMeters / (2 * Math.tan(degreesToRadians(15))); break
      case "THX":      viewingDistance = screenWidthMeters / (2 * Math.tan(degreesToRadians(20))); break
      case "IMMERSIVE":viewingDistance = screenWidthMeters / (2 * Math.tan(degreesToRadians(25))); break
    }

    // Hard limits: 6 ft (1.8288 m) min, 15 ft (4.572 m) max
    const HARD_MIN_M = 1.8288
    const HARD_MAX_M = 4.572
    // Physics floor = just 6ft hard min — viewing distance is a guide shown in the UI, not a constraint
    const physicsMinFrontClearance = HARD_MIN_M
    const frontClearance = Math.min(
      Math.max(HARD_MIN_M, HARD_MIN_M + Math.max(0, a.firstRowOffsetM)),
      Math.min(HARD_MAX_M, usableRoom.length * 0.80)
    )
    const seatingZoneDepth = Math.max(0, usableRoom.length - frontClearance - 0.6)

    const cVal = C_VALUES[a.sightlineGrade]?.mm ?? 80
    const riserMm = riserOverrideMm !== null
      ? Math.max(127, Math.min(381, a.riserOverrideMm ?? 127))
      : Math.max(127, Math.min(381, cVal))
    const riserStepM  = riserMm / 1000
    const riserBelowGrade = a.riserOverrideMm !== null && (a.riserOverrideMm ?? 0) < cVal
    const rakeDeg    = Math.atan2(riserStepM, ROW_DEPTH) * (180 / Math.PI)

    const maxRowsByLength = Math.max(1, Math.floor(seatingZoneDepth / ROW_DEPTH))
    const maxRowsByHeight = riserStepM > 0
      ? Math.max(1, Math.floor((usableRoom.height - 1.65) / riserStepM) + 1)
      : maxRowsByLength
    const maxRows  = Math.min(maxRowsByLength, maxRowsByHeight)
    const limitingFactor: "length" | "ceiling" = maxRowsByHeight < maxRowsByLength ? "ceiling" : "length"

    const usableWidth = Math.max(0, usableRoom.width - 2 * SIDE_CLEARANCE)
    const maxSeats    = Math.max(1, Math.floor(usableWidth / SEAT_WIDTH))

    // Aisle — range 2'–3' (610–914 mm) for home HT
    // Back row (furthest from screen) never has aisle — full seat width used.
    const clampedAisleW  = Math.max(0.6096, Math.min(0.9144, a.aisleWidthM))
    const aisleCount     = a.aisleConfig === "none" ? 0 : a.aisleConfig === "both" ? 2 : 1
    const aisleSeatsLost = aisleCount * Math.max(1, Math.ceil(clampedAisleW / SEAT_WIDTH))
    const maxSeatsWithAisle = Math.max(1, maxSeats - aisleSeatsLost)
    // Back row always uses full width (no aisle)
    const maxSeatsBackRow = maxSeats
    const backRowBonus    = a.widerBackRow ? Math.min(2, maxSeats - maxSeatsWithAisle > 0 ? 2 : 0) : 0

    const clampedRowCount    = Math.min(a.rowCount, maxRows)
    const clampedSeatsPerRow = Math.min(a.seatsPerRow, maxSeatsWithAisle)
    const backRowSeats       = Math.min(a.seatsPerRow, maxSeatsBackRow)
    const totalRiseM         = (clampedRowCount - 1) * riserStepM
    const lastRowEyeHeightM  = 1.2 + totalRiseM
    const headroomM          = usableRoom.height - lastRowEyeHeightM
    const headroomStatus     = headroomM >= 0.45 ? "good" : headroomM >= 0.15 ? "tight" : "low"
    const screenTopH         = a.screenBottomFromFloor + (screenWidthMeters / (screenAspectRatio || 1.778))
    const firstRowAngle      = Math.atan2(screenTopH - 1.2, frontClearance) * (180 / Math.PI)
    const viewingComfort     = firstRowAngle >= 30 ? "good" : firstRowAngle >= 15 ? "acceptable" : "steep"
    const seatingZoneUsed    = clampedRowCount * ROW_DEPTH
    const rearClearanceM     = Math.max(0, seatingZoneDepth - seatingZoneUsed)
    const seatingWidthUsed   = clampedSeatsPerRow * SEAT_WIDTH + 2 * SIDE_CLEARANCE

    // ── Per-row analysis — Row 1 = back row (furthest from screen), counts forward ──
    const SCREEN_BOTTOM_H = a.screenBottomFromFloor
    const rowAnalysis = Array.from({ length: clampedRowCount }, (_, i) => {
      // i=0 is BACK row (highest riser), i=clampedRowCount-1 is FRONT row
      const rowNum         = i + 1                         // R1 = back, Rn = front
      const riserIndex     = clampedRowCount - 1 - i       // front row has highest riser index
      const floorRise      = riserIndex * riserStepM
      const eyeHeight      = 1.2 + floorRise
      const distFromScreen = frontClearance + riserIndex * ROW_DEPTH
      const vertAngleDeg   = Math.atan2(eyeHeight - SCREEN_BOTTOM_H, distFromScreen) * (180 / Math.PI)
      const cValueMet      = riserIndex === 0 ? true : floorRise >= (riserIndex * riserStepM)
      const sightlineStatus = vertAngleDeg >= 5 ? "clear" : vertAngleDeg >= 0 ? "marginal" : "blocked"
      return { rowNum, riserIndex, floorRise, eyeHeight, distFromScreen, vertAngleDeg, sightlineStatus, cValueMet }
    })

    const optimalRows  = Math.min(maxRows, Math.max(1, Math.floor(seatingZoneDepth / ROW_DEPTH)))
    const optimalSeats = Math.min(maxSeatsWithAisle, Math.max(1, Math.floor(usableWidth / SEAT_WIDTH) - aisleSeatsLost))

    return {
      rowDepth: ROW_DEPTH, seatWidth: SEAT_WIDTH, usableLength: usableRoom.length, usableWidth,
      maxRows, maxRowsByLength, maxRowsByHeight, limitingFactor,
      maxSeats, maxSeatsWithAisle, maxSeatsBackRow, aisleSeatsLost, backRowSeats,
      viewingDistance, physicsMinFrontClearance, frontClearance, hardMinM: HARD_MIN_M, hardMaxM: HARD_MAX_M,
      seatingZoneDepth, seatingZoneUsed, rearClearanceM, seatingWidthUsed,
      rowCount: clampedRowCount, seatsPerRow: clampedSeatsPerRow,
      riserStepM, riserMm, riserBelowGrade, cValueMm: cVal, rakeDeg,
      totalRiseM, lastRowEyeHeightM, headroomM, headroomStatus,
      rowAnalysis, optimalRows, optimalSeats, viewingComfort, firstRowAngle
    }
  }, [clampedRoom, usableRoom, screenWidthMeters, screenAspectRatio, commitToken])

  useEffect(() => {
    if (rowCount > seatingCalcs.maxRows) setRowCount(seatingCalcs.maxRows)
  }, [seatingCalcs.maxRows, rowCount])

  useEffect(() => {
    if (seatsPerRow > seatingCalcs.maxSeatsWithAisle) setSeatsPerRow(seatingCalcs.maxSeatsWithAisle)
  }, [seatingCalcs.maxSeatsWithAisle, seatsPerRow])

  // ── Auto-set depth minimums when treatment level changes ──────────────────
  // Ensures panels are always visible immediately on level selection.
  // Never reduces a depth the user has already set higher.
  const DEPTH_MINS: Record<string, { front: number; rear: number; left: number; right: number; ceiling: number }> = {
    none:     { front: 0,    rear: 0,    left: 0,    right: 0,    ceiling: 0    },
    basic:    { front: 0.10, rear: 0.08, left: 0.06, right: 0.06, ceiling: 0    }, // gypsum always shown
    standard: { front: 0.12, rear: 0.10, left: 0.08, right: 0.08, ceiling: 0.10 },
    studio:   { front: 0.15, rear: 0.12, left: 0.10, right: 0.10, ceiling: 0.20 },
  }
  useEffect(() => {
    const LEVEL_DEFAULTS: Record<string, { front: number; rear: number; left: number; right: number; ceiling: number }> = {
      none:     { front: 0,      rear: 0,      left: 0,      right: 0,      ceiling: 0      },
      basic:    { front: 0.1270, rear: 0.1016, left: 0.0762, right: 0.0762, ceiling: 0      },
      standard: { front: 0.1524, rear: 0.1270, left: 0.1016, right: 0.1016, ceiling: 0.1016 },
      studio:   { front: 0.2032, rear: 0.1524, left: 0.1270, right: 0.1270, ceiling: 0.2032 },
    }
    const d = LEVEL_DEFAULTS[treatmentLevel] ?? LEVEL_DEFAULTS.none
    setAcousticDepthMeters({ front: d.front, rear: d.rear, left: d.left, right: d.right, ceiling: d.ceiling })
  }, [treatmentLevel]) // eslint-disable-line react-hooks/exhaustive-deps


  // Extra pairs: clamp to max when room shrinks; reset to 0 when section disabled
  useEffect(() => {
    if (!showExtendedSides) setExtraSidePairs(0)
    else setExtraSidePairs(prev => Math.min(prev, maxExtraSidePairs))
  }, [showExtendedSides, maxExtraSidePairs])

  useEffect(() => {
    if (!showExtendedCeiling) setExtraCeilingPairs(0)
    else setExtraCeilingPairs(prev => Math.min(prev, maxExtraCeilingPairs))
  }, [showExtendedCeiling, maxExtraCeilingPairs])

  const screenHeight = useMemo(() => screenWidthMeters / screenAspectRatio, [screenWidthMeters, screenAspectRatio])

  const screenFitValidation = useMemo(() => {
    // Side clearance: besideScreen needs ~0.45 m each side for L/R speakers + masking border.
    // behindScreen: speakers fire through screen so only masking border (~0.15 m) needed each side.
    const SIDE_CLEARANCE   = screenPlacement === "besideScreen" ? 0.45 : 0.15
    const CEILING_CLEARANCE = 0.05   // 2" top gap only — screen bottom is user-controlled
    const maxWidth  = usableRoom.width  - (2 * SIDE_CLEARANCE)
    // Height budget: from screen bottom up to ceiling minus clearance
    const maxHeight = usableRoom.height - screenBottomFromFloor - CEILING_CLEARANCE
    return {
      fitsWidth:          screenWidthMeters <= maxWidth,
      fitsHeight:         screenHeight      <= maxHeight,
      fits:               screenWidthMeters <= maxWidth && screenHeight <= maxHeight,
      maxScreenWidth:     maxWidth,
      maxScreenHeight:    maxHeight,
      sideCleared:        SIDE_CLEARANCE,
      clampedScreenWidth: Math.min(screenWidthMeters, maxWidth)
    }
  }, [usableRoom, screenWidthMeters, screenHeight, screenPlacement, screenBottomFromFloor])

  const throwDistance = useMemo(() => screenWidthMeters * throwRatio, [screenWidthMeters, throwRatio])

  const throwValidation = useMemo(() => ({
    fits:         throwDistance <= usableRoom.length - 0.3,   // 0.3 m projector mount clearance behind throw point
    throwDistance,
    maxThrow:     usableRoom.length - 0.3
  }), [usableRoom, throwDistance])

  // Mid-frequency (500–1000 Hz) absorption coefficients per bare wall material.
  // These affect RT60 directly: concrete rooms ring longer than timber rooms.
  // Floor uses structural floor material (concrete slab vs timber subfloor).
  // WALL_MATERIAL_COEFF — module scope

  const computedAbsorption = useMemo(() => {
    const a    = appliedRef.current
    const base = TREATMENT_BASE[a.treatmentLevel] ?? TREATMENT_BASE.none
    const mc   = WALL_MATERIAL_COEFF[a.wallConstruction] ?? WALL_MATERIAL_COEFF.drywall
    const d    = a.acousticDepthMeters
    const boost = (depth: number, maxDepth: number, maxBoost: number) =>
      maxDepth > 0 ? (depth / maxDepth) * maxBoost : 0
    const clamp = (v: number) => Math.min(0.99, Math.max(0.01, v))
    const wallBase = a.treatmentLevel === 'none' ? mc.wall    : mc.wall    * 0.2 + base.surface * 0.8
    const ceilBase = a.treatmentLevel === 'none' ? mc.ceiling : mc.ceiling * 0.2 + base.surface * 0.8
    return {
      floor:     clamp(mc.floor + (base.floor - 0.02)),
      ceiling:   (a.treatmentLevel === 'none') ? mc.ceiling
        : (a.treatmentLevel === 'basic')       ? clamp(mc.ceiling + 0.03)
        : clamp(ceilBase + boost(d.ceiling, 0.4572, 0.22)),
      frontWall: clamp(wallBase + boost(d.front,   0.6096, 0.28)),
      rearWall:  clamp(wallBase + boost(d.rear,    0.3048, 0.22)),
      leftWall:  clamp(wallBase + boost(d.left,    0.2540, 0.18)),
      rightWall: clamp(wallBase + boost(d.right,   0.2540, 0.18)),
    }
  }, [commitToken])

  const acousticResult = useMemo(() => {
    if (!roomValidation.valid) return null
    const roomModel = createRoom(clampedRoom.width, clampedRoom.height, clampedRoom.length)
    return analyzeRoomAcoustics(roomModel, computedAbsorption)
  }, [clampedRoom, roomValidation.valid, computedAbsorption])

  const isRoomValid = roomValidation.valid

  // rt60Target for UI display — uses live designIntent (lightweight, no cascade)
  const rt60Target     = RT60_TARGETS[designIntent] ?? RT60_TARGETS.cinematic
  const targetRT60Min  = rt60Target.min
  const targetRT60Max  = rt60Target.max

  // committed — frozen snapshot of appliedRef, only updates on Apply press
  // All heavy memos + 3D props read from this so they stay stable until Apply
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const committed = useMemo(() => ({ ...appliedRef.current }), [commitToken])

  const panelLayout = useMemo(() => {
    const a = committed
    const rt60 = RT60_TARGETS[a.designIntent] ?? RT60_TARGETS.cinematic
    const clampedPrimaryRow = Math.max(0, Math.min(a.primaryRow, seatingCalcs.rowCount - 1))
    return computePanelLayout({
      room:            clampedRoom,
      acousticDepths:  a.acousticDepthMeters,
      treatmentLevel:  a.treatmentLevel,
      designIntent:    a.designIntent,
      computedRT60:    acousticResult?.rt60Seconds ?? null,
      targetRT60:      { min: rt60.min, max: rt60.max },
      primaryRow:      clampedPrimaryRow,
      seatingRowCount: seatingCalcs.rowCount,
      rowPitchM:       seatingCalcs.rowDepth,
      frontClearance:  seatingCalcs.frontClearance,
      usableWidth:     seatingCalcs.usableWidth,
      screenWidth:     screenWidthMeters,
      screenHeight:    screenHeight,
      screenBottomFromFloor: a.screenBottomFromFloor,
      mountType:       a.mountType,
    })
  }, [committed, clampedRoom, acousticResult, seatingCalcs, screenWidthMeters, screenHeight])

  // rt60Status reads committed designIntent's target — not live.
  // Live designIntent only controls UI labels; committed controls what was actually applied.
  const rt60Status = useMemo(() => {
    if (!acousticResult) return null
    const committedTarget = RT60_TARGETS[committed.designIntent] ?? RT60_TARGETS.cinematic
    const rt = acousticResult.rt60Seconds
    if (rt < committedTarget.min) return "overdamped"
    if (rt > committedTarget.max) return "tooLive"
    return "optimal"
  }, [acousticResult, committed])

  const worstCluster       = acousticResult?.worstCluster ?? null
  const clusterSeverityScore = worstCluster?.severityScore ?? 0
  const clusterRiskPercent   = Math.min(clusterSeverityScore, 100)

  const scene = useMemo(() => buildScene(
    appliedRef.current.standard,
    { lcr: appliedRef.current.lcrMode, surrounds: appliedRef.current.surroundMode, ceilingCount: appliedRef.current.ceilingCount },
    appliedRef.current.mountType,
    appliedRef.current.screenPlacement,
    {
      rowCount: seatingCalcs.rowCount,
      seatsPerRow: seatingCalcs.seatsPerRow,
      riserHeight: seatingCalcs.riserStepM,
      seatType: appliedRef.current.seatType,
      rowPitchM: seatingCalcs.rowDepth,
      frontClearance: seatingCalcs.frontClearance,
      primaryRow: Math.max(0, Math.min(committed.primaryRow, seatingCalcs.rowCount - 1)),
    },
    {
      screenWidthMeters: Math.min(screenWidthMeters, screenFitValidation.clampedScreenWidth),
      screenHeight,
      throwDistance,
      aspectRatioMode: (appliedRef.current.aspectRatioMode === "4:3" ? "custom" : appliedRef.current.aspectRatioMode) as "16:9" | "2.35:1" | "custom"
    },
    {
      width:  clampedRoom.width,
      length: clampedRoom.length,
      height: clampedRoom.height,
    },
    {
      count:     appliedRef.current.subCount,
      placement: appliedRef.current.subPlacement,
      enclosure: appliedRef.current.subType,
    }
  ), [seatingCalcs, screenWidthMeters, screenFitValidation.clampedScreenWidth,
      screenHeight, throwDistance, clampedRoom, commitToken])

  const BASE_SCALE = 60
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  const fitToRoom = () => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const room = scene.room
    const roomWidthPx  = room.width  * BASE_SCALE
    const roomHeightPx = room.length * BASE_SCALE
    const padding = 80
    const scaleX  = (rect.width  - padding) / roomWidthPx
    const scaleY  = (rect.height - padding) / roomHeightPx
    const newScale = Math.min(scaleX, scaleY)
    setScale(newScale)
    setOffset({
      x: rect.width  / 2 - (roomWidthPx  * newScale) / 2,
      y: rect.height / 2 - (roomHeightPx * newScale) / 2
    })
  }

  useEffect(() => {
    setTimeout(() => fitToRoom(), 50)
  }, [standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement, seatingCalcs.rowCount, seatingCalcs.seatsPerRow, clampedRoom])

  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomIntensity = 0.0015
    const delta = -e.deltaY
    const newScale = scale * (1 + delta * zoomIntensity)
    if (newScale < 0.2 || newScale > 5) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const dx = mouseX - offset.x
    const dy = mouseY - offset.y
    const scaleRatio = newScale / scale
    setScale(newScale)
    setOffset({ x: mouseX - dx * scaleRatio, y: mouseY - dy * scaleRatio })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => { isDragging.current = false }

  // scene.listeners[0] is the primary row centre seat (set by primaryRow in buildScene)
  const primarySeat = scene.listeners[0] ?? scene.objects.find(o => o.type === "seat")
  const listenerX = (primarySeat?.x ?? 0) * BASE_SCALE
  const listenerY = (primarySeat?.y ?? 0) * BASE_SCALE

  // Azimuth from primary listener to speaker.
  // SVG Y axis is inverted: screen is at top (y≈0), rear at bottom (y=roomL).
  // Forward direction = screen = negative SVG-Y relative to listener.
  // atan2(dx, -dy_svg) → 0° straight ahead, +90° right, -90° left (standard azimuth).
  function calculateAngle(speakerX: number, speakerY: number) {
    const dx  =  speakerX - listenerX          // positive = speaker is to the right
    const dy  = -(speakerY - listenerY)        // invert SVG Y so forward = positive
    return (Math.atan2(dx, dy) * (180 / Math.PI)).toFixed(1)
  }

  // ── Shared format helpers ──────────────────────────────────────────────
  const fmtM = (m: number) =>
    unitSystem === "imperial" ? `${(m * 3.28084).toFixed(1)} ft` : `${m.toFixed(2)} m`

  // Screen dimensions: always in inches (imperial) or cm (metric) — never ft/m
  const fmtScreenDim = (m: number) =>
    unitSystem === "imperial" ? `${(m * 39.3701).toFixed(1)}"` : `${(m * 100).toFixed(1)} cm`

  // ── Speaker distance helper ─────────────────────────────────────────────
  // Given two 2D positions in meters, return formatted distance string
  const spkDist = (x1: number, y1: number, x2: number, y2: number): string => {
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    return fmtM(d)
  }

  // ── hFOV / targetAngle — needed at component scope (used in Stage 4 IIFE and right panel screen tab) ──
  const hFOV = seatingCalcs.viewingDistance > 0
    ? 2 * Math.atan(screenWidthMeters / (2 * seatingCalcs.viewingDistance)) * (180 / Math.PI)
    : 0
  const targetAngle = ({ SMPTE: 30, THX: 40, IMMERSIVE: 50 } as Record<string, number>)[standard] ?? 40

  // ==============================
  // RENDER
  // ==============================

  return (
    <div className="flex flex-col h-screen text-[#202b40]" style={{ background: "#d9dadb" }}>
      {/* STICKY TOP HEADER */}
      <header className="sticky top-0 z-50 h-[60px] flex items-center justify-between px-8" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
        <h1 className="text-lg font-semibold tracking-tight">Science of Sound — Engine V2</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (!acousticResult) { alert("Please enter valid room dimensions to generate a report"); return }
              if (!clientInfo.name || clientInfo.name.trim().length === 0) { alert("Please enter your name"); return }
              if (!clientInfo.email || clientInfo.email.trim().length === 0) { alert("Please enter your email address"); return }
              setIsExporting(true)
              try {
                const payload = {
                  name: clientInfo.name.trim(), email: clientInfo.email.trim(),
                  contact: clientInfo.contact || "", company: clientInfo.company || "",
                  projectRef: clientInfo.projectRef || "", projectType: clientInfo.projectType || "Home Theater",
                  notes: clientInfo.notes || "", speakerBrand: clientInfo.speakerBrand || "",
                  preparedBy: clientInfo.preparedBy || "",
                  projectDate: clientInfo.projectDate || new Date().toISOString().slice(0, 10),
                  wallConstruction, screenGain, unitSystem, roomColorScheme,
                  roomWidth: clampedRoom.width, roomHeight: clampedRoom.height, roomLength: clampedRoom.length,
                  roomVolume: parseFloat(roomVolume.toFixed(2)), treatmentLevel, designIntent,
                  acousticDepthFront: acousticDepthMeters.front, acousticDepthRear: acousticDepthMeters.rear,
                  acousticDepthLeft: acousticDepthMeters.left, acousticDepthRight: acousticDepthMeters.right,
                  acousticDepthCeiling: acousticDepthMeters.ceiling,
                  rating: acousticResult.acousticScore, rt60Seconds: acousticResult.rt60Seconds,
                  rt60Sabine: acousticResult.rt60SabineSeconds, rt60Eyring: acousticResult.rt60EyringSeconds,
                  rt60Target: `${targetRT60Min}–${targetRT60Max} s (${rt60Target.label})`,
                  rt60Status: rt60Status ?? "unknown",
                  schroederHz: parseFloat(acousticResult.schroederFrequencyHz.toFixed(1)),
                  modalRiskLevel: acousticResult.modalRiskLevel, clusterSeverityScore,
                  panelDiagnostics: panelLayout.diagnostics,
                  speakerConfig: configNotation, speakerSystem: configNotation, lcrMode, surroundMode, ceilingCount,
                  displayType, subCount, subPlacement, subType: subType as string,
                  mountType, screenPlacement, extraSidePairs, extraCeilingPairs, viewingStandard: standard,
                  aspectRatio: aspectRatioMode, screenDiagonalInches,
                  screenWidthM: parseFloat(screenWidthMeters.toFixed(3)),
                  screenHeightM: parseFloat(screenHeight.toFixed(3)),
                  throwRatio, throwDistanceM: parseFloat(throwDistance.toFixed(3)),
                  viewingDistanceM: parseFloat(seatingCalcs.viewingDistance.toFixed(3)),
                  seatType, rowCount: seatingCalcs.rowCount, seatsPerRow: seatingCalcs.seatsPerRow,
                  totalSeats: seatingCalcs.rowCount * seatingCalcs.seatsPerRow,
                  riserStepMm: seatingCalcs.riserMm,
                  riserRakeDeg: parseFloat(seatingCalcs.rakeDeg.toFixed(2)),
                  sightlineGrade, totalRiseM: parseFloat(seatingCalcs.totalRiseM.toFixed(3)),
                  timestamp: new Date().toISOString()
                }
                const response = await fetch("/api/consultation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
                })
                if (!response.ok) { setIsExporting(false); alert("Email sending failed."); return }
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url; a.download = "Acoustic_Report.pdf"
                document.body.appendChild(a); a.click(); a.remove()
                window.URL.revokeObjectURL(url)
                setIsExporting(false)
              } catch (err) {
                console.error("Export failed:", err)
                setIsExporting(false)
                alert("An error occurred. Please try again.")
              }
            }}
            disabled={isExporting}
            className="px-4 py-2 text-sm text-[#202b40] hover:text-[#202b40] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
          <button
            className="px-4 py-2 text-sm text-[#202b40] hover:text-[#202b40] transition"
            onClick={() => {
              setUnitSystem("metric")
              setMetricDimensions({ width: 0, height: 0, length: 0 })
              setImperialDimensions({ widthFeet: 0, widthInches: 0, heightFeet: 0, heightInches: 0, lengthFeet: 0, lengthInches: 0 })
              setTreatmentLevel("none"); setDesignIntent("dialogue"); setRoomColorScheme("obsidian"); setSideLinked(true)
              setAcousticDepthMeters({ front: 0, rear: 0, left: 0, right: 0, ceiling: 0 })
              setLcrMode("lcr"); setSurroundMode("side_rear"); setCeilingCount(0); setMountType("onWall"); setScreenPlacement("behindScreen"); speakerConfigEdited.current = false
              setExtraSidePairs(0); setExtraCeilingPairs(0); setSeatType("standard")
              setRowCount(1); setSeatsPerRow(3); setSightlineGrade("standard"); setStandard("THX")
              setFirstRowOffsetM(0); setAisleConfig("none"); setAisleWidthM(0.6096); setWiderBackRow(false); setRiserOverrideMm(null); setSeatWidthMm(650)
              setAspectRatioMode("16:9"); setCustomAspectWidth(2.0); setCustomAspectHeight(1.0)
              setScreenDiagonalInches(100); setThrowRatio(1.4); setScreenBottomFromFloor(0.609)
              setDisplayType("projector"); setScreenType("fixed")
              setSubCount(1); setSubPlacement("frontWall"); setSubType("sealed")
              setClientInfo({ name: "", email: "", contact: "", company: "", projectRef: "", projectType: "Home Theater", notes: "", speakerBrand: "", preparedBy: "", projectDate: new Date().toISOString().slice(0, 10) })
              setWallConstruction("drywall"); setScreenGain(1.0)
              setScale(1); setOffset({ x: 0, y: 0 })
            }}
          >Reset</button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[320px_1fr_360px] overflow-hidden gap-0" style={{ background: "#d9dadb" }}>

        {/* LEFT SIDEBAR */}
        <div className="border-b lg:border-b-0 lg:border-r-0 p-6 overflow-y-auto order-1 lg:order-none" style={{ background: "#d9dadb", borderRight: "3px solid #8a9ab0" }}>
          <div className="flex flex-col gap-6">

            {/* ── CLIENT & PROJECT ── */}
            <div className="rounded-xl p-4" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Client & Project</label>
                <span className="text-[10px] text-[#202b40] leading-relaxed"><span className="text-amber-400">*</span> required for export</span>
              </div>
              <div className="space-y-3">

                {/* Row 1: Name + Company */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Client Name <span className="text-amber-400">*</span></label>
                    <input type="text" placeholder="e.g. Jane O'Brien" maxLength={60} value={clientInfo.name}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[<>";\/*]/g, "").slice(0, 60)
                        setClientInfo(prev => ({ ...prev, name: sanitized }))
                      }}
                      className={`w-full px-2 py-1.5 border rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:outline-none transition ${
                        clientInfo.name.trim().length === 0 ? "border-slate-300 focus:border-[#2563EB]" : "border-[#2563EB]/40 focus:border-[#2563EB]"
                      }`}
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Company</label>
                    <input type="text" placeholder="Optional" maxLength={60} value={clientInfo.company}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, company: e.target.value.replace(/[<>";\/*]/g, "").slice(0, 60) }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                </div>

                {/* Row 2: Email */}
                <div>
                  <label className="text-[10px] text-[#6b7a90] block mb-1">Email Address <span className="text-amber-400">*</span></label>
                  <input type="email" placeholder="jane@example.com" maxLength={100} value={clientInfo.email}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value.slice(0, 100) }))}
                    className={`w-full px-2 py-1.5 border rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:outline-none transition ${
                      clientInfo.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email)
                        ? "border-amber-500/60 focus:border-amber-400"
                        : clientInfo.email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email)
                        ? "border-[#2563EB]/40 focus:border-[#2563EB]"
                        : "border-slate-300 focus:border-[#2563EB]"
                    }`}
                    style={{ background: "#d9dadb" }}
                  />
                  {clientInfo.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email) && (
                    <p className="text-xs text-amber-400 mt-1">Enter a valid email address</p>
                  )}
                </div>

                {/* Divider — separates required from optional */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-px" style={{ background: "#b8bfc9" }} />
                  <span className="text-[10px] text-[#202b40] leading-relaxed uppercase tracking-wider">Optional</span>
                  <div className="flex-1 h-px" style={{ background: "#b8bfc9" }} />
                </div>

                {/* Row 3: Contact + Project Ref */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Contact Number</label>
                    <input type="tel" placeholder="+XX XXX XXX XXXX" maxLength={20} value={clientInfo.contact}
                      onChange={(e) => {
                        const numeric = e.target.value.replace(/[^0-9+\s\-()]/g, "").slice(0, 20)
                        setClientInfo(prev => ({ ...prev, contact: numeric }))
                      }}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Project Ref</label>
                    <div className="flex gap-1">
                      <input type="text" placeholder="e.g. HT-2026-01" maxLength={30} value={clientInfo.projectRef}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, projectRef: e.target.value.replace(/[<>";\/]/g, "").slice(0, 30) }))}
                        className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition"
                        style={{ background: "#d9dadb" }}
                      />
                      <button
                        title="Auto-generate reference"
                        aria-label="Auto-generate project reference"
                        onClick={() => {
                          const now = new Date()
                          const yy  = now.getFullYear()
                          const mm  = String(now.getMonth() + 1).padStart(2, "0")
                          const nn  = String(Math.floor(Math.random() * 90) + 10)
                          setClientInfo(prev => ({ ...prev, projectRef: `HT-${yy}-${mm}-${nn}` }))
                        }}
                        className="px-2 py-1.5 rounded text-xs font-medium transition shrink-0"
                        style={{ background: "#B8C4D6", color: "#202b40", border: "1px solid #8FA3BC" }}
                      >Auto</button>
                    </div>
                  </div>
                </div>

                {/* Row 4: Date + Project Type (collapsed to one row) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Project Date</label>
                    <input type="date" value={clientInfo.projectDate}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, projectDate: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Project Type</label>
                    <select value={clientInfo.projectType}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, projectType: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-[#202b40] text-sm focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    >
                      <option value="Home Theater">Home Theater</option>
                      <option value="Media Room">Media Room</option>
                      <option value="Private Cinema">Private Cinema</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>
                </div>

                {/* Row 5: Prepared By + Speaker Brand */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Prepared By</label>
                    <input type="text" placeholder="Consultant name" maxLength={60} value={clientInfo.preparedBy}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, preparedBy: e.target.value.replace(/[<>";\/*]/g, "").slice(0, 60) }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Speaker Brand</label>
                    <input type="text" placeholder="e.g. Klipsch THX" maxLength={80} value={clientInfo.speakerBrand}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, speakerBrand: e.target.value.replace(/[<>";\/]/g, "").slice(0, 80) }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                </div>

                {/* Row 6: Notes */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-[#202b40]">Notes</label>
                    <span className={`text-[10px] leading-relaxed ${500 - clientInfo.notes.length < 50 ? "text-amber-400" : "text-[#202b40]"}`}>
                      {500 - clientInfo.notes.length} remaining
                    </span>
                  </div>
                  <textarea
                    placeholder="Room access constraints, budget notes, installation preferences..."
                    maxLength={500} value={clientInfo.notes}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/[<>";\/*]/g, "").slice(0, 500)
                      setClientInfo(prev => ({ ...prev, notes: sanitized }))
                    }}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition resize-none"
                    style={{ background: "#d9dadb" }} rows={3}
                  />
                </div>

              </div>
            </div>


            {/* ── STAGE 1 — ROOM SETUP (merged card) ── */}
            <div className="rounded-xl p-4" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
              <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest block mb-4 pl-2 border-l-2 border-[#2563EB]">Room Setup</label>


              {/* ① Room Measurements */}
              <div className="mb-4">
                <div className="flex gap-2 mb-3">
                  {(["metric", "imperial"] as const).map(u => (
                    <button key={u} onClick={() => setUnitSystem(u)}
                      className="flex-1 px-2 py-1.5 text-xs rounded transition font-normal"
                      style={unitSystem === u
                        ? { background: "#2563EB", color: "#ffffff" }
                        : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                    >
                      {u === "metric" ? "Metric" : "Imperial"}
                    </button>
                  ))}
                </div>

                {unitSystem === "metric" ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#202b40]">Length (front to back)</label>
                        <span className="text-[10px] text-[#202b40] leading-relaxed">3 – 30.5 m</span>
                      </div>
                      <div className="relative">
                      <input type="number" step="0.1" min="0" placeholder="e.g. 7.5"
                        value={metricDimensions.length || ""}
                        onChange={(e) => { const r = e.target.value; if (r === "" || r === "-") return; updateMetricDimension("length", parseFloat(r)) }}
                        onBlur={(e) => { if (e.target.value === "") updateMetricDimension("length", 0) }}
                        className={`w-full pl-3 pr-8 py-2 border rounded text-[#202b40] text-sm transition focus:outline-none focus:border-[#2563EB] ${
                          metricDimensions.length > 0 && (metricDimensions.length < 3 || metricDimensions.length > 30.48) ? "border-amber-500/40"
                          : metricDimensions.length >= 3 ? "border-[#2563EB]/40" : "border-slate-300"
                        }`}
                        style={{ background: "#d9dadb" }}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">m</span>
                      </div>
                      {metricDimensions.length > 0 && metricDimensions.length < 3 && <p className="text-xs text-amber-400 mt-1">Minimum length is 3 m</p>}
                      {metricDimensions.length > 30.48 && <p className="text-xs text-amber-400 mt-1">Maximum length is 30.5 m (100 ft)</p>}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#202b40]">Width (side to side)</label>
                        <span className="text-[10px] text-[#202b40] leading-relaxed">3 – 18.3 m</span>
                      </div>
                      <div className="relative">
                      <input type="number" step="0.1" min="0" placeholder="e.g. 5.0"
                        value={metricDimensions.width || ""}
                        onChange={(e) => { const r = e.target.value; if (r === "" || r === "-") return; updateMetricDimension("width", parseFloat(r)) }}
                        onBlur={(e) => { if (e.target.value === "") updateMetricDimension("width", 0) }}
                        className={`w-full pl-3 pr-8 py-2 border rounded text-[#202b40] text-sm transition focus:outline-none focus:border-[#2563EB] ${
                          metricDimensions.width > 0 && (metricDimensions.width < 3 || metricDimensions.width > 18.29) ? "border-amber-500/40"
                          : metricDimensions.width >= 3 ? "border-[#2563EB]/40" : "border-slate-300"
                        }`}
                        style={{ background: "#d9dadb" }}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">m</span>
                      </div>
                      {metricDimensions.width > 0 && metricDimensions.width < 3 && <p className="text-xs text-amber-400 mt-1">Minimum width is 3 m</p>}
                      {metricDimensions.width > 18.29 && <p className="text-xs text-amber-400 mt-1">Maximum width is 18.3 m (60 ft)</p>}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#202b40]">Ceiling Height</label>
                        <span className="text-[10px] text-[#202b40] leading-relaxed">2.4 – 6.1 m</span>
                      </div>
                      <div className="relative">
                      <input type="number" step="0.1" min="0" placeholder="e.g. 3.0"
                        value={metricDimensions.height || ""}
                        onChange={(e) => { const r = e.target.value; if (r === "" || r === "-") return; updateMetricDimension("height", parseFloat(r)) }}
                        onBlur={(e) => { if (e.target.value === "") updateMetricDimension("height", 0) }}
                        className={`w-full pl-3 pr-8 py-2 border rounded text-[#202b40] text-sm transition focus:outline-none focus:border-[#2563EB] ${
                          metricDimensions.height > 0 && (metricDimensions.height < 2.4 || metricDimensions.height > 6.10) ? "border-amber-500/40"
                          : metricDimensions.height >= 2.4 ? "border-[#2563EB]/40" : "border-slate-300"
                        }`}
                        style={{ background: "#d9dadb" }}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">m</span>
                      </div>
                      {metricDimensions.height > 0 && metricDimensions.height < 2.4 && <p className="text-xs text-amber-400 mt-1">Minimum ceiling height is 2.4 m</p>}
                      {metricDimensions.height > 6.10 && <p className="text-xs text-amber-400 mt-1">Maximum ceiling height is 6.1 m (20 ft)</p>}
                    </div>
                    {!roomValidation.valid && metricDimensions.length > 0 && metricDimensions.width > 0 && metricDimensions.height > 0 && (
                      <div className="border border-red-500/20 rounded px-3 py-2" style={{ background: "rgba(239,68,68,0.06)" }}>
                        <p className="text-xs text-amber-400">Room too small — minimum usable space is 3 m × 3 m × 2.4 m</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Length */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#202b40]">Length (front to back)</label>
                        <span className="text-[10px] text-[#202b40] leading-relaxed">10 – 100 ft</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="1" min="0"
                            value={imperialDimensions.lengthFeet || ""}
                            onChange={(e) => { const r = e.target.value; if (r === "") return; updateImperialDimension("length", parseFloat(r) || 0, imperialDimensions.lengthInches) }}
                            onBlur={(e) => { if (e.target.value === "") updateImperialDimension("length", 0, imperialDimensions.lengthInches) }}
                            className={`w-full pl-3 pr-8 py-2 border rounded text-[#202b40] text-sm transition focus:outline-none focus:border-[#2563EB] ${(() => {
                              const totalFt = imperialDimensions.lengthFeet + imperialDimensions.lengthInches / 12
                              if (totalFt === 0) return "border-slate-300"
                              if (totalFt < 10 || totalFt > 100) return "border-amber-500/40"
                              return "border-[#2563EB]/40"
                            })()}`}
                            style={{ background: "#d9dadb" }}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">ft</span>
                        </div>
                        <div className="w-[72px] relative">
                          <input type="number" step="1" min="0" max="11"
                            value={imperialDimensions.lengthInches || ""}
                            onChange={(e) => { const r = e.target.value; if (r === "") return; updateImperialDimension("length", imperialDimensions.lengthFeet, parseFloat(r) || 0) }}
                            onBlur={(e) => { if (e.target.value === "") updateImperialDimension("length", imperialDimensions.lengthFeet, 0) }}
                            className="w-full pl-2 pr-6 py-2 border border-slate-300 rounded text-[#202b40] text-sm focus:border-[#2563EB] focus:outline-none"
                            style={{ background: "#d9dadb" }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">in</span>
                        </div>
                      </div>
                      {(() => { const t = imperialDimensions.lengthFeet + imperialDimensions.lengthInches / 12; return t > 0 && t < 10 && <p className="text-xs text-amber-400 mt-1">Minimum length is 10 ft</p> })()}
                      {(() => { const t = imperialDimensions.lengthFeet + imperialDimensions.lengthInches / 12; return t > 100 && <p className="text-xs text-amber-400 mt-1">Maximum length is 100 ft</p> })()}
                    </div>
                    {/* Width */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#202b40]">Width (side to side)</label>
                        <span className="text-[10px] text-[#202b40] leading-relaxed">10 – 60 ft</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="1" min="0"
                            value={imperialDimensions.widthFeet || ""}
                            onChange={(e) => { const r = e.target.value; if (r === "") return; updateImperialDimension("width", parseFloat(r) || 0, imperialDimensions.widthInches) }}
                            onBlur={(e) => { if (e.target.value === "") updateImperialDimension("width", 0, imperialDimensions.widthInches) }}
                            className={`w-full pl-3 pr-8 py-2 border rounded text-[#202b40] text-sm transition focus:outline-none focus:border-[#2563EB] ${(() => {
                              const totalFt = imperialDimensions.widthFeet + imperialDimensions.widthInches / 12
                              if (totalFt === 0) return "border-slate-300"
                              if (totalFt < 10 || totalFt > 60) return "border-amber-500/40"
                              return "border-[#2563EB]/40"
                            })()}`}
                            style={{ background: "#d9dadb" }}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">ft</span>
                        </div>
                        <div className="w-[72px] relative">
                          <input type="number" step="1" min="0" max="11"
                            value={imperialDimensions.widthInches || ""}
                            onChange={(e) => { const r = e.target.value; if (r === "") return; updateImperialDimension("width", imperialDimensions.widthFeet, parseFloat(r) || 0) }}
                            onBlur={(e) => { if (e.target.value === "") updateImperialDimension("width", imperialDimensions.widthFeet, 0) }}
                            className="w-full pl-2 pr-6 py-2 border border-slate-300 rounded text-[#202b40] text-sm focus:border-[#2563EB] focus:outline-none"
                            style={{ background: "#d9dadb" }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">in</span>
                        </div>
                      </div>
                      {(() => { const t = imperialDimensions.widthFeet + imperialDimensions.widthInches / 12; return t > 0 && t < 10 && <p className="text-xs text-amber-400 mt-1">Minimum width is 10 ft</p> })()}
                      {(() => { const t = imperialDimensions.widthFeet + imperialDimensions.widthInches / 12; return t > 60 && <p className="text-xs text-amber-400 mt-1">Maximum width is 60 ft</p> })()}
                    </div>
                    {/* Height */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#202b40]">Ceiling Height</label>
                        <span className="text-[10px] text-[#202b40] leading-relaxed">8 – 20 ft</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="1" min="0"
                            value={imperialDimensions.heightFeet || ""}
                            onChange={(e) => { const r = e.target.value; if (r === "") return; updateImperialDimension("height", parseFloat(r) || 0, imperialDimensions.heightInches) }}
                            onBlur={(e) => { if (e.target.value === "") updateImperialDimension("height", 0, imperialDimensions.heightInches) }}
                            className={`w-full pl-3 pr-8 py-2 border rounded text-[#202b40] text-sm transition focus:outline-none focus:border-[#2563EB] ${(() => {
                              const totalFt = imperialDimensions.heightFeet + imperialDimensions.heightInches / 12
                              if (totalFt === 0) return "border-slate-300"
                              if (totalFt < 8 || totalFt > 20) return "border-amber-500/40"
                              return "border-[#2563EB]/40"
                            })()}`}
                            style={{ background: "#d9dadb" }}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">ft</span>
                        </div>
                        <div className="w-[72px] relative">
                          <input type="number" step="1" min="0" max="11"
                            value={imperialDimensions.heightInches || ""}
                            onChange={(e) => { const r = e.target.value; if (r === "") return; updateImperialDimension("height", imperialDimensions.heightFeet, parseFloat(r) || 0) }}
                            onBlur={(e) => { if (e.target.value === "") updateImperialDimension("height", imperialDimensions.heightFeet, 0) }}
                            className="w-full pl-2 pr-6 py-2 border border-slate-300 rounded text-[#202b40] text-sm focus:border-[#2563EB] focus:outline-none"
                            style={{ background: "#d9dadb" }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#202b40] pointer-events-none">in</span>
                        </div>
                      </div>
                      {(() => { const t = imperialDimensions.heightFeet + imperialDimensions.heightInches / 12; return t > 0 && t < 8 && <p className="text-xs text-amber-400 mt-1">Minimum ceiling height is 8 ft</p> })()}
                      {(() => { const t = imperialDimensions.heightFeet + imperialDimensions.heightInches / 12; return t > 20 && <p className="text-xs text-amber-400 mt-1">Maximum ceiling height is 20 ft</p> })()}
                    </div>
                    {!roomValidation.valid && ((imperialDimensions.lengthFeet + imperialDimensions.lengthInches / 12) > 0 || (imperialDimensions.widthFeet + imperialDimensions.widthInches / 12) > 0 || (imperialDimensions.heightFeet + imperialDimensions.heightInches / 12) > 0) && (
                      <div className="border border-red-500/20 rounded px-3 py-2" style={{ background: "rgba(239,68,68,0.06)" }}>
                        <p className="text-xs text-amber-400">Room too small — minimum usable space is 10 ft × 10 ft × 8 ft</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="my-4" style={{ borderTop: "1px solid #b8bfc9" }} />

              {/* ② Wall Construction */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Wall Construction</label>
                <select value={wallConstruction} onChange={(e) => setWallConstruction(e.target.value as typeof wallConstruction)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                  style={{ background: "#d9dadb" }}
                >
                  <option value="drywall">Drywall / Plasterboard</option>
                  <option value="concrete">Poured Concrete / CMU Block</option>
                  <option value="timber">Timber Frame / Wood Stud</option>
                  <option value="brick">Brick / Masonry</option>
                  <option value="mixed">Mixed / Unknown</option>
                </select>
                <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                  {wallConstruction === "drywall"   && "Low mass — bass frequencies transmit through walls, treatment priority: low-end control"}
                  {wallConstruction === "concrete"  && "High mass — excellent isolation, treatment priority: flutter echo and early reflections"}
                  {wallConstruction === "timber"    && "Resonant structure — panels may colour bass, treatment priority: bass traps + decoupling"}
                  {wallConstruction === "brick"     && "Good mass — moderate isolation, treatment priority: mid-frequency reflections"}
                  {wallConstruction === "mixed"     && "Variable — conservative treatment recommended across all surfaces"}
                </p>
              </div>


              <div className="my-4" style={{ borderTop: "1px solid #b8bfc9" }} />


              {/* ③ Room Summary */}
              <div className="mb-0">
                {isRoomValid && roomRatio ? (
                  <div className="rounded-lg px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[#202b40] leading-relaxed">
                        {unitSystem === "imperial"
                          ? `${(clampedRoom.length * 3.28084).toFixed(1)}' L × ${(clampedRoom.width * 3.28084).toFixed(1)}' W × ${(clampedRoom.height * 3.28084).toFixed(1)}' H`
                          : `${clampedRoom.length.toFixed(1)} m L × ${clampedRoom.width.toFixed(1)} m W × ${clampedRoom.height.toFixed(1)} m H`}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: roomRatio.color }}>{roomRatio.label}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#202b40]">
                      {unitSystem === "imperial"
                        ? `${(roomVolume * 35.3147).toFixed(0)} ft³`
                        : `${roomVolume.toFixed(1)} m³`}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0", opacity: 0.4 }}>
                    <div className="text-[10px] text-[#202b40] leading-relaxed mb-0.5">Room Volume</div>
                    <div className="text-sm text-[#202b40]">— enter dimensions</div>
                  </div>
                )}
              </div>
            </div>

            {/* Stages 2+ — locked until valid room */}
              {/* ── ACOUSTIC TREATMENT ── */}
              <div className={`rounded-xl p-4 transition-opacity ${!isRoomValid ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Acoustic Treatment</label>
                  <button
                    onClick={() => {
                      const LEVEL_DEFAULTS: Record<string, { front: number; rear: number; left: number; right: number; ceiling: number }> = {
                        none:     { front: 0,      rear: 0,      left: 0,      right: 0,      ceiling: 0      },
                        basic:    { front: 0.1270, rear: 0.1016, left: 0.0762, right: 0.0762, ceiling: 0      },
                        standard: { front: 0.1524, rear: 0.1270, left: 0.1016, right: 0.1016, ceiling: 0.1016 },
                        studio:   { front: 0.2032, rear: 0.1524, left: 0.1270, right: 0.1270, ceiling: 0.2032 },
                      }
                      const d = LEVEL_DEFAULTS[treatmentLevel] ?? LEVEL_DEFAULTS.none
                      setSideLinked(true)
                      setAcousticDepthMeters({ front: d.front, rear: d.rear, left: d.left, right: d.right, ceiling: d.ceiling })
                    }}
                    className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                    style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                    title={`Reset depths to ${treatmentLevel} level defaults`}
                  >Auto</button>
                </div>

                <div className="mb-4">
                  <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Treatment Level</label>
                  <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                    {(["none","basic","standard","studio"] as const).map((id, i) => (
                      <button key={id} onClick={() => setTreatmentLevel(id)}
                        className="flex-1 py-1.5 text-xs transition-all"
                        style={{
                          background: treatmentLevel === id ? "#202b40" : "#d9dadb",
                          color:      treatmentLevel === id ? "#ffffff"  : "#202b40",
                          borderRight: i < 3 ? "1px solid #8a9ab0" : "none",
                          fontWeight:  treatmentLevel === id ? 600 : 400,
                        }}
                      >
                        {id.charAt(0).toUpperCase() + id.slice(1)}
                      </button>
                    ))}
                  </div>

                </div>

                <div className="mb-3">
                  <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Design Intent</label>
                  <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                    {([
                      { id: "dialogue",  label: "Dialogue" },
                      { id: "cinematic", label: "Cinema" },
                      { id: "hybrid",    label: "Luxury" },
                      { id: "music",     label: "Music"  },
                    ] as const).map(({ id, label }, i) => (
                      <button key={id} onClick={() => setDesignIntent(id)}
                        className="flex-1 py-1.5 text-xs transition-all"
                        style={{
                          background: designIntent === id ? "#202b40" : "#d9dadb",
                          color:      designIntent === id ? "#ffffff"  : "#202b40",
                          borderRight: i < 3 ? "1px solid #8a9ab0" : "none",
                          fontWeight:  designIntent === id ? 600 : 400,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                </div>

                {/* Depth Controls */}
                {(() => {
                  const MAX    = { front: 0.6096, rear: 0.3048, left: 0.2540, right: 0.2540, ceiling: 0.4572 }
                  const STEP   = unitSystem === "imperial" ? 0.0127 : 0.01
                  const toDisp = (m: number) => unitSystem === "imperial" ? Math.round(m * 39.3701) : Math.round(m * 100)
                  const unit   = unitSystem === "imperial" ? '"' : "cm"
                  const fromDisp = (v: number) => unitSystem === "imperial" ? v / 39.3701 : v / 100

                  const levelDefaults: Record<string, Record<string, number>> = {
                    none:     { front: 0,      rear: 0,      left: 0,      right: 0,      ceiling: 0      },
                    basic:    { front: 0.1270, rear: 0.1016, left: 0.0762, right: 0.0762, ceiling: 0      },
                    standard: { front: 0.1524, rear: 0.1270, left: 0.1016, right: 0.1016, ceiling: 0.1016 },
                    studio:   { front: 0.2032, rear: 0.1524, left: 0.1270, right: 0.1270, ceiling: 0.2032 },
                  }
                  const levelDef = levelDefaults[treatmentLevel] ?? levelDefaults.none

                  // Stepper row with fill bar + min marker
                  // ROW_LABEL_W: fixed px width so all controls align to same column regardless of label length
                  const ROW_LABEL_W = 80  // px — "Side Walls" is widest label
                  const StepperRow = ({ label, k, badge }: { label: string; k: keyof typeof MAX; badge?: React.ReactNode }) => {
                    const val      = toDisp(acousticDepthMeters[k])
                    const maxM     = MAX[k]
                    const fillPct  = Math.min(100, (acousticDepthMeters[k] / maxM) * 100)
                    const minM     = levelDef[k] ?? 0
                    const minPct   = Math.min(100, (minM / maxM) * 100)
                    const atMin    = acousticDepthMeters[k] < minM - 0.001
                    const barColor = atMin ? "#f59e0b" : acousticDepthMeters[k] === 0 ? "#8a9ab0" : "#2563EB"
                    return (
                      <div className="py-0.5">
                        <div className="flex items-center gap-1.5">
                          {/* Label — fixed width so all controls align */}
                          <div style={{ width: ROW_LABEL_W, minWidth: ROW_LABEL_W }} className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-[#202b40] truncate">{label}</span>
                            {badge && <span className="shrink-0">{badge}</span>}
                          </div>
                          {/* Controls — always at same X */}
                          <button
                            onClick={() => updateDepth(k, Math.max(0, acousticDepthMeters[k] - STEP))}
                            className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 transition"
                            style={{ background: "#B8C4D6", color: "#202b40", border: "1px solid #8FA3BC" }}
                          >−</button>
                          <div className="flex items-center gap-0.5 shrink-0" style={{ width: 64 }}>
                            <input
                              type="number" min={0} max={toDisp(maxM)} value={val}
                              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateDepth(k, Math.max(0, Math.min(fromDisp(v), maxM))) }}
                              className="flex-1 text-right text-xs font-mono rounded focus:outline-none"
                              style={{ background: "#d9dadb", border: "1px solid #8a9ab0", color: "#202b40", padding: "1px 4px", minWidth: 0 }}
                            />
                            <span className="text-[10px] text-[#202b40] shrink-0" style={{ width: 18 }}>{unit}</span>
                          </div>
                          <button
                            onClick={() => updateDepth(k, Math.min(maxM, acousticDepthMeters[k] + STEP))}
                            className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 transition"
                            style={{ background: "#2563EB", color: "#ffffff" }}
                          >+</button>
                        </div>
                        {/* Fill bar — starts flush with controls, uses same ROW_LABEL_W offset */}
                        <div className="relative h-1 rounded-full mt-1" style={{ background: "#b8bfc9", marginLeft: ROW_LABEL_W + 4 }}>
                          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{ width: `${fillPct}%`, background: barColor }} />
                          {minM > 0 && (
                            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 rounded-full -mt-px"
                              style={{ left: `${minPct}%`, background: "#60A5FA", opacity: 0.8 }} />
                          )}
                        </div>
                      </div>
                    )
                  }

                  // depth-exceeds-level feedback (correctly checks against level's own defaults)
                  const depthsExceedLevel = treatmentLevel !== "studio" && treatmentLevel !== "none" && (
                    acousticDepthMeters.front > (levelDefaults.studio?.front ?? 0.20) ||
                    acousticDepthMeters.rear   > (levelDefaults.studio?.rear  ?? 0.15) ||
                    acousticDepthMeters.left   > (levelDefaults.studio?.left  ?? 0.13)
                  )

                  // impossible room check
                  const tooDeepLength = acousticDepthMeters.front + acousticDepthMeters.rear >= clampedRoom.length - 0.5
                  const tooDeepWidth  = acousticDepthMeters.left  + acousticDepthMeters.right >= clampedRoom.width  - 0.5

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Panel Depth</label>
                          {(tooDeepLength || tooDeepWidth) && (
                            <span
                              title={tooDeepLength && tooDeepWidth ? "Front+rear AND left+right depths leave < 0.5 m live space" : tooDeepLength ? "Front + rear depth leaves < 0.5 m of usable room length" : "Left + right depth leaves < 0.5 m of usable room width"}
                              className="cursor-help text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.28)" }}
                            >⚠ Depth conflict</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSideLinked(false)
                            setAcousticDepthMeters({ front: 0.1524, rear: 0.1270, left: 0.1270, right: 0.1270, ceiling: 0.3810 })
                          }}
                          className="text-xs px-2 py-0.5 rounded transition"
                          style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                          title="Restore original preset depths"
                        >Preset</button>
                      </div>

                      {/* Front Wall */}
                      <StepperRow label="Front Wall" k="front" />


                      <StepperRow label="Rear Wall" k="rear" />

                      {/* Link sides toggle */}
                      <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                        <input
                          type="checkbox"
                          checked={sideLinked}
                          onChange={(e) => setSideLinked(e.target.checked)}
                          className="accent-[#2563EB] w-3.5 h-3.5"
                        />
                        <span className="text-xs text-[#202b40]">Link side walls</span>
                      </label>

                      <StepperRow label={sideLinked ? "Side Walls" : "Left Wall"} k="left" />
                      {!sideLinked && <StepperRow label="Right Wall" k="right" />}
                      <StepperRow label="Ceiling" k="ceiling" />



                      {/* Fix 2: depths exceed current level hint */}
                      {depthsExceedLevel && (
                        <p className="text-[10px] text-[#60A5FA] leading-relaxed pt-0.5">
                          Depths exceed {treatmentLevel} defaults — hit Preset to restore
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* ── SPEAKER LAYOUT ── */}
              <div className={`rounded-xl p-4 transition-opacity ${!isRoomValid ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Speaker Layout</label>
                  <button
                    onClick={() => { setLcrMode("lcr"); setSurroundMode(autoRecommended.surrounds); setCeilingCount(autoRecommended.ceilingCount); speakerConfigEdited.current = false }}
                    className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                    style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                    title={`Auto: LCR + ${autoRecommended.surrounds === "side_rear" ? "Side & Rear" : autoRecommended.surrounds === "side" ? "Side" : "None"} + ${autoRecommended.ceilingCount} OH`}
                  >Auto</button>
                </div>

                {/* ── Surrounds ── */}
                <div className="border-t pt-3 mt-3" style={{ borderColor: "#b8bfc9" }}>
                  <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Surrounds</label>
                  <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                    {([
                      { id: "none",     label: "None"       },
                      { id: "side",     label: "Side"       },
                      { id: "side_rear",label: "Side + Rear"},
                    ] as const).map(({ id, label }, i) => (
                      <button key={id} onClick={() => { speakerConfigEdited.current = true; setSurroundMode(id) }}
                        className="flex-1 py-1.5 text-xs transition-all"
                        style={{
                          background: surroundMode === id ? "#202b40" : "#d9dadb",
                          color:      surroundMode === id ? "#ffffff"  : "#202b40",
                          borderRight: i < 2 ? "1px solid #8a9ab0" : "none",
                          fontWeight:  surroundMode === id ? 600 : 400,
                        }}
                      >{label}</button>
                    ))}
                  </div>

                  {showExtendedSides && (
                    <div className="mt-2 rounded px-2.5 py-2" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-semibold text-[#6b7a90] flex-1">Extended Coverage <span className="font-normal opacity-70">(ITU-R BS.2051)</span></span>
                        <span className="text-[10px] text-[#60A5FA]">max {maxExtraSidePairs}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#202b40] flex-1">Extra side pairs</span>
                        <button onClick={() => setExtraSidePairs(Math.max(0, extraSidePairs - 1))}
                          className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
                          style={{ background: "#B8C4D6", color: "#202b40", border: "1px solid #8FA3BC" }}>−</button>
                        <span className="w-5 text-center text-xs font-mono text-[#202b40]">{extraSidePairs}</span>
                        <button onClick={() => setExtraSidePairs(Math.min(maxExtraSidePairs, extraSidePairs + 1))}
                          className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
                          style={{ background: "#2563EB", color: "#ffffff" }}>+</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── In-Ceiling ── */}
                <div className="border-t pt-3 mt-3" style={{ borderColor: "#b8bfc9" }}>
                  <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">In-Ceiling</label>
                  <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                    {([
                      { id: 0, label: "None" },
                      { id: 2, label: "2 OH" },
                      { id: 4, label: "4 OH" },
                    ] as const).map(({ id, label }, i) => (
                      <button key={id} onClick={() => { speakerConfigEdited.current = true; setCeilingCount(id as CeilingCount) }}
                        className="flex-1 py-1.5 text-xs transition-all"
                        style={{
                          background: ceilingCount === id ? "#202b40" : "#d9dadb",
                          color:      ceilingCount === id ? "#ffffff"  : "#202b40",
                          borderRight: i < 2 ? "1px solid #8a9ab0" : "none",
                          fontWeight:  ceilingCount === id ? 600 : 400,
                        }}
                      >{label}</button>
                    ))}
                  </div>
                  {/* Height warnings — unit-aware, no double-fire */}

                  {showExtendedCeiling && (
                    <div className="mt-2 rounded px-2.5 py-2" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-semibold text-[#6b7a90] flex-1">Extended Atmos Coverage <span className="font-normal opacity-70">(Dolby spec)</span></span>
                        <span className="text-[10px] text-[#60A5FA]">max {maxExtraCeilingPairs}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#202b40] flex-1">Extra ceiling pairs</span>
                        <button onClick={() => setExtraCeilingPairs(Math.max(0, extraCeilingPairs - 1))}
                          className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
                          style={{ background: "#B8C4D6", color: "#202b40", border: "1px solid #8FA3BC" }}>−</button>
                        <span className="w-5 text-center text-xs font-mono text-[#202b40]">{extraCeilingPairs}</span>
                        <button onClick={() => setExtraCeilingPairs(Math.min(maxExtraCeilingPairs, extraCeilingPairs + 1))}
                          className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
                          style={{ background: "#2563EB", color: "#ffffff" }}>+</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Mount & Placement ── */}
                <div className="border-t pt-3 mt-3" style={{ borderColor: "#b8bfc9" }}>
                  <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Mount & Placement</label>
                  <div className="rounded px-2.5 py-2.5 space-y-2.5" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
                    {/* Mount Type */}
                    <div>
                      <span className="text-[10px] text-[#6b7a90] block mb-1.5">Mount Type</span>
                      <div className="flex gap-1.5">
                        {(["onWall", "inWall"] as const).map(m => (
                          <button key={m} onClick={() => setMountType(m)}
                            className="flex-1 py-1.5 text-xs rounded transition"
                            style={mountType === m
                              ? { background: "#202b40", color: "#ffffff", border: "1px solid #202b40" }
                              : { background: "#b8bfc9", border: "1px solid #8a9ab0", color: "#202b40" }}
                          >{m === "onWall" ? "On Wall" : "In Wall"}</button>
                        ))}
                      </div>
                      {mountType === "inWall" && acousticDepthMeters.left < 0.125 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span title={`Side depth < ${unitSystem === "imperial" ? '5"' : "12.5 cm"} — increase for in-wall driver cavity`} className="cursor-help text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>⚠ Side depth</span>
                        </div>
                      )}
                    </div>
                    {/* Front Stage Placement */}
                    <div>
                      <span className="text-[10px] text-[#6b7a90] block mb-1.5">Front Stage</span>
                      <div className="flex gap-1.5">
                        {(["behindScreen", "besideScreen"] as const).map(p => (
                          <button key={p} onClick={() => setScreenPlacement(p)}
                            className="flex-1 py-1.5 text-xs rounded transition"
                            style={screenPlacement === p
                              ? { background: "#202b40", color: "#ffffff", border: "1px solid #202b40" }
                              : { background: "#b8bfc9", border: "1px solid #8a9ab0", color: "#202b40" }}
                          >{p === "behindScreen" ? "Behind Screen" : "Beside Screen"}</button>
                        ))}
                      </div>
                      {screenPlacement === "besideScreen" && usableRoom.width < 4.5 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span title={`Room too narrow for beside-screen — needs ${unitSystem === "imperial" ? "14.8 ft+" : "4.5 m+"}`} className="cursor-help text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>⚠ Room width</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Config Summary bar ── */}
                <div className="mt-3 flex items-center justify-center rounded px-2.5 py-2" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
                  <span className="text-sm font-mono font-semibold" style={{ color: "#60A5FA" }}>{configNotation}</span>
                </div>
              </div>

              {/* ── SUBWOOFER ── */}
              <div className={`rounded-xl p-4 transition-opacity ${!isRoomValid ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Subwoofer</label>
                  <button
                    onClick={() => {
                      const areaM2 = clampedRoom.length * clampedRoom.width
                      let n = 1, placement: typeof subPlacement = "frontWall", enclosure: typeof subType = "sealed"
                      if (areaM2 >= 45) { n = 4; placement = "distributed"; enclosure = "ported" }
                      else if (areaM2 >= 30) { n = 3; placement = "haas"; enclosure = "ported" }
                      else if (areaM2 >= 18) { n = 2; placement = "frontCorners"; enclosure = "sealed" }
                      else { n = 1; placement = "frontWall"; enclosure = "sealed" }
                      setSubCount(n); setSubPlacement(placement); setSubType(enclosure)
                    }}
                    className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                    style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                    title="Auto-set count, placement and enclosure based on room size"
                  >Auto</button>
                </div>
                <div className="space-y-3">

                  {/* Count slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-[#202b40]">Count</label>
                      <span className="text-xs text-[#60A5FA] font-semibold">{subCount}</span>
                    </div>
                    <input type="range" min="1" max="4" step="1" value={subCount}
                      onChange={(e) => {
                        const n = parseInt(e.target.value)
                        setSubCount(n)
                        if (n === 1) setSubPlacement("frontWall")
                        else if (n === 2) setSubPlacement("frontCorners")
                        else if (n === 3) setSubPlacement("haas")
                        else setSubPlacement("distributed")
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                      style={{ background: "#8FA3BC" }}
                    />
                    <div className="flex justify-between text-xs text-[#202b40] mt-0.5">
                      {["1","2","3","4"].map(n => <span key={n}>{n}</span>)}
                    </div>
                    {(() => {
                      const areaM2 = clampedRoom.length * clampedRoom.width
                      if (subCount >= 3 && areaM2 < 30) return (
                        <div className="flex items-center gap-1.5 mt-1"><span title={`${subCount} subs may worsen modal distribution in a ${unitSystem === "imperial" ? `${(areaM2 * 10.7639).toFixed(0)} ft²` : `${areaM2.toFixed(0)} m²`} room`} className="cursor-help text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>⚠ Room too small for {subCount} subs</span></div>
                      )
                      if (subCount === 4 && areaM2 < 45) return (
                        <div className="flex items-center gap-1.5 mt-1"><span title="4 subs recommended for rooms 45 m²+ — consider 2 for this space" className="cursor-help text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>⚠ 4 subs suit larger rooms</span></div>
                      )
                      return null
                    })()}
                  </div>

                  {/* Enclosure */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Enclosure</label>
                    <div className="flex gap-2">
                      {(["sealed","ported"] as const).map(t => (
                        <button key={t} onClick={() => setSubType(t)}
                          className="flex-1 px-3 py-2 text-xs rounded transition"
                          style={subType === t
                            ? { background: "#2563EB", color: "#fff", border: "1px solid #2563EB" }
                            : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                        >{t === "sealed" ? "Sealed" : "Ported"}</button>
                      ))}
                    </div>
                    {/* Fix 4: enclosure description */}
                    <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                      {subType === "sealed" && "Tight, accurate bass — better for small rooms and critical listening"}
                      {subType === "ported" && "Extended low end, higher output — suited to larger rooms with space from boundaries"}
                    </p>
                  </div>

                  {/* Placement */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Placement</label>
                    <div className="space-y-1">
                      {subCount === 1 && (
                        <button onClick={() => setSubPlacement("frontWall")}
                          className="w-full text-left px-2 py-1.5 text-xs rounded"
                          style={{ background: "#2563EB", color: "#fff", border: "1px solid #2563EB" }}>
                          Front Wall — behind screen
                        </button>
                      )}
                      {subCount === 2 && (["frontWall","frontCorners"] as const).map(k => (
                        <button key={k} onClick={() => setSubPlacement(k)}
                          className="w-full text-left px-2 py-1.5 text-xs rounded transition"
                          style={subPlacement === k
                            ? { background: "#2563EB", color: "#fff", border: "1px solid #2563EB" }
                            : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}>
                          {k === "frontWall" ? "Front Wall pair" : "Front Corners"}
                        </button>
                      ))}
                      {/* Fix 2: count=3 and count=4 as static info pills, not fake interactive buttons */}
                      {subCount === 3 && (
                        <div className="w-full text-left px-2 py-1.5 text-xs rounded"
                          style={{ background: "#d9dadb", color: "#202b40", border: "1px solid #8a9ab0" }}>
                          Haas Array — front L/R + rear centre
                        </div>
                      )}
                      {subCount === 4 && (
                        <div className="w-full text-left px-2 py-1.5 text-xs rounded"
                          style={{ background: "#d9dadb", color: "#202b40", border: "1px solid #8a9ab0" }}>
                          Distributed — front L/R + rear L/R
                        </div>
                      )}
                    </div>
                    {/* Fix 3: placement description copy */}
                    <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                      {subPlacement === "frontWall"    && subCount === 1 && "Single sub centred — simplest setup, benefits from SBIR mitigation via front panel depth"}
                      {subPlacement === "frontWall"    && subCount === 2 && "Pair at front wall — symmetrical loading, reduces comb filtering vs single"}
                      {subPlacement === "frontCorners" && "Corner placement maximises output but strongly excites room modes — sealed recommended"}
                      {subPlacement === "haas"         && "Front L/R + rear centre — cancels room length modes, improves seat-to-seat consistency"}
                      {subPlacement === "distributed"  && "Four-corner distributed array — best mode cancellation, highest seat uniformity"}
                    </p>
                    {(subPlacement === "frontCorners" || subPlacement === "haas") && subType === "ported" && (
                      <div className="flex items-center gap-1.5 mt-1"><span title="Boundary placement + ported enclosure excites room modes — switch to sealed" className="cursor-help text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>⚠ Ported + boundary</span></div>
                    )}
                  </div>

                </div>
              </div>

              {/* ── SCREEN PREFERENCES ── */}
              <div className={`rounded-xl p-4 transition-opacity ${(!isRoomValid || !geometryValid) ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Screen Preferences</label>
                    <button
                      onClick={() => {
                        // Optimal diagonal: ~40° hFOV at primary row distance (SMPTE standard)
                        const viewDist = seatingCalcs.viewingDistance > 0 ? seatingCalcs.viewingDistance : 3.0
                        const optWidthM = 2 * viewDist * Math.tan((40 * Math.PI / 180) / 2)
                        const maxW = screenFitValidation.maxScreenWidth
                        const targetW = Math.min(optWidthM, maxW)
                        // Convert to diagonal (16:9)
                        const diagM = targetW / (16 / Math.sqrt(16*16 + 9*9))
                        const diagIn = Math.round(diagM * 39.3701 / 10) * 10
                        // Throw ratio: standard 1.4 for projector
                        const autoThrow = displayType === "projector" ? 1.4 : 1.4
                        // Screen bottom: 24" from floor or riser height
                        const autoBottom = 0.609
                        setScreenDiagonalInches(Math.max(72, Math.min(200, diagIn)))
                        setThrowRatio(autoThrow)
                        setScreenBottomFromFloor(autoBottom)
                        setAspectRatioMode("16:9")
                      }}
                      className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                      style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                      title="Auto-set screen size based on 40° SMPTE viewing angle at primary row"
                    >Auto</button>
                  </div>

                  {(() => {
                    const DIAGONAL_SIZES = [72, 92, 100, 110, 120, 135, 150, 165, 180, 200]
                    const diagWidthM = (d: number) => diagonalToWidthMeters(d, screenAspectRatio)
                    const diagFits   = (d: number) => diagWidthM(d) <= screenFitValidation.maxScreenWidth
                    const autoRecDiag = DIAGONAL_SIZES.filter(d => diagFits(d)).slice(-1)[0] ?? DIAGONAL_SIZES[0]

                    const lensType = (() => {
                      if (throwRatio < 0.8)  return { label: "Ultra Short Throw (UST)", color: "text-purple-400" }
                      if (throwRatio < 1.3)  return { label: "Short Throw",             color: "text-blue-400"   }
                      if (throwRatio < 2.0)  return { label: "Standard Throw",          color: "text-[#60A5FA]"  }
                      return                        { label: "Long Throw",               color: "text-amber-400"  }
                    })()

                    // screenTypeNote for description line (Fix 2+3)
                    const screenTypeNote: Record<string, string> = {
                      fixed:       "Fixed frame — zero back-wall clearance needed, no mechanism",
                      motorized:   "Motorized — leave 0.1–0.15 m behind screen for roll tube and housing",
                      retractable: "Retractable — ceiling recess or pelmet box required, ~0.2 m depth above screen",
                    }

                    return (
                      <div className="space-y-4">

                        {/* Display Type — projector vs flat panel */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Display Type</label>
                          <div className="flex gap-2">
                            {(["projector", "display"] as const).map(d => (
                              <button key={d} onClick={() => setDisplayType(d)}
                                className="flex-1 px-3 py-2 text-xs rounded transition font-normal"
                                style={displayType === d
                                  ? { background: "#2563EB", color: "#ffffff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                {d === "projector" ? "Projector" : "Flat Panel Display"}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] leading-relaxed mt-1.5">
                            {displayType === "projector"
                              ? "Throw distance and lens placement apply — projector positioned at rear of seating zone"
                              : "Zero throw — display mounts flush to front wall, no projection clearance needed"}
                          </p>
                        </div>

                        {/* Screen Type — projector only */}
                        {displayType === "projector" && (
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Screen Type</label>
                          <div className="flex gap-2">
                            {(["fixed", "motorized", "retractable"] as const).map(t => (
                              <button key={t} onClick={() => setScreenType(t)}
                                className="flex-1 px-2 py-2 text-xs rounded transition font-normal capitalize"
                                style={screenType === t
                                  ? { background: "#2563EB", color: "#ffffff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                {t === "fixed" ? "Fixed Frame" : t === "motorized" ? "Motorized" : "Retractable"}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                            {screenTypeNote[screenType]}
                          </p>
                        </div>
                        )}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Viewing Standard</label>
                          <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                            {([
                              { id: "SMPTE",    label: "SMPTE 30°"  },
                              { id: "THX",      label: "THX 40°"    },
                              { id: "IMMERSIVE",label: "Max 50°+"   },
                            ] as const).map(({ id, label }, i) => (
                              <button key={id} onClick={() => setStandard(id as ViewingStandard)}
                                className="flex-1 py-1.5 text-xs transition-all"
                                style={{
                                  background:  standard === id ? "#202b40" : "#d9dadb",
                                  color:       standard === id ? "#ffffff"  : "#202b40",
                                  borderRight: i < 2 ? "1px solid #8a9ab0" : "none",
                                  fontWeight:  standard === id ? 600 : 400,
                                }}
                              >{label}</button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                            {standard === "SMPTE"     && "30° horizontal FOV — conservative, comfortable for long sessions"}
                            {standard === "THX"       && "40° horizontal FOV — reference standard for dedicated home theatres"}
                            {standard === "IMMERSIVE" && "50°+ horizontal FOV — maximum immersion, front-row cinema feel"}
                          </p>
                        </div>

                        {/* Aspect Ratio */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Aspect Ratio</label>
                          <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                            {([
                              { id: "16:9",   label: "16:9"    },
                              { id: "2.35:1", label: "2.35:1"  },
                              { id: "4:3",    label: "4:3"     },
                              { id: "custom", label: "Custom"  },
                            ] as const).map(({ id, label }, i) => (
                              <button key={id} onClick={() => setAspectRatioMode(id as "16:9" | "2.35:1" | "4:3" | "custom")}
                                className="flex-1 py-1.5 text-xs transition-all"
                                style={{
                                  background:  aspectRatioMode === id ? "#202b40" : "#d9dadb",
                                  color:       aspectRatioMode === id ? "#ffffff"  : "#202b40",
                                  borderRight: i < 3 ? "1px solid #8a9ab0" : "none",
                                  fontWeight:  aspectRatioMode === id ? 600 : 400,
                                }}
                              >{label}</button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                            {aspectRatioMode === "16:9"   && "Standard widescreen — streaming, UHD Blu-ray"}
                            {aspectRatioMode === "2.35:1" && "CinemaScope anamorphic — cinematic film format"}
                            {aspectRatioMode === "4:3"    && "Classic / legacy — older content and presentations"}
                            {aspectRatioMode === "custom" && "Enter width and height ratio values below"}
                          </p>
                        </div>

                        {aspectRatioMode === "custom" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#6b7a90] block mb-1">Width ratio</label>
                              <input type="number" step="0.1" min="1" value={customAspectWidth}
                                onChange={(e) => setCustomAspectWidth(parseFloat(e.target.value) || 1)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none"
                                style={{ background: "#d9dadb" }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b7a90] block mb-1">Height ratio</label>
                              <input type="number" step="0.1" min="1" value={customAspectHeight}
                                onChange={(e) => setCustomAspectHeight(parseFloat(e.target.value) || 1)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none"
                                style={{ background: "#d9dadb" }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Screen Bottom Height */}
                        {(() => {
                          const CENTER_CH_CLEARANCE = 0.35
                          const needsCenterSpace = screenPlacement === "besideScreen" || mountType === "onWall"
                          const centerFits = !needsCenterSpace || screenBottomFromFloor >= CENTER_CH_CLEARANCE
                          // Range: 24"–60" (0.6096–1.524 m)
                          const recMinM = needsCenterSpace ? Math.max(0.6096, CENTER_CH_CLEARANCE + 0.05) : 0.6096
                          const recMaxM = 1.016  // 40" standard rec max
                          const hardMinM = 0.6096  // 24"
                          const hardMaxM = 1.524   // 60"
                          const inRange = screenBottomFromFloor >= recMinM && screenBottomFromFloor <= recMaxM

                          // Format always in inches or cm — never feet or metres
                          const fmtFloor = (m: number) =>
                            unitSystem === "imperial"
                              ? `${Math.round(m * 39.3701)}"`
                              : `${Math.round(m * 100)} cm`

                          const stepM    = unitSystem === "imperial" ? 0.0254 : 0.05
                          const dispVal  = unitSystem === "imperial"
                            ? Math.round(screenBottomFromFloor * 39.3701)
                            : Math.round(screenBottomFromFloor * 100)
                          const dispMin  = unitSystem === "imperial" ? 24 : 60
                          const dispMax  = unitSystem === "imperial" ? 60 : 152
                          const dispUnit = unitSystem === "imperial" ? "″" : "cm"
                          const recMinDisp = unitSystem === "imperial" ? Math.round(recMinM * 39.3701) : Math.round(recMinM * 100)
                          const recMaxDisp = unitSystem === "imperial" ? Math.round(recMaxM * 39.3701) : Math.round(recMaxM * 100)

                          return (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs text-[#202b40]">Screen Bottom from Floor</label>
                                <span className={`text-xs ${inRange ? "text-[#60A5FA]" : "text-amber-400"}`}>
                                  rec {recMinDisp}–{recMaxDisp}{dispUnit}
                                </span>
                              </div>
                              {/* Range slider */}
                              <input type="range"
                                min={hardMinM} max={hardMaxM} step={stepM}
                                value={screenBottomFromFloor}
                                onChange={(e) => setScreenBottomFromFloor(parseFloat(e.target.value))}
                                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB] mb-2"
                                style={{ background: "#8FA3BC" }}
                              />
                              {/* Number input fine-tune */}
                              <div className="flex items-center gap-2">
                                <input type="number"
                                  step={unitSystem === "imperial" ? 1 : 1}
                                  min={dispMin} max={dispMax}
                                  value={dispVal}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value)
                                    if (isNaN(v)) return
                                    const m = unitSystem === "imperial" ? v / 39.3701 : v / 100
                                    setScreenBottomFromFloor(Math.max(hardMinM, Math.min(hardMaxM, m)))
                                  }}
                                  className={`flex-1 px-2 py-1.5 border rounded text-sm text-[#202b40] transition focus:outline-none focus:border-[#2563EB] ${
                                    !inRange ? "border-amber-500/40" : "border-[#2563EB]/40"
                                  }`}
                                  style={{ background: "#d9dadb" }}
                                />
                                <span className="text-xs text-[#202b40] w-8">{dispUnit}</span>
                              </div>
                              <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                                Bottom {fmtFloor(screenBottomFromFloor)} — top of screen at {fmtFloor(screenBottomFromFloor + screenHeight)}
                                {unitSystem === "imperial"
                                  ? ` (ceiling: ${Math.round(usableRoom.height * 39.3701)}")`
                                  : ` (ceiling: ${Math.round(usableRoom.height * 100)} cm)`}
                              </p>
                              {!centerFits && (
                                <p className="text-xs text-amber-400 mt-1">
                                  ⚠ Center channel needs {fmtFloor(CENTER_CH_CLEARANCE)}+ below screen — raise screen bottom or switch to Behind Screen placement
                                </p>
                              )}
                              {inRange && needsCenterSpace && centerFits && (
                                <p className="text-xs text-[#60A5FA]/70 mt-1">
                                  Center channel clearance ✓ ({fmtFloor(screenBottomFromFloor)} available)
                                </p>
                              )}
                            </div>
                          )
                        })()}

                        {/* Screen Size — Diagonal Selector */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">Screen Size (Diagonal)</label>
                            <span className="text-[10px] text-[#202b40] leading-relaxed">Auto rec: {autoRecDiag}″</span>
                          </div>
                          <select value={screenDiagonalInches}
                            onChange={(e) => setScreenDiagonalInches(parseInt(e.target.value) || 100)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                            style={{ background: "#d9dadb" }}
                          >
                            {DIAGONAL_SIZES.map(d => {
                              const fits  = diagFits(d)
                              const isRec = d === autoRecDiag
                              const note  = !fits  ? "Not suitable for room"
                                : isRec             ? "Auto Recommended"
                                : d <= 85           ? "Compact — close seating"
                                : d <= 110          ? "Standard home theater"
                                : d <= 135          ? "Large format — immersive"
                                : d <= 165          ? "Cinema-scale — THX+ recommended"
                                :                     "Mega screen — reference room only"
                              return (
                                <option key={d} value={d}>
                                  {d}″ — {note}
                                </option>
                              )
                            })}
                          </select>

                          {/* Selected size detail in inches/cm only */}
                          <div className="flex items-center justify-between mt-1.5 text-xs">
                            <span className="text-[#202b40]">
                              {unitSystem === "imperial"
                                ? `${(screenWidthMeters * 39.3701).toFixed(1)}″ W × ${(screenHeight * 39.3701).toFixed(1)}″ H (${aspectRatioMode})`
                                : `${(screenWidthMeters * 100).toFixed(0)} cm W × ${(screenHeight * 100).toFixed(0)} cm H (${aspectRatioMode})`}
                            </span>
                            {!screenFitValidation.fits
                              ? <span className="text-amber-400">exceeds room</span>
                              : <span className="text-[#60A5FA]">fits room</span>}
                          </div>
                        </div>

                        {/* Throw Ratio — projector only */}
                        {displayType === "projector" ? (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs text-[#202b40]">Throw Ratio</label>
                              <span className={`text-xs font-medium ${lensType.color}`}>{lensType.label}</span>
                            </div>
                            {/* Range slider for exploration */}
                            <input type="range" min="0.4" max="3.0" step="0.05" value={throwRatio}
                              onChange={(e) => setThrowRatio(parseFloat(e.target.value))}
                              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB] mb-2"
                              style={{ background: "#8FA3BC" }}
                            />
                            <div className="flex justify-between text-[10px] text-[#202b40] mb-2 -mt-1">
                              <span>0.4 UST</span><span>1.4 Std</span><span>3.0 Long</span>
                            </div>
                            <input type="number" step="0.05" min="0.4" max="3.0" value={throwRatio}
                              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setThrowRatio(v) }}
                              onBlur={(e) => { const v = parseFloat(e.target.value); setThrowRatio(isNaN(v) ? 1.4 : Math.max(0.4, Math.min(3.0, v))) }}
                              className={`w-full px-2 py-1.5 border rounded text-sm text-[#202b40] transition focus:outline-none focus:border-[#2563EB] ${
                                !throwValidation.fits || throwRatio < 0.4 || throwRatio > 3.0 ? "border-amber-500/40" : "border-slate-300"
                              }`}
                              style={{ background: "#d9dadb" }}
                            />
                            <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                              {throwRatio < 0.4 || throwRatio > 3.0
                                ? "Out of range — valid range is 0.4 – 3.0"
                                : `Projector must be ${fmtM(throwDistance)} from screen — plus 0.3 m mount clearance behind`}
                            </p>
                            <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                              Lens shift assumed zero — if your projector has vertical lens shift, mounting height may vary.
                            </p>
                            {/* UST + non-fixed screen warning */}
                            {throwRatio < 0.8 && screenType !== "fixed" && (
                              <p className="text-xs text-amber-400 mt-1">
                                ⚠ Ultra Short Throw projectors require a fixed-frame screen — motorized / retractable screens are incompatible with UST optics
                              </p>
                            )}
                            {/* Throw point inside seating zone */}
                            {throwValidation.fits && throwDistance < seatingCalcs.frontClearance + seatingCalcs.seatingZoneUsed && throwDistance > seatingCalcs.frontClearance && (
                              <p className="text-xs text-amber-400 mt-1">
                                ⚠ Projector position ({fmtM(throwDistance)} from screen) falls inside the seating zone — use a ceiling mount above the seating area or choose a shorter throw ratio
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                            <p className="text-xs text-[#202b40] font-semibold mb-1">Flat Panel — No Throw</p>
                            <p className="text-[10px] text-[#202b40] leading-relaxed">
                              Display mounts flush to front wall. No projector clearance needed — seating distance is set by viewing angle standard only.
                            </p>
                          </div>
                        )}

                        {/* Screen Gain */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Screen Gain</label>
                          <div className="flex gap-2">
                            {([
                              { val: 1.0, label: "1.0 Matte", note: "Widest viewing angle" },
                              { val: 1.3, label: "1.3 Grey", note: "Ambient light rejection" },
                              { val: 0.8, label: "0.8 AT", note: "Acoustically transparent" },
                            ]).map(g => (
                              <button key={g.val} onClick={() => setScreenGain(g.val)}
                                className="flex-1 py-2 text-xs rounded transition text-center"
                                style={screenGain === g.val
                                  ? { background: "#2563EB", color: "#fff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                <div className="font-semibold">{g.label}</div>
                                <div className="opacity-70 text-[10px] mt-0.5">{g.note}</div>
                              </button>
                            ))}
                          </div>
                          {screenGain === 0.8 && screenPlacement !== "besideScreen" && (
                            <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">AT screens require speakers positioned directly behind the screen surface</p>
                          )}
                          {screenGain === 0.8 && screenPlacement === "besideScreen" && (
                            <p className="text-[10px] text-amber-400 leading-relaxed mt-1">⚠ AT screen requires speakers behind the screen — incompatible with Beside Screen placement</p>
                          )}
                        </div>

                        {!screenFitValidation.fits && (
                          <p className="text-xs text-amber-400 mt-2">Screen size exceeds available wall space — choose a smaller size</p>
                        )}
                        {!throwValidation.fits && displayType === "projector" && (
                          <p className="text-xs text-amber-400 mt-1">Projector needs {fmtM(throwDistance)} — only {fmtM(throwValidation.maxThrow)} available</p>
                        )}
                      </div>
                    )
                  })()}
              </div>

              {/* ── SEATING ── */}
              <div className={`rounded-xl p-4 transition-opacity ${(!isRoomValid || !geometryValid) ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Seating</label>
                    <button
                      onClick={() => {
                        setRowCount(seatingCalcs.optimalRows)
                        setSeatsPerRow(seatingCalcs.optimalSeats)
                        setSightlineGrade("standard")
                        setPrimaryRow(0)
                        setAisleConfig("none")
                        setWiderBackRow(false)
                        setRiserOverrideMm(null)
                        setFirstRowOffsetM(0)
                      }}
                      className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                      style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                      title={`Auto: ${seatingCalcs.optimalRows} rows × ${seatingCalcs.optimalSeats} seats`}
                    >Auto</button>
                  </div>

                  {(() => {
                    const fmtD = (m: number) => unitSystem === "imperial"
                      ? `${Math.floor(m * 3.28084)}'${Math.round((m * 3.28084 % 1) * 12)}"`
                      : `${m.toFixed(2)} m`
                    const fmtW = (m: number) => unitSystem === "imperial" ? `${(m * 3.28084).toFixed(1)} ft` : `${m.toFixed(2)} m`

                    return (
                      <div className="space-y-3">

                        {/* Row Spacing — fine slider 48"–96" in 2" steps */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">Row Spacing</label>
                            <span className="text-xs text-[#60A5FA] font-semibold">
                              {unitSystem === "imperial"
                                ? `${Math.round(rowPitchFt * 12)}"`
                                : `${(rowPitchFt * 0.3048).toFixed(2)} m`}
                              {rowPitchFt < 5 ? " — Compact" : rowPitchFt < 6 ? " — Standard" : rowPitchFt < 7 ? " — Generous" : " — Premium"}
                            </span>
                          </div>
                          <input type="range"
                            min={48} max={96} step={2}
                            value={Math.round(rowPitchFt * 12)}
                            onChange={(e) => setRowPitchFt(parseInt(e.target.value) / 12)}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                            style={{ background: "#8FA3BC" }}
                          />
                          <div className="flex justify-between text-[10px] text-[#202b40] mt-1">
                            {unitSystem === "imperial"
                              ? (<><span>48"</span><span>60"</span><span>72"</span><span>84"</span><span>96"</span></>)
                              : (<><span>1.22 m</span><span>1.52 m</span><span>1.83 m</span><span>2.13 m</span><span>2.44 m</span></>)}
                          </div>
                        </div>

                        {/* Seat Type */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Seat Type</label>
                          <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                            {(["standard", "luxury"] as const).map((t, i) => (
                              <button key={t} onClick={() => setSeatType(t)}
                                className="flex-1 py-1.5 text-xs transition-all"
                                style={{
                                  background: seatType === t ? "#202b40" : "#d9dadb",
                                  color:      seatType === t ? "#ffffff"  : "#202b40",
                                  borderRight: i === 0 ? "1px solid #8a9ab0" : "none",
                                  fontWeight:  seatType === t ? 600 : 400,
                                }}
                              >{t === "standard" ? "Standard" : "Luxury"}</button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                            {seatType === "standard" && "Upholstered fixed seating — typical home cinema chair"}
                            {seatType === "luxury"   && "Recliner with wider arms — reduces seats per row, increases room feel"}
                          </p>
                        </div>

                        {/* Seat Width */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">Seat Width</label>
                            <span className="text-xs text-[#60A5FA] font-semibold">
                              {unitSystem === "imperial" ? `${Math.round(seatWidthMm / 25.4)}"` : `${seatWidthMm} mm`}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {([550, 650, 750] as const).map(w => (
                              <button key={w} onClick={() => setSeatWidthMm(w)}
                                className="flex-1 py-2 text-xs rounded transition"
                                style={seatWidthMm === w
                                  ? { background: "#2563EB", color: "#ffffff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                <div className="font-semibold">{unitSystem === "imperial" ? `${Math.round(w / 25.4)}"` : `${w}`}</div>
                                <div className="opacity-70 text-xs mt-0.5">{w === 550 ? "Compact" : w === 650 ? "Standard" : "Luxury"}</div>
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                            Up to {seatingCalcs.maxSeatsWithAisle} seat{seatingCalcs.maxSeatsWithAisle !== 1 ? "s" : ""} across {fmtW(seatingCalcs.usableWidth)}
                          </p>
                        </div>

                        {/* First Row from Screen */}
                        {(() => {
                          const current   = seatingCalcs.frontClearance
                          const physMin   = seatingCalcs.physicsMinFrontClearance
                          const maxOffset = Math.max(0, seatingCalcs.hardMaxM - physMin)
                          const fmtFirst  = (m: number) => unitSystem === "imperial"
                            ? `${Math.floor(m * 3.28084)}'${Math.round((m * 3.28084 % 1) * 12)}"`
                            : `${Math.round(m * 100)} cm`
                          return (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs text-[#202b40]">First Row from Screen</label>
                                <span className="text-xs text-[#60A5FA] font-semibold">{fmtFirst(current)}</span>
                              </div>
                              <input type="range" min="0" max={maxOffset} step="0.05" value={firstRowOffsetM}
                                onChange={(e) => setFirstRowOffsetM(parseFloat(e.target.value))}
                                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                                style={{ background: "#8FA3BC" }}
                              />
                              <div className="flex justify-between text-xs text-[#202b40] mt-1">
                                <span>{fmtFirst(seatingCalcs.hardMinM)} min</span>
                                <span>{fmtFirst(seatingCalcs.hardMaxM)} max</span>
                              </div>
                              {current < seatingCalcs.viewingDistance * 0.9 && (
                                <p className="text-xs text-amber-400 mt-1">Too close — move rows back for better viewing</p>
                              )}
                            </div>
                          )
                        })()}

                        {/* Rows slider */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">Rows</label>
                            <span className="text-xs text-[#60A5FA] font-semibold">
                              {seatingCalcs.rowCount} of {seatingCalcs.maxRows} max
                            </span>
                          </div>
                          <input type="range" min="1" max={seatingCalcs.maxRows} value={rowCount}
                            onChange={(e) => {
                              const n = parseInt(e.target.value)
                              setRowCount(n)
                              if (primaryRow >= n) setPrimaryRow(n - 1)
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                            style={{ background: "#8FA3BC" }}
                          />
                          <div className="flex justify-between text-xs text-[#202b40] mt-1">
                            <span>1</span>
                            <span>{seatingCalcs.maxRows}</span>
                          </div>
                          {seatingCalcs.limitingFactor === "ceiling" && (
                            <p className="text-xs text-amber-400 mt-1">Ceiling height limits rows — lower riser height to fit more</p>
                          )}
                        </div>

                        {/* Primary listening row — always visible */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">Primary Listening Row</label>
                            <span className="text-xs text-[#60A5FA] font-semibold">Row {primaryRow + 1}</span>
                          </div>
                          {seatingCalcs.rowCount > 1 ? (
                            <div className="flex gap-1.5 flex-wrap">
                              {Array.from({ length: seatingCalcs.rowCount }, (_, i) => (
                                <button key={i} onClick={() => setPrimaryRow(i)}
                                  className="px-3 py-1.5 text-xs rounded transition"
                                  style={primaryRow === i
                                    ? { background: "#2563EB", color: "#fff", border: "1px solid #2563EB" }
                                    : { background: "#d9dadb", border: "1px solid #8FA3BC", color: "#202b40" }}
                                >
                                  {i + 1}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#2563EB]/30" style={{ background: "#d9dadb" }}>
                              <span className="text-xs font-semibold text-[#2563EB]">Row 1</span>
                              <span className="text-[10px] text-[#202b40]">— single row, locked</span>
                            </div>
                          )}
                          <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                            Sets first-reflection geometry for acoustic panel placement
                          </p>
                        </div>

                        {/* Seats per row */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">Seats per Row</label>
                            <span className="text-xs text-[#60A5FA] font-semibold">{seatingCalcs.seatsPerRow} of {seatingCalcs.maxSeatsWithAisle} max</span>
                          </div>
                          <input type="range" min="1" max={seatingCalcs.maxSeatsWithAisle} value={seatsPerRow}
                            onChange={(e) => setSeatsPerRow(parseInt(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                            style={{ background: "#8FA3BC" }}
                          />
                        </div>

                        {/* Aisle — None / Left / Center / Right / Both Sides */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Aisle</label>
                          <p className="text-[10px] text-[#6b7a90] mb-1.5">Back row always full-width — no aisle</p>
                          <div className="grid grid-cols-5 gap-1">
                            {(["none","left","center","right","both"] as const).map(a => (
                              <button key={a} onClick={() => setAisleConfig(a)}
                                className="py-1.5 text-[10px] rounded transition"
                                style={aisleConfig === a
                                  ? { background: "#2563EB", color: "#ffffff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                {a === "none" ? "None" : a === "left" ? "Left" : a === "center" ? "Centre" : a === "right" ? "Right" : "Both"}
                              </button>
                            ))}
                          </div>
                          {aisleConfig !== "none" && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-[#6b7a90]">Width</span>
                                <span className="text-xs font-semibold text-[#60A5FA]">
                                  {unitSystem === "imperial"
                                    ? `${Math.floor(aisleWidthM * 3.28084)}'${Math.round((aisleWidthM * 3.28084 % 1) * 12)}"` 
                                    : `${Math.round(aisleWidthM * 100)} cm`}
                                </span>
                              </div>
                              <input type="range" min={0.6096} max={0.9144} step={0.0508}
                                value={Math.max(0.6096, Math.min(0.9144, aisleWidthM))}
                                onChange={(e) => setAisleWidthM(parseFloat(e.target.value))}
                                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                                style={{ background: "#8FA3BC" }}
                              />
                              <div className="flex justify-between text-[10px] text-[#202b40] mt-1">
                                <span>2'</span><span>2'6"</span><span>3'</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Riser Height — 5" to 15" whole inches, unit-aware, reset-to-auto */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">
                              Riser Height
                              {riserOverrideMm !== null && (
                                <button
                                  onClick={() => setRiserOverrideMm(null)}
                                  className="ml-2 text-[10px] underline"
                                  style={{ color: "#60A5FA" }}
                                >Auto</button>
                              )}
                            </label>
                            <span className="text-xs text-[#60A5FA] font-semibold">
                              {unitSystem === "imperial"
                                ? `${Math.round(seatingCalcs.riserMm / 25.4)}"`
                                : `${Math.round(seatingCalcs.riserMm)} mm`}
                              {riserOverrideMm === null && <span className="text-[10px] opacity-60 ml-1">(auto)</span>}
                            </span>
                          </div>
                          <input type="range" min="5" max="15" step="1"
                            value={Math.round((riserOverrideMm ?? seatingCalcs.riserMm) / 25.4)}
                            onChange={(e) => setRiserOverrideMm(parseInt(e.target.value) * 25.4)}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                            style={{ background: "#8FA3BC" }}
                          />
                          <div className="flex justify-between text-[10px] text-[#202b40] mt-1">
                            {unitSystem === "imperial"
                              ? (<><span>5"</span><span>8"</span><span>10"</span><span>12"</span><span>15"</span></>)
                              : (<><span>127</span><span>203</span><span>254</span><span>305</span><span>381 mm</span></>)}
                          </div>
                          {seatingCalcs.riserBelowGrade && (
                            <p className="text-xs text-amber-400 mt-1">Low riser — sightlines for back rows may be tight</p>
                          )}
                        </div>

                        {/* Sightline Grade */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">View Quality</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(["economy", "standard", "luxury", "reference"] as const).map(g => {
                              const info = C_VALUES[g]
                              return (
                                <button key={g} onClick={() => setSightlineGrade(g)}
                                  className="px-2 py-2 text-xs rounded transition text-left"
                                  style={sightlineGrade === g
                                    ? { background: "#2563EB", color: "#ffffff", border: "1px solid #2563EB" }
                                    : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                                >
                                  <div className="font-semibold">{info.label}</div>
                                  <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{info.desc}</div>
                                </button>
                              )
                            })}
                          </div>
                        </div>



                      </div>
                    )
                  })()}
          </div>
        </div>
        </div>

        {/* CENTER WORKSPACE */}
        <div className="flex flex-col overflow-hidden order-2 lg:order-none" style={{ background: "#d9dadb" }}>

          <div className="sticky top-[60px] z-40 px-6 py-3 flex items-center gap-4" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
            <div className="flex items-center gap-2 w-32 shrink-0">
              {!view3D ? (
                <>
                  <span className="text-xs text-[#202b40]">Zoom:</span>
                  <span className="text-sm font-mono text-[#202b40]">{(scale * 100).toFixed(0)}%</span>
                </>
              ) : (
                <span className="text-xs text-[#202b40] select-none">Drag · Scroll · 360°</span>
              )}
            </div>
            <div className="flex-1" />
            {!view3D && (
              <>
                <button onClick={resetView} className="px-3 py-1 text-xs text-[#202b40] hover:text-[#202b40] transition">Reset</button>
                <button onClick={fitToRoom}  className="px-3 py-1 text-xs text-[#202b40] hover:text-[#202b40] transition">Fit</button>
              </>
            )}
            {view3D && (
              <div className="flex items-center gap-1 flex-wrap">
{(['Screen','Left','Right','Back','Ceiling','Floor'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => goToView(v.toLowerCase())}
                    className="px-2 py-0.5 text-xs rounded border border-slate-300 text-[#202b40] hover:text-[#202b40] hover:bg-white/[0.04] hover:border-slate-300 transition"
                  >{v}</button>
                ))}
              </div>
            )}
            {view3D && (
              <div className="flex items-center gap-1.5" title="3D room colour">
                {([
                  { id: "obsidian", bg: "#111418" },
                  { id: "navy",     bg: "#0c1a35" },
                  { id: "slate",    bg: "#2c3640" },
                  { id: "charcoal", bg: "#252525" },
                ] as const).map(({ id, bg }) => (
                  <button
                    key={id}
                    title={{ obsidian: "Acoustic Black", navy: "Midnight Velvet", slate: "Slate Stone", charcoal: "Carbon Felt" }[id]}
                    onClick={() => setRoomColorScheme(id)}
                    className="w-5 h-5 rounded-sm transition"
                    style={{
                      background: bg,
                      border: roomColorScheme === id ? "2px solid #2563EB" : "2px solid transparent",
                      outline: roomColorScheme === id ? "1px solid #60A5FA" : "none",
                      outlineOffset: "1px",
                    }}
                  />
                ))}
              </div>
            )}
            {/* Apply button */}
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all"
              style={{
                background:   isDirty ? "#2563EB" : "#dfe1e3",
                color:        isDirty ? "#ffffff"  : "#8a9ab0",
                border:       isDirty ? "1.5px solid #2563EB" : "1.5px solid #8a9ab0",
                boxShadow:    isDirty ? "0 0 0 2px rgba(37,99,235,0.18)" : "none",
                cursor:       isDirty ? "pointer" : "default",
              }}
            >
              {isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-90 shrink-0" />
              )}
              Apply
            </button>
            <div className="flex rounded overflow-hidden" style={{ border: "1.5px solid #8a9ab0" }}>
              {(["2D", "3D"] as const).map(v => (
                <button key={v} onClick={() => setView3D(v === "3D")}
                  className="px-3 py-1 text-xs transition font-medium"
                  style={view3D === (v === "3D")
                    ? { background: "#2563EB", color: "#fff" }
                    : { background: "#d9dadb", color: "#202b40" }}
                >{v}</button>
              ))}
            </div>
          </div>

          {scene.phaseAlignments.length > 0 && (
            <div className="px-6 py-2 text-xs" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
              <span className="text-[#202b40] font-semibold block mb-1">Sub phase alignment</span>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {scene.phaseAlignments.map(p => (
                  <span key={p.subId} className="font-mono text-[#60A5FA]">
                    {p.subId}: {p.phaseDifference.toFixed(1)}° — {p.delaySuggestion.toFixed(1)} ms
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden rounded-none" style={{ background: "#d9dadb" }}>
            {!isRoomValid && (
              <div className="flex flex-col items-center justify-center h-full gap-3 select-none" style={{ minHeight: 320 }}>
                <div className="text-4xl opacity-30">📐</div>
                <p className="text-sm text-[#202b40] font-medium">Enter room dimensions to preview</p>
                <p className="text-[11px] text-[#202b40]">Width · Length · Ceiling Height</p>
              </div>
            )}
            {isRoomValid && view3D && (
              <TheatreView3D
                room={clampedRoom}
                acousticDepths={committed.acousticDepthMeters}
                panelLayout={panelLayout}
                screenWidth={Math.min(screenWidthMeters, screenFitValidation.clampedScreenWidth)}
                screenHeight={screenHeight}
                screenBottomFromFloor={committed.screenBottomFromFloor}
                displayType={committed.displayType}
                throwDistance={throwDistance}
                mountType={committed.mountType}
                screenPlacement={committed.screenPlacement}
                speakers={scene.speakers}
                viewPreset={viewPreset}
                extraSidePairs={extraSidePairs}
                extraCeilingPairs={extraCeilingPairs}
                subCount={committed.subCount}
                subPlacement={committed.subPlacement}
                subEnclosure={committed.subType}
                seatingRowCount={seatingCalcs.rowCount}
                seatsPerRow={seatingCalcs.seatsPerRow}
                riserStepM={seatingCalcs.riserStepM}
                frontClearance={seatingCalcs.frontClearance}
                rowPitchM={seatingCalcs.rowDepth}
                primaryRow={Math.max(0, Math.min(committed.primaryRow, seatingCalcs.rowCount - 1))}
                usableWidth={seatingCalcs.usableWidth}
                designIntent={committed.designIntent}
                treatmentLevel={committed.treatmentLevel}
                roomColorScheme={roomColorScheme}
                wallConstruction={committed.wallConstruction}
                aisleConfig={committed.aisleConfig}
                aisleWidthM={committed.aisleWidthM}
              />
            )}
            {isRoomValid && !view3D && (
            <svg
              ref={svgRef}
              width="100%" height="100%"
              style={{ background: "#d9dadb", cursor: isDragging.current ? "grabbing" : "grab" }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
                <rect x={0} y={0}
                  width={scene.room.width * BASE_SCALE}
                  height={scene.room.length * BASE_SCALE}
                  fill="#E2E8F0" stroke="#2A3A52" strokeWidth={2}
                />

                {scene.objects.map((obj: any, idx: number) => {
                  const x = obj.x * BASE_SCALE
                  const y = obj.y * BASE_SCALE

                  if (obj.type === "seat") {
                    return <circle key={idx} cx={x} cy={y} r={8} fill="#202b40" opacity={0.8} />
                  }

                  if (obj.type === "speaker") {
                    const ch = (obj.channel || "").toUpperCase()
                    const speakerColor = (() => {
                      if (["FL","FR","C","L","R"].includes(ch))                                    return "#00D9FF"
                      if (["SL","SR","RL","RR","BL","BR","SBL","SBR"].includes(ch))               return "#60A5FA"
                      if (/^T(FL|FR|ML|MR|RL|RR)$/.test(ch))                                      return "#34D399"
                      return "#202b40"
                    })()
                    return (
                      <g key={idx}>
                        <rect x={x - 6} y={y - 6} width={12} height={12} fill={speakerColor} opacity={0.9} />
                        <text x={x} y={y + 20} textAnchor="middle" fontSize={10} fill={speakerColor} pointerEvents="none">
                          {ch}
                        </text>
                      </g>
                    )
                  }

                  if (obj.type === "subwoofer") {
                    return (
                      <g key={idx}>
                        <rect x={x - 8} y={y - 8} width={16} height={16} fill="#FBBF24" opacity={0.9} rx={2} />
                        <text x={x} y={y + 22} textAnchor="middle" fontSize={10} fill="#FBBF24" pointerEvents="none">SUB</text>
                      </g>
                    )
                  }

                  if (obj.type === "screen") {
                    const w = (obj.width ?? 3) * BASE_SCALE
                    const h = (obj.height ?? 1.5) * BASE_SCALE
                    return (
                      <rect key={idx}
                        x={x - w / 2} y={y} width={w} height={h}
                        fill="none" stroke="#4a7f7e" strokeWidth={3} opacity={0.7}
                      />
                    )
                  }
                  return null
                })}

                {/* Extended side surrounds — auto-calculated (maxExtraSidePairs) */}
                {extraSidePairs > 0 && (() => {
                  const roomW  = scene.room.width  * BASE_SCALE
                  const roomL  = scene.room.length * BASE_SCALE
                  const pZ     = (scene.listeners[0]?.y ?? scene.room.length * 0.45) * BASE_SCALE  // primary listener Y in SVG
                  const rearY  = (scene.room.length - (committed.acousticDepthMeters.rear)) * BASE_SCALE
                  const slX    = (committed.acousticDepthMeters.left  + 0.19) * BASE_SCALE
                  const srX    = roomW - (committed.acousticDepthMeters.right + 0.19) * BASE_SCALE
                  const nodes: React.ReactNode[] = []
                  for (let i = 0; i < extraSidePairs; i++) {
                    const frac = extraSidePairs === 1 ? 0.65 : 0.45 + (i / (extraSidePairs - 1)) * 0.45
                    const yPos = pZ + frac * (rearY - pZ)
                    nodes.push(
                      <g key={`xsl-${i}`}>
                        <rect x={slX - 6} y={yPos - 5} width={10} height={10} fill="#818CF8" opacity={0.85} />
                        <text x={slX - 10} y={yPos + 4} textAnchor="end" fontSize={8} fill="#818CF8" pointerEvents="none">SL{i+2}</text>
                      </g>,
                      <g key={`xsr-${i}`}>
                        <rect x={srX - 4} y={yPos - 5} width={10} height={10} fill="#818CF8" opacity={0.85} />
                        <text x={srX + 10} y={yPos + 4} textAnchor="start" fontSize={8} fill="#818CF8" pointerEvents="none">SR{i+2}</text>
                      </g>
                    )
                  }
                  return nodes
                })()}

                {/* Extended ceiling / Atmos — auto-calculated (maxExtraCeilingPairs) */}
                {extraCeilingPairs > 0 && (() => {
                  const roomW   = scene.room.width  * BASE_SCALE
                  const roomL   = scene.room.length * BASE_SCALE
                  const uzStart = committed.acousticDepthMeters.front * BASE_SCALE + 3
                  const uzEnd   = (scene.room.length - committed.acousticDepthMeters.rear) * BASE_SCALE - 3
                  const nodes: React.ReactNode[] = []
                  for (let i = 0; i < extraCeilingPairs; i++) {
                    const frac  = extraCeilingPairs === 1 ? 0.50 : 0.20 + (i / (extraCeilingPairs - 1)) * 0.60
                    const yPos  = uzStart + frac * (uzEnd - uzStart)
                    const xFrac = 0.22 + (i / Math.max(1, extraCeilingPairs - 1)) * 0.06
                    const xL    = roomW * xFrac
                    const xR    = roomW * (1 - xFrac)
                    nodes.push(
                      <g key={`xatl-${i}`}>
                        <circle cx={xL} cy={yPos} r={6} fill="none" stroke="#34D399" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.8} />
                        <text x={xL} y={yPos + 14} textAnchor="middle" fontSize={8} fill="#34D399" pointerEvents="none">ATL{i+1}</text>
                      </g>,
                      <g key={`xatr-${i}`}>
                        <circle cx={xR} cy={yPos} r={6} fill="none" stroke="#34D399" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.8} />
                        <text x={xR} y={yPos + 14} textAnchor="middle" fontSize={8} fill="#34D399" pointerEvents="none">ATR{i+1}</text>
                      </g>
                    )
                  }
                  return nodes
                })()}

                {/* ── 2D Treatment Overlays (from panelLayout) ── */}
                {isRoomValid && (() => {
                  const BS = BASE_SCALE
                  const RW = scene.room.width  * BS
                  const RL = scene.room.length * BS
                  const traps  = panelLayout.traps
                  const panels = panelLayout.panels
                  const leg = traps[0]?.leg ?? 0
                  const nodes: React.ReactNode[] = []

                  // Bass trap triangles — 4 corners
                  if (leg > 0.01) {
                    const L2 = leg * BS
                    nodes.push(
                      <polygon key="trap-FL" points={`0,0 ${L2},0 0,${L2}`}
                        fill="#3B4A6B" opacity={0.55} />,
                      <polygon key="trap-FR" points={`${RW},0 ${RW-L2},0 ${RW},${L2}`}
                        fill="#3B4A6B" opacity={0.55} />,
                      <polygon key="trap-RL" points={`0,${RL} ${L2},${RL} 0,${RL-L2}`}
                        fill="#3B4A6B" opacity={0.55} />,
                      <polygon key="trap-RR" points={`${RW},${RL} ${RW-L2},${RL} ${RW},${RL-L2}`}
                        fill="#3B4A6B" opacity={0.55} />
                    )
                  }

                  // Panel zones
                  for (const panel of panels) {
                    const { surface, type, zone } = panel
                    const isDiffuser = type !== 'absorber'
                    const fillColor  = isDiffuser ? '#34D399' : '#60A5FA'
                    const fillOp     = isDiffuser ? 0.45 : 0.38
                    const minDepthPx = Math.max(4, zone.depth * BS)

                    if (surface === 'front') {
                      // Thin band at top (y=0), width spans zone.u → zone.u+zone.uw
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={zone.u * BS} y={0}
                          width={zone.uw * BS} height={minDepthPx}
                          fill={fillColor} opacity={fillOp} />
                      )
                    }
                    else if (surface === 'rear') {
                      const isDiff = isDiffuser
                      const fillR = isDiff ? '#34D399' : '#60A5FA'
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={zone.u * BS} y={RL - minDepthPx}
                          width={zone.uw * BS} height={minDepthPx}
                          fill={fillR} opacity={isDiff ? 0.55 : 0.38}
                        />,
                        // Diffuser hatch lines
                        ...(isDiff ? Array.from({ length: Math.ceil(zone.uw * BS / 6) }, (_, i) => (
                          <line key={`ph-${panel.id}-${i}`}
                            x1={zone.u * BS + i * 6} y1={RL - minDepthPx}
                            x2={zone.u * BS + i * 6} y2={RL}
                            stroke="#34D399" strokeWidth={1} opacity={0.6} />
                        )) : [])
                      )
                    }
                    else if (surface === 'left') {
                      // zone.u = world Z start, zone.uw = length along Z, thin left strip
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={0} y={zone.u * BS}
                          width={minDepthPx} height={zone.uw * BS}
                          fill={fillColor} opacity={fillOp} />
                      )
                    }
                    else if (surface === 'right') {
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={RW - minDepthPx} y={zone.u * BS}
                          width={minDepthPx} height={zone.uw * BS}
                          fill={fillColor} opacity={fillOp} />
                      )
                    }
                    else if (surface === 'ceiling') {
                      // Top-down ceiling cloud — dashed rect
                      // zone.u = worldX, zone.v = worldZ, zone.uw = W, zone.vh = L
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={zone.u * BS} y={zone.v * BS}
                          width={zone.uw * BS} height={zone.vh * BS}
                          fill="none" stroke="#818CF8" strokeWidth={1.5}
                          strokeDasharray="5,3" opacity={0.65} />,
                        <text key={`pl-${panel.id}`}
                          x={zone.u * BS + zone.uw * BS / 2}
                          y={zone.v * BS + zone.vh * BS / 2}
                          textAnchor="middle" fontSize={8} fill="#818CF8" opacity={0.8}
                          pointerEvents="none">cloud</text>
                      )
                    }
                  }

                  return <>{nodes}</>
                })()}

                {/* Speaker lines from primary seat */}
                {primarySeat &&
                  scene.objects
                    .filter(o => o.type === "speaker" && !/^T(FL|FR|ML|MR|RL|RR)$/i.test(o.channel ?? ""))
                    .map((speaker, idx) => {
                      const sx = speaker.x * BASE_SCALE
                      const sy = speaker.y * BASE_SCALE
                      const alpha = calculateAngle(sx, sy)
                      return (
                        <g key={idx}>
                          <line x1={listenerX} y1={listenerY} x2={sx} y2={sy}
                            stroke="#2A3A52" strokeWidth={0.5} opacity={0.6} strokeDasharray="2,2"
                          />
                          <text x={(listenerX + sx) / 2} y={(listenerY + sy) / 2 - 5}
                            fontSize={9} fill="#202b40" pointerEvents="none">
                            {alpha}°
                          </text>
                        </g>
                      )
                    })}
              </g>

              {/* ── 2D Legend (fixed position, outside transform) ── */}
              <g transform="translate(12, 12)">
                {[
                  { color: "#00D9FF", shape: "rect", label: "LCR"         },
                  { color: "#60A5FA", shape: "rect", label: "Surrounds"   },
                  { color: "#34D399", shape: "circle", label: "Overhead"  },
                  { color: "#FBBF24", shape: "rect", label: "Sub (SUB)"  },
                  { color: "#818CF8", shape: "rect", label: "Extra Surr." },
                  { color: "#60A5FA", shape: "panel", label: "Treatment"  },
                  { color: "#3B4A6B", shape: "panel", label: "Bass Traps" },
                ].map(({ color, shape, label }, i) => (
                  <g key={label} transform={`translate(0, ${i * 16})`}>
                    {shape === "circle"
                      ? <circle cx={5} cy={5} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3,2" />
                      : shape === "panel"
                      ? <rect x={1} y={1} width={8} height={8} fill={color} opacity={0.45} />
                      : <rect x={1} y={1} width={8} height={8} fill={color} opacity={0.85} />
                    }
                    <text x={14} y={9} fontSize={9} fill={color} opacity={0.9}>{label}</text>
                  </g>
                ))}
              </g>

              {/* ── Room dimension labels (fixed bottom-left, outside transform) ── */}
              {isRoomValid && (() => {
                const W = scene.room.width
                const L = scene.room.length
                const labelW = unitSystem === "imperial"
                  ? `${(W * 3.28084).toFixed(1)} ft`
                  : `${W.toFixed(2)} m`
                const labelL = unitSystem === "imperial"
                  ? `${(L * 3.28084).toFixed(1)} ft`
                  : `${L.toFixed(2)} m`
                return (
                  <g>
                    <text x="50%" y="98%" textAnchor="middle" fontSize={10} fill="#202b40" opacity={0.6} pointerEvents="none">
                      W {labelW} × L {labelL}
                    </text>
                  </g>
                )
              })()}

            </svg>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="border-b lg:border-b-0 lg:border-l-0 overflow-y-auto order-3 lg:order-none max-h-[70vh] lg:max-h-full" style={{ background: "#d9dadb", borderLeft: "3px solid #8a9ab0" }}>

          {/* Tab bar */}
          <div className="sticky top-0 z-10 flex" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
            {(["suggestions","acoustics","screen","seating","engineering"] as const).map(tab => (
              <button key={tab} onClick={() => setRightPanelTab(tab)}
                className="flex-1 py-2.5 text-xs font-semibold capitalize transition"
                style={rightPanelTab === tab
                  ? { color: "#60A5FA", borderBottom: "2px solid #2563EB" }
                  : { color: "#202b40", borderBottom: "2px solid transparent" }}
              >
                {tab === "suggestions" ? "Advice" : tab === "acoustics" ? "Acoustics" : tab === "screen" ? "Screen" : tab === "seating" ? "Seating" : "Room"}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">

            {/* ── ACOUSTICS TAB ── */}
            {rightPanelTab === "acoustics" && (!acousticResult ? (
              <div className="text-xs text-[#202b40] text-center py-12">Enter room dimensions to see analysis</div>
            ) : (
              <>
                {/* RT60 Status */}
                <div className={`rounded border px-3 py-2.5 space-y-1.5 ${
                  rt60Status === "optimal" ? "border-[#2563EB]/20" : "border-amber-500/20"
                }`} style={{ background: rt60Status === "optimal" ? "rgba(37,99,235,0.05)" : "rgba(245,158,11,0.05)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wide">RT60 Outcome</span>
                    <span className={`font-mono font-bold ${rt60Status === "optimal" ? "text-[#60A5FA]" : "text-amber-400"}`}>
                      {acousticResult.rt60Seconds.toFixed(2)} s
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#202b40]">Target ({rt60Target.label})</span>
                    <span className="text-[#202b40]">{targetRT60Min}–{targetRT60Max} s</span>
                  </div>
                  <div className="text-xs pt-1 border-t border-white/[0.05]">
                    {rt60Status === "optimal"    && <span className="text-[#60A5FA]">✓ On target</span>}
                    {rt60Status === "overdamped" && <span className="text-amber-400">Over-treated — reduce depth</span>}
                    {rt60Status === "tooLive"    && <span className="text-amber-400">Under-treated — increase depth</span>}
                  </div>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded px-3 py-2" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-xs text-[#202b40]">Acoustic Score</div>
                    <div className="text-lg font-semibold text-[#202b40]">{acousticResult.acousticScore}</div>
                    <div className="text-[10px] text-[#202b40] leading-relaxed">/ 100</div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-xs text-[#202b40]">Schroeder</div>
                    <div className="text-lg font-semibold text-[#202b40]">{acousticResult.schroederFrequencyHz.toFixed(0)}</div>
                    <div className="text-[10px] text-[#202b40] leading-relaxed">Hz</div>
                  </div>
                </div>

                {/* Modal Intelligence */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-xs text-[#202b40] mb-2">Modal Analysis</div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#202b40]">Risk</span>
                    <span className="text-[#202b40] capitalize">{acousticResult.modalRiskLevel}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#202b40]">Modes evaluated</span>
                    <span className="text-[#60A5FA]">{acousticResult.modeCount}</span>
                  </div>
                  {worstCluster && (
                    <>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#202b40]">Worst cluster</span>
                        <span className="text-[#60A5FA]">{worstCluster.centerFrequencyHz?.toFixed(0)} Hz</span>
                      </div>
                      <div className="w-full h-1.5 rounded overflow-hidden mt-2" style={{ background: "#c4c6c8" }}>
                        <div className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500"
                          style={{ width: `${clusterRiskPercent}%` }} />
                      </div>
                    </>
                  )}
                  {!worstCluster && <span className="text-xs text-green-400">No critical clustering</span>}
                </div>

                {/* Treatment Recommendation */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#202b40]">Treatment Priority</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      acousticResult.recommendedTreatment.priority === "critical" ? "text-red-500 bg-red-500/10" :
                      acousticResult.recommendedTreatment.priority === "high"     ? "text-orange-400 bg-orange-400/10" :
                      acousticResult.recommendedTreatment.priority === "moderate" ? "text-yellow-400 bg-yellow-400/10" :
                      "text-green-400 bg-green-400/10"
                    }`}>
                      {acousticResult.recommendedTreatment.priority.charAt(0).toUpperCase() + acousticResult.recommendedTreatment.priority.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {acousticResult.recommendedTreatment.bassTrapRequired   && <div className="text-xs text-green-400">✓ Bass Traps</div>}
                    {acousticResult.recommendedTreatment.broadbandRequired  && <div className="text-xs text-green-400">✓ Broadband</div>}
                    {acousticResult.recommendedTreatment.diffusionRequired  && <div className="text-xs text-green-400">✓ Diffusion</div>}
                    {acousticResult.recommendedTreatment.ceilingCloudRequired && <div className="text-xs text-green-400">✓ Ceiling Cloud</div>}
                  </div>
                  <p className="text-[10px] text-[#202b40] leading-relaxed">{acousticResult.recommendedTreatment.explanation}</p>
                </div>

                {/* Panel Engine Diagnostics */}
                <div className="rounded px-3 py-2.5 space-y-2" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-1">Panel Layout — Calculated Values</div>

                  {/* Bass trap */}
                  <div className="flex justify-between text-xs border-b border-slate-100 pb-1.5">
                    <span className="text-[#202b40]">Bass trap leg</span>
                    <span className="font-mono text-[#2563EB] font-semibold">
                      {(panelLayout.diagnostics.trapLegM * 100).toFixed(0)} cm
                    </span>
                  </div>
                  <div className="text-xs text-[#202b40] -mt-1 pb-1.5 border-b border-slate-100">
                    λ/4 at {(343 / (4 * panelLayout.diagnostics.trapLegM)).toFixed(0)} Hz — lowest axial mode
                  </div>

                  {/* SBIR */}
                  <div className="flex justify-between text-xs">
                    <span className="text-[#202b40]">SBIR first notch</span>
                    <span className="font-mono text-[#2563EB] font-semibold">{panelLayout.diagnostics.sbirFreqHz} Hz</span>
                  </div>


                  {/* First reflection points */}
                  <div className="text-xs text-[#202b40] mt-1">First Reflection Points</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pb-1.5 border-b border-slate-100">
                    <span className="text-[#202b40]">Left wall</span>
                    <span className="font-mono text-[#202b40]">{panelLayout.diagnostics.frpLeftZ.toFixed(2)} m</span>
                    <span className="text-[#202b40]">Right wall</span>
                    <span className="font-mono text-[#202b40]">{panelLayout.diagnostics.frpRightZ.toFixed(2)} m</span>
                    <span className="text-[#202b40]">Ceiling</span>
                    <span className="font-mono text-[#202b40]">{panelLayout.diagnostics.frpCeilingZ.toFixed(2)} m</span>
                    <span className="text-[#202b40]">Listener Z</span>
                    <span className="font-mono text-[#60A5FA]">{panelLayout.diagnostics.listenerZ.toFixed(2)} m</span>
                  </div>

                  {/* Coverage per surface */}
                  <div className="text-xs text-[#202b40]">Coverage per Surface</div>
                  {(["front","rear","left","right","ceiling"] as const).map(s => {
                    const pct = Math.round((panelLayout.diagnostics.coveragePerSurface[s] ?? 0) * 100)
                    return (
                      <div key={s} className="flex items-center gap-2 text-xs">
                        <span className="text-[#202b40] capitalize w-12">{s}</span>
                        <div className="flex-1 h-1.5 rounded overflow-hidden" style={{ background: "#c4c6c8" }}>
                          <div className="h-full rounded transition-all"
                            style={{
                              width: `${pct}%`,
                              background: pct > 70 ? "#2563EB" : pct > 35 ? "#60A5FA" : "#202b40"
                            }} />
                        </div>
                        <span className="font-mono text-[#202b40] w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}

                  {/* RT60 ratio */}
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-[#202b40]">RT60 ratio</span>
                    <span className={`font-mono font-semibold ${
                      panelLayout.diagnostics.rt60Ratio > 1.05 ? "text-amber-400" :
                      panelLayout.diagnostics.rt60Ratio < 0.85 ? "text-blue-400" : "text-green-400"
                    }`}>
                      {panelLayout.diagnostics.rt60Ratio.toFixed(2)}
                      {panelLayout.diagnostics.rt60Ratio > 1.05 ? " ↑" : panelLayout.diagnostics.rt60Ratio < 0.85 ? " ↓" : " ✓"}
                    </span>
                  </div>
                </div>
              </>
            ))}

            {/* ── SCREEN TAB ── */}
            {rightPanelTab === "screen" && (!geometryValid ? (
              <div className="text-xs text-[#202b40] text-center py-12">Complete room setup first</div>
            ) : (
              <>
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Screen Geometry</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Screen Size</span>
                      <span className="text-[#60A5FA] font-semibold">{screenDiagonalInches}"</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Width × Height</span>
                      <span className="text-[#60A5FA]">
                        {unitSystem === "imperial"
                          ? `${(screenWidthMeters * 39.3701).toFixed(1)}" × ${(screenHeight * 39.3701).toFixed(1)}"`
                          : `${(screenWidthMeters * 100).toFixed(0)} × ${(screenHeight * 100).toFixed(0)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Max Available Width</span>
                      <span className={screenFitValidation.fitsWidth ? "text-[#202b40]" : "text-amber-400"}>
                        {unitSystem === "imperial"
                          ? `${(screenFitValidation.maxScreenWidth * 39.3701).toFixed(1)}"`
                          : `${(screenFitValidation.maxScreenWidth * 100).toFixed(0)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Screen Bottom</span>
                      <span className="text-[#60A5FA]">
                        {unitSystem === "imperial"
                          ? `${Math.round(screenBottomFromFloor * 39.3701)}"`
                          : `${Math.round(screenBottomFromFloor * 100)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Screen Top</span>
                      <span className={screenBottomFromFloor + screenHeight <= usableRoom.height - 0.05 ? "text-[#60A5FA]" : "text-amber-400"}>
                        {unitSystem === "imperial"
                          ? `${Math.round((screenBottomFromFloor + screenHeight) * 39.3701)}"`
                          : `${Math.round((screenBottomFromFloor + screenHeight) * 100)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs pt-1.5 border-t border-white/[0.05]">
                      <span className="text-[#202b40]">Ideal Viewing Distance</span>
                      <span className="text-[#60A5FA]">{unitSystem === "imperial"
                        ? `${Math.floor(seatingCalcs.viewingDistance * 3.28084)}'${Math.round((seatingCalcs.viewingDistance * 3.28084 % 1) * 12)}"`
                        : `${seatingCalcs.viewingDistance.toFixed(2)} m`}
                      </span>
                    </div>
                    {displayType === "projector" && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#202b40]">Throw Distance</span>
                        <span className={throwValidation.fits ? "text-[#60A5FA]" : "text-amber-400"}>
                          {unitSystem === "imperial"
                            ? `${Math.floor(throwDistance * 3.28084)}'${Math.round((throwDistance * 3.28084 % 1) * 12)}"`
                            : `${throwDistance.toFixed(2)} m`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">FOV at Front Row</span>
                      <span className={Math.abs(hFOV - targetAngle) <= 5 ? "text-[#60A5FA]" : "text-amber-400"}>
                        {hFOV.toFixed(1)}° {Math.abs(hFOV - targetAngle) <= 5 ? "✓" : `(target ${targetAngle}°)`}
                      </span>
                    </div>
                  </div>
                </div>
                {!screenFitValidation.fits && (
                  <p className="text-xs text-amber-400">Screen exceeds available wall space — choose a smaller size</p>
                )}
                {!throwValidation.fits && displayType === "projector" && (
                  <p className="text-xs text-amber-400">Projector throw exceeds room — reduce throw ratio or screen size</p>
                )}
              </>
            ))}

            {/* ── SEATING TAB ── */}
            {rightPanelTab === "seating" && (!geometryValid ? (
              <div className="text-xs text-[#202b40] text-center py-12">Complete room setup first</div>
            ) : (
              <>
                {/* Summary card */}
                <div className="rounded border border-[#2563EB]/20 px-3 py-2.5" style={{ background: "rgba(37,99,235,0.07)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#202b40] font-semibold">Layout</span>
                    <span className="text-sm font-bold text-[#60A5FA]">
                      {seatingCalcs.rowCount} × {seatingCalcs.seatsPerRow}{widerBackRow && seatingCalcs.rowCount > 1 ? ` + ${seatingCalcs.backRowSeats}` : ""} seats
                    </span>
                  </div>
                  <div className="text-[10px] text-[#202b40] leading-relaxed">
                    Max {seatingCalcs.maxRows} rows × {seatingCalcs.maxSeatsWithAisle} seats
                  </div>
                </div>

                {/* Engineering detail */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Dimensions</div>
                  {[
                    { label: "First Row from Screen", val: (() => { const m = seatingCalcs.frontClearance; return unitSystem === "imperial" ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"` : `${m.toFixed(2)} m` })() },
                    { label: "Rear Clearance", val: (() => { const m = seatingCalcs.rearClearanceM; return unitSystem === "imperial" ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"` : `${m.toFixed(2)} m` })(), warn: seatingCalcs.rearClearanceM < 0.5 },
                    { label: "Total Platform Rise", val: (() => { const m = seatingCalcs.totalRiseM; return unitSystem === "imperial" ? `${Math.round(m*39.3701)}"` : `${(m*1000).toFixed(0)} mm` })(), warn: seatingCalcs.totalRiseM > 1.2 },
                    { label: "Back Row Eye Height", val: (() => { const m = seatingCalcs.lastRowEyeHeightM; return unitSystem === "imperial" ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"` : `${m.toFixed(2)} m` })() },
                    { label: "Headroom at Back", val: (() => { const m = seatingCalcs.headroomM; return unitSystem === "imperial" ? `${Math.round(m*39.3701)}"` : `${(m*100).toFixed(0)} cm` })(), warn: seatingCalcs.headroomM < 0.45 },
                  ].map(({ label, val, warn }) => (
                    <div key={label} className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#202b40]">{label}</span>
                      <span className={warn ? "text-amber-400 font-semibold" : "text-[#60A5FA]"}>{val}</span>
                    </div>
                  ))}
                  {seatingCalcs.totalRiseM > 1.2 && (
                    <p className="text-xs text-amber-400 mt-1 pt-1 border-t border-white/[0.05]">Rise exceeds 1.2 m — structural platform required</p>
                  )}
                </div>

                {/* Per-row view quality */}
                {seatingCalcs.rowAnalysis.length > 0 && (
                  <div className="rounded overflow-hidden" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#2563EB]">View Quality per Row</span>
                      <span className="text-[10px] text-[#202b40] leading-relaxed">R1 = back</span>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      <div className="flex text-xs text-[#202b40] border-b border-white/[0.04] pb-1 mb-1">
                        <span className="w-8">Row</span>
                        <span className="flex-1">Eye Ht</span>
                        <span className="flex-1">Distance</span>
                        <span className="w-14 text-right">View</span>
                      </div>
                      {seatingCalcs.rowAnalysis.map((r) => {
                        const fmtD2 = (m: number) => unitSystem === "imperial"
                          ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"`
                          : `${m.toFixed(1)} m`
                        return (
                          <div key={r.rowNum} className="flex text-xs items-center">
                            <span className="w-8 text-[#202b40] font-medium">R{r.rowNum}</span>
                            <span className="flex-1 text-[#60A5FA]">{fmtD2(r.eyeHeight)}</span>
                            <span className="flex-1 text-[#202b40]">{fmtD2(r.distFromScreen)}</span>
                            <span className={`w-14 text-right font-semibold ${r.sightlineStatus === "clear" ? "text-[#60A5FA]" : r.sightlineStatus === "marginal" ? "text-amber-400" : "text-red-400"}`}>
                              {r.sightlineStatus === "clear" ? "Clear" : r.sightlineStatus === "marginal" ? "Marginal" : "Blocked"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ))}

            {/* ── ENGINEERING / ROOM TAB ── */}
            {rightPanelTab === "engineering" && (!roomValidation.valid ? (
              <div className="text-xs text-[#202b40] text-center py-12">Enter valid room dimensions first</div>
            ) : (
              <>
                {/* Room Summary */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Room Dimensions</div>
                  <div className="space-y-1">
                    {[
                      { label: "Length", m: clampedRoom.length },
                      { label: "Width",  m: clampedRoom.width  },
                      { label: "Height", m: clampedRoom.height },
                    ].map(({ label, m }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-[#202b40]">{label}</span>
                        <span className="text-[#60A5FA]">
                          {unitSystem === "imperial"
                            ? (() => { const ti = m * 39.3701; return `${Math.floor(ti/12)}'${Math.round(ti%12)}"` })()
                            : `${m.toFixed(2)} m`}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-1 border-t border-white/[0.05]">
                      <span className="text-[#202b40]">Volume</span>
                      <span className="text-[#60A5FA] font-semibold">
                        {unitSystem === "imperial"
                          ? `${(roomVolume * 35.3147).toFixed(0)} ft³`
                          : `${roomVolume.toFixed(1)} m³`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Usable Room */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Usable Room (after treatment)</div>
                  <div className="space-y-1">
                    {[
                      { label: "Length", m: usableRoom.length },
                      { label: "Width",  m: usableRoom.width  },
                      { label: "Height", m: usableRoom.height },
                    ].map(({ label, m }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-[#202b40]">{label}</span>
                        <span className="text-[#60A5FA]">
                          {unitSystem === "imperial"
                            ? (() => { const ti = m * 39.3701; return `${Math.floor(ti/12)}'${Math.round(ti%12)}"` })()
                            : `${m.toFixed(2)} m`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Surface Areas */}
                {roomSurfaceData && (
                  <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Surface Areas</div>
                    <div className="space-y-1">
                      {[
                        { label: "Floor",       v: roomSurfaceData.floorArea },
                        { label: "Ceiling",     v: roomSurfaceData.ceilingArea },
                        { label: "Front Wall",  v: roomSurfaceData.frontWall },
                        { label: "Rear Wall",   v: roomSurfaceData.rearWall },
                        { label: "Left Wall",   v: roomSurfaceData.leftWall },
                        { label: "Right Wall",  v: roomSurfaceData.rightWall },
                      ].map(({ label, v }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-[#202b40]">{label}</span>
                          <span className="text-[#60A5FA]">{convertArea(v).toFixed(1)} {displayUnitArea}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs pt-1 border-t border-white/[0.05] font-semibold">
                        <span className="text-[#202b40]">Total</span>
                        <span className="text-[#60A5FA]">{convertArea(roomSurfaceData.totalSurface).toFixed(1)} {displayUnitArea}</span>
                      </div>
                    </div>
                  </div>
                )}


              </>
            ))}

            {/* ── SUGGESTIONS TAB ── */}
            {rightPanelTab === "suggestions" && (() => {
              if (!isRoomValid) return (
                <div className="text-xs text-[#202b40] text-center py-12">Enter valid room dimensions first</div>
              )

              type Advisory = { id: string; level: "critical" | "warn" | "info"; category: "Acoustic" | "Speaker" | "Screen"; title: string; detail: string }
              const advisories: Advisory[] = []

              // ── TREATMENT + INTENT descriptions (info level, Acoustic category) ──
              const treatmentDesc: Record<string, string> = {
                none:     "Bare room — wall material physics only",
                basic:    "Full wall absorbers, open ceiling — entry-level treatment",
                standard: "Full absorption + reflector panels at first-reflection zone",
                studio:   "Full treatment, rear diffusers & corner bass traps",
              }
              const intentDesc: Record<string, string> = {
                dialogue:  "High absorption, minimal reverb — dialogue clarity, RT60 0.15–0.30 s",
                cinematic: "Balanced absorption + diffusion — cinematic reference, RT60 0.20–0.40 s",
                hybrid:    "Controlled reverb with rear diffusion — luxury cinema feel, RT60 0.25–0.45 s",
                music:     "Live reflections, reduced absorption — audiophile listening, RT60 0.30–0.50 s",
              }
              if (treatmentDesc[treatmentLevel])
                advisories.push({ id: "treatment-desc", level: "info", category: "Acoustic",
                  title: `Treatment: ${treatmentLevel.charAt(0).toUpperCase() + treatmentLevel.slice(1)}`,
                  detail: treatmentDesc[treatmentLevel] })
              if (intentDesc[designIntent])
                advisories.push({ id: "intent-desc", level: "info", category: "Acoustic",
                  title: `Design Intent: ${designIntent.charAt(0).toUpperCase() + designIntent.slice(1)}`,
                  detail: intentDesc[designIntent] })

              // ── ACOUSTIC ──
              // SBIR: informational only. Pushing the notch below 80 Hz needs >90 cm of panel depth
              // (not achievable in a home theatre). Address via DSP/EQ, not panel thickness.
              const sbirFreqDisplay = panelLayout.diagnostics.sbirFreqHz
              if (sbirFreqDisplay > 0)
                advisories.push({ id: "sbir", level: "info", category: "Acoustic",
                  title: `SBIR notch at ${sbirFreqDisplay} Hz`,
                  detail: "Speaker boundary interference at this frequency. Caused by front wall proximity — address with DSP/EQ, not panel depth." })
              const tooDeepL2 = acousticDepthMeters.front + acousticDepthMeters.rear >= clampedRoom.length - 0.5
              const tooDeepW2 = acousticDepthMeters.left + acousticDepthMeters.right >= clampedRoom.width - 0.5
              if (tooDeepL2) advisories.push({ id: "deep-len", level: "critical", category: "Acoustic", title: "Front + rear depth conflict", detail: "Less than 0.5 m of live room length remaining. Reduce panel depths or use a deeper room." })
              if (tooDeepW2) advisories.push({ id: "deep-wid", level: "critical", category: "Acoustic", title: "Side depth conflict", detail: "Less than 0.5 m of live room width remaining. Reduce side panel depths." })
              const committedRt60Target = RT60_TARGETS[committed.designIntent] ?? RT60_TARGETS.cinematic
              if (rt60Status === "overdamped") advisories.push({ id: "rt60-over", level: "warn", category: "Acoustic", title: "Room over-treated",
                detail: `RT60 is below the ${committedRt60Target.min}–${committedRt60Target.max} s target for ${committed.designIntent} intent. Lower the treatment level (e.g. Standard instead of Studio) or reduce panel depths.` })
              if (rt60Status === "tooLive")   advisories.push({ id: "rt60-live", level: "warn", category: "Acoustic", title: "Room under-treated",
                detail: `RT60 is above the ${committedRt60Target.min}–${committedRt60Target.max} s target for ${committed.designIntent} intent. Increase panel depth or upgrade treatment level.` })

              // ── SPEAKER ──
              if (ceilingCount === 6 && clampedRoom.height < 3.5)
                advisories.push({ id: "ceil6h", level: "warn", category: "Speaker", title: "Ceiling too low for 6 overhead",
                  detail: `Current: ${unitSystem === "imperial" ? `${(clampedRoom.height * 3.28084).toFixed(1)} ft` : `${clampedRoom.height.toFixed(1)} m`} — minimum 3.5 m (11.5 ft) recommended for 6-channel overhead.` })
              if (ceilingCount === 4 && clampedRoom.height < 2.7)
                advisories.push({ id: "ceil4h", level: "warn", category: "Speaker", title: "Ceiling low for 4 overhead",
                  detail: `Current: ${unitSystem === "imperial" ? `${(clampedRoom.height * 3.28084).toFixed(1)} ft` : `${clampedRoom.height.toFixed(1)} m`} — 2.7 m (8.9 ft) recommended for 4-channel overhead.` })
              if (ceilingCount === 2 && clampedRoom.height < 2.4)
                advisories.push({ id: "ceil2h", level: "warn", category: "Speaker", title: "Ceiling borderline for 2 overhead",
                  detail: `Current: ${unitSystem === "imperial" ? `${(clampedRoom.height * 3.28084).toFixed(1)} ft` : `${clampedRoom.height.toFixed(1)} m`} — 2.4 m (7.9 ft) is the practical minimum.` })
              if (mountType === "inWall" && acousticDepthMeters.left < 0.125)
                advisories.push({ id: "inwall-side", level: "warn", category: "Speaker", title: "Side depth too shallow for in-wall",
                  detail: `Increase side depth to ≥${unitSystem === "imperial" ? '5"' : "12.5 cm"} to accommodate in-wall driver cavity.` })
              if (screenPlacement === "besideScreen" && usableRoom.width < 4.5)
                advisories.push({ id: "beside-narrow", level: "critical", category: "Speaker", title: "Room too narrow for Beside Screen",
                  detail: `Usable width: ${unitSystem === "imperial" ? `${(usableRoom.width * 3.28084).toFixed(1)} ft` : `${usableRoom.width.toFixed(1)} m`} — 4.5 m (14.8 ft) needed for L/R speaker clearance.` })
              const areaM2 = clampedRoom.length * clampedRoom.width
              if (subCount >= 3 && areaM2 < 30)
                advisories.push({ id: "sub-small", level: "warn", category: "Speaker", title: `${subCount} subs may worsen modal distribution`,
                  detail: `Room area ${unitSystem === "imperial" ? `${(areaM2 * 10.7639).toFixed(0)} ft²` : `${areaM2.toFixed(0)} m²`} — multiple subs can excite standing waves in small rooms. Consider 2.` })
              if ((subPlacement === "frontCorners" || subPlacement === "haas") && subType === "ported")
                advisories.push({ id: "ported-boundary", level: "warn", category: "Speaker", title: "Ported sub at boundary",
                  detail: "Boundary placement + ported enclosure reinforces room modes. Switch to sealed for tighter low-end control." })

              // ── SCREEN ──
              if (!screenFitValidation.fitsWidth)
                advisories.push({ id: "scr-wide", level: "critical", category: "Screen", title: "Screen wider than available wall",
                  detail: `Screen ${fmtScreenDim(screenWidthMeters)} wide — max available: ${fmtScreenDim(screenFitValidation.maxScreenWidth)}. Reduce diagonal or switch to Beside Screen.` })
              if (!throwValidation.fits && displayType === "projector")
                advisories.push({ id: "throw-short", level: "critical", category: "Screen", title: "Throw distance exceeds room depth",
                  detail: `Needs ${fmtM(throwDistance)} — only ${fmtM(throwValidation.maxThrow)} available. Use a shorter throw lens ratio.` })

              // ── Auto-recommendations ──
              const rec = autoRecommended
              const recLabel = `${rec.lcr.toUpperCase()} · ${rec.surrounds === "side_rear" ? "Side + Rear" : rec.surrounds === "side" ? "Side only" : "No surrounds"} · ${rec.ceilingCount > 0 ? `${rec.ceilingCount} OH` : "No overhead"}`
              const recDiffers = rec.lcr !== lcrMode || rec.surrounds !== surroundMode || rec.ceilingCount !== ceilingCount
              const recNotation = rec.ceilingCount > 0
                ? `${rec.surrounds === "side_rear" ? 7 : rec.surrounds === "side" ? 5 : 3}.1.${rec.ceilingCount}`
                : `${rec.surrounds === "side_rear" ? 7 : rec.surrounds === "side" ? 5 : 3}.1`

              // ── Sort: critical → warn → info ──
              const order = { critical: 0, warn: 1, info: 2 }
              advisories.sort((a, b) => order[a.level] - order[b.level])

              // Group by category
              const cats = ["Acoustic", "Speaker", "Screen"] as const
              const catColors: Record<string, string> = { Acoustic: "#818CF8", Speaker: "#60A5FA", Screen: "#34D399" }
              const levelIcon = (lvl: string) => lvl === "critical" ? "●" : lvl === "warn" ? "◐" : "○"
              const levelColor = (lvl: string) =>
                lvl === "critical" ? "#ef4444" : lvl === "warn" ? "#f59e0b" : "#60A5FA"

              // What's committed vs live
              const liveNotation = configNotation
              const appliedNotation = (() => {
                const a = committed
                const ch = a.ceilingCount > 0
                  ? `${a.surroundMode === "side_rear" ? 7 : a.surroundMode === "side" ? 5 : 3}.1.${a.ceilingCount}`
                  : `${a.surroundMode === "side_rear" ? 7 : a.surroundMode === "side" ? 5 : 3}.1`
                return ch
              })()
              const hasDirty = isDirty

              return (
                <div className="space-y-3">

                  {/* ── Config Status ── */}
                  <div className="rounded-lg px-3 py-3" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5a72] mb-2.5">Config Status</div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#6b7a90]">Live (editing)</span>
                        <span className="text-xs font-mono font-semibold" style={{ color: "#60A5FA" }}>{liveNotation}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#6b7a90]">Applied to engine</span>
                        <span className="text-xs font-mono font-semibold" style={{ color: hasDirty ? "#f59e0b" : "#60A5FA" }}>{appliedNotation}</span>
                      </div>
                      {hasDirty && (
                        <div className="rounded px-2 py-1.5 mt-1" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}>
                          <p className="text-[10px] leading-relaxed" style={{ color: "#f59e0b" }}>Changes pending — press <span className="font-semibold">Apply</span> to update acoustics and 3D view</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Auto-recommendation ── */}
                  <div className="rounded-lg px-3 py-3" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5a72] mb-2">Recommended for this room</div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-[#202b40]">{recNotation}</p>
                        <p className="text-[10px] text-[#6b7a90] mt-0.5 leading-relaxed">{recLabel}</p>
                        <p className="text-[10px] text-[#6b7a90] mt-1">
                          {roomVolume.toFixed(1)} m³ · {clampedRoom.height.toFixed(1)} m ceiling
                        </p>
                      </div>
                      <div className="shrink-0">
                        {recDiffers
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}>Differs from current</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", border: "1px solid rgba(52,211,153,0.25)" }}>Matches ✓</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* ── Advisories ── */}
                  {advisories.length === 0 ? (
                    <div className="rounded-lg px-3 py-6 text-center" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                      <div className="text-lg mb-1 text-[#34D399]">✓</div>
                      <p className="text-xs font-semibold text-[#202b40]">No issues found</p>
                      <p className="text-[10px] text-[#6b7a90] mt-1">All settings are within recommended ranges</p>
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden" style={{ border: "1.5px solid #8a9ab0" }}>
                      <div className="px-3 py-2" style={{ background: "#dfe1e3", borderBottom: "1px solid #b8bfc9" }}>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5a72]">
                          {advisories.length} issue{advisories.length !== 1 ? "s" : ""} · {advisories.filter(a => a.level === "critical").length > 0 ? `${advisories.filter(a => a.level === "critical").length} critical` : "no critical"}
                        </span>
                      </div>
                      <div className="divide-y" style={{ borderColor: "#b8bfc9" }}>
                        {cats.map(cat => {
                          const catAdvs = advisories.filter(a => a.category === cat)
                          if (catAdvs.length === 0) return null
                          return (
                            <div key={cat} style={{ background: "#dfe1e3" }}>
                              <div className="px-3 py-1.5" style={{ borderBottom: "1px solid #b8bfc9", background: "rgba(0,0,0,0.03)" }}>
                                <span className="text-[10px] font-semibold" style={{ color: catColors[cat] }}>{cat}</span>
                              </div>
                              <div className="space-y-0">
                                {catAdvs.map((adv, i) => (
                                  <div key={adv.id} className="px-3 py-2.5" style={{ borderTop: i > 0 ? "1px solid #b8bfc9" : undefined }}>
                                    <div className="flex items-start gap-2">
                                      <span className="text-[10px] mt-0.5 shrink-0" style={{ color: levelColor(adv.level) }}>{levelIcon(adv.level)}</span>
                                      <div>
                                        <p className="text-xs font-semibold text-[#202b40] leading-snug">{adv.title}</p>
                                        <p className="text-[10px] text-[#6b7a90] mt-0.5 leading-relaxed">{adv.detail}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

          </div>
        </div>
      </div>
    </div>
  )
}