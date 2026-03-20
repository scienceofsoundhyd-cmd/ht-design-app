/**
 * objectRegistry.ts
 * Location: lib/engine/core/objectRegistry.ts
 *
 * RESPONSIBILITY: One job only.
 * Maintain the authoritative record of every PlaceableObject
 * inside a Room. Provide safe, validated operations to add,
 * remove, and retrieve objects.
 * No acoustics. No geometry math. No unit conversion. No formatting.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A REGISTRY?
 * ─────────────────────────────────────────────────────────
 * A registry is a managed collection with rules.
 *
 * A plain JavaScript Map or array lets you put anything in
 * and take anything out with no checks. A registry wraps
 * that storage with guards:
 *   - Every object must have a unique id
 *   - Every object must be physically inside the room
 *   - No duplicate ids are allowed
 *   - Objects that were never added cannot be removed
 *
 * Every other engine module that needs to know what is in the
 * room reads from the registry. The registry is the single
 * source of truth for all placed objects. This means:
 *   - Speaker placement reads from the registry
 *   - Modal analysis reads from the registry
 *   - Seat layout reads from the registry
 *
 * None of them maintain their own lists. If it is in the
 * registry, it is in the room. If it is not in the registry,
 * it does not exist as far as the engine is concerned.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS IMMUTABILITY AND WHY DOES IT MATTER?
 * ─────────────────────────────────────────────────────────
 * Immutability means: once a value is created, it is never
 * changed. Instead of modifying the existing value, you
 * create a new value that reflects the change.
 *
 * A simple analogy:
 *   Mutable approach: you have a whiteboard. You erase and
 *   rewrite on it every time something changes. Anyone who
 *   photographed the board earlier now has a photo that no
 *   longer matches reality.
 *
 *   Immutable approach: every change produces a new sheet of
 *   paper. The old sheet is untouched. You can pass the old
 *   sheet around freely because nobody can change what is on
 *   it. The new sheet is the current truth.
 *
 * Applied to the registry:
 *   When you call addObject(registry, speaker), you do NOT
 *   modify the registry you passed in. You receive a brand
 *   new registry that contains everything the original had
 *   plus the new speaker. The original registry is unchanged.
 *
 * Why does this matter for an engine?
 *
 * Reason 1 — Predictability.
 * If addObject mutated the registry in place, any code that
 * holds a reference to the registry would silently see the
 * change. You might pass the registry to a calculation, call
 * addObject elsewhere during the calculation, and now the
 * calculation is working on data that changed underneath it
 * with no warning. Immutability makes this impossible.
 *
 * Reason 2 — History / undo.
 * If every operation returns a new registry, you can keep
 * the previous registries. This is how undo/redo systems are
 * built. The UI layer can store a stack of registry snapshots
 * and roll back to any previous state with zero extra logic.
 *
 * Reason 3 — Testability.
 * Pure functions that take a registry and return a new one
 * are trivially testable. You call the function with known
 * input, you get known output. There is no shared state that
 * must be set up before the test and cleaned up after.
 *
 * How immutability is implemented here:
 * JavaScript's Map is mutable by default. To avoid mutating
 * the original, every write operation (add, remove) creates
 * a new Map by spreading the original into it, then applies
 * the change to the new Map only. The original Map is never
 * touched.
 *
 *   new Map(registry.objects)  ← copies all entries into a
 *                                 brand new Map object
 *
 * The original registry.objects is untouched. The new
 * registry carries the new Map.
 *
 * ─────────────────────────────────────────────────────────
 * WHY Map AND NOT A PLAIN OBJECT {}?
 * ─────────────────────────────────────────────────────────
 * A plain object {} can also store key-value pairs, but Map
 * has three advantages for this use case:
 *
 * 1. Explicit size: map.size gives the count of objects
 *    without iterating. Object.keys(obj).length is clunky.
 *
 * 2. Safe keys: a plain object has inherited properties like
 *    "constructor" and "toString". If an object id happened
 *    to be "constructor", a plain object would behave
 *    strangely. Map has no inherited keys — it is a pure
 *    key-value store.
 *
 * 3. Guaranteed insertion order: Map preserves the order
 *    entries were added. Plain objects do as well in modern
 *    JS, but Map makes it part of the specification.
 */

import { Room } from "./room"
import { PlaceableObject, validatePlaceableInsideRoom } from "./placeable"

// ─────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────

/**
 * Thrown when attempting to add an object whose id already
 * exists in the registry. Each id must be unique within a
 * registry — two objects cannot share the same identifier.
 */
export class DuplicateObjectIdError extends Error {
  constructor(id: string) {
    super(
      `An object with id "${id}" already exists in the registry. ` +
      `Each object must have a unique id.`
    )
    this.name = "DuplicateObjectIdError"
  }
}

/**
 * Thrown when attempting to add an object whose position
 * falls outside the bounds of the room. An object cannot
 * physically exist outside the room it is being placed in.
 */
export class ObjectOutOfBoundsError extends Error {
  constructor(id: string, room: Room) {
    super(
      `Object "${id}" has a position outside the room bounds ` +
      `(width: ${room.width}m, height: ${room.height}m, length: ${room.length}m).`
    )
    this.name = "ObjectOutOfBoundsError"
  }
}

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * ObjectRegistry is the authoritative record of every object
 * placed inside a room.
 *
 * Fields:
 *
 *   room — The Room this registry belongs to. Stored here so
 *   that validation operations always have access to the room
 *   bounds without requiring the caller to pass the room in
 *   separately on every operation. The room is the context
 *   for everything the registry does.
 *
 *   objects — A Map from object id (string) to PlaceableObject.
 *   Map is used because it provides O(1) lookup, insertion,
 *   and deletion by id, and has no inherited key collisions.
 *   See the header explanation above for the full reasoning.
 *
 * Both fields are readonly. The registry object itself is
 * never mutated. Write operations return a new registry.
 */
