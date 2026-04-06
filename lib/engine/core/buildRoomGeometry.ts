/**
 * buildRoomGeometry.ts
 * Location: lib/engine/core/buildRoomGeometry.ts
 *
 * RESPONSIBILITY: One job only.
 * Construct a fully computed RoomGeometry object from raw room
 * dimensions through the three-stage pipeline:
 *   Stage 1 — Raw:      measured dimensions + derived area/volume scalars
 *   Stage 2 — Acoustic: absorption zone thickness per surface
 *   Stage 3 — Usable:   authoritative geometry for the engine
 *
 * This is the single entry point for producing a RoomGeometry.
 * No module should construct RoomGeometry by hand.
 *
 * UNIT CONTRACT
 * All inputs and outputs are in METERS / SI units.
 */

import {
  RawRoomGeometry,
  AcousticEnvelope,
  UsableRoomGeometry,
  RoomGeometry,
  RoomBounds,
  Coordinate3D,
} from "./types"

// ─────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────

/**
 * Default acoustic absorption zone thickness per surface (meters).
 *
 * These represent the depth of acoustic treatment material
 * typically installed on each surface. The effective usable
 * room volume is smaller than the raw volume by these margins.
 *
 * Front wall is thicker because it often hosts a screen cavity,
 * bass traps, or an LCR baffle wall.
 */
const DEFAULT_ACOUSTIC_ENVELOPE: AcousticEnvelope = {
  frontWall: 0.30,
  backWall:  0.20,
  leftWall:  0.15,
  rightWall: 0.15,
  ceiling:   0.10,
  floor:     0.00,
}

// ─────────────────────────────────────────────────────────
// STAGE 1 — RAW GEOMETRY
// ─────────────────────────────────────────────────────────

function buildRawGeometry(
  width: number,
  length: number,
  height: number
): RawRoomGeometry {
  const volume = width * length * height
  const floorArea = width * length
  const ceilingArea = width * length
  const wallAreaFront = width * height
  const wallAreaBack = width * height
  const wallAreaLeft = length * height
  const wallAreaRight = length * height
  const surfaceArea =
    floorArea + ceilingArea +
    wallAreaFront + wallAreaBack +
    wallAreaLeft + wallAreaRight

  return {
    width,
    length,
    height,
    volume,
    surfaceArea,
    floorArea,
    ceilingArea,
    aspectRatios: {
      wl: width / length,
      wh: width / height,
      lh: length / height,
    },
  }
}

// ─────────────────────────────────────────────────────────
// STAGE 2 — ACOUSTIC ENVELOPE
// ─────────────────────────────────────────────────────────

function buildAcousticEnvelope(
  raw: RawRoomGeometry,
  envelope: AcousticEnvelope
): AcousticEnvelope {
  // Compute effective volume after subtracting absorption zones
  const effectiveWidth =
    raw.width - envelope.leftWall - envelope.rightWall
  const effectiveLength =
    raw.length - envelope.frontWall - envelope.backWall
  const effectiveHeight =
    raw.height - envelope.floor - envelope.ceiling

  const effectiveVolume =
    Math.max(0, effectiveWidth) *
    Math.max(0, effectiveLength) *
    Math.max(0, effectiveHeight)

  // Boundary loss ratio: fraction of volume consumed by treatment
  const boundaryLoss =
    raw.volume > 0 ? 1 - effectiveVolume / raw.volume : 0

  return {
    ...envelope,
    effectiveVolume,
    boundaryLoss,
  }
}

// ─────────────────────────────────────────────────────────
// STAGE 3 — USABLE GEOMETRY
// ─────────────────────────────────────────────────────────

function buildUsableGeometry(
  raw: RawRoomGeometry,
  acoustic: AcousticEnvelope,
  primaryListenerPosition: Coordinate3D,
  schroederFrequency: number
): UsableRoomGeometry {
  const origin: Coordinate3D = { x: 0, y: 0, z: 0 }

  const bounds: RoomBounds = {
    minX: 0,
    maxX: raw.width,
    minY: 0,
    maxY: raw.length,
    minZ: 0,
    maxZ: raw.height,
  }

  return {
    width: raw.width,
    length: raw.length,
    height: raw.height,
    volume: raw.volume,
    origin,
    raw,
    acoustic,
    bounds,
    primaryListenerPosition,
    schroederFrequency,
  }
}

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

export type BuildRoomGeometryOptions = {
  /** Room width in meters (X axis). */
  width: number
  /** Room length in meters (Y axis). */
  length: number
  /** Room height in meters (Z axis). */
  height: number
  /**
   * Primary listener position in 3D room coordinates.
   * If omitted, defaults to room center at standard ear height (1.2m).
   */
  primaryListenerPosition?: Coordinate3D
  /**
   * Custom acoustic envelope thicknesses.
   * If omitted, uses sensible defaults for a treated home theater.
   */
  acousticEnvelope?: Partial<AcousticEnvelope>
  /**
   * RT60 reverberation time in seconds.
   * Used to compute the Schroeder frequency.
   * If omitted, defaults to 0.4s (typical treated room).
   */
  rt60?: number
}

/**
 * Builds the complete three-stage RoomGeometry pipeline.
 *
 * This is the single authorized entry point for producing
 * a RoomGeometry object. All engine modules that need room
 * geometry should receive the output of this function.
 *
 * @param options  Room dimensions and optional overrides.
 * @returns        A fully computed RoomGeometry { raw, acoustic, usable }.
 */
export function buildRoomGeometry(
  options: BuildRoomGeometryOptions
): RoomGeometry {
  const { width, length, height } = options

  // Stage 1 — Raw
  const raw = buildRawGeometry(width, length, height)

  // Stage 2 — Acoustic
  const envelope: AcousticEnvelope = {
    ...DEFAULT_ACOUSTIC_ENVELOPE,
    ...(options.acousticEnvelope ?? {}),
  }
  const acoustic = buildAcousticEnvelope(raw, envelope)

  // Schroeder frequency: f_s = 2000 × √(RT60 / V)
  const rt60 = options.rt60 ?? 0.4
  const schroederFrequency =
    raw.volume > 0 ? 2000 * Math.sqrt(rt60 / raw.volume) : 0

  // Primary listener position — default to room center at ear height
  const primaryListenerPosition = options.primaryListenerPosition ?? {
    x: width / 2,
    y: length * 0.38, // 38% depth (standard primary listening position)
    z: 1.2,           // standard seated ear height in meters
  }

  // Stage 3 — Usable
  const usable = buildUsableGeometry(
    raw,
    acoustic,
    primaryListenerPosition,
    schroederFrequency
  )

  return { raw, acoustic, usable }
}
