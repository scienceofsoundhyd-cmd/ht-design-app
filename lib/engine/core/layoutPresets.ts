/**
 * layoutPresets.ts
 * Location: lib/engine/core/layoutPresets.ts
 *
 * RESPONSIBILITY: One job only.
 * Define the canonical angle specifications for standard
 * home theater speaker layout formats as static data.
 * No math. No speaker construction. No registry interaction.
 * No room logic. Pure configuration.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A LAYOUT PRESET?
 * ─────────────────────────────────────────────────────────
 * A layout preset is a named list of speaker roles and the
 * angles at which each speaker should be placed relative to
 * the primary listener.
 *
 * Think of it as a recipe. A "7.1.4" preset is the recipe
 * that says: "to build this format, you need one center
 * speaker at 0°, a left speaker at −30°, a right speaker at
 * +30°, and so on." The recipe does not know what room it
 * is going into, how far the speakers will be placed, or
 * where the listener sits. It only knows the angles.
 *
 * The engine uses presets as the starting point for
 * automated speaker placement. A later layer reads a preset,
 * combines it with a listener position and a distance, and
 * calls installSpeakerByAngle for each channel. The preset
 * itself is just data — it does nothing on its own.
 *
 * ─────────────────────────────────────────────────────────
 * WHERE DO THESE ANGLES COME FROM?
 * ─────────────────────────────────────────────────────────
 * The angles in this file follow the Dolby Atmos reference
 * speaker placement specification. Dolby's guidelines are
 * the most widely adopted standard in the home theater
 * industry and are used as the baseline by most AV receivers,
 * room correction software, and theater designers.
 *
 * Key reference angles:
 *   Front L/R:        ±30° azimuth, 0° elevation
 *   Center:            0° azimuth, 0° elevation
 *   Side surrounds:  ±110° azimuth, 0° elevation
 *   Rear surrounds:  ±150° azimuth, 0° elevation
 *   Height front:    ±30° azimuth, 45° elevation
 *   Height rear:     ±150° azimuth, 45° elevation
 *
 * Convention in this engine:
 *   Negative azimuth = listener's left
 *   Positive azimuth = listener's right
 *   Elevation 0°     = ear level
 *   Elevation 45°    = overhead height channel angle
 *
 * ─────────────────────────────────────────────────────────
 * WHAT THE FORMAT NAMES MEAN
 * ─────────────────────────────────────────────────────────
 * Home theater formats are described by a three-number code:
 *
 *   [main channels] . [LFE/subwoofer channels] . [height channels]
 *
 * The subwoofer count (.1, .2) describes the LFE channel —
 * the dedicated low-frequency effects track. It is NOT listed
 * in the channels array here because subwoofer placement is
 * handled separately (it has no standard azimuth angle —
 * bass below ~80 Hz is non-directional). The .1 suffix
 * indicates the format carries an LFE channel; the engine's
 * subwoofer placement layer reads from a different config.
 *
 *   "5.1"   → 5 main channels, 1 LFE, 0 height channels
 *             Front L, Front R, Center, Surround L, Surround R
 *
 *   "7.1"   → 7 main channels, 1 LFE, 0 height channels
 *             Front L, Front R, Center, Surround L, Surround R,
 *             Rear L, Rear R
 *
 *   "7.1.4" → 7 main channels, 1 LFE, 4 height channels
 *             All of 7.1 plus:
 *             Top Front L, Top Front R, Top Rear L, Top Rear R
 *
 * ─────────────────────────────────────────────────────────
 * WHY THIS IS PURE DATA, NOT FUNCTIONS
 * ─────────────────────────────────────────────────────────
 * A preset definition does not change. "5.1" has been ±30°
 * for the front speakers since the format was defined.
 * There is no computation to perform, no input to validate,
 * no state to manage.
 *
 * Encoding presets as plain constant objects means:
 *   - They can be imported and read anywhere with zero cost
 *   - They can be serialized directly to JSON for storage
 *   - They can be compared, logged, and inspected trivially
 *   - Tests can assert on them without running any code
 *
 * If preset logic were hidden inside functions, reading a
 * preset would require calling a function, which implies
 * something is being computed — misleading to any reader.
 * Data should look like data.
 */

import { SpeakerRole } from "./speaker"

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/**
 * ChannelSpec defines the placement angle specification for
 * a single speaker channel within a layout preset.
 *
 * Fields:
 *
 *   role — The acoustic channel this speaker fulfills.
 *   Corresponds exactly to the SpeakerRole union in speaker.ts.
 *
 *   azimuthDeg — The horizontal angle of this speaker relative
 *   to the listener, in degrees.
 *   Negative = listener's left. Positive = listener's right.
 *   0° = directly in front.
 *
 *   elevationDeg — The vertical angle of this speaker relative
 *   to the listener's ear level, in degrees.
 *   0° = ear level. 45° = standard overhead height position.
 *   Most speakers in a standard layout sit at 0° elevation.
 */
export type ChannelSpec = {
  readonly role: SpeakerRole
  readonly azimuthDeg: number
  readonly elevationDeg: number
}

