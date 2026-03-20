/**
 * subwooferInstaller.ts
 * Location: lib/engine/core/subwooferInstaller.ts
 *
 * RESPONSIBILITY: One job only.
 * Translate the geometric positions returned by
 * computeSubwooferPositions into validated Speaker objects
 * and add them to the registry.
 * No geometry. No angle math. No preset logic. No UI.
 * Pure orchestration of existing layers.
 *
 * ─────────────────────────────────────────────────────────
 * HOW THIS FILE FITS INTO THE ENGINE
 * ─────────────────────────────────────────────────────────
 * subwooferStrategies.ts answers: "Where should the
 * subwoofers go in this room?"
 * It returns raw Point3D positions — just coordinates.
 *
 * This file answers: "Given those positions, create the
 * Speaker objects and put them in the registry."
 *
 * Two separate jobs. Two separate files. The geometry layer
 * does not know about the registry. The installer layer does
 * not know about geometry. They are connected here and only
 * here, in the same way speakerInstaller.ts connects
 * speakerPlacement.ts to the registry.
 *
 * ─────────────────────────────────────────────────────────
 * HOW THE LOOP WORKS — EXPLAINED SIMPLY
 * ─────────────────────────────────────────────────────────
 * computeSubwooferPositions returns an array of positions.
 * The number of positions depends on the strategy:
 *   "front-center"             → [pos1]
 *   "midpoints-opposing-walls" → [pos1, pos2]
 *   "four-corners"             → [pos1, pos2, pos3, pos4]
 *   "quarter-points"           → [pos1, pos2, pos3, pos4]
 *
 * This file loops over that array. For each position it
 * needs both the position itself and its index (0, 1, 2, 3)
 * because the index is used to build the id:
 *   index 0 → "subwoofer-1"
 *   index 1 → "subwoofer-2"
 *   index 2 → "subwoofer-3"
 *   index 3 → "subwoofer-4"
 *
 * JavaScript's Array.entries() provides both at once:
 *   for (const [index, position] of positions.entries())
 *
 * This is called "destructuring" — pulling two values out
 * of a pair in a single statement. It is equivalent to:
 *   for (let i = 0; i < positions.length; i++) {
 *     const index    = i
 *     const position = positions[i]
 *     ...
 *   }
 *
 * The entries() form is cleaner and avoids the risk of
 * using the wrong index variable in a nested loop.
 *
 * ─────────────────────────────────────────────────────────
 * WHY THE REGISTRY IS REASSIGNED ON EVERY ITERATION
 * ─────────────────────────────────────────────────────────
 * addObject never modifies its input registry. It returns
 * a brand new registry containing everything the original
 * had plus the new object. If we did not capture and
 * reassign after each call, every iteration would add its
 * speaker to the same original empty registry, discarding
 * all previous work. Only the last speaker would survive.
 *
 * The correct pattern:
 *   let current = registry            // start: 0 subs
 *   current = addObject(current, sub1) // now: 1 sub
 *   current = addObject(current, sub2) // now: 2 subs
 *   current = addObject(current, sub3) // now: 3 subs
 *   current = addObject(current, sub4) // now: 4 subs
 *   return current
 *
 * The original registry passed into installSubwoofers is
 * never modified. If any iteration throws (e.g. a position
 * is outside the room), the error propagates and the
 * original registry remains intact.
 *
 * ─────────────────────────────────────────────────────────
 * WHY ERRORS PROPAGATE NATURALLY
 * ─────────────────────────────────────────────────────────
 * createSpeaker can throw SpeakerOutOfBoundsError if a
 * computed position is somehow outside the room bounds.
 * addObject can throw DuplicateObjectIdError if a
 * "subwoofer-N" id already exists in the registry.
 *
 * This function catches neither. The caller is the only
 * party that knows how to respond — abort entirely, retry
 * with a different strategy, or surface a user message.
 * Catching errors here and swallowing them would hide
 * real problems silently.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All positions are in METERS (from computeSubwooferPositions).
 * No rounding. No formatting. No mutation of any input.
 */

import { ObjectRegistry, addObject } from "./objectRegistry"
import { SubwooferStrategy, computeSubwooferPositions } from "./subwooferStrategies"
import { createSpeaker } from "./speaker"

// ─────────────────────────────────────────────────────────
// INSTALLER
// ─────────────────────────────────────────────────────────

