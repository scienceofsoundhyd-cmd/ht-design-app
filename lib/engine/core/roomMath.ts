/**
 * roomMath.ts
 * Location: lib/engine/core/roomMath.ts
 *
 * RESPONSIBILITY: One job only.
 * This file contains pure geometric calculations about a room.
 * No unit conversions. No acoustic physics. No formatting.
 *
 * ─────────────────────────────────────────────────────────
 * WHY GEOMETRY IS SEPARATED FROM UNIT MATH
 * ─────────────────────────────────────────────────────────
 * units.ts answers the question: "How do I convert this
 * measurement into meters?"
 *
 * roomMath.ts answers the question: "Given a room's
 * dimensions in meters, what are its geometric properties?"
 *
 * These are different jobs. Mixing them causes two problems:
 *
 * Problem 1 — Hidden dependencies.
 * If roomVolume lived inside units.ts, you would import
 * units.ts and get geometric logic you did not ask for.
 * Any part of the engine that only needs mmToM() would also
 * carry roomVolume() along silently. In large codebases
 * this makes it impossible to understand what each module
 * actually does.
 *
 * Problem 2 — Fragile change surface.
 * If you need to update how the engine handles aspect ratios,
 * you should only have to open roomMath.ts. You should never
 * have to open units.ts to change geometry behavior. Keeping
 * them separate means a change in one cannot accidentally
 * break the other.
 *
 * This principle is called "Single Responsibility". Each file
 * has exactly one reason to change. units.ts changes when the
 * unit system changes. roomMath.ts changes when the geometry
 * model changes. They are independent.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All Room dimensions (width, length, height) must be in
 * METERS before being passed into any function here.
 *
 * This file trusts that the caller already ran values through
 * units.ts if they came from user input. It does not convert.
 * It only computes.
 *
 * All output values are in SI-derived units:
 *   - Volume in cubic meters (m³)
 *   - Surface area in square meters (m²)
 *   - Aspect ratios are dimensionless (pure ratios)
 *
 * No rounding. No toFixed. No formatting.
 */

import { Room } from "./types"

// ─────────────────────────────────────────────────────────
// VOLUME
// ─────────────────────────────────────────────────────────

/**
 * Calculates the total volume of a rectangular room.
 *
 * Geometry: volume (m³) = width × length × height
 *
 * Room volume is the single most important geometric property
 * in acoustic design. It determines:
 *   - How much low-frequency energy the room can accumulate
 *   - Reverberation time estimates (RT60)
 *   - Subwoofer pressurization potential
 *   - How many seats can fit at reference listening distances
 *
 * @param room  A Room object with width, length, height in meters
 * @returns     Volume in cubic meters (m³)
 *
 * Example: roomVolume({ width: 5, length: 8, height: 3 }) → 120
 */
export function roomVolume(room: Room): number {
  return room.width * room.length * room.height
}

// ─────────────────────────────────────────────────────────
// SURFACE AREA
// ─────────────────────────────────────────────────────────

/**
 * Calculates the total surface area of all six walls of a
 * rectangular room (floor, ceiling, and four walls).
 *
 * Geometry: area (m²) = 2 × (W×L + W×H + L×H)
 *
 * Where:
 *   W×L = floor and ceiling (two surfaces)
 *   W×H = front and rear walls (two surfaces)
 *   L×H = left and right walls (two surfaces)
 *
 * Surface area drives acoustic treatment calculations.
 * More surface area means more room for absorption panels,
 * diffusers, and bass traps. It is also the denominator in
 * Sabine's formula for reverberation time estimation.
 *
 * @param room  A Room object with width, length, height in meters
 * @returns     Total surface area in square meters (m²)
 *
 * Example: roomSurfaceArea({ width: 5, length: 8, height: 3 })
 *   = 2 × (5×8 + 5×3 + 8×3)
 *   = 2 × (40 + 15 + 24)
 *   = 2 × 79
 *   = 158 m²
 */
export function roomSurfaceArea(room: Room): number {
  const { width: W, length: L, height: H } = room
  return 2 * (W * L + W * H + L * H)
}

// ─────────────────────────────────────────────────────────
// ASPECT RATIOS
// ─────────────────────────────────────────────────────────

/**
 * Calculates all three pairwise dimension ratios of the room.
 *
 * A ratio is a dimensionless comparison of two lengths.
 * It describes the shape of the room independent of its size.
 *
 * Returns:
 *   wl — width-to-length ratio
 *   wh — width-to-height ratio
 *   lh — length-to-height ratio
 *
 * Why aspect ratios matter in acoustic design:
 *
 * Room modes (standing waves) occur at frequencies whose
 * wavelengths are exact multiples of room dimensions. If two
 * or more dimensions share the same ratio (e.g., 1:2 or 1:3),
 * their room modes overlap at the same frequencies, causing
 * severe peaks and nulls in the bass response.
 *
 * Well-designed rooms use irrational or non-coincident ratios
 * like 1 : 1.618 (golden ratio) or the ITU/EBU recommended
 * ratios (e.g., 1 : 1.4 : 1.9) to spread modal energy across
 * different frequencies rather than concentrating it.
 *
 * These raw ratios are the input to the modal analysis layer.
 * No rounding here — the modal analysis needs full precision.
 *
 * @param room  A Room object with width, length, height in meters
 * @returns     Object with three dimensionless ratios
 *
 * Example: roomAspectRatios({ width: 4, length: 6, height: 2.7 })
 *   → { wl: 0.6666..., wh: 1.4814..., lh: 2.2222... }
 */
export function roomAspectRatios(room: Room): { wl: number; wh: number; lh: number } {
  return {
    wl: room.width  / room.length,
    wh: room.width  / room.height,
    lh: room.length / room.height,
  }
}