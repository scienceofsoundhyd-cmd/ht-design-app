import { createRoom } from "../core/room";
import { AbsorptionCoefficients } from "../acoustics/rt60";
import { computeRoomFrequencyResponse, Position3D } from "../frequencyResponse";
import { computeUniformityScore } from "../analysis/uniformityScore";
import { validatePublicSimulationInput } from "../validation/publicInputValidator";

export type PublicSimulationResult = {
  readonly frequencyResponse: {
    readonly frequencyHz: number;
    readonly averageSplDb: number;
  }[];
  readonly flatnessDb: number;
  readonly uniformityDb: number;
  readonly combinedScore: number;
  readonly rating: number;
  readonly recommendedMessage: string;
};

const DEFAULT_ABSORPTION: AbsorptionCoefficients = {
  floor: 0.15,
  ceiling: 0.1,
  frontWall: 0.08,
  rearWall: 0.08,
  leftWall: 0.08,
  rightWall: 0.08,
};

const SEATING_SPREAD_M = 0.6;
const SEAT_COUNT: number = 5;

/**
 * generateSeats
 *
 * Auto-generates SEAT_COUNT listener positions distributed uniformly
 * across ±SEATING_SPREAD_M around the seating centre point.
 *
 * @param seatingCenterX - X coordinate of the seating row centre (m).
 * @param seatingY       - Y coordinate (depth) of the seating row (m).
 * @param earHeight      - Z coordinate (ear height) of all seats (m).
 * @returns Array of SEAT_COUNT Position3D listener positions.
 */
function generateSeats(
  seatingCenterX: number,
  seatingY: number,
  earHeight: number
): ReadonlyArray<Position3D> {
  const seats: Position3D[] = [];
  for (let i = 0; i < SEAT_COUNT; i++) {
    const t = SEAT_COUNT === 1 ? 0 : (i / (SEAT_COUNT - 1)) * 2 - 1;
    seats.push({
      x: seatingCenterX + t * SEATING_SPREAD_M,
      y: seatingY,
      z: earHeight,
    });
  }
  return seats;
}

/**
 * deriveRecommendedMessage
 *
 * Maps a uniformity rating to a human-readable diagnostic message
 * suitable for display in a public-facing UI.
 *
 * @param rating - Uniformity rating on the 0–100 scale.
 * @returns Descriptive recommendation string.
 */
function deriveRecommendedMessage(rating: number): string {
  if (rating >= 80) return "Excellent low-frequency consistency.";
  if (rating >= 60) return "Good performance. Minor optimisation recommended.";
  if (rating >= 40) return "Noticeable seat-to-seat variation. Optimization advised.";
  return "Significant modal imbalance. Professional calibration strongly recommended.";
}

/**
 * runPublicSimulation
 *
 * Public-facing entry point for the acoustic simulation engine. Accepts
 * simplified room and subwoofer parameters, internally configures the full
 * modal simulation pipeline, and returns a reduced result set suitable for
 * display in a website or demo application.
 *
 * ============================================================
 * WHY THE ANALYSIS IS CAPPED AT 120 HZ
 * ============================================================
 *
 * The modal simulation model is physically accurate in the frequency region
 * below the Schroeder frequency, where individual standing wave resonances
 * dominate the room's acoustic behaviour. In typical domestic rooms of
 * 30–80 m³, the Schroeder frequency falls between 80 Hz and 150 Hz.
 * The 120 Hz upper limit captures the entire modal region for most rooms
 * while excluding the mid-frequency range where geometric acoustics and
 * surface diffusion dominate and the modal model loses physical validity.
 *
 * ============================================================
 * WHY ONLY 2 SUBWOOFERS ARE ACCEPTED
 * ============================================================
 *
 * The public interface accepts a maximum of 2 subwoofer positions to
 * bound the complexity of the simulation and avoid misuse of the engine
 * for configurations that require expert parameter tuning. The full engine
 * API supports arbitrary source counts.
 *
 * ============================================================
 * WHY THE SIMPLIFIED INTERFACE PROTECTS THE ENGINE
 * ============================================================
 *
 * This wrapper hardcodes safe defaults (absorption, frequency range, step
 * size, scoring weights), caps the source count, auto-generates listeners,
 * and returns only the subset of output data needed for display. The full
 * engine remains accessible through its native API for expert users.
 *
 * ============================================================
 * PUBLIC DEMO MODE
 * ============================================================
 *
 * Per-seat SPL data is deliberately hidden from the output — the public
 * interface exposes only the spatial average and aggregate scores,
 * preventing overinterpretation of seat-specific data by non-expert users.
 *
 * ============================================================
 * ROOM CONSTRUCTION
 * ============================================================
 *
 * Room is constructed via the createRoom factory function exported from
 * the core room module. This ensures compliance with the canonical domain
 * model regardless of whether Room is implemented as a plain interface,
 * a class, or a factory-produced object with derived properties.
 *
 * @param roomWidth       - Room width in metres (x axis).
 * @param roomHeight      - Room height in metres (y axis / vertical).
 * @param roomLength      - Room length in metres (z axis / depth).
 * @param subPositions    - Array of up to 2 subwoofer {x, y, z} positions (m).
 * @param seatingCenterX  - X coordinate of the seating row centre (m).
 * @param seatingY        - Y coordinate (depth into room) of the seating row (m).
 * @param earHeight       - Ear height of all listeners above the floor (m).
 * @returns PublicSimulationResult with averaged frequency response, acoustic
 *          quality metrics, and a plain-language recommendation.
 */
export function runPublicSimulation(
  roomWidth: number,
  roomHeight: number,
  roomLength: number,
  subPositions: { x: number; y: number; z: number }[],
  seatingCenterX: number,
  seatingY: number,
  earHeight: number
): PublicSimulationResult {
  const validation = validatePublicSimulationInput(
    roomWidth,
    roomHeight,
    roomLength,
    subPositions,
    seatingCenterX,
    seatingY,
    earHeight
  );
  if (!validation.valid) {
    throw new Error(validation.errors[0].message);
  }

  const room = createRoom(roomWidth, roomHeight, roomLength);

  const clampedSubPositions = subPositions.slice(0, 2);

  const sources = clampedSubPositions.map((pos) => ({
    position: { x: pos.x, y: pos.y, z: pos.z } as Position3D,
    gain: 1,
    delayMs: 0,
    polarity: 1 as const,
  }));

  const listeners = generateSeats(seatingCenterX, seatingY, earHeight);

  const maxFrequencyHz = 120;
  const frequencyStepHz = 1;
  const minBandFrequencyHz = 30;
  const maxBandFrequencyHz = 120;
  const flatnessWeight = 1;
  const uniformityWeight = 1;

  const multiListenerResponse = computeRoomFrequencyResponse(
    room,
    DEFAULT_ABSORPTION,
    sources,
    listeners,
    maxFrequencyHz,
    frequencyStepHz
  );

  const score = computeUniformityScore(
    multiListenerResponse,
    minBandFrequencyHz,
    maxBandFrequencyHz,
    flatnessWeight,
    uniformityWeight
  );

  const frequencyResponse = multiListenerResponse.map((point) => ({
    frequencyHz: point.frequencyHz,
    averageSplDb: point.averageSplDb,
  }));

  const recommendedMessage = deriveRecommendedMessage(score.rating);

  return {
    frequencyResponse,
    flatnessDb: score.flatnessDb,
    uniformityDb: score.uniformityDb,
    combinedScore: score.combinedScore,
    rating: score.rating,
    recommendedMessage,
  };
}