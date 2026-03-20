/**
 * speaker.ts
 * Location: lib/engine/core/speaker.ts
 *
 * RESPONSIBILITY: One job only.
 * Define what a Speaker is inside the engine.
 * Provide the single authorized way to construct a validated,
 * immutable Speaker object.
 * No angle math. No Dolby or Atmos layout logic. No frequency
 * response data yet. No room correction. No formatting.
 *
 * ─────────────────────────────────────────────────────────
 * WHY SPEAKER IS A SEPARATE FILE FROM PlaceableObject
 * ─────────────────────────────────────────────────────────
 * PlaceableObject defines the contract for anything that has
 * a position in a room. It is intentionally generic — it
 * knows nothing about what kind of object it is.
 *
 * Speaker extends that contract with domain-specific meaning.
 * A Speaker is a PlaceableObject that has an acoustic role
 * (left surround, center, subwoofer) and a channel identity.
 *
 * Keeping Speaker in its own file means:
 *   - placeable.ts stays generic and reusable for seats,
 *     panels, microphones, and any future object type
 *   - speaker.ts owns all speaker-specific decisions
 *   - Changes to speaker logic never touch placeable.ts
 *   - Changes to placement logic never touch speaker.ts
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A "ROLE"?
 * ─────────────────────────────────────────────────────────
 * A role describes what acoustic job a speaker performs in
 * the system. It is not the same as a physical position.
 *
 * The role answers the question: "What channel of audio does
 * this speaker reproduce?"
 *
 *   "front-left"      → the Left channel of the front stage
 *   "center"          → dialogue, anchored to the screen
 *   "subwoofer"       → low-frequency effects (LFE channel)
 *   "top-front-left"  → overhead height channel (Atmos/DTS:X)
 *
 * Role is not position. Two rooms could have the "front-left"
 * speaker at completely different coordinates but both would
 * still be doing the same acoustic job. The role is an
 * identity label. The position is where it sits in space.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT "EXTENDS" MEANS FOR Speaker
 * ─────────────────────────────────────────────────────────
 * Speaker extends PlaceableObject. That means every Speaker
 * automatically has:
 *   id        → unique string identifier
 *   position  → Point3D location in meters
 *   name      → optional human-readable label
 *   metadata  → optional tooling annotations
 *
 * And Speaker adds on top of that:
 *   role         → what acoustic channel this speaker serves
 *   isSubwoofer  → whether this speaker is handling LFE/bass
 *   channelIndex → optional numeric index for future ordering
 *
 * Any code that accepts a PlaceableObject will also accept a
 * Speaker, because a Speaker is a PlaceableObject with more
 * fields. This means the registry, the coordinate validator,
 * and any spatial module can all work with Speakers without
 * knowing they are Speakers.
 *
 * ─────────────────────────────────────────────────────────
 * WHY isSubwoofer IS DERIVED FROM role
 * ─────────────────────────────────────────────────────────
 * isSubwoofer is not an input. It is a fact that follows
 * directly from the role. If role === "subwoofer" then
 * isSubwoofer is always true. There is no scenario where
 * role is "subwoofer" but isSubwoofer is false.
 *
 * Making the caller supply both would create a risk of
 * contradiction: someone could accidentally pass
 * role: "subwoofer", isSubwoofer: false. The engine would
 * then have inconsistent data with no way to know which
 * field to trust.
 *
 * By deriving isSubwoofer automatically inside the factory,
 * this contradiction is structurally impossible. The factory
 * is the only constructor, and it sets isSubwoofer from role.
 *
 * isSubwoofer exists as a separate boolean field (rather than
 * making callers check role === "subwoofer" everywhere) because
 * many modules need to branch on this distinction frequently.
 * A boolean flag is clearer and faster than a string comparison
 * scattered across the codebase.
 *
 * ─────────────────────────────────────────────────────────
 * WHY channelIndex IS OPTIONAL
 * ─────────────────────────────────────────────────────────
 * Channel ordering (which subwoofer is channel 1 vs channel 2,
 * which surround speaker maps to which output on an AVR) is
 * a deployment detail, not a domain identity. Two systems
 * could have the same speaker roles in the same positions
 * but wire them to different processor outputs.
 *
 * channelIndex is the slot for that information. It is
 * optional because it is not needed to describe what a
 * speaker is or where it is — only to describe how it is
 * wired. Systems that do not need output mapping can ignore
 * it entirely.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * position coordinates are in METERS.
 * Callers must convert inputs through units.ts before
 * calling createSpeaker. This file does not convert units.
 */

