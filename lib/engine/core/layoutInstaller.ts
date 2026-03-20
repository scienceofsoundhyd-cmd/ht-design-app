/**
 * layoutInstaller.ts
 * Location: lib/engine/core/layoutInstaller.ts
 *
 * RESPONSIBILITY: One job only.
 * Iterate over every channel in a LayoutPreset and install
 * each one as a Speaker in the registry using the established
 * speaker installer pipeline.
 * No angle math. No speaker construction. No preset definitions.
 * No UI. Pure orchestration of an existing pipeline.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT THIS FILE DOES IN PLAIN LANGUAGE
 * ─────────────────────────────────────────────────────────
 * Imagine you have a recipe card (the preset) that lists
 * eleven speakers and their angles. You also have an empty
 * room (the registry), a listener sitting in their seat,
 * and a tape measure set to a fixed distance.
 *
 * This file reads the recipe card from top to bottom. For
 * each line on the card it does one thing: hand that line to
 * installSpeakerByAngle and receive back a room with one
 * more speaker in it. By the time it has read every line,
 * all speakers are placed and the fully populated registry
 * is returned.
 *
 * That is the entire job. No decisions are made here. No
 * angles are computed here. No speakers are constructed here.
 * This file only reads the list and calls the pipeline once
 * per entry.
 *
 * ─────────────────────────────────────────────────────────
 * HOW THE LOOP WORKS — EXPLAINED SIMPLY
 * ─────────────────────────────────────────────────────────
 * A loop is a way to repeat an action for every item in a
 * list without writing the same code over and over.
 *
 * Without a loop, installing an 11-channel preset would look
 * like this:
 *
 *   r = installSpeakerByAngle(r, "front-left",     listener, -30,  0, d)
 *   r = installSpeakerByAngle(r, "front-right",    listener,  30,  0, d)
 *   r = installSpeakerByAngle(r, "center",         listener,   0,  0, d)
 *   ... eight more lines ...
 *
 * With a loop, it becomes:
 *
 *   for each channel in preset.channels:
 *     r = installSpeakerByAngle(r, channel.role, listener,
 *                               channel.azimuthDeg, channel.elevationDeg, d)
 *
 * The loop does not know how many channels are in the preset.
 * It does not care. It keeps going until it has processed
 * every item in the list, then it stops. Adding a new preset
 * with 15 channels or using an existing preset with 5 channels
 * requires zero changes here — the loop handles both.
 *
 * ─────────────────────────────────────────────────────────
 * WHY THE REGISTRY IS REASSIGNED ON EVERY STEP
 * ─────────────────────────────────────────────────────────
 * installSpeakerByAngle never modifies its input registry.
 * It returns a brand new registry that contains everything
 * the original had plus the new speaker.
 *
 * This means after each call, the variable holding the
 * registry must be updated to point at the new registry —
 * otherwise the next call would receive the old registry
 * (without the speaker just added) and we would lose work.
 *
 * The pattern looks like this:
 *
 *   let current = registry           // start with what we were given
 *   current = installSpeaker(...)    // now current has speaker 1
 *   current = installSpeaker(...)    // now current has speakers 1 and 2
 *   current = installSpeaker(...)    // now current has speakers 1, 2, and 3
 *   return current                   // return the fully populated registry
 *
 * The original registry passed in is never touched. If
 * installSpeakerByAngle throws on any channel (for example
 * because the computed position is outside the room), the
 * error propagates up to the caller. The caller still holds
 * the original registry, unchanged. This is the same
 * atomicity-through-immutability property established in
 * speakerInstaller.ts, now applied across a sequence of steps.
 *
 * ─────────────────────────────────────────────────────────
 * HOW SPEAKER IDs ARE GENERATED
 * ─────────────────────────────────────────────────────────
 * Each speaker needs a unique id in the registry. The id is
 * derived directly from the channel's role string:
 *
 *   role "front-left"     → id "front-left"
 *   role "top-rear-right" → id "top-rear-right"
 *
 * Within a single preset, every role appears exactly once
 * (no format has two center speakers), so role strings are
 * already unique within a layout. Using the role as the id
 * makes the registry readable — looking up "surround-left"
 * returns exactly the speaker you expect.
 *
 * If a caller installs two different presets into the same
 * registry, role collisions would occur (both presets have
 * a "center"). That use case is out of scope for this
 * function. The DuplicateObjectIdError from the registry
 * layer will surface naturally and the caller can decide
 * how to handle it.
 *
 * ─────────────────────────────────────────────────────────
 * WHY ERRORS PROPAGATE NATURALLY
 * ─────────────────────────────────────────────────────────
 * This function does not catch any errors. If a speaker
 * position falls outside the room (SpeakerOutOfBoundsError)
 * or a duplicate id is detected (DuplicateObjectIdError),
 * the error travels up to the caller untouched.
 *
 * The caller is the only party that knows what the right
 * response is — abort the whole layout, skip the bad
 * channel, show the user a specific message. This function
 * cannot know. Catching and suppressing errors here would
 * strip the caller of the information they need to respond
 * correctly.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All positions computed internally are in METERS.
 * All angles in the preset are in DEGREES.
 * distance parameter is in METERS.
 * No rounding. No formatting. No mutation of any input.
 */

