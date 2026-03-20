/**
 * COMPATIBILITY LAYER
 * Maps Engine V3 type names → Engine V2 types
 * Use this for existing code that references old type names
 */

import type {
  Speaker,
  Subwoofer,
  Screen,
  Seat,
  SpeakerLayout,
  Coordinate3D,
  Dimensions3D,
  RoomGeometry
} from "./types"

// ============================================
// TYPE ALIASES (V3 → V2 mapping)
// ============================================

/**
 * V3 used "SpeakerSystemType"
 * V2 uses "SpeakerLayout"
 */
export type SpeakerSystemType = SpeakerLayout

/**
 * V3 used simple Room type
 * V2 uses comprehensive RoomGeometry
 */
export type Room = {
  width: number
  length: number
  height: number
}

/**
 * V3 AxialMode (simpler version)
 */
export type AxialMode = {
  axis: "x" | "y" | "z"
  order: number
  frequency: number
  type: "axial" | "tangential" | "oblique"
}

/**
 * V3 PhaseAlignment
 */
export type PhaseAlignment = {
  subId: string
  speakerId: string
  distance: number
  phaseDifference: number
  delaySuggestion: number
}

/**
 * V3 ViewingStandard
 */
export type ViewingStandard = "SMPTE" | "THX" | "IMMERSIVE"

/**
 * V3 Scene structure (simplified)
 */
export type Scene = {
  room: Room
  objects: SceneObject[]
  modes: AxialMode[]
  phaseAlignments?: PhaseAlignment[]
  systemType: SpeakerSystemType
  schroederFrequency?: number
}

/**
 * V3 SceneObject union
 */
export type SceneObject = 
  | RoomObject
  | ScreenObject
  | Seat
  | Speaker
  | Subwoofer

export type RoomObject = {
  id: string
  type: "room"
  x: number
  y: number
  z?: number
  width: number
  height: number
}

export type ScreenObject = {
  id: string
  type: "screen"
  x: number
  y: number
  z?: number
  width: number
  height: number
}

// Re-export V2 types that are compatible
export type { Speaker, Subwoofer, Seat } from "./types"
export type { Coordinate3D as Position } from "./types"