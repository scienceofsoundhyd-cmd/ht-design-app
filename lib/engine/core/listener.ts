/**
 * listener.ts
 * Location: lib/engine/core/listener.ts
 *
 * RESPONSIBILITY: One job only.
 * Define what a Listener is inside the engine and provide
 * the single authorized way to construct a validated,
 * immutable Listener object.
 * No room validation. No speaker interaction. No acoustics.
 * No formatting. Pure domain model only.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A LISTENER IN THIS ENGINE?
 * ─────────────────────────────────────────────────────────
 * A Listener represents the primary listening position in
 * the room — the point in space around which all speaker
 * angles are measured.
 *
 * A Listener is not a seat. A seat is a piece of furniture
 * with dimensions, cushions, and a rake angle. A Listener
 * is the acoustic reference point: the location of the
 * listener's ears, and the direction they are facing.
 *
 * Every speaker angle in the engine (azimuth, elevation) is
 * defined relative to the Listener's position and orientation.
 * If the Listener moves or rotates, every derived speaker
 * angle changes. The Listener is the anchor of the entire
 * spatial audio geometry.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS earHeight?
 * ─────────────────────────────────────────────────────────
 * earHeight is the Y coordinate of the listener's ears —
 * the height of the listening position above the floor.
 *
 * In this engine it is derived directly from position.y.
 * They are the same value. earHeight exists as a named
 * field because its semantic meaning is different from
 * a generic Y coordinate:
 *
 *   position.y says: "this object is Y meters off the floor"
 *   earHeight  says: "the acoustic reference plane is here"
 *
 * Other engine modules that compute elevation angles,
 * vertical speaker offsets, or height-channel geometry
 * read earHeight explicitly. This makes the code self-
 * documenting — the reader knows immediately that this
 * Y value has acoustic significance, not just spatial.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A FORWARD VECTOR?
 * ─────────────────────────────────────────────────────────
 * A vector is a direction. The forwardVector tells the
 * engine which way the listener is facing in the horizontal
 * plane (the XZ plane — left/right and front/back).
 *
 * It is expressed as { x: number; z: number }, a 2D
 * direction in the horizontal plane. Y is omitted because
 * listeners face horizontally — they do not face up or down.
 *
 * The default forwardVector is { x: 0, z: -1 }.
 * This means the listener faces in the direction of
 * decreasing Z — toward the front wall (Z = 0), which is
 * where the screen is. This is the standard listening
 * orientation in every home theater.
 *
 * Why does the engine need a forward vector?
 * Azimuth angles (0° = in front, 90° = to the right) are
 * only meaningful relative to the direction the listener
 * faces. If a listener were rotated 45° in their seat,
 * "in front" would point at a different wall entirely.
 * The forwardVector captures that orientation so future
 * geometry calculations can rotate speaker positions
 * correctly when the listener is not facing straight forward.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS NORMALIZATION?
 * ─────────────────────────────────────────────────────────
 * A vector has two properties: direction and magnitude.
 * Magnitude is the vector's length — how long it is as a
 * line segment in space.
 *
 * A normalized vector has a magnitude of exactly 1.
 * It is a "unit vector" — it represents pure direction
 * with no concept of distance or scale.
 *
 * Why does this matter?
 *
 * Imagine two vectors:
 *   A = { x: 0, z: -1   }   magnitude = 1     (normalized)
 *   B = { x: 0, z: -100 }   magnitude = 100   (not normalized)
 *
 * Both point in exactly the same direction (straight ahead).
 * But when you use a vector in a dot product, cross product,
 * or angle calculation, the magnitude participates in the
 * math. If B is used where a unit vector is expected, the
 * result will be 100× too large.
 *
 * Normalization removes the magnitude:
 *   normalized vector = original vector / its own magnitude
 *
 * After normalization, the vector has length 1 and the math
 * works correctly regardless of what the original magnitude was.
 *
 * How to compute the magnitude of a 2D vector { x, z }:
 *   magnitude = √(x² + z²)
 *
 * How to normalize:
 *   normalized = { x: x / magnitude, z: z / magnitude }
 *
 * Example:
 *   { x: 3, z: 4 }
 *   magnitude = √(9 + 16) = √25 = 5
 *   normalized = { x: 3/5, z: 4/5 } = { x: 0.6, z: 0.8 }
 *   verify: √(0.36 + 0.64) = √1 = 1  ✓
 *
 * The engine requires forwardVector to always be normalized
 * so that every module consuming it can use it directly in
 * angle calculations without a normalization step of their own.
 * The factory enforces this at construction time.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * position coordinates are in METERS.
 * earHeight is in METERS.
 * forwardVector is dimensionless (unit vector, magnitude = 1).
 * No rounding. No formatting. No room validation.
 */

import { Point3D } from "./coordinateSystem"

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * ForwardVector is a normalized 2D direction in the
 * horizontal (XZ) plane representing which way the listener
 * is facing.
 *
 * Both components are dimensionless. The vector always has
 * magnitude 1 (it is a unit vector). See the normalization
 * explanation in the file header.
 *
 *   x — component along the width axis (positive = rightward)
 *   z — component along the depth axis (negative = toward front wall)
 *
 * Default: { x: 0, z: -1 } — facing the front wall (the screen).
 */
