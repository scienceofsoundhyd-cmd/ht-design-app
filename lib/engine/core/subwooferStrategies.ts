/**
 * subwooferStrategies.ts
 * Location: lib/engine/core/subwooferStrategies.ts
 *
 * RESPONSIBILITY: One job only.
 * Compute deterministic subwoofer positions from room
 * geometry using named acoustic placement strategies.
 * No registry interaction. No validation. No UI.
 * Pure geometry only.
 *
 * ─────────────────────────────────────────────────────────
 * WHY SUBWOOFER PLACEMENT IS DIFFERENT
 * ─────────────────────────────────────────────────────────
 * Every other speaker in the engine is placed by azimuth
 * and elevation angle relative to the listener. That works
 * because high- and mid-frequency sounds are directional —
 * your ears can tell where they come from.
 *
 * Bass frequencies below roughly 80 Hz are non-directional.
 * Your auditory system cannot localize them. You cannot tell
 * whether a 40 Hz tone is coming from in front, behind, or
 * beside you. This means azimuth and elevation angles are
 * acoustically meaningless for subwoofers.
 *
 * What does matter for subwoofers is their interaction with
 * the room itself. Bass wavelengths are long — a 40 Hz wave
 * is 8.5 meters long. When these long waves bounce between
 * parallel walls, they create standing waves (room modes):
 * zones of too much bass and zones of almost no bass.
 * Subwoofer placement determines which modes are excited
 * strongly and which are not.
 *
 * The strategies in this file are geometric approaches that
 * acoustic research and practice have identified as effective
 * at distributing bass energy more evenly across the room
 * than a single arbitrarily placed subwoofer.
 *
 * ─────────────────────────────────────────────────────────
 * WHY y = 0 FOR ALL STRATEGIES
 * ─────────────────────────────────────────────────────────
 * Subwoofers are floor-standing or floor-adjacent by
 * universal convention. They are heavy, require no
 * elevation for bass dispersion (bass is omnidirectional
 * in all three dimensions at low frequencies), and their
 * enclosures are designed to couple with the floor for
 * additional loading efficiency. Every position returned
 * by this file places the subwoofer on the floor (y = 0).
 *
 * ─────────────────────────────────────────────────────────
 * WHY THESE FOUR STRATEGIES
 * ─────────────────────────────────────────────────────────
 * "front-center"
 *   The industry default. One subwoofer below or beside
 *   the center screen speaker. Simple, inexpensive, and
 *   effective in smaller rooms where mode control is less
 *   critical. Standard starting point.
 *
 * "midpoints-opposing-walls"
 *   Two subwoofers at the midpoints of the front and rear
 *   walls. This is the simplest multi-sub arrangement and
 *   is known to cancel the primary axial room mode along
 *   the length axis (the strongest mode in most rooms).
 *   Todd Welti's research at Harman International
 *   established this as one of the highest-performing
 *   two-sub configurations for seat-to-seat consistency.
 *
 * "four-corners"
 *   Four subwoofers in the four floor corners of the room.
 *   Corner placement maximizes the coupling of the
 *   subwoofer to all three axial room modes simultaneously
 *   (it is the point where X, Y, and Z mode pressures all
 *   peak at once). Four-corner arrays are used in reference
 *   screening rooms and high-end home theaters. They produce
 *   the most even bass distribution across multiple seats
 *   when all four units are driven in phase.
 *
 * "quarter-points"
 *   Four subwoofers at the quarter-length points along the
 *   side walls (at L/4 and 3L/4 from the front wall, on
 *   both left and right walls). This strategy is derived
 *   from standing wave theory: placing drivers at the
 *   pressure maxima of specific room modes energizes them
 *   while simultaneously avoiding the null of others.
 *   Particularly effective in long rooms where the length
 *   axis produces the most problematic low-frequency modes.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All inputs (room dimensions) are in METERS.
 * All returned positions are in METERS.
 * y is always 0 (floor level).
 * No rounding. No formatting. No randomness.
 */

import { Point3D } from "./coordinateSystem"
import { Room } from "./room"

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * SubwooferStrategy names the geometric placement approach
 * to use when computing subwoofer positions.
 *
 * Each strategy maps to a specific set of positions derived
 * from the room's dimensions. The number of subwoofers
 * implied by each strategy:
 *
 *   "front-center"              → 1 subwoofer
 *   "midpoints-opposing-walls"  → 2 subwoofers
 *   "four-corners"              → 4 subwoofers
 *   "quarter-points"            → 4 subwoofers
 */
