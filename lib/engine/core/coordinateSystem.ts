/**
 * coordinateSystem.ts
 * Location: lib/engine/core/coordinateSystem.ts
 *
 * RESPONSIBILITY: One job only.
 * Define the 3D spatial coordinate system used by the engine
 * and validate that positions exist inside a room.
 * No acoustics. No unit conversion. No geometry math. No formatting.
 *
 * ─────────────────────────────────────────────────────────
 * THE COORDINATE SYSTEM — EXPLAINED SIMPLY
 * ─────────────────────────────────────────────────────────
 * Imagine you are standing at the front-left corner of the
 * room, with your back against the corner where the front
 * wall and the left wall meet, and your feet on the floor.
 * That exact corner is the origin: the point (0, 0, 0).
 * Every position in the room is described as a distance
 * from that corner along three directions.
 *
 *   X axis — Width direction.
 *   Extends from the left wall toward the right wall.
 *   X = 0 is the left wall.
 *   X = room width is the right wall.
 *   Moving right increases X.
 *
 *   Y axis — Length direction (depth into the room).
 *   Extends from the front wall toward the back wall.
 *   Y = 0 is the front wall (where the screen is).
 *   Y = room length is the back wall.
 *   Moving deeper into the room increases Y.
 *
 *   Z axis — Height direction.
 *   Extends from the floor toward the ceiling.
 *   Z = 0 is the floor.
 *   Z = room height is the ceiling.
 *   Moving upward increases Z.
 *
 * Visual diagram (top-down view):
 *
 *   (0,0,z) ←── front-left     front-right ──→ (W,0,z)
 *      │  FRONT WALL (screen)                       │
 *      │                                            │
 *      │  Y increases going into the page (depth)   │
 *      │                                            │
 *      │  BACK WALL                                 │
 *   (0,L,z) ←── back-left       back-right ──→ (W,L,z)
 *
 * Visual diagram (side view, left wall):
 *
 *   (0,y,H) ──→ ceiling
 *      │
 *      │  Z increases going up
 *      │
 *   (0,y,0) ──→ floor
 *
 * ─────────────────────────────────────────────────────────
 * WHY THIS SPECIFIC ORIGIN?
 * ─────────────────────────────────────────────────────────
 * Placing the origin at the front-left floor corner means
 * every coordinate inside a valid room is a positive number.
 * There are no negative coordinates for interior positions.
 * This makes all math simpler to write, simpler to read, and
 * simpler to validate. A speaker at (-0.3, 1.2, 0.5) is
 * immediately obviously wrong without needing context.
 *
 * ─────────────────────────────────────────────────────────
 * WHY ONE COORDINATE SYSTEM FOR THE WHOLE ENGINE?
 * ─────────────────────────────────────────────────────────
 * Every module in the engine — speaker placement, ray tracing,
 * modal analysis, seat positioning — describes positions in
 * space. If different modules used different origins or
 * different axis directions, converting between them would
 * introduce errors and require translation code everywhere.
 *
 * A single, locked coordinate system means every module
 * speaks the same spatial language. A position computed in
 * the speaker placement module can be passed directly to the
 * ray tracing module with no translation. This is how
 * professional 3D engines (game engines, CAD tools, audio
 * simulation tools) are built.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All coordinates are in METERS.
 * Callers are responsible for converting inputs via units.ts
 * before constructing any Point3D or RoomBounds object.
 * This file does not convert. It only defines and validates.
 */

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * A single position in 3D space inside the room.
 *
 * All values are in meters.
 *
 *   x — distance from the left wall  (0 = left wall)
 *   y — distance from the front wall (0 = front wall / screen)
 *   z — distance from the floor      (0 = floor)
 *
 * Examples of valid points inside a 6m wide × 8m long × 3m tall room:
 *   { x: 3,   y: 4,   z: 1.2 }  ← center of room at ear height
 *   { x: 0.5, y: 0.5, z: 0   }  ← near the front-left floor corner
 *   { x: 6,   y: 8,   z: 3   }  ← the back-right ceiling corner exactly
 */