import { Point3D } from "./coordinateSystem"
import { PlaceableObject, validatePlaceableInsideRoom } from "./placeable"
import { Room } from "./room"

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * SpeakerRole is the set of all acoustic roles a speaker can
 * fulfill in a home theater system.
 *
 * The roles cover:
 *
 *   Front stage (screen channels):
 *     "front-left"        Left main loudspeaker
 *     "front-right"       Right main loudspeaker
 *     "center"            Center channel — dialogue anchor
 *
 *   Surround layer (ear-level, around the listener):
 *     "surround-left"     Side surround — to the listener's left
 *     "surround-right"    Side surround — to the listener's right
 *     "rear-left"         Rear surround — behind and left
 *     "rear-right"        Rear surround — behind and right
 *
 *   Height layer (overhead or upper wall, for object audio):
 *     "top-front-left"    Overhead height — front left
 *     "top-front-right"   Overhead height — front right
 *     "top-rear-left"     Overhead height — rear left
 *     "top-rear-right"    Overhead height — rear right
 *
 *   Bass management:
 *     "subwoofer"         Low-frequency effects and redirected bass
 *
 * This list represents the canonical roles the engine
 * understands. It is a union of string literals — TypeScript
 * will reject any string that is not exactly one of these
 * values at compile time.
 *
 * Dolby Atmos, DTS:X, and Auro-3D all map onto subsets of
 * these roles. The layout logic that selects which roles a
 * given format requires lives in a later engine phase.
 */
export type SpeakerRole =
  | "front-left"
  | "front-right"
  | "center"
  | "surround-left"
  | "surround-right"
  | "rear-left"
  | "rear-right"
  | "top-front-left"
  | "top-front-right"
  | "top-rear-left"
  | "top-rear-right"
  | "subwoofer"

/**
 * Speaker is the canonical domain model for a loudspeaker
 * or subwoofer placed inside a room.
 *
 * It extends PlaceableObject, inheriting:
 *   id        → unique string identifier (e.g. "spk-front-left")
 *   position  → Point3D location in meters (x, y, z)
 *   name      → optional human-readable label
 *   metadata  → optional tooling annotations
 *
 * And adds:
 *
 *   role — The acoustic channel this speaker serves.
 *   Determines what audio signal it reproduces and how the
 *   engine reasons about its placement relative to listeners.
 *
 *   isSubwoofer — True if and only if role === "subwoofer".
 *   Always derived automatically by createSpeaker. Never
 *   set directly by the caller. See header explanation above.
 *
 *   channelIndex — Optional numeric index for systems that
 *   need to distinguish multiple speakers sharing the same
 *   role (e.g. two subwoofers: channelIndex 0 and 1).
 *   The engine's physics layer does not use this field.
 *   It is reserved for AVR output mapping and export logic.
 *
 * All fields are readonly. A Speaker is immutable once created.
 * To change a speaker's position or role, discard the existing
 * Speaker and call createSpeaker again with the new values.
 */
export type Speaker = Readonly<
  PlaceableObject & {
    role: SpeakerRole
    isSubwoofer: boolean
    channelIndex?: number
  }
>

// ─────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────

/**
 * Thrown when createSpeaker receives a position that falls
 * outside the bounds of the room it is being placed in.
 *
 * A speaker that does not exist inside the room is not a
 * valid speaker for the purposes of this engine. The factory
 * enforces this at construction time so that no Speaker
 * object can exist in an invalid state.
 */
export class SpeakerOutOfBoundsError extends Error {
  constructor(id: string, room: Room) {
    super(
      `Speaker "${id}" has a position outside the room bounds ` +
      `(width: ${room.width}m, height: ${room.height}m, length: ${room.length}m). ` +
      `All position coordinates must be within [0, dimension] on each axis.`
    )
    this.name = "SpeakerOutOfBoundsError"
  }
}

// ─────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────

