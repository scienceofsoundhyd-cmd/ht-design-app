// ============================
// PRIMITIVES / 3D TYPES
// ============================

export type Meters = number   // plain alias — assigns freely from number literals

export type Coordinate3D = {
  x: number
  y: number
  z: number
}

export type Dimensions3D = {
  width:  number
  height: number
  depth:  number
}

// ============================
// ROOM GEOMETRY PIPELINE
// Three stages: Raw → Acoustic → Usable
// ============================

/**
 * Stage 1 — Raw measured dimensions + all derived area/volume scalars.
 */
export type RawRoomGeometry = {
  width:       Meters
  length:      Meters
  height:      Meters
  volume:      number   // m³
  surfaceArea: number   // m²  (all 6 surfaces)
  floorArea:   number   // m²  (width × length)
  ceilingArea: number   // m²  (width × length, same as floor for box room)
  aspectRatios: {
    wl: number          // width / length
    wh: number          // width / height
    lh: number          // length / height
  }
}

/**
 * Stage 2 — Acoustic absorption zone thickness per surface.
 * Optional computed fields so the object literal in roomgeometry.ts
 * can omit effectiveVolume / boundaryLoss if not calculated inline.
 */
export type AcousticEnvelope = {
  frontWall:       Meters
  backWall:        Meters
  leftWall:        Meters
  rightWall:       Meters
  ceiling:         Meters
  floor:           Meters
  effectiveVolume?: number   // m³ — optional, computed separately
  boundaryLoss?:   number    // 0–1 — optional, computed separately
}

/**
 * 3D axis-aligned bounding box for placement algorithms.
 */
export type RoomBounds = {
  minX: Meters
  maxX: Meters
  minY: Meters
  maxY: Meters
  minZ: Meters
  maxZ: Meters
}

/**
 * Stage 3 — Authoritative usable geometry consumed by the engine.
 * Exposes raw dims directly (width/length/height) for convenience,
 * plus the full pipeline objects.
 */
export type UsableRoomGeometry = {
  // Direct dimension access
  width:  Meters
  length: Meters
  height: Meters
  volume: number         // m³
  origin: Coordinate3D  // room origin point (typically 0,0,0)
  // Pipeline stages
  raw:      RawRoomGeometry
  acoustic: AcousticEnvelope
  bounds:   RoomBounds
  primaryListenerPosition: Coordinate3D
  schroederFrequency:      number
}

/**
 * RoomGeometry — the exact shape returned by buildRoomGeometry().
 * { raw, acoustic, usable } only — consumers drill into raw/usable for details.
 */
export type RoomGeometry = {
  raw:     RawRoomGeometry
  acoustic: AcousticEnvelope
  usable:   UsableRoomGeometry
}

// ============================
// ROOM (simple 2D model for scene builder)
// ============================

export type Room = {
  width:  number
  length: number
  height: number
}

// ============================
// SPEAKER SYSTEM TYPE
// ============================

export type SpeakerSystemType = "5.1" | "7.1" | "7.1.4"

// ============================
// SPEAKER LAYOUT
// ============================

export type SpeakerLayout = {
  systemType: SpeakerSystemType
  channels: {
    channel:    string
    angleDeg:   number    // 0°=front, +90°=right, -90°=left, ±180°=rear
    heightDeg?: number    // elevation for Atmos height channels
  }[]
}

// ============================
// SCENE OBJECT TYPES
// ============================

export type RoomObject = {
  id:     string
  type:   "room"
  x:      number
  y:      number
  width:  number
  height: number
}

export type ScreenObject = {
  id:     string
  type:   "screen"
  x:      number
  y:      number
  width:  number
  height: number
}

/** Alias — compact.ts imports `Screen` directly */
export type Screen = ScreenObject

export type Seat = {
  id:   string
  type: "seat"
  x:    number
  y:    number
}

export type Speaker = {
  id:      string
  type:    "speaker"
  channel: string   // "FL"|"FR"|"C"|"SL"|"SR"|"RL"|"RR"|"TFL"|"TFR"|"TRL"|"TRR"
  x:       number
  y:       number
}

export type Subwoofer = {
  id:        string
  type:      "subwoofer"
  x:         number
  y:         number
  distance:  number   // metres from primary listener
  frequency: number   // crossover frequency in Hz
}

// ============================
// SCENE OBJECT UNION
// ============================

export type SceneObject =
  | RoomObject
  | ScreenObject
  | Seat
  | Speaker
  | Subwoofer

// ============================
// AXIAL / ROOM MODES
// ============================

export type AxialMode = {
  axis:      "x" | "y" | "z"
  order:     number
  frequency: number
  type:      "axial" | "tangential" | "oblique"
}

// ============================
// PHASE ALIGNMENT
// ============================

export type PhaseAlignment = {
  subId:           string
  distance:        number   // path difference in metres
  phaseDifference: number   // 0–360 degrees
  delaySuggestion: number   // milliseconds
}

// ============================
// SCENE
// ============================

export type Scene = {
  room:               Room
  objects:            SceneObject[]
  modes:              AxialMode[]
  phaseAlignments:    PhaseAlignment[]
  systemType:         SpeakerSystemType
  schroederFrequency: number
}