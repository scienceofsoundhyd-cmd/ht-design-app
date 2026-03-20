/**
 * computeSpeedOfSound
 *
 * Returns the speed of sound in dry air at a given temperature using
 * the standard linear approximation:
 *
 *   c = 331.3 + (0.606 × T)
 *
 * Where:
 *   T   = temperature in degrees Celsius
 *   c   = speed of sound in metres per second
 *
 * PHYSICS
 * -------
 * The speed of sound in an ideal gas is proportional to the square root
 * of absolute temperature. Over the range of temperatures relevant to
 * room acoustics (~0°C to ~40°C), the square root relationship is well
 * approximated by the linear expression above, which is derived from a
 * first-order Taylor expansion of the exact formula around 0°C:
 *
 *   c = 331.3 × √(1 + T/273.15)  ≈  331.3 + 0.606 × T
 *
 * At 20°C this yields c ≈ 343.42 m/s, consistent with the commonly
 * cited value of 343 m/s used in room acoustics literature.
 *
 * @param temperatureCelsius - Ambient air temperature in degrees Celsius.
 * @returns Speed of sound in metres per second.
 */
export function computeSpeedOfSound(temperatureCelsius: number): number {
  return 331.3 + 0.606 * temperatureCelsius;
}