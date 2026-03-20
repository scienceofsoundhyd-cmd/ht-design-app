/**
 * room.ts
 * Location: lib/engine/core/room.ts
 *
 * RESPONSIBILITY: One job only.
 * Define the canonical Room type and provide the single
 * authorized way to construct a valid Room object.
 * No acoustics. No coordinate logic. No formatting.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A "DOMAIN MODEL"?
 * ─────────────────────────────────────────────────────────
 * A domain model is the engine's official description of a
 * real-world thing — in this case, a room.
 *
 * The engine needs to talk about rooms constantly. Speaker
 * placement, modal analysis, reverberation, seat layout —
 * every module needs to know the room's dimensions and
 * derived properties. Without a canonical model, each module
 * would compute its own version of volume or surface area,
 * potentially getting different results due to different
 * rounding or different formulas.
 *
 * The canonical Room type solves this:
 *   - One definition of what a Room is
 *   - One function that creates a Room
 *   - Every module receives the same pre-computed properties
 *   - No module ever recomputes what is already on the object
 *
 * ─────────────────────────────────────────────────────────
 * WHAT "EXTENDS" MEANS HERE
 * ─────────────────────────────────────────────────────────
 * RoomBounds already defines the three raw dimensions:
 *   { width, height, length }
 *
 * Room extends RoomBounds, which means Room includes
 * everything RoomBounds has, and then adds more fields.
 *
 * Think of it like a receipt:
 *   RoomBounds = the line items (width, height, length)
 *   Room       = the full receipt (line items + totals + ratios)
 *
 * Any code that accepts a RoomBounds can also accept a Room,
 * because a Room is a RoomBounds with extra information.
 * This is the Liskov substitution principle — a more specific
 * type can stand in anywhere the less specific type is expected.
 *
 * ─────────────────────────────────────────────────────────
 * WHY PRECOMPUTE VOLUME, SURFACE AREA, AND ASPECT RATIOS?
 * ─────────────────────────────────────────────────────────
 * These three properties are needed constantly throughout
 * the engine. If they were computed on demand each time,
 * two problems would arise:
 *
 * Problem 1 — Wasted work.
 * The modal analysis module, the RT60 module, the treatment
 * recommendation module, and the seating layout module all
 * need room volume. Computing it four separate times is four
 * times the work for a result that never changes.
 *
 * Problem 2 — Divergence risk.
 * If four modules each compute volume independently, a future
 * change to the volume formula must be applied in four places.
 * Missing one creates a silent inconsistency — two modules
 * agree, two do not, and no error is thrown.
 *
 * Precomputing at construction time means the math runs once,
 * the result is stored on the object, and every consumer reads
 * the same number from the same field.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT "FACTORY FUNCTION" MEANS
 * ─────────────────────────────────────────────────────────
 * A factory function is a function whose job is to construct
 * and return an object. Instead of building a Room object
 * by hand every time (setting every field manually, remembering
 * to compute volume, remembering to check dimensions), you
 * call one function and receive a complete, validated, fully
 * computed Room.
 *
 * createRoom is that factory. It is the only authorized entry
 * point for creating a Room in this engine. No other code
 * should construct a Room object directly.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All inputs are in METERS.
 * All outputs are in SI-derived units:
 *   volume       → cubic meters (m³)
 *   surfaceArea  → square meters (m²)
 *   aspectRatios → dimensionless ratios
 * No rounding. No toFixed. No formatting.
 */

import { RoomBounds } from "./coordinateSystem"
import { roomVolume, roomSurfaceArea, roomAspectRatios } from "./roomMath"

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * AspectRatios holds the three pairwise dimension ratios
 * of a room. These are dimensionless numbers that describe
 * the shape of the room independent of its size.
 *
 *   wl — width divided by length  (how wide relative to deep)
 *   wh — width divided by height  (how wide relative to tall)
 *   lh — length divided by height (how deep relative to tall)
 *
 * These ratios are used in modal frequency analysis to detect
 * whether room dimensions are likely to produce coincident
 * standing waves at the same frequencies.
 */
export type AspectRatios = {
  wl: number
  wh: number
  lh: number
}

