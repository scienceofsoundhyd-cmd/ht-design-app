/**
 * placeable.ts
 * Location: lib/engine/core/placeable.ts
 *
 * RESPONSIBILITY: One job only.
 * Define the contract for any object that can be placed at a
 * position inside a room, and validate that such an object
 * actually fits inside a given room.
 * No acoustics. No unit conversion. No geometry math. No formatting.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A "PLACEABLE OBJECT"?
 * ─────────────────────────────────────────────────────────
 * The engine will eventually deal with many kinds of things
 * that occupy a position in a room:
 *
 *   - Speakers (left, center, right, surround, overhead)
 *   - Subwoofers
 *   - Listening seats
 *   - Acoustic treatment panels
 *   - Measurement microphone positions
 *   - Room boundaries themselves (for ray tracing)
 *
 * Each of these is a different thing with different properties.
 * A speaker has a driver size and a frequency response.
 * A seat has a listener head height and a rake angle.
 * A panel has an absorption coefficient.
 *
 * But they all share one thing: they exist at a position in
 * 3D space inside the room.
 *
 * PlaceableObject defines that shared contract — the minimum
 * set of fields that every spatially-located thing must have.
 * It is not a complete description of any one thing. It is
 * the foundation that every specific thing is built on top of.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A "CONTRACT" IN ENGINEERING TERMS?
 * ─────────────────────────────────────────────────────────
 * A contract is an agreement between the producer of data
 * and the consumer of data about what fields will always
 * be present and what their types will be.
 *
 * When a module says it accepts a PlaceableObject, it is
 * saying: "I promise to work with anything that has an id,
 * a position, and optionally a name and metadata. I do not
 * care what else it is."
 *
 * When a Speaker type says it extends PlaceableObject, it
 * is saying: "I promise to always have those fields, plus
 * my own speaker-specific fields."
 *
 * This lets the engine's spatial modules (placement
 * validation, collision detection, ray tracing) work on
 * ANY object in the room without needing to know whether
 * it is a speaker, a seat, or a panel. They just need the
 * position. The contract guarantees the position is there.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A "METADATA" FIELD?
 * ─────────────────────────────────────────────────────────
 * metadata is an escape hatch for optional, unstructured
 * extra information that does not belong in the core type.
 *
 * Its type is Record<string, unknown>, which means:
 *   - It is an object (not a primitive, not an array)
 *   - Its keys are strings
 *   - Its values can be anything — string, number, boolean,
 *     another object, an array — the engine does not enforce
 *     the shape of individual values
 *
 * Example uses:
 *   metadata: { color: "red" }              ← for a UI renderer
 *   metadata: { importedFrom: "AutoCAD" }   ← for audit trails
 *   metadata: { tag: "left-surround" }      ← for labeling
 *
 * The engine's physics layer ignores metadata entirely.
 * It exists for tooling layers (importers, exporters, UI
 * renderers) that need to attach their own annotations to
 * objects without contaminating the physics model.
 *
 * Making it optional (metadata?) means the physics engine
 * never has to check for its presence. If it is there, fine.
 * If it is not, also fine.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All position coordinates are in METERS.
 * Callers are responsible for converting inputs via units.ts
 * before constructing any PlaceableObject.
 * This file does not convert. It only defines and validates.
 */

import { Point3D, validatePointInsideRoom } from "./coordinateSystem"
import { Room } from "./room"

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * PlaceableObject is the base contract for any object that
 * occupies a position in 3D space inside a room.
 *
 * Fields:
 *
 *   id — A unique string identifier for this object.
 *   Every object in the engine must have an id so that
 *   modules can reference, look up, and distinguish objects
 *   from one another. The engine does not generate ids —
 *   the caller is responsible for providing a unique one.
 *   Examples: "speaker-L", "seat-1", "panel-rear-left-A"
 *
 *   position — The 3D location of the object in meters,
 *   expressed in the engine's coordinate system:
 *     x = distance from the left wall
 *     y = distance from the floor
 *     z = distance from the front wall
 *   See coordinateSystem.ts for the full coordinate contract.
 *
 *   name — An optional human-readable label for the object.
 *   Used by tooling and reporting layers. The physics engine
 *   never reads this field. A speaker does not sound different
 *   because its name is "Left Main" vs "Speaker 1".
 *
 *   metadata — Optional unstructured key-value store for
 *   annotations that belong to tooling layers, not the engine.
 *   See the header explanation above for full details.
 *
 * Future specific types (Speaker, Seat, TreatmentPanel) will
 * extend this type and add their own domain-specific fields.
 * This type captures only what is universal to all of them.
 */
export type PlaceableObject = {
  readonly id: string
  readonly position: Point3D
  readonly name?: string
  readonly metadata?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────

/**
 * Validates that a PlaceableObject's position lies inside
 * (or exactly on the boundary of) the given room.
 *
 * ─────────────────────────────────────────────────────────
 * WHY THIS FUNCTION EXISTS AS A SEPARATE LAYER
 * ─────────────────────────────────────────────────────────
 * coordinateSystem.ts already provides validatePointInsideRoom,
 * which checks a raw Point3D against a RoomBounds.
 *
 * This function wraps that check at the domain level.
 * The difference is what it accepts:
 *
 *   validatePointInsideRoom   accepts a Point3D and RoomBounds
 *   validatePlaceableInsideRoom  accepts a PlaceableObject and Room
 *
 * This matters because the rest of the engine works with
 * PlaceableObjects and Rooms, not raw points and bounds.
 * Having this wrapper means engine modules never need to
 * manually extract object.position and pass it down — they
 * hand the whole object to this function and get a boolean
 * back. The extraction is encapsulated here, once.
 *
 * It also means that if PlaceableObject ever gains a concept
 * of physical size (a speaker enclosure that occupies volume,
 * not just a point), this function is the single place where
 * that additional check would be added. Every caller
 * automatically gets the improved validation.
 *
 * ─────────────────────────────────────────────────────────
 * HOW IT WORKS
 * ─────────────────────────────────────────────────────────
 * It reads the object's position and delegates to
 * validatePointInsideRoom, passing the Room as the bounds.
 * Room extends RoomBounds, so it satisfies the bounds
 * parameter contract without any conversion.
 *
 * This is a pure function. It reads its two inputs and
 * returns a boolean. It changes nothing, logs nothing,
 * throws nothing.
 *
 * @param object  Any PlaceableObject with a position in meters
 * @param room    The Room to validate the position against
 * @returns       true  if the object's position is inside or on
 *                      the boundary of the room
 *                false if the object's position is outside the
 *                      room on any axis
 *
 * Examples — given a room created with createRoom(6, 3, 8):
 *
 *   validatePlaceableInsideRoom(
 *     { id: "spk-L", position: { x: 1, y: 1.2, z: 0.5 } },
 *     room
 *   ) → true   (inside on all axes)
 *
 *   validatePlaceableInsideRoom(
 *     { id: "spk-L", position: { x: 7, y: 1.2, z: 0.5 } },
 *     room
 *   ) → false  (x: 7 exceeds width of 6)
 *
 *   validatePlaceableInsideRoom(
 *     { id: "spk-L", position: { x: 1, y: 0, z: 0 } },
 *     room
 *   ) → true   (on the front-wall floor boundary — valid)
 */
export function validatePlaceableInsideRoom(
  object: PlaceableObject,
  room: Room
): boolean {
  return validatePointInsideRoom(object.position, room)
}