export type SubwooferStrategy =
  | "front-center"
  | "midpoints-opposing-walls"
  | "four-corners"
  | "quarter-points"

// ─────────────────────────────────────────────────────────
// STRATEGY IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────

/**
 * "front-center" strategy.
 *
 * Places a single subwoofer at the midpoint of the front
 * wall on the floor.
 *
 * Position formula:
 *   x = room.width / 2     → horizontal center of the room
 *   y = 0                  → floor
 *   z = 0                  → against the front wall
 *
 * Why the center of the front wall?
 * The front wall (z = 0) is where the screen and main
 * speakers live. Placing the sub here keeps the LFE channel
 * perceptually co-located with the front stage even though
 * bass is non-directional — avoiding any sense that the bass
 * "comes from a different place" than the dialogue and music.
 * Centering on the width axis (x = width / 2) gives the
 * subwoofer equal coupling to both side walls, which
 * symmetrically excites left-right room modes rather than
 * favoring one side.
 *
 * @param room  A valid Room with width, length, height in meters
 * @returns     Array containing one Point3D
 */
function frontCenter(room: Room): Point3D[] {
  return [
    {
      x: room.width / 2,
      y: 0,
      z: 0,
    },
  ]
}

/**
 * "midpoints-opposing-walls" strategy.
 *
 * Places two subwoofers at the midpoints of the front and
 * rear walls on the floor.
 *
 * Position formulas:
 *   Front sub:
 *     x = room.width / 2   → horizontal center
 *     y = 0                → floor
 *     z = 0                → front wall
 *
 *   Rear sub:
 *     x = room.width / 2   → horizontal center
 *     y = 0                → floor
 *     z = room.length      → rear wall
 *
 * Why this works acoustically:
 * The primary axial room mode along the length (Z axis)
 * creates a standing wave with a pressure maximum at both
 * the front wall (z = 0) and the rear wall (z = length).
 * Both subwoofers are at the same lateral position (x = W/2),
 * so they drive the width axis modes identically. When driven
 * in the same polarity, the two subs energize the length-axis
 * mode at both of its maxima simultaneously. Counterintuitively,
 * this can actually reduce the severity of seat-to-seat
 * variation compared to a single sub, because the two
 * sources create a more spatially uniform field between
 * them through constructive and destructive interference
 * that partially smooths the modal peaks and dips.
 *
 * @param room  A valid Room with width, length, height in meters
 * @returns     Array containing two Point3D values [front, rear]
 */
function midpointsOpposingWalls(room: Room): Point3D[] {
  return [
    {
      x: room.width / 2,
      y: 0,
      z: 0,             // front wall
    },
    {
      x: room.width / 2,
      y: 0,
      z: room.length,   // rear wall
    },
  ]
}

/**
 * "four-corners" strategy.
 *
 * Places four subwoofers in the four floor corners of the room.
 *
 * Position formulas:
 *   Front-left corner:  x = 0,           z = 0
 *   Front-right corner: x = room.width,  z = 0
 *   Rear-left corner:   x = 0,           z = room.length
 *   Rear-right corner:  x = room.width,  z = room.length
 *   All four:           y = 0  (floor)
 *
 * Why corners?
 * In a rectangular room, every axial room mode has a
 * pressure maximum at the walls. A corner is where two
 * walls meet — so it is simultaneously a pressure maximum
 * for both the X-axis modes and the Z-axis modes. The
 * floor adds a third boundary: the corner is also a
 * pressure maximum for Y-axis modes. This makes a floor
 * corner the most "energetically active" point in the room
 * for all three primary mode families at once.
 *
 * Four subwoofers in the four corners, driven in phase,
 * excite all axial modes simultaneously and symmetrically.
 * Research has shown that this symmetric excitation
 * produces the most spatially uniform bass response across
 * multiple listening seats of any placement strategy.
 *
 * Order: front-left, front-right, rear-left, rear-right.
 * This is the conventional order used in calibration
 * software and installation references.
 *
 * @param room  A valid Room with width, length, height in meters
 * @returns     Array containing four Point3D values
 */
function fourCorners(room: Room): Point3D[] {
  return [
    { x: 0,          y: 0, z: 0           }, // front-left
    { x: room.width, y: 0, z: 0           }, // front-right
    { x: 0,          y: 0, z: room.length }, // rear-left
    { x: room.width, y: 0, z: room.length }, // rear-right
  ]
}

