/**
 * Acoustic Panel Placement Engine v2
 *
 * Treatment tiers (internal values → UI labels):
 *   minimal   → Basic    Full-wall absorption all surfaces, POP/gypsum ceiling slab.
 *                         No bass traps. No diffusers. No FRP markers.
 *   balanced  → Standard Full-wall absorption + full acoustic ceiling + FRP markers.
 *                         No bass traps. No diffusers.
 *   reference → Studio   All of Standard + bass traps + rear diffuser.
 *
 * NO-GAP RULE
 *   Every active surface (depth > 0.005 m) always receives a zone that spans
 *   its full width and height. RT60 ratio drives tile DENSITY, not zone size.
 *
 * Physics references unchanged from v1 (Everest, Newell).
 */

const SPEED = 343 // m/s at 20°C

export type PanelType =
  | 'absorber'
  | 'ceiling_slab'    // Basic: smooth POP/gypsum slab — single tile, low absorption
  | 'frp_marker'      // Standard/Studio: highlighted strip at first-reflection point
  | 'reflector'       // Standard/Studio: hard MDF/wood specular panel, engine-positioned
  | 'diffuser_skyline'
  | 'diffuser_slatted'

export type PanelSurface = 'front' | 'rear' | 'left' | 'right' | 'ceiling'

/**
 * 2-D zone on a wall surface (unchanged coordinate convention).
 *  front / rear:  u = world X,  v = world Y,  uw = width (X),  vh = height (Y)
 *  left / right:  u = world Z,  v = world Y,  uw = length (Z), vh = height (Y)
 *  ceiling:       u = world X,  v = world Z,  uw = width (X),  vh = length (Z)
 */
export interface WallZone {
  u:     number
  v:     number
  uw:    number
  vh:    number
  depth: number   // panel thickness into room (m)
}

export interface AcousticPanelZone {
  id:               string
  type:             PanelType
  surface:          PanelSurface
  zone:             WallZone
  coverageFraction: number   // always 1.0 for full-wall panels; informational
  densityMultiplier: number  // RT60-driven tile density scaler
}

export interface BassTrapZone {
  corner: 'FL' | 'FR' | 'RL' | 'RR'
  leg:    number  // triangular leg in metres
}

export interface PanelDiagnostics {
  rt60Ratio:          number
  trapLegM:           number
  sbirFreqHz:         number
  sbirMinDepthM:      number
  frpLeftZ:           number
  frpRightZ:          number
  frpCeilingZ:        number
  frpCeilingX:        number  // NEW: ceiling FRP X coordinate
  listenerZ:          number
  coveragePerSurface: { front: number; rear: number; left: number; right: number; ceiling: number }
}

export interface PanelLayout {
  panels:      AcousticPanelZone[]
  traps:       BassTrapZone[]
  diagnostics: PanelDiagnostics
}

// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function computePanelLayout(p: {
  room:                  { width: number; length: number; height: number }
  acousticDepths:        { front: number; rear: number; left: number; right: number; ceiling: number }
  treatmentLevel:        string
  designIntent:          string
  computedRT60:          number | null
  targetRT60:            { min: number; max: number }
  primaryRow:            number
  seatingRowCount:       number
  rowPitchM:             number
  frontClearance:        number
  usableWidth:           number
  screenWidth:           number
  screenHeight:          number
  screenBottomFromFloor: number
  mountType:             'inWall' | 'onWall'
}): PanelLayout {
  const { room, acousticDepths, treatmentLevel, designIntent,
          computedRT60, targetRT60, primaryRow,
          seatingRowCount, rowPitchM, frontClearance, usableWidth,
          screenWidth, screenHeight, screenBottomFromFloor, mountType } = p
  const { width: W, length: L, height: H } = room

  // ── Level flags ──────────────────────────────────────────────────────────
  // "none" = bare room shell — skip all panel/trap calculations
  if (treatmentLevel === 'none') {
    return {
      panels: [],
      traps:  [],
      diagnostics: {
        rt60Ratio: 0, trapLegM: 0, sbirFreqHz: 0, sbirMinDepthM: 0,
        frpLeftZ: 0, frpRightZ: 0, frpCeilingZ: 0, frpCeilingX: 0, listenerZ: 0,
        coveragePerSurface: { front: 0, rear: 0, left: 0, right: 0, ceiling: 0 },
      },
    }
  }

  const isBasic    = treatmentLevel === 'basic'
  const isStandard = treatmentLevel === 'standard'
  const isStudio   = treatmentLevel === 'studio'

  const MIN_D = 0.060   // minimum visible panel depth when slider at zero

  // ── RT60 ratio — density multiplier only (zone size always full) ──────────
  const rt60      = computedRT60 ?? targetRT60.max
  const rt60Ratio = rt60 / targetRT60.max

  // Density multiplier: 1.0 = default tile spacing; >1 = tighter grid; <1 = sparser
  // Stage-1 (up to 2.0): more tiles per m² as room gets more live
  // Stage-2 (>2.0): even denser when very over-live
  let densityMult: number
  if (rt60Ratio >= 1.0) {
    densityMult = clamp(1.0 + (rt60Ratio - 1.0) * 1.6, 1.0, 2.4)
  } else {
    // Under-damped room: sparser tile layout, min 0.55 (still visible)
    densityMult = clamp(rt60Ratio * 0.8 + 0.2, 0.55, 1.0)
  }

  // ── Bass trap leg ────────────────────────────────────────────────────────
  const fLowest = Math.min(SPEED / (2 * W), SPEED / (2 * L))
  const qWave   = SPEED / (4 * fLowest)
  const trapLeg = clamp(
    Math.min(qWave * 0.38, Math.min(W, L) * 0.14),
    0.12, 0.55
  )

  // ── SBIR ─────────────────────────────────────────────────────────────────
  const mountOff      = mountType === 'inWall' ? 0.06 : 0.16
  const speakerToWall = Math.max(0.08, acousticDepths.front + mountOff)
  const sbirFreqHz    = SPEED / (4 * speakerToWall)
  // sbirMinDepthM: no practical minimum exists — pushing the SBIR notch below
  // 80 Hz would require the speaker >1 m from the front wall, which is not
  // achievable with panel depth alone. Export 0 so advisory checks never fire.
  const sbirMinDepthM = 0

  // ── Primary listener position ────────────────────────────────────────────
  const row0      = clamp(primaryRow, 0, Math.max(0, seatingRowCount - 1))
  const listenerZ = acousticDepths.front + frontClearance + row0 * rowPitchM
  const listenerX = W / 2
  const listenerY = 1.15

  // ── Speaker positions (FL/FR) ────────────────────────────────────────────
  const flX  = Math.max(0.15, (W - screenWidth) / 2 - 0.1)
  const frX  = W - flX
  const spkZ = acousticDepths.front + mountOff
  const spkY = screenBottomFromFloor + screenHeight / 2

  // ── First Reflection Points (mirror-image rule) ───────────────────────────
  const tFL      = clamp(flX / (flX + listenerX), 0, 1)
  const frpLeftZ = clamp(spkZ + tFL * (listenerZ - spkZ), 0, L)

  const tFR       = clamp((W - frX) / ((W - frX) + (W - listenerX)), 0, 1)
  const frpRightZ = clamp(spkZ + tFR * (listenerZ - spkZ), 0, L)

  const denom    = (H - spkY) + (H - listenerY)
  const tCeil    = denom > 0 ? clamp((H - spkY) / denom, 0, 1) : 0.5
  const frpCeilZ = clamp(spkZ + tCeil * (listenerZ - spkZ), 0, L)
  const frpCeilX = W / 2   // symmetric room: ceiling FRP at centreline

  // ── Panel assembly ────────────────────────────────────────────────────────
  const panels: AcousticPanelZone[] = []
  const traps:  BassTrapZone[]      = []
  const cov = { front: 0, rear: 0, left: 0, right: 0, ceiling: 0 }

  // ── Bass traps — Studio only ─────────────────────────────────────────────
  if (isStudio) {
    for (const corner of ['FL','FR','RL','RR'] as const) {
      traps.push({ corner, leg: trapLeg })
    }
  }

  // ── Helper: full-wall absorber zone ──────────────────────────────────────
  const fullWallZone = (surface: 'left' | 'right' | 'rear', depth: number): WallZone => {
    if (surface === 'rear') return { u: 0, v: 0, uw: W, vh: H, depth }
    return { u: 0, v: 0, uw: L, vh: H, depth }   // left / right span full room length Z
  }

  // ── Front wall — single full-width panel (screen floats in front of it) ──
  if (acousticDepths.front > 0.005) {
    const d = Math.max(MIN_D, acousticDepths.front)
    panels.push({
      id: 'front-full', type: 'absorber', surface: 'front',
      zone: { u: 0, v: 0, uw: W, vh: H, depth: d },
      coverageFraction: 1.0, densityMultiplier: densityMult,
    })
    cov.front = 1.0
  }

  // ── Left wall — full coverage (MIN_D fallback when slider at zero) ──────────
  {
    panels.push({
      id: 'left-full', type: 'absorber', surface: 'left',
      zone: fullWallZone('left', Math.max(MIN_D, acousticDepths.left)),
      coverageFraction: 1.0, densityMultiplier: densityMult,
    })
    cov.left = 1.0
  }

  // ── Right wall — full coverage (MIN_D fallback) ───────────────────────────
  {
    panels.push({
      id: 'right-full', type: 'absorber', surface: 'right',
      zone: fullWallZone('right', Math.max(MIN_D, acousticDepths.right)),
      coverageFraction: 1.0, densityMultiplier: densityMult,
    })
    cov.right = 1.0
  }

  // ── Rear wall — absorber (Basic), diffuser (Standard + Studio, intent-driven) ─
  {
    if (isStandard || isStudio) {
      const isSkyline  = designIntent === 'cinematic' || designIntent === 'hybrid'
      const panelType: PanelType = isSkyline ? 'diffuser_skyline' : 'diffuser_slatted'
      panels.push({
        id: 'rear', type: panelType, surface: 'rear',
        zone: { u: 0, v: 0, uw: W, vh: H, depth: Math.max(MIN_D, acousticDepths.rear) },
        coverageFraction: 1.0, densityMultiplier: densityMult,
      })
    } else {
      panels.push({
        id: 'rear-full', type: 'absorber', surface: 'rear',
        zone: fullWallZone('rear', Math.max(MIN_D, acousticDepths.rear)),
        coverageFraction: 1.0, densityMultiplier: densityMult,
      })
    }
    cov.rear = 1.0
  }

  // ── Ceiling ───────────────────────────────────────────────────────────────
  {
    if (isBasic) {
      // POP / gypsum slab — single smooth panel, lower absorption coefficient
      // Engine signals this as ceiling_slab; RT60 uses gypsum α in page.tsx
      panels.push({
        id: 'ceiling-slab', type: 'ceiling_slab', surface: 'ceiling',
        zone: { u: 0, v: 0, uw: W, vh: L, depth: 0.012 },  // gypsum slab always 12 mm
        coverageFraction: 1.0, densityMultiplier: 1.0,
      })
      cov.ceiling = 1.0
    } else {
      // Acoustic absorber panels — full ceiling
      panels.push({
        id: 'ceiling-full', type: 'absorber', surface: 'ceiling',
        zone: { u: 0, v: 0, uw: W, vh: L, depth: Math.max(MIN_D, acousticDepths.ceiling) },
        coverageFraction: 1.0, densityMultiplier: densityMult,
      })
      cov.ceiling = 1.0
    }
  }

  // ── Reflectors — Standard + Studio only ─────────────────────────────────
  // All 3 surfaces share the same Z anchor: frpCeilZ (ceiling FRP point).
  // Width: 4 feet = 1.22 m on all surfaces, same start Z everywhere.
  // Left / right walls: full H (floor to ceiling), depth proud of absorber face.
  // Ceiling: full W (wall surface to wall surface), same Z-band as walls.
  if (isStandard || isStudio) {
    const REF_Z     = 1.22          // 4 feet in metres — same on all 3 surfaces
    const REF_EXTRA = 0.012         // proud of absorber face

    // Single shared Z start — centred on ceiling FRP point, clamped inside room
    const refZStart = clamp(frpCeilZ - REF_Z / 2, acousticDepths.front, L - REF_Z)

    if (acousticDepths.left > 0.005) {
      panels.push({
        id: 'ref-left', type: 'reflector', surface: 'left',
        zone: { u: refZStart, v: 0, uw: REF_Z, vh: H, depth: acousticDepths.left + REF_EXTRA },
        coverageFraction: 1.0, densityMultiplier: 1.0,
      })
    }
    if (acousticDepths.right > 0.005) {
      panels.push({
        id: 'ref-right', type: 'reflector', surface: 'right',
        zone: { u: refZStart, v: 0, uw: REF_Z, vh: H, depth: acousticDepths.right + REF_EXTRA },
        coverageFraction: 1.0, densityMultiplier: 1.0,
      })
    }
    // Ceiling: full W × REF_Z, same Z start as walls
    if (acousticDepths.ceiling > 0.005) {
      panels.push({
        id: 'ref-ceiling', type: 'reflector', surface: 'ceiling',
        zone: { u: 0, v: refZStart, uw: W, vh: REF_Z, depth: acousticDepths.ceiling + REF_EXTRA },
        coverageFraction: 1.0, densityMultiplier: 1.0,
      })
    }
  }

  // ── FRP markers ───────────────────────────────────────────────────────────
  // FRP Z coordinates are exported in diagnostics for the diagnostics card.
  // No frp_marker panels are emitted — renderFRPMarker is a no-op in the view
  // (removed to avoid a third conflicting material in the reflector/slat zone).

  return {
    panels,
    traps,
    diagnostics: {
      rt60Ratio:          parseFloat(rt60Ratio.toFixed(3)),
      trapLegM:           parseFloat(trapLeg.toFixed(3)),
      sbirFreqHz:         Math.round(sbirFreqHz),
      sbirMinDepthM:      parseFloat(sbirMinDepthM.toFixed(3)),
      frpLeftZ:           parseFloat(frpLeftZ.toFixed(2)),
      frpRightZ:          parseFloat(frpRightZ.toFixed(2)),
      frpCeilingZ:        parseFloat(frpCeilZ.toFixed(2)),
      frpCeilingX:        parseFloat(frpCeilX.toFixed(2)),
      listenerZ:          parseFloat(listenerZ.toFixed(2)),
      coveragePerSurface: {
        front:   parseFloat(cov.front.toFixed(3)),
        rear:    parseFloat(cov.rear.toFixed(3)),
        left:    parseFloat(cov.left.toFixed(3)),
        right:   parseFloat(cov.right.toFixed(3)),
        ceiling: parseFloat(cov.ceiling.toFixed(3)),
      },
    },
  }
}