/**
 * Creates a fully validated, immutable Speaker object.
 *
 * This is the only authorized way to construct a Speaker.
 * No other code should build a Speaker object by hand.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT HAPPENS STEP BY STEP
 * ─────────────────────────────────────────────────────────
 * 1. Assemble a minimal PlaceableObject from id and position.
 * 2. Validate the position is inside the room using
 *    validatePlaceableInsideRoom from placeable.ts.
 *    If outside → throw SpeakerOutOfBoundsError.
 * 3. Derive isSubwoofer from role automatically.
 * 4. Assemble the full Speaker object.
 * 5. Freeze it to enforce immutability at runtime.
 * 6. Return it.
 *
 * ─────────────────────────────────────────────────────────
 * WHY room IS A REQUIRED PARAMETER
 * ─────────────────────────────────────────────────────────
 * The engine must validate that the speaker position is
 * physically inside a room. Without a room, there is nothing
 * to validate against. The room is the spatial boundary that
 * gives the position meaning. A position of x: 3 is only
 * valid or invalid relative to a specific room's width.
 *
 * Accepting room here also means the factory is self-contained.
 * The caller does not need to remember to validate separately
 * after construction. Validation and construction are one
 * atomic step. If createSpeaker returns, the Speaker is valid.
 * If the position is bad, createSpeaker throws and no Speaker
 * is produced at all. There is no in-between state.
 *
 * ─────────────────────────────────────────────────────────
 * WHY channelIndex IS NOT IN THE SIGNATURE
 * ─────────────────────────────────────────────────────────
 * channelIndex is a deployment detail, not a domain identity.
 * The vast majority of speaker creation calls will not need
 * it. It can be attached through the metadata field or added
 * in a later configuration layer that understands AVR output
 * mapping. Keeping it out of the factory signature keeps the
 * construction API clean and unambiguous.
 *
 * @param id        Unique identifier for this speaker.
 *                  Must be unique within the registry it will
 *                  be added to. Examples: "spk-front-left", "sub-1"
 * @param role      The acoustic channel this speaker serves.
 *                  Must be a valid SpeakerRole string.
 * @param position  The 3D position in meters within the room.
 *                  x = distance from left wall
 *                  y = distance from floor
 *                  z = distance from front wall
 * @param room      The room this speaker is being placed in.
 *                  Used to validate that position is inside bounds.
 * @returns         A frozen, immutable Speaker object
 * @throws          SpeakerOutOfBoundsError if position is outside the room
 *
 * Examples:
 *   const room = createRoom(6, 3, 8)
 *
 *   createSpeaker("spk-L", "front-left", { x: 1, y: 1.2, z: 0.3 }, room)
 *     → Speaker {
 *         id: "spk-L",
 *         role: "front-left",
 *         position: { x: 1, y: 1.2, z: 0.3 },
 *         isSubwoofer: false,
 *         channelIndex: undefined
 *       }
 *
 *   createSpeaker("sub-1", "subwoofer", { x: 3, y: 0, z: 0.3 }, room)
 *     → Speaker {
 *         id: "sub-1",
 *         role: "subwoofer",
 *         position: { x: 3, y: 0, z: 0.3 },
 *         isSubwoofer: true,    ← derived automatically
 *         channelIndex: undefined
 *       }
 *
 *   createSpeaker("spk-L", "front-left", { x: 99, y: 1, z: 1 }, room)
 *     → throws SpeakerOutOfBoundsError("spk-L", room)
 */
export function createSpeaker(
  id: string,
  role: SpeakerRole,
  position: Point3D,
  room: Room
): Speaker {
  // Step 1: Assemble a minimal PlaceableObject so we can use
  // the validated placeable layer for the bounds check.
  // This avoids duplicating the bounds-checking logic here.
  const asPlaceable: PlaceableObject = { id, position }

  // Step 2: Validate position against room bounds.
  if (!validatePlaceableInsideRoom(asPlaceable, room)) {
    throw new SpeakerOutOfBoundsError(id, room)
  }

  // Step 3 + 4 + 5: Derive isSubwoofer, assemble, and freeze.
  return Object.freeze({
    id,
    role,
    position,
    isSubwoofer: role === "subwoofer",
    channelIndex: undefined,
  })
}