import { ObjectRegistry } from "./objectRegistry"
import { LayoutPreset } from "./layoutPresets"
import { Listener } from "./listener"
import { installSpeakerByAngle } from "./speakerInstaller"

// ─────────────────────────────────────────────────────────
// INSTALLER
// ─────────────────────────────────────────────────────────

/**
 * Installs every channel in a LayoutPreset into the registry
 * using a single listener position, orientation, and distance.
 *
 * For each channel in preset.channels, this function:
 *   1. Derives the speaker id from the channel role.
 *   2. Calls installSpeakerByAngle with the channel's azimuth
 *      and elevation angles, the listener, and the distance.
 *   3. Replaces the working registry with the returned registry.
 *
 * After all channels are processed, the final registry —
 * containing every speaker from the preset — is returned.
 *
 * The original registry is never modified. Each intermediate
 * registry produced during the loop is a new immutable value.
 * If any channel installation throws, the error propagates
 * to the caller and the original registry remains intact.
 *
 * Subwoofers are not included in LayoutPreset.channels and
 * are therefore not installed here. Subwoofer placement is
 * handled by a separate, dedicated layer in a later phase.
 *
 * @param registry  The current ObjectRegistry (not modified).
 *                  Typically an empty registry created by
 *                  createObjectRegistry, but can be a partially
 *                  populated one if additional speakers are needed.
 * @param preset    The LayoutPreset defining which speaker roles
 *                  to install and at what angles.
 * @param listener  The Listener whose position and forwardVector
 *                  serve as the origin and orientation reference
 *                  for all angle calculations.
 * @param distance  The distance in meters from the listener to
 *                  every speaker in this layout. All channels in
 *                  a single preset share the same distance.
 * @returns         A new ObjectRegistry containing all speakers
 *                  from the preset, added to whatever the original
 *                  registry already contained.
 * @throws          SpeakerOutOfBoundsError if any computed speaker
 *                  position falls outside the room.
 * @throws          DuplicateObjectIdError if any channel role id
 *                  already exists in the registry.
 *
 * ─────────────────────────────────────────────────────────
 * EXAMPLES
 * ─────────────────────────────────────────────────────────
 * const room     = createRoom(7, 3, 10)
 * const listener = createListener({ x: 3.5, y: 1.2, z: 6.5 })
 * const registry = createObjectRegistry(room)
 *
 * // Install a full 7.1.4 layout at 2m from the listener:
 * const result = installLayoutPreset(registry, PRESET_7_1_4, listener, 2)
 * result.objects.size → 11
 * result.objects.get("front-left")  → Speaker at computed position
 * result.objects.get("top-rear-right") → Speaker at computed height position
 *
 * // Install a 5.1 layout:
 * const result51 = installLayoutPreset(registry, PRESET_5_1, listener, 2)
 * result51.objects.size → 5
 */
export function installLayoutPreset(
  registry: ObjectRegistry,
  preset: LayoutPreset,
  listener: Listener,
  distance: number
): ObjectRegistry {
  // Start with the registry as given. Each iteration of the
  // loop below will produce a new registry one speaker richer.
  // By the end of the loop, current holds the fully populated
  // registry with every preset channel installed.
  let current = registry

  for (const channel of preset.channels) {
    // The speaker id is the role string itself.
    // Within a single preset each role is unique, so this
    // produces unique ids for all speakers in the layout.
    const id = channel.role

    current = installSpeakerByAngle(
      current,
      id,
      channel.role,
      listener,
      channel.azimuthDeg,
      channel.elevationDeg,
      distance
    )
  }

  return current
}