'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Speaker } from '@/lib/engine/core/types'
import type { PanelLayout, PanelSurface, WallZone } from '@/lib/engine/acoustics/panelEngine'

export interface TheatreView3DProps {
  room:                  { width: number; length: number; height: number }
  acousticDepths:        { front: number; rear: number; left: number; right: number; ceiling: number }
  panelLayout:           PanelLayout
  screenWidth:           number
  screenHeight:          number
  screenBottomFromFloor: number
  displayType:           'projector' | 'display'
  throwDistance:         number
  mountType:             'inWall' | 'onWall'
  screenPlacement:       'behindScreen' | 'besideScreen'
  speakers:              Speaker[]
  extraSidePairs:        number
  extraCeilingPairs:     number
  subCount:              number
  subPlacement:          string
  subEnclosure:          'sealed' | 'ported'
  seatingRowCount:       number
  seatsPerRow:           number
  primaryRow:            number
  riserStepM:            number
  frontClearance:        number
  rowPitchM:             number
  usableWidth:           number
  viewPreset?:           { name: string; seq: number }
  designIntent:          string
  treatmentLevel:        string
  roomColorScheme:       string   // 'obsidian' | 'navy' | 'slate' | 'charcoal'
  wallConstruction:      string   // 'drywall' | 'concrete' | 'timber' | 'brick' | 'mixed'
  aisleConfig:           string   // 'none' | 'left' | 'center' | 'right' | 'both'
  aisleWidthM:           number   // metres
  lightingZones?:        Record<string, { enabled: boolean; fixtureType: string; colorTempK: number; dimmable: boolean }>
  lightingSceneBrightness?: { screenWash: number; ceilingCove: number; aisleStep: number; wallSconces: number; starCeiling: number; entryFoyer: number; equipmentRack: number }
}

// ── Ghost material — transparent back-face, singleton ─────────────────────────
const GHOST = new THREE.MeshStandardMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

// ── 16-combination material visibility matrix ─────────────────────────────────
// Keys: treatmentLevel × designIntent
// Values: which material categories render
type MatFlags = {
  absorbers: boolean; reflectors: boolean; diffusers: boolean
  bassTraps: boolean; slats: boolean; slatsCeiling: boolean; frp: boolean
}
const MATERIAL_MATRIX: Record<string, Record<string, MatFlags>> = {
  basic: {
    performance:{ absorbers:true,  reflectors:false, diffusers:false, bassTraps:false, slats:false, slatsCeiling:false, frp:false },
    balanced:   { absorbers:true,  reflectors:false, diffusers:false, bassTraps:false, slats:false, slatsCeiling:false, frp:false },
    luxury:     { absorbers:true,  reflectors:false, diffusers:false, bassTraps:false, slats:true,  slatsCeiling:false, frp:false },
  },
  medium: {
    performance:{ absorbers:true,  reflectors:true,  diffusers:true,  bassTraps:false, slats:false, slatsCeiling:false, frp:false },
    balanced:   { absorbers:true,  reflectors:true,  diffusers:true,  bassTraps:false, slats:false, slatsCeiling:false, frp:true  },
    luxury:     { absorbers:true,  reflectors:true,  diffusers:true,  bassTraps:false, slats:true,  slatsCeiling:false, frp:true  },
  },
  high: {
    performance:{ absorbers:true,  reflectors:true,  diffusers:true,  bassTraps:true,  slats:false, slatsCeiling:false, frp:false },
    balanced:   { absorbers:true,  reflectors:true,  diffusers:true,  bassTraps:true,  slats:false, slatsCeiling:false, frp:true  },
    luxury:     { absorbers:true,  reflectors:true,  diffusers:true,  bassTraps:true,  slats:true,  slatsCeiling:false, frp:true  },
  },
}
/** Safe lookup — falls back to all-false if level/intent not found */
function matFlags(level: string, intent: string): MatFlags {
  return MATERIAL_MATRIX[level]?.[intent] ?? {
    absorbers:false, reflectors:false, diffusers:false,
    bassTraps:false, slats:false, slatsCeiling:false, frp:false,
  }
}


// ── 4500K sRGB: R=255 G=219 B=186 = 0xFFDBBA ─────────────────────────────────
const K3500    = 0xFFDBBA
// ── Material factories ────────────────────────────────────────────────────────
// FrontSide on ALL room / treatment / AV / lighting surfaces → invisible from outside / back.
// Speakers and seats use THREE.DoubleSide — solid objects that must be visible from every angle.
const FS = THREE.FrontSide
const M = {
  // Room surfaces
  wall:        () => new THREE.MeshStandardMaterial({ color: 0x1e2535, roughness: 0.88, metalness: 0.02, side: FS }),
  floor:       () => new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.96, metalness: 0.00, side: FS }),
  ceiling:     () => new THREE.MeshStandardMaterial({ color: 0x161d2c, roughness: 0.90, metalness: 0.00, side: FS }),
  // Treatment — absorbers
  absorber:    () => new THREE.MeshStandardMaterial({ color: 0x1e2a3a, roughness: 0.97, metalness: 0.00, side: FS }),
  absorberAlt: () => new THREE.MeshStandardMaterial({ color: 0x222e3e, roughness: 0.96, metalness: 0.00, side: FS }),
  // Treatment — bass trap
  bassTrap:    () => new THREE.MeshStandardMaterial({ color: 0x141c28, roughness: 0.98, metalness: 0.00, side: FS }),
  // Treatment — diffuser wood
  diffBase:    () => new THREE.MeshStandardMaterial({ color: 0x2c2016, roughness: 0.72, metalness: 0.00, side: FS }),
  diffBlock:   () => new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 0.65, metalness: 0.02, side: FS }),
  diffFin:     () => new THREE.MeshStandardMaterial({ color: 0x362a1a, roughness: 0.68, metalness: 0.01, side: FS }),
  // Floor carpet
  carpet:      () => new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.98, metalness: 0.00, side: FS }),
  // A/V surfaces
  screen:      () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xd8e8ff), emissiveIntensity: 0.55, roughness: 0.95, metalness: 0.00, side: FS }),
  screenFrame: () => new THREE.MeshStandardMaterial({ color: 0x080b12, roughness: 0.80, metalness: 0.18, side: FS }),
  // Speaker parts — DoubleSide: solid cabinets must be fully visible from every angle
  cabinet:     () => new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.78, metalness: 0.14, side: THREE.DoubleSide }),
  baffle:      () => new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.82, metalness: 0.06, side: THREE.DoubleSide }),
  driver:      () => new THREE.MeshStandardMaterial({ color: 0x1e2a3c, roughness: 0.48, metalness: 0.42, side: THREE.DoubleSide }),
  driverCone:  () => new THREE.MeshStandardMaterial({ color: 0x252f40, roughness: 0.58, metalness: 0.22, side: THREE.DoubleSide }),
  tweeter:     () => new THREE.MeshStandardMaterial({ color: 0x2e3f56, roughness: 0.28, metalness: 0.65, side: THREE.DoubleSide }),
  // Seat parts — DoubleSide: seat geometry must be fully visible from every angle
  seat:        () => new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.90, metalness: 0.00, side: THREE.DoubleSide }),
  seatLegs:    () => new THREE.MeshStandardMaterial({ color: 0x10161e, roughness: 0.68, metalness: 0.32, side: THREE.DoubleSide }),
  // Riser, projector, lighting
  riser:       () => new THREE.MeshStandardMaterial({ color: 0x131a26, roughness: 0.84, metalness: 0.00, side: FS }),
  projector:   () => new THREE.MeshStandardMaterial({ color: 0x1c2030, roughness: 0.58, metalness: 0.42, side: FS }),
  cob:         () => new THREE.MeshStandardMaterial({ color: K3500, emissive: new THREE.Color(K3500), emissiveIntensity: 2.8, roughness: 0.3, metalness: 0.6, side: FS }),
  cobHousing:  () => new THREE.MeshStandardMaterial({ color: 0x1c2232, roughness: 0.5,  metalness: 0.55, side: FS }),
  ledStrip:    () => new THREE.MeshStandardMaterial({ color: K3500, emissive: new THREE.Color(K3500), emissiveIntensity: 2.4, roughness: 0.4, metalness: 0.1, side: FS }),
  ledChannel:  () => new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.4,  metalness: 0.70, side: FS }),
}

// ── Per-face ghost helper — still used for carpet slabs ───────────────────────
type Facing = 'x'|'-x'|'y'|'-y'|'z'|'-z'
const BACK_IDX: Record<Facing, number> = { 'x':1, '-x':0, 'y':3, '-y':2, 'z':5, '-z':4 }
function boxMats(mat: THREE.Material, backFacing: Facing): THREE.Material[] {
  return [0,1,2,3,4,5].map(i => i === BACK_IDX[backFacing] ? GHOST : mat)
}