/**
 * LayoutPreset is a named, ordered collection of ChannelSpecs
 * that describes the full speaker configuration for a standard
 * home theater format.
 *
 * Fields:
 *
 *   name — The industry-standard format name.
 *   Examples: "5.1", "7.1", "7.1.4"
 *   Used as a display label and as a lookup key.
 *
 *   channels — An ordered array of ChannelSpec entries.
 *   Ordered from front to back, left to right within each
 *   layer (main channels first, then height channels).
 *   Subwoofers are excluded — see header explanation above.
 *
 * The preset carries no room information, no listener position,
 * and no distance. It is purely the angle specification.
 * A later engine phase combines a preset with a Listener,
 * a distance, and a registry to produce actual Speaker objects.
 */
export type LayoutPreset = {
  readonly name: string
  readonly channels: ReadonlyArray<ChannelSpec>
}

// ─────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────

/**
 * The classic 5.1 surround layout.
 *
 * Five main channels:
 *   Front left and right at ±30° (the standard stereo angle,
 *   wide enough to create a convincing front soundstage).
 *   Center at 0° (anchors dialogue directly to the screen).
 *   Surround left and right at ±110° (beside and slightly
 *   behind the listener for enveloping ambient sound).
 *
 * The .1 subwoofer channel is handled by the subwoofer
 * placement layer and is not listed here.
 */
export const PRESET_5_1: LayoutPreset = {
  name: "5.1",
  channels: [
    { role: "front-left",     azimuthDeg: -30,  elevationDeg: 0 },
    { role: "front-right",    azimuthDeg:  30,  elevationDeg: 0 },
    { role: "center",         azimuthDeg:   0,  elevationDeg: 0 },
    { role: "surround-left",  azimuthDeg: -110, elevationDeg: 0 },
    { role: "surround-right", azimuthDeg:  110, elevationDeg: 0 },
  ],
}

/**
 * The 7.1 surround layout.
 *
 * Extends 5.1 by adding two rear channels:
 *   Rear left and right at ±150° (behind the listener,
 *   filling the gap between the side surrounds and the
 *   exact rear at 180°, enabling more precise panning of
 *   sounds that move around the listening area).
 *
 * The side surrounds remain at ±110°, unchanged from 5.1.
 * The rear channels at ±150° are distinct from the sides
 * and complement rather than replace them.
 */
export const PRESET_7_1: LayoutPreset = {
  name: "7.1",
  channels: [
    { role: "front-left",     azimuthDeg: -30,  elevationDeg: 0 },
    { role: "front-right",    azimuthDeg:  30,  elevationDeg: 0 },
    { role: "center",         azimuthDeg:   0,  elevationDeg: 0 },
    { role: "surround-left",  azimuthDeg: -110, elevationDeg: 0 },
    { role: "surround-right", azimuthDeg:  110, elevationDeg: 0 },
    { role: "rear-left",      azimuthDeg: -150, elevationDeg: 0 },
    { role: "rear-right",     azimuthDeg:  150, elevationDeg: 0 },
  ],
}

/**
 * The 7.1.4 Dolby Atmos / DTS:X layout.
 *
 * Extends 7.1 by adding four overhead height channels:
 *   Top front left and right at ±30°, 45° elevation
 *   (above and in front of the listener, matching the
 *   horizontal position of the front L/R speakers).
 *   Top rear left and right at ±150°, 45° elevation
 *   (above and behind the listener, matching the horizontal
 *   position of the rear L/R speakers).
 *
 * The 45° elevation angle is the Dolby reference for in-
 * ceiling or up-firing height speakers. It places the
 * perceived sound source at a natural overhead angle —
 * steep enough to read as "above" without requiring the
 * speaker to be literally overhead.
 *
 * The seven main channels and subwoofer are identical to 7.1.
 */
export const PRESET_7_1_4: LayoutPreset = {
  name: "7.1.4",
  channels: [
    { role: "front-left",       azimuthDeg: -30,  elevationDeg:  0 },
    { role: "front-right",      azimuthDeg:  30,  elevationDeg:  0 },
    { role: "center",           azimuthDeg:   0,  elevationDeg:  0 },
    { role: "surround-left",    azimuthDeg: -110, elevationDeg:  0 },
    { role: "surround-right",   azimuthDeg:  110, elevationDeg:  0 },
    { role: "rear-left",        azimuthDeg: -150, elevationDeg:  0 },
    { role: "rear-right",       azimuthDeg:  150, elevationDeg:  0 },
    { role: "top-front-left",   azimuthDeg: -30,  elevationDeg: 45 },
    { role: "top-front-right",  azimuthDeg:  30,  elevationDeg: 45 },
    { role: "top-rear-left",    azimuthDeg: -150, elevationDeg: 45 },
    { role: "top-rear-right",   azimuthDeg:  150, elevationDeg: 45 },
  ],
}

// ─────────────────────────────────────────────────────────
// PRESET REGISTRY
// ─────────────────────────────────────────────────────────

/**
 * A lookup map of all available presets, keyed by name.
 *
 * This allows callers to retrieve a preset by its format
 * name string rather than importing each constant individually:
 *
 *   PRESETS["5.1"]   → PRESET_5_1
 *   PRESETS["7.1"]   → PRESET_7_1
 *   PRESETS["7.1.4"] → PRESET_7_1_4
 *
 * Typed as Record<string, LayoutPreset> so the map can be
 * extended in future phases without breaking existing callers.
 * Returns undefined for unknown names — callers should guard
 * against missing presets before using the result.
 */
export const PRESETS: Readonly<Record<string, LayoutPreset>> = {
  [PRESET_5_1.name]:   PRESET_5_1,
  [PRESET_7_1.name]:   PRESET_7_1,
  [PRESET_7_1_4.name]: PRESET_7_1_4,
}