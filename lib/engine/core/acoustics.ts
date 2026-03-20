/**
 * acoustics.ts
 * Location: lib/engine/core/acoustics.ts
 *
 * RESPONSIBILITY: One job only.
 * This file contains pure acoustic physics calculations.
 * No geometry. No unit conversions. No formatting.
 *
 * ─────────────────────────────────────────────────────────
 * WHAT IS A "PURE FUNCTION"?
 * ─────────────────────────────────────────────────────────
 * A pure function follows two rules:
 *
 * Rule 1 — Same input always produces the same output.
 *   wavelength(1000) will ALWAYS return 0.343.
 *   It does not depend on the time of day, a database,
 *   a global variable, or any external state.
 *
 * Rule 2 — The function changes nothing outside itself.
 *   It does not write to a file, update a variable,
 *   log to the console, or modify any object it receives.
 *   It takes numbers in and returns a number out. Period.
 *
 * Why does this matter for an engine?
 *
 *   Pure functions are trivial to test:
 *     expect(wavelength(1000)).toBe(0.343)
 *
 *   Pure functions can be safely reused anywhere without
 *   fear that calling them will break something else.
 *
 *   Pure functions are easy to reason about. You read the
 *   formula and you know exactly what will happen.
 *
 * Every function in this file is pure.
 *
 * ─────────────────────────────────────────────────────────
 * UNIT CONTRACT
 * ─────────────────────────────────────────────────────────
 * All distance inputs and outputs are in METERS.
 * All time inputs and outputs are in MILLISECONDS.
 * All frequency inputs are in HERTZ.
 * All level inputs and outputs are in DECIBELS or linear ratio.
 * No exceptions. No rounding. No toFixed.
 */

import { SPEED_OF_SOUND } from "./units"

// ─────────────────────────────────────────────────────────
// DELAY / DISTANCE
// ─────────────────────────────────────────────────────────

/**
 * Converts a physical distance to the time it takes sound
 * to travel that distance.
 *
 * Physics: delay (s) = distance (m) / speed (m/s)
 * We return milliseconds because that is the practical unit
 * for speaker alignment delay — values like 2.91 ms, not
 * 0.00291 seconds.
 *
 * @param meters  Distance in meters
 * @param c       Speed of sound in m/s (defaults to 343)
 * @returns       Time delay in milliseconds
 *
 * Example: distanceToDelay(1) → 2.9154518950437317 ms
 */
export function distanceToDelay(meters: number, c = SPEED_OF_SOUND): number {
  return (meters / c) * 1000
}

/**
 * Converts a time delay back into the physical distance
 * sound travels in that time. The inverse of distanceToDelay.
 *
 * Physics: distance (m) = (delay (ms) / 1000) × speed (m/s)
 *
 * @param ms  Time delay in milliseconds
 * @param c   Speed of sound in m/s (defaults to 343)
 * @returns   Distance in meters
 *
 * Example: delayToDistance(2.9154518950437317) → 1 m
 */
export function delayToDistance(ms: number, c = SPEED_OF_SOUND): number {
  return (ms / 1000) * c
}

// ─────────────────────────────────────────────────────────
// WAVELENGTH
// ─────────────────────────────────────────────────────────

/**
 * Calculates the physical wavelength of a sound wave at a
 * given frequency.
 *
 * Physics: wavelength (m) = speed (m/s) / frequency (Hz)
 *
 * This tells you how large a wave is in space. A 20 Hz bass
 * wave is about 17 meters long. A 20,000 Hz treble wave is
 * about 17 millimeters long. This matters for room mode
 * calculations and speaker placement decisions.
 *
 * @param frequencyHz  Frequency in Hertz
 * @param c            Speed of sound in m/s (defaults to 343)
 * @returns            Wavelength in meters
 *
 * Example: wavelength(343) → 1 m (a 343 Hz tone has a 1 m wavelength)
 */
export function wavelength(frequencyHz: number, c = SPEED_OF_SOUND): number {
  return c / frequencyHz
}

// ─────────────────────────────────────────────────────────
// DECIBEL CONVERSIONS
// ─────────────────────────────────────────────────────────

/**
 * Converts an acoustic pressure ratio to decibels (dB SPL).
 *
 * Physics: dB = 20 × log₁₀(pressureRatio)
 *
 * A pressure ratio of 1 = 0 dB (reference level, no change).
 * A pressure ratio of 2 ≈ 6 dB (roughly double the pressure).
 * A pressure ratio of 10 = 20 dB.
 *
 * @param pressureRatio  Linear pressure ratio (must be > 0)
 * @returns              Level in decibels
 *
 * Example: pressureToDb(2) → 6.020599913279624 dB
 */
export function pressureToDb(pressureRatio: number): number {
  return 20 * Math.log10(pressureRatio)
}

/**
 * Converts a linear amplitude value to decibels.
 *
 * Functionally identical to pressureToDb but accepts negative
 * amplitudes by taking the absolute value first. Used when
 * working with raw DSP sample values rather than pressure ratios.
 *
 * Physics: dB = 20 × log₁₀(|amplitude|)
 *
 * @param amplitude  Linear amplitude (any non-zero number)
 * @returns          Level in decibels
 *
 * Example: amplitudeToDb(0.5) → -6.020599913279624 dB
 */
export function amplitudeToDb(amplitude: number): number {
  return 20 * Math.log10(Math.abs(amplitude))
}

/**
 * Converts decibels back to a linear amplitude ratio.
 * The inverse of amplitudeToDb.
 *
 * Physics: amplitude = 10^(dB / 20)
 *
 * Used when you need to apply a dB gain value in a signal
 * processing chain that operates on linear amplitudes.
 *
 * @param db  Level in decibels
 * @returns   Linear amplitude ratio
 *
 * Example: dbToAmplitude(-6) → 0.5011872336272722
 */
export function dbToAmplitude(db: number): number {
  return Math.pow(10, db / 20)
}

// ─────────────────────────────────────────────────────────
// FREQUENCY BANDS
// ─────────────────────────────────────────────────────────

/**
 * Calculates the center frequency of an octave band relative
 * to 1000 Hz (1 kHz).
 *
 * An octave up doubles the frequency. An octave down halves it.
 * Band 0 = 1000 Hz, Band 1 = 2000 Hz, Band -1 = 500 Hz, etc.
 *
 * Physics: centerFreq (Hz) = 1000 × 2^band
 *
 * Used for RT60 reverberation analysis and room EQ banding
 * where measurements are grouped into octave-wide buckets.
 *
 * @param band  Integer octave band offset from 1 kHz
 * @returns     Center frequency in Hertz
 *
 * Example: octaveBandCenter(0)  → 1000 Hz
 *          octaveBandCenter(1)  → 2000 Hz
 *          octaveBandCenter(-1) → 500 Hz
 */
export function octaveBandCenter(band: number): number {
  return 1000 * Math.pow(2, band)
}