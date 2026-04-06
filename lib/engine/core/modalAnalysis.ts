import { Room } from "./room";
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig";
import { computeSpeedOfSound } from "./airPhysics";

/**
 * RoomMode
 *
 * Represents a single standing wave resonance inside a rectangular room.
 *
 * PHYSICS
 * -------
 * A room mode is a frequency at which sound waves reflecting between
 * parallel surfaces interfere constructively to form a stable standing
 * wave pattern. Each mode is uniquely identified by its three integer
 * modal indices (nx, ny, nz) and classified by how many pairs of
 * surfaces participate in the resonance:
 *
 *   Axial       — one index non-zero   (one pair of surfaces)
 *   Tangential  — two indices non-zero (two pairs of surfaces)
 *   Oblique     — all three non-zero   (all three pairs of surfaces)
 *
 * Axial modes carry the most energy and have the greatest acoustical
 * impact; oblique modes carry the least.
 */
export type RoomMode = {
  readonly frequencyHz: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly type: "axial" | "tangential" | "oblique";
};

/**
 * classifyModeType
 *
 * Determines whether a mode is axial, tangential, or oblique based on
 * how many of its three modal indices are non-zero.
 *
 * @param nx - Modal index along the width axis (X).
 * @param ny - Modal index along the length axis (Y).
 * @param nz - Modal index along the height axis (Z).
 * @returns The mode type string.
 */
function classifyModeType(
  nx: number,
  ny: number,
  nz: number
): "axial" | "tangential" | "oblique" {
  const nonZero =
    (nx !== 0 ? 1 : 0) + (ny !== 0 ? 1 : 0) + (nz !== 0 ? 1 : 0);
  if (nonZero === 1) return "axial";
  if (nonZero === 2) return "tangential";
  return "oblique";
}

/**
 * computeModeFrequency
 *
 * Computes the resonant frequency of a rectangular room mode using the
 * three-dimensional wave equation solution for a rigid-walled enclosure:
 *
 *   f = (c / 2) × √((nx/W)² + (ny/L)² + (nz/H)²)
 *
 * Where:
 *   c   = speed of sound (m/s), derived from ambient temperature
 *   nx  = modal index along width  W (m)  — X axis
 *   ny  = modal index along length L (m)  — Y axis
 *   nz  = modal index along height H (m)  — Z axis
 *
 * @param nx   - Modal index along the width axis (X).
 * @param ny   - Modal index along the length axis (Y).
 * @param nz   - Modal index along the height axis (Z).
 * @param room - Room providing the three principal dimensions.
 * @returns Resonant frequency in Hz.
 */
function computeModeFrequency(
  nx: number,
  ny: number,
  nz: number,
  room: Room
): number {
  const c = computeSpeedOfSound(DEFAULT_ACOUSTIC_CONFIG.temperatureCelsius);
  return (
    (c / 2) *
    Math.sqrt(
      (nx / room.width) * (nx / room.width) +
        (ny / room.length) * (ny / room.length) +
        (nz / room.height) * (nz / room.height)
    )
  );
}

/**
 * computeAxialModes
 *
 * Returns all axial room modes up to a given frequency limit.
 *
 * PHYSICS
 * -------
 * Axial modes involve standing waves between a single pair of parallel
 * surfaces. They are the strongest and most audibly problematic modes
 * in a room because they carry the highest energy of the three mode types.
 * There are three families of axial modes — one per room axis — each
 * producing harmonics at integer multiples of the fundamental:
 *
 *   f_nx = (c / 2) × (nx / W)   — width axis (X)
 *   f_ny = (c / 2) × (ny / L)   — length axis (Y)
 *   f_nz = (c / 2) × (nz / H)   — height axis (Z)
 *
 * Iteration continues per axis until the next mode would exceed
 * the specified upper frequency limit.
 *
 * @param room           - Room defining the three principal dimensions.
 * @param maxFrequencyHz - Upper frequency bound; modes at or below this
 *                         value are included.
 * @returns Array of axial RoomModes in no guaranteed order.
 */
export function computeAxialModes(
  room: Room,
  maxFrequencyHz: number
): ReadonlyArray<RoomMode> {
  const modes: RoomMode[] = [];

  for (let nx = 1; ; nx++) {
    const f = computeModeFrequency(nx, 0, 0, room);
    if (f > maxFrequencyHz) break;
    modes.push({ frequencyHz: f, nx, ny: 0, nz: 0, type: "axial" });
  }

  for (let ny = 1; ; ny++) {
    const f = computeModeFrequency(0, ny, 0, room);
    if (f > maxFrequencyHz) break;
    modes.push({ frequencyHz: f, nx: 0, ny, nz: 0, type: "axial" });
  }

  for (let nz = 1; ; nz++) {
    const f = computeModeFrequency(0, 0, nz, room);
    if (f > maxFrequencyHz) break;
    modes.push({ frequencyHz: f, nx: 0, ny: 0, nz, type: "axial" });
  }

  return modes;
}

/**
 * computeAllRoomModes
 *
 * Returns all room modes (axial, tangential, and oblique) up to a given
 * frequency limit, sorted in ascending frequency order.
 *
 * PHYSICS
 * -------
 * The general solution to the wave equation in a rigid rectangular enclosure
 * yields resonant frequencies at:
 *
 *   f = (c / 2) × √((nx/W)² + (ny/L)² + (nz/H)²)
 *
 * for all non-negative integer triples (nx, ny, nz) excluding (0, 0, 0),
 * which represents the trivial DC solution (no standing wave).
 *
 * Mode types by index population:
 *   Axial       (1 non-zero index) — highest energy, most problematic.
 *   Tangential  (2 non-zero indices) — moderate energy, ~3 dB weaker.
 *   Oblique     (3 non-zero indices) — lowest energy, ~6 dB weaker.
 *
 * The upper index bound per axis is estimated conservatively from the
 * maximum possible frequency along that axis alone, ensuring no modes
 * below maxFrequencyHz are missed during the triple nested iteration.
 *
 * @param room           - Room defining the three principal dimensions.
 * @param maxFrequencyHz - Upper frequency bound; modes at or below this
 *                         value are included.
 * @returns Sorted array of all RoomModes up to the frequency limit.
 */
export function computeAllRoomModes(
  room: Room,
  maxFrequencyHz: number
): ReadonlyArray<RoomMode> {
  const modes: RoomMode[] = [];
  const c = computeSpeedOfSound(DEFAULT_ACOUSTIC_CONFIG.temperatureCelsius);

  const maxNx = Math.ceil((2 * maxFrequencyHz * room.width) / c);
  const maxNy = Math.ceil((2 * maxFrequencyHz * room.length) / c);
  const maxNz = Math.ceil((2 * maxFrequencyHz * room.height) / c);

  for (let nx = 0; nx <= maxNx; nx++) {
    for (let ny = 0; ny <= maxNy; ny++) {
      for (let nz = 0; nz <= maxNz; nz++) {
        if (nx === 0 && ny === 0 && nz === 0) continue;

        const f = computeModeFrequency(nx, ny, nz, room);
        if (f > maxFrequencyHz) continue;

        modes.push({
          frequencyHz: f,
          nx,
          ny,
          nz,
          type: classifyModeType(nx, ny, nz),
        });
      }
    }
  }

  return modes.slice().sort((a, b) => a.frequencyHz - b.frequencyHz);
}