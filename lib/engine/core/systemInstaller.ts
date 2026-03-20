/**
 * systemInstaller.ts
 * Location: lib/engine/core/systemInstaller.ts
 *
 * RESPONSIBILITY: One job only.
 * Combine the layout preset installation and the subwoofer
 * installation into a single, atomic, top-level operation.
 * No geometry. No angle math. No speaker construction. No
 * validation beyond what the underlying layers provide.
 * Pure sequencing of two existing orchestrators.
 *
 * ─────────────────────────────────────────────────────────
 * WHERE THIS FILE SITS IN THE ENGINE
 * ─────────────────────────────────────────────────────────
 * The engine has been built in layers. Each layer is narrow
 * and does exactly one thing:
 *
 *   Layer 1 — Math primitives
 *     units.ts, coordinateSystem.ts, roomMath.ts,
 *     speakerPlacement.ts, subwooferStrategies.ts
 *
 *   Layer 2 — Domain models
 *     room.ts, speaker.ts, listener.ts, placeable.ts
 *
 *   Layer 3 — Storage
 *     objectRegistry.ts
 *
 *   Layer 4 — Configuration
 *     layoutPresets.ts
 *
 *   Layer 5 — Single-speaker orchestration
 *     speakerInstaller.ts
 *
 *   Layer 6 — Multi-speaker orchestration
 *     layoutInstaller.ts, subwooferInstaller.ts
 *
 *   Layer 7 — Full system orchestration  ← THIS FILE
 *     systemInstaller.ts
 *
 * This file is the outermost layer. It is the highest-level
 * entry point the engine exposes for building a complete
 * speaker system. Above this layer lives only the application
 * code that calls it.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT "SEQUENCING" MEANS HERE
 * ─────────────────────────────────────────────────────────
 * Sequencing means running steps in a defined order where
 * the output of one step is the input to the next.
 *
 * Step 1 produces a registry populated with main speakers.
 * Step 2 receives that registry and adds subwoofers to it.
 * Step 2's output is the final answer.
 *
 * This is the simplest possible form of sequencing — a
 * pipeline of two operations. Neither step knows about the
 * other. installLayoutPreset does not know subwoofers exist.
 * installSubwoofers does not know about preset layouts.
 * This file is the only place that knows both must happen
 * and in what order.
 *
 * ─────────────────────────────────────────────────────────
 * WHY THE ORDER MATTERS
 * ─────────────────────────────────────────────────────────
 * Main speakers are installed first, subwoofers second.
 * The order is enforced here rather than left to the caller
 * because the engine's id conventions make the order
 * observable: main speaker ids come from role names
 * ("front-left", "center"), and subwoofer ids are numbered
 * ("subwoofer-1", "subwoofer-2"). There is no collision
 * risk between the two groups regardless of order.
 *
 * However, installing mains first and subs second follows
 * the logical installation sequence used in every reference
 * theater design: establish the front stage, then add bass
 * management. This keeps the sequence human-readable when
 * iterating over registry.objects — mains appear first,
 * subs appear last, which matches how calibration software
 * expects to encounter them.
 *
 * ─────────────────────────────────────────────────────────
 * ATOMICITY THROUGH IMMUTABILITY
 * ─────────────────────────────────────────────────────────
 * This function is atomic. Either both steps succeed and
 * a complete registry is returned, or one step fails and
 * the original registry is returned to the caller completely
 * unchanged.
 *
 * How this is guaranteed:
 *
 * installLayoutPreset returns a new registry or throws.
 * It never modifies the registry it received.
 *
 * installSubwoofers receives the new registry from step 1
 * and returns another new registry or throws.
 * It never modifies the registry it received.
 *
 * If step 1 throws — say, a speaker position is outside the
 * room — step 2 never runs. The original registry is intact.
 *
 * If step 1 succeeds but step 2 throws — say, the room is
 * too narrow for a four-corners strategy to produce valid
 * positions — the intermediate registry from step 1 (which
 * is only held in the local variable `withMains`) is simply
 * never returned. It has no reference from the caller's
 * code and will be garbage collected. The original registry
 * the caller holds is unchanged.
 *
 * No try-catch is needed. No rollback mechanism is needed.
 * Because every operation produces a new value rather than
 * mutating an existing one, failure at any step leaves all
 * previous state undisturbed. Immutability is the mechanism.
 *
 * ─────────────────────────────────────────────────────────
 * WHY ERRORS PROPAGATE NATURALLY
 * ─────────────────────────────────────────────────────────
 * This function introduces no new error conditions. Every
 * error that can occur originates in a lower layer:
 *
 *   SpeakerOutOfBoundsError   from createSpeaker
 *   DuplicateObjectIdError    from addObject
 *
 * This function does not catch, wrap, or repackage them.
 * The caller — application code, a test, a UI handler —
 * receives the precise error type and message from the
 * layer where the failure actually occurred. That specificity
 * is what makes errors actionable. Catching and re-throwing
 * a generic error here would strip that information and
 * make debugging significantly harder.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * speakerDistance is in METERS.
 * All internal positions computed are in METERS.
 * No rounding. No formatting. No mutation of any input.
 */

