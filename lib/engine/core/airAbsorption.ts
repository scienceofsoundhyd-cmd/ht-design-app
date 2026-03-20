/**
 * computeAirAbsorptionDbPerMeter
 *
 * Returns the atmospheric sound absorption coefficient in dB per metre
 * at a given frequency, temperature, and relative humidity using the
 * simplified ISO 9613-1 model.
 *
 * PHYSICS
 * -------
 * Sound propagating through air loses energy to two mechanisms:
 *
 *   Classical viscous and thermal losses
 *     Caused by viscosity and thermal conductivity of the air molecules
 *     themselves. This contribution scales as f² and dominates at very
 *     high frequencies in dry air.
 *
 *   Molecular relaxation losses
 *     Oxygen (O₂) and nitrogen (N₂) molecules absorb acoustic energy
 *     by temporarily storing it in internal vibrational states, then
 *     re-radiating it out of phase with the wave. The rate at which
 *     this exchange occurs is characterised by the relaxation frequencies
 *     frO (oxygen) and frN (nitrogen), which are functions of temperature
 *     and humidity. Water vapour acts as a catalyst that strongly
 *     promotes the relaxation of both species, which is why dry air
 *     absorbs far more high-frequency energy than humid air — the
 *     relaxation loop is slower without water vapour, keeping more
 *     energy trapped for longer.
 *
 * The absorption coefficient α is first computed in Nepers per metre
 * (the natural unit of the underlying wave physics) and then converted
 * to dB per metre using the identity:
 *
 *   α_dB = α_Np × 8.686   (since 1 Np = 20 / ln(10) ≈ 8.686 dB)
 *
 * Assumptions:
 *   - Atmospheric pressure is held constant at P0 = 101325 Pa, so all
 *     (P / P0) ratios reduce to 1 and are retained symbolically for
 *     structural clarity with the ISO standard.
 *   - Humidity is expressed as a fractional mole approximation h = RH / 100.
 *   - Temperature is converted to Kelvin; the reference temperature is
 *     T0 = 293.15 K (20°C).
 *
 * @param frequencyHz       - Acoustic frequency in Hz.
 * @param temperatureCelsius - Ambient air temperature in degrees Celsius.
 * @param relativeHumidity  - Relative humidity as a percentage (0–100).
 * @returns Air absorption coefficient in dB per metre.
 */
export function computeAirAbsorptionDbPerMeter(
  frequencyHz: number,
  temperatureCelsius: number,
  relativeHumidity: number
): number {
  const T = temperatureCelsius + 273.15;
  const T0 = 293.15;
  const P0 = 101325;
  const P = P0;

  const h = relativeHumidity / 100;

  const frO =
    (P / P0) *
    (24 + (4.04e4 * h * (0.02 + h)) / (0.391 + h));

  const frN =
    (P / P0) *
    Math.pow(T / T0, -0.5) *
    (9 + 280 * h * Math.exp(-4.17 * (Math.pow(T / T0, -1 / 3) - 1)));

  const f2 = frequencyHz * frequencyHz;

  const alphaNp =
    f2 *
    (
      1.84e-11 * Math.pow(T / T0, 0.5) +
      Math.pow(T / T0, -2.5) *
      (
        (0.01275 * Math.exp(-2239.1 / T)) / (frO + f2 / frO) +
        (0.1068 * Math.exp(-3352 / T)) / (frN + f2 / frN)
      )
    );

  const alphaDb = alphaNp * 8.686;

  return alphaDb;
}