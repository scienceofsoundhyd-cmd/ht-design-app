/**
 * speakerPlacement.ts
 * Location: lib/engine/core/speakerPlacement.ts
 *
 * RESPONSIBILITY: One job only.
 * Compute a speaker's absolute 3D position from a Listener's
 * position and orientation, an azimuth angle, an elevation
 * angle, and a distance.
 * No validation against room bounds. No Speaker construction.
 * No acoustics. No formatting. Pure geometry only.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT CHANGED FROM THE PREVIOUS VERSION
 * ─────────────────────────────────────────────────────────
 * The previous version assumed the listener always faces
 * directly toward the front wall — negative Y direction.
 * That is the common case, but it is a hardcoded assumption
 * that breaks the moment a listener is in an angled seat,
 * a side row, or a non-rectangular room configuration.
 *
 * This version accepts a full Listener object. The Listener
 * carries a forwardVector — the normalized direction the
 * listener actually faces. All angle calculations are now
 * relative to that vector, not to a hardcoded axis.
 *
 * For a listener facing the front wall (the default),
 * forwardVector = { x: 0, y: -1 } and the results are
 * identical to the previous version. The upgrade is fully
 * backward-compatible for the default orientation.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS VECTOR ROTATION? — EXPLAINED SIMPLY
 * ─────────────────────────────────────────────────────────
 * In the previous version, azimuth angles were split into
 * X and Y offsets using sin and cos directly against the
 * world axes:
 *
 *   Δx = horizontalReach × sin(azimuth)   ← always world-X
 *   Δy = horizontalReach × cos(azimuth)   ← always world-Y
 *
 * This only works when the listener faces exactly along the
 * world Y axis. "Right" always meant +X and "forward" always
 * meant −Y. Those are world-axis assumptions, not listener
 * orientation facts.
 *
 * With an arbitrary forwardVector, "forward" and "right" in
 * the listener's frame of reference must be computed first,
 * and then the angle offsets are applied along those
 * listener-relative directions rather than the world axes.
 *
 * A concrete analogy:
 *   You are standing in a room facing the screen.
 *   "One step to your right" moves you in +X (world right).
 *   Now rotate 90° so you face the right wall.
 *   "One step to your right" now moves you in +Y (toward back wall).
 *   The step size and angle haven't changed. Only the frame
 *   of reference — what "right" points at in world space —
 *   has changed.
 *
 * Vector rotation is how we compute where "forward" and
 * "right" point in world coordinates for any listener
 * orientation, and then use those world-space directions
 * to convert listener-relative angles into world offsets.
 *
 * ─────────────────────────────────────────────────────────
 * THE FORWARD VECTOR
 * ─────────────────────────────────────────────────────────
 * The Listener's forwardVector is a normalized unit vector
 * in the XY plane representing the direction they face.
 *
 * Default (listener faces the screen):
 *   forward = { x: 0, y: -1 }
 *
 * Listener rotated 45° to the right (angled seat):
 *   forward = { x: 0.7071, y: -0.7071 }
 *
 * Listener facing the right wall (90° rotation):
 *   forward = { x: 1, y: 0 }
 *
 * The forward vector is always normalized (magnitude = 1)
 * because listener.ts enforces normalization at construction.
 * This file trusts that contract and uses it directly.
 *
 * ─────────────────────────────────────────────────────────
 * DERIVING THE RIGHT VECTOR
 * ─────────────────────────────────────────────────────────
 * Given a forward vector, the right vector is a 90°
 * clockwise rotation of it in the horizontal (XY) plane.
 *
 * "Clockwise" here means: if you stand at the origin and
 * look down the Z axis toward the floor, a clockwise turn
 * of the forward arrow gives you the right arrow.
 *
 * The formula for a 90° clockwise rotation in XY is:
 *
 *   right = { x: -forward.y, y: forward.x }
 *
 * Intuition:
 *   Start with forward = { x: 0, y: -1 } (facing screen).
 *   right = { x: -(-1), y: 0 } = { x: 1, y: 0 }
 *   ✓ Positive X is indeed to the listener's right.
 *
 *   Rotate listener 90° rightward: forward = { x: 1, y: 0 }.
 *   right = { x: -(0), y: 1 } = { x: 0, y: 1 }
 *   ✓ If you face right, your right is toward the back wall (+Y). Correct.
 *
 *   Rotate listener 45°: forward = { x: 0.7071, y: -0.7071 }.
 *   right = { x: 0.7071, y: 0.7071 }
 *   ✓ Points diagonally right and forward — correct for a 45° angled seat.
 *
 * Why NOT { x: forward.y, y: -forward.x }?
 * That formula produces a 90° COUNTER-clockwise rotation,
 * which is the listener's LEFT vector. Using it would make
 * positive azimuth go left and negative azimuth go right —
 * the opposite of the established engine convention.
 * The correct clockwise formula is { x: -forward.y, y: forward.x }.
 *
 * ─────────────────────────────────────────────────────────
 * HOW OFFSETS ARE COMPUTED IN TWO STEPS
 * ─────────────────────────────────────────────────────────
 * Step 1 — Compute how much of the horizontal reach goes
 * "forward" (in the listener's frame) and how much goes
 * "right" (in the listener's frame):
 *
 *   forward_amount = horizontalReach × cos(azimuth)
 *   right_amount   = horizontalReach × sin(azimuth)
 *
 *   At azimuth 0°:  forward_amount = full reach, right_amount = 0
 *   At azimuth 90°: forward_amount = 0, right_amount = full reach
 *
 * These are still just scalars (single numbers), not world
 * coordinates yet. They describe the split in listener space.
 *
 * Step 2 — Project onto world axes using the forward and
 * right vectors:
 *
 *   Δx = forward_amount × forward.x + right_amount × right.x
 *   Δy = forward_amount × forward.y + right_amount × right.y
 *
 * This turns the listener-relative amounts into world-space
 * offsets along the actual X and Y axes of the room.
 *
 * For the default orientation (forward = { x:0, y:-1 },
 * right = { x:1, y:0 }):
 *   Δx = forward_amount × 0  + right_amount × 1 = right_amount
 *   Δy = forward_amount × −1 + right_amount × 0 = −forward_amount
 *
 * Which simplifies to exactly what the previous version did:
 *   Δx = horizontalReach × sin(azimuth)
 *   Δy = −horizontalReach × cos(azimuth)
 *
 * The upgrade is a strict generalization. Default behavior
 * is preserved. Non-default orientations now work correctly.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * Input:  Listener object (position in meters, normalized forwardVector)
 *         azimuth in degrees    (converted to radians internally)
 *         elevation in degrees  (converted to radians internally)
 *         distance in meters
 * Output: speaker position in meters (Point3D)
 * No rounding. No formatting. No mutation.
 */

