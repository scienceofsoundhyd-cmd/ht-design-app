import { RoomMode } from "../core/modalAnalysis";
import { AcousticRecommendation } from "./acousticRecommendations";

export type TreatmentType =
  | "corner-bass-trap"
  | "wall-bass-trap"
  | "ceiling-cloud"
  | "broadband-absorption"
  | "diffusion";

export type TreatmentStrategy = {
  readonly centerFrequencyHz: number;
  readonly priority: "low" | "moderate" | "high" | "critical";
  readonly dominantAxes: ReadonlyArray<"width" | "height" | "length">;
  readonly recommendedTreatment: TreatmentType;
};

/**
 * resolveDominantAxes
 *
 * Determines which room axes are most active across a set of contributing
 * modes by counting non-zero index occurrences per axis.
 *
 * An axis is considered dominant if its count equals the maximum count
 * across all three axes. Ties result in multiple axes being returned.
 *
 * @param modes - Contributing modes for the cluster being analysed.
 * @returns Array of dominant axis labels in definition order (width, height, length).
 */
function resolveDominantAxes(
  modes: ReadonlyArray<RoomMode>
): ReadonlyArray<"width" | "height" | "length"> {
  let nxCount = 0;
  let nyCount = 0;
  let nzCount = 0;

  for (const mode of modes) {
    if (mode.nx !== 0) nxCount++;
    if (mode.ny !== 0) nyCount++;
    if (mode.nz !== 0) nzCount++;
  }

  const max = Math.max(nxCount, nyCount, nzCount);

  const axes: Array<"width" | "height" | "length"> = [];
  if (nxCount === max) axes.push("width");
  if (nyCount === max) axes.push("height");
  if (nzCount === max) axes.push("length");

  return axes;
}

/**
 * resolveTreatmentType
 *
 * Maps a combination of acoustic region type and dominant axes to the
 * most appropriate physical treatment type.
 *
 * RATIONALE
 * ---------
 * Modal region — standing waves are the primary problem. The dominant
 * axis indicates which surfaces are driving the resonance:
 *
 *   Width or length dominant → energy builds in the horizontal plane
 *     between facing walls. Corner bass traps placed at the intersections
 *     of those surfaces address pressure maxima, which always occur at
 *     room boundaries and corners for axial modes.
 *
 *   Height only dominant → vertical axial modes drive the problem.
 *     A ceiling cloud (absorptive panel suspended below the ceiling) is
 *     the most accessible treatment for floor-to-ceiling standing waves.
 *
 * Transition region — modes begin overlapping and no single surface pair
 *   dominates. Broadband absorption distributed across wall boundaries
 *   provides the most consistent return across the blended modal/diffuse
 *   behaviour of this region.
 *
 * Diffuse region — the field is statistically uniform. Diffusion is
 *   preferred over absorption to maintain energy balance while reducing
 *   comb filtering and flutter echo.
 *
 * @param regionType   - Acoustic region classification of the cluster.
 * @param dominantAxes - Axes identified as most active in the cluster.
 * @returns The recommended treatment type.
 */
function resolveTreatmentType(
  regionType: "modal" | "transition" | "diffuse",
  dominantAxes: ReadonlyArray<"width" | "height" | "length">
): TreatmentType {
  if (regionType === "modal") {
    if (dominantAxes.includes("width") || dominantAxes.includes("length")) {
      return "corner-bass-trap";
    }
    return "ceiling-cloud";
  }

  if (regionType === "transition") {
    return "broadband-absorption";
  }

  return "diffusion";
}

/**
 * deriveTreatmentStrategy
 *
 * Combines an acoustic recommendation with the contributing modes of its
 * cluster to produce a concrete, axis-aware treatment strategy.
 *
 * PHYSICS
 * -------
 * A recommendation identifies where in the frequency spectrum a problem
 * exists and how severe it is, but does not encode which room surfaces are
 * responsible. The modal indices of the contributing modes carry that
 * spatial information directly: a non-zero nx means the width-axis standing
 * wave is active; ny the height axis; nz the length axis.
 *
 * Counting index activity across all modes in the cluster reveals which
 * axis (or axes) dominate the problem, and from that the optimal placement
 * and type of acoustic treatment can be inferred.
 *
 * @param recommendation   - Scored and classified recommendation for a risk region.
 * @param contributingModes - All modes belonging to the corresponding cluster.
 * @returns TreatmentStrategy encoding dominant axes and recommended treatment.
 */
export function deriveTreatmentStrategy(
  recommendation: AcousticRecommendation,
  contributingModes: ReadonlyArray<RoomMode>
): TreatmentStrategy {
  const dominantAxes = resolveDominantAxes(contributingModes);
  const recommendedTreatment = resolveTreatmentType(
    recommendation.regionType,
    dominantAxes
  );

  return {
    centerFrequencyHz: recommendation.centerFrequencyHz,
    priority: recommendation.priority,
    dominantAxes,
    recommendedTreatment,
  };
}