/**
 * Room is the canonical domain model for a physical room.
 *
 * It extends RoomBounds, meaning it includes:
 *   width    — interior width in meters  (X axis span)
 *   height   — interior height in meters (Y axis span)
 *   length   — interior length in meters (Z axis span)
 *
 * And it adds:
 *   volume       — total interior volume in cubic meters (m³)
 *   surfaceArea  — total interior surface area in square meters (m²)
 *   aspectRatios — three pairwise dimension ratios (dimensionless)
 *
 * All fields are readonly. A Room is immutable once created.
 *
 * Why readonly?
 * A Room represents a physical space with a fixed geometry.
 * Allowing fields to be changed after construction would mean
 * that volume, surfaceArea, and aspectRatios could fall out
 * of sync with width, height, and length. For example, if
 * something changed room.width directly, room.volume would
 * still reflect the old width. This inconsistency would be
 * silent and catastrophic for any acoustic calculation that
 * depended on both fields.
 *
 * Readonly enforces a contract: to change a room's geometry,
 * you call createRoom() again with the new dimensions. The
 * resulting object is always internally consistent.
 */
export type Room = Readonly<
  RoomBounds & {
    volume: number
    surfaceArea: number
    aspectRatios: AspectRatios
  }
>

// ─────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────

/**
 * Thrown when createRoom receives a dimension that is not
 * physically meaningful (zero or negative).
 *
 * Using a named error class instead of a generic Error means
 * callers can catch specifically this failure type and handle
 * it differently from unexpected errors:
 *
 *   try { createRoom(0, 3, 8) }
 *   catch (e) {
 *     if (e instanceof InvalidRoomDimensionError) {
 *       // handle bad user input
 *     }
 *   }
 */
export class InvalidRoomDimensionError extends Error {
  constructor(field: "width" | "height" | "length", value: number) {
    super(
      `Room ${field} must be greater than 0. Received: ${value}`
    )
    this.name = "InvalidRoomDimensionError"
  }
}

// ─────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────

/**
 * Creates a fully validated and computed Room object.
 *
 * This is the only authorized way to construct a Room.
 * No other code should build a Room object by hand.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT "VALIDATION" MEANS HERE — EXPLAINED SIMPLY
 * ─────────────────────────────────────────────────────────
 * Before computing anything, createRoom checks that every
 * dimension is physically possible. A room cannot have a
 * width of zero (it would be a flat plane, not a room).
 * A room cannot have a negative height (that is not a
 * physical concept). These are not just unlikely inputs —
 * they would cause division by zero or nonsense results
 * inside aspect ratio calculations.
 *
 * Catching bad input at the factory, before it enters the
 * engine, is called "validation at the boundary". It means:
 * once a Room object exists in the engine, every module that
 * receives it can trust that its dimensions are valid. No
 * module needs its own defensive checks. The factory is the
 * single point of trust.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT HAPPENS STEP BY STEP
 * ─────────────────────────────────────────────────────────
 * 1. Validate that width > 0. If not, throw.
 * 2. Validate that height > 0. If not, throw.
 * 3. Validate that length > 0. If not, throw.
 * 4. Compute volume using roomMath.roomVolume.
 * 5. Compute surface area using roomMath.roomSurfaceArea.
 * 6. Compute aspect ratios using roomMath.roomAspectRatios.
 * 7. Return a single frozen, immutable Room object.
 *
 * @param width   Interior room width in meters  (must be > 0)
 * @param height  Interior room height in meters (must be > 0)
 * @param length  Interior room length in meters (must be > 0)
 * @returns       A fully computed, immutable Room object
 * @throws        InvalidRoomDimensionError if any dimension is ≤ 0
 *
 * Examples:
 *   createRoom(5, 2.7, 8)
 *     → {
 *         width: 5,
 *         height: 2.7,
 *         length: 8,
 *         volume: 108,
 *         surfaceArea: 174.8,
 *         aspectRatios: { wl: 0.625, wh: 1.851..., lh: 2.962... }
 *       }
 *
 *   createRoom(0, 2.7, 8)  → throws InvalidRoomDimensionError("width", 0)
 *   createRoom(5, -1, 8)   → throws InvalidRoomDimensionError("height", -1)
 */
export function createRoom(
  width: number,
  height: number,
  length: number
): Room {
  if (width <= 0)  throw new InvalidRoomDimensionError("width",  width)
  if (height <= 0) throw new InvalidRoomDimensionError("height", height)
  if (length <= 0) throw new InvalidRoomDimensionError("length", length)

  // Build a minimal bounds object so roomMath functions can
  // operate on it. These functions accept RoomBounds, which
  // is exactly what we have at this point.
  const bounds: RoomBounds = { width, height, length }

  return Object.freeze({
    width,
    height,
    length,
    volume:       roomVolume(bounds),
    surfaceArea:  roomSurfaceArea(bounds),
    aspectRatios: roomAspectRatios(bounds),
  })
}