import { Point3D } from "./coordinateSystem"
import { Listener } from "./listener"

// ─────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Converts an angle from degrees to radians.
 *
 * All JavaScript trigonometric functions (Math.sin, Math.cos)
 * require radians. This converts once at the entry point so
 * the rest of the computation works in the correct unit.
 *
 * Formula: radians = degrees × (π / 180)
 *
 * @param degrees  Angle in degrees
 * @returns        Equivalent angle in radians
 */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// ─────────────────────────────────────────────────────────
// PLACEMENT COMPUTATION
// ─────────────────────────────────────────────────────────

/**
 * Computes the absolute 3D position of a speaker given a
 * Listener (with position and orientation), an azimuth
 * angle, an elevation angle, and a distance.
 *
 * All angles are measured relative to the Listener's
 * forwardVector — the direction they actually face — not
 * relative to a fixed world axis. This makes the function
 * correct for any listener orientation.
 *
 * Engine coordinate system:
 *   X axis → left to right    (positive X = room's right side)
 *   Y axis → front to back    (positive Y = toward back wall)
 *   Z axis → floor to ceiling (positive Z = upward)
 *   Origin  → front-left floor corner of the room
 *
 * Angle conventions (all relative to listener's facing direction):
 *   Azimuth  0°   = directly in front of the listener
 *   Azimuth  90°  = directly to listener's right
 *   Azimuth -90°  = directly to listener's left
 *   Azimuth  180° = directly behind the listener
 *   Elevation  0° = at listener's ear level
 *   Elevation 90° = directly above the listener's head
 *
 * The result is the speaker's position in absolute room
 * coordinates. The caller is responsible for validating
 * that the result is inside the room before constructing
 * a Speaker or adding it to the registry.
 *
 * This is a pure function. No side effects. No mutation.
 * No validation. No rounding.
 *
 * @param listener     A Listener object with position (meters) and
 *                     a normalized forwardVector describing orientation.
 * @param azimuthDeg   Horizontal angle in degrees, relative to listener.
 *                     0° = in front. Positive = toward listener's right.
 * @param elevationDeg Vertical angle in degrees, relative to ear level.
 *                     0° = ear level. Positive = upward.
 * @param distance     Distance from listener to speaker in meters.
 * @returns            The speaker's absolute position (Point3D) in meters.
 *
 * ─────────────────────────────────────────────────────────
 * WORKED EXAMPLES
 * ─────────────────────────────────────────────────────────
 * Listener at { x: 3, y: 5, z: 1.2 }, facing default { x:0, y:-1 }:
 * distance = 2m
 *
 *   forward = { x: 0, y: -1 }
 *   right   = { x: 1, y:  0 }    ← -(-1), 0
 *
 *   Center speaker (azimuth: 0°, elevation: 0°):
 *     horizontalReach  = 2 × cos(0°) = 2
 *     forward_amount   = 2 × cos(0°) = 2
 *     right_amount     = 2 × sin(0°) = 0
 *     Δx = 2×0 + 0×1 = 0
 *     Δy = 2×(−1) + 0×0 = −2
 *     Δz = 2 × sin(0°) = 0
 *     → { x: 3, y: 3, z: 1.2 }   (2m in front of listener)
 *
 *   Right speaker (azimuth: 30°, elevation: 0°):
 *     horizontalReach  = 2
 *     forward_amount   = 2 × cos(30°) ≈ 1.732
 *     right_amount     = 2 × sin(30°) = 1
 *     Δx = 1.732×0 + 1×1 = 1
 *     Δy = 1.732×(−1) + 1×0 ≈ −1.732
 *     → { x: 4, y: ≈3.268, z: 1.2 }
 *
 *   Left surround (azimuth: −110°, elevation: 0°):
 *     forward_amount   = 2 × cos(−110°) ≈ −0.684
 *     right_amount     = 2 × sin(−110°) ≈ −1.879
 *     Δx = −0.684×0 + (−1.879)×1 ≈ −1.879
 *     Δy = −0.684×(−1) + (−1.879)×0 ≈ 0.684
 *     → { x: ≈1.121, y: ≈5.684, z: 1.2 }
 *
 * Listener rotated 90° right: forward = { x:1, y:0 }, right = { x:0, y:1 }
 *
 *   Center speaker (azimuth: 0°, elevation: 0°):
 *     forward_amount = 2, right_amount = 0
 *     Δx = 2×1 + 0×0 = 2
 *     Δy = 2×0 + 0×1 = 0
 *     → { x: 5, y: 5, z: 1.2 }   ("forward" now = +X direction)
 */