export type ObjectRegistry = {
  readonly room: Room
  readonly objects: ReadonlyMap<string, PlaceableObject>
}

// ─────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────

/**
 * Creates a new, empty ObjectRegistry for the given room.
 *
 * This is the only authorized way to construct a registry.
 * The registry starts with no objects. Objects are added
 * through addObject.
 *
 * @param room  A valid Room created by createRoom()
 * @returns     A new ObjectRegistry with an empty object map
 *
 * Example:
 *   const registry = createObjectRegistry(room)
 *   registry.objects.size  → 0
 *   registry.room          → the room passed in
 */
export function createObjectRegistry(room: Room): ObjectRegistry {
  return {
    room,
    objects: new Map<string, PlaceableObject>(),
  }
}

// ─────────────────────────────────────────────────────────
// OPERATIONS
// ─────────────────────────────────────────────────────────

/**
 * Adds a PlaceableObject to the registry after validating it.
 *
 * Validation steps (in order):
 *   1. Check the id is not already in use → throw DuplicateObjectIdError
 *   2. Check the position is inside the room → throw ObjectOutOfBoundsError
 *   3. If both pass → return a new registry containing the object
 *
 * The original registry is never modified. A new registry
 * is returned that contains all the original objects plus
 * the new one. See the header explanation of immutability
 * for the full reasoning behind this design.
 *
 * This is a pure function. Given the same registry and the
 * same object, it always returns an equivalent new registry.
 * It changes nothing outside itself and throws nothing except
 * the documented error types.
 *
 * @param registry  The current registry (not modified)
 * @param object    The PlaceableObject to add (must have a unique id
 *                  and a position inside registry.room)
 * @returns         A new ObjectRegistry containing the added object
 * @throws          DuplicateObjectIdError if the id already exists
 * @throws          ObjectOutOfBoundsError if the position is outside the room
 *
 * Examples:
 *   const r1 = createObjectRegistry(room)
 *   const r2 = addObject(r1, { id: "spk-L", position: { x: 1, y: 1, z: 0.5 } })
 *   r2.objects.size  → 1
 *   r1.objects.size  → 0  ← original is untouched
 *
 *   addObject(r2, { id: "spk-L", ... })
 *     → throws DuplicateObjectIdError("spk-L")
 *
 *   addObject(r1, { id: "spk-L", position: { x: 999, y: 0, z: 0 } })
 *     → throws ObjectOutOfBoundsError("spk-L", room)
 */
export function addObject(
  registry: ObjectRegistry,
  object: PlaceableObject
): ObjectRegistry {
  if (registry.objects.has(object.id)) {
    throw new DuplicateObjectIdError(object.id)
  }

  if (!validatePlaceableInsideRoom(object, registry.room)) {
    throw new ObjectOutOfBoundsError(object.id, registry.room)
  }

  const updatedObjects = new Map(registry.objects)
  updatedObjects.set(object.id, object)

  return {
    room: registry.room,
    objects: updatedObjects,
  }
}

/**
 * Removes an object from the registry by id.
 *
 * If the id does not exist in the registry, the registry is
 * returned unchanged. Removing a non-existent object is a
 * no-op, not an error. This mirrors standard collection
 * semantics — the postcondition is "this id is not in the
 * registry", which is already true if it was never there.
 *
 * The original registry is never modified. A new registry
 * is returned that contains all the original objects except
 * the removed one.
 *
 * This is a pure function.
 *
 * @param registry  The current registry (not modified)
 * @param id        The id of the object to remove
 * @returns         A new ObjectRegistry without the specified object.
 *                  If the id was not present, returns an equivalent
 *                  registry to the original (same objects, same room).
 *
 * Examples:
 *   const r1 = addObject(createObjectRegistry(room), speaker)
 *   const r2 = removeObject(r1, "spk-L")
 *   r2.objects.size  → 0
 *   r1.objects.size  → 1  ← original is untouched
 *
 *   removeObject(r1, "does-not-exist")
 *     → returns a registry equivalent to r1, no error thrown
 */
export function removeObject(
  registry: ObjectRegistry,
  id: string
): ObjectRegistry {
  if (!registry.objects.has(id)) {
    return registry
  }

  const updatedObjects = new Map(registry.objects)
  updatedObjects.delete(id)

  return {
    room: registry.room,
    objects: updatedObjects,
  }
}

/**
 * Retrieves a single PlaceableObject from the registry by id.
 *
 * Returns undefined if no object with that id exists. The
 * caller is responsible for checking the return value before
 * using it. This is deliberate — throwing an error for a
 * missing lookup is too aggressive. "Is this object in the
 * registry?" is a legitimate question with a legitimate
 * "no" answer.
 *
 * This is a pure function. It reads from the registry and
 * returns a value. It changes nothing.
 *
 * @param registry  The registry to search
 * @param id        The id of the object to retrieve
 * @returns         The PlaceableObject if found, undefined if not
 *
 * Examples:
 *   getObject(registry, "spk-L")       → PlaceableObject
 *   getObject(registry, "not-a-thing") → undefined
 */
export function getObject(
  registry: ObjectRegistry,
  id: string
): PlaceableObject | undefined {
  return registry.objects.get(id)
}