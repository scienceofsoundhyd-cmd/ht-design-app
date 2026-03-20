import { Room } from "../core/room";

export type AbsorptionCoefficients = {
  readonly floor: number;
  readonly ceiling: number;
  readonly frontWall: number;
  readonly rearWall: number;
  readonly leftWall: number;
  readonly rightWall: number;
};

function roomVolume(room: Room): number {
  return room.width * room.height * room.length;
}

function totalSurfaceArea(room: Room): number {
  const floor = room.width * room.length;
  const ceiling = room.width * room.length;
  const frontWall = room.width * room.height;
  const rearWall = room.width * room.height;
  const leftWall = room.height * room.length;
  const rightWall = room.height * room.length;
  return floor + ceiling + frontWall + rearWall + leftWall + rightWall;
}

function equivalentAbsorptionArea(
  room: Room,
  absorption: AbsorptionCoefficients
): number {
  const floor = room.width * room.length * absorption.floor;
  const ceiling = room.width * room.length * absorption.ceiling;
  const frontWall = room.width * room.height * absorption.frontWall;
  const rearWall = room.width * room.height * absorption.rearWall;
  const leftWall = room.height * room.length * absorption.leftWall;
  const rightWall = room.height * room.length * absorption.rightWall;
  return floor + ceiling + frontWall + rearWall + leftWall + rightWall;
}

/**
 * computeRT60Sabine
 *
 * Estimates reverberation time using the Sabine equation.
 *
 * PHYSICS
 * -------
 * Wallace Clement Sabine (1900) derived the first empirical formula
 * relating reverberation time to room volume and total acoustic absorption:
 *
 *   RT60 = 0.161 × V / A
 *
 * Where:
 *   V    = room volume (m³)
 *   A    = equivalent absorption area (m² Sabins) = Σ(Sᵢ × αᵢ)
 *   0.161 = 24 × ln(10) / c  evaluated at c ≈ 343 m/s
 *
 * Sabine assumes a perfectly diffuse sound field — energy is distributed
 * uniformly throughout the room at all times. This makes the formula most
 * accurate in large, lively rooms with low, evenly distributed absorption.
 * It overestimates RT60 in highly damped or geometrically irregular rooms.
 *
 * @param room       - Room defining the acoustic volume and surface geometry.
 * @param absorption - Per-surface absorption coefficients (0–1).
 * @returns Reverberation time in seconds.
 */
export function computeRT60Sabine(
  room: Room,
  absorption: AbsorptionCoefficients
): number {
  const V = roomVolume(room);
  const A = equivalentAbsorptionArea(room, absorption);
  return (0.161 * V) / A;
}

/**
 * computeRT60Eyring
 *
 * Estimates reverberation time using the Eyring–Norris equation.
 *
 * PHYSICS
 * -------
 * Carl Eyring (1930) refined Sabine's model by accounting for the fact that
 * sound energy is not continuously present between reflections — each
 * reflection removes a discrete fraction of energy. This leads to:
 *
 *   RT60 = 0.161 × V / (-S × ln(1 − α_avg))
 *
 * Where:
 *   V      = room volume (m³)
 *   S      = total surface area (m²)
 *   α_avg  = A / S  — area-weighted mean absorption coefficient
 *   A      = equivalent absorption area (m² Sabins)
 *   0.161  = same constant as Sabine (24 × ln(10) / c at c ≈ 343 m/s)
 *
 * The term −ln(1 − α_avg) replaces Sabine's α_avg, yielding a logarithmic
 * decay that correctly models the progressive energy loss on each reflection
 * cycle. As α_avg → 0 the two formulas converge (since −ln(1−x) ≈ x for
 * small x). For higher absorption the Eyring result is shorter than Sabine's,
 * which is physically correct: Sabine underestimates how quickly a damped
 * room loses energy.
 *
 * Note: if α_avg = 1 (total absorption) the formula returns 0, which is the
 * physically correct limit (anechoic — no reverberation).
 *
 * @param room       - Room defining the acoustic volume and surface geometry.
 * @param absorption - Per-surface absorption coefficients (0–1).
 * @returns Reverberation time in seconds.
 */
export function computeRT60Eyring(
  room: Room,
  absorption: AbsorptionCoefficients
): number {
  const V = roomVolume(room);
  const S = totalSurfaceArea(room);
  const A = equivalentAbsorptionArea(room, absorption);
  const alpha_avg = A / S;
  return (0.161 * V) / (-S * Math.log(1 - alpha_avg));
}