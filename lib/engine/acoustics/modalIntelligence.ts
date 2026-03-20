import { Room } from "../core/room";
import { AbsorptionCoefficients, computeRT60Sabine } from "./rt60";
import { computeSchroederFrequency } from "./modalMetrics";
import { DEFAULT_ACOUSTIC_CONFIG } from "../config/acousticConfig";

export type RegionType = "modal" | "transition" | "diffuse";

export type ModalRegionSummary = {
  readonly schroederFrequencyHz: number;
  readonly modalUpperLimitHz: number;
  readonly transitionUpperLimitHz: number;
};

/**
 * analyzeModalRegions
 *
 * Derives the three primary acoustic frequency regions of a room by
 * computing the Schroeder frequency and partitioning the spectrum
 * around it.
 *
 * PHYSICS
 * -------
 * The Schroeder frequency f_s marks the boundary above which room modes
 * overlap densely enough that statistical diffuse-field theory applies.
 * Below f_s, individual standing waves dominate the room's response and
 * must be treated modally.
 *
 * The spectrum is divided into three regions:
 *
 *   Modal      : f < modalRegionSplitFactor × f_s
 *     Sparse, well-separated resonances. Individual modes are clearly
 *     identifiable and dominate coloration, buildup, and decay.
 *
 *   Transition : modalRegionSplitFactor × f_s ≤ f < f_s
 *     Modes begin to overlap. Neither pure modal nor diffuse treatment
 *     is fully accurate. Hybrid analysis is required.
 *
 *   Diffuse    : f ≥ f_s
 *     Modes are so densely packed that statistical energy methods
 *     (Sabine, Eyring) describe the field with sufficient accuracy.
 *
 * RT60 is computed via the Sabine equation and fed directly into the
 * Schroeder formula: f_s ≈ schroederConstant × √(RT60 / V).
 *
 * @param room       - Room defining geometry and acoustic volume.
 * @param absorption - Per-surface absorption coefficients used to derive RT60.
 * @returns ModalRegionSummary containing the three region boundary frequencies.
 */
export function analyzeModalRegions(
  room: Room,
  absorption: AbsorptionCoefficients
): ModalRegionSummary {
  const rt60 = computeRT60Sabine(room, absorption);
  const schroederFrequencyHz = computeSchroederFrequency(room, rt60);
  const modalUpperLimitHz =
    DEFAULT_ACOUSTIC_CONFIG.modalRegionSplitFactor * schroederFrequencyHz;
  const transitionUpperLimitHz = schroederFrequencyHz;

  return {
    schroederFrequencyHz,
    modalUpperLimitHz,
    transitionUpperLimitHz,
  };
}

/**
 * classifyFrequencyRegion
 *
 * Maps a single frequency to one of the three acoustic region types
 * defined by the supplied ModalRegionSummary.
 *
 * PHYSICS
 * -------
 * Uses the region boundaries established in analyzeModalRegions to
 * determine whether a given frequency falls in the sparse-modal,
 * transitional, or statistically-diffuse portion of the room's response:
 *
 *   f < modalUpperLimitHz       → "modal"
 *   f < transitionUpperLimitHz  → "transition"
 *   f ≥ transitionUpperLimitHz  → "diffuse"
 *
 * @param frequencyHz - Frequency to classify (Hz).
 * @param summary     - Pre-computed region boundaries for the room.
 * @returns RegionType describing the acoustic character at that frequency.
 */
export function classifyFrequencyRegion(
  frequencyHz: number,
  summary: ModalRegionSummary
): RegionType {
  if (frequencyHz < summary.modalUpperLimitHz) return "modal";
  if (frequencyHz < summary.transitionUpperLimitHz) return "transition";
  return "diffuse";
}