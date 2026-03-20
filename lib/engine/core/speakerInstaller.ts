/**
 * speakerInstaller.ts
 * Location: lib/engine/core/speakerInstaller.ts
 *
 * RESPONSIBILITY: One job only.
 * Orchestrate the three-step process of computing a speaker
 * position from angles, constructing a Speaker, and adding
 * it to the registry — as a single atomic operation.
 * No geometry math. No domain construction. No data storage.
 * Those responsibilities stay in their own files.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS AN ORCHESTRATOR?
 * ─────────────────────────────────────────────────────────
 * An orchestrator is a function that coordinates other
 * functions to accomplish a higher-level goal.
 *
 * Each layer below this one does exactly one thing:
 *   speakerPlacement.ts  → converts angles to a Point3D
 *   speaker.ts           → builds a validated Speaker object
 *   objectRegistry.ts    → stores an object in the registry
 *
 * None of them know about each other. They cannot combine
 * themselves into the full workflow of "place a speaker by
 * angle into the registry." That is this file's job.
 *
 * The orchestrator knows the correct order of operations
 * and passes the output of each step as the input to the
 * next. It adds no new logic of its own — only sequencing.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS AN "ATOMIC OPERATION"?
 * ─────────────────────────────────────────────────────────
 * Atomic means "all or nothing." Either every step succeeds
 * and the result is a new valid registry with the speaker
 * in it, or something fails and the original registry is
 * returned to the caller completely unchanged.
 *
 * A concrete analogy:
 *   Imagine transferring money between two bank accounts.
 *   Step 1: deduct from account A.
 *   Step 2: deposit into account B.
 *   If step 2 fails after step 1 succeeds, money has
 *   disappeared. The operation was not atomic.
 *   A real bank wraps both steps in a transaction: if
 *   anything fails, everything rolls back as if neither
 *   step ever ran.
 *
 * installSpeakerByAngle is atomic for a simpler reason:
 * all three steps either return new values or throw. None
 * of them mutate anything in place. If step 2 (createSpeaker)
 * throws because the computed position is outside the room,
 * the registry was never touched — computeSpeakerPosition
 * only returned a Point3D, it did not write anywhere. The
 * caller catches the error and still holds the original
 * registry, intact and unchanged.
 *
 * This atomicity is a direct consequence of immutability.
 * Because no step mutates state, there is no partial state
 * to clean up on failure. The system is either in the old
 * state or the new state. Never in between.
 *
 * ─────────────────────────────────────────────────────────
 * WHY ERRORS PROPAGATE NATURALLY
 * ─────────────────────────────────────────────────────────
 * Each step below can throw a specific, named error:
 *   createSpeaker   → SpeakerOutOfBoundsError
 *   addObject       → DuplicateObjectIdError
 *                  → ObjectOutOfBoundsError
 *
 * This orchestrator does not catch, wrap, or suppress any
 * of them. It lets them travel up to the caller unchanged.
 *
 * Why? Because this layer does not know what the caller
 * wants to do when something goes wrong. Maybe the UI
 * wants to show a specific message for a duplicate id.
 * Maybe a batch installer wants to skip failed speakers
 * and continue. Maybe a test wants to assert that a
 * specific error was thrown.
 *
 * Catching an error here and re-throwing a generic one
 * would destroy that information. The caller gets the
 * precise error type they need — they are in the best
 * position to decide what to do with it.
 *
 * Letting errors propagate is not laziness. It is respect
 * for the caller's ability to handle failures appropriately.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All positions are in METERS.
 * All angles are in DEGREES (converted internally by speakerPlacement).
 * No rounding. No formatting. No mutation of any input.
 */

import { ObjectRegistry, addObject } from "./objectRegistry"
import { SpeakerRole, createSpeaker } from "./speaker"
import { computeSpeakerPosition } from "./speakerPlacement"
import { Listener } from "./listener"

// ─────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────

