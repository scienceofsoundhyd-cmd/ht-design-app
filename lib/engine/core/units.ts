// ─────────────────────────────────────────────────────────────
// Physics constants
// ─────────────────────────────────────────────────────────────

/** Speed of sound in dry air at 20 °C, metres per second. */
export const SPEED_OF_SOUND: number = 343;

// ─────────────────────────────────────────────────────────────
// Small-unit converters (engine works internally in metres)
// ─────────────────────────────────────────────────────────────

export function mmToM(mm: number): number {
  return mm / 1000;
}

export function cmToM(cm: number): number {
  return cm / 100;
}

// ─────────────────────────────────────────────────────────────
// Imperial / metric length converters
// ─────────────────────────────────────────────────────────────

export function mToFt(m: number): number {
  return m * 3.280839895013123;
}

export function ftToM(ft: number): number {
  return ft / 3.280839895013123;
}

export function mToIn(m: number): number {
  return m * 39.37007874015748;
}

export function inToM(inches: number): number {
  return inches / 39.37007874015748;
}

// ─────────────────────────────────────────────────────────────
// Volume converters
// ─────────────────────────────────────────────────────────────

export function m3ToFt3(m3: number): number {
  return m3 * 35.3146667215;
}

// ─────────────────────────────────────────────────────────────
// Room geometry helpers
// ─────────────────────────────────────────────────────────────

export function roomVolume(
  width: number,
  height: number,
  length: number
): number {
  return width * height * length;
}

export function roomSurfaceArea(
  width: number,
  height: number,
  length: number
): number {
  return 2 * (width * height + width * length + height * length);
}

export function roomAspectRatios(
  width: number,
  height: number,
  length: number
): {
  widthToHeight: number;
  lengthToHeight: number;
  widthToLength: number;
} {
  return {
    widthToHeight: width / height,
    lengthToHeight: length / height,
    widthToLength: width / length,
  };
}

// ─────────────────────────────────────────────────────────────
// Time / distance helpers
// ─────────────────────────────────────────────────────────────

export function distanceToDelay(
  distanceMetres: number,
  speedOfSound: number = SPEED_OF_SOUND
): number {
  return distanceMetres / speedOfSound;
}

export function delayToDistance(
  delaySeconds: number,
  speedOfSound: number = SPEED_OF_SOUND
): number {
  return delaySeconds * speedOfSound;
}

export function wavelength(
  frequencyHz: number,
  speedOfSound: number = SPEED_OF_SOUND
): number {
  return speedOfSound / frequencyHz;
}

// ─────────────────────────────────────────────────────────────
// Level / amplitude converters
// ─────────────────────────────────────────────────────────────

export function pressureToDb(pressurePa: number): number {
  const p0 = 20e-6;
  return 20 * Math.log10(pressurePa / p0);
}

export function amplitudeToDb(amplitude: number): number {
  return 20 * Math.log10(amplitude);
}

export function dbToAmplitude(db: number): number {
  return Math.pow(10, db / 20);
}

// ─────────────────────────────────────────────────────────────
// Extended imperial helpers (UI-safe — engine remains metric)
// ─────────────────────────────────────────────────────────────

export type FeetInches = {
  readonly feet: number;
  readonly inches: number;
};

function safeNumber(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value;
}

/**
 * Convert feet + inches to metres.
 */
export function feetInchesToMeters(
  feet: number,
  inches: number
): number {
  const totalInches =
    safeNumber(feet) * 12 + safeNumber(inches);

  return totalInches * 0.0254;
}

/**
 * Convert metres to feet + inches.
 */
export function metersToFeetInches(
  meters: number
): FeetInches {
  const totalFeet =
    safeNumber(meters) * 3.280839895013123;

  let feet = Math.floor(totalFeet);
  let inches = (totalFeet - feet) * 12;

  inches = Math.round(inches * 100) / 100;

  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }

  return { feet, inches };
}