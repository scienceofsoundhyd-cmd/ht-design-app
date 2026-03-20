import { Room } from "../core/room";
import { AbsorptionCoefficients } from "./rt60";
import { computeAirAbsorptionDbPerMeter } from "../core/airAbsorption";
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig";

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
 * equivalentAbsorptionArea
 *
 * Computes the total surface absorption area A_surface as the sum of
 * each boundary surface area multiplied by its absorption coefficient:
 *
 *   A = Σ(Sᵢ × αᵢ)
 *
 * This is the standard Sabine absorption area used as the surface
 * contribution to the combined absorption budget.
 *
 * @param room       - Room defining the six boundary surface dimensions.
 * @param absorption - Per-surface absorption coefficients.
 * @returns Equivalent surface absorption area in m² Sabins.
 */
function equivalentAbsorptionArea(
  room: Room,
  absorption: AbsorptionCoefficients
): number {
  const floor    = room.width  * room.length  * absorption.floor;
  const ceiling  = room.width  * room.length  * absorption.ceiling;
  const frontWall = room.width * room.height  * absorption.frontWall;
  const rearWall  = room.width * room.height  * absorption.rearWall;
  const leftWall  = room.height * room.length * absorption.leftWall;
  const rightWall = room.height * room.length * absorption.rightWall;
  return floor + ceiling + frontWall + rearWall + leftWall + rightWall;
}

/**
 * computeFrequencyDependentRT60
 *
 * Returns the reverberation time (seconds) at a specific frequency by
 * extending the Sabine equation to include atmospheric air absorption
 * as an additional equivalent absorption mechanism.
 *
 * PHYSICS
 * -------
 * The standard Sabine equation accounts only for energy lost at room
 * boundaries. In reality, sound also attenuates as it propagates through
 * air, with the loss rate varying strongly with frequency, temperature,
 * and humidity. At high frequencies (above ~2 kHz) and in large rooms,
 * air absorption becomes the dominant decay mechanism and cannot be
 * ignored without significantly overestimating RT60.
 *
 * The extended Sabine equation incorporates air absorption by treating
 * it as an equivalent distributed absorption area:
 *
 *   A_air = 4 × V × m
 *
 * Where:
 *   V   = room volume (m³)
 *   m   = air attenuation coefficient in Nepers per metre
 *
 * The factor of 4 arises from the geometry of a diffuse field: energy
 * travels in all directions, so the mean free path per unit volume is
 * related to 4V/S, and integrating the volumetric loss over the full
 * diffuse field yields the 4V prefactor.
 *
 * The ISO 9613-1 model returns attenuation in dB/m. Converting to
 * Nepers/m (the natural unit of exponential decay):
 *
 *   m = α_dB / 8.686
 *
 * The combined absorption area:
 *
 *   A_total = A_surface + A_air
 *
 * Yields the frequency-dependent RT60:
 *
 *   RT60(f) = 0.161 × V / A_total
 *
 * At low frequencies where air absorption is negligible, this converges
 * to the standard Sabine result. At high frequencies the air term
 * dominates and RT60 shortens substantially relative to the surface-only
 * prediction.
 *
 * @param room        - Room defining geometry and boundary surfaces.
 * @param absorption  - Per-surface absorption coefficients.
 * @param frequencyHz - Frequency at which RT60 is evaluated (Hz).
 * @returns Reverberation time in seconds at the given frequency.
 */
export function computeFrequencyDependentRT60(
  room: Room,
  absorption: AbsorptionCoefficients,
  frequencyHz: number
): number {
  const V = roomVolume(room);

  const A_surface = equivalentAbsorptionArea(room, absorption);

  const alphaDb = computeAirAbsorptionDbPerMeter(
    frequencyHz,
    DEFAULT_ACOUSTIC_CONFIG.temperatureCelsius,
    DEFAULT_ACOUSTIC_CONFIG.relativeHumidity
  );

  const m = alphaDb / 8.686;

  const A_air = 4 * V * m;

  const A_total = A_surface + A_air;

  return (0.161 * V) / A_total;
}