/**
 * Computes a speaker position from listener-relative angles,
 * constructs a validated Speaker, adds it to the registry,
 * and returns the updated registry.
 *
 * This is the single authorized entry point for placing a
 * speaker by acoustic angle specification rather than by
 * raw coordinates.
 *
 * The three steps performed, in order:
 *
 *   Step 1 — Geometry (speakerPlacement.ts)
 *   Converts (listener position, azimuth, elevation, distance)
 *   into an absolute Point3D in room coordinates.
 *   This step always succeeds — it is pure arithmetic.
 *
 *   Step 2 — Domain construction (speaker.ts)
 *   Passes the computed Point3D to createSpeaker, which
 *   validates the position is inside the room and returns
 *   an immutable Speaker object.
 *   Throws SpeakerOutOfBoundsError if the angles and distance
 *   produce a position outside the room bounds.
 *
 *   Step 3 — Registration (objectRegistry.ts)
 *   Adds the Speaker to the registry via addObject, which
 *   checks for duplicate ids.
 *   Throws DuplicateObjectIdError if the id already exists.
 *   Returns a new registry containing the added speaker.
 *
 * The original registry is never modified. If any step
 * throws, the original registry is untouched. This is
 * an atomic operation — see header explanation above.
 *
 * @param registry     The current ObjectRegistry (not modified)
 * @param id           Unique identifier for this speaker.
 *                     Must not already exist in the registry.
 * @param role         The acoustic channel this speaker serves.
 * @param listener     The Listener object carrying ear position (meters)
 *                     and a normalized forwardVector describing the
 *                     direction they face. All angles are measured
 *                     relative to this position and orientation.
 * @param azimuthDeg   Horizontal angle in degrees.
 *                     0° = directly in front of listener.
 *                     Positive = clockwise toward listener's right.
 * @param elevationDeg Vertical angle in degrees.
 *                     0° = ear level. Positive = upward.
 * @param distance     Distance from listener to speaker in meters.
 * @returns            A new ObjectRegistry containing the added speaker.
 * @throws             SpeakerOutOfBoundsError if the computed position
 *                     is outside the room.
 * @throws             DuplicateObjectIdError if the id already exists
 *                     in the registry.
 *
 * ─────────────────────────────────────────────────────────
 * EXAMPLES
 * ─────────────────────────────────────────────────────────
 * const room     = createRoom(6, 3, 8)
 * const listener = createListener({ x: 3, y: 1.2, z: 5 })
 * let registry   = createObjectRegistry(room)
 *
 * // Place the center speaker directly in front at 2m:
 * registry = installSpeakerByAngle(
 *   registry, "spk-center", "center", listener, 0, 0, 2
 * )
 *
 * // Place the left front speaker at -30° azimuth:
 * registry = installSpeakerByAngle(
 *   registry, "spk-L", "front-left", listener, -30, 0, 2
 * )
 *
 * // Place a top-front-left height speaker at -30° azimuth, 40° up:
 * registry = installSpeakerByAngle(
 *   registry, "spk-TFL", "top-front-left", listener, -30, 40, 2
 * )
 *
 * // This throws SpeakerOutOfBoundsError — distance too large:
 * installSpeakerByAngle(
 *   registry, "spk-R", "front-right", listener, 30, 0, 999
 * )
 *
 * // This throws DuplicateObjectIdError — id already in registry:
 * installSpeakerByAngle(
 *   registry, "spk-center", "center", listener, 0, 0, 2
 * )
 */
export function installSpeakerByAngle(
  registry: ObjectRegistry,
  id: string,
  role: SpeakerRole,
  listener: Listener,
  azimuthDeg: number,
  elevationDeg: number,
  distance: number
): ObjectRegistry {
  // Step 1: Convert listener-relative angles into absolute room coordinates.
  const position = computeSpeakerPosition(listener, azimuthDeg, elevationDeg, distance)

  // Step 2: Construct an immutable, validated Speaker at that position.
  // Throws SpeakerOutOfBoundsError if position is outside the room.
  const speaker = createSpeaker(id, role, position, registry.room)

  // Step 3: Add the speaker to the registry.
  // Throws DuplicateObjectIdError if id is already in use.
  // Returns a new registry — the original is untouched.
  return addObject(registry, speaker)
}