export type Point3D = {
  x: number
  y: number
  z: number
}

/**
 * The three interior dimensions of a rectangular room.
 *
 * All values are in meters.
 *
 *   width  — distance between the left wall and the right wall (X span)
 *   height — distance between the floor and the ceiling (Z span)
 *   length — distance between the front wall and the back wall (Y span)
 *
 * RoomBounds defines the valid region of space.
 * Any Point3D whose coordinates fall within [0, dimension]
 * on all three axes is a point inside this room.
 *
 * Note: This type intentionally mirrors the Room type in types.ts.
 * It exists here as the geometric authority. The Room type in
 * types.ts may carry additional domain fields (material data,
 * room name, etc.). RoomBounds is the minimal geometric contract
 * this module needs — nothing more.
 */
export type RoomBounds = {
  width: number
  height: number
  length: number
}

// ─────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────

/**
 * Checks whether a 3D point lies inside (or exactly on the
 * boundary of) a room.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT "BOUNDS CHECKING" MEANS — EXPLAINED SIMPLY
 * ─────────────────────────────────────────────────────────
 * A room is a box. The box has a minimum edge and a maximum
 * edge on each axis.
 *
 *   X: minimum = 0 (left wall),  maximum = width  (right wall)
 *   Y: minimum = 0 (front wall), maximum = length (back wall)
 *   Z: minimum = 0 (floor),      maximum = height (ceiling)
 *
 * Bounds checking asks: does this point's coordinate on each
 * axis fall between the minimum and maximum for that axis?
 * If all three axes pass, the point is inside the room.
 * If any one axis fails, the point is outside the room.
 *
 * Real example — room is 6m wide, 3m tall, 8m deep:
 *
 *   { x: 3,  y: 4,   z: 1.5 }  ✓  inside  (3≤6, 4≤8, 1.5≤3)
 *   { x: 7,  y: 4,   z: 1.5 }  ✗  outside (7 > width of 6)
 *   { x: 3,  y: 4,   z: -0.1}  ✗  outside (z below the floor)
 *   { x: 0,  y: 0,   z: 0   }  ✓  on the boundary (valid)
 *   { x: 6,  y: 8,   z: 3   }  ✓  on the boundary (valid)
 *
 * Boundary points (exactly on a wall, floor, or ceiling) are
 * considered valid. A speaker mounted flush against a wall is
 * a real and legal position.
 *
 * Why does the engine need this?
 * Before placing any object — a speaker, a seat, a measurement
 * microphone — the engine must confirm the position actually
 * exists inside the room. Without this check, a speaker could
 * be placed at z = 12 in an 8m deep room and the acoustic
 * calculations would silently produce nonsense results.
 * Bounds checking is the engine's first line of defense
 * against bad input data.
 *
 * This is a pure function. It reads two inputs and returns
 * a boolean. It changes nothing, logs nothing, throws nothing.
 *
 * @param point   A 3D position to test (all values in meters)
 * @param bounds  The room dimensions to test against (in meters)
 * @returns       true if the point is inside or on the room boundary
 *                false if the point is outside the room on any axis
 *
 * Examples:
 *   validatePointInsideRoom({ x: 3, y: 1.5, z: 4 }, { width: 6, height: 3, length: 8 })
 *     → true
 *
 *   validatePointInsideRoom({ x: 7, y: 1.5, z: 4 }, { width: 6, height: 3, length: 8 })
 *     → false  (x exceeds width)
 *
 *   validatePointInsideRoom({ x: 3, y: -0.1, z: 4 }, { width: 6, height: 3, length: 8 })
 *     → false  (y is below the floor)
 */
export function validatePointInsideRoom(
  point: Point3D,
  bounds: RoomBounds
): boolean {
  return (
    point.x >= 0 && point.x <= bounds.width  &&
    point.y >= 0 && point.y <= bounds.length &&
    point.z >= 0 && point.z <= bounds.height
  )
}