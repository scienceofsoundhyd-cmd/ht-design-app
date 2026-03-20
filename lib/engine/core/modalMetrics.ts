import { Room } from "../core/room";
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig";
import { computeSpeedOfSound } from "../core/airPhysics";

/**
 * roomVolume
 *
 * Derives the interior volume of a rectangular room from its three
 * principal dimensions.
 *
 *   V = W × H × L   (m³)
 *
 * @param room - Room whose dimensions define the acoustic enclosure.
 * @returns Volume in cubic metres.
 */
function roomVolume(room: Room): number {
  return room.width * room.height * room.length;
}

/**
 * computeModalDensity
 *
 * Returns the approximate number of room modes per Hz at a given frequency
 * using the Weyl (statistical high-frequency) approximation.
 *
 * PHYSICS
 * -------
 * The cumulative mode count N(f) for a rectangular enclosure is given by
 * the Weyl formula:
 *
 *   N(f) ≈ (4π V f³) / (3 c³)
 *
 * Differentiating with respect to f yields the modal density — the rate
 * at which new modes appear per unit frequency:
 *
 *   d(f) = dN/df = (4π V f²) / c³
 *
 * Where:
 *   V   = room volume (m³)
 *   f   = frequency (Hz)
 *   c   = speed of sound (m/s), derived from ambient temperature
 *
 * The result is dimensionally [modes / Hz].
 *
 * This approximation grows in accuracy as frequency increases and modes
 * become densely packed. Below the Schroeder frequency, where modes are
 * sparse and individually identifiable, explicit modal enumeration is
 * more appropriate than this statistical estimate.
 *
 * @param room        - Room whose volume defines the modal space.
 * @param frequencyHz - Frequency at which density is evaluated (Hz).
 * @returns Modal density in modes per Hz.
 */
export function computeModalDensity(
  room: Room,
  frequencyHz: number
): number {
  const V = roomVolume(room);
  const c = computeSpeedOfSound(DEFAULT_ACOUSTIC_CONFIG.temperatureCelsius);
  return (4 * Math.PI * V * frequencyHz * frequencyHz) / (c * c * c);
}

/**
 * computeSchroederFrequency
 *
 * Returns the Schroeder frequency (Hz) — the transition point above which
 * a room's acoustic behaviour is adequately described by diffuse-field
 * statistical theory rather than by individual modal resonances.
 *
 * PHYSICS
 * -------
 * Manfred Schroeder (1954) defined this boundary as the frequency at which
 * the average spacing between adjacent modes equals one-third of their
 * average bandwidth. The standard practical approximation is:
 *
 *   f_s ≈ schroederConstant × √(RT60 / V)
 *
 * Where:
 *   RT60              = reverberation time in seconds — the duration for sound
 *                       pressure level to decay by 60 dB after the source stops.
 *   V                 = room volume (m³).
 *   schroederConstant = empirically derived scaling constant, sourced from
 *                       central engine configuration (default 2000).
 *
 * Interpretation:
 *   Below f_s  → modes are sparse; modal analysis governs the response.
 *   Above f_s  → modes overlap; statistical energy methods are valid.
 *
 * A longer RT60 (less absorption) raises f_s, extending the modal region
 * further into the audible band. A larger room lowers f_s.
 *
 * @param room  - Room whose volume defines the acoustic enclosure.
 * @param rt60  - Reverberation time in seconds.
 * @returns Schroeder frequency in Hz.
 */
export function computeSchroederFrequency(
  room: Room,
  rt60: number
): number {
  const V = roomVolume(room);
  return DEFAULT_ACOUSTIC_CONFIG.schroederConstant * Math.sqrt(rt60 / V);
}