/**
 * Computes subwoofer positions for the room using the given
 * strategy, constructs a validated Speaker for each position,
 * and adds them all to the registry.
 *
 * Steps performed for each subwoofer position:
 *   1. Build an id: "subwoofer-1", "subwoofer-2", etc.
 *   2. Call createSpeaker with role "subwoofer" and the
 *      computed position. This validates the position is
 *      inside room bounds and returns an immutable Speaker.
 *   3. Call addObject to add the Speaker to the registry.
 *      This checks for duplicate ids and returns a new
 *      registry containing the added speaker.
 *   4. Reassign the working registry to the new one.
 *
 * The original registry is never modified. Each iteration
 * produces a new registry. If any step throws, the error
 * propagates to the caller and the original registry is
 * untouched.
 *
 * The room used for geometry and validation is read directly
 * from registry.room. The caller does not need to pass the
 * room separately — it is always present on the registry.
 *
 * @param registry  The current ObjectRegistry (not modified).
 *                  registry.room provides the room geometry
 *                  for both position computation and bounds
 *                  validation.
 * @param strategy  The SubwooferStrategy that determines how
 *                  many subwoofers to place and where.
 * @returns         A new ObjectRegistry containing all newly
 *                  added subwoofers plus everything the
 *                  original registry already held.
 * @throws          SpeakerOutOfBoundsError if any computed
 *                  position is outside the room. This should
 *                  never occur for a valid room since all
 *                  strategy formulas produce positions within
 *                  [0, dimension] on each axis, but the check
 *                  is performed by createSpeaker regardless.
 * @throws          DuplicateObjectIdError if any "subwoofer-N"
 *                  id already exists in the registry.
 *
 * ─────────────────────────────────────────────────────────
 * EXAMPLES
 * ─────────────────────────────────────────────────────────
 * const room     = createRoom(7, 3, 10)
 * const registry = createObjectRegistry(room)
 *
 * // Single sub, front-center:
 * const r1 = installSubwoofers(registry, "front-center")
 * r1.objects.size                   → 1
 * r1.objects.get("subwoofer-1")     → Speaker at { x:3.5, y:0, z:0 }
 *
 * // Two subs, opposing walls:
 * const r2 = installSubwoofers(registry, "midpoints-opposing-walls")
 * r2.objects.size                   → 2
 * r2.objects.get("subwoofer-1")     → Speaker at { x:3.5, y:0, z:0 }
 * r2.objects.get("subwoofer-2")     → Speaker at { x:3.5, y:0, z:10 }
 *
 * // Four subs, corners:
 * const r3 = installSubwoofers(registry, "four-corners")
 * r3.objects.size                   → 4
 * r3.objects.get("subwoofer-1")     → Speaker at { x:0, y:0, z:0 }
 * r3.objects.get("subwoofer-4")     → Speaker at { x:7, y:0, z:10 }
 *
 * // Combined with a main layout — subs added on top:
 * const withMains = installLayoutPreset(registry, PRESET_7_1_4, listener, 2)
 * const withAll   = installSubwoofers(withMains, "four-corners")
 * withAll.objects.size              → 15  (11 mains + 4 subs)
 */
export function installSubwoofers(
  registry: ObjectRegistry,
  strategy: SubwooferStrategy
): ObjectRegistry {
  // Compute all subwoofer positions for the room in one call.
  // The room geometry comes directly from the registry.
  const positions = computeSubwooferPositions(registry.room, strategy)

  // Start with the registry as given. Each iteration produces
  // a new registry one subwoofer richer. The original is
  // never touched.
  let current = registry

  for (const [index, position] of positions.entries()) {
    // ids are 1-based ("subwoofer-1" not "subwoofer-0")
    // because "subwoofer-1" is how installers, calibration
    // software, and AVR interfaces label multiple subs.
    const id = `subwoofer-${index + 1}`

    // Construct a validated, immutable Speaker.
    // createSpeaker verifies the position is inside room bounds
    // and automatically sets isSubwoofer = true for this role.
    const speaker = createSpeaker(id, "subwoofer", position, registry.room)

    // Add to the working registry. addObject checks for
    // duplicate ids and returns a new registry — the old
    // one is unchanged.
    current = addObject(current, speaker)
  }

  return current
}