// Three.js BoxGeometry material face order: 0=+X  1=-X  2=+Y  3=-Y  4=+Z  5=-Z
// For each room surface, the ONE face index that points INTO the room interior.
// All 5 other faces are GHOST → invisible from outside and from any external camera angle.
const ROOM_FACE: Record<string, number> = {
  front:   4,   // +Z  points toward rear  (interior)
  rear:    5,   // -Z  points toward front (interior)
  left:    0,   // +X  points toward right (interior)
  right:   1,   // -X  points toward left  (interior)
  ceiling: 3,   // -Y  points downward     (interior)
}
/** Only the single room-facing face of this surface renders; all 5 others are GHOST. */
function surfaceMats(mat: THREE.Material, surface: string): THREE.Material[] {
  const vis = ROOM_FACE[surface] ?? -1
  return [0,1,2,3,4,5].map(i => i === vis ? mat : GHOST)
}
// ── World-space absorber panel renderer ──────────────────────────────────────
// All surfaces: solid FrontSide tiles — visible from inside room only.
// FrontSide = naturally invisible from outside/behind — no extra transparency needed.
function renderAbsorberGrid(
  zone: WallZone, surface: PanelSurface,
  W: number, _L: number, H: number,
  L: number,
  density: number, scene: THREE.Scene,
  overrideMat?: THREE.Material,
) {
  if (zone.depth < 0.005 || zone.uw < 0.05 || zone.vh < 0.05) return
  const TILE = 1.16 / Math.sqrt(density)
  const GAP  = 0
  const cols = Math.max(1, Math.round(zone.uw / (TILE + GAP)))
  const rows = Math.max(1, Math.round(zone.vh / (TILE + GAP)))
  const tW   = (zone.uw - (cols - 1) * GAP) / cols
  const tH   = (zone.vh - (rows - 1) * GAP) / rows
  const mat      = overrideMat ?? M.absorber()
  const tileMats = surfaceMats(mat, surface)

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const u = zone.u + c * (tW + GAP) + tW / 2
      const v = zone.v + r * (tH + GAP) + tH / 2
      let cx: number, cy: number, cz: number
      let bx: number, by: number, bz: number
      switch (surface) {
        case 'front':  cx=u;              cy=v;              cz=zone.depth/2;     bx=tW; by=tH; bz=zone.depth; break
        case 'rear':   cx=u;              cy=v;              cz=L-zone.depth/2;   bx=tW; by=tH; bz=zone.depth; break
        case 'left':   cx=zone.depth/2;   cy=v;              cz=u;                bx=zone.depth; by=tH; bz=tW;  break
        case 'right':  cx=W-zone.depth/2; cy=v;              cz=u;                bx=zone.depth; by=tH; bz=tW;  break
        case 'ceiling':cx=u;              cy=H-zone.depth/2; cz=v;                bx=tW; by=zone.depth; bz=tH;  break
        default: continue
      }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bx, by, bz), tileMats)
      mesh.position.set(cx, cy, cz)
      scene.add(mesh)
    }
  }
}

// ── Bass trap — solid triangular prism, FrontSide (invisible from outside) ────
function makeBassTrapMesh(
  cx: number, cz: number,
  ex: number, ez: number,
  H:  number,
): THREE.Mesh {
  const verts = new Float32Array([
    cx, 0, cz,   ex, 0, cz,   cx, 0, ez,
    cx, H, cz,   ex, H, cz,   cx, H, ez,
  ])
  const idx = new Uint16Array([
    0,1,2,  3,5,4,
    0,4,1,  0,3,4,
    0,2,5,  0,5,3,
    1,4,5,  1,5,2,
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return new THREE.Mesh(geo,
    new THREE.MeshStandardMaterial({ color: 0x141c28, roughness: 0.98, metalness: 0.00, side: THREE.FrontSide })
  )
}

// ── Speaker cabinet ───────────────────────────────────────────────────────────
function makeSpeaker(channel: string, enclosure: 'sealed' | 'ported' = 'sealed'): THREE.Group {
  const g     = new THREE.Group()
  const isSub = channel === 'SUB'
  const isCeil = /^T(FL|FR|ML|MR|RL|RR)$/.test(channel)
  const BW = isSub ? 0.38 : 0.22
  const BH = isSub ? 0.38 : (isCeil ? 0.16 : 0.36)
  const BD = isSub ? 0.38 : 0.24
  g.add(new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), M.cabinet()))
  const baffle = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.01, BH - 0.01, 0.015), M.baffle())
  baffle.position.z = BD / 2 + 0.004
  g.add(baffle)
  const wW     = isSub ? 0.14 : (isCeil ? 0.055 : 0.07)
  const woofer = new THREE.Mesh(new THREE.CylinderGeometry(wW, wW * 0.7, 0.018, 24), M.driver())
  woofer.rotation.x = Math.PI / 2
  woofer.position.set(0, isCeil ? 0 : (isSub ? 0 : BH * 0.18), BD / 2 + 0.016)
  g.add(woofer)
  const cone = new THREE.Mesh(new THREE.TorusGeometry(wW * 0.85, wW * 0.06, 6, 24), M.driverCone())
  cone.rotation.x = Math.PI / 2
  cone.position.copy(woofer.position)
  cone.position.z += 0.005
  g.add(cone)
  if (!isSub && !isCeil) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.012, 16), M.tweeter())
    tw.rotation.x = Math.PI / 2; tw.position.set(0, BH * 0.28, BD / 2 + 0.016); g.add(tw)
    const twRing = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 5, 16), M.driver())
    twRing.rotation.x = Math.PI / 2; twRing.position.copy(tw.position); twRing.position.z += 0.003; g.add(twRing)
  }
  if (enclosure === 'ported') {
    const pR  = isSub ? 0.038 : 0.018
    const port = new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.012, 12), M.baffle())
    port.rotation.x = Math.PI / 2
    port.position.set(isSub ? 0.08 : 0, isSub ? -BH * 0.25 : -BH * 0.3, BD / 2 + 0.01)
    g.add(port)
  }
  return g
}

// ── Cinema seat ───────────────────────────────────────────────────────────────
function makeSeat(seatMat?: THREE.Material, legsMat?: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const sm = seatMat ?? M.seat()
  const lm = legsMat ?? M.seatLegs()
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.52), lm)
  base.position.set(0, 0.03, 0); g.add(base)
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.48), sm)
  cushion.position.set(0, 0.095, 0); cushion.rotation.x = -0.12; g.add(cushion)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.44), lm)
    arm.position.set(side * 0.30, 0.14, 0); g.add(arm)
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.66, 0.08), sm)
  back.rotation.x = 0.32; back.position.set(0, 0.47, -0.21); g.add(back)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.10), sm)
  head.rotation.x = 0.32; head.position.set(0, 0.80, -0.29); g.add(head)
  const legrest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.12), lm)
  legrest.position.set(0, 0.025, 0.28); g.add(legrest)
  return g
}

// ── Projector ─────────────────────────────────────────────────────────────────
function makeProjector(): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.28), M.projector()))
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.08, 20), M.driver())
  lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, -0.18); g.add(lens)
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.18), M.baffle())
  vent.position.set(0, 0.082, 0); g.add(vent)
  return g
}

// ── COB downlight ─────────────────────────────────────────────────────────────
function makeCOB(lightColor: number = 0xFFDBBA): THREE.Group {
  const g = new THREE.Group()
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.04, 20), M.cobHousing())
  housing.position.y = -0.02; g.add(housing)
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 20),
    new THREE.MeshStandardMaterial({ color: lightColor, emissive: new THREE.Color(lightColor), emissiveIntensity: 2.8, roughness: 0.3, metalness: 0.6, side: THREE.FrontSide }))
  face.position.y = -0.025; g.add(face)
  const reflector = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.028, 20, 1, true), M.cobHousing())
  reflector.position.y = -0.014; g.add(reflector)
  return g
}

// ── LED profile strip ─────────────────────────────────────────────────────────
function makeLEDProfile(length: number, axis: 'x' | 'z', lightColor: number = 0xFFDBBA): THREE.Group {
  const g = new THREE.Group()
  const channelGeo = axis === 'x'
    ? new THREE.BoxGeometry(length, 0.022, 0.018)
    : new THREE.BoxGeometry(0.018, 0.022, length)
  g.add(new THREE.Mesh(channelGeo, M.ledChannel()))
  const stripGeo = axis === 'x'
    ? new THREE.BoxGeometry(length - 0.02, 0.008, 0.010)
    : new THREE.BoxGeometry(0.010, 0.008, length - 0.02)
  const strip = new THREE.Mesh(stripGeo,
    new THREE.MeshStandardMaterial({ color: lightColor, emissive: new THREE.Color(lightColor), emissiveIntensity: 2.4, roughness: 0.4, metalness: 0.1, side: THREE.FrontSide }))
  strip.position.y = 0.007; g.add(strip)
  return g
}