import { ObjectRegistry } from "./objectRegistry"
import { LayoutPreset } from "./layoutPresets"
import { Listener } from "./listener"
import { SubwooferStrategy } from "./subwooferStrategies"
import { installLayoutPreset } from "./layoutInstaller"
import { installSubwoofers } from "./subwooferInstaller"

// ─────────────────────────────────────────────────────────
// TOP-LEVEL ORCHESTRATOR
// ─────────────────────────────────────────────────────────

/**
 * Installs a complete speaker system — all main channels
 * from the layout preset plus all subwoofers for the chosen
 * strategy — into the registry in a single atomic call.
 *
 * This is the highest-level entry point of the engine.
 * It combines two operations:
 *
 *   Step 1 — installLayoutPreset
 *   Installs every main channel from the preset at the
 *   specified azimuth and elevation angles relative to the
 *   listener, at the specified distance. Returns a new
 *   registry containing all main speakers.
 *
 *   Step 2 — installSubwoofers
 *   Installs one or more subwoofers at positions determined
 *   by the chosen geometric strategy, derived from the room
 *   geometry stored on the registry. Returns a new registry
 *   containing all main speakers plus all subwoofers.
 *
 * The original registry is never modified. If either step
 * throws, the original is intact. If both steps succeed,
 * the returned registry contains the complete system.
 *
 * @param registry        The starting ObjectRegistry (not modified).
 *                        Typically an empty registry from
 *                        createObjectRegistry(room), but may be
 *                        partially populated if needed.
 * @param preset          The LayoutPreset defining which main channels
 *                        to install and at what angles.
 *                        Example: PRESET_7_1_4
 * @param listener        The Listener whose position and forwardVector
 *                        serve as the spatial origin for all main
 *                        channel angle calculations.
 * @param speakerDistance Distance in meters from the listener to every
 *                        main speaker in the layout. All main channels
 *                        share this distance.
 * @param subStrategy     The SubwooferStrategy determining how many
 *                        subwoofers to place and their geometric
 *                        positions within the room.
 *                        Example: "four-corners"
 * @returns               A new ObjectRegistry containing every main
 *                        speaker from the preset and every subwoofer
 *                        from the strategy, plus anything the original
 *                        registry already held.
 * @throws                SpeakerOutOfBoundsError if any main speaker
 *                        or subwoofer position is outside the room.
 * @throws                DuplicateObjectIdError if any speaker id
 *                        already exists in the registry.
 *
 * ─────────────────────────────────────────────────────────
 * EXAMPLES
 * ─────────────────────────────────────────────────────────
 * Full 7.1.4 system with four-corner subwoofer array:
 *
 *   const room     = createRoom(7, 3, 10)
 *   const listener = createListener({ x: 3.5, y: 1.2, z: 6.5 })
 *   const registry = createObjectRegistry(room)
 *
 *   const system = installFullSystem(
 *     registry,
 *     PRESET_7_1_4,
 *     listener,
 *     2,
 *     "four-corners"
 *   )
 *
 *   system.objects.size → 15
 *   // 11 main channels (front-left through top-rear-right)
 *   // + 4 subwoofers   (subwoofer-1 through subwoofer-4)
 *
 *   system.objects.get("front-left")  → Speaker (main)
 *   system.objects.get("subwoofer-1") → Speaker (sub, isSubwoofer: true)
 *   registry.objects.size → 0         ← original untouched
 *
 * Simple 5.1 system with single front-center subwoofer:
 *
 *   const system51 = installFullSystem(
 *     registry,
 *     PRESET_5_1,
 *     listener,
 *     2,
 *     "front-center"
 *   )
 *
 *   system51.objects.size → 6
 *   // 5 main channels + 1 subwoofer
 */
export function installFullSystem(
  registry: ObjectRegistry,
  preset: LayoutPreset,
  listener: Listener,
  speakerDistance: number,
  subStrategy: SubwooferStrategy
): ObjectRegistry {
  // Step 1: Install all main channels from the preset.
  // Produces a new registry — the original is untouched.
  // Throws if any computed position is outside the room
  // or if any id already exists in the registry.
  const withMains = installLayoutPreset(registry, preset, listener, speakerDistance)

  // Step 2: Install subwoofers using the chosen strategy.
  // Receives the registry from step 1.
  // Produces a new registry — withMains is untouched.
  // Throws if any subwoofer position is outside the room
  // or if any subwoofer id already exists.
  return installSubwoofers(withMains, subStrategy)
}