export type ForwardVector = {
  readonly x: number
  readonly z: number
}

/**
 * Listener is the canonical domain model for the primary
 * listening position in the room.
 *
 * Fields:
 *
 *   position — The 3D location of the listener's ears in
 *   meters, using the engine's coordinate system:
 *     x = distance from the left wall
 *     y = height of ears above the floor
 *     z = distance from the front wall
 *
 *   earHeight — The Y coordinate of the listening position,
 *   named explicitly for acoustic clarity. Always equal to
 *   position.y. See header explanation above.
 *
 *   forwardVector — The normalized horizontal direction the
 *   listener faces. Always has magnitude 1. Defaults to
 *   { x: 0, z: -1 } (facing the screen / front wall).
 *   See header explanation of normalization above.
 *
 * All fields are readonly. A Listener is immutable once
 * created. To reposition or reorient a listener, discard
 * the existing Listener and call createListener (and
 * optionally withForwardVector) with the new values.
 */
export type Listener = {
  readonly position: Point3D
  readonly earHeight: number
  readonly forwardVector: ForwardVector
}

// ─────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────

/**
 * Thrown when a forwardVector with zero magnitude is supplied.
 * A zero vector { x: 0, z: 0 } has no direction and cannot
 * be normalized. It does not represent a valid orientation.
 */
export class InvalidForwardVectorError extends Error {
  constructor() {
    super(
      "forwardVector cannot be a zero vector { x: 0, z: 0 }. " +
      "A forward vector must have a non-zero magnitude so it can " +
      "be normalized to represent a valid direction."
    )
    this.name = "InvalidForwardVectorError"
  }
}

// ─────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Normalizes a 2D XZ vector to unit length (magnitude = 1).
 *
 * Steps:
 *   1. Compute magnitude = √(x² + z²)
 *   2. Divide both components by magnitude
 *
 * Throws InvalidForwardVectorError if magnitude is 0,
 * because division by zero produces NaN and a zero vector
 * has no meaningful direction to normalize to.
 *
 * @param x  X component of the direction vector
 * @param z  Z component of the direction vector
 * @returns  A ForwardVector with magnitude exactly 1
 * @throws   InvalidForwardVectorError if x === 0 and z === 0
 */
function normalizeForwardVector(x: number, z: number): ForwardVector {
  const magnitude = Math.sqrt(x * x + z * z)

  if (magnitude === 0) {
    throw new InvalidForwardVectorError()
  }

  return {
    x: x / magnitude,
    z: z / magnitude,
  }
}

// ─────────────────────────────────────────────────────────
// FACTORIES
// ─────────────────────────────────────────────────────────

/**
 * Creates a fully validated, immutable Listener at the given
 * position, facing the front wall (the default orientation).
 *
 * earHeight is derived from position.y.
 * forwardVector is set to the default { x: 0, z: -1 },
 * representing a listener facing straight toward the screen.
 *
 * This is the standard construction path for the vast
 * majority of listening position definitions, where the
 * listener sits facing forward in a conventional theater.
 *
 * For non-standard orientations (angled seating rows, side
 * listener positions), use withForwardVector() after
 * creating the base Listener.
 *
 * @param position  The listener's ear position in meters (Point3D).
 *                  position.y represents the ear height above the floor.
 * @returns         A frozen, immutable Listener facing the front wall.
 *
 * Example:
 *   createListener({ x: 3, y: 1.2, z: 5 })
 *   → {
 *       position:      { x: 3, y: 1.2, z: 5 },
 *       earHeight:     1.2,
 *       forwardVector: { x: 0, z: -1 }
 *     }
 */
export function createListener(position: Point3D): Listener {
  return Object.freeze({
    position,
    earHeight: position.y,
    forwardVector: Object.freeze<ForwardVector>({ x: 0, z: -1 }),
  })
}

/**
 * Returns a new Listener identical to the given one but
 * with a different facing direction.
 *
 * The provided direction components are normalized
 * automatically — the caller does not need to pre-normalize.
 * Passing { x: 3, z: -4 } produces the same ForwardVector
 * as passing { x: 0.6, z: -0.8 } (both normalize to the
 * same unit vector).
 *
 * The original Listener is not modified. A new Listener is
 * returned with the updated forwardVector.
 *
 * @param listener  The base Listener to derive from (not modified)
 * @param x         X component of the new facing direction
 * @param z         Z component of the new facing direction
 * @returns         A new frozen Listener with normalized forwardVector
 * @throws          InvalidForwardVectorError if x === 0 and z === 0
 *
 * Examples:
 *   // Listener turned 45° toward their right
 *   withForwardVector(listener, 1, -1)
 *   → forwardVector: { x: 0.7071..., z: -0.7071... }
 *
 *   // Listener facing directly right (90° rotation)
 *   withForwardVector(listener, 1, 0)
 *   → forwardVector: { x: 1, z: 0 }
 *
 *   // Zero vector — throws
 *   withForwardVector(listener, 0, 0)
 *   → throws InvalidForwardVectorError
 */
export function withForwardVector(
  listener: Listener,
  x: number,
  z: number
): Listener {
  return Object.freeze({
    ...listener,
    forwardVector: normalizeForwardVector(x, z),
  })
}