// ── View presets ──────────────────────────────────────────────────────────────
type PresetDef = { theta: number; phi: number; radiusFn: (W: number, L: number, H: number) => number }
const VIEW_PRESETS: Record<string, PresetDef> = {
  screen:  { theta: 0,             phi: Math.PI / 2, radiusFn: (_W, L)    => L * 0.32 },
  back:    { theta: Math.PI,       phi: Math.PI / 2, radiusFn: (_W, L)    => L * 0.32 },
  left:    { theta: Math.PI / 2,   phi: Math.PI / 2, radiusFn: (W)        => W * 0.32 },
  right:   { theta: -Math.PI / 2,  phi: Math.PI / 2, radiusFn: (W)        => W * 0.32 },
  floor:   { theta: 0, phi: 0.15,  radiusFn: (_W, _L, H) => Math.max(0.5, (H * 0.60 - 0.12) / Math.cos(0.15)) },
  ceiling: { theta: 0, phi: Math.PI - 0.15, radiusFn: (_W, _L, H) => Math.max(0.5, (H * 0.40 - 0.12) / Math.cos(0.15)) },
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TheatreView3D(props: TheatreView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const orbitRef     = useRef({ theta: 0, phi: Math.PI * 0.30, radius: 10 })
  const updateCamRef = useRef<() => void>(() => {})

  // Preset watcher
  useEffect(() => {
    const preset = props.viewPreset
    if (!preset?.name) return
    const vp = VIEW_PRESETS[preset.name]
    if (!vp) return
    const { width: W, length: L, height: H } = props.room
    orbitRef.current.theta  = vp.theta
    orbitRef.current.phi    = vp.phi
    orbitRef.current.radius = vp.radiusFn(W, L, H)
    updateCamRef.current()
  }, [props.viewPreset?.seq]) // eslint-disable-line react-hooks/exhaustive-deps

  // Main scene effect
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // No room yet — render nothing. page.tsx shows a placeholder instead.
    const _W = props.room.width, _L = props.room.length, _H = props.room.height
    if (_W < 0.5 || _L < 0.5 || _H < 0.5) return

    const {
      room, acousticDepths, panelLayout,
      screenWidth, screenHeight, screenBottomFromFloor,
      displayType, throwDistance, mountType, screenPlacement,
      speakers, extraSidePairs, extraCeilingPairs,
      subCount, subPlacement, subEnclosure,
      seatingRowCount, seatsPerRow, riserStepM,
      primaryRow, rowPitchM, usableWidth,
      designIntent, treatmentLevel,
      aisleConfig = 'none', aisleWidthM: aisleW = 0,
      lightingZones, lightingSceneBrightness,
    } = props

    // ── Room colour scheme ────────────────────────────────────────────────────
    // User picks one of 5 colour themes from the Room Inputs panel.
    const COLOR_SCHEMES: Record<string, {
      wall: number; absorber: number; seat: number; legs: number; floor: number
      diffBase: number; diffBlock: number; diffFin: number; frpAccent: number
    }> = {
      obsidian: {                            // Acoustic Black — stretched Guilford-of-Maine fabric
        wall: 0x111418, absorber: 0x181d22, seat: 0x16191e, legs: 0x0c0e10,
        floor: 0x0a0c0e,
        diffBase: 0x131619, diffBlock: 0x1c2025, diffFin: 0x171b1f,
        frpAccent: 0x102840,
      },
      navy: {                                // Midnight Velvet — deep cinema velvet
        wall: 0x0c1a35, absorber: 0x112244, seat: 0x132848, legs: 0x091428,
        floor: 0x080f1e,
        diffBase: 0x0e1c38, diffBlock: 0x162848, diffFin: 0x12223e,
        frpAccent: 0x1a3d70,
      },
      slate: {                               // Slate Stone — quarried cool blue-grey
        wall: 0x2c3640, absorber: 0x35404c, seat: 0x323d48, legs: 0x1e2830,
        floor: 0x1a2028,
        diffBase: 0x2a3438, diffBlock: 0x3a464e, diffFin: 0x323e46,
        frpAccent: 0x3a5068,
      },
      charcoal: {                            // Carbon Felt — acoustic felt panel material
        wall: 0x252525, absorber: 0x2e2e2e, seat: 0x2a2a2a, legs: 0x181818,
        floor: 0x141414,
        diffBase: 0x222222, diffBlock: 0x323232, diffFin: 0x2c2c2c,
        frpAccent: 0x303848,
      },
    }
    const cs = COLOR_SCHEMES[props.roomColorScheme] ?? COLOR_SCHEMES.obsidian

    // Light temperature — derived from lighting zones (average of enabled zones) or fallback
    const kelvinToHex = (k: number): number => {
      // Approximate blackbody color for 2000K–7000K range
      const t = k / 100
      let r: number, g: number, b: number
      if (t <= 66) { r = 255; g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(t) - 161.1195681661)); b = t <= 19 ? 0 : Math.min(255, Math.max(0, 138.5177312231 * Math.log(t - 10) - 305.0447927307)) }
      else { r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(t - 60, -0.1332047592))); g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(t - 60, -0.0755148492))); b = 255 }
      return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
    }
    type LZone = { enabled: boolean; fixtureType: string; colorTempK: number; dimmable: boolean }
    const lz: Record<string, LZone> = lightingZones ?? {}
    const lb = lightingSceneBrightness ?? { screenWash: 30, ceilingCove: 50, aisleStep: 20, wallSconces: 0, starCeiling: 0, entryFoyer: 30, equipmentRack: 20 }
    // Compute weighted average color temp from enabled zones
    const enabledZoneEntries = Object.entries(lz).filter(([, z]) => z.enabled)
    const avgKelvin = enabledZoneEntries.length > 0
      ? enabledZoneEntries.reduce((sum, [, z]) => sum + z.colorTempK, 0) / enabledZoneEntries.length
      : 4000
    const lightKFromZones = kelvinToHex(avgKelvin)
    const lightKDimFromZones = kelvinToHex(Math.min(7000, avgKelvin + 400))
    const LIGHT_K_FALLBACK = { k: 0xFFECD0, dim: 0xFFF0DC }
    const lk = enabledZoneEntries.length > 0 ? { k: lightKFromZones, dim: lightKDimFromZones } : LIGHT_K_FALLBACK

    const absorberMat = new THREE.MeshStandardMaterial({ color: cs.absorber, roughness: 0.97, metalness: 0.00, side: THREE.FrontSide })
    // Treated walls always use colour-scheme base
    const wallMat = new THREE.MeshStandardMaterial({ color: cs.wall, roughness: 0.88, metalness: 0.02, side: THREE.FrontSide })
    const seatMat     = new THREE.MeshStandardMaterial({ color: cs.seat,     roughness: 0.92, metalness: 0.00, side: THREE.DoubleSide })
    const legsMatT    = new THREE.MeshStandardMaterial({ color: cs.legs,     roughness: 0.68, metalness: 0.32, side: THREE.DoubleSide })
    const floorMat    = new THREE.MeshStandardMaterial({ color: cs.floor,    roughness: 0.98, metalness: 0.00, side: THREE.FrontSide })
    const lightK      = lk.k
    const lightKDim   = lk.dim
    const isLuxury    = designIntent === 'luxury'
    // ── Matrix flags for this combination ───────────────────────────────────
    const mf = matFlags(treatmentLevel, designIntent)

    const diffPal = { diffBase: cs.diffBase, diffBlock: cs.diffBlock, diffFin: cs.diffFin }


    // ── Depth shortcuts — used by both lights and panel placement ─────────────
    const dFront   = acousticDepths.front
    const dRear    = acousticDepths.rear
    const dLeft    = acousticDepths.left
    const dRight   = acousticDepths.right
    const dCeiling = acousticDepths.ceiling

    // ── Gypsum / POP ceiling slab renderer — solid FrontSide ────────────────────
    const renderGypsumCeiling = (zone: WallZone): void => {
      const gypsumMat = new THREE.MeshStandardMaterial({
        color: 0x2a3044, roughness: 0.42, metalness: 0.02, side: THREE.FrontSide,
      })
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(zone.uw, zone.depth, zone.vh),
        surfaceMats(gypsumMat, 'ceiling'),
      )
      mesh.position.set(zone.u + zone.uw / 2, H - zone.depth / 2, zone.v + zone.vh / 2)
      scene.add(mesh)
    }

    // ── Reflector material — hard MDF/wood, specular satin ──────────────────────
    const reflectorMat = new THREE.MeshStandardMaterial({
      color: 0x8B6914, roughness: 0.18, metalness: 0.06, side: THREE.FrontSide,
    })

    // ── Reflector renderer — solid hard panel, same geometry as absorber ──────
    const renderReflector = (zone: WallZone, surface: PanelSurface): void => {
      let mesh: THREE.Mesh
      const tileCount = Math.max(1, Math.round(zone.uw / 0.60))  // ~600mm MDF panels
      const tW = zone.uw / tileCount

      if (surface === 'left') {
        for (let i = 0; i < tileCount; i++) {
          const panelZ = zone.u + i * tW + tW / 2
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(zone.depth, zone.vh, tW * 0.97),
            surfaceMats(reflectorMat, 'left')
          )
          mesh.position.set(zone.depth / 2, zone.v + zone.vh / 2, panelZ)
          scene.add(mesh)
        }
      } else if (surface === 'right') {
        for (let i = 0; i < tileCount; i++) {
          const panelZ = zone.u + i * tW + tW / 2
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(zone.depth, zone.vh, tW * 0.97),
            surfaceMats(reflectorMat, 'right')
          )
          mesh.position.set(W - zone.depth / 2, zone.v + zone.vh / 2, panelZ)
          scene.add(mesh)
        }
      } else if (surface === 'ceiling') {
        // Ceiling: zone.uw = full W, zone.vh = REF_Z (4 ft along Z)
        // Tile along Z only (~600mm MDF strips), full W as one unbroken span per strip
        const zTiles = Math.max(1, Math.round(zone.vh / 0.60))
        const tZ = zone.vh / zTiles
        for (let zi = 0; zi < zTiles; zi++) {
          const panelZ = zone.v + zi * tZ + tZ / 2
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(zone.uw, zone.depth, tZ * 0.97),
            surfaceMats(reflectorMat, 'ceiling')
          )
          mesh.position.set(zone.u + zone.uw / 2, H - zone.depth / 2, panelZ)
          scene.add(mesh)
        }
      }
    }

    // ── FRP marker renderer ───────────────────────────────────────────────────
    // FRP data is shown in the diagnostics panel only — no 3D geometry rendered.
    // Rendering was removed: the blue accent strips conflicted visually with
    // reflectors and wooden slats (only 2 materials should appear in that zone).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderFRPMarker = (_zone: WallZone, _surface: PanelSurface): void => { /* no-op — FRP shown in diagnostics panel only */ }

    // ── Luxury brass trim — 4 thin strips framing each absorber zone ──────────
    const addLuxuryTrim = (zone: WallZone, surface: PanelSurface): void => {
      const TW   = 0.014
      const TD   = zone.depth + 0.003
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xb8960c, roughness: 0.22, metalness: 0.78, side: THREE.FrontSide,
      })
      const brassMats = surfaceMats(brassMat, surface)   // only room-facing face visible
      const addStrip = (cx: number, cy: number, cz: number, bx: number, by: number, bz: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bx, by, bz), brassMats)
        m.position.set(cx, cy, cz); scene.add(m)
      }
      if (surface === 'left') {
        const x = TD / 2
        addStrip(x, zone.v + TW/2,           zone.u + zone.uw/2, TD, TW, zone.uw)  // bottom
        addStrip(x, zone.v + zone.vh - TW/2, zone.u + zone.uw/2, TD, TW, zone.uw)  // top
        addStrip(x, zone.v + zone.vh/2, zone.u + TW/2,          TD, zone.vh, TW)   // front
        addStrip(x, zone.v + zone.vh/2, zone.u + zone.uw - TW/2, TD, zone.vh, TW)  // back
      } else if (surface === 'right') {
        const x = W - TD / 2
        addStrip(x, zone.v + TW/2,           zone.u + zone.uw/2, TD, TW, zone.uw)
        addStrip(x, zone.v + zone.vh - TW/2, zone.u + zone.uw/2, TD, TW, zone.uw)
        addStrip(x, zone.v + zone.vh/2, zone.u + TW/2,          TD, zone.vh, TW)
        addStrip(x, zone.v + zone.vh/2, zone.u + zone.uw - TW/2, TD, zone.vh, TW)
      } else if (surface === 'front') {
        const z = TD / 2
        addStrip(zone.u + TW/2,           zone.v + zone.vh/2, z, TW, zone.vh, TD)
        addStrip(zone.u + zone.uw - TW/2, zone.v + zone.vh/2, z, TW, zone.vh, TD)
        addStrip(zone.u + zone.uw/2, zone.v + TW/2,           z, zone.uw, TW, TD)
        addStrip(zone.u + zone.uw/2, zone.v + zone.vh - TW/2, z, zone.uw, TW, TD)
      } else if (surface === 'rear') {
        const z = L - TD / 2
        addStrip(zone.u + TW/2,           zone.v + zone.vh/2, z, TW, zone.vh, TD)
        addStrip(zone.u + zone.uw - TW/2, zone.v + zone.vh/2, z, TW, zone.vh, TD)
        addStrip(zone.u + zone.uw/2, zone.v + TW/2,           z, zone.uw, TW, TD)
        addStrip(zone.u + zone.uw/2, zone.v + zone.vh - TW/2, z, zone.uw, TW, TD)
      }
    }

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(container.clientWidth, container.clientHeight)
    const rAny = renderer as unknown as Record<string, unknown>
    if ('outputColorSpace' in rAny)    rAny['outputColorSpace'] = 'srgb'   // THREE.SRGBColorSpace
    else if ('outputEncoding' in rAny) rAny['outputEncoding']   = 3001     // THREE.sRGBEncoding (r128)
    renderer.toneMapping         = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.30
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xd9dadb)
    scene.fog        = new THREE.FogExp2(0xd9dadb, 0.018)

    const W = room.width, L = room.length, H = room.height
    const cx = W / 2, cy = H * 0.40, cz = L / 2

    // Camera
    const camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.05, 120)
    const camTarget = new THREE.Vector3(cx, cy, cz)
    // Camera position is NEVER reset by the system.
    // Persists across all prop changes (room resize, treatment updates, etc.).
    // Only user drag/scroll and preset buttons move the camera.
    // On first mount, radius is still 0 — initialise once only.
    if (orbitRef.current.radius === 0) {
      orbitRef.current.radius = Math.max(W, L) * 1.75
    }

    const updateCamera = () => {
      const { theta, phi, radius } = orbitRef.current
      camera.position.set(
        camTarget.x + radius * Math.sin(phi) * Math.sin(theta),
        camTarget.y + radius * Math.cos(phi),
        camTarget.z + radius * Math.sin(phi) * Math.cos(theta),
      )
      camera.lookAt(camTarget)
    }
    updateCamRef.current = updateCamera
    updateCamera()

    // ── Lighting — driven by Lighting Design tab zones + scene brightness ──
    // Zone → 3D fixture mapping:
    //   screenWash    → bias light behind screen (PointLight)
    //   ceilingCove   → LED perimeter cove strips + COB downlights
    //   aisleStep     → step lights recessed into risers
    //   wallSconces   → mid-wall LED profile strips / sconce point lights
    //   starCeiling   → ceiling spine LED profiles
    //   entryFoyer    → rear-wall accent wash + entry area lighting
    //   equipmentRack → front-wall task light near equipment zone

    // Keep intent flags for architectural geometry (pilasters, reveals, etc.) only
    const isCinematic   = designIntent === 'balanced'

    // Helper: zone brightness (0–1) from active scene preset
    const zBri = (zone: string): number => {
      const val = (lb as Record<string, number>)[zone] ?? 0
      return val / 100
    }
    // Helper: zone color as hex
    const zCol = (zone: string): number => {
      const z = lz[zone]
      return z ? kelvinToHex(z.colorTempK) : lightK
    }
    // Helper: is zone active (enabled + brightness > 0)
    const zOn = (zone: string): boolean => {
      return !!(lz[zone]?.enabled && zBri(zone) > 0.01)
    }

    // Overall scene brightness — average of all active zones for ambient
    const totalBri = enabledZoneEntries.length > 0
      ? enabledZoneEntries.reduce((sum, [key]) => sum + zBri(key), 0) / enabledZoneEntries.length
      : 0.4 // fallback: moderate ambient

    // Ambient + hemisphere — scales with overall scene brightness
    scene.add(new THREE.AmbientLight(lightKDim, 0.6 + totalBri * 1.8))
    scene.add(new THREE.HemisphereLight(lightK, 0x0d1020, 0.5 + totalBri * 1.2))

    // Key light — neutral overhead, intensity scales with scene
    const keyLight = new THREE.DirectionalLight(lightK, 1.0 + totalBri * 2.0)
    keyLight.position.set(cx, H * 3.5, cz - L * 0.2)
    scene.add(keyLight)

    // Fill light — softer, from rear
    const fillLight = new THREE.DirectionalLight(lightKDim, 0.5 + totalBri * 1.2)
    fillLight.position.set(cx - W * 0.4, H * 2.0, L * 1.5)
    scene.add(fillLight)

    // ── SCREEN WASH ZONE → screen glow bias light ──
    if (zOn('screenWash')) {
      const swCol = zCol('screenWash')
      const swBri = zBri('screenWash')
      const screenGlow = new THREE.PointLight(swCol, swBri * 5.0, L * 1.2, 1.4)
      screenGlow.position.set(cx, screenBottomFromFloor + screenHeight * 0.5, acousticDepths.front + 0.6)
      scene.add(screenGlow)
    }

    // ── CEILING COVE ZONE → perimeter LED cove + COB downlights ──
    const cobCeilingY = H - dCeiling - 0.02
    if (zOn('ceilingCove')) {
      const ccCol = zCol('ceilingCove')
      const ccBri = zBri('ceilingCove')

      // COB downlights
      const cobCols    = Math.max(3, Math.round(L / 1.6))
      const cobXPairs  = [W * 0.27, W * 0.73]
      const cobIntensity = ccBri * 4.5
      const cobRange   = 5.5
      for (const cobX of cobXPairs) {
        for (let c = 0; c < cobCols; c++) {
          const cobZ = (c + 0.5) * (L / cobCols)
          const cob = makeCOB(ccCol); cob.position.set(cobX, cobCeilingY, cobZ); scene.add(cob)
          const pl = new THREE.PointLight(ccCol, cobIntensity, cobRange, 1.5)
          pl.position.set(cobX, cobCeilingY - 0.06, cobZ); scene.add(pl)
        }
      }

      // Perimeter LED cove strips
      {
        const ledY   = H - dCeiling - 0.014
        const ledInF = Math.max(0.04, dFront + 0.01)
        const ledInR = Math.max(0.04, dRear  + 0.01)
        const ledInL = Math.max(0.04, dLeft  + 0.01)
        const ledInRt= Math.max(0.04, dRight + 0.01)
        const coveInt   = ccBri * 2.8
        const coveRange = W * 1.4
        const addCove = (prof: THREE.Group, plPos: THREE.Vector3, intensity: number, range: number) => {
          scene.add(prof)
          const pl = new THREE.PointLight(ccCol, intensity, range, 1.4)
          pl.position.copy(plPos); scene.add(pl)
        }
        const lfP = makeLEDProfile(W - ledInL - ledInRt, 'x', ccCol); lfP.position.set(cx, ledY, ledInF + 0.01)
        addCove(lfP, new THREE.Vector3(cx, ledY - 0.04, ledInF + 0.02), coveInt, coveRange)
        const lrP = makeLEDProfile(W - ledInL - ledInRt, 'x', ccCol); lrP.position.set(cx, ledY, L - ledInR - 0.01)
        addCove(lrP, new THREE.Vector3(cx, ledY - 0.04, L - ledInR - 0.02), coveInt, coveRange)
        const llP = makeLEDProfile(L - ledInF - ledInR, 'z', ccCol); llP.position.set(ledInL + 0.01, ledY, cz)
        addCove(llP, new THREE.Vector3(ledInL + 0.02, ledY - 0.04, cz), coveInt * 0.9, L * 0.95)
        const lrightP = makeLEDProfile(L - ledInF - ledInR, 'z', ccCol); lrightP.position.set(W - ledInRt - 0.01, ledY, cz)
        addCove(lrightP, new THREE.Vector3(W - ledInRt - 0.02, ledY - 0.04, cz), coveInt * 0.9, L * 0.95)
      }
    }

    // ── WALL SCONCES ZONE → mid-wall LED profiles / sconce point lights ──
    if (zOn('wallSconces')) {
      const wsCol = zCol('wallSconces')
      const wsBri = zBri('wallSconces')
      const profY    = H * 0.48
      const profSegs = Math.min(4, Math.max(2, Math.round(L / 2.5)))
      const profInt  = wsBri * 2.8
      const profRange= 5.5
      for (let seg = 0; seg < profSegs; seg++) {
        const segZ = (seg + 0.5) * (L / profSegs)
        const xL = dLeft + 0.018, xR = W - dRight - 0.018
        const plL = makeLEDProfile(L / profSegs * 0.82, 'z', wsCol); plL.position.set(xL, profY, segZ); scene.add(plL)
        const pll = new THREE.PointLight(wsCol, profInt, profRange, 1.6); pll.position.set(xL + 0.06, profY, segZ); scene.add(pll)
        const plR = makeLEDProfile(L / profSegs * 0.82, 'z', wsCol); plR.position.set(xR, profY, segZ); scene.add(plR)
        const plr = new THREE.PointLight(wsCol, profInt, profRange, 1.6); plr.position.set(xR - 0.06, profY, segZ); scene.add(plr)
      }
    }

    // ── STAR CEILING ZONE → ceiling spine LED strips ──
    if (zOn('starCeiling')) {
      const scCol = zCol('starCeiling')
      const scBri = zBri('starCeiling')
      const spineSegs = Math.min(4, Math.max(2, Math.round(L / 2.2)))
      const spineY    = H - dCeiling - 0.013
      const spineInt  = scBri * 2.2
      for (let seg = 0; seg < spineSegs; seg++) {
        const segZ = (seg + 0.5) * (L / spineSegs)
        const spine = makeLEDProfile(L / spineSegs * 0.80, 'z', scCol); spine.position.set(cx, spineY, segZ); scene.add(spine)
        const sPL = new THREE.PointLight(scCol, spineInt, 3.8, 1.5); sPL.position.set(cx, spineY - 0.05, segZ); scene.add(sPL)
      }
    }

    // ── ENTRY / FOYER ZONE → rear-wall accent wash ──
    if (zOn('entryFoyer')) {
      const efCol = zCol('entryFoyer')
      const efBri = zBri('entryFoyer')
      {
        const rearAccent = new THREE.PointLight(efCol, efBri * 4.5, W * 1.0, 1.5)
        rearAccent.position.set(cx, H * 0.62, L - dRear - 0.18); scene.add(rearAccent)
        const rw2 = new THREE.PointLight(efCol, efBri * 2.5, W * 0.9, 1.6)
        rw2.position.set(W * 0.25, H * 0.45, L - dRear - 0.15); scene.add(rw2)
        const rw3 = new THREE.PointLight(efCol, efBri * 2.5, W * 0.9, 1.6)
        rw3.position.set(W * 0.75, H * 0.45, L - dRear - 0.15); scene.add(rw3)
      }
    }

    // ── AISLE / STEP ZONE → recessed step lights at each riser face ──
    if (zOn('aisleStep') && seatingRowCount > 1) {
      const asCol = zCol('aisleStep')
      const asBri = zBri('aisleStep')
      const SIDE_CLR = (W - usableWidth) / 2
      for (let row = 1; row < seatingRowCount; row++) {
        const rH = (seatingRowCount - 1 - row) * riserStepM
        // matches seatingRearZ = L - dRear - rowPitchM/2 (row centre, not back edge)
        const rowZ = (L - acousticDepths.rear - rowPitchM / 2) - row * rowPitchM
        // Two small step lights per riser face (left and right of center)
        const sL = new THREE.PointLight(asCol, asBri * 1.5, 2.0, 2.2)
        sL.position.set(SIDE_CLR + usableWidth * 0.25, rH + 0.05, rowZ + 0.02); scene.add(sL)
        const sR = new THREE.PointLight(asCol, asBri * 1.5, 2.0, 2.2)
        sR.position.set(SIDE_CLR + usableWidth * 0.75, rH + 0.05, rowZ + 0.02); scene.add(sR)
      }
    }

    // ── EQUIPMENT RACK ZONE → front-wall task light ──
    if (zOn('equipmentRack')) {
      const erCol = zCol('equipmentRack')
      const erBri = zBri('equipmentRack')
      const eqLight = new THREE.PointLight(erCol, erBri * 3.0, W * 0.8, 1.8)
      eqLight.position.set(cx, H * 0.35, dFront + 0.3); scene.add(eqLight)
    }

    // ── Mouse / touch orbit ───────────────────────────────────────────────
    let isOrbiting = false, lastX = 0, lastY = 0
    const el = renderer.domElement

    const onDown  = (e: MouseEvent) => { isOrbiting = true; lastX = e.clientX; lastY = e.clientY }
    const onMove  = (e: MouseEvent) => {
      if (!isOrbiting) return
      orbitRef.current.theta -= (e.clientX - lastX) * 0.008
      orbitRef.current.phi = (orbitRef.current.phi - (e.clientY - lastY) * 0.008 + Math.PI * 2) % (Math.PI * 2)
      lastX = e.clientX; lastY = e.clientY; updateCamera()
    }
    const onUp    = () => { isOrbiting = false }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      orbitRef.current.radius = Math.max(0.25, Math.min(60, orbitRef.current.radius + e.deltaY * 0.016))
      updateCamera()
    }
    let lastTouchDist = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) { isOrbiting = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY }
      if (e.touches.length === 2) lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && isOrbiting) {
        orbitRef.current.theta -= (e.touches[0].clientX - lastX) * 0.01
        orbitRef.current.phi = (orbitRef.current.phi - (e.touches[0].clientY - lastY) * 0.01 + Math.PI * 2) % (Math.PI * 2)
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; updateCamera()
      }
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        orbitRef.current.radius = Math.max(0.25, Math.min(60, orbitRef.current.radius - (d - lastTouchDist) * 0.04))
        lastTouchDist = d; updateCamera()
      }
    }
    el.addEventListener('mousedown',  onDown)
    el.addEventListener('mousemove',  onMove)
    el.addEventListener('mouseup',    onUp)
    el.addEventListener('mouseleave', onUp)
    el.addEventListener('wheel',      onWheel,      { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true  })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onUp)

    // ── Room boundary surfaces — solid FrontSide planes ─────────────────────────
    // FrontSide = visible from inside the room only.
    // When camera orbits outside, these surfaces naturally disappear (backface culled).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), floorMat)
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor)

    const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, L),
      new THREE.MeshStandardMaterial({ color: 0x161d2c, roughness: 0.90, metalness: 0.00, side: THREE.FrontSide }))
    ceilMesh.rotation.x = Math.PI / 2; ceilMesh.position.set(cx, H, cz); scene.add(ceilMesh)

    const fwMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat)
    fwMesh.position.set(cx, H / 2, 0); scene.add(fwMesh)

    const rwMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat)
    rwMesh.rotation.y = Math.PI; rwMesh.position.set(cx, H / 2, L); scene.add(rwMesh)

    const lwMesh = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat)
    lwMesh.rotation.y = Math.PI / 2; lwMesh.position.set(0, H / 2, cz); scene.add(lwMesh)

    const rgtMesh = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat)
    rgtMesh.rotation.y = -Math.PI / 2; rgtMesh.position.set(W, H / 2, cz); scene.add(rgtMesh)

    // ── Per-intent architectural geometry ───────────────────────────────────────
    // Cinematic: horizontal reveals. Luxury: pilasters + crown + base. Audiophile: timber slats.
    // All BoxGeometry elements use surfaceMats → only room-facing face visible, GHOST on outward faces.

    const archMat = (hex: number, rough: number, metal = 0.0) =>
      new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, side: THREE.FrontSide })

    if (isCinematic) {
      const revealMat = archMat(0x0d1320, 0.70, 0.12)
      for (const ry of [H * 0.34, H * 0.67]) {
        // Reveal strips sit on left/right walls → only +X / -X face visible from inside
        const rvL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, L * 0.92), surfaceMats(revealMat, 'left'))
        rvL.position.set(0.008, ry, cz); scene.add(rvL)
        const rvR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, L * 0.92), surfaceMats(revealMat, 'right'))
        rvR.position.set(W - 0.008, ry, cz); scene.add(rvR)
        const glL = new THREE.PointLight(lightK, 0.55, W * 0.8, 2.0); glL.position.set(dLeft + 0.12, ry, cz); scene.add(glL)
        const glR = new THREE.PointLight(lightK, 0.55, W * 0.8, 2.0); glR.position.set(W - dRight - 0.12, ry, cz); scene.add(glR)
      }
    }

    if (isLuxury) {
      const pilMat  = archMat(0x1a2235, 0.55, 0.08)
      const trimMat = archMat(0x0e1525, 0.45, 0.15)
      const pilCount = Math.max(2, Math.round(L / 2.2))
      for (let pi = 0; pi < pilCount; pi++) {
        const pz = (pi + 0.5) * (L / pilCount)
        const plL = new THREE.Mesh(new THREE.BoxGeometry(0.06, H * 0.80, 0.08), surfaceMats(pilMat, 'left'))
        plL.position.set(0.03, H * 0.44, pz); scene.add(plL)
        const plR = new THREE.Mesh(new THREE.BoxGeometry(0.06, H * 0.80, 0.08), surfaceMats(pilMat, 'right'))
        plR.position.set(W - 0.03, H * 0.44, pz); scene.add(plR)
        const aL = new THREE.PointLight(lightK, 1.1, 2.0, 2.2); aL.position.set(0.14, H * 0.12, pz); scene.add(aL)
        const aR = new THREE.PointLight(lightK, 1.1, 2.0, 2.2); aR.position.set(W - 0.14, H * 0.12, pz); scene.add(aR)
      }
      const crL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, L * 0.94), surfaceMats(trimMat, 'left'))
      crL.position.set(0.025, H - 0.04, cz); scene.add(crL)
      const crR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, L * 0.94), surfaceMats(trimMat, 'right'))
      crR.position.set(W - 0.025, H - 0.04, cz); scene.add(crR)
      const skL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, L * 0.94), surfaceMats(trimMat, 'left'))
      skL.position.set(0.02, 0.05, cz); scene.add(skL)
      const skR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, L * 0.94), surfaceMats(trimMat, 'right'))
      skR.position.set(W - 0.02, 0.05, cz); scene.add(skR)
    }

    // ── Timber slats — reverse-U band: left wall → ceiling → right wall ─────────
    // All three segments share identical Z-start, Z-end and slatSpacing so they
    // read as one continuous band wrapping over the room.
    // Luxury: side walls only. Music: side walls + ceiling (completes the U).
    if (mf.slats) {
      const slatSpacing = 0.080           // consistent spacing across all three surfaces
      const slatW       = 0.032           // slat face width — same on wall and ceiling
      const slatD       = 0.030           // proud of panel face
      const _slatBase   = new THREE.MeshStandardMaterial({
        color: diffPal.diffBlock, roughness: 0.58, metalness: 0.02, side: THREE.DoubleSide,
      })
      const _slatBaseAlt = new THREE.MeshStandardMaterial({
        color: diffPal.diffFin, roughness: 0.54, metalness: 0.02, side: THREE.DoubleSide,
      })
      // Each surface gets only its room-facing face via InstancedMesh material arrays (see below)

      // ── Slat diffusion band — Schroeder-based placement ─────────────────────
      // Start: listenerZ + 0.5 × (rearFace − listenerZ)  [mid-point rear half]
      // End:   L − dRear (rear acoustic panel face)
      // Physics: diffusers are effective in the late-reflection / diffuse field zone,
      //          which begins roughly halfway between the listener and the rear wall.
      const _lstZ      = panelLayout.diagnostics.listenerZ
      const rearFace   = L - dRear
      // Ensure slats never start before reflector ends (short-room edge case)
      const _refEnd    = (() => {
        const r = panelLayout.panels.find(p => p.type === 'reflector' && (p.surface === 'left' || p.surface === 'right'))
        return r ? r.zone.u + r.zone.uw : dFront
      })()
      const bandStart  = Math.max(_refEnd, _lstZ + 0.5 * (rearFace - _lstZ))
      const bandEnd    = rearFace
      const bandLen    = Math.max(0.1, bandEnd - bandStart)
      const slatCount  = Math.max(1, Math.min(120, Math.floor((bandLen - slatW) / slatSpacing) + 1))

      // X / Y positions: proud of acoustic panel face
      const slatXL    = dLeft  + slatD / 2
      const slatXR    = W - dRight - slatD / 2
      const ceilSlatY = H - dCeiling - slatD / 2

      // Ceiling span: left panel face → right panel face, centred between them
      const ceilSlatW  = W - dLeft - dRight
      const ceilSlatCX = dLeft + ceilSlatW / 2

      // ── Left and right wall slats (floor-to-ceiling) ──────────────────────
      const wallSlatGeo = new THREE.BoxGeometry(slatD, H, slatW)
      const dummy = new THREE.Object3D()
      // Split into two sets of instanced meshes for alternating grain tones
      const sideCount1 = Math.ceil(slatCount / 2)
      const sideCount2 = Math.floor(slatCount / 2)
      const instL1 = new THREE.InstancedMesh(wallSlatGeo, _slatBase,    sideCount1)
      const instL2 = sideCount2 > 0 ? new THREE.InstancedMesh(wallSlatGeo, _slatBaseAlt, sideCount2) : null
      const instR1 = new THREE.InstancedMesh(wallSlatGeo, _slatBase,    sideCount1)
      const instR2 = sideCount2 > 0 ? new THREE.InstancedMesh(wallSlatGeo, _slatBaseAlt, sideCount2) : null
      let iA = 0, iB = 0
      for (let s = 0; s < slatCount; s++) {
        const sz = bandStart + slatW / 2 + s * slatSpacing
        if (s % 2 === 0) {
          dummy.position.set(slatXL, H / 2, sz); dummy.updateMatrix(); instL1.setMatrixAt(iA, dummy.matrix)
          dummy.position.set(slatXR, H / 2, sz); dummy.updateMatrix(); instR1.setMatrixAt(iA, dummy.matrix)
          iA++
        } else if (instL2 && instR2) {
          dummy.position.set(slatXL, H / 2, sz); dummy.updateMatrix(); instL2.setMatrixAt(iB, dummy.matrix)
          dummy.position.set(slatXR, H / 2, sz); dummy.updateMatrix(); instR2.setMatrixAt(iB, dummy.matrix)
          iB++
        }
      }
      instL1.instanceMatrix.needsUpdate = true; scene.add(instL1)
      if (instL2) { instL2.instanceMatrix.needsUpdate = true; scene.add(instL2) }
      instR1.instanceMatrix.needsUpdate = true; scene.add(instR1)
      if (instR2) { instR2.instanceMatrix.needsUpdate = true; scene.add(instR2) }

      // ── Ceiling slats — same Z-band, same count, same spacing (reverse-U) ──
      if (mf.slatsCeiling) {
        // Same alternating DoubleSide approach as side walls — two interleaved
        // instanced meshes with _slatBase / _slatBaseAlt for grain variation.
        // DoubleSide: visible from below AND from side-edges when orbiting.
        const ceilSlatGeo  = new THREE.BoxGeometry(ceilSlatW, slatD, slatW)
        const ceilCount1   = Math.ceil(slatCount / 2)
        const ceilCount2   = Math.floor(slatCount / 2)
        const instC1 = new THREE.InstancedMesh(ceilSlatGeo, _slatBase,    ceilCount1)
        const instC2 = ceilCount2 > 0 ? new THREE.InstancedMesh(ceilSlatGeo, _slatBaseAlt, ceilCount2) : null
        let cA = 0, cB = 0
        for (let s = 0; s < slatCount; s++) {
          const sz = bandStart + slatW / 2 + s * slatSpacing   // identical Z to wall slats
          dummy.position.set(ceilSlatCX, ceilSlatY, sz); dummy.updateMatrix()
          if (s % 2 === 0) { instC1.setMatrixAt(cA, dummy.matrix); cA++ }
          else if (instC2)  { instC2.setMatrixAt(cB, dummy.matrix); cB++ }
        }
        instC1.instanceMatrix.needsUpdate = true; scene.add(instC1)
        if (instC2) { instC2.instanceMatrix.needsUpdate = true; scene.add(instC2) }
      }

      // ── Back wall slats — identical vertical fins, span full wall width ──
      // Geometry: slatW (X) × H (Y) × slatD (Z proud of rear panel face)
      // surfaceMats('rear') → only face 5 (-Z, room-facing) renders; outside is GHOST
      const rearSlatGeo = new THREE.BoxGeometry(slatW, H, slatD)
      const rearSlatZ   = L - dRear - slatD / 2
      const rearSlatXStart = dLeft
      const rearSlatXEnd   = W - dRight
      const rearSlatSpan   = rearSlatXEnd - rearSlatXStart
      const rearSlatCount  = Math.max(1, Math.min(200, Math.floor((rearSlatSpan - slatW) / slatSpacing) + 1))
      const rearMat1 = new THREE.MeshStandardMaterial({ color: diffPal.diffBlock, roughness: 0.58, metalness: 0.02, side: THREE.FrontSide })
      const rearMat2 = new THREE.MeshStandardMaterial({ color: diffPal.diffFin,   roughness: 0.54, metalness: 0.02, side: THREE.FrontSide })
      const rearMats1 = surfaceMats(rearMat1, 'rear')
      const rearMats2 = surfaceMats(rearMat2, 'rear')
      const rearCount1 = Math.ceil(rearSlatCount / 2)
      const rearCount2 = Math.floor(rearSlatCount / 2)
      const instRear1 = new THREE.InstancedMesh(rearSlatGeo, rearMats1, rearCount1)
      const instRear2 = rearCount2 > 0 ? new THREE.InstancedMesh(rearSlatGeo, rearMats2, rearCount2) : null
      let rA = 0, rB = 0
      for (let s = 0; s < rearSlatCount; s++) {
        const sx = rearSlatXStart + slatW / 2 + s * slatSpacing
        dummy.position.set(sx, H / 2, rearSlatZ); dummy.updateMatrix()
        if (s % 2 === 0) { instRear1.setMatrixAt(rA, dummy.matrix); rA++ }
        else if (instRear2) { instRear2.setMatrixAt(rB, dummy.matrix); rB++ }
      }
      instRear1.instanceMatrix.needsUpdate = true; scene.add(instRear1)
      if (instRear2) { instRear2.instanceMatrix.needsUpdate = true; scene.add(instRear2) }

      // Warm toe-kick accent lights centred in the band
      const bandMid = bandStart + bandLen / 2
      const tkL = new THREE.PointLight(lightK, 1.2, L * 0.55, 1.8)
      tkL.position.set(slatXL + 0.12, 0.08, bandMid); scene.add(tkL)
      const tkR = new THREE.PointLight(lightK, 1.2, L * 0.55, 1.8)
      tkR.position.set(slatXR - 0.12, 0.08, bandMid); scene.add(tkR)
      // Mid-height wash — grazes across slat faces to show grain depth
      const wL = new THREE.PointLight(0xffd8a0, 2.8, W * 1.4, 1.6)
      wL.position.set(slatXL + 0.10, H * 0.48, bandMid); scene.add(wL)
      const wR = new THREE.PointLight(0xffd8a0, 2.8, W * 1.4, 1.6)
      wR.position.set(slatXR - 0.10, H * 0.48, bandMid); scene.add(wR)
      // Top-down grazing — reveals slat depth from above
      const gzL = new THREE.SpotLight(0xffe4b8, 3.0, H * 1.6, Math.PI / 7, 0.3)
      gzL.position.set(slatXL + 0.08, H - 0.25, bandMid); gzL.target.position.set(slatXL, H * 0.3, bandMid)
      gzL.target.updateMatrixWorld(); scene.add(gzL); scene.add(gzL.target)
      const gzR = new THREE.SpotLight(0xffe4b8, 3.0, H * 1.6, Math.PI / 7, 0.3)
      gzR.position.set(slatXR - 0.08, H - 0.25, bandMid); gzR.target.position.set(slatXR, H * 0.3, bandMid)
      gzR.target.updateMatrixWorld(); scene.add(gzR); scene.add(gzR.target)
    }

    // ── Acoustic treatment — driven by panelLayout from panelEngine ─────────
    //   room dims → bass trap leg = λ/4 at lowest axial mode (Everest ch.13)
    //   speaker positions → SBIR depth + FRP via mirror-image rule
    //   RT60 ratio → coverage fraction (stage 1) + density multiplier (stage 2)
    //   treatmentLevel → active surfaces
    //   designIntent → rear diffuser type (skyline / slatted)

    // Bass traps — gated by matrix, triangular prisms, all 4 vertical corners
    for (const trap of mf.bassTraps ? panelLayout.traps : []) {
      const leg = trap.leg
      switch (trap.corner) {
        case 'FL': scene.add(makeBassTrapMesh(0, 0,     leg,   leg,   H)); break
        case 'FR': scene.add(makeBassTrapMesh(W, 0,     W-leg, leg,   H)); break
        case 'RL': scene.add(makeBassTrapMesh(0, L,     leg,   L-leg, H)); break
        case 'RR': scene.add(makeBassTrapMesh(W, L,     W-leg, L-leg, H)); break
      }
    }

    // Panels — absorbers as world-space grids; diffusers as QRD/slatted; gypsum as smooth slab
    for (const panel of panelLayout.panels) {
      const { surface, type, zone, densityMultiplier } = panel

      if (type === 'absorber') {
        if (!mf.absorbers) continue          // skip this panel, keep iterating
        renderAbsorberGrid(zone, surface as PanelSurface, W, L, H, L, densityMultiplier, scene, absorberMat)
        if (isLuxury && (surface === 'left' || surface === 'right' || surface === 'front' || surface === 'rear')) {
          addLuxuryTrim(zone, surface)
        }
      } else if (type === 'ceiling_slab') {
        // ceiling_slab = basic gypsum — treat as absorber-category for gating
        if (!mf.absorbers) continue          // skip this panel, keep iterating
        renderGypsumCeiling(zone)
      } else if (type === 'reflector') {
        if (!mf.reflectors) continue         // skip this panel, keep iterating
        renderReflector(zone, surface as PanelSurface)
      } else if (type === 'frp_marker') {
        renderFRPMarker(zone, surface as PanelSurface)  // no-op, always safe
      } else if (surface === 'rear') {
        // Rear wall slats are rendered with the side-wall slat band above (mf.slats block).
        // The panelEngine still emits rear diffuser zones for acoustic calculations — skip 3D rendering here.
        continue
      }
    }

    // rowZ is the CENTRE of each row's riser platform.
    // Row 0 (back) centre = L - dRear - rowPitchM/2, so its back edge aligns
    // flush with the inner face of the rear acoustic panel.
    // Row N-1 (front) centre is rowPitchM/2 past the front row riser front edge.
    const seatingRearZ = L - acousticDepths.rear - rowPitchM / 2
    // Carpet: uses boxMats — bottom (-y) face ghosted, all others visible
    const _carpetSolid = new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.98, metalness: 0.00, side: THREE.FrontSide })
    const carpetMats  = boxMats(_carpetSolid, '-y')
    const carpetGeo   = new THREE.BoxGeometry(1, 1, 1)

    for (let row = 0; row < seatingRowCount; row++) {
      // row 0 = rear (farthest from screen), increases toward screen
      const rowZ  = seatingRearZ - row * rowPitchM
      // Back rows highest, front rows at ground level
      const rH    = (seatingRowCount - 1 - row) * riserStepM
      const slabH = Math.max(0.04, row === seatingRowCount - 1 ? riserStepM * 0.5 : riserStepM)
      const slab  = new THREE.Mesh(carpetGeo, carpetMats)
      slab.scale.set(W, slabH, rowPitchM * 0.98)
      slab.position.set(cx, rH + slabH / 2, rowZ) // centred on rowZ — back edge at rowZ+rowPitchM/2
      scene.add(slab)
    }

    // ── Screen ────────────────────────────────────────────────────────────
    const scrZ = dFront + 0.02
    const scrY = screenBottomFromFloor + screenHeight / 2
    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(screenWidth + 0.12, screenHeight + 0.12, 0.06), surfaceMats(M.screenFrame(), 'front')
    )
    frameMesh.position.set(cx, scrY, scrZ); scene.add(frameMesh)
    const screenMesh = new THREE.Mesh(
      new THREE.BoxGeometry(screenWidth, screenHeight, 0.01), surfaceMats(M.screen(), 'front')
    )
    screenMesh.position.set(cx, scrY, scrZ + 0.035); scene.add(screenMesh)

    if (displayType === 'projector') {
      const projZ = Math.min(dFront + throwDistance + 0.3, L - dRear - 0.3)
      const proj  = makeProjector()
      proj.position.set(cx, H - 0.12, projZ); proj.rotation.y = Math.PI; scene.add(proj)
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(cx, H - 0.12, projZ - 0.14),
          new THREE.Vector3(cx, scrY, scrZ + 0.04),
        ]),
        new THREE.LineBasicMaterial({ color: 0x445566, transparent: true, opacity: 0.35 })
      ))
    }

    // ── Speakers ──────────────────────────────────────────────────────────
    const spkOff    = mountType === 'inWall' ? 0.06 : 0.16
    const earH      = 1.15
    const ceilSpkY  = H - dCeiling - 0.05
    const scrL2     = (W - screenWidth) / 2
    const scrR2     = (W + screenWidth) / 2

    // ── Seating zone — rows start from rear (seatingRearZ = row 0) ──────────
    const clampedPR   = Math.max(0, Math.min(primaryRow, seatingRowCount - 1))
    const rowZfn      = (row: number) => seatingRearZ - row * rowPitchM
    const primaryZ    = rowZfn(clampedPR)
    const seatFrontZ  = rowZfn(seatingRowCount - 1)   // nearest row to screen
    const seatRearZ   = rowZfn(0)                     // farthest row from screen
    const seatZoneLen = Math.max(0.1, seatRearZ - seatFrontZ)

    // ── Dolby Atmos overhead Z anchors (seating-zone-relative) ──────────────
    // Front overhead: above front 1/3 of listening zone (1/6 from front edge)
    // Mid overhead:   above midpoint of listening zone
    // Rear overhead:  above rear 1/3 of listening zone (1/6 from rear edge)
    // Horizontal: ±30° from centre → W×0.25 / W×0.75 (Dolby Atmos Home spec)
    const atmosX_L    = W * 0.25
    const atmosX_R    = W * 0.75
    const atmosFrontZ = seatFrontZ + seatZoneLen * 0.17
    const atmosMidZ   = seatFrontZ + seatZoneLen * 0.50
    const atmosRearZ  = seatRearZ  - seatZoneLen * 0.17

    // ── Usable Z range (inside acoustic panels) ──────────────────────────────
    const usableZStart = dFront + 0.05
    const usableZEnd   = L - dRear - 0.05

    const chPos = (ch: string, x2d: number, z2d?: number): THREE.Vector3 => {
      switch (ch) {
        case 'FL':  return screenPlacement === 'besideScreen'
          ? new THREE.Vector3(Math.max(0.15, scrL2 - 0.45), earH,                                   dFront + spkOff)
          : new THREE.Vector3(Math.max(0.15, scrL2 - 0.10), screenBottomFromFloor + screenHeight/2, dFront + spkOff)
        case 'FR':  return screenPlacement === 'besideScreen'
          ? new THREE.Vector3(Math.min(W - 0.15, scrR2 + 0.45), earH,                                   dFront + spkOff)
          : new THREE.Vector3(Math.min(W - 0.15, scrR2 + 0.10), screenBottomFromFloor + screenHeight/2, dFront + spkOff)
        case 'C':   return new THREE.Vector3(cx, Math.max(0.3, screenBottomFromFloor - 0.18), dFront + spkOff)
        // SL/SR at primary row, ±90° — wall face at ear height
        case 'SL':  return new THREE.Vector3(dLeft  + spkOff, earH, primaryZ)
        case 'SR':  return new THREE.Vector3(W - dRight - spkOff, earH, primaryZ)
        // RL/RR at 135°–150°, just inside rear acoustic panel
        case 'RL':  return new THREE.Vector3(W * 0.25, earH, L - dRear - spkOff)
        case 'RR':  return new THREE.Vector3(W * 0.75, earH, L - dRear - spkOff)
        // Overhead — seating-zone-anchored, Dolby Atmos Home Theatre spec
        case 'TFL': return new THREE.Vector3(atmosX_L, ceilSpkY, atmosFrontZ)
        case 'TFR': return new THREE.Vector3(atmosX_R, ceilSpkY, atmosFrontZ)
        case 'TML': return new THREE.Vector3(atmosX_L, ceilSpkY, atmosMidZ)
        case 'TMR': return new THREE.Vector3(atmosX_R, ceilSpkY, atmosMidZ)
        case 'TRL': return new THREE.Vector3(atmosX_L, ceilSpkY, atmosRearZ)
        case 'TRR': return new THREE.Vector3(atmosX_R, ceilSpkY, atmosRearZ)
        default:    return new THREE.Vector3(
          Math.max(0.15, Math.min(W - 0.15, x2d)),
          earH,
          z2d != null ? Math.max(usableZStart, Math.min(usableZEnd, z2d)) : primaryZ,
        )
      }
    }
    const chRot = (ch: string): THREE.Euler => {
      if (['FL','FR','C'].includes(ch))          return new THREE.Euler(0, Math.PI, 0)
      if (ch === 'SL' || /^SL\d+$/.test(ch))    return new THREE.Euler(0,  Math.PI / 2, 0)
      if (ch === 'SR' || /^SR\d+$/.test(ch))    return new THREE.Euler(0, -Math.PI / 2, 0)
      if (ch === 'RL' || ch === 'RR')            return new THREE.Euler(0, Math.PI, 0)
      if (/^T(FL|FR|ML|MR|RL|RR)$/.test(ch))    return new THREE.Euler(Math.PI / 2, 0, 0)
      return new THREE.Euler(0, 0, 0)
    }
    for (const spk of speakers) {
      const ch = spk.channel ?? spk.id.replace('spk-', '').toUpperCase()
      const cab = makeSpeaker(ch); cab.position.copy(chPos(ch, spk.x, spk.y)); cab.rotation.copy(chRot(ch)); scene.add(cab)
    }

    // ── Extra side pairs — one per seating row (excl. primary), ITU-R BS.2051 ─
    // Each pair sits at that row's actual Z, matching a real seat position.
    const extraRowZs: number[] = []
    for (let row = 0; row < seatingRowCount; row++) {
      if (row === clampedPR) continue
      extraRowZs.push(rowZfn(row))
    }
    for (let i = 0; i < Math.min(extraSidePairs, extraRowZs.length); i++) {
      const z  = Math.max(usableZStart, Math.min(usableZEnd, extraRowZs[i]))
      const sl = makeSpeaker('SL'); sl.position.set(dLeft + spkOff, earH, z); sl.rotation.y =  Math.PI / 2; scene.add(sl)
      const sr = makeSpeaker('SR'); sr.position.set(W - dRight - spkOff, earH, z); sr.rotation.y = -Math.PI / 2; scene.add(sr)
    }

    // ── Extra ceiling pairs — evenly spaced over seating zone, Dolby Atmos ───
    // Interpolates between atmosFrontZ and atmosRearZ at W×0.25 / W×0.75.
    for (let i = 0; i < extraCeilingPairs; i++) {
      const frac = extraCeilingPairs === 1 ? 0.5 : i / (extraCeilingPairs - 1)
      const z    = Math.max(usableZStart, Math.min(usableZEnd,
        atmosFrontZ + frac * (atmosRearZ - atmosFrontZ)))
      const atl  = makeSpeaker('TFL'); atl.position.set(atmosX_L, ceilSpkY, z); atl.rotation.x = Math.PI / 2; scene.add(atl)
      const atr  = makeSpeaker('TFR'); atr.position.set(atmosX_R, ceilSpkY, z); atr.rotation.x = Math.PI / 2; scene.add(atr)
    }

    // ── Subwoofers ────────────────────────────────────────────────────────
    const subFZ = dFront + 0.22, subRZ = L - dRear - 0.22, subOff = 0.38
    const subPts: THREE.Vector3[] = []
    if      (subCount === 1 || subPlacement === 'frontWall')  { subPts.push(new THREE.Vector3(cx, 0.2, subFZ)) }
    else if (subPlacement === 'frontCorners')                  { subPts.push(new THREE.Vector3(subOff, 0.2, subFZ), new THREE.Vector3(W - subOff, 0.2, subFZ)) }
    else if (subPlacement === 'haas')                          { subPts.push(new THREE.Vector3(subOff, 0.2, subFZ), new THREE.Vector3(W - subOff, 0.2, subFZ), new THREE.Vector3(cx, 0.2, subRZ)) }
    else if (subPlacement === 'distributed')                   { subPts.push(new THREE.Vector3(subOff, 0.2, subFZ), new THREE.Vector3(W - subOff, 0.2, subFZ), new THREE.Vector3(subOff, 0.2, subRZ), new THREE.Vector3(W - subOff, 0.2, subRZ)) }
    for (const pos of subPts.slice(0, subCount)) {
      const sub = makeSpeaker('SUB', subEnclosure); sub.position.copy(pos); scene.add(sub)
    }

    // ── Seating & Risers ──────────────────────────────────────────────────
    const SIDE_CLR    = 0.30
    const riserX      = SIDE_CLR + usableWidth / 2
    // Aisle geometry — back row (row 0) always full-width, no aisle
    const clampedAisleW  = Math.max(0.6096, Math.min(0.9144, aisleW))
    const aisleSeatsLost = aisleConfig !== 'none'
      ? Math.max(1, Math.ceil(clampedAisleW / (usableWidth / Math.max(1, seatsPerRow)))) * (aisleConfig === 'both' ? 2 : 1)
      : 0
    // Seat X positions with aisle gap inserted
    const buildSeatXs = (count: number, isBackRow: boolean): number[] => {
      const totalW  = usableWidth
      const spacing = totalW / Math.max(1, count)
      const xs: number[] = []
      for (let s = 0; s < count; s++) xs.push(SIDE_CLR + s * spacing + spacing / 2)
      if (isBackRow || aisleConfig === 'none') return xs
      // Insert aisle gap by shifting seat groups apart
      const midSeat = Math.floor(count / 2)
      const shifted: number[] = []
      for (let s = 0; s < count; s++) {
        let x = xs[s]
        if (aisleConfig === 'center') {
          x += s < midSeat ? -clampedAisleW / 2 : clampedAisleW / 2
        } else if (aisleConfig === 'left') {
          x += clampedAisleW  // push all seats right to open left aisle
        } else if (aisleConfig === 'right') {
          // seats stay left, right aisle opens naturally
        } else if (aisleConfig === 'both') {
          x += clampedAisleW  // offset for left aisle; right aisle opens at far end
        }
        shifted.push(x)
      }
      return shifted
    }

    for (let row = 0; row < seatingRowCount; row++) {
      const rowZ     = seatingRearZ - row * rowPitchM
      // Back row (row 0) highest, front row (row N-1) at floor level
      const rH       = (seatingRowCount - 1 - row) * riserStepM
      const isBack   = row === 0   // back row = full-width, no aisle
      const rowSeats = isBack ? seatsPerRow + aisleSeatsLost : seatsPerRow
      const seatXs   = buildSeatXs(rowSeats, isBack)
      if (rH > 0.02) {
        const riserMat2 = new THREE.MeshStandardMaterial({ color: 0x131a26, roughness: 0.84, metalness: 0.00, side: THREE.FrontSide })
        const riser = new THREE.Mesh(new THREE.BoxGeometry(usableWidth, rH, rowPitchM * 0.92), boxMats(riserMat2, '-y'))
        riser.position.set(riserX, rH / 2, rowZ); scene.add(riser) // centred on rowZ — back face at rowZ+rowPitchM/2
      }
      for (let s = 0; s < rowSeats; s++) {
        const seat = makeSeat(seatMat, legsMatT)
        // rotation.y = π → seat faces -Z (toward screen at Z≈0)
        seat.rotation.y = Math.PI
        seat.position.set(seatXs[s], rH, rowZ); scene.add(seat)
      }
    }

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight)
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize); ro.observe(container)

    // ── Render loop ───────────────────────────────────────────────────────
    let rafId: number
    const animate = () => { rafId = requestAnimationFrame(animate); renderer.render(scene, camera) }
    animate()

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId); ro.disconnect()
      el.removeEventListener('mousedown',  onDown)
      el.removeEventListener('mousemove',  onMove)
      el.removeEventListener('mouseup',    onUp)
      el.removeEventListener('mouseleave', onUp)
      el.removeEventListener('wheel',      onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onUp)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      scene.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mat = mesh.material
          if (Array.isArray(mat)) mat.forEach(m => { if (m !== GHOST) m.dispose() })
          else (mat as THREE.Material)?.dispose()
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.room.width, props.room.length, props.room.height,
    props.acousticDepths.front, props.acousticDepths.rear,
    props.acousticDepths.left,  props.acousticDepths.right, props.acousticDepths.ceiling,
    props.panelLayout,
    props.screenWidth, props.screenHeight, props.screenBottomFromFloor,
    props.displayType, props.throwDistance, props.mountType,
    props.speakers, props.extraSidePairs, props.extraCeilingPairs,
    props.subCount, props.subPlacement, props.subEnclosure,
    props.seatingRowCount, props.seatsPerRow, props.riserStepM,
    props.frontClearance, props.rowPitchM, props.usableWidth,
    props.designIntent, props.treatmentLevel, props.roomColorScheme,
    props.wallConstruction, props.primaryRow, props.screenPlacement,
    props.aisleConfig, props.aisleWidthM,
    props.lightingZones, props.lightingSceneBrightness,
  ])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#d9dadb', cursor: 'grab', userSelect: 'none' }}
    />
  )
}