export function computeSpeakerPosition(
  listener: Listener,
  azimuthDeg: number,
  elevationDeg: number,
  distance: number
): Point3D {
  const azimuth   = degreesToRadians(azimuthDeg)
  const elevation = degreesToRadians(elevationDeg)

  // ── Derive the right vector from the listener's forward vector ──
  //
  // The right vector is a 90° clockwise rotation of the forward
  // vector in the XY plane (viewed from above with Z pointing up).
  //
  // Clockwise rotation formula: { x: -forward.y, y: forward.x }
  //
  // Verify with default forward { x: 0, y: -1 }:
  //   right = { x: -(-1), y: 0 } = { x: 1, y: 0 } ✓ (world right)
  const forward = listener.forwardVector
  const right = {
    x: -forward.y,
    y:  forward.x,
  }

  // ── Horizontal reach ──
  //
  // How far the speaker is from the listener in the horizontal
  // plane only, before applying orientation. Elevation reduces
  // this: a speaker high above you is less "far away" horizontally
  // than the full distance suggests.
  const horizontalReach = distance * Math.cos(elevation)

  // ── Listener-space decomposition ──
  //
  // Split the horizontal reach into:
  //   how much goes in the listener's forward direction
  //   how much goes in the listener's right direction
  //
  // These are scalars in the listener's local frame — not
  // world coordinates yet.
  const forwardAmount = horizontalReach * Math.cos(azimuth)
  const rightAmount   = horizontalReach * Math.sin(azimuth)

  // ── Project into world space ──
  //
  // Multiply each listener-relative scalar by the corresponding
  // world-space direction vector and sum the contributions.
  //
  // This is the vector rotation step: it translates
  // "X units forward + Y units right in listener space"
  // into the correct Δx and Δy in world space for any
  // listener orientation.
  const dx = forwardAmount * forward.x + rightAmount * right.x
  const dy = forwardAmount * forward.y + rightAmount * right.y

  // ── Vertical offset ──
  //
  // Elevation is always in world Z — the engine's Z axis is
  // vertical and does not rotate with the listener's heading.
  // A speaker 45° above ear level is 45° above in world space
  // regardless of which way the listener faces horizontally.
  const dz = distance * Math.sin(elevation)

  return {
    x: listener.position.x + dx,
    y: listener.position.y + dy,
    z: listener.position.z + dz,
  }
}