/**
 * "quarter-points" strategy.
 *
 * Places four subwoofers at the quarter-length positions
 * along the left and right side walls on the floor.
 *
 * Quarter-length positions along the Z axis:
 *   First quarter:  z = room.length / 4        (L/4 from front)
 *   Third quarter:  z = (room.length / 4) * 3  (3L/4 from front)
 *
 * Position formulas:
 *   Left wall, L/4:    x = 0,          z = room.length / 4
 *   Right wall, L/4:   x = room.width, z = room.length / 4
 *   Left wall, 3L/4:   x = 0,          z = (room.length / 4) * 3
 *   Right wall, 3L/4:  x = room.width, z = (room.length / 4) * 3
 *   All four:          y = 0  (floor)
 *
 * Why quarter points?
 * Standing wave theory tells us that the second-order axial
 * mode along the room length has pressure maxima at the
 * front wall, midpoint, and rear wall — and pressure nulls
 * (zero pressure) at the quarter points (L/4 and 3L/4).
 *
 * Placing drivers at L/4 and 3L/4 means they sit at the
 * nulls of the second-order mode. A subwoofer at the null
 * of a mode does not excite that mode — it couples to it
 * very weakly. This is beneficial when the second-order
 * mode is the most problematic resonance in the room
 * (common in rooms with a length-to-width ratio near 2:1).
 *
 * Simultaneously, L/4 and 3L/4 are located away from the
 * walls where the first-order mode peaks, giving the
 * strategy a different coupling profile than corner
 * placement — useful when the four-corners approach
 * over-emphasizes the fundamental room mode.
 *
 * Placing subs on both side walls at each depth creates
 * left-right symmetry, preventing uneven loading of the
 * width-axis modes.
 *
 * Order: left-front-quarter, right-front-quarter,
 *        left-rear-quarter, right-rear-quarter.
 *
 * @param room  A valid Room with width, length, height in meters
 * @returns     Array containing four Point3D values
 */
function quarterPoints(room: Room): Point3D[] {
  const zFront = room.length / 4
  const zRear  = (room.length / 4) * 3

  return [
    { x: 0,          y: 0, z: zFront }, // left wall,  L/4
    { x: room.width, y: 0, z: zFront }, // right wall, L/4
    { x: 0,          y: 0, z: zRear  }, // left wall,  3L/4
    { x: room.width, y: 0, z: zRear  }, // right wall, 3L/4
  ]
}

// ─────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────

/**
 * Computes subwoofer floor positions for the given room
 * using the specified placement strategy.
 *
 * Returns an array of Point3D values representing the
 * recommended subwoofer positions in room coordinates.
 * All returned positions have y = 0 (floor level).
 *
 * The number of positions returned depends on the strategy:
 *   "front-center"             → 1 position
 *   "midpoints-opposing-walls" → 2 positions
 *   "four-corners"             → 4 positions
 *   "quarter-points"           → 4 positions
 *
 * This function performs no validation. It trusts that the
 * room was created by createRoom and therefore has valid
 * positive dimensions. It does not check whether the
 * returned positions are inside the room — by construction
 * they always are, since every formula uses values in the
 * range [0, room.dimension] on each axis.
 *
 * This is a pure function. No side effects. No mutation.
 * No randomness. Same room and same strategy always produce
 * the same positions.
 *
 * @param room      A valid Room with dimensions in meters
 * @param strategy  The geometric placement strategy to apply
 * @returns         Array of Point3D positions in meters, y = 0
 *
 * Examples — room 6m wide × 3m tall × 9m deep:
 *
 *   computeSubwooferPositions(room, "front-center")
 *     → [{ x: 3, y: 0, z: 0 }]
 *
 *   computeSubwooferPositions(room, "midpoints-opposing-walls")
 *     → [{ x: 3, y: 0, z: 0 }, { x: 3, y: 0, z: 9 }]
 *
 *   computeSubwooferPositions(room, "four-corners")
 *     → [{ x: 0, y: 0, z: 0 }, { x: 6, y: 0, z: 0 },
 *        { x: 0, y: 0, z: 9 }, { x: 6, y: 0, z: 9 }]
 *
 *   computeSubwooferPositions(room, "quarter-points")
 *     → [{ x: 0, y: 0, z: 2.25 }, { x: 6, y: 0, z: 2.25 },
 *        { x: 0, y: 0, z: 6.75 }, { x: 6, y: 0, z: 6.75 }]
 */
export function computeSubwooferPositions(
  room: Room,
  strategy: SubwooferStrategy
): Point3D[] {
  switch (strategy) {
    case "front-center":
      return frontCenter(room)
    case "midpoints-opposing-walls":
      return midpointsOpposingWalls(room)
    case "four-corners":
      return fourCorners(room)
    case "quarter-points":
      return quarterPoints(room)
  }
}