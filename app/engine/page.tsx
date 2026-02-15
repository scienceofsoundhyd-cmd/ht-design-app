"use client";
import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Engine() {

// SEATING STATES
const [rowCount, setRowCount] = useState<number>(1);
const [seatsPerRow, setSeatsPerRow] = useState<number>(3);
const [selectedRiserHeightIn, setSelectedRiserHeightIn] = useState<number>(6);
const [aisleType, setAisleType] =
  useState<"None" | "Left" | "Right" | "Both" | "Center">("None");

// ============================================================
// GLOBAL VISUAL SCALE (AUTHORITATIVE — SINGLE SOURCE)
// ============================================================

const VISUAL_SCALE = 20;              // 1 ft = 20 px
const inchToPx = VISUAL_SCALE / 12;   // inch → px conversion

// ============================================================
// LOCKED SEAT DIMENSIONS (SINGLE SOURCE OF TRUTH)
// ============================================================

// Physical dimensions (inches)
const SEAT_WIDTH_IN = 36;
const SEAT_DEPTH_RECLINE_IN = 70;
const SEAT_HEIGHT_IN = 44;

// Convert to feet
const seatWidthFt = SEAT_WIDTH_IN / 12;
const seatDepthFt = SEAT_DEPTH_RECLINE_IN / 12;

// Convert to pixels (visual layer)
const seatWidthPx = seatWidthFt * VISUAL_SCALE;
const seatDepthPx = seatDepthFt * VISUAL_SCALE;

// ============================================================
// GLOBAL VISUAL SCALE (AUTHORITATIVE — MUST BE FIRST)
// ============================================================

console.log("LEFT");
console.log("CENTER");
console.log("RIGHT");

// ============================================================
// MISC / COMBINED PREFERENCES — STATE
// ============================================================
const [calibrationPriority, setCalibrationPriority] = useState<"Standard" | "Reference" | "Studio">("Standard");
const [listeningPreference, setListeningPreference] = useState<"Balanced" | "DialogueFocused" | "ImpactFocused">("Balanced");
const centerPanelRef = useRef<HTMLDivElement>(null);
const pdfRef = useRef<HTMLDivElement | null>(null);
const [length, setLength] = useState<number | null>(null);
const [width, setWidth] = useState<number | null>(null);
const [height, setHeight] = useState<number | null>(null);

// ============================================================
// PHASE 9.1 — SAFE DIMENSION GUARDS (READ-ONLY HELPERS)
// ============================================================
const hasAllRoomDimensions =
  typeof length === "number" &&
  typeof width === "number" &&
  typeof height === "number";

const safeLength = typeof length === "number" ? length : 0;
const safeWidth = typeof width === "number" ? width : 0;
const safeHeight = typeof height === "number" ? height : 0;
const hasValidDimensions =
  typeof length === "number" &&
  typeof width === "number" &&
  typeof height === "number" &&
  length > 0 &&
  width > 0 &&
  height > 0;

/* ============================================================
   LP-2 — ROOM DIMENSIONS HARD GATE & RESET CASCADE
   ============================================================ */
useEffect(() => {
  // If room dimensions are NOT valid, reset ALL downstream state
  if (!hasValidDimensions) {
// --- Acoustic wall depths ---
setFrontWallDepthIn(4);
setBackWallDepthIn(4);
setLeftWallDepthIn(4);
setRightWallDepthIn(4);

    // --- Acoustic ---
    setAcousticMode("Medium");
    setDesignIntent("Balanced");
    setLowFrequencyPriority("Balanced");

    // --- Speaker / Screen ---
    setSpeakerLayoutChoice("Auto");
    setSelectedScreenSize("Auto");

    // --- Seating ---
    setRowCount(1);
    setSelectedRiserHeightIn(0);

    // --- View & Visualization ---
    setCenterViewMode("speakers");
    setShowSoundVisualization(true);
  }
}, [hasValidDimensions]);
useEffect(() => {
  if (
    typeof length === "number" &&
    typeof width === "number" &&
    typeof height === "number" &&
    (length > 60 || width > 40 || height > 20)
  ) {
    alert(
      "Room size exceeds supported limits. Please contact us for more information."
    );
  }
}, [length, width, height]);

const [viewingAngle, setViewingAngle] =
  useState<"smpte" | "thx" | "max">("smpte");

// =====================
// LEFT PANEL LOCKED STYLE (READ-ONLY)
// =====================
const LP_LOCKED_STYLE: React.CSSProperties = {
  opacity: 0.55,
  pointerEvents: "auto",
};

  // ---------- PHASE A1 : Room dimension limits ----------
const MAX_LENGTH = 60;
const MAX_WIDTH = 40;
const MAX_HEIGHT = 20;

const dimensionsEntered =
  typeof length === "number" &&
  typeof width === "number" &&
  typeof height === "number" &&
  length > 0 &&
  width > 0 &&
  height > 0;

const dimensionsWithinLimits =
  dimensionsEntered &&
  length <= MAX_LENGTH &&
  width <= MAX_WIDTH &&
  height <= MAX_HEIGHT;

// ============================================================
// PHASE 1A — SPEAKER LAYOUT CHOICE
// ============================================================
const [speakerLayoutChoice, setSpeakerLayoutChoice] = useState<string>("Auto");

// ============================================================
// PHASE 3A — SPEAKER TYPE (MOUNTING)
// ============================================================
type SpeakerMountType = "InWall" | "OnWall";

const [speakerMountType, setSpeakerMountType] =
  useState<SpeakerMountType>("InWall");

useEffect(() => {
  // Placement mode depends on speaker mounting type
  if (speakerMountType === "InWall") {
    setSpeakerPlacementMode("BehindScreen");
  } else {
    setSpeakerPlacementMode("BesideScreen");
  }

// Downstream reset
setSelectedScreenSize("Auto");
setRowCount(1);
setSelectedRiserHeightIn(0);
}, [speakerMountType]);

// ============================================================
// PHASE 3B — PLACEMENT CONSTRAINTS (HARD RULES)
// ============================================================
// In-wall speakers ALWAYS go behind screen
const placementModeLocked =
  speakerMountType === "InWall";

// On-wall speakers CANNOT go behind screen
const behindScreenAllowed =
  speakerMountType === "InWall";

// ============================================================
// PHASE 3B — SPEAKER PLACEMENT RELATIVE TO SCREEN
// ============================================================
type SpeakerPlacementMode =
| "BehindScreen"   // acoustically transparent screen
| "BesideScreen";  // speakers visible beside screen
const [speakerPlacementMode, setSpeakerPlacementMode] =useState<SpeakerPlacementMode>("BehindScreen");

// ============================================================
// PHASE 3B — PLACEMENT EXPLANATION (CLIENT SAFE)
// ============================================================
let speakerPlacementExplanation = "";
if (speakerPlacementMode === "BehindScreen") {
  speakerPlacementExplanation =
    "Speakers are placed directly behind an acoustically transparent screen. This provides perfect sound localization and is the professional cinema standard.";
} else {
  speakerPlacementExplanation =
    "Speakers are placed beside the screen on the front wall. This is required when using solid screens or on-wall speakers.";
} 

// Physical obstruction caused by speakers + screen (inches)
let frontObstructionDepthIn = 0;

// RULES
// In-wall speakers + AT screen → deeper baffle
// On-wall speakers → shallower obstruction
if (speakerMountType === "InWall") {
  frontObstructionDepthIn = 10;
} else {
  frontObstructionDepthIn = 6;
}

// PX conversion (AFTER inchToPx exists)
const frontObstructionDepthPx =
  frontObstructionDepthIn * inchToPx;

/* ============================================================
   LP-4 — DOWNSTREAM RESET ON SPEAKER LAYOUT CHANGE
   ============================================================ */
useEffect(() => {
  // Speaker layout defines geometry.
  // Any change must invalidate downstream decisions.
  setSelectedScreenSize("Auto");

  setRowCount(1);
  setSelectedRiserHeightIn(0);

  setCenterViewMode("speakers");
  setShowSoundVisualization(false);
}, [speakerLayoutChoice]);

useEffect(() => {
  // Speaker mounting affects screen, seating, and viewing geometry
  setSelectedScreenSize("Auto");

  setRowCount(1);
  setSelectedRiserHeightIn(0);

  setCenterViewMode("speakers");
}, [speakerMountType]);

// ============================================================
// PHASE 2A — ACOUSTIC DEPTH (PER-SURFACE CONTROL)
// ============================================================

// Ceiling depth is FIXED (services: AC, fresh air, electrical)
const CEILING_ACOUSTIC_DEPTH_IN = 12;

// User-selectable wall treatment depths (inches)
const [frontWallDepthIn, setFrontWallDepthIn] = useState<number>(4);
const [backWallDepthIn, setBackWallDepthIn] = useState<number>(4);
const [leftWallDepthIn, setLeftWallDepthIn] = useState<number>(4);
const [rightWallDepthIn, setRightWallDepthIn] = useState<number>(4);
const [selectedScreenSize, setSelectedScreenSize] = useState<number | "Auto">("Auto");

/* ============================================================
   LP-5 — SCREEN RESET ON UPSTREAM GEOMETRY CHANGE
   ============================================================ */
useEffect(() => {
  setSelectedScreenSize("Auto");
}, [
  speakerLayoutChoice,
  frontWallDepthIn,
  backWallDepthIn,
  leftWallDepthIn,
  rightWallDepthIn,
]);

  // ---------- Stage 8.8 : Acoustic risk toggle states ----------
const [showEarlyReflectionRisk, setShowEarlyReflectionRisk] = useState(true);
const [showBassBuildUpRisk, setShowBassBuildUpRisk] = useState(true);
const [showRearWallRisk, setShowRearWallRisk] = useState(true);
const [showCeilingRisk, setShowCeilingRisk] = useState(true);
const [acousticMode, setAcousticMode] =
  useState<"Basic" | "Medium" | "High">("Medium");

  /* ============================================================
   LP-3 — ACOUSTIC MODE HARD GATE (NULL-AWARE)
   ============================================================ */
useEffect(() => {
  // If acoustic intent is removed or not yet selected,
  // all downstream design decisions must collapse
  if (acousticMode === null) {
    // --- Speaker / Screen ---
    setSpeakerLayoutChoice("Auto");
    setSelectedScreenSize("Auto");
    // --- Seating ---
    setRowCount(1);
    setSelectedRiserHeightIn(0);
    // --- Center panel safety ---
    setCenterViewMode("speakers");
    setShowSoundVisualization(false);
  }
}, [acousticMode]);

const [designIntent, setDesignIntent] =
  useState<"Performance" | "Balanced" | "Luxury">(
    "Balanced"
  );
const [lowFrequencyPriority, setLowFrequencyPriority] =
  useState<
    "Balanced" | "BassImpact" | "Reference" | "Extreme"
  >("Balanced");

const roomVolume =
  typeof length === "number" &&
  typeof width === "number" &&
  typeof height === "number"
    ? length * width * height
    : 0;
const lengthWidthRatio =
  typeof length === "number" && typeof width === "number"
    ? (length / width).toFixed(2)
    : "";
const widthHeightRatio =
  typeof width === "number" && typeof height === "number"
    ? (width / height).toFixed(2)
    : "";

const ceilingHeightFlag =
  height === null
      ? ""
      : height < 8
      ? "Low"
      : height <= 12
      ? "OK"
      : "High";
      let feasibilityStatus: "Feasible" | "Compromised" | "Not Feasible" = "Feasible";
let feasibilityReason = "Room dimensions are suitable for a home theater.";

if (length && length < 10) {
  feasibilityStatus = "Not Feasible";
  feasibilityReason = "Room length is too short for proper viewing distance.";
} else if (roomVolume && roomVolume < 1000) {
  feasibilityStatus = "Compromised";
  feasibilityReason = "Room volume is very small. Acoustic treatment will be critical.";
} else if (height && height < 8) {
  feasibilityStatus = "Compromised";
  feasibilityReason = "Ceiling height is low. Atmos and risers may be limited.";
}
const recommendedAcousticMode =
  roomVolume < 2500
    ? "Basic"
    : roomVolume < 5500
    ? "Medium"
    : "High";

// ============================================================
// PHASE 2A — EFFECTIVE ACOUSTIC DEDUCTIONS (DERIVED ONLY)
// ============================================================

// Ceiling affects HEIGHT only
const effectiveCeilingDepthIn = CEILING_ACOUSTIC_DEPTH_IN;

// Walls affect WIDTH & LENGTH
const effectiveWidthReductionIn =
  leftWallDepthIn + rightWallDepthIn;

const effectiveLengthReductionIn =
  frontWallDepthIn + backWallDepthIn;

// ============================================================
// PHASE 2F — EFFECTIVE ROOM DIMENSIONS (POST ACOUSTIC)
// ============================================================

// Original room volume (ft³)
const originalRoomVolumeFt3 =
  typeof length === "number" &&
  typeof width === "number" &&
  typeof height === "number"
    ? length * width * height
    : 0;

// Effective dimensions (ft)
const effectiveRoomLengthFt =
  typeof length === "number"
    ? length - effectiveLengthReductionIn / 12
    : 0;

const effectiveRoomWidthFt =
  typeof width === "number"
    ? width - effectiveWidthReductionIn / 12
    : 0;

const effectiveRoomHeightFt =
  typeof height === "number"
    ? height - effectiveCeilingDepthIn / 12
    : 0;

// Effective room volume (ft³)
const effectiveRoomVolumeFt3 =
  effectiveRoomLengthFt > 0 &&
  effectiveRoomWidthFt > 0 &&
  effectiveRoomHeightFt > 0
    ? effectiveRoomLengthFt *
      effectiveRoomWidthFt *
      effectiveRoomHeightFt
    : 0;

// Volume loss
const acousticVolumeLossFt3 =
  originalRoomVolumeFt3 - effectiveRoomVolumeFt3;

// Percentage loss
const acousticVolumeLossPercent =
  originalRoomVolumeFt3 > 0
    ? Number(
        (
          (acousticVolumeLossFt3 /
            originalRoomVolumeFt3) *
          100
        ).toFixed(1)
      )
    : 0; 

// ============================================================
// PHASE 2F — PER-SURFACE SPACE CONSUMPTION (INCHES)
// ============================================================

const acousticSpaceBreakdown = {
  frontWall: frontWallDepthIn,
  rearWall: backWallDepthIn,
  leftWall: leftWallDepthIn,
  rightWall: rightWallDepthIn,
  ceiling: effectiveCeilingDepthIn,
};

// ============================================================
// PHASE 2F — ACOUSTIC SPACE IMPACT CLASSIFICATION
// ============================================================

let acousticImpactLevel:
  | "Minimal"
  | "Moderate"
  | "Significant"
  | "" = "";

let acousticImpactExplanation = "";

if (acousticVolumeLossPercent < 5) {
  acousticImpactLevel = "Minimal";
  acousticImpactExplanation =
    "Acoustic treatment has minimal impact on usable room space.";
} else if (acousticVolumeLossPercent <= 12) {
  acousticImpactLevel = "Moderate";
  acousticImpactExplanation =
    "Acoustic treatment slightly reduces usable space but remains well within cinema norms.";
} else {
  acousticImpactLevel = "Significant";
  acousticImpactExplanation =
    "Acoustic treatment consumes a noticeable portion of room volume. Layout, seating, and screen size must be optimized carefully.";
}

// ============================================================
// PHASE 3A — EFFECTIVE SPEAKER PROJECTION DEPTH (INCHES)
// ============================================================

// Physical speaker projection into room
const speakerProjectionDepthIn =
  speakerMountType === "OnWall" ? 6 : 0;

// Effective front obstruction depth
const effectiveFrontObstructionIn =
  frontWallDepthIn + speakerProjectionDepthIn;

// ============================================================
// PHASE 3A — SPEAKER TYPE EXPLANATION (CLIENT SAFE)
// ============================================================

let speakerMountExplanation = "";

if (speakerMountType === "InWall") {
  speakerMountExplanation =
    "Speakers are recessed inside the front wall. This allows an acoustically transparent screen, maximizes room depth, and provides a true cinema soundstage.";
} else {
  speakerMountExplanation =
    "Speakers are mounted on the wall surface. This reduces usable room depth slightly and requires the screen to be placed above or between speakers.";
}

// ============================================================
// PHASE 3A — SPEAKER TYPE CONSTRAINT FLAGS
// ============================================================

// Screen transparency eligibility
const allowsAcousticallyTransparentScreen =
  speakerMountType === "InWall";

// Front wall clearance risk
const frontClearanceRisk =
  speakerMountType === "OnWall" &&
  typeof length === "number" &&
  length < 14;

// ============================================================
// PHASE 2B — EFFECTIVE ACOUSTIC DEPTH (LOCK-AWARE, DERIVED)
// ============================================================

/**
 * Discipline:
 * - NO state
 * - NO setters
 * - NO UI influence
 * - Derived values ONLY
 * - Uses room validity as acoustic authority
 */

// ---------- Effective wall depths (inches) ----------
const effectiveFrontWallDepthIn =
  hasValidDimensions ? frontWallDepthIn : 0;

const effectiveBackWallDepthIn =
  hasValidDimensions ? backWallDepthIn : 0;

const effectiveLeftWallDepthIn =
  hasValidDimensions ? leftWallDepthIn : 0;

const effectiveRightWallDepthIn =
  hasValidDimensions ? rightWallDepthIn : 0;

// ---------- Aggregate effective deductions ----------
const effectiveTotalWidthReductionIn =
  effectiveLeftWallDepthIn + effectiveRightWallDepthIn;

const effectiveTotalLengthReductionIn =
  effectiveFrontWallDepthIn + effectiveBackWallDepthIn;

// ---------- Effective usable room dimensions (feet) ----------
const effectiveUsableWidthFt =
  typeof width === "number"
    ? width - effectiveTotalWidthReductionIn / 12
    : 0;

const effectiveUsableLengthFt =
  typeof length === "number"
    ? length - effectiveTotalLengthReductionIn / 12
    : 0;

// ---------- Safety clamps ----------
const safeEffectiveUsableWidthFt =
  Math.max(0, effectiveUsableWidthFt);

const safeEffectiveUsableLengthFt =
  Math.max(0, effectiveUsableLengthFt);

// ---------- Effective acoustic footprint validity ----------
const hasEffectiveAcousticSpace =
  safeEffectiveUsableWidthFt > 0 &&
  safeEffectiveUsableLengthFt > 0;

// ============================================================
// PHASE 2C — ACOUSTIC DEPTH USABILITY & SOFT WARNINGS
// ============================================================

/**
 * Discipline:
 * - NO geometry mutation
 * - NO state updates
 * - NO locks
 * - Advisory-only layer
 */

// ---------- Warning buckets ----------
type AcousticDepthWarning =
  | "Excessive Side Wall Depth"
  | "Excessive Front Wall Depth"
  | "Excessive Rear Wall Depth"
  | "Over-Constrained Width"
  | "Over-Constrained Length"
  | "None";

const acousticDepthWarnings: AcousticDepthWarning[] = [];

// ---------- Per-wall soft thresholds (inches) ----------
const MAX_SIDE_WALL_DEPTH_IN = 8;
const MAX_FRONT_WALL_DEPTH_IN = 10;
const MAX_REAR_WALL_DEPTH_IN = 10;

// ---------- Width impact check ----------
if (
  hasValidDimensions &&
  effectiveTotalWidthReductionIn >= MAX_SIDE_WALL_DEPTH_IN * 2
) {
  acousticDepthWarnings.push("Excessive Side Wall Depth");
}

// ---------- Front wall impact check ----------
if (
  hasValidDimensions &&
  effectiveFrontWallDepthIn >= MAX_FRONT_WALL_DEPTH_IN
) {
  acousticDepthWarnings.push("Excessive Front Wall Depth");
}

// ---------- Rear wall impact check ----------
if (
  hasValidDimensions &&
  effectiveBackWallDepthIn >= MAX_REAR_WALL_DEPTH_IN
) {
  acousticDepthWarnings.push("Excessive Rear Wall Depth");
}

// ---------- Usable width safety ----------
if (
  hasValidDimensions &&
  safeEffectiveUsableWidthFt < 9
) {
  acousticDepthWarnings.push("Over-Constrained Width");
}

// ---------- Usable length safety ----------
if (
  hasValidDimensions &&
  safeEffectiveUsableLengthFt < 12
) {
  acousticDepthWarnings.push("Over-Constrained Length");
}

// ---------- Normalize empty state ----------
if (acousticDepthWarnings.length === 0) {
  acousticDepthWarnings.push("None");
}

// ---------- Severity classifier ----------
type AcousticDepthSeverity = "Safe" | "Caution" | "Critical";

let acousticDepthSeverity: AcousticDepthSeverity = "Safe";

if (
  acousticDepthWarnings.includes("Over-Constrained Width") ||
  acousticDepthWarnings.includes("Over-Constrained Length")
) {
  acousticDepthSeverity = "Critical";
} else if (
  acousticDepthWarnings.includes("Excessive Side Wall Depth") ||
  acousticDepthWarnings.includes("Excessive Front Wall Depth") ||
  acousticDepthWarnings.includes("Excessive Rear Wall Depth")
) {
  acousticDepthSeverity = "Caution";
}

// ---------- Human-readable summary ----------
let acousticDepthSummary = "";

if (acousticDepthSeverity === "Safe") {
  acousticDepthSummary =
    "Selected acoustic depths are within safe and practical limits.";
} else if (acousticDepthSeverity === "Caution") {
  acousticDepthSummary =
    "Some acoustic depths are aggressive and may reduce usable space.";
} else {
  acousticDepthSummary =
    "Acoustic treatment significantly constrains room usability. Review depths.";
}

/* ============================================================
   LP-4 — SPEAKER LAYOUT EVALUATION (NON-BLOCKING)
   ============================================================ */

/**
 * STEP 1 — Usable ceiling height (after acoustic treatment)
 * NOTE: ceiling and wall depths are handled independently 
 */
const usableCeilingHeightFt =
  typeof height === "number"
    ? height - effectiveCeilingDepthIn/ 12
    : 0;

/**
 * STEP 2 — Allowed Atmos layers based on usable height
 */
let allowedAtmosLayers: 0 | 2 | 4 = 0;

if (usableCeilingHeightFt >= 9) {
  allowedAtmosLayers = 4;
} else if (usableCeilingHeightFt >= 8) {
  allowedAtmosLayers = 2;
}

/**
 * 3. Base surround layer feasibility (5.x vs 7.x)
 * Rule: depends on BOTH width and length
 */
const base7xFeasible =
  typeof width === "number" &&
  typeof length === "number" &&
  width >= 11 &&
  length >= 15;

/**
 * STEP 3 — Extract requested Atmos layers from speakerLayoutChoice
 */
const requestedAtmosLayers = (() => {
  if (typeof speakerLayoutChoice !== "string") return 0;
  const parts = speakerLayoutChoice.split(".");
  if (parts.length < 3) return 0;
  const parsed = Number(parts[2]);
  return Number.isFinite(parsed) ? parsed : 0;
})();

/**
 * STEP 4 — Risk evaluation (non-blocking)
 */
type SpeakerLayoutRisk = "OK" | "Warning" | "Critical";

let speakerLayoutRisk: SpeakerLayoutRisk = "OK";
let speakerLayoutWarnings: string[] = [];

if (requestedAtmosLayers > allowedAtmosLayers) {
  speakerLayoutRisk =
    requestedAtmosLayers - allowedAtmosLayers >= 2
      ? "Critical"
      : "Warning";

  speakerLayoutWarnings.push(
    `Selected layout requests ${requestedAtmosLayers} Atmos speakers, but usable ceiling height supports only ${allowedAtmosLayers}.`
  );

  speakerLayoutWarnings.push(
    "This may result in compromised vertical imaging and reduced immersion."
  );
}

if (usableCeilingHeightFt < 8 && requestedAtmosLayers > 0) {
  speakerLayoutRisk = "Critical";
  speakerLayoutWarnings.push(
    "Ceiling height is below 8 ft after treatment. Overhead speakers are strongly discouraged."
  );
}

/**
 * STEP 5 — Acoustic mode advisory (education-only)
 */
if (acousticMode === null) {
  speakerLayoutWarnings.push(
    "Acoustic treatment mode is not selected. Speaker performance and imaging accuracy may be compromised."
  );
}

// ---------- PHASE 3.1 : Sound Visualization Toggle ----------
const [showSoundVisualization, setShowSoundVisualization] = useState(true);

// ============================================================
// STEP A — CENTER PANEL VIEW MODE & LAYER ARCHITECTURE (ORDERED)
// ============================================================

// ---------- Center panel view modes (ORDER DEFINES UI ORDER) ----------
type CenterViewMode =
  | "speakers"
  | "projector"
  | "acoustic"
  | "seating"
  | "combined";

// ---------- Atomic drawing layers ----------
type DrawingLayer =
  | "structure"
  | "screen"
  | "seating"
  | "riser"
  | "speakers"
  | "subwoofers"
  | "sound"       
  | "acoustic"
  | "angles"
  | "dimensions";

// ---------- Active center panel view (DEFAULT = SPEAKERS) ----------
const [centerViewMode, setCenterViewMode] =
  useState<CenterViewMode>("speakers");

  useEffect(() => {
  if (
    centerViewMode !== "speakers" &&
    centerViewMode !== "combined"
  ) {
    setShowSoundVisualization(false);
  }
}, [centerViewMode]);

// ---------- View → Layer mapping (ORDER LOCKED) ----------
const VIEW_LAYER_MAP: Record<CenterViewMode, DrawingLayer[]> = {
  speakers: ["structure", "speakers", "subwoofers", "sound", "angles"],
  projector: ["structure", "screen", "angles", "dimensions"],
  acoustic: ["structure", "acoustic"],
  seating: ["structure", "seating", "riser"],

  combined: [
    "structure",
    "screen",
    "seating",
    "riser",
    "speakers",
    "subwoofers",
    "sound",
    "acoustic",
    "angles",
    "dimensions",
  ],
};

const [usageProfile, setUsageProfile] =
  useState<
    | "Movies"
    | "Gaming"
    | "Music"
    | "Mixed"
    | "Reference"
  >("Movies");

  const [futureReadyLevel, setFutureReadyLevel] =
  useState<"None" | "Basic" | "Advanced" | "Extreme">("Basic");

  const [clientPreferenceStyle, setClientPreferenceStyle] =
  useState<
    | "Technical"
    | "Balanced"
    | "Luxury"
    | "Minimal"
    | "Showcase"
  >("Balanced");

// ---------- Layer visibility helper ----------
const isLayerVisible = (layer: DrawingLayer): boolean =>
  VIEW_LAYER_MAP[centerViewMode].includes(layer);

// ---------- ROW 2 VISIBILITY GATE ----------
const isSecondRowAllowed =
  centerViewMode === "seating" ||
  centerViewMode === "combined";

// ---------- Stage 10.4 : Final client verdict ----------
let finalVerdict: "Recommended" | "Compromised" | "Not Recommended" =
  feasibilityStatus === "Feasible"
    ? "Recommended"
    : feasibilityStatus === "Compromised"
    ? "Compromised"
    : "Not Recommended";

    // ---------- Stage 10.5 : Confidence indicator ----------
let confidenceLabel = "";
let confidenceColor = "";

if (finalVerdict === "Recommended") {
  confidenceLabel = "High Confidence";
  confidenceColor = "#22C55E";
} else if (finalVerdict === "Compromised") {
  confidenceLabel = "Moderate Confidence";
  confidenceColor = "#FACC15";
} else {
  confidenceLabel = "Low Confidence";
  confidenceColor = "#EF4444";
}

// ---------- Screen & viewing calculations ----------

// Viewing angle
const viewingAngleDegrees =
  viewingAngle === "smpte"
    ? 30
    : viewingAngle === "thx"
    ? 36
    : 40;

const viewingAngleRadians = (viewingAngleDegrees * Math.PI) / 180;

// Screen size based on ROOM WIDTH (not length)
const screenWidthRatio = 0.75; // 75% of room width

const screenWidthFt =
  typeof width === "number"
    ? Number((width * screenWidthRatio).toFixed(2))
    : "";

const screenWidthInches =
  screenWidthFt ? Number((screenWidthFt * 12).toFixed(1)) : "";

// Viewing distance derived from screen (correct cinema logic)
const viewingDistance =
  screenWidthFt
    ? Number(
        (screenWidthFt / (2 * Math.tan(viewingAngleRadians / 2))).toFixed(2)
      )
    : "";

  // Width-fixed height calculation
const screenHeightFt =
  screenWidthFt
    ? viewingAngle === "max"
      ? screenWidthFt / 2.35
      : screenWidthFt * (9 / 16)
    : "";

const screenHeightInches =
  screenHeightFt
    ? Number((screenHeightFt * 12).toFixed(1))
    : "";

const screenDiagonalInches =
  screenWidthInches && screenHeightInches
    ? Number(
        Math.sqrt(
          screenWidthInches ** 2 +
          screenHeightInches ** 2
        ).toFixed(1)
      )
    : "";

    /* ============================================================
   LP-5 — SCREEN GEOMETRY & VIEWING STANDARD EVALUATION
   ============================================================ */

/**
 * STEP 1 — Fixed constraints
 */
const EQUIPMENT_ZONE_IN = 24;

/**
 * STEP 2 — Usable room length (ft)
 * Acoustic depth is inches
 */
const usableRoomLengthFt =
  typeof length === "number"
    ? length -
      effectiveLengthReductionIn / 12 -
      EQUIPMENT_ZONE_IN / 12
    : 0;

    // ============================================================
// PHASE 3C — SCREEN FEASIBILITY (FRONT OBSTRUCTION AWARE)
// ============================================================

let screenBlockedByFrontObstruction = false;

if (
  typeof viewingDistance === "number" &&
  usableRoomLengthFt < viewingDistance
) {
  screenBlockedByFrontObstruction = true;
}
    
    /* ============================================================
   STEP 4C — SPEAKER ELIGIBILITY (READ-ONLY, PHYSICAL LIMITS)
   ============================================================ */

/**
 * 1. Ceiling eligibility for ANY height speakers
 * Rule: usable ceiling height must be >= 8 ft
 */
const ceilingAllowsHeightSpeakers =
  typeof usableCeilingHeightFt === "number" &&
  usableCeilingHeightFt >= 8;

/**
 * 2. Maximum allowed Atmos layers (0 / 2 / 4)
 * Rules:
 * - < 8 ft  → 0
 * - >= 8 ft → 2
 * - >= 9 ft AND sufficient room length → 4
 */
let maxAllowedAtmosLayers: 0 | 2 | 4 = 0;

if (ceilingAllowsHeightSpeakers) {
  maxAllowedAtmosLayers = 2;

  // 4 Atmos depends on BOTH height AND room length
  if (
    typeof usableCeilingHeightFt === "number" &&
    usableCeilingHeightFt >= 9 &&
    typeof usableRoomLengthFt === "number" &&
    usableRoomLengthFt >= 18
  ) {
    maxAllowedAtmosLayers = 4;
  }
}

/**
 * ============================================================
 * STEP 4D — Effective Atmos Layer Authority
 *
 * Discipline:
 * - Physical limits (Step 4C) are absolute
 * - Auto is authoritative unless speakers are unlocked
 * - Manual is allowed ONLY when explicitly unlocked
 * - UI cards never influence calculations
 * ============================================================
 */

/**
 * AUTO ATMOS DECISION
 * (derived from physical limits only)
 */
let autoAtmosLayers: 0 | 2 | 4 = 0;

if (maxAllowedAtmosLayers >= 4) {
  autoAtmosLayers = 4;
} else if (maxAllowedAtmosLayers >= 2) {
  autoAtmosLayers = 2;
} else {
  autoAtmosLayers = 0;
}

/**
 * STEP 3 — Recommended viewing distance (ft)
 */
const recommendedViewingDistanceFt =
  typeof screenWidthFt === "number" && screenWidthFt > 0
    ? Number(
        (
          screenWidthFt /
          (2 * Math.tan(viewingAngleRadians / 2))
        ).toFixed(2)
      )
    : 0;

/**
 * STEP 4 — Screen risk evaluation
 */
type ScreenRisk = "OK" | "Warning" | "Critical";

let screenRisk: ScreenRisk = "OK";
let screenWarnings: string[] = [];

if (
  usableRoomLengthFt > 0 &&
  recommendedViewingDistanceFt > usableRoomLengthFt
) {
  screenRisk = "Warning";
  screenWarnings.push(
    "Recommended viewing distance exceeds usable room length after acoustic treatment and equipment clearance."
  );
}

if (screenWidthFt && typeof width === "number") {
  const maxAllowedScreenWidth = width * 0.9;
  if (screenWidthFt > maxAllowedScreenWidth) {
    screenRisk = "Critical";
    screenWarnings.push(
      "Selected screen width occupies more than 90% of room width. Side-wall reflections and speaker clearance may be compromised."
    );
  }
}

const [selectedAspectRatio, setSelectedAspectRatio] = useState<"16:9" | "2.35:1" | "4:3">("16:9");

/* ============================================================
   LP-1 — GLOBAL LEFT PANEL LOCK STATE FOUNDATION
   SINGLE SOURCE OF TRUTH (DERIVED ONLY)
   ============================================================ */

/**
 * STEP 1 — ROOM VALIDITY
 * Uses existing validated dimension logic
 */
const isRoomValid = hasValidDimensions === true;

/**
 * STEP 2 — ACOUSTIC UNLOCK
 * Acoustic intent is allowed only after room is valid
 */
const isAcousticUnlocked = isRoomValid;

/**
 * STEP 3 — SPEAKER UNLOCK
 * Speakers depend on post-acoustic usable room
 */
const isSpeakerUnlocked =
  isAcousticUnlocked &&
  acousticMode !== null;

/**
 * MANUAL ATMOS DECISION
 * (only relevant if speakers are unlocked)
 */
let manualAtmosLayers: 0 | 2 | 4 = 0;

if (isSpeakerUnlocked) {
  if (speakerLayoutChoice.includes(".4")) {
    manualAtmosLayers = 4;
  } else if (speakerLayoutChoice.includes(".2")) {
    manualAtmosLayers = 2;
  } else {
    manualAtmosLayers = 0;
  }
}

/**
 * HARD CLAMP — manual can NEVER exceed physical limits
 */
if (manualAtmosLayers > maxAllowedAtmosLayers) {
  manualAtmosLayers = maxAllowedAtmosLayers;
}

/**
 * FINAL EFFECTIVE ATMOS LAYERS
 * (single source of truth for entire app)
 */
const effectiveAtmosLayers: 0 | 2 | 4 =
  isSpeakerUnlocked ? manualAtmosLayers : autoAtmosLayers;

/**
 * STEP 4 — SCREEN / PROJECTOR UNLOCK
 * Screen depends on finalized speaker layout
 */
const isScreenUnlocked =
  isSpeakerUnlocked &&
  speakerLayoutChoice !== null &&
  speakerLayoutChoice !== "";

/**
 * STEP 5 — SEATING / ROWS UNLOCK
 * Seating depends on screen being locked
 */
const isSeatingUnlocked =
  isScreenUnlocked &&
  selectedScreenSize !== null;

// ============================================================
// PHASE 8B — SEATING & RISER AUTHORITY ENGINE (CLEAN)
// SINGLE SOURCE OF TRUTH
// ============================================================

// ------------------------------------------------------------
// 3️⃣ HARD LIMITS
// ------------------------------------------------------------

// ------------------------------------------------------------
// RISER LIMITS (USER REQUIREMENT)
// 5–12 inches, whole numbers only
// ------------------------------------------------------------

const MIN_RISER_IN = 5;
const MAX_RISER_IN = 12;

const MAX_ROWS_ALLOWED = 6;

const AISLE_WIDTH_IN = 24;
const aisleWidthFt = AISLE_WIDTH_IN / 12;

// ------------------------------------------------------------
// 4️⃣ AUTHORITATIVE ROW COUNT (CLAMP)
// ------------------------------------------------------------

const authoritativeRowCount =
  typeof rowCount === "number"
    ? Math.max(1, Math.min(rowCount, MAX_ROWS_ALLOWED))
    : 1;

// ------------------------------------------------------------
// 5️⃣ AUTHORITATIVE RISER HEIGHT (CLAMP)
// ------------------------------------------------------------

const authoritativeSelectedRiserHeightIn =
  authoritativeRowCount > 1
    ? Math.max(
        MIN_RISER_IN,
        Math.min(selectedRiserHeightIn, MAX_RISER_IN)
      )
    : 0;

const riserHeightFt =
  authoritativeSelectedRiserHeightIn / 12;

// ------------------------------------------------------------
// 6️⃣ CEILING CLEARANCE CHECK
// ------------------------------------------------------------

const rearRowHeadHeightFt =
  (SEAT_HEIGHT_IN + authoritativeSelectedRiserHeightIn) / 12;

const rearRowSafe =
  typeof height === "number"
    ? height - rearRowHeadHeightFt >= 1
    : true;

// If unsafe → collapse to 1 row
const finalAuthoritativeRowCount =
  rearRowSafe ? authoritativeRowCount : 1;

// Final riser output
const finalRiserHeightIn =
  finalAuthoritativeRowCount > 1
    ? authoritativeSelectedRiserHeightIn
    : 0;

// ------------------------------------------------------------
// 7️⃣ SEAT COUNT PER ROW (WIDTH LOGIC)
// ------------------------------------------------------------

const usableSeatingWidthFt =
  typeof effectiveRoomWidthFt === "number"
    ? effectiveRoomWidthFt
    : 0;

// Deduct aisle space (only for non-back rows)
const aisleDeductionFt =
  aisleType === "Both"
    ? aisleWidthFt * 2
    : aisleType === "Left" || aisleType === "Right"
    ? aisleWidthFt
    : aisleType === "Center"
    ? aisleWidthFt
    : 0;

const effectiveSeatWidthFt =
  usableSeatingWidthFt - aisleDeductionFt;

// ------------------------------------------------------------
// 8️⃣ AUTHORITATIVE SEATS PER ROW (WIDTH CLAMP)
// ------------------------------------------------------------

// Minimum 1" gap each side (convert to feet)
const SIDE_GAP_FT = 1 / 12;

// Total available width after safety gap
const safeSeatZoneFt =
  Math.max(
    0,
    effectiveSeatWidthFt - SIDE_GAP_FT * 2
  );

// Max seats that physically fit
const maxSeatsPerRow =
  Math.floor(safeSeatZoneFt / seatWidthFt);

// Authoritative seats (clamped)
const authoritativeSeatsPerRow =
  Math.max(1, maxSeatsPerRow);

// ------------------------------------------------------------
// 8️⃣ RISER DEPTH (72–84 INCHES)
// ------------------------------------------------------------

const RISER_MIN_DEPTH_IN = 72;
const RISER_MAX_DEPTH_IN = 84;

const riserDepthIn =
  effectiveRoomLengthFt > 22
    ? RISER_MAX_DEPTH_IN
    : RISER_MIN_DEPTH_IN;

// ------------------------------------------------------------
// 9️⃣ FINAL SEATING SUMMARY OUTPUT
// ------------------------------------------------------------

const seatingRecommendation =
  finalAuthoritativeRowCount > 1
    ? "2 Rows Recommended"
    : "1 Row Recommended";

const seatingWarning = "";

/**
 * STEP 6 — MISC / COMBINED PREFERENCES UNLOCK
 * Influences recommendations only — never geometry
 */
const isMiscUnlocked = isSeatingUnlocked;

console.log({
  isRoomValid,
  isAcousticUnlocked,
  isSpeakerUnlocked,
  isScreenUnlocked,
  isSeatingUnlocked,
});

const LockedCardShell = ({ title }: { title: string }) => (
  <div
    style={{
      background: "#020617",
      border: "1px dashed #1F2937",
      borderRadius: "8px",
      padding: "14px",
      opacity: 0.45,
    }}
  >
    <strong>{title}</strong>
    <p style={{ fontSize: "11px", marginTop: "6px", opacity: 0.6 }}>
      Complete previous steps to unlock
    </p>
  </div>
);

/* ============================================================
   STEP 7 — SIGHTLINE & VIEWING GEOMETRY (SOFT LIMITS ONLY)
   ============================================================ */

/**
 * Professional reference assumptions
 */
const EYE_HEIGHT_SEATED_IN = 42; // average seated eye height
const MAX_VERTICAL_VIEW_ANGLE_DEG = 15; // SMPTE / THX comfort limit
const MIN_SCREEN_BOTTOM_CLEARANCE_IN = 12; // avoid neck strain

/**
 * Screen geometry (derived)
 */
const screenHeightIn =
  typeof selectedScreenSize === "number"
    ? selectedScreenSize /
      Math.sqrt(
        selectedAspectRatio === "2.35:1"
          ? 1 + Math.pow(2.35, 2)
          : selectedAspectRatio === "4:3"
          ? 1 + Math.pow(4 / 3, 2)
          : 1 + Math.pow(16 / 9, 2)
      )
    : null;

const screenBottomHeightIn =
  screenHeightIn !== null
    ? MIN_SCREEN_BOTTOM_CLEARANCE_IN
    : null;

    /**
 * STEP 7.3 — Vertical viewing angle (SMPTE / THX)
 * Uses derived screen height + seated eye height
 */

const seatedEyeHeightIn = 42; // SMPTE average seated eye height
const maxVerticalViewAngleDeg = 15; // SMPTE / THX comfort limit

/**
 * STEP 7.4 — Screen bottom clearance (neck comfort)
 * Ensures screen is not mounted too low
 */

const isScreenBottomClearanceSafe =
  typeof screenBottomHeightIn === "number"
    ? screenBottomHeightIn >= MIN_SCREEN_BOTTOM_CLEARANCE_IN
    : true;

/**
 * Row eye heights
 */
const frontRowEyeHeightIn = EYE_HEIGHT_SEATED_IN;

const secondRowEyeHeightIn =
  rowCount > 1
    ? EYE_HEIGHT_SEATED_IN + selectedRiserHeightIn
    : null;

/**
 * Viewing angles
 */
const frontRowVerticalAngleDeg =
  screenHeightIn !== null
    ? Math.atan(
        (screenHeightIn / 2) /
          frontRowEyeHeightIn
      ) *
      (180 / Math.PI)
    : null;

const secondRowVerticalAngleDeg =
  secondRowEyeHeightIn !== null && screenHeightIn !== null
    ? Math.atan(
        (screenHeightIn / 2) /
          secondRowEyeHeightIn
      ) *
      (180 / Math.PI)
    : null;

/**
 * SOFT WARNINGS (never block)
 */
const isFrontRowSightlineComfortable =
  frontRowVerticalAngleDeg !== null
    ? frontRowVerticalAngleDeg <= MAX_VERTICAL_VIEW_ANGLE_DEG
    : true;

const isSecondRowSightlineComfortable =
  secondRowVerticalAngleDeg !== null
    ? secondRowVerticalAngleDeg <= MAX_VERTICAL_VIEW_ANGLE_DEG
    : true;

/**
 * Aggregated sightline state
 */
const hasSightlineWarning =
  !isFrontRowSightlineComfortable ||
  !isSecondRowSightlineComfortable;

/* ============================================================
   STEP 4B — EFFECTIVE VALUES (LOCK-AWARE, CALCULATION ONLY)
   ============================================================ */

const effectiveAcousticMode =
  isAcousticUnlocked ? acousticMode : null;

// ---------- SPEAKER EFFECTIVE VALUES ----------
const effectiveSpeakerLayoutChoice =
  isSpeakerUnlocked ? speakerLayoutChoice : "Auto";

// ---------- SCREEN EFFECTIVE VALUES ----------
const effectiveSelectedScreenSize =
  isScreenUnlocked ? selectedScreenSize : "Auto";

// ---------- SEATING EFFECTIVE VALUES ----------
const effectiveRowCount =
  isSeatingUnlocked ? rowCount : 1;

const effectiveSelectedRiserHeightIn =
isSeatingUnlocked ? selectedRiserHeightIn : 0;

// ---------- Stage 4.4 : Physical screen limits ----------

const sideClearance = 0.5;
const topClearance = 0.5;
const bottomClearance = 1.5;

const maxAllowedScreenWidth =
  typeof width === "number"
    ? width - sideClearance * 2
    : "";

const maxAllowedScreenHeight =
  typeof height === "number"
    ? height - topClearance - bottomClearance
    : "";

const screenFitsWidth =
  maxAllowedScreenWidth && screenWidthFt
    ? screenWidthFt <= maxAllowedScreenWidth
    : true;

const screenFitsHeight =
  maxAllowedScreenHeight && screenHeightFt
    ? screenHeightFt <= maxAllowedScreenHeight
    : true;

const screenPhysicallyFits =
  screenFitsWidth && screenFitsHeight;

const screenFeasibilityMessage =
  !screenPhysicallyFits
    ? !screenFitsWidth
      ? "Screen too wide for wall"
      : "Screen too tall for ceiling height"
    : "Screen fits physical room limits";

// ---------- Stage 4.7 : Corrected screen dimensions ----------

let finalScreenDiagonalIn: number | "" =
  typeof screenDiagonalInches === "number"
    ? screenDiagonalInches
    : "";

const finalAspect =
  selectedAspectRatio === "2.35:1" ? 2.35 : 16 / 9;

const finalScreenWidthIn =
  typeof finalScreenDiagonalIn === "number"
    ? (finalScreenDiagonalIn * finalAspect) /
      Math.sqrt(1 + finalAspect * finalAspect)
    : "";

const finalScreenHeightIn =
  typeof finalScreenWidthIn === "number"
    ? finalScreenWidthIn / finalAspect
    : "";

const finalScreenWidthFt =
  typeof finalScreenWidthIn === "number"
    ? finalScreenWidthIn / 12
    : "";

const finalScreenHeightFt =
  typeof finalScreenHeightIn === "number"
    ? finalScreenHeightIn / 12
    : "";

// Assume screen bottom is placed 24 inches above floor
const screenBottomInches = 24;

// ============================================================
// PHASE 4A — PROJECTOR BASE ASSUMPTIONS (AUTHORITATIVE)
// ============================================================

// ============================================================
// PHASE 4A — PROJECTOR CONSTANTS (AUTHORITATIVE, SINGLE SOURCE)
// ============================================================

const PROJECTOR_THROW_RATIO = 1.6;

const MAX_VERTICAL_LENS_SHIFT_PERCENT = 60;
const MAX_HORIZONTAL_LENS_SHIFT_PERCENT = 30;

// ============================================================
// PHASE 4B — REQUIRED PROJECTOR THROW DISTANCE (FEET)
// ============================================================

const requiredProjectorThrowFt =
  typeof finalScreenWidthFt === "number"
    ? finalScreenWidthFt * PROJECTOR_THROW_RATIO
    : 0;

// ============================================================
// PHASE 4C — PROJECTOR THROW FEASIBILITY
// ============================================================

// Projector must fit behind seating + screen obstruction
const projectorFitsInRoom =
  typeof usableRoomLengthFt === "number" &&
  requiredProjectorThrowFt > 0
    ? requiredProjectorThrowFt <= usableRoomLengthFt
    : true;

// ============================================================
// PHASE 4D — VERTICAL LENS SHIFT FEASIBILITY
// ============================================================

// Screen center height (inches)
const screenCenterHeightIn =
  typeof screenHeightInches === "number"
    ? screenBottomInches + screenHeightInches / 2
    : null;

// Projector lens height assumption (ceiling mounted, ~12" below ceiling)
const projectorLensHeightIn =
  typeof height === "number"
    ? height * 12 - 12
    : null;

// Required vertical shift (inches)
const requiredVerticalShiftIn =
  typeof projectorLensHeightIn === "number" &&
  typeof screenCenterHeightIn === "number"
    ? projectorLensHeightIn - screenCenterHeightIn
    : null;

// Required vertical shift (% of screen height)
const requiredVerticalShiftPercent =
  typeof requiredVerticalShiftIn === "number" &&
  typeof screenHeightInches === "number"
    ? Math.abs(
        (requiredVerticalShiftIn / screenHeightInches) * 100
      )
    : null;

// Vertical lens shift feasibility
let verticalLensShiftStatus: "OK" | "Warning" | "Not Possible" = "OK";

if (
  typeof requiredVerticalShiftPercent === "number" &&
  requiredVerticalShiftPercent > MAX_VERTICAL_LENS_SHIFT_PERCENT
) {
  verticalLensShiftStatus =
    requiredVerticalShiftPercent >
    MAX_VERTICAL_LENS_SHIFT_PERCENT + 10
      ? "Not Possible"
      : "Warning";
}

// ============================================================
// PHASE 4E — HORIZONTAL LENS SHIFT (CENTERED DEFAULT)
// ============================================================

// Projector is centered by default
const projectorHorizontalOffsetIn = 0;

// Required horizontal shift (% of screen width)
const requiredHorizontalShiftPercent =
  typeof screenWidthInches === "number"
    ? Math.abs(
        (projectorHorizontalOffsetIn / screenWidthInches) * 100
      )
    : null;

// Horizontal lens shift feasibility
let horizontalLensShiftStatus: "OK" | "Warning" | "Not Possible" = "OK";

if (
  typeof requiredHorizontalShiftPercent === "number" &&
  requiredHorizontalShiftPercent > MAX_HORIZONTAL_LENS_SHIFT_PERCENT
) {
  horizontalLensShiftStatus =
    requiredHorizontalShiftPercent >
    MAX_HORIZONTAL_LENS_SHIFT_PERCENT + 5
      ? "Not Possible"
      : "Warning";
}

// ============================================================
// PHASE 4F — PROJECTOR FEASIBILITY VERDICT
// ============================================================

let projectorVerdict:
  | "Recommended"
  | "Compromised"
  | "Not Feasible" = "Recommended";

if (!projectorFitsInRoom) {
  projectorVerdict = "Not Feasible";
} else if (
  verticalLensShiftStatus === "Warning" ||
  horizontalLensShiftStatus === "Warning"
) {
  projectorVerdict = "Compromised";
}

// ---------- Stage 4.5 : Ceiling mount feasibility ----------

// Ceiling mount is the ONLY allowed mounting method
const ceilingMountFeasible =
  typeof height === "number" &&
  height >= 8 &&
  horizontalLensShiftStatus !== "Not Possible" &&
  horizontalLensShiftStatus !== "Warning" &&
  verticalLensShiftStatus !== "Not Possible" &&
  verticalLensShiftStatus !== "Warning";

// Explanation
let ceilingMountMessage = "";

if (ceilingMountFeasible) {
  ceilingMountMessage =
    "Ceiling-mounted projector installation is feasible within lens shift limits.";
} else {
  ceilingMountMessage =
    "Ceiling mounting is not feasible due to height or lens shift limitations.";
}

/* ============================================================
   PHASE 8D — PROJECTOR AUTHORITY ENGINE
   SINGLE SOURCE OF TRUTH (FINAL OVERRIDE)
   ============================================================ */

/**
 * Discipline:
 * - No UI influence
 * - No state mutation
 * - Physical limits override everything
 */

let authoritativeProjectorVerdict:
  | "Recommended"
  | "Compromised"
  | "Not Feasible" = "Recommended";

// ---------- HARD FAILS ----------
if (!projectorFitsInRoom) {
  authoritativeProjectorVerdict = "Not Feasible";
}

if (verticalLensShiftStatus === "Not Possible") {
  authoritativeProjectorVerdict = "Not Feasible";
}

if (horizontalLensShiftStatus === "Not Possible") {
  authoritativeProjectorVerdict = "Not Feasible";
}

// ---------- SOFT LIMITS ----------
if (
  authoritativeProjectorVerdict === "Recommended" &&
  (
    verticalLensShiftStatus === "Warning" ||
    horizontalLensShiftStatus === "Warning"
  )
) {
  authoritativeProjectorVerdict = "Compromised";
}

// ---------- Ceiling Mount Safety ----------
if (
  authoritativeProjectorVerdict === "Recommended" &&
  !ceilingMountFeasible
) {
  authoritativeProjectorVerdict = "Compromised";
}

// ---------- Stage 4.6 : Screen vertical ergonomics ----------

// Average seated eye height (inches)
const eyeHeightInches = 42;

// ---------- Stage 5.1 : Base surround feasibility ----------

// Minimum requirements (feet)
const minWidthForSurround = 10;
const minListeningDistance = 8;

// Checks
const surroundWidthOk =
  typeof width === "number"
    ? width >= minWidthForSurround
    : false;

const surroundDistanceOk =
  typeof viewingDistance === "number"
    ? viewingDistance >= minListeningDistance
    : false;

const baseSurroundFeasible =
  surroundWidthOk && surroundDistanceOk;
  // ---------- Stage 5.2 : Rear surround feasibility (7.x) ----------

// Minimum rear clearance (feet)
const minRearClearance = 3;

// Estimated main listening position distance from screen
const mainSeatDistance =
  typeof viewingDistance === "number"
    ? viewingDistance
    : "";

// Remaining space behind listener
const rearClearance =
  typeof length === "number" && typeof mainSeatDistance === "number"
    ? length - mainSeatDistance
    : "";

  // ---------- Stage 5.3 : Atmos / height speaker feasibility ----------

// Atmos angle limits (degrees)
const minAtmosAngle = 30;
const maxAtmosAngle = 55;

// Check ceiling eligibility
const ceilingSupportsAtmos =
  typeof height === "number" && height >= 8;

// Height speaker angle (front heights)
const atmosAngle =
  typeof height === "number" && typeof viewingDistance === "number"
    ? Math.atan(
        ((height - eyeHeightInches / 12) / viewingDistance)
      ) * (180 / Math.PI)
    : "";

// Atmos usability
const atmosAngleValid =
  typeof atmosAngle === "number" &&
  atmosAngle >= minAtmosAngle &&
  atmosAngle <= maxAtmosAngle;

// Decide number of height speakers
let heightSpeakerConfig: "None" | "2 Heights" | "4 Heights" = "None";

if (!ceilingSupportsAtmos || !atmosAngleValid) {
  heightSpeakerConfig = "None";
} else if (height >= 9) {
  heightSpeakerConfig = "4 Heights";
} else {
  heightSpeakerConfig = "2 Heights";
}
// ---------- Stage 5.4 : Final speaker layout recommendation ----------

// Decide base surround layer
let baseLayer: "5" | "7" = "5";

if (typeof width === "number" && width >= 11) {
  baseLayer = "7";
}

// Decide height layer
let heightLayer: "0" | "2" | "4" = "0";

if (heightSpeakerConfig === "2 Heights") {
  heightLayer = "2";
} else if (heightSpeakerConfig === "4 Heights") {
  heightLayer = "4";
}

// ---------- Speaker auto recommendation flag ----------


    // ---------- Stage 5.5 : Subwoofer count & placement intelligence ----------

// Default subwoofer count
let subwooferCount = 1;

// Volume-based rule
if (typeof roomVolume === "number") {
  if (roomVolume >= 3000) {
    subwooferCount = 4;
  } else if (roomVolume >= 1800) {
    subwooferCount = 2;
  }
}

// ---------- Circular wave generator ----------
const generateWaveRings = (
  cx: number,
  cy: number,
  maxRadius: number,
  rings: number
) => {
  const step = maxRadius / rings;
  return Array.from({ length: rings }).map((_, i) => ({
    r: step * (i + 1),
    opacity: 0.25 - i * (0.18 / rings),
  }));
};

// Width-based reinforcement
if (typeof width === "number" && width >= 12 && subwooferCount === 1) {
  subwooferCount = 2;
}

// Room ratio penalty (square rooms need more subwoofwers)
if (
  typeof lengthWidthRatio === "string" &&
  Math.abs(Number(lengthWidthRatio) - 1) < 0.15
) {
  subwooferCount = Math.max(subwooferCount, 2);
}

// ============================================================
// PHASE 6.1 — Visual Scaling & Canvas Foundation
// ============================================================

// ---------- Safety margin around canvas ----------
const CANVAS_PADDING = 20; // px

// ---------- Room visual dimensions (AUTHORITATIVE) ----------
const visualRoomWidth =
  typeof width === "number" ? width * VISUAL_SCALE : 0;

const visualRoomLength =
  typeof length === "number" ? length * VISUAL_SCALE : 0;

// ---------- Total SVG canvas size ----------
const canvasWidth =
  visualRoomWidth + CANVAS_PADDING * 2;
const canvasHeight =
  visualRoomLength + CANVAS_PADDING * 2;

// ---------- Room origin (top-left inside padding) ----------
const roomOriginX = CANVAS_PADDING;
const roomOriginY = CANVAS_PADDING;

// ---------- Room boundaries ----------
const roomLeftX = roomOriginX;
const roomRightX = roomOriginX + visualRoomWidth;

const roomTopY = roomOriginY;
const roomBottomY = roomOriginY + visualRoomLength;

// ============================================================
// M1 — CANONICAL ROOM GEOMETRY (AUTHORITATIVE)
// ============================================================

// Visual room size (px)

// Raw architectural room (before acoustics)
const rawRoom = {
  x: roomLeftX,
  y: roomTopY,
  width: visualRoomWidth,
  length: visualRoomLength,
  right: roomLeftX + visualRoomWidth,
  bottom: roomTopY + visualRoomLength,
  centerX: roomLeftX + visualRoomWidth / 2,
  centerY: roomTopY + visualRoomLength / 2,
};

// ---------- Raw Room Derived Geometry ----------
const rawRoomRight = rawRoom.x + rawRoom.width;
const rawRoomBottom = rawRoom.y + rawRoom.length;
const rawRoomCenterX = rawRoom.x + rawRoom.width / 2;
const rawRoomCenterY = rawRoom.y + rawRoom.length / 2;

// ============================================================
// M1 — ACOUSTIC DEDUCTIONS (PER SURFACE, VISUAL)
// ============================================================

const frontWallDepthPx = frontWallDepthIn * inchToPx;
const backWallDepthPx = backWallDepthIn * inchToPx;
const leftWallDepthPx = leftWallDepthIn * inchToPx;
const rightWallDepthPx = rightWallDepthIn * inchToPx;

// ============================================================
// M1 — USABLE ROOM (POST ACOUSTIC + FRONT OBSTRUCTION)
// ============================================================

const usableRoom = {
  x: rawRoom.x + leftWallDepthPx,

  y:
    rawRoom.y +
    frontWallDepthPx +
    frontObstructionDepthPx,

  width: Math.max(
    0,
    rawRoom.width -
      leftWallDepthPx -
      rightWallDepthPx
  ),

  length: Math.max(
    0,
    rawRoom.length -
      frontWallDepthPx -
      backWallDepthPx -
      frontObstructionDepthPx
  ),
};

const usableRoomRight = usableRoom.x + usableRoom.width;
const usableRoomBottom = usableRoom.y + usableRoom.length;
const usableRoomCenterX = usableRoom.x + usableRoom.width / 2;
const usableRoomCenterY = usableRoom.y + usableRoom.length / 2;

const bassTrapSizePx = 2 * VISUAL_SCALE;
// ============================================================
// ---------- Speaker visual constants ----------
  
const SPEAKER_WIDTH = 14;
const SPEAKER_HEIGHT = 8;

const SUBWOOFER_WIDTH = 12;
const SUBWOOFER_HEIGHT = 12;

const WALL_SPEAKER_WIDTH_PX = 14
const WALL_SPEAKER_HEIGHT_PX = 8
const CEILING_SPEAKER_RADIUS_PX = 6
const SUB_SIZE_PX = 12

const SPEAKER_ON_WALL_OFFSET_PX = inchToPx * 1

// ---------- Speaker color system (LOCKED) ----------
const WALL_SPEAKER_COLOR = "#38BDF8";     // all wall speakers
const CEILING_SPEAKER_COLOR = "#FACC15";  // all Atmos speakers
const SUBWOOFER_COLOR = "#7F1D1D";         // all subs
// ---------- Sound wave ray visuals (speaker-accurate) ----------
const RAY_WIDTH = 0.8;
const RAY_STROKE_WIDTH = RAY_WIDTH;
const RAY_OPACITY = 0.6;
const RAY_DASH = "3 3";

// Max ray distance inside room
const maxRayLength =
  Math.min(visualRoomLength, visualRoomWidth) * 0.45;

// Cone spread angles (degrees)
const FRONT_CONE_ANGLE = 22;
const SURROUND_CONE_ANGLE = 30;
const SUBWOOFER_CONE_ANGLE = 45;

// Degree → radians
const degToRad = (deg: number) => (deg * Math.PI) / 180;

// Horizontal ray length (px)
const speakerRayLength = visualRoomLength * 0.55;

// ---------- Stage 6.4 : Screen visual size (TOP-DOWN FIXED) ----------

// Screen width scales with room width
const visualScreenWidth =
  typeof finalScreenWidthFt === "number"
    ? finalScreenWidthFt * VISUAL_SCALE
    : 0;

// Screen depth is fixed (top-down view)
const visualScreenDepth = 12; // px (do NOT scale)

// Screen touches the front wall
const screenX =
  visualRoomWidth / 2 + 20 - visualScreenWidth / 2;

const screenY = usableRoom.y;

// ============================================================
// PHASE 4 — PROJECTOR GEOMETRY (TOP-DOWN)
// ============================================================

// Convert to pixels
const projectorDistancePx = requiredProjectorThrowFt * VISUAL_SCALE;

// Projector position (centered, behind seats)
const projectorX = roomLeftX + visualRoomWidth / 2;
const projectorY =
  roomTopY +
  Math.min(
    visualRoomLength - 30,
    visualScreenDepth + projectorDistancePx
  );

// Lens spread (screen half width)
const projectorSpread =
  visualScreenWidth / 2;

  // ---------- Stage 4.3 : Lens shift & vertical offset ----------

// Screen geometry (side view logic)
const screenTopInches =
  typeof screenHeightInches === "number"
    ? screenBottomInches + screenHeightInches
    : null;

// Projector lens height assumption (ceiling mount)
// Lens is ~12" below ceiling
const projectorLensHeightInches =
  typeof height === "number"
    ? height * 12 - 12
    : null;

// Required vertical shift (inches)
const requiredVerticalShiftInches =
  typeof projectorLensHeightInches === "number" &&
  typeof screenCenterHeightIn === "number"
    ? projectorLensHeightInches - screenCenterHeightIn
    : null;

// ---------- Stage 4.4 : Horizontal lens shift & offset ----------

// Projector horizontal offset from screen center (feet)
// Currently centered → future-proofed for rack / hush box offsets
const projectorHorizontalOffsetFt = 0; // DO NOT CHANGE YET

// Convert to inches
const projectorHorizontalOffsetInches =
  projectorHorizontalOffsetFt * 12;

// Explanation
let horizontalLensShiftMessage = "";

if (horizontalLensShiftStatus === "OK") {
  horizontalLensShiftMessage =
    "Projector horizontal alignment is within safe limits.";
} else if (horizontalLensShiftStatus === "Warning") {
  horizontalLensShiftMessage =
    "Horizontal lens shift is near maximum capability. Precise mounting required.";
} else if (horizontalLensShiftStatus === "Not Possible") {
  horizontalLensShiftMessage =
    "Horizontal offset exceeds projector lens shift capability.";
}

// ---------- Stage 4.6 : Screen bottom & center speaker clearance ----------

// Center speaker physical assumptions (inches)
const CENTER_SPEAKER_HEIGHT_IN = 10;   // typical large center channel
const CENTER_SPEAKER_CLEARANCE_IN = 2; // airflow / vibration safety

// Minimum screen bottom height required (inches)
const minScreenBottomRequiredIn =
  CENTER_SPEAKER_HEIGHT_IN + CENTER_SPEAKER_CLEARANCE_IN;

// Recommended cinema range (inches)
const MIN_SCREEN_BOTTOM_IN = 18;
const MAX_SCREEN_BOTTOM_IN = 30;

// Actual screen bottom (already defined earlier)
const actualScreenBottomIn =
  typeof screenBottomInches === "number"
    ? screenBottomInches
    : null;

// Clearance check
const centerSpeakerFits =
  typeof actualScreenBottomIn === "number"
    ? actualScreenBottomIn >= minScreenBottomRequiredIn
    : false;

  // Screen bottom ergonomic evaluation
let screenBottomStatus: "Ideal" | "Acceptable" | "Too Low" | "Too High" | "" =
  "";

let screenBottomMessage = "";

if (actualScreenBottomIn === null) {
  screenBottomStatus = "";
} else if (actualScreenBottomIn < minScreenBottomRequiredIn) {
  screenBottomStatus = "Too Low";
  screenBottomMessage =
    "Screen is too low to physically accommodate a proper center speaker.";
} else if (actualScreenBottomIn < MIN_SCREEN_BOTTOM_IN) {
  screenBottomStatus = "Acceptable";
  screenBottomMessage =
    "Screen bottom is slightly low but usable with compact center speakers.";
} else if (actualScreenBottomIn <= MAX_SCREEN_BOTTOM_IN) {
  screenBottomStatus = "Ideal";
  screenBottomMessage =
    "Screen bottom height is ideal for cinema viewing and center speaker placement.";
} else {
  screenBottomStatus = "Too High";
  screenBottomMessage =
    "Screen bottom is high. Vertical viewing angle comfort may be reduced.";
}

// ---------- Stage 4.7 : Screen auto-correction ----------

// Enable auto-correction
const AUTO_SCREEN_CORRECTION_ENABLED = true;

// Minimum usable cinema screen diagonal (inches)
const MIN_SCREEN_DIAGONAL_IN = 90;

// Reduction step per iteration (inches)
const SCREEN_REDUCTION_STEP_IN = 2;

// Auto-corrected screen diagonal
let correctedScreenDiagonalIn: number | "" =
  typeof screenDiagonalInches === "number"
    ? screenDiagonalInches
    : "";

// Auto-correction loop (SAFE + BOUNDED)
if (
  AUTO_SCREEN_CORRECTION_ENABLED &&
  typeof correctedScreenDiagonalIn === "number"
) {
  let safetyCounter = 0;

  while (
    safetyCounter < 50 &&
    correctedScreenDiagonalIn >= MIN_SCREEN_DIAGONAL_IN
  ) {
    // Recalculate width & height based on aspect ratio
    const aspect =
      selectedAspectRatio === "2.35:1" ? 2.35 : 16 / 9;

    const testWidthIn =
      (correctedScreenDiagonalIn * aspect) /
      Math.sqrt(1 + aspect * aspect);

    const testHeightIn = testWidthIn / aspect;

    const testHeightFt = testHeightIn / 12;

    // Physical height check
    const fitsHeight =
      typeof maxAllowedScreenHeight === "number"
        ? testHeightFt <= maxAllowedScreenHeight
        : true;

    // Center speaker clearance check
    const testScreenBottomIn = screenBottomInches;
    const testCenterFits =
      typeof testScreenBottomIn === "number"
        ? testScreenBottomIn >= minScreenBottomRequiredIn
        : false;

    // Vertical viewing comfort check
    const testScreenCenterIn =
      testScreenBottomIn + testHeightIn / 2;

    const testVerticalAngle =
      typeof testScreenCenterIn === "number" &&
      typeof viewingDistance === "number"
        ? Math.abs(
            Math.atan(
              (testScreenCenterIn - eyeHeightInches) /
                (viewingDistance * 12)
            ) *
              (180 / Math.PI)
          )
        : 0;

    const verticalComfortOK = testVerticalAngle <= 20;

    // Lens shift feasibility
    const testLensShiftPercent =
      typeof projectorLensHeightInches === "number"
        ? Math.abs(
            ((projectorLensHeightInches - testScreenCenterIn) /
              testHeightIn) *
              100
          )
        : 0;

    const lensShiftOK =
      testLensShiftPercent <= MAX_VERTICAL_LENS_SHIFT_PERCENT;

    // Exit if ALL conditions pass
    if (
      fitsHeight &&
      testCenterFits &&
      verticalComfortOK &&
      lensShiftOK
    ) {
      break;
    }

    // Otherwise reduce screen
    correctedScreenDiagonalIn -= SCREEN_REDUCTION_STEP_IN;
    safetyCounter++;
  }
}

// Assign corrected diagonal to final value after auto-correction completes
finalScreenDiagonalIn = correctedScreenDiagonalIn;

// ---------- Stage 4.8 : Screen vertical position optimization ----------

// Allowed adjustment range (inches)
const SCREEN_BOTTOM_ADJUST_STEP_IN = 1;
const SCREEN_BOTTOM_MIN_IN = 18;
const SCREEN_BOTTOM_MAX_IN = 32;

// Start with current bottom
let optimizedScreenBottomIn =
  typeof screenBottomInches === "number"
    ? screenBottomInches
    : "";

// Optimization status
let screenPositionOptimized = false;

// ---------- Stage 4.8 : Optimization loop ----------

if (
  typeof optimizedScreenBottomIn === "number" &&
  typeof finalScreenHeightIn === "number" &&
  typeof viewingDistance === "number" &&
  typeof projectorLensHeightInches === "number"
) {
  let safetyCounter = 0;

  while (safetyCounter < 30) {
    const testScreenCenterIn =
      optimizedScreenBottomIn + finalScreenHeightIn / 2;

    // Vertical viewing angle
    const testVerticalAngle =
      Math.abs(
        Math.atan(
          (testScreenCenterIn - eyeHeightInches) /
            (viewingDistance * 12)
        ) *
          (180 / Math.PI)
      );

    // Center speaker clearance
    const centerFits =
      optimizedScreenBottomIn >= minScreenBottomRequiredIn;

    // Lens shift %
    const testLensShiftPercent =
      Math.abs(
        ((projectorLensHeightInches - testScreenCenterIn) /
          finalScreenHeightIn) *
          100
      );

    const lensShiftOK =
      testLensShiftPercent <= MAX_VERTICAL_LENS_SHIFT_PERCENT;

    // Ideal condition
    if (
      testVerticalAngle <= 15 &&
      centerFits &&
      lensShiftOK
    ) {
      screenPositionOptimized = true;
      break;
    }

    // Adjustment logic:
    // If angle too steep → move screen DOWN
    if (testVerticalAngle > 15) {
      optimizedScreenBottomIn -= SCREEN_BOTTOM_ADJUST_STEP_IN;
    }
    // If center speaker tight → move screen UP
    else if (!centerFits) {
      optimizedScreenBottomIn += SCREEN_BOTTOM_ADJUST_STEP_IN;
    }
    // If lens shift high → move screen DOWN
    else if (!lensShiftOK) {
      optimizedScreenBottomIn -= SCREEN_BOTTOM_ADJUST_STEP_IN;
    }

    // Clamp
    optimizedScreenBottomIn = Math.max(
      SCREEN_BOTTOM_MIN_IN,
      Math.min(optimizedScreenBottomIn, SCREEN_BOTTOM_MAX_IN)
    );

    safetyCounter++;
  }
}

// ---------- Stage 4.8 : Final screen vertical geometry ----------

const finalScreenBottomIn =
  typeof optimizedScreenBottomIn === "number"
    ? optimizedScreenBottomIn
    : "";

const finalScreenCenterIn =
  typeof finalScreenBottomIn === "number" &&
  typeof finalScreenHeightIn === "number"
    ? finalScreenBottomIn + finalScreenHeightIn / 2
    : "";

// ============================================================
// PHASE 8 — SCREEN AUTHORITY ENGINE (FINAL OVERRIDE LAYER)
// ============================================================

/**
 * Discipline:
 * - Does NOT mutate upstream calculations
 * - Overrides final screen values ONLY if required
 * - Speaker mounting is authoritative
 * - Physical limits always win
 */

// ------------------------------------------------------------
// 8A — Screen Type Authority
// ------------------------------------------------------------

// In-wall speakers REQUIRE acoustically transparent screen
const requiresAcousticallyTransparentScreen =
  speakerMountType === "InWall";

// On-wall speakers CANNOT use AT screen
const solidScreenRequired =
  speakerMountType === "OnWall";

// Final screen type
const effectiveScreenType: "AT" | "Solid" =
  requiresAcousticallyTransparentScreen
    ? "AT"
    : "Solid";

// ------------------------------------------------------------
// 8B — Center Speaker Physical Clearance Authority
// ------------------------------------------------------------

const CENTER_SPEAKER_TOTAL_REQUIRED_IN =
  CENTER_SPEAKER_HEIGHT_IN +
  CENTER_SPEAKER_CLEARANCE_IN;

// If solid screen, center must sit below screen
const centerClearanceViolation =
  effectiveScreenType === "Solid" &&
  typeof finalScreenBottomIn === "number" &&
  finalScreenBottomIn < CENTER_SPEAKER_TOTAL_REQUIRED_IN;

// ------------------------------------------------------------
// 8C — Hard Screen Geometry Authority
// ------------------------------------------------------------

let authoritativeScreenBottomIn =
  finalScreenBottomIn;

let authoritativeScreenHeightIn =
  finalScreenHeightIn;

let authoritativeScreenDiagonalIn =
  finalScreenDiagonalIn;

// If clearance violated, push screen up (within safe range)
if (
  centerClearanceViolation &&
  typeof authoritativeScreenBottomIn === "number"
) {
  authoritativeScreenBottomIn =
    CENTER_SPEAKER_TOTAL_REQUIRED_IN;
}

// Recalculate center after override
const authoritativeScreenCenterIn =
  typeof authoritativeScreenBottomIn === "number" &&
  typeof authoritativeScreenHeightIn === "number"
    ? authoritativeScreenBottomIn +
      authoritativeScreenHeightIn / 2
    : "";

// ------------------------------------------------------------
// 8D — Final Screen Authority Verdict
// ------------------------------------------------------------

let screenAuthorityStatus:
  | "Valid"
  | "Adjusted"
  | "Conflict" = "Valid";

let screenAuthorityMessage = "";

if (centerClearanceViolation) {
  screenAuthorityStatus = "Adjusted";
  screenAuthorityMessage =
    "Screen bottom raised to accommodate center speaker clearance.";
}

// Hard physical conflict
if (
  typeof authoritativeScreenBottomIn === "number" &&
  typeof height === "number" &&
  authoritativeScreenBottomIn / 12 >
    height - 2
) {
  screenAuthorityStatus = "Conflict";
  screenAuthorityMessage =
    "Screen height exceeds safe ceiling limits after clearance correction.";
}

// Final vertical viewing angle
const finalVerticalViewingAngleDegrees =
  typeof finalScreenCenterIn === "number" &&
  typeof viewingDistance === "number"
    ? Math.abs(
        Math.atan(
          (finalScreenCenterIn - eyeHeightInches) /
            (viewingDistance * 12)
        ) *
          (180 / Math.PI)
      )
    : "";

    // ---------- Screen size standards (inches) ----------
const STANDARD_SCREEN_SIZES = [
  72, 92, 100, 110, 120, 135, 150, 165, 180, 200,
];

// ---------- Auto recommended screen (rounded to nearest standard) ----------
const autoRecommendedScreenIn =
  typeof finalScreenDiagonalIn === "number"
    ? STANDARD_SCREEN_SIZES.reduce((prev, curr) =>
        Math.abs(curr - finalScreenDiagonalIn) <
        Math.abs(prev - finalScreenDiagonalIn)
          ? curr
          : prev
      )
    : null;

// ---------- Screen fit validation ----------
const isScreenSizeAllowed = (sizeIn: number) =>
  typeof finalScreenDiagonalIn === "number"
    ? sizeIn <= finalScreenDiagonalIn
    : false;

    // ---------- Stage 4.8 : Final vertical comfort ----------

let finalVerticalComfort:
  | "Comfortable"
  | "Slightly High"
  | "Too High"
  | "" = "";

if (finalVerticalViewingAngleDegrees === "") {
  finalVerticalComfort = "";
} else if (finalVerticalViewingAngleDegrees <= 15) {
  finalVerticalComfort = "Comfortable";
} else if (finalVerticalViewingAngleDegrees <= 20) {
  finalVerticalComfort = "Slightly High";
} else {
  finalVerticalComfort = "Too High";
}

// ---------- Stage 4.9 : Multi-row sightline validation ----------

// Eye heights (inches)
const FRONT_ROW_EYE_IN = 42; // seated
const REAR_ROW_EYE_IN =
  finalAuthoritativeRowCount > 1
    ? 42 + finalRiserHeightIn
    : null;

// Head obstruction height (inches)
const FRONT_ROW_HEAD_IN = 48;

// Screen geometry (final)
const screenBottomIn = finalScreenBottomIn;
const screenTopIn =
  typeof finalScreenBottomIn === "number" &&
  typeof finalScreenHeightIn === "number"
    ? finalScreenBottomIn + finalScreenHeightIn
    : "";

    // ---------- Stage 4.9 : Sightline math ----------

// Distance from Row 2 eyes to front row head (feet)
const rowEyeToHeadDistanceFt = seatDepthFt;

// Distance from Row 2 eyes to screen (feet)
const rowEyeToScreenDistanceFt =
  typeof viewingDistance === "number"
    ? viewingDistance + seatDepthFt
    : "";

// Height of sightline at front row head position
const sightlineHeightAtFrontHeadIn =
  typeof REAR_ROW_EYE_IN === "number" &&
  typeof rowEyeToHeadDistanceFt === "number" &&
  typeof rowEyeToScreenDistanceFt === "number" &&
  typeof screenBottomIn === "number"
    ? REAR_ROW_EYE_IN -
      ((REAR_ROW_EYE_IN - screenBottomIn) *
        (rowEyeToHeadDistanceFt /
          rowEyeToScreenDistanceFt))
    : "";

// Clear sightline?
const row2SightlineClear =
  typeof sightlineHeightAtFrontHeadIn === "number"
    ? sightlineHeightAtFrontHeadIn >= FRONT_ROW_HEAD_IN
    : true;

    // ---------- Stage 4.9 : Row 2 neck comfort ----------

const row2ScreenCenterIn = finalScreenCenterIn;

// Vertical angle for Row 2
const row2VerticalAngle =
  typeof row2ScreenCenterIn === "number" &&
  typeof REAR_ROW_EYE_IN === "number" &&
  typeof rowEyeToScreenDistanceFt === "number"
    ? Math.abs(
        Math.atan(
          (row2ScreenCenterIn - REAR_ROW_EYE_IN) /
            (rowEyeToScreenDistanceFt * 12)
        ) *
          (180 / Math.PI)
      )
    : "";

// Comfort limit (row 2 can tolerate slightly more)
const row2ComfortOK =
  typeof row2VerticalAngle === "number"
    ? row2VerticalAngle <= 20
    : true;

    // ---------- Stage 4.9 : Row 2 verdict ----------

let row2ViewingStatus:
  | "Clear"
  | "Compromised"
  | "Blocked"
  | "" = "";

let row2ViewingMessage = "";

if (seatingRecommendation !== "2 Rows Recommended") {
  row2ViewingStatus = "";
} else if (!row2SightlineClear) {
  row2ViewingStatus = "Blocked";
  row2ViewingMessage =
    "Rear row view is blocked by front row head height.";
} else if (!row2ComfortOK) {
  row2ViewingStatus = "Compromised";
  row2ViewingMessage =
    "Rear row vertical viewing angle is steep but usable.";
} else {
  row2ViewingStatus = "Clear";
  row2ViewingMessage =
    "Rear row has a clear and comfortable view of the screen.";
}

// ============================================================
// PHASE 5.1 — Front LCR Speaker Angular Geometry
// ============================================================

// ITU / THX recommended angles (degrees)
const LCR_MIN_ANGLE = 22;
const LCR_MAX_ANGLE = 30;
const LCR_IDEAL_ANGLE = 26;

// Listener position (Row 1, centered)
const mainListenerX =
  roomLeftX + visualRoomWidth / 2;

// Listener Y is not required for horizontal LCR angle math
const mainListenerY = 0;
    // ---------- Phase 5.1 : Ideal LCR positions ----------

// Horizontal distance from listener to screen plane (px)
const listenerToScreenDistancePx =
  typeof viewingDistance === "number"
    ? viewingDistance * VISUAL_SCALE
    : 0;

// Convert degrees → radians
const idealAngleRad =
  (LCR_IDEAL_ANGLE * Math.PI) / 180;

// Ideal horizontal offset from center (px)
const idealLROffsetPx =
  Math.tan(idealAngleRad) * listenerToScreenDistancePx;

// Proposed speaker X positions
const idealLeftSpeakerX =
  mainListenerX - idealLROffsetPx;

const idealRightSpeakerX =
  mainListenerX + idealLROffsetPx;

// Y position = front wall
const frontSpeakerY = roomTopY;

// ============================================================
// PHASE 5.2 — Surround Speaker Angular Geometry
// ============================================================

// Dolby reference angles (degrees from listening position)
const SIDE_SURROUND_MIN = 90;
const SIDE_SURROUND_MAX = 110;

const REAR_SURROUND_MIN = 135;
const REAR_SURROUND_MAX = 150;

// Listening position reference (first row only)
const listenerDistanceFt =
  typeof viewingDistance === "number" ? viewingDistance : 0;

// Remaining space behind listener
const spaceBehindListenerFt =
  typeof length === "number" && listenerDistanceFt
    ? length - listenerDistanceFt
    : 0;

// -------- Side surround feasibility --------
const sideSurroundFeasible =
  typeof width === "number" && width >= 10;

// -------- Rear surround feasibility --------
const rearSurroundFeasible =
  spaceBehindListenerFt >= 3;

// -------- Decide surround layout --------
let surroundLayout: "5.x" | "7.x" = "5.x";

if (sideSurroundFeasible && rearSurroundFeasible) {
  surroundLayout = "7.x";
}

// -------- Final surround angles --------
const sideSurroundAngle =
  surroundLayout === "7.x"
    ? (SIDE_SURROUND_MIN + SIDE_SURROUND_MAX) / 2
    : (SIDE_SURROUND_MIN + SIDE_SURROUND_MAX) / 2;

const rearSurroundAngle =
  surroundLayout === "7.x"
    ? (REAR_SURROUND_MIN + REAR_SURROUND_MAX) / 2
    : null;

// -------- Human-readable labels --------
const surroundDescription =
  surroundLayout === "7.x"
    ? "Side + Rear Surrounds (7.x layout)"
    : "Side Surrounds Only (5.x layout)";

/**
 * STEP 4F-0 — BASE LAYER SOURCES
 */

// AUTO base layer (derived from auto surround result)
const autoBaseSpeakerLayer: 5 | 7 =
  surroundLayout === "7.x" ? 7 : 5;

// MANUAL base layer (only relevant if speakers unlocked)
let manualBaseLayer: 5 | 7 = 5;

if (isSpeakerUnlocked) {
  manualBaseLayer =
    speakerLayoutChoice.startsWith("7") ? 7 : 5;
}

/**
 * STEP 4F – FINAL EFFECTIVE BASE SPEAKER LAYER
 * (5.x or 7.x)
 */
const effectiveBaseSpeakerLayer: 5 | 7 =
  isSpeakerUnlocked
    ? manualBaseLayer
    : autoBaseSpeakerLayer;

// ============================================================
// PHASE 5.3 — Atmos Height Speaker Geometry (Ceiling Mount Only)
// ============================================================

// Dolby Atmos reference elevation angles (degrees)
const ATMOS_MIN_ANGLE = 30;
const ATMOS_MAX_ANGLE = 55;

// Listener reference (first row only)
const listenerEarHeightFt = 3.5; // seated ear height
const ceilingHeightFt =
  typeof height === "number" ? height : 0;

// Vertical distance from ear to ceiling
const verticalDistanceFt =
  ceilingHeightFt > listenerEarHeightFt
    ? ceilingHeightFt - listenerEarHeightFt
    : 0;

// Horizontal distance from listener to screen
const horizontalDistanceFt =
  typeof viewingDistance === "number" ? viewingDistance : 0;

// Calculate elevation angle (degrees)
const atmosElevationAngle =
  verticalDistanceFt && horizontalDistanceFt
    ? Math.atan(verticalDistanceFt / horizontalDistanceFt) *
      (180 / Math.PI)
    : 0;

// ---------- Atmos feasibility ----------
const atmosFeasible =
  ceilingHeightFt >= 8 &&
  atmosElevationAngle >= ATMOS_MIN_ANGLE &&
  atmosElevationAngle <= ATMOS_MAX_ANGLE;

// ---------- Decide Atmos layer count ----------
let atmosLayer: "0" | "2" | "4" = "0";

if (atmosFeasible && ceilingHeightFt >= 9) {
  atmosLayer = "4";
} else if (atmosFeasible) {
  atmosLayer = "2";
}

// ---------- Human-readable Atmos description ----------
const atmosDescription =
  atmosLayer === "4"
    ? "4 Dolby Atmos ceiling speakers (Top Front + Top Rear)"
    : atmosLayer === "2"
    ? "2 Dolby Atmos ceiling speakers (Top Middle)"
    : "Dolby Atmos not recommended for this room";

	 // ============================================================
// PHASE 5.4 — Final Speaker System Resolution
// ============================================================

// ---------- Base layer (front + surround) ----------
let baseSpeakerLayer: "5" | "7" = "5";

if (surroundLayout === "7.x") {
  baseSpeakerLayer = "7";
}

// ---------- Height layer (Atmos) ----------
let heightSpeakerLayer: "0" | "2" | "4" = "0";

if (atmosLayer === "4") {
  heightSpeakerLayer = "4";
} else if (atmosLayer === "2") {
  heightSpeakerLayer = "2";
}



// ---------- Subwoofer layer (fixed at 1 for now) ----------
const subwooferLayer = "1";

// ---------- Final system string ----------
const finalSpeakerLayout =
  `${baseSpeakerLayer}.${subwooferLayer}.${heightSpeakerLayer}` as
    | "5.1.0"
    | "5.1.2"
    | "5.1.4"
    | "7.1.0"
    | "7.1.2"
    | "7.1.4";

// ---------- Human-readable label ----------
const speakerLayoutLabel =
  heightSpeakerLayer === "0"
    ? `${baseSpeakerLayer}.1 (No Atmos)`
    : `${baseSpeakerLayer}.1.${heightSpeakerLayer} Dolby Atmos`;

// ---------- Internal validation (safety) ----------
const speakerLayoutValid =
  !(
    baseSpeakerLayer === "7" &&
    surroundLayout !== "7.x"
  );

  // ============================================================
// PHASE 5.5 — Subwoofer Count & Placement Intelligence
// ============================================================

// ---------- Room volume (ft³) ----------
const roomVolumeFt3 =
  typeof length === "number" &&
  typeof width === "number" &&
  typeof height === "number"
    ? length * width * height
    : 0;

// ---------- Default subwoofer count ----------

// ---------- Volume-based logic ----------
if (roomVolumeFt3 >= 3000) {
  subwooferCount = 4;
} else if (roomVolumeFt3 >= 1800) {
  subwooferCount = 2;
}

// ============================================================
// SUMMARY HELPERS (ORDER-SAFE)
// ============================================================

// ---------- Seating auto recommendation ----------
const seatingAutoRecommended =
  hasValidDimensions &&
  seatingWarning === "";

// ---------- Speaker auto recommendation ----------
const speakerAutoRecommended =
  speakerLayoutChoice === "Auto";

// ---------- Speaker standard reference ----------
const speakerStandardLabel =
  speakerLayoutLabel.includes("Auro")
    ? "Auro-3D Standard"
    : speakerLayoutLabel.includes("Atmos")
    ? "Dolby Atmos / DTS:X"
    : speakerLayoutLabel.includes("THX")
    ? "THX Reference"
    : "Cinema Standard";

// ---------- Room proportion penalty (square rooms) ----------
const roomAspectRatio =
  typeof length === "number" && typeof width === "number"
    ? length / width
    : 0;

if (roomAspectRatio > 0.85 && roomAspectRatio < 1.15) {
  subwooferCount = Math.max(subwooferCount, 2);
}

// ---------- Width-based reinforcement ----------
if (typeof width === "number" && width >= 12 && subwooferCount === 1) {
  subwooferCount = 2;
}

// ---------- Final safety clamp ----------
subwooferCount = Math.min(Math.max(subwooferCount, 1), 4);

// ---------- Placement recommendation ----------
let subwooferPlacement = "";

if (subwooferCount === 1) {
  subwooferPlacement = "Front wall, offset from corner (avoid exact center)";
} else if (subwooferCount === 2) {
  subwooferPlacement = "Front wall midpoints or diagonal corners";
} else {
  subwooferPlacement = "Four corners or mid-wall symmetric placement";
}

// =====================
// CEILING SPEAKER ELIGIBILITY
// =====================
const ceilingHeightAllowsHeightSpeakers =
  typeof usableCeilingHeightFt === "number" &&
  usableCeilingHeightFt >= 8;

// ============================================================
// PHASE 8C — SPEAKER AUTHORITY ENGINE (GEOMETRY ABSOLUTE)
// ============================================================

/**
 * Discipline:
 * - No UI control
 * - No card dependency
 * - Only physical room + acoustic deductions
 * - Overrides unsafe manual selections
 */

// ---------- Start with current manual request ----------
let authoritativeBaseLayer: 5 | 7 =
  effectiveBaseSpeakerLayer;

let authoritativeAtmosLayer: 0 | 2 | 4 =
  effectiveAtmosLayers;

// ---------- CEILING HARD LIMIT ----------
if (!ceilingHeightAllowsHeightSpeakers) {
  authoritativeAtmosLayer = 0;
}

// ---------- ATMOS MAX LIMIT ----------
if (authoritativeAtmosLayer > maxAllowedAtmosLayers) {
  authoritativeAtmosLayer = maxAllowedAtmosLayers;
}

// ---------- WIDTH HARD LIMIT FOR 7.x ----------
if (
  authoritativeBaseLayer === 7 &&
  (typeof width !== "number" || width < 11)
) {
  authoritativeBaseLayer = 5;
}

// ---------- LENGTH HARD LIMIT FOR 7.x ----------
if (
  authoritativeBaseLayer === 7 &&
  (typeof usableRoomLengthFt !== "number" ||
    usableRoomLengthFt < 15)
) {
  authoritativeBaseLayer = 5;
}

// ---------- ATMOS LENGTH SAFETY ----------
if (
  authoritativeAtmosLayer === 4 &&
  usableRoomLengthFt < 18
) {
  authoritativeAtmosLayer = 2;
}

if (
  authoritativeAtmosLayer === 2 &&
  usableRoomLengthFt < 14
) {
  authoritativeAtmosLayer = 0;
}

// ---------- FINAL AUTHORITATIVE SYSTEM ----------
const authoritativeSpeakerLayout =
  `${authoritativeBaseLayer}.1.${authoritativeAtmosLayer}` as
    | "5.1.0"
    | "5.1.2"
    | "5.1.4"
    | "7.1.0"
    | "7.1.2"
    | "7.1.4";

// ---------- STATUS CLASSIFICATION ----------
let speakerAuthorityStatus:
  | "Valid"
  | "Adjusted"
  | "Restricted" = "Valid";

let speakerAuthorityMessage = "";

if (
  authoritativeSpeakerLayout !== finalSpeakerLayout
) {
  speakerAuthorityStatus = "Adjusted";
  speakerAuthorityMessage =
    "Speaker layout adjusted to meet physical room constraints.";
}

if (
  authoritativeAtmosLayer === 0 &&
  effectiveAtmosLayers > 0
) {
  speakerAuthorityStatus = "Restricted";
  speakerAuthorityMessage =
    "Atmos speakers removed due to insufficient ceiling height or room depth.";
}

// ============================================================
// END PHASE 8C
// ============================================================

// ---------- Phase 5.1 : Clamp speakers inside walls ----------

// Speaker body half width (px)
const FRONT_SPEAKER_HALF_WIDTH = 7;

// Clamp helpers
const clampFrontSpeakerX = (x: number) =>
  Math.max(
    roomLeftX + FRONT_SPEAKER_HALF_WIDTH,
    Math.min(
      x,
      roomRightX - FRONT_SPEAKER_HALF_WIDTH
    )
  );

// Final LCR positions
const finalLeftSpeakerX =
  clampFrontSpeakerX(idealLeftSpeakerX);

const finalCenterSpeakerX = mainListenerX;

const finalRightSpeakerX =
  clampFrontSpeakerX(idealRightSpeakerX);

  // ---------- Phase 5.1 : Actual angle calculation ----------

// Calculate angle from listener to speaker
const calculateAngleDeg = (sx: number) => {
  const dx = sx - mainListenerX;
  const dy = mainListenerY - frontSpeakerY;

  return Math.abs(
    Math.atan(dx / dy) * (180 / Math.PI)
  );
};

const leftSpeakerAngle =
  calculateAngleDeg(finalLeftSpeakerX);

const rightSpeakerAngle =
  calculateAngleDeg(finalRightSpeakerX);

  // ---------- Phase 5.1 : LCR geometry evaluation ----------

let lcrGeometryStatus:
  | "Ideal"
  | "Acceptable"
  | "Too Narrow"
  | "Too Wide"
  | "" = "";

let lcrGeometryMessage = "";

if (
  leftSpeakerAngle >= LCR_MIN_ANGLE &&
  rightSpeakerAngle >= LCR_MIN_ANGLE &&
  leftSpeakerAngle <= LCR_MAX_ANGLE &&
  rightSpeakerAngle <= LCR_MAX_ANGLE
) {
  lcrGeometryStatus = "Ideal";
  lcrGeometryMessage =
    "Front LCR speakers meet cinema reference angles.";
} else if (
  leftSpeakerAngle >= 20 &&
  rightSpeakerAngle >= 20
) {
  lcrGeometryStatus = "Acceptable";
  lcrGeometryMessage =
    "Front speaker angles are slightly outside ideal but usable.";
} else if (
  leftSpeakerAngle < LCR_MIN_ANGLE ||
  rightSpeakerAngle < LCR_MIN_ANGLE
) {
  lcrGeometryStatus = "Too Narrow";
  lcrGeometryMessage =
    "Front speakers are too close together. Soundstage will be narrow.";
} else {
  lcrGeometryStatus = "Too Wide";
  lcrGeometryMessage =
    "Front speakers are too wide. Center imaging may suffer.";
}

// ---------- Stage 7.7 : Bass trap positions ----------

// Front corners
const frontLeftBassTrap = {
  x: roomLeftX,
  y: roomTopY,
};

const frontRightBassTrap = {
  x: roomRightX - bassTrapSizePx,
  y: roomTopY,
};

// Rear corners
const rearLeftBassTrap = {
  x: roomLeftX,
  y: roomBottomY - bassTrapSizePx,
};

const rearRightBassTrap = {
  x: roomRightX - bassTrapSizePx,
  y: roomBottomY - bassTrapSizePx,
};

// ---------- Text safety margins ----------
const textPaddingX = 8;
const textPaddingY = 6;

// Clamp helpers
const clampX = (x: number) =>
  Math.max(roomLeftX + textPaddingX,
    Math.min(x, roomRightX - textPaddingX)
  );

const clampY = (y: number) =>
  Math.max(roomTopY + textPaddingY,
    Math.min(y, roomBottomY - textPaddingY)
  );

// Seat safety padding (px)
const seatSafetyMargin = 10;

const frontSeatClearance = 2 * VISUAL_SCALE; // 2ft safety from screen


// ---------- Stage 6.25 : Label safety offsets ----------
const rowLabelYOffset = 18;     // distance below seats
const seatCountYOffset = 10;    // distance below seats

// ============================================================
// FINAL ROW POSITION AUTHORITY (ACOUSTIC ROOM BASED ONLY)
// ============================================================

if (!usableRoom) return null;

// 1 ft front & rear clearance
const frontClearancePx = VISUAL_SCALE;
const rearClearancePx = VISUAL_SCALE;

// Seat depth (already defined globally)
const rowDepthPx = seatDepthPx;

// Available depth inside acoustic room
const availableDepthPx =
  usableRoom.length - frontClearancePx - rearClearancePx;

// Max rows physically possible
const maxRowsByDepth = Math.floor(
  availableDepthPx / rowDepthPx
);

// Equal spacing logic
const rowSpacingPx =
  authoritativeRowCount > 1
    ? (availableDepthPx -
        rowDepthPx * authoritativeRowCount) /
      (authoritativeRowCount - 1)
    : 0;

// ============================================================
// PHASE 6 — AUTHORITATIVE REAR-ANCHORED ROW ENGINE (FINAL SAFE)
// ============================================================
// ============================================================
// REAR-ANCHORED Y DISTRIBUTION
// Back row is fixed to rear wall.
// All other rows move forward equally.
// ============================================================

//
// FINAL Y positions (REAR ANCHORED — CINEMA CORRECT)
//

const usableBottomY =
  usableRoom.y + usableRoom.length;

// Build from back row first
const rowYPositions = Array.from(
  { length: authoritativeRowCount },
  (_, i) =>
    usableBottomY -
    rearClearancePx -
    seatDepthPx -
    i * (rowDepthPx + rowSpacingPx)
).reverse(); // Reverse so Row 1 is front-most

// Backward compatibility
const firstRowY = rowYPositions[0] ?? 0;

const secondRowY =
  rowYPositions.length > 1
    ? rowYPositions[1]
    : 0;

// ============================================================
// PHASE 6.8 — Seat Safety Margins & Wall Clearance (LOCKED)
// ============================================================

// Absolute horizontal seat safety margin (px)
// Prevents armrests touching walls
const SEAT_WALL_MARGIN_PX = 10;

// ============================================================
// PHASE 6.5 — Primary Listening Axis (GLOBAL)
// ============================================================

const primaryListenerY =
  typeof viewingDistance === "number"
    ? usableRoom.y + viewingDistance * VISUAL_SCALE
    : usableRoomCenterY;

// ---------- Stage 7.1 : Acoustic visual constants ----------

// Depth (px)
const absorberDepth = 14;
const diffuserDepth = 18;

// Colors
const absorberColor = "#7C3AED";   // purple
const diffuserColor = "#F59E0B";   // amber

// ---------- Stage 7.9 – Step 2 : Rear wall diffuser sizing ----------

// Default rear diffuser dimensions (feet)
let rearDiffuserWidthFt = 0;
let rearDiffuserHeightFt = 0;
let rearDiffuserDepthIn = 0;

// Convert to pixels
const rearDiffuserWidthPx =
  rearDiffuserWidthFt * VISUAL_SCALE;

const rearDiffuserHeightPx =
  rearDiffuserHeightFt * VISUAL_SCALE;

const rearDiffuserDepthPxFinal =
  rearDiffuserDepthIn * inchToPx;


// ---------- Stage 7.9 – Step 3 : Rear wall diffuser positioning ----------

// Center diffuser horizontally on rear wall
const rearDiffuserX =
  roomLeftX + (visualRoomWidth - rearDiffuserWidthPx) / 2;

// Vertical placement: centered at ear height
const rearDiffuserEarHeightFt = 3.5;
const rearDiffusercenterY =
  roomTopY + rearDiffuserEarHeightFt * VISUAL_SCALE;

// Calculate top Y
const rawRearDiffuserY =
  rearDiffusercenterY - rearDiffuserHeightPx / 2;

// Clamp vertically inside room
const rearDiffuserY =
  Math.max(
    roomTopY + 10,
    Math.min(
      rawRearDiffuserY,
      roomBottomY - rearDiffuserHeightPx - 10
    )
  );
  
// ---------- Stage 7.8 : Ceiling acoustic cloud constants ----------

// Ceiling cloud size (feet)
const ceilingCloudWidthFt = 4;
const ceilingCloudHeightFt = 3;

// Convert to pixels
const ceilingCloudWidthPx = ceilingCloudWidthFt * VISUAL_SCALE;
const ceilingCloudHeightPx = ceilingCloudHeightFt * VISUAL_SCALE;



// Ceiling cloud thickness (inches → pixels)
const ceilingCloudDepthIn = 4;
const ceilingCloudDepthPx = ceilingCloudDepthIn * inchToPx;

// ---------- Stage 7.7 : Bass trap logic ----------

// Bass trap size (feet)
const bassTrapSizeFt = 2; // standard 2ft corner traps

// Decide bass trap coverage based on room volume
let bassTrapCoverage: "All" | "RearOnly" | "None" = "All";

if (typeof roomVolume === "number") {
  if (roomVolume < 1500) {
    bassTrapCoverage = "All";
  } else if (roomVolume <= 2500) {
    bassTrapCoverage = "RearOnly";
  } else {
    bassTrapCoverage = "None";
  }
}

// ---------- Stage 7.6 : Front wall acoustic treatment ----------

// Front wall always treated behind screen (cinema standard)
const frontWallTreatment: "Absorber" = "Absorber";

// Front wall absorber depth (inches)
// Short rooms need deeper absorption
let frontPanelDepthIn = 4;

if (typeof length === "number") {
  if (length < 16) frontPanelDepthIn = 6;
  if (length < 13) frontPanelDepthIn = 8;
}

// Convert to pixels
const frontPanelDepthPx =
  frontPanelDepthIn * (VISUAL_SCALE / 12);

// Front wall panel width (full wall)
const frontPanelWidth = visualRoomWidth;

// Front wall panel X
const frontPanelX = roomLeftX;

// Front wall panel Y (flush with wall, behind screen)
const frontPanelY = roomTopY;

// ---------- Stage 7.3 – Step 1 : First reflection point logic ----------

// Assume main listening position = center of first row
const listenerX =
  roomLeftX + visualRoomWidth / 2;

const listenerY =
  typeof firstRowY === "number" ? firstRowY : 0;

// Speaker horizontal offsets (approx ITU angles)
const speakerOffsetX =
  visualRoomWidth * 0.22;

// Left & Right speaker positions (front wall)
const leftSpeaker = {
  x: listenerX - speakerOffsetX,
  y: roomTopY,
};

const rightSpeaker = {
  x: listenerX + speakerOffsetX,
  y: roomTopY,
};

// LEFT WALL reflection (mirror method)
const leftWallReflection = {
  x: roomLeftX,
  y: (leftSpeaker.y + listenerY) / 2,
};

// RIGHT WALL reflection
const rightWallReflection = {
  x: roomRightX,
  y: (rightSpeaker.y + listenerY) / 2,
};

// ---------- Stage 7.3 – Step 2 : Front wall reflection logic ----------

// Front wall reflection Y (same as wall)
const frontWallY = roomTopY;

// Average X position between L & R speaker reflections
const frontWallReflection = {
  x: (leftSpeaker.x + rightSpeaker.x) / 2,
  y: frontWallY,
};

// ---------- Stage 7.3 – Step 3 : Ceiling reflection logic ----------

// Ceiling height in pixels
const ceilingY = roomTopY;

// Midpoint between screen and main listening position
const ceilingReflection = {
  x: visualRoomWidth / 2 + roomLeftX,
  y: (firstRowY + screenY) / 2,
};

// ---------- Stage 7.8 – Ceiling cloud position ----------

// Centered above first row (main listening position)
const ceilingCloudX =
  roomLeftX + visualRoomWidth / 2 - ceilingCloudWidthPx / 2;

// Place between screen and first row (first reflection zone)
const ceilingCloudY =
  roomTopY +
  (firstRowY - roomTopY) / 2 -
  ceilingCloudHeightPx / 2;

  // Ceiling cloud eligibility
const ceilingCloudEnabled =
  typeof height === "number" &&
  height >= 8 &&
  firstRowY > roomTopY + 60;

  // ---------- Stage 7.9 – Step 1 : Diffusion distance safety ----------

const minDiffusionDistanceFt = 6;

const rearDiffusionDistanceFt =
  typeof length === "number" && typeof viewingDistance === "number"
    ? length - viewingDistance
    : 0;

const rearDiffusionAllowed =
  rearDiffusionDistanceFt >= minDiffusionDistanceFt;

const ceilingDiffusionAllowed =
  firstRowY > roomTopY + visualRoomLength * 0.4 &&
  typeof height === "number" &&
  height >= 9;

// Apply ONLY if diffusion is allowed
if (rearDiffusionAllowed) {
  // Width: 60–80% of room width (cinema standard)
  rearDiffuserWidthFt =
    typeof width === "number" ? width * 0.7 : 0;

  // Height: seated ear zone coverage
  rearDiffuserHeightFt = 4;

  // Depth based on room length (low-frequency control)
  if (typeof length === "number" && length >= 24) {
    rearDiffuserDepthIn = 8;
  } else {
    rearDiffuserDepthIn = 6;
  }
}


  // ---------- Stage 8.9 : Acoustic risk score ----------

let acousticRiskScore = 0;

// Early reflections risk
if (showEarlyReflectionRisk && typeof width === "number" && width < 12) {
  acousticRiskScore += 1;
}

// Bass build-up risk
if (
  showBassBuildUpRisk &&
  typeof roomVolume === "number" &&
  roomVolume < 1800
) {
  acousticRiskScore += 2;
}

// Rear wall proximity risk
if (
  showRearWallRisk &&
  typeof rearDiffusionDistanceFt === "number" &&
  rearDiffusionDistanceFt < 6
) {
  acousticRiskScore += 2;
}

// ---------- Stage 9.1 : Acoustic risk score interpretation ----------

let acousticRiskLevel: "Low" | "Medium" | "High" = "Low";
let acousticRiskExplanation = "";

if (acousticRiskScore <= 2) {
  acousticRiskLevel = "Low";
  acousticRiskExplanation =
    "The room has favorable proportions and minimal acoustic risk. Standard treatment is sufficient.";
} else if (acousticRiskScore <= 5) {
  acousticRiskLevel = "Medium";
  acousticRiskExplanation =
    "The room has some acoustic challenges. Proper placement of absorbers and bass control is important.";
} else {
  acousticRiskLevel = "High";
  acousticRiskExplanation =
    "The room has significant acoustic risks. Professional-grade treatment and careful tuning are strongly recommended.";
}
// ---------- Stage 10.1 : Final room verdict ----------

let roomVerdict: "Recommended" | "Compromised" | "Not Recommended" =
  "Recommended";

let roomVerdictExplanation = "";

// HARD FAIL — physical impossibility
if (
  !ceilingMountFeasible ||
  horizontalLensShiftStatus === "Not Possible" ||
  !centerSpeakerFits ||
  row2ViewingStatus === "Blocked"
) {
  roomVerdict = "Not Recommended";
  roomVerdictExplanation =
    "Physical constraints prevent correct viewing geometry for one or more seating rows.";
}

// COMPROMISED — works but with limits
else if (
  feasibilityStatus === "Not Feasible" ||
  acousticRiskLevel === "High" ||
  horizontalLensShiftStatus === "Warning" ||
  finalVerticalComfort !== "Comfortable" ||
  row2ViewingStatus === "Compromised"
) {
  roomVerdict = "Compromised";
  roomVerdictExplanation =
    "The room functions as a home theater, but viewing comfort or geometry is near design limits.";
}

// CLEAN PASS
else {
  roomVerdict = "Recommended";
  roomVerdictExplanation =
    "All seating rows have clear sightlines, comfortable viewing angles, and cinema-correct geometry.";
}
// ---------- Stage 7.3 – Step 4 : Side wall reflection logic ----------

// Left wall X
const leftWallX = roomLeftX;

// Right wall X
const rightWallX = roomRightX;

// Midpoint between screen and listener (Y axis)
const sideReflectionY = (firstRowY + screenY) / 2;

// Side wall reflection points (RENAMED to avoid conflicts)
const sideWallReflectionLeft = {
  x: leftWallX,
  y: sideReflectionY,
};

const sideWallReflectionRight = {
  x: rightWallX,
  y: sideReflectionY,
};

// ---------- Stage 7.3 – Step 5 : Side wall treatment decision ----------

// Distance from main listening position to side wall reflection (ft)
const sideReflectionDistance =
  typeof viewingDistance === "number" ? viewingDistance : 0;

// Decide side wall treatment type
let sideWallTreatment:
  | "Absorber"
  | "Diffuser"
  | "Hybrid"
  | "" = "";

// Decision logic
if (sideReflectionDistance < 10) {
  sideWallTreatment = "Absorber";
} else if (sideReflectionDistance <= 14) {
  sideWallTreatment = "Hybrid";
} else {
  sideWallTreatment = "Diffuser";
}

// ---------- Stage 7.3 – Step 6 : Side wall treatment thickness ----------

let absorberThicknessIn = 0;
let diffuserDepthIn = 0;
let totalPanelDepthIn = 0;

if (sideWallTreatment === "Absorber") {
  absorberThicknessIn = 4;
  diffuserDepthIn = 0;
  totalPanelDepthIn = 4;
}

if (sideWallTreatment === "Diffuser") {
  absorberThicknessIn = 0;
  diffuserDepthIn =
    typeof length === "number" && length >= 24 ? 8 : 6;
  totalPanelDepthIn = diffuserDepthIn;
}

if (sideWallTreatment === "Hybrid") {
  absorberThicknessIn = 4;
  diffuserDepthIn = 3;
  totalPanelDepthIn = absorberThicknessIn + diffuserDepthIn;
}

// ---------- Stage 7.3 – Step 7 : Convert treatment depth to pixels ----------

// Visual depths (px)
const absorberThicknessPx =
  absorberThicknessIn * inchToPx;

const diffuserDepthPx =
  diffuserDepthIn * inchToPx;

const totalPanelDepthPx =
  totalPanelDepthIn * inchToPx;

  // ---------- Stage 7.3 – Step 8 : Side wall treatment eligibility ----------

// Minimum room width for meaningful side wall treatment (ft)
const minWidthForSideTreatment = 10;

// Check if room is wide enough
const sideWallsExist =
  typeof width === "number" && width >= minWidthForSideTreatment;

// Reflection point validity
const leftReflectionValid =
  sideWallsExist && leftWallX > roomLeftX + 10;

const rightReflectionValid =
  sideWallsExist && rightWallX < roomRightX - 10;

// Decide which side walls get treatment
const treatLeftWall = leftReflectionValid;
const treatRightWall = rightReflectionValid;

// Master flag (used later for drawing)
const sideWallTreatmentEnabled =
  treatLeftWall || treatRightWall;

  // ---------- Stage 7.3 – Step 9 : Side wall vertical placement ----------

// Seated ear height (feet)
const earHeightFt = 3.5;

// Panel vertical size (feet)
const sidePanelHeightFt = 4; // standard absorber/diffuser height

// Determine reference row for ear height
// Rule: use FIRST ROW as reference (cinema standard)
const referenceRowY =
  firstRowY > 0 ? firstRowY : 0;

// Convert ear height to visual Y (SVG space)
const earHeightY =
  roomTopY + earHeightFt * VISUAL_SCALE;

// Panel vertical placement (centered at ear height)
const sidePanelTopY =
  earHeightY - (sidePanelHeightFt * VISUAL_SCALE) / 2;

// Clamp panel inside room vertically
const sidePanelY =
  Math.max(
    roomTopY + 10,
    Math.min(
      sidePanelTopY,
      roomBottomY - sidePanelHeightFt * VISUAL_SCALE - 10
    )
  );

  // ---------- Stage 7.3 – Step 10 : Side wall horizontal placement ----------

// Distance from wall surface to panel face (feet)
const sidePanelOffsetFt = 0.25; // 3 inches air gap / mounting

// Panel depth (feet)
const sidePanelDepthFt = 0.5; // 2"–4" absorber/diffuser average

// Convert to visual scale
const sidePanelOffsetPx = sidePanelOffsetFt * VISUAL_SCALE;
const sidePanelDepthPx = sidePanelDepthFt * VISUAL_SCALE;

// Reference listening position (first row)
const sidePanelcenterY = firstRowY > 0 ? firstRowY : 0;

// LEFT wall panel X
const leftPanelX =
  roomLeftX + sidePanelOffsetPx;
  // Clamp safety (left wall)
const safeLeftPanelX = Math.max(
  roomLeftX + 4,
  leftPanelX
);

// RIGHT wall panel X
const rightPanelX =
  roomRightX - sidePanelDepthPx - sidePanelOffsetPx;

// Clamp safety (never escape walls)
const safeRightPanelX = Math.min(
  roomRightX - sidePanelDepthPx - 4,
  rightPanelX
);

// ---------- Stage 7.3 – Step 10.5 : Side panel height (pixels) ----------

const sidePanelHeightPx = sidePanelHeightFt * VISUAL_SCALE;

// ---------- Stage 7.4 : Rear wall acoustic treatment ----------

// Rear wall treatment decision
let rearWallTreatment: "Absorber" | "Diffuser" | "Hybrid" | "" = "";

// Rule:
// Short rooms → absorber
// Medium rooms → hybrid
// Long rooms → diffuser
if (typeof length === "number") {
  if (length < 16) {
    rearWallTreatment = "Absorber";
  } else if (length <= 22) {
    rearWallTreatment = "Hybrid";
  } else {
    rearWallTreatment = "Diffuser";
  }
}

// Rear wall panel depth (inches)
let rearPanelDepthIn = 0;

if (rearWallTreatment && rearWallTreatment === "Absorber") rearPanelDepthIn = 4;
if (rearWallTreatment && rearWallTreatment === "Hybrid") rearPanelDepthIn = 6;
if (rearWallTreatment && rearWallTreatment === "Diffuser") rearPanelDepthIn = 8;

// Convert to pixels
const rearPanelDepthPx = rearPanelDepthIn * inchToPx;

// Rear wall panel width (covers most of wall)
const rearPanelWidth =
  visualRoomWidth > 0 ? visualRoomWidth * 0.7 : 0;

// Rear wall X (centered)
const rearPanelX =
  roomLeftX + (visualRoomWidth - rearPanelWidth) / 2;

// Rear wall Y (inside room, not outside)
const rearPanelY =
  roomBottomY - rearPanelDepthPx;

  // ---------- Stage 7.5 : Ceiling acoustic treatment ----------

// Ceiling treatment eligibility
// Rule:
// - Required if Atmos exists OR room is reflective (long rooms)
// - Never diffuser on ceiling (cinema standard)

const ceilingTreatmentEnabled =
  heightSpeakerConfig !== "None" ||
  (typeof length === "number" && length > 18);

// Ceiling treatment type
let ceilingTreatment: "Absorber" | "" = "";

if (ceilingTreatmentEnabled) {
  ceilingTreatment = "Absorber";
}

// Ceiling panel depth (inches)
const ceilingPanelDepthIn = ceilingTreatment ? 4 : 0;

// Convert to pixels
const ceilingPanelDepthPx =
  ceilingPanelDepthIn * inchToPx;

// Ceiling panel width (covers reflection zone only)
const ceilingPanelWidth =
  visualRoomWidth > 0 ? visualRoomWidth * 0.6 : 0;

// Ceiling panel X (centered)
const ceilingPanelX =
  roomLeftX + (visualRoomWidth - ceilingPanelWidth) / 2;

// Ceiling panel Y
// Positioned between screen and first row (reflection zone)
const ceilingPanelY =
  (screenY + firstRowY) / 2 - ceilingPanelDepthPx / 2;

  // ============================================================
// Stage 8.1 : Acoustic balance scoring (LOGIC ONLY)
// ============================================================

// Base score
let acousticScore = 100;

// Warnings list
const acousticWarnings: string[] = [];

// ---------- Rear wall evaluation ----------
if (rearWallTreatment === "") {
  acousticScore -= 20;
  acousticWarnings.push("Rear wall has no acoustic treatment");
}

if (rearWallTreatment === "Absorber" && typeof length === "number" && length > 20) {
  acousticScore -= 10;
  acousticWarnings.push("Rear wall may be over-absorbed for a long room");
}

if (rearWallTreatment === "Diffuser" && !rearDiffusionAllowed) {
  acousticScore -= 15;
  acousticWarnings.push("Rear diffuser placed too close to seating");
}

// ---------- Side wall evaluation ----------
if (!sideWallTreatmentEnabled) {
  acousticScore -= 10;
  acousticWarnings.push("Side wall first reflection points untreated");
}

// ---------- Ceiling evaluation ----------
if (!ceilingCloudEnabled && ceilingTreatment === "") {
  acousticScore -= 10;
  acousticWarnings.push("Ceiling reflection zone untreated");
}

// ---------- Bass control evaluation ----------
if (bassTrapCoverage === "None") {
  acousticScore -= 20;
  acousticWarnings.push("No bass traps – low-frequency control will suffer");
}

if (bassTrapCoverage === "RearOnly") {
  acousticScore -= 8;
  acousticWarnings.push("Bass traps only on rear wall – front corners untreated");
}

// Clamp score safely
acousticScore = Math.max(0, Math.min(100, acousticScore));

// ============================================================
// PHASE 2A — Bass Trap Effective Size (PX)
// ============================================================

// Bass traps depend on the deepest adjacent wall treatment
const bassTrapEffectiveDepthIn = Math.max(
  frontWallDepthIn,
  backWallDepthIn,
  leftWallDepthIn,
  rightWallDepthIn,
  8 // minimum effective trap depth
);

const bassTrapSizepx = bassTrapEffectiveDepthIn * inchToPx;

// ============================================================
// Stage 8.2 : Acoustic grade classification
// ============================================================

let acousticGrade:
  | "Reference Grade"
  | "Very Good"
  | "Acceptable"
  | "Needs Improvement"
  | "Poor"
  | "" = "";

// International cinema-style grading
if (acousticScore >= 90) {
  acousticGrade = "Reference Grade";
} else if (acousticScore >= 80) {
  acousticGrade = "Very Good";
} else if (acousticScore >= 65) {
  acousticGrade = "Acceptable";
} else if (acousticScore >= 50) {
  acousticGrade = "Needs Improvement";
} else {
  acousticGrade = "Poor";
}

// ============================================================
// Stage 8.3 : Acoustic verdict explanation (human-readable)
// ============================================================

let acousticVerdictTitle = "";
let acousticVerdictExplanation = "";

// Reference-grade rooms
if (acousticGrade === "Reference Grade") {
  acousticVerdictTitle = "Reference-Level Acoustic Design";
  acousticVerdictExplanation =
    "This room meets professional cinema and studio acoustic standards. " +
    "Reflection control, bass management, diffusion depth, and speaker geometry " +
    "are all within optimal ranges. No corrective treatment is required.";
}

// Very good rooms
if (acousticGrade === "Very Good") {
  acousticVerdictTitle = "High-Performance Acoustic Room";
  acousticVerdictExplanation =
    "This room delivers excellent acoustic performance suitable for premium " +
    "home theaters. Minor refinements such as additional bass trapping or " +
    "fine-tuned diffusion may further enhance precision.";
}

// Acceptable rooms
if (acousticGrade === "Acceptable") {
  acousticVerdictTitle = "Acoustically Acceptable with Improvements";
  acousticVerdictExplanation =
    "The room meets basic acoustic requirements but has noticeable limitations. " +
    "Targeted treatment upgrades—especially at reflection points and low-frequency " +
    "control—are recommended for better clarity and balance.";
}

// Needs improvement
if (acousticGrade === "Needs Improvement") {
  acousticVerdictTitle = "Acoustic Treatment Required";
  acousticVerdictExplanation =
    "Acoustic issues such as early reflections, insufficient absorption, or " +
    "poor bass control are present. A revised acoustic strategy is necessary " +
    "to achieve a satisfactory listening experience.";
}

// Poor rooms
if (acousticGrade === "Poor") {
  acousticVerdictTitle = "Unsuitable Acoustic Conditions";
  acousticVerdictExplanation =
    "The room geometry and treatment are inadequate for home theater use. " +
    "Major redesign involving layout changes, treatment depth increases, and " +
    "speaker repositioning is strongly recommended.";
}

// ============================================================
// Stage 8.4 : Acoustic risk flags (professional warning system)
// ============================================================

type AcousticRisk =
  | "Early Reflections"
  | "Bass Build-up"
  | "Insufficient Diffusion"
  | "Low Ceiling Risk"
  | "Seat-to-Wall Proximity"
  | "None";

let acousticRisks: AcousticRisk[] = [];

// ---- Early reflection risk ----
if (sideWallTreatmentEnabled === false) {
  acousticRisks.push("Early Reflections");
}

// ---- Bass build-up risk ----
if (
  bassTrapCoverage !== "All" &&
  typeof roomVolume === "number" &&
  roomVolume < 2200
) {
  acousticRisks.push("Bass Build-up");
}

// ---- Diffusion distance risk ----
if (rearWallTreatment === "Diffuser" && !rearDiffusionAllowed) {
  acousticRisks.push("Insufficient Diffusion");
}

// ---- Ceiling height risk ----
if (typeof height === "number" && height < 8.5) {
  acousticRisks.push("Low Ceiling Risk");
}

// ---- Seating too close to walls ----
if (
  typeof viewingDistance === "number" &&
  typeof length === "number" &&
  length - viewingDistance < 3
) {
  acousticRisks.push("Seat-to-Wall Proximity");
}

// ---- No risks case ----
if (acousticRisks.length === 0) {
  acousticRisks.push("None");
}

// ============================================================
// Stage 8.5 : Acoustic improvement recommendations
// ============================================================

let acousticRecommendations: string[] = [];

// ---- Early reflections ----
if (acousticRisks.includes("Early Reflections")) {
  acousticRecommendations.push(
    "Add broadband absorbers or hybrid panels at first reflection points on side walls."
  );
}

// ---- Bass build-up ----
if (acousticRisks.includes("Bass Build-up")) {
  acousticRecommendations.push(
    "Increase low-frequency control using full-height corner bass traps or membrane traps."
  );
}

// ---- Diffusion distance ----
if (acousticRisks.includes("Insufficient Diffusion")) {
  acousticRecommendations.push(
    "Replace rear-wall diffusers with absorbers or increase listening distance to allow proper diffusion."
  );
}

// ---- Ceiling risk ----
if (acousticRisks.includes("Low Ceiling Risk")) {
  acousticRecommendations.push(
    "Use thinner ceiling absorbers and avoid deep diffusers to reduce comb filtering."
  );
}

// ---- Seat proximity ----
if (acousticRisks.includes("Seat-to-Wall Proximity")) {
  acousticRecommendations.push(
    "Add thick rear-wall absorption behind seating to control strong reflections."
  );
}

// ---- No risk case ----
if (
  acousticRisks.length === 1 &&
  acousticRisks[0] === "None"
) {
  acousticRecommendations.push(
    "Room acoustic conditions are well-balanced. Only fine-tuning is required."
  );
}

// ============================================================
// Stage 8.6 : Visual acoustic risk overlay logic
// ============================================================

// Overlay colors
const riskRed = "rgba(239, 68, 68, 0.25)";    // strong risk
const riskAmber = "rgba(245, 158, 11, 0.25)"; // caution

// Flags

// ============================================================
// PHASE 9.2 — PERFORMANCE & MEMORY STABILITY (RESERVED)
// (No runtime logic — verified stable)
// ============================================================

// ---------- Stage 9.3 : Actionable acoustic recommendations ----------
// LOW RISK
if (acousticRiskLevel === "Low") {
  acousticRecommendations.push(
    "Use broadband absorbers at first reflection points for clarity."
  );
  acousticRecommendations.push(
    "Basic bass trapping in rear corners is sufficient."
  );
  acousticRecommendations.push(
    "Optional ceiling cloud can improve dialogue focus."
  );
}

// MEDIUM RISK
if (acousticRiskLevel === "Medium") {
  acousticRecommendations.push(
    "Treat first reflection points on side walls with absorbers or hybrid panels."
  );
  acousticRecommendations.push(
    "Install bass traps in all rear corners to control low-frequency build-up."
  );
  acousticRecommendations.push(
    "Add a ceiling cloud above the main seating position."
  );

  if (rearWallTreatment === "Diffuser") {
    acousticRecommendations.push(
      "Rear wall diffusion is appropriate due to sufficient listening distance."
    );
  } else {
    acousticRecommendations.push(
      "Rear wall absorption is preferred due to limited listening distance."
    );
  }
}

// HIGH RISK
if (acousticRiskLevel === "High") {
  acousticRecommendations.push(
    "Full broadband absorption at all first reflection points is mandatory."
  );
  acousticRecommendations.push(
    "Use deep bass traps (6–8 inches) in all four vertical corners."
  );
  acousticRecommendations.push(
    "Install a full-size ceiling cloud covering the reflection zone."
  );
  acousticRecommendations.push(
    "Avoid diffusion near seating; prioritize absorption and controlled decay."
  );
}

// ---------- Stage 10.35 : Confidence Score (0–100) ----------

let confidenceScore = 100;

// --- Geometry penalties ---
if (roomVerdict === "Compromised") confidenceScore -= 20;
if (roomVerdict === "Not Recommended") confidenceScore -= 40;

// --- Acoustic risk penalties ---
if (acousticRiskLevel === "Medium") confidenceScore -= 10;
if (acousticRiskLevel === "High") confidenceScore -= 25;

// --- Seating penalties ---
if (seatingRecommendation === "2 Rows Recommended") confidenceScore -= 10;
if (seatingWarning) confidenceScore -= 5;

// --- Screen penalties ---
if (!screenPhysicallyFits) confidenceScore -= 15;

// --- Speaker penalties ---
if (!speakerAutoRecommended) confidenceScore -= 10;

// --- Subwoofer penalties ---
if (subwooferCount === 1 && roomVolume > 1800) confidenceScore -= 5;

// --- Clamp ---
confidenceScore = Math.max(0, Math.min(100, confidenceScore));

// ---------- Stage 10.3 : Upgrade Path Logic (Severity Weighted) ----------

type UpgradeStep = {
  label: string;
  severity: 1 | 2 | 3; // 3 = critical
};

const upgradeSteps: UpgradeStep[] = [];

if (roomVerdict !== "Recommended") {

  // --- CRITICAL (Severity 3) ---
  if (acousticRiskLevel === "High") {
    upgradeSteps.push({
      label:
        "Increase broadband absorption at side walls and ceiling reflection zones.",
      severity: 3,
    });
  }

  if (!screenPhysicallyFits) {
    upgradeSteps.push({
      label:
        "Reduce screen size to meet physical and ergonomic viewing limits.",
      severity: 3,
    });
  }

  // --- MODERATE (Severity 2) ---
  if (rearWallTreatment === "Absorber") {
    upgradeSteps.push({
      label:
        "Use thick rear wall absorption instead of diffusion to control reflections.",
      severity: 2,
    });
  }

  if (
    heightSpeakerConfig === "None" &&
    typeof height === "number" &&
    height >= 9
  ) {
    upgradeSteps.push({
      label:
        "Enable Dolby Atmos by adding ceiling or height speakers.",
      severity: 2,
    });
  }

  // --- OPTIONAL (Severity 1) ---
  if (
    subwooferCount === 1 &&
    typeof roomVolume === "number" &&
    roomVolume > 1800
  ) {
    upgradeSteps.push({
      label:
        "Add a second subwoofer to improve bass consistency.",
      severity: 1,
    });
  }
}

// ---------- Confidence-aware filtering ----------
const filteredUpgradeSteps =
  confidenceScore >= 85
    ? upgradeSteps.filter((s) => s.severity === 3)
    : confidenceScore >= 65
    ? upgradeSteps.filter((s) => s.severity >= 2)
    : upgradeSteps;

// ---------- Final ordered list ----------
const finalUpgradeSteps =
  filteredUpgradeSteps.length > 0
    ? filteredUpgradeSteps
        .sort((a, b) => b.severity - a.severity)
        .map((s) => s.label)
    : [
        "Room is close to optimal. Minor acoustic tuning and calibration recommended.",
      ];


// --- Human label (reuse existing vars) ---
if (confidenceScore >= 85) {
  confidenceLabel = "High";
  confidenceColor = "#22C55E";
} else if (confidenceScore >= 65) {
  confidenceLabel = "Medium";
  confidenceColor = "#FACC15";
} else {
  confidenceLabel = "Low";
  confidenceColor = "#EF4444";
}

// ---------- Stage 11.2 : Client next steps ----------
let nextSteps = "";

if (finalVerdict === "Recommended") {
  nextSteps =
    "Proceed with detailed acoustic design, equipment selection, and professional calibration.";
} else if (finalVerdict === "Compromised") {
  nextSteps =
    "Proceed carefully. Acoustic treatment, seating layout, and speaker placement will be critical.";
} else {
  nextSteps =
    "Consider room modifications or an alternative space before investing in a home theater.";
}

// ---------- STEP 4.3 : PDF Export Handler (SAFE SINGLE INSTANCE) ----------
const handleExportPDF = async () => {
  console.log("PDF EXPORT CLICKED");

  const element = document.getElementById("pdf-export-area");
  if (!element) return;

  const html2canvas = (await import("html2canvas")).default;
  const jsPDF = (await import("jspdf")).default;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#020617",
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  
  pdf.save("home-theater-design.pdf");
};

const isLegendItemActive = (layer: DrawingLayer) =>
  isLayerVisible(layer);

// =====================
// STEP 2 — SPEAKER LAYOUT AUTHORITY (REUSE EXISTING VARS)
// =====================

// NOTE:
// ceilingHeightFt already exists earlier — DO NOT redeclare
// speakerAutoRecommended already exists earlier — DO NOT redeclare

// ---- Parse selected speaker layout (string based) ----
const parsedSpeakerLayoutParts =
  typeof speakerLayoutChoice === "string" &&
  speakerLayoutChoice !== "Auto"
    ? speakerLayoutChoice.split(".")
    : null;

// Base layer speakers (5 / 7 / 9 etc.)
const selectedBaseSpeakerLayer =
  parsedSpeakerLayoutParts && parsedSpeakerLayoutParts[0]
    ? parsedSpeakerLayoutParts[0]
    : "5";

// Height layer speakers (0 / 2 / 4 / 6)
const selectedHeightSpeakerLayer =
  parsedSpeakerLayoutParts && parsedSpeakerLayoutParts[2]
    ? parsedSpeakerLayoutParts[2]
    : "0";

// ---- Ceiling eligibility rule (HARD) ----
const ceilingSpeakersAllowed = ceilingHeightFt >= 8;

// ---- Auto recommendation (deterministic, room-based) ---
const autoHeightSpeakerLayer =

  ceilingSpeakersAllowed &&
  typeof length === "number" &&
  length >= 18
    ? "4"
    : "2";

// ---- Final authoritative layers (USED LATER) ----
const finalBaseSpeakerLayer =
  speakerLayoutChoice === "Auto"
    ? autoBaseSpeakerLayer
    : selectedBaseSpeakerLayer;

const finalHeightSpeakerLayer =
  speakerLayoutChoice === "Auto"
    ? autoHeightSpeakerLayer
    : ceilingSpeakersAllowed
    ? selectedHeightSpeakerLayer
    : "0";

    // ---------- Shared input style for Room Dimensions ----------
const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "#0F172A",
  border: "1px solid #334155",
  borderRadius: "6px",
  padding: "8px",
  color: "white",
};

// ============================================================
// LEFT PANEL — CARD MOUNT ANIMATION (UI ONLY)
// ============================================================

const LP_CARD_ANIMATION_STYLE: React.CSSProperties = {
  animation: "lpFadeUp 200ms ease-out forwards",
};

const isPreferenceUnlocked =
  isSpeakerUnlocked && isScreenUnlocked;

// ============================================================
// PHASE 10 — MASTER AUTHORITY ENGINE (FINAL VERDICT)
// ============================================================

type MasterVerdict =
  | "Recommended"
  | "Compromised"
  | "Not Recommended";

let masterVerdict: MasterVerdict = "Recommended";

// ------------------------------------------------------------
// HARD FAILS
// ------------------------------------------------------------

if (
  projectorVerdict === "Not Feasible" ||
  row2ViewingStatus === "Blocked"
) {
  masterVerdict = "Not Recommended";
}

// ------------------------------------------------------------
// SOFT FAILS
// ------------------------------------------------------------

else if (
  projectorVerdict === "Compromised" ||
  row2ViewingStatus === "Compromised" ||
  screenRisk === "Critical"
) {
  masterVerdict = "Compromised";
}

// ------------------------------------------------------------
// CONFIDENCE LEVEL
// ------------------------------------------------------------

type MasterConfidence = "High" | "Moderate" | "Low";

let masterConfidence: MasterConfidence = "High";

if (masterVerdict === "Not Recommended") {
  masterConfidence = "Low";
} else if (masterVerdict === "Compromised") {
  masterConfidence = "Moderate";
} else {
  masterConfidence = "High";
}
  return (
    
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(180deg, #0B0E11, #111827)",
      color: "#E5E7EB",
      fontFamily: "Inter, system-ui, sans-serif"
    }}>

      <style jsx global>{`
  @keyframes lpFadeUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`}
</style>

      {/* Header */}
      <div style={{
        padding: "20px 32px",
        borderBottom: "1px solid #1F2937",
        fontSize: "20px",
        fontWeight: 600
      }}>
        Science of Sound — Home Theater Design Engine
      </div>

{/* Main grid */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "320px 1fr 360px",
    minHeight: "calc(100vh - 64px)",
    background: "#1F2937",
    gap: "16px",
    overflow: "hidden",
  }}
>

  

  {/* ================= LEFT PANEL ================= */}
  <div
    style={{
      background: "#0F172A",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "24px",
      overflowY: "auto",
      minWidth: 0,
      maxWidth: "100%",
      minHeight: 0,
    }}
  >
    <div>
      <h3 style={{ marginBottom: "4px" }}>Room Inputs</h3>
      <p style={{ fontSize: "13px", opacity: 0.6 }}>
        Define physical constraints of the room
      </p>
    </div>

    {/* Configuration Flow Visualization */}
    <div style={{
      background: "#020617",
      border: "1px dashed #334155",
      borderRadius: "8px",
      padding: "12px",
      fontSize: "11px",
      lineHeight: 1.8,
      color: "#94A3B8",
    }}>
      <div style={{ fontWeight: 600, marginBottom: "6px", color: "#E2E8F0" }}>
        Configuration Flow:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <div>1. Room Dimensions → Base space</div>
        <div>2. Acoustic Mode → Reduces usable volume</div>
        <div>3. Speaker Layout → Sets front obstruction</div>
        <div>4. Screen Size → Determines viewing distance</div>
        <div>5. Seating → Fills remaining depth</div>
      </div>
    </div>

{/* ============================================================ */}
{/* CARD 1 — ROOM DIMENSIONS */}
{/* ============================================================ */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  }}
>
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <strong>Room Dimensions</strong>
    {hasValidDimensions ? (
      <span style={{ fontSize: "11px", color: "#22C55E" }}>✓ Complete</span>
    ) : (
      <span style={{ fontSize: "11px", color: "#94A3B8" }}>⚬ Pending</span>
    )}
  </div>

  {/* ---------- LENGTH ---------- */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>Length</label>

    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
      {/* Feet */}
      <input
        type="number"
        placeholder="ft"
        min={0}
        value={typeof length === "number" ? Math.floor(length) : ""}
        onChange={(e) => {
          const ft = Number(e.target.value);
          const inches =
            typeof length === "number" ? (length % 1) * 12 : 0;
          setLength(Number.isNaN(ft) ? null : ft + inches / 12);
        }}
        style={{
          ...inputStyle,
          flex: 1,
          minWidth: 0,
        }}
      />

      {/* Inches */}
      <input
        type="number"
        placeholder="in"
        min={0}
        max={11}
        value={
          typeof length === "number"
            ? Math.round((length % 1) * 12)
            : ""
        }
        onChange={(e) => {
          const inches = Number(e.target.value);
          const ft =
            typeof length === "number" ? Math.floor(length) : 0;
          setLength(Number.isNaN(inches) ? null : ft + inches / 12);
        }}
        style={{
          ...inputStyle,
          width: "72px",
          flexShrink: 0,
        }}
      />
    </div>
  </div>

  {/* ---------- WIDTH ---------- */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>Width</label>

    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
      <input
        type="number"
        placeholder="ft"
        min={0}
        value={typeof width === "number" ? Math.floor(width) : ""}
        onChange={(e) => {
          const ft = Number(e.target.value);
          const inches =
            typeof width === "number" ? (width % 1) * 12 : 0;
          setWidth(Number.isNaN(ft) ? null : ft + inches / 12);
        }}
        style={{
          ...inputStyle,
          flex: 1,
          minWidth: 0,
        }}
      />

      <input
        type="number"
        placeholder="in"
        min={0}
        max={11}
        value={
          typeof width === "number"
            ? Math.round((width % 1) * 12)
            : ""
        }
        onChange={(e) => {
          const inches = Number(e.target.value);
          const ft =
            typeof width === "number" ? Math.floor(width) : 0;
          setWidth(Number.isNaN(inches) ? null : ft + inches / 12);
        }}
        style={{
          ...inputStyle,
          width: "72px",
          flexShrink: 0,
        }}
      />
    </div>
  </div>

  {/* ---------- CEILING HEIGHT ---------- */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>
      Ceiling Height
    </label>

    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
      <input
        type="number"
        placeholder="ft"
        min={0}
        value={typeof height === "number" ? Math.floor(height) : ""}
        onChange={(e) => {
          const ft = Number(e.target.value);
          const inches =
            typeof height === "number" ? (height % 1) * 12 : 0;
          setHeight(Number.isNaN(ft) ? null : ft + inches / 12);
        }}
        style={{
          ...inputStyle,
          flex: 1,
          minWidth: 0,
        }}
      />

      <input
        type="number"
        placeholder="in"
        min={0}
        max={11}
        value={
          typeof height === "number"
            ? Math.round((height % 1) * 12)
            : ""
        }
        onChange={(e) => {
          const inches = Number(e.target.value);
          const ft =
            typeof height === "number" ? Math.floor(height) : 0;
          setHeight(Number.isNaN(inches) ? null : ft + inches / 12);
        }}
        style={{
          ...inputStyle,
          width: "72px",
          flexShrink: 0,
        }}
      />
    </div>
  </div>
</div>
{/* ============================================================ */}
{/* CARD 2 — Acoustic Mode */}
{/* ============================================================ */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  }}
>
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <strong>Acoustic Mode</strong>
    {!isAcousticUnlocked ? (
      <span style={{ fontSize: "11px", color: "#94A3B8" }}>🔒 Locked</span>
    ) : effectiveAcousticMode ? (
      <span style={{ fontSize: "11px", color: "#22C55E" }}>✓ {effectiveAcousticMode}</span>
    ) : (
      <span style={{ fontSize: "11px", color: "#FACC15" }}>⚠ Select mode</span>
    )}
  </div>

  {/* Auto Recommendation */}
  {recommendedAcousticMode && (
    <div
      style={{
        fontSize: "12px",
        color: "#22C55E",
        background: "#052E1A",
        padding: "8px",
        borderRadius: "6px",
        border: "1px solid #14532D",
      }}
    >
      Recommended:&nbsp;
      <strong>{recommendedAcousticMode}</strong>
      <span style={{ color: "#94A3B8" }}>
        {" "}
        (based on room volume)
      </span>
    </div>
  )}

  {/* Acoustic Mode Selector */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>
      Acoustic Treatment Level
    </label>

    <select
      value={effectiveAcousticMode ?? ""}
      onChange={(e) =>
        setAcousticMode(
          e.target.value as "Basic" | "Medium" | "High"
        )
      }
      disabled={!isAcousticUnlocked}
      style={{
        width: "100%",
        background: isAcousticUnlocked ? "#0F172A" : "#020617",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "8px",
        color: "white",
        marginTop: "4px",
        opacity: isAcousticUnlocked ? 1 : 0.5,
      }}
    >
      <option value="">Select mode</option>
      <option value="Basic">
        Basic — Entry level control
      </option>
      <option value="Medium">
        Medium — Reference home theater
      </option>
      <option value="High">
        High — Studio / Cinema grade
      </option>
    </select>
  </div>

  {/* Design Intent */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>
      Design Intent
    </label>

    <select
      value={designIntent}
      onChange={(e) =>
        setDesignIntent(
          e.target.value as
            | "Performance"
            | "Balanced"
            | "Luxury"
        )
      }
      disabled={!isAcousticUnlocked}
      style={{
        width: "100%",
        background: isAcousticUnlocked ? "#0F172A" : "#020617",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "8px",
        color: "white",
        marginTop: "4px",
        opacity: isAcousticUnlocked ? 1 : 0.5,
      }}
    >
      <option value="Performance">
        Performance — Accuracy & control
      </option>
      <option value="Balanced">
        Balanced — Performance + aesthetics
      </option>
      <option value="Luxury">
        Luxury — Visual & experiential focus
      </option>
    </select>
  </div>

 {/* ============================================================ */}
{/* Acoustic Treatment Depth — Per Surface */}
{/* ============================================================ */}
<div>
  <label style={{ fontSize: "12px", opacity: 0.6 }}>
    Acoustic Treatment Depth (inches)
  </label>

  {/* Quick Presets */}
  <div style={{ marginTop: "8px", marginBottom: "12px" }}>
    <div style={{ fontSize: "11px", opacity: 0.6, marginBottom: "6px" }}>
      Quick Presets:
    </div>
    <div style={{ display: "flex", gap: "6px" }}>
      <button
        onClick={() => {
          if (!isAcousticUnlocked) return;
          setFrontWallDepthIn(4);
          setBackWallDepthIn(4);
          setLeftWallDepthIn(4);
          setRightWallDepthIn(4);
        }}
        disabled={!isAcousticUnlocked}
        style={{
          flex: 1,
          padding: "6px 10px",
          fontSize: "11px",
          background: "#0F172A",
          border: "1px solid #334155",
          borderRadius: "6px",
          color: "white",
          cursor: isAcousticUnlocked ? "pointer" : "not-allowed",
          opacity: isAcousticUnlocked ? 1 : 0.5,
        }}
      >
        Light (4″)
      </button>
      <button
        onClick={() => {
          if (!isAcousticUnlocked) return;
          setFrontWallDepthIn(8);
          setBackWallDepthIn(8);
          setLeftWallDepthIn(8);
          setRightWallDepthIn(8);
        }}
        disabled={!isAcousticUnlocked}
        style={{
          flex: 1,
          padding: "6px 10px",
          fontSize: "11px",
          background: "#0F172A",
          border: "1px solid #334155",
          borderRadius: "6px",
          color: "white",
          cursor: isAcousticUnlocked ? "pointer" : "not-allowed",
          opacity: isAcousticUnlocked ? 1 : 0.5,
        }}
      >
        Medium (8″)
      </button>
      <button
        onClick={() => {
          if (!isAcousticUnlocked) return;
          setFrontWallDepthIn(12);
          setBackWallDepthIn(12);
          setLeftWallDepthIn(12);
          setRightWallDepthIn(12);
        }}
        disabled={!isAcousticUnlocked}
        style={{
          flex: 1,
          padding: "6px 10px",
          fontSize: "11px",
          background: "#0F172A",
          border: "1px solid #334155",
          borderRadius: "6px",
          color: "white",
          cursor: isAcousticUnlocked ? "pointer" : "not-allowed",
          opacity: isAcousticUnlocked ? 1 : 0.5,
        }}
      >
        Heavy (12″)
      </button>
    </div>
  </div>

  {/* ---------- FRONT WALL ---------- */}
  <div style={{ marginTop: "8px" }}>
    <label style={{ fontSize: "11px", opacity: 0.55 }}>
      Front Wall (behind screen)
    </label>
    <input
      type="number"
      min={4}
      max={16}
      step={1}
      value={frontWallDepthIn}
      onChange={(e) => setFrontWallDepthIn(Number(e.target.value))}
      disabled={!isAcousticUnlocked}
      style={{
        width: "100%",
        background: isAcousticUnlocked ? "#0F172A" : "#020617",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "6px",
        color: "white",
        marginTop: "4px",
        opacity: isAcousticUnlocked ? 1 : 0.5,
      }}
    />
  </div>

  {/* ---------- REAR WALL ---------- */}
  <div style={{ marginTop: "8px" }}>
    <label style={{ fontSize: "11px", opacity: 0.55 }}>
      Rear Wall
    </label>
    <input
      type="number"
      min={4}
      max={16}
      step={1}
      value={backWallDepthIn}
      onChange={(e) => setBackWallDepthIn(Number(e.target.value))}
      disabled={!isAcousticUnlocked}
      style={{
        width: "100%",
        background: isAcousticUnlocked ? "#0F172A" : "#020617",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "6px",
        color: "white",
        marginTop: "4px",
        opacity: isAcousticUnlocked ? 1 : 0.5,
      }}
    />
  </div>

  {/* ---------- LEFT WALL ---------- */}
  <div style={{ marginTop: "8px" }}>
    <label style={{ fontSize: "11px", opacity: 0.55 }}>
      Left Wall
    </label>
    <input
      type="number"
      min={4}
      max={16}
      step={1}
      value={leftWallDepthIn}
      onChange={(e) => setLeftWallDepthIn(Number(e.target.value))}
      disabled={!isAcousticUnlocked}
      style={{
        width: "100%",
        background: isAcousticUnlocked ? "#0F172A" : "#020617",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "6px",
        color: "white",
        marginTop: "4px",
        opacity: isAcousticUnlocked ? 1 : 0.5,
      }}
    />
  </div>

  {/* ---------- RIGHT WALL ---------- */}
  <div style={{ marginTop: "8px" }}>
    <label style={{ fontSize: "11px", opacity: 0.55 }}>
      Right Wall
    </label>
    <input
      type="number"
      min={4}
      max={16}
      step={1}
      value={rightWallDepthIn}
      onChange={(e) => setRightWallDepthIn(Number(e.target.value))}
      disabled={!isAcousticUnlocked}
      style={{
        width: "100%",
        background: isAcousticUnlocked ? "#0F172A" : "#020617",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "6px",
        color: "white",
        marginTop: "4px",
        opacity: isAcousticUnlocked ? 1 : 0.5,
      }}
    />
  </div>

  {/* ---------- CEILING (FIXED) ---------- */}
  <div style={{ marginTop: "10px" }}>
    <label style={{ fontSize: "11px", opacity: 0.55 }}>
      Ceiling (fixed service zone)
    </label>
    <input
      type="number"
      value={12}
      disabled
      style={{
        width: "100%",
        background: "#020617",
        border: "1px dashed #334155",
        borderRadius: "6px",
        padding: "6px",
        color: "#94A3B8",
        marginTop: "4px",
        opacity: 0.6,
      }}
    />
    <div style={{ fontSize: "10px", color: "#64748B", marginTop: "4px" }}>
      Reserved for AC ducts, fresh air, electrical & lighting
    </div>
  </div>
</div>

  {/* Explanation */}
  <div
    style={{
      fontSize: "11px",
      color: "#94A3B8",
      lineHeight: 1.5,
    }}
  >
    {effectiveAcousticMode === "Basic" && (
      <>
        Controls basic reflections and flutter echo.
        Suitable for casual viewing rooms.
      </>
    )}
    {effectiveAcousticMode === "Medium" && (
      <>
        Balanced absorption and diffusion for accurate
        imaging and dialogue clarity.
      </>
    )}
    {effectiveAcousticMode === "High" && (
      <>
        Advanced treatment targeting reference decay,
        bass control, and immersive precision.
      </>
    )}
  </div>
</div>

{/* ============================================================ */}
{/* CARD 3 — Speaker Layout */}
{/* ============================================================ */}
{isSpeakerUnlocked ? (
  <div
    style={{
      background: "#020617",
      border: "1px solid #1F2937",
      borderRadius: "8px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      ...LP_CARD_ANIMATION_STYLE,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <strong>Speaker Layout</strong>
      {!isSpeakerUnlocked ? (
        <span style={{ fontSize: "11px", color: "#94A3B8" }}>🔒 Locked</span>
      ) : speakerLayoutChoice ? (
        <span style={{ fontSize: "11px", color: "#22C55E" }}>✓ {speakerLayoutLabel}</span>
      ) : (
        <span style={{ fontSize: "11px", color: "#FACC15" }}>⚠ Select layout</span>
      )}
    </div>

    <p style={{ fontSize: "12px", opacity: 0.6 }}>
      Dolby / DTS / Auro-3D / Extreme configurations
    </p>

    <select
      value={speakerLayoutChoice}
      onChange={(e) => setSpeakerLayoutChoice(e.target.value)}
      disabled={!hasValidDimensions}
      style={{
        width: "100%",
        background: "#0F172A",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "8px",
        color: "white",
        opacity: hasValidDimensions ? 1 : 0.5,
      }}
    >
      <option value="Auto">Auto (Cinema Recommended)</option>

      <optgroup label="Dolby / DTS Standard">
        <option value="2.1">2.1</option>
        <option value="3.1">3.1</option>
        <option value="5.1">5.1</option>
        <option value="7.1">7.1</option>

        <option value="5.1.2" disabled={!ceilingHeightAllowsHeightSpeakers}>
          5.1.2 {!ceilingHeightAllowsHeightSpeakers ? "— Ceiling height too low" : ""}
        </option>
        <option value="5.1.4" disabled={!ceilingHeightAllowsHeightSpeakers}>
          5.1.4 {!ceilingHeightAllowsHeightSpeakers ? "— Ceiling height too low" : ""}
        </option>
        <option value="7.1.2" disabled={!ceilingHeightAllowsHeightSpeakers}>
          7.1.2 {!ceilingHeightAllowsHeightSpeakers ? "— Ceiling height too low" : ""}
        </option>
        <option value="7.1.4" disabled={!ceilingHeightAllowsHeightSpeakers}>
          7.1.4 {!ceilingHeightAllowsHeightSpeakers ? "— Ceiling height too low" : ""}
        </option>
        <option value="7.1.6" disabled={!ceilingHeightAllowsHeightSpeakers}>
          7.1.6 {!ceilingHeightAllowsHeightSpeakers ? "— Ceiling height too low" : ""}
        </option>

        <option value="9.1" disabled={Number(finalBaseSpeakerLayer) < 7}>
          9.1 {Number(finalBaseSpeakerLayer) < 7 ? "— Large room required" : ""}
        </option>
        <option
          value="9.1.4"
          disabled={ceilingHeightFt < 9 || Number(finalBaseSpeakerLayer) < 7}
        >
          9.1.4
          {ceilingHeightFt < 9 || Number(finalBaseSpeakerLayer) < 7
            ? " — Large room & high ceiling required"
            : ""}
        </option>
        <option
          value="9.1.6"
          disabled={ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 7}
        >
          9.1.6
          {ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 7
            ? " — Very high ceiling required"
            : ""}
        </option>
      </optgroup>

      <optgroup label="Auro-3D (Height + VoG)">
        <option value="Auro-9.1" disabled={ceilingHeightFt < 9}>
          Auro-3D 9.1 {ceilingHeightFt < 9 ? "— Requires ≥ 9 ft ceiling" : ""}
        </option>
        <option
          value="Auro-10.1"
          disabled={ceilingHeightFt < 9 || Number(finalBaseSpeakerLayer) < 7}
        >
          Auro-3D 10.1 (Voice of God)
          {ceilingHeightFt < 9 || Number(finalBaseSpeakerLayer) < 7
            ? " — Large room & high ceiling required"
            : ""}
        </option>
        <option
          value="Auro-13.1"
          disabled={ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 9}
        >
          Auro-3D 13.1 (Reference)
          {ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 9
            ? " — Reference cinema requirements"
            : ""}
        </option>
      </optgroup>

      <optgroup label="Extreme / Custom">
        <option
          value="11.1.4"
          disabled={ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 9}
        >
          11.1.4
          {ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 9
            ? " — Not suitable for this room"
            : ""}
        </option>
        <option
          value="11.2.4"
          disabled={ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 9}
        >
          11.2.4
          {ceilingHeightFt < 10 || Number(finalBaseSpeakerLayer) < 9
            ? " — Not suitable for this room"
            : ""}
        </option>
        <option value="22.2" disabled={ceilingHeightFt < 12}>
          22.2 (NHK / Experimental)
          {ceilingHeightFt < 12 ? " — Experimental / research-grade only" : ""}
        </option>
      </optgroup>
    </select>

    {/* ---------- AUTO RECOMMENDATION DISPLAY ---------- */}
    {speakerLayoutChoice === "Auto" && hasValidDimensions && (
      <div
        style={{
          marginTop: "10px",
          padding: "10px",
          borderRadius: "6px",
          background: "#020617",
          border: "1px dashed #334155",
          fontSize: "12px",
        }}
      >
        <div style={{ fontWeight: 600, color: "#22C55E" }}>
          Auto-Recommended System Layout
        </div>

        <div style={{ marginTop: "4px" }}>{speakerLayoutLabel}</div>

        <div
          style={{
            marginTop: "6px",
            fontSize: "11px",
            opacity: 0.75,
            lineHeight: 1.5,
          }}
        >
          This layout is selected based on room dimensions, seating distance,
          ceiling height, and immersive audio best practices.
        </div>
      </div>
    )}

    <p style={{ fontSize: "11px", opacity: 0.55 }}>
      Manual selections outside recommended limits will trigger warnings in the
      summary.
    </p>

    {/* ============================================================
       SPEAKER MOUNTING & PLACEMENT
       ============================================================ */}

    <div style={{ marginTop: "14px" }}>
      <strong style={{ fontSize: "13px" }}>
        Speaker Mounting
      </strong>

      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
        <button
          onClick={() => setSpeakerMountType("InWall")}
          disabled={!hasValidDimensions}
          style={{
            flex: 1,
            padding: "8px",
            background:
              speakerMountType === "InWall"
                ? "#1E40AF"
                : "#020617",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "white",
            cursor: hasValidDimensions ? "pointer" : "not-allowed",
            opacity: hasValidDimensions ? 1 : 0.5,
          }}
        >
          In-Wall
        </button>

        <button
          onClick={() => setSpeakerMountType("OnWall")}
          disabled={!hasValidDimensions}
          style={{
            flex: 1,
            padding: "8px",
            background:
              speakerMountType === "OnWall"
                ? "#1E40AF"
                : "#020617",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "white",
            cursor: hasValidDimensions ? "pointer" : "not-allowed",
            opacity: hasValidDimensions ? 1 : 0.5,
          }}
        >
          On-Wall
        </button>
      </div>

      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>
        {speakerMountExplanation}
      </p>
    </div>

    {/* ---------- Placement Mode ---------- */}
    <div style={{ marginTop: "12px" }}>
      <strong style={{ fontSize: "13px" }}>
        Speaker Placement
      </strong>

      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
        <button
          disabled={!behindScreenAllowed || !hasValidDimensions}
          onClick={() => setSpeakerPlacementMode("BehindScreen")}
          style={{
            flex: 1,
            padding: "8px",
            background:
              speakerPlacementMode === "BehindScreen"
                ? "#1E40AF"
                : "#020617",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: (behindScreenAllowed && hasValidDimensions) ? "white" : "#64748B",
            opacity: (behindScreenAllowed && hasValidDimensions) ? 1 : 0.4,
            cursor: (behindScreenAllowed && hasValidDimensions) ? "pointer" : "not-allowed",
          }}
        >
          Behind Screen
        </button>

        <button
          onClick={() => setSpeakerPlacementMode("BesideScreen")}
          disabled={!hasValidDimensions}
          style={{
            flex: 1,
            padding: "8px",
            background:
              speakerPlacementMode === "BesideScreen"
                ? "#1E40AF"
                : "#020617",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "white",
            cursor: hasValidDimensions ? "pointer" : "not-allowed",
            opacity: hasValidDimensions ? 1 : 0.5,
          }}
        >
          Beside Screen
        </button>
      </div>

      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>
        {speakerPlacementExplanation}
      </p>
    </div>
  </div>
) : (
  <LockedCardShell title="Speaker Layout" />
)}

{/* ============================================================ */}
{/* CARD 4 — Screen Preferences */}
{/* ============================================================ */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    ...(isScreenUnlocked ? LP_CARD_ANIMATION_STYLE : LP_LOCKED_STYLE),
  }}
>

{screenBlockedByFrontObstruction && (
  <p style={{ fontSize: "11px", color: "#FCA5A5", marginTop: "6px" }}>
    Screen size or seating distance is limited by front wall speaker depth.
    Consider reducing screen size or changing speaker placement.
  </p>
)}

  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <strong>Screen Preferences</strong>
    {!isScreenUnlocked ? (
      <span style={{ fontSize: "11px", color: "#94A3B8" }}>🔒 Locked</span>
    ) : typeof finalScreenDiagonalIn === "number" ? (
      <span style={{ fontSize: "11px", color: "#22C55E" }}>✓ {Math.round(finalScreenDiagonalIn)}″</span>
    ) : (
      <span style={{ fontSize: "11px", color: "#FACC15" }}>⚠ Select size</span>
    )}
  </div>

  {hasValidDimensions && (
    <p style={{ fontSize: "12px", opacity: 0.7 }}>
      Aspect Ratio: {selectedAspectRatio}
    </p>
  )}

  {hasValidDimensions && autoRecommendedScreenIn && (
    <p style={{ fontSize: "11px", color: "#22C55E" }}>
      Recommended by SMPTE / THX viewing angle standards
    </p>
  )}

  {hasValidDimensions &&
    typeof finalScreenDiagonalIn === "number" &&
    autoRecommendedScreenIn &&
    Math.round(finalScreenDiagonalIn) !== autoRecommendedScreenIn && (
      <p
        style={{
          fontSize: "11px",
          color: "#FACC15",
          marginTop: "4px",
        }}
      >
        Selected screen deviates from optimal viewing comfort
      </p>
    )}

  {/* Viewing Standard */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>
      Viewing Standard
    </label>
    <select
      value={viewingAngle}
      onChange={(e) => {
        if (!isScreenUnlocked) return;
        setViewingAngle(e.target.value as "smpte" | "thx" | "max");
      }}
      style={{
        width: "100%",
        background: "#0F172A",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "8px",
        color: "white",
        marginTop: "4px",
      }}
    >
      <option value="smpte">SMPTE (30° - Conservative)</option>
      <option value="thx">THX (40° - Reference)</option>
      <option value="max">Max Immersion (50°+ - Intense)</option>
    </select>
    <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
      {viewingAngle === "smpte" && "Industry standard for comfortable long viewing sessions"}
      {viewingAngle === "thx" && "Reference cinema standard, balance of immersion and comfort"}
      {viewingAngle === "max" && "Maximum immersion, best for dedicated cinema rooms"}
    </p>
  </div>

  {/* Aspect Ratio */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>
      Aspect Ratio
    </label>
    <select
      value={selectedAspectRatio}
      onChange={(e) => {
        if (!isScreenUnlocked) return;
        setSelectedAspectRatio(
          e.target.value as "16:9" | "2.35:1" | "4:3"
        );
      }}
      style={{
        width: "100%",
        background: "#0F172A",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "8px",
        color: "white",
        marginTop: "4px",
      }}
    >
      <option value="16:9">16:9 (Standard)</option>
      <option value="2.35:1">2.35:1 (CinemaScope)</option>
      <option value="4:3">4:3 (Classic / IMAX)</option>
    </select>
  </div>

  {/* Screen Size Selection */}
  <div>
    <label style={{ fontSize: "12px", opacity: 0.6 }}>
      Screen Size (Diagonal)
    </label>

    <select
      onChange={(e) => {
        if (!isScreenUnlocked) return;
        setSelectedScreenSize(Number(e.target.value));
      }}
      value={
        typeof selectedScreenSize === "number"
          ? selectedScreenSize
          : ""
      }
      style={{
        width: "100%",
        background: "#0F172A",
        border: "1px solid #334155",
        borderRadius: "6px",
        padding: "8px",
        color: "white",
        marginTop: "4px",
      }}
    >
      {STANDARD_SCREEN_SIZES.map((size) => {
        const allowed = isScreenSizeAllowed(size);
        return (
          <option
            key={size}
            value={size}
            disabled={!allowed}
            title={
              allowed
                ? "Fits room geometry"
                : "Exceeds room / viewing limits"
            }
          >
            {size}″ {!allowed ? "— Not Suitable" : ""}
          </option>
        );
      })}
    </select>
  </div>

  {/* Auto Recommendation */}
  {autoRecommendedScreenIn && (
    <div
      style={{
        marginTop: "6px",
        fontSize: "11px",
        color: "#22C55E",
        lineHeight: 1.4,
      }}
    >
      Auto Recommended:{" "}
      <strong>{autoRecommendedScreenIn}″</strong>
      <br />
      Standard: SMPTE / THX compliant
    </div>
  )}

  {/* Rule note */}
  {typeof finalScreenDiagonalIn === "number" &&
    autoRecommendedScreenIn &&
    autoRecommendedScreenIn !==
      Math.round(finalScreenDiagonalIn) && (
      <div
        style={{
          fontSize: "11px",
          color: "#FACC15",
          marginTop: "4px",
        }}
      >
        Larger sizes may reduce comfort or violate cinema standards
      </div>
    )}
</div>

{/* ============================================================ */}
{/* CARD 5 — Seating & Rows */}
{/* ============================================================ */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    ...(isSeatingUnlocked ? LP_CARD_ANIMATION_STYLE : LP_LOCKED_STYLE),
  }}
>
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <strong>Seating & Rows</strong>
    {!isSeatingUnlocked ? (
      <span style={{ fontSize: "11px", color: "#94A3B8" }}>🔒 Locked</span>
    ) : rowCount > 0 ? (
      <span style={{ fontSize: "11px", color: "#22C55E" }}>✓ {rowCount} row{rowCount > 1 ? "s" : ""}</span>
    ) : (
      <span style={{ fontSize: "11px", color: "#FACC15" }}>⚠ Configure</span>
    )}
  </div>

  {/* ---------- Derived limits ---------- */}
  {(() => {
    const usableLengthFt =
      typeof usableRoomLengthFt === "number"
        ? usableRoomLengthFt
        : 0;

    // Front and rear clearance (1 ft each = 2 ft total)
    const CLEARANCE_FT = 2;
    
    // Seat depth = 70" = 5.83 ft
    const availableLengthForSeating = usableLengthFt - CLEARANCE_FT;
    
    // Maximum rows that can physically fit
    const MAX_ROWS_BY_LENGTH = Math.floor(availableLengthForSeating / seatDepthFt);

    const maxRows = Math.max(1, Math.min(6, MAX_ROWS_BY_LENGTH));
    const minRiserIn = rowCount > 1 ? 6 : 0;
    const maxRiserIn = rowCount > 1 ? 14 : 0;

    return (
      <>
        {/* ---------- ROW COUNT ---------- */}
        <div>
          <label style={{ fontSize: "12px", opacity: 0.6 }}>
            Number of Rows
          </label>

          {/* Auto-Suggestion */}
          {(() => {
            // Calculate recommended rows based on viewing distance and available depth
            const recommendedRows = typeof viewingDistance === "number" && usableLengthFt > 0
              ? Math.min(maxRows, Math.max(1, Math.floor((usableLengthFt - viewingDistance - 2) / seatDepthFt)))
              : 1;
            
            return recommendedRows > 0 && recommendedRows <= maxRows ? (
              <div style={{
                fontSize: "11px",
                color: "#22C55E",
                background: "#052E1A",
                padding: "6px 8px",
                borderRadius: "4px",
                marginTop: "4px",
                border: "1px solid #14532D",
              }}>
                💡 Recommended: {recommendedRows} row{recommendedRows > 1 ? "s" : ""}
                <span style={{ color: "#94A3B8", marginLeft: "4px" }}>
                  (Based on optimal viewing distance)
                </span>
              </div>
            ) : null;
          })()}

          <select
            value={rowCount}
            onChange={(e) => {
              if (!isSeatingUnlocked) return;
              setRowCount(Number(e.target.value));
            }}
            style={{
              width: "100%",
              background: "#0F172A",
              border: "1px solid #334155",
              borderRadius: "6px",
              padding: "8px",
              color: "white",
              marginTop: "4px",
            }}
          >
            {Array.from({ length: maxRows }).map((_, i) => {
              const rows = i + 1;
              return (
                <option key={rows} value={rows}>
                  {rows} Row{rows > 1 ? "s" : ""}
                </option>
              );
            })}
          </select>
        </div>

{/* ---------- SEATS PER ROW ---------- */}
<div>
  <label style={{ fontSize: "12px", opacity: 0.6 }}>
    Seats per Row
  </label>

  {(() => {
    // Seat width = 36" = 3 ft
    const SEAT_WIDTH_FT = 3;

    // Mandatory 1" clearance each side = 2" total
    const SIDE_CLEARANCE_FT = 2 / 12;

    // usableRoom.width is in pixels, convert to feet
    const usableWidthPx = usableRoom.width;
    const usableWidthFt = usableWidthPx / VISUAL_SCALE;

    const maxSeats =
      Math.floor(
        (usableWidthFt - SIDE_CLEARANCE_FT) / SEAT_WIDTH_FT
      ) || 1;

    const safeMax = Math.max(1, Math.min(8, maxSeats));

    return (
      <select
        value={seatsPerRow}
        onChange={(e) =>
          setSeatsPerRow(Number(e.target.value))
        }
        style={{
          width: "100%",
          background: "#0F172A",
          border: "1px solid #334155",
          borderRadius: "6px",
          padding: "8px",
          color: "white",
          marginTop: "4px",
        }}
      >
        {Array.from({ length: safeMax }).map((_, i) => {
          const seats = i + 1;
          return (
            <option key={seats} value={seats}>
              {seats} Seat{seats > 1 ? "s" : ""}
            </option>
          );
        })}
      </select>
    );
  })()}
</div>

{/* ---------- RISER HEIGHT ---------- */}
<div>
  <label style={{ fontSize: "12px", opacity: 0.6 }}>
    Riser Height (inches)
  </label>

  <input
    type="number"
    min={5}
    max={12}
    step={1}
    value={selectedRiserHeightIn}
    onChange={(e) => {
      if (!isSeatingUnlocked) return;

      const value = Number(e.target.value);

      if (Number.isNaN(value)) {
        setSelectedRiserHeightIn(5);
        return;
      }

      // clamp strictly between 5 and 12
      const clamped = Math.max(5, Math.min(12, Math.round(value)));

      setSelectedRiserHeightIn(clamped);
    }}
    style={{
      width: "100%",
      background: "#0F172A",
      border: "1px solid #334155",
      borderRadius: "6px",
      padding: "8px",
      color: "white",
      marginTop: "4px",
    }}
  />
</div>

{/* ---------- INFO ---------- */}   
     <div
        style={{
         fontSize: "11px",
         color: "#94A3B8",
         lineHeight: 1.4,
          }}
        >
          Seating is calculated from the rear wall forward,
          maintaining minimum screen distance and sightline
          safety. Rear rows do not include center aisle spacing.
        </div>
      </>
    );
  })()}
</div>

{/* ============================================================ */}

  {/* ================= END LEFT PANEL ================= */}

</div>

  {/* ================= CENTER PANEL ================= */}
  <div id="pdf-export-area"
    style={{
      background: "#020617",
      padding: "24px",
      borderLeft: "1px solid #1F2937",
      borderRight: "1px solid #1F2937",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      minWidth: 0,
      maxWidth: "100%",
      minHeight: 0,
      overflow: "auto",
    }}
  >

    <div>
      <strong>Room Layout Preview</strong>
      <p style={{ fontSize: "12px", opacity: 0.6 }}>
        Visualization updates dynamically based on inputs
      </p>
    </div>

   {/* ================= CENTER VIEW MODE CONTROLS ================= */}
<div
  style={{
    display: "flex",
    gap: "8px",
    marginBottom: "8px",
    flexWrap: "wrap",
  }}
>
  {[
    "speakers",
    "projector",
    "acoustic",
    "seating",
    "combined",
  ].map((mode) => (
    <button
      key={mode}
      onClick={() => setCenterViewMode(mode as CenterViewMode)}
      style={{
        padding: "6px 10px",
        fontSize: "12px",
        borderRadius: "6px",
        border: "1px solid #334155",
        background:
          centerViewMode === mode ? "#22C55E" : "#020617",
        color:
          centerViewMode === mode ? "#022c22" : "#94A3B8",
        cursor: "pointer",
      }}
    >
      {mode.toUpperCase()}
    </button>
  ))}
</div> 

{/* ================= SOUND VISUALIZATION CONTROL ================= */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#020617",
    marginBottom: "8px",
  }}
>
  <div>
    <strong style={{ fontSize: "13px" }}>
      Sound Visualization
    </strong>
    <div style={{ fontSize: "11px", opacity: 0.6 }}>
      Speaker & sound propagation preview
    </div>
  </div>

  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "12px",
      cursor:
        centerViewMode === "speakers" ||
        centerViewMode === "combined"
          ? "pointer"
          : "not-allowed",
      opacity:
        centerViewMode === "speakers" ||
        centerViewMode === "combined"
          ? 1
          : 0.4,
    }}
  >
    <input
      type="checkbox"
      checked={showSoundVisualization}
      disabled={
        !(
          centerViewMode === "speakers" ||
          centerViewMode === "combined"
        )
      }
      onChange={(e) =>
        setShowSoundVisualization(e.target.checked)
      }
    />
    Enable
  </label>
</div>

{centerViewMode !== "speakers" &&
  centerViewMode !== "combined" && (
    <div
      style={{
        fontSize: "11px",
        opacity: 0.6,
        marginBottom: "6px",
      }}
    >
      Sound visualization is available only in Speakers
      and Combined views.
    </div>
)}

{/* ================= LAYER LEGEND ================= */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#020617",
    marginBottom: "10px",
    fontSize: "11px",
  }}
>
  {/* Structure */}
  <div style={{ opacity: isLegendItemActive("structure") ? 1 : 0.4 }}>
    <span style={{ color: "#475569" }}>■</span> Room Structure
  </div>

  {/* Screen */}
  <div style={{ opacity: isLegendItemActive("screen") ? 1 : 0.4 }}>
    <span style={{ color: "#22C55E" }}>■</span> Screen
  </div>

  {/* Seating */}
  <div style={{ opacity: isLegendItemActive("seating") ? 1 : 0.4 }}>
    <span style={{ color: "#38BDF8" }}>■</span> Seating
  </div>

  {/* Riser */}
  <div style={{ opacity: isLegendItemActive("riser") ? 1 : 0.4 }}>
    <span style={{ color: "#FACC15" }}>■</span> Riser
  </div>

  {/* Speakers */}
  <div style={{ opacity: isLegendItemActive("speakers") ? 1 : 0.4 }}>
    <span style={{ color: "#38BDF8" }}>●</span> Speakers
  </div>

  {/* Subwoofers */}
  <div style={{ opacity: isLegendItemActive("subwoofers") ? 1 : 0.4 }}>
    <span style={{ color: "#7F1D1D" }}>■</span> Subwoofers
  </div>

  {/* Sound */}
  <div style={{ opacity: isLegendItemActive("sound") ? 1 : 0.4 }}>
    <span style={{ color: "#94A3B8" }}>◌</span> Sound Waves
  </div>

  {/* Acoustic */}
  <div style={{ opacity: isLegendItemActive("acoustic") ? 1 : 0.4 }}>
    <span style={{ color: "#7C3AED" }}>■</span> Acoustic Treatment
  </div>

  {/* Angles */}
  <div style={{ opacity: isLegendItemActive("angles") ? 1 : 0.4 }}>
    <span style={{ color: "#FACC15" }}>⟂</span> Angles
  </div>

  {/* Dimensions */}
  <div style={{ opacity: isLegendItemActive("dimensions") ? 1 : 0.4 }}>
    <span style={{ color: "#CBD5F5" }}>↔</span> Dimensions
  </div>
</div>

  {/* SVG CANVAS */}
  {hasValidDimensions ? (
    <svg
      width={visualRoomWidth + 40}
      height={visualRoomLength + 40}
      viewBox={`0 0 ${visualRoomWidth + 40} ${visualRoomLength + 40}`}
      style={{
        border: "1px dashed #334155",
        borderRadius: "8px",
        background: "#020617",
      }}
    >


{/* ================= DRAWING START ================= */}

{/* ============================================================ */}
{/* C1 — SPEAKER & SUBWOOFER RENDER (SINGLE AUTHORITY) */}
{/* ============================================================ */}
{isLayerVisible("speakers") && (
  <g id="layer-speakers-authoritative">

{/* ---------- FRONT LCR (WALL SPEAKERS — RECTANGLES) ---------- */}
<rect
  x={finalLeftSpeakerX - 6}
  y={usableRoom.y + frontWallDepthPx + 2}
  width={12}
  height={8}
  rx={2}
  fill="#38BDF8"
/>
    <rect
      x={finalCenterSpeakerX - 6}
      y={usableRoom.y + 4}
      width={12}
      height={8}
      fill="#38BDF8"
    />
    <rect
      x={finalRightSpeakerX - 6}
      y={usableRoom.y + 4}
      width={12}
      height={8}
      fill="#38BDF8"
    />

    {/* ---------- SIDE SURROUNDS ---------- */}
    {finalBaseSpeakerLayer === "7" && (
      <>
        <rect
          x={usableRoom.x + 4}
          y={firstRowY - seatDepthFt - 6}
          width={8}
          height={12}
          rx={2}
          fill="#38BDF8"
        />
        <rect
          x={usableRoomRight - 12}
          y={firstRowY - seatDepthFt - 6}
          width={8}
          height={12}
          rx={2}
          fill="#38BDF8"
        />
      </>
    )}

    {/* ---------- ATMOS (CEILING — CIRCLES) ---------- */}
    {heightSpeakerLayer !== "0" && (
      <>
        <circle
          cx={usableRoomCenterX - Math.min(usableRoom.width * 0.15, 60)}
          cy={usableRoom.y + usableRoom.length * 0.35}
          r={5}
          fill="#FACC15"
          stroke="#92400E"
          strokeWidth={1}
        />
        <circle
          cx={usableRoomCenterX + Math.min(usableRoom.width * 0.15, 60)}
          cy={usableRoom.y + usableRoom.length * 0.35}
          r={5}
          fill="#FACC15"
          stroke="#92400E"
          strokeWidth={1}
        />

        {heightSpeakerLayer === "4" && (
          <>
            <circle
              cx={usableRoomCenterX - Math.min(usableRoom.width * 0.15, 60)}
              cy={usableRoom.y + usableRoom.length * 0.65}
              r={5}
              fill="#FACC15"
              stroke="#92400E"
              strokeWidth={1} 
            />
            <circle
              cx={usableRoomCenterX + Math.min(usableRoom.width * 0.15, 60)}
              cy={usableRoom.y + usableRoom.length * 0.65}
              r={5}
              fill="#FACC15"
              stroke="#92400E"
              strokeWidth={1}
            />
          </>
        )}
      </>
    )}

    {/* ---------- SUBWOOFERS (SQUARES) ---------- */}
    {subwooferCount >= 1 && (
      <rect
        x={usableRoomCenterX - 6}
        y={usableRoom.y + 10}
        width={12}
        height={12}
        fill="#7F1D1D"
        stroke="#FCA5A5"
        strokeWidth={1.2}
      />
    )}

    {subwooferCount >= 2 && (
      <>
        <rect
          x={usableRoom.x + usableRoom.width * 0.25 - 6}
          y={usableRoom.y + 10}
          width={12}
          height={12}
          fill="#7F1D1D"
          stroke="#FCA5A5"
          strokeWidth={1.2}
        />
        <rect
          x={usableRoom.x + usableRoom.width * 0.75 - 6}
          y={usableRoom.y + 10}
          width={12}
          height={12}
          fill="#7F1D1D"
          stroke="#FCA5A5"
          strokeWidth={1.2}
        />
      </>
    )}
  </g>
)}

{/* ============================================================ */}
{/* M1 — RAW ROOM (ENTERED DIMENSIONS) */}
{/* ============================================================ */}
<g id="layer-room-raw">
  <rect
    x={rawRoom.x}
    y={rawRoom.y}
    width={rawRoom.width}
    height={rawRoom.length}
    rx={8}
    fill="none"
    stroke="#475569"
    strokeWidth={1.5}
    strokeDasharray="6 4"
  />

  <text
    x={rawRoomCenterX}
    y={rawRoom.y - 8}
    textAnchor="middle"
    fontSize="10"
    fill="#64748B"
  >
    Entered Room (Architectural)
  </text>
</g>

{/* ============================================================ */}
{/* M1 — ACOUSTIC TREATMENT THICKNESS */}
{/* ============================================================ */}
{isLayerVisible("acoustic") && (
  <g id="layer-acoustic-thickness">
    <rect
  x={rawRoom.x}
  y={rawRoom.y}
  width={rawRoom.width}
  height={rawRoom.length}
  fill="#7C3AED"
  opacity={0.06}
  stroke="#7C3AED"
  strokeWidth={
  Math.max(
    frontWallDepthIn,
    backWallDepthIn,
    leftWallDepthIn,
    rightWallDepthIn
  ) * inchToPx * 2
}
 />

    <text
      x={rawRoom.centerX}
      y={rawRoom.bottom + 14}
      textAnchor="middle"
      fontSize="10"
      fill="#C4B5FD"
    >
      Front: {frontWallDepthIn}" | 
Back: {backWallDepthIn}" | 
Left: {leftWallDepthIn}" | 
Right: {rightWallDepthIn}" | 
Ceiling: {CEILING_ACOUSTIC_DEPTH_IN}"
    </text>
  </g>
)}

{/* ============================================================ */}
{/* M1 — USABLE ROOM (AUTHORITATIVE GEOMETRY) */}
{/* ============================================================ */}
<g id="layer-room-usable">
  <rect
    x={usableRoom.x}
    y={usableRoom.y}
    width={usableRoom.width}
    height={usableRoom.length}
    rx={6}
    fill="#0F172A"
    stroke="#22C55E"
    strokeWidth={2}
  />

 {isLayerVisible("dimensions") && (
  <text
    x={usableRoomCenterX}
    y={usableRoom.y - 8}
    textAnchor="middle"
    fontSize="10"
    fill="#86EFAC"
  >
    Usable Room (Post-Acoustic)
  </text>
)}
</g>

{/* ============================================================ */}
{/* PHASE 6.4 — SCREEN PLANE (ACOUSTIC-ALIGNED) */}
{/* ============================================================ */}
{isLayerVisible("screen") && usableRoom && (
  <g id="layer-screen-plane">

    {/* Screen sits exactly at usable front wall */}
    <rect
      x={usableRoomCenterX - visualScreenWidth / 2}
      y={usableRoom.y}
      width={visualScreenWidth}
      height={12}
      rx={4}
      fill="#22C55E"
    />

    {isLayerVisible("angles") && (
      <text
        x={usableRoomCenterX}
        y={usableRoom.y - 8}
        textAnchor="middle"
        fontSize="10"
        fill="#86EFAC"
      >
        Screen ({selectedAspectRatio})
      </text>
    )}

  </g>
)}

{/* ============================================================ */}
{/* PHASE 6.5 — SCREEN → LISTENER AXIS */}
{/* ============================================================ */}
{isLayerVisible("angles") && (
  <g id="layer-axis">
  <line
    x1={usableRoomCenterX}
    y1={usableRoom.y}
    x2={usableRoomCenterX}
    y2={primaryListenerY}
    stroke="#38BDF8"
    strokeWidth={1}
    strokeDasharray="4 4"
    opacity={0.7}
  />

  <circle
    cx={usableRoomCenterX}
    cy={primaryListenerY}
    r={3}
    fill="#38BDF8"
  />

  <text
    x={usableRoomCenterX + 6}
    y={primaryListenerY + 4}
    fontSize="10"
    fill="#7DD3FC"
  >
    Main Listening Axis
  </text>
</g>
)}

{isLayerVisible("acoustic") && (
  <g id="layer-acoustic">
    {/* ============================================================
       PHASE 2D — ACOUSTIC DEPTH VISUAL ENVELOPES (GEOMETRY ONLY)
       ============================================================ */}

    {/* FRONT WALL ACOUSTIC DEPTH */}
    {frontWallDepthIn > 0 && (
      <rect
        x={rawRoom.x}
        y={rawRoom.y}
        width={rawRoom.width}
        height={frontWallDepthPx}
        fill="#7C3AED"
        opacity={0.35}
      />
    )}

    {/* REAR WALL ACOUSTIC DEPTH */}
    {backWallDepthIn > 0 && (
      <rect
        x={rawRoom.x}
        y={rawRoomBottom - backWallDepthPx}
        width={rawRoom.width}
        height={backWallDepthPx}
        fill="#7C3AED"
        opacity={0.35}
      />
    )}

    {/* LEFT WALL ACOUSTIC DEPTH */}
    {leftWallDepthIn > 0 && (
      <rect
        x={rawRoom.x}
        y={rawRoom.y + frontWallDepthPx}
        width={leftWallDepthPx}
        height={rawRoom.length - frontWallDepthPx - backWallDepthPx}
        fill="#7C3AED"
        opacity={0.35}
      />
    )}

    {/* RIGHT WALL ACOUSTIC DEPTH */}
    {rightWallDepthIn > 0 && (
      <rect
        x={rawRoomRight - rightWallDepthPx}
        y={rawRoom.y + frontWallDepthPx}
        width={rightWallDepthPx}
        height={rawRoom.length - frontWallDepthPx - backWallDepthPx}
        fill="#7C3AED"
        opacity={0.35}
      />
    )}
  </g>
)}

{/* ============================================================
   PHASE 2E — ACOUSTIC DEPTH LABELS (READ-ONLY)
   ============================================================ */}

{/* FRONT WALL LABEL */}
{frontWallDepthIn > 0 && (
  <text
    x={rawRoomCenterX}
    y={rawRoom.y + frontWallDepthPx / 2}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="11"
    fill="#E9D5FF"
    opacity={0.9}
  >
    Front Wall · {frontWallDepthIn}″
  </text>
)}

{/* REAR WALL LABEL */}
{backWallDepthIn > 0 && (
  <text
    x={rawRoomCenterX}
    y={rawRoomBottom - backWallDepthPx / 2}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="11"
    fill="#E9D5FF"
    opacity={0.9}
  >
    Rear Wall · {backWallDepthIn}″
  </text>
)}

{/* LEFT WALL LABEL */}
{leftWallDepthIn > 0 && (
  <text
    x={rawRoom.x + leftWallDepthPx / 2}
    y={usableRoomCenterY}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="11"
    fill="#E9D5FF"
    opacity={0.9}
    transform={`rotate(-90 ${rawRoom.x + leftWallDepthPx / 2} ${usableRoomCenterY})`}
  >
    Left Wall · {leftWallDepthIn}″
  </text>
)}

{/* RIGHT WALL LABEL */}
{rightWallDepthIn > 0 && (
  <text
    x={rawRoomRight - rightWallDepthPx / 2}
    y={usableRoomCenterY}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="11"
    fill="#E9D5FF"
    opacity={0.9}
    transform={`rotate(90 ${rawRoomRight - rightWallDepthPx / 2} ${usableRoomCenterY})`}
  >
    Right Wall · {rightWallDepthIn}″
  </text>
)}

{/* ============================================================ */}
{/* Bass Traps — Corner Low Frequency Control */}
{/* ============================================================ */}
{(bassTrapCoverage === "All" || bassTrapCoverage === "RearOnly") && (
  <g>
    {/* ---------- FRONT LEFT CORNER ---------- */}
    {bassTrapCoverage === "All" && (
      <rect
        x={usableRoom.x}
        y={usableRoom.y}
        width={bassTrapSizePx}
        height={bassTrapSizePx}
        fill="#7C2D12"
        opacity={0.65}
      />
    )}

    {/* ---------- FRONT RIGHT CORNER ---------- */}
    {bassTrapCoverage === "All" && (
      <rect
        x={usableRoomRight - bassTrapSizePx}
        y={usableRoom.y}
        width={bassTrapSizePx}
        height={bassTrapSizePx}
        fill="#7C2D12"
        opacity={0.65}
      />
    )}

    {/* ---------- REAR LEFT CORNER ---------- */}
    <rect
      x={usableRoom.x}
      y={usableRoomBottom - bassTrapSizePx}
      width={bassTrapSizePx}
      height={bassTrapSizePx}
      fill="#7C2D12"
      opacity={0.65}
    />

    {/* ---------- REAR RIGHT CORNER ---------- */}
    <rect
      x={usableRoomRight - bassTrapSizePx}
      y={usableRoomBottom - bassTrapSizePx}
      width={bassTrapSizePx}
      height={bassTrapSizePx}
      fill="#7C2D12"
      opacity={0.65}
    />

    {/* ---------- LABEL ---------- */}
    <text
      x={usableRoomCenterX}
      y={usableRoomBottom - 6}
      textAnchor="middle"
      fontSize="10"
      fill="#FCA5A5"
      opacity={0.85}
    >
      Bass Traps (Low-Frequency Control)
    </text>
  </g>
)}

{/* ============================================================
    PHASE 2D — ACOUSTIC DEPTH VISUAL ENVELOPES
   ============================================================ */}

{/* FRONT */}
{effectiveFrontWallDepthIn > 0 && (
  <rect
    x={rawRoom.x}
    y={rawRoom.y}
    width={rawRoom.width}
    height={frontWallDepthPx}
    fill="#7C3AED"
    opacity={0.35}
  />
)}

{/* REAR */}
{effectiveBackWallDepthIn > 0 && (
  <rect
    x={rawRoom.x}
    y={rawRoomBottom - backWallDepthPx}
    width={rawRoom.width}
    height={backWallDepthPx}
    fill="#7C3AED"
    opacity={0.35}
  />
)}

{/* LEFT */}
{effectiveLeftWallDepthIn > 0 && (
  <rect
    x={rawRoom.x}
    y={rawRoom.y + frontWallDepthPx}
    width={leftWallDepthPx}
    height={rawRoom.length - frontWallDepthPx - backWallDepthPx}
    fill="#7C3AED"
    opacity={0.35}
  />
)}

{/* RIGHT */}
{effectiveRightWallDepthIn > 0 && (
  <rect
    x={rawRoomRight - rightWallDepthPx}
    y={rawRoom.y + frontWallDepthPx}
    width={rightWallDepthPx}
    height={rawRoom.length - frontWallDepthPx - backWallDepthPx}
    fill="#7C3AED"
    opacity={0.35}
  />
)}

{/* ============================================================ */}
{/* PHASE 7.9 — REAR WALL DIFFUSER / ABSORBER */}
{/* ============================================================ */}
{isLayerVisible("acoustic") &&
  <g id="layer-rear-diffuser">
   <rect
  x={rearDiffuserX}
  y={rearDiffuserY}
  width={rearDiffuserWidthPx}
  height={rearDiffuserHeightPx}
  fill={diffuserColor}
  opacity={0.55}
  stroke="#FCD34D"
  strokeWidth={1}
  strokeDasharray="4 3"
/>
    <text
      x={usableRoomCenterX}
      y={rearDiffuserY - 6}
      textAnchor="middle"
      fontSize="9"
      fill="#FCD34D"
    >
      Rear Diffusion (Preserves Energy & Spaciousness)
    </text>
  </g>}

{isLayerVisible("acoustic") &&
  rearWallTreatment === "Absorber" && (
  <g id="layer-rear-absorber">
    <rect
  x={rearPanelX}
  y={rearPanelY}
  width={rearPanelWidth}
  height={rearPanelDepthPx}
  fill={absorberColor}
  opacity={0.85}
  stroke="#4C1D95"
  strokeWidth={1}
/>
    <text
      x={usableRoomCenterX}
      y={rearPanelY - 6}
      textAnchor="middle"
      fontSize="9"
      fill="#DDD6FE"
    >
      Rear Absorption (Controls Reflections & Echo)
    </text>
  </g>
)}

{/* ============================================================ */}
{/* PHASE 6.6 — ROW 1 SEATING (AUTHORITATIVE SAFE VERSION) */}
{/* ============================================================ */}

{isLayerVisible("seating") &&
  firstRowY > 0 &&
  usableRoom &&
  (() => {

    // 1 inch clearance from each wall
    const sideGapPx = inchToPx;

    // Max seats allowed by usable width
    const maxSeatsByWidth = Math.floor(
      (usableRoom.width - sideGapPx * 2) / seatWidthPx
    );

    const authoritativeSeats = Math.max(
      1,
      Math.min(seatsPerRow, maxSeatsByWidth)
    );

    const totalSeatsWidth =
      authoritativeSeats * seatWidthPx;

    // Perfect center alignment inside usable room
    const startX =
      usableRoom.x +
      sideGapPx +
      (usableRoom.width - totalSeatsWidth - sideGapPx * 2) / 2;

    return (
      <g id="layer-row-1-seating">

        {Array.from({ length: authoritativeSeats }).map((_, i) => (
          <rect
            key={`row1-seat-${i}`}
            x={startX + i * seatWidthPx}
            y={firstRowY}
            width={seatWidthPx - 4}
            height={seatDepthPx}
            rx={10}
            fill="#0EA5E9"
            stroke="#0284C7"
            strokeWidth={1}
          />
        ))}

        <text
          x={usableRoomCenterX}
          y={firstRowY + seatDepthPx + 18}
          textAnchor="middle"
          fontSize="10"
          fill="#94A3B8"
        >
          Row 1 — Main Listening Position
        </text>

      </g>
    );
  })()}
  
{/* ============================================================ */}
{/* PHASE 6.7 — ROW 2 SEATING + RISER (GATED) */}
{/* ============================================================ */}
{seatingRecommendation === "2 Rows Recommended" &&
  secondRowY > 0 && (
    <g id="layer-row-2-seating">

      {/* ---------- RISER LINE ---------- */}
      <line
        x1={usableRoom. x}
        y1={(firstRowY + secondRowY) / 2}
        x2={usableRoomRight}
        y2={(firstRowY + secondRowY) / 2}
        stroke="#FACC15"
        strokeWidth={2}
        strokeDasharray="4 4"
      />

{/* ---------- ROW 2 SEATS ---------- */}
{isLayerVisible("seating") &&
  seatingRecommendation === "2 Rows Recommended" &&
  secondRowY > 0 && (() => {

    const sideGapPx = (1 / 12) * VISUAL_SCALE; // 1 inch gap

    const maxSeatsByGeometry = Math.floor(
      (usableRoom.width - 2 * sideGapPx) / seatWidthPx
    );

    const safeSeats = Math.min(seatsPerRow, maxSeatsByGeometry);

    const totalSeatsWidth = safeSeats * seatWidthPx;

    const startX =
      usableRoom.x +
      sideGapPx +
      (usableRoom.width - totalSeatsWidth - sideGapPx * 2) / 2;

    return Array.from({ length: safeSeats }).map((_, i) => (
      <rect
        key={`row2-seat-${i}`}
        x={startX + i * seatWidthPx}
        y={secondRowY}
        width={seatWidthPx - 2}
        height={seatDepthPx}
        rx={4}
        fill="#38BDF8"
        opacity={0.85}
      />
    ));
})()}
      

      {/* ---------- ROW 2 LABEL ---------- */}
      <text
        x={usableRoomCenterX}
        y={secondRowY + seatDepthFt + 14}
        textAnchor="middle"
        fontSize="10"
        fill="#94A3B8"
      >
        Row 2 (Riser)
      </text>
    </g>
)}

{/* ================= PROJECTOR & SCREEN VIEW ================= */}
{isLayerVisible("screen") && isLayerVisible("angles") && (
  <g id="layer-projector-view">

    {horizontalLensShiftStatus === "Not Possible" && (
  <text
    x={roomLeftX + visualRoomWidth / 2}
    y={screenY - 22}
    textAnchor="middle"
    fontSize="10"
    fill="#EF4444"
  >
    ⚠ Lens shift exceeds projector limits
  </text>
)}
{horizontalLensShiftStatus === "Not Possible" && (
  <text
    x={projectorX}
    y={projectorY + 30}
    textAnchor="middle"
    fontSize="10"
    fill="#EF4444"
  >
    ⚠ Horizontal lens shift limit exceeded
  </text>
)}

{screenBottomStatus === "Too Low" && (
  <text
    x={roomLeftX + visualRoomWidth / 2}
    y={screenY - 36}
    textAnchor="middle"
    fontSize="10"
    fill="#EF4444"
  >
    ⚠ Screen too low for center speaker
  </text>
)}

    {/* ---------- SCREEN ---------- */}
    <rect
      x={screenX}
      y={screenY}
      width={visualScreenWidth}
      height={visualScreenDepth}
      fill="#22C55E"
      rx={4}
    />

    <text
      x={roomLeftX + visualRoomWidth / 2}
      y={screenY - 8}
      textAnchor="middle"
      fontSize="10"
      fill="#86EFAC"
    >
      Screen ({selectedAspectRatio})
    </text>

    {/* ---------- PROJECTOR BODY ---------- */}
    <rect
      x={projectorX - 8}
      y={projectorY - 8}
      width={16}
      height={16}
      rx={3}
      fill="#94A3B8"
      stroke="#CBD5F5"
      strokeWidth={1}
    />

    <text
      x={projectorX}
      y={projectorY + 18}
      textAnchor="middle"
      fontSize="10"
      fill="#CBD5F5"
    >
      Projector
    </text>

    {/* ---------- THROW CONE (V SHAPE) ---------- */}
    <line
      x1={projectorX}
      y1={projectorY}
      x2={screenX}
      y2={screenY + visualScreenDepth}
      stroke="#60A5FA"
      strokeWidth={1}
      strokeDasharray="4 4"
    />

    <line
      x1={projectorX}
      y1={projectorY}
      x2={screenX + visualScreenWidth}
      y2={screenY + visualScreenDepth}
      stroke="#60A5FA"
      strokeWidth={1}
      strokeDasharray="4 4"
    />

    {/* ---------- VIEWING DISTANCE ---------- */}
    <line
      x1={roomLeftX + visualRoomWidth / 2}
      y1={screenY + visualScreenDepth}
      x2={roomLeftX + visualRoomWidth / 2}
      y2={projectorY}
      stroke="#FACC15"
      strokeWidth={1}
      strokeDasharray="2 4"
    />

    <text
      x={roomLeftX + visualRoomWidth / 2 + 6}
      y={(screenY + projectorY) / 2}
      fontSize="10"
      fill="#FACC15"
    >
      Viewing Distance
    </text>

  </g>
)}


{/* ================= SOUND VISUALIZATION LAYER ================= */}
{isLayerVisible("sound") &&
  showSoundVisualization && (
  <g id="layer-sound" pointerEvents="none">

    {/* ---------- WALL SPEAKER CONES (FRONT LCR) ---------- */}
    {[
      {
        x: roomLeftX + visualRoomWidth * 0.25,
        y: roomTopY + 11,
        angle: 25,
        color: WALL_SPEAKER_COLOR,
      },
      {
        x: roomLeftX + visualRoomWidth * 0.5,
        y: roomTopY + 11,
        angle: 20,
        color: WALL_SPEAKER_COLOR,
      },
      {
        x: roomLeftX + visualRoomWidth * 0.75,
        y: roomTopY + 11,
        angle: 25,
        color: WALL_SPEAKER_COLOR,
      },
    ].map((spk, i) => {
      const depth = roomBottomY - spk.y;
      const spread = Math.tan((spk.angle * Math.PI) / 180) * depth;

      return (
        <path
          key={`wall-cone-${i}`}
          d={`
            M ${spk.x} ${spk.y}
            L ${spk.x - spread} ${roomBottomY}
            L ${spk.x + spread} ${roomBottomY}
            Z
          `}
          fill={spk.color}
          opacity={0.08}
        />
      );
    })}

    {/* ---------- SIDE SURROUND CONES ---------- */}
    {baseSpeakerLayer === "7" &&
      [
        {
          x: roomLeftX + 10,
          y: roomTopY + visualRoomLength * 0.55,
          dir: 1,
        },
        {
          x: roomRightX - 10,
          y: roomTopY + visualRoomLength * 0.55,
          dir: -1,
        },
      ].map((spk, i) => {
        const depth = visualRoomWidth;
        const spread = Math.tan((30 * Math.PI) / 180) * depth;

        return (
          <path
            key={`side-cone-${i}`}
            d={`
              M ${spk.x} ${spk.y}
              L ${spk.x + spk.dir * depth} ${spk.y - spread}
              L ${spk.x + spk.dir * depth} ${spk.y + spread}
              Z
            `}
            fill={WALL_SPEAKER_COLOR}
            opacity={0.08}
          />
        );
      })}

    {/* ---------- ATMOS CIRCULAR WAVES ---------- */}
    {finalHeightSpeakerLayer !== "0" &&
      [
        {
          x: roomLeftX + visualRoomWidth * 0.33,
          y: roomTopY + visualRoomLength * 0.4,
        },
        {
          x: roomLeftX + visualRoomWidth * 0.66,
          y: roomTopY + visualRoomLength * 0.4,
        },
        ...(heightLayer === "4"
          ? [
              {
                x: roomLeftX + visualRoomWidth * 0.33,
                y: roomTopY + visualRoomLength * 0.65,
              },
              {
                x: roomLeftX + visualRoomWidth * 0.66,
                y: roomTopY + visualRoomLength * 0.65,
              },
            ]
          : []),
      ].flatMap((spk, i) =>
        generateWaveRings(
          spk.x,
          spk.y,
          Math.min(
            spk.x - roomLeftX,
            roomRightX - spk.x,
            spk.y - roomTopY,
            roomBottomY - spk.y
          ),
          4
        ).map((ring, r) => (
          <circle
            key={`atmos-wave-${i}-${r}`}
            cx={spk.x}
            cy={spk.y}
            r={ring.r}
            stroke={CEILING_SPEAKER_COLOR}
            strokeWidth="1"
            fill="none"
            opacity={ring.opacity}
          />
        ))
      )}

    {/* ---------- SUBWOOFER CIRCULAR WAVES ---------- */}
   {[
  { x: roomLeftX + 12, y: roomTopY + 12 },
  ...(subwooferCount >= 2
    ? [{ x: roomRightX - 12, y: roomTopY + 12 }]
    : []),
  ...(subwooferCount >= 4
    ? [
        { x: roomRightX - 12, y: roomBottomY - 12 },
        { x: roomLeftX + 12, y: roomBottomY - 12 },
      ]
    : []),
].flatMap((sub, i) =>
  generateWaveRings(
    sub.x,
    sub.y,
    Math.min(visualRoomWidth, visualRoomLength) * 0.6,
    8
  ).map((ring, r) => (
    <circle
      key={`sub-wave-${i}-${r}`}
      cx={sub.x}
      cy={sub.y}
      r={ring.r}
      stroke={SUBWOOFER_COLOR}
      strokeWidth="1.6"
      fill="none"
      opacity={ring.opacity}
    />
  ))
)}

  </g>
)}

{/* ---------- STEP 21 : SEATING ROW 2 (DUPLICATE — DISABLED)
     Handled by layer-seating-authoritative
     DO NOT RENDER HERE
*/}


{/* ---------- STEP 27 : Row 2 label (SEATING VIEW ONLY) ---------- */}

{/* ---------- STEP 26 : Row 2 seat count (SEATING VIEW ONLY) ---------- */}

{/* ---------- STEP 24 : RISER STEP LINE (GATED) ---------- */}
{isLayerVisible("seating") &&
  isSecondRowAllowed &&
  firstRowY > 0 &&
  secondRowY > 0 && (
    <line
      x1={roomLeftX}
      y1={clampY((firstRowY + secondRowY) / 2)}
      x2={roomRightX}
      y2={clampY((firstRowY + secondRowY) / 2)}
      stroke="#FACC15"
      strokeWidth="2"
      strokeDasharray="4 4"
    />
)}


{/* ================= DRAWING END ================= */}
    </svg>
  ) : (
    <div
      style={{
        flex: 1,
        minHeight: "300px",
        border: "1px dashed #334155",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        opacity: 0.6,
      }}
    >
      Enter room dimensions to see visualization
    </div>
  )}

  {/* Footer Hint */}
  <div style={{ fontSize: "12px", opacity: 0.5 }}>
    Visualization updates dynamically based on inputs
  </div>

</div>
{/* ================= END CENTER PANEL ================= */}

{/* ================= RIGHT PANEL ================= */}
<div
  ref={pdfRef}
  style={{
    background: "#0F172A",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 0,
    overflowY: "auto",
  }}
>

  <div>
    <h3 style={{ marginBottom: "4px" }}>Design Summary</h3>
    <p style={{ fontSize: "13px", opacity: 0.6 }}>
      Feasibility and system recommendations
    </p>
  </div>

  {!hasValidDimensions && (
    <div
      style={{
        marginTop: "20px",
        padding: "14px",
        border: "1px dashed #334155",
        borderRadius: "8px",
        fontSize: "13px",
        opacity: 0.7,
      }}
    >
      Enter room dimensions to see design analysis
    </div>
  )}

  {/* Status Card */}
  <div style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px"
  }}>
    <strong>Overall Feasibility</strong>


{hasValidDimensions && (
    <p
  style={{
    marginTop: "8px",
    fontSize: "14px",
    color:
      feasibilityStatus === "Feasible"
        ? "#22C55E"
        : feasibilityStatus === "Compromised"
        ? "#FACC15"
        : "#EF4444",
  }}
>
  {feasibilityStatus}
</p>
)}

{hasValidDimensions && (
<p style={{ fontSize: "12px", opacity: 0.7, marginTop: "6px" }}>
  {feasibilityReason}
</p>
)}

  </div>
  <div style={{
  background: "#020617",
  border: "1px solid #1F2937",
  borderRadius: "8px",
  padding: "16px",
  fontSize: "12px",
  opacity: 0.8
}}>
  <strong>Room Size</strong>

  {hasValidDimensions && (
  <p style={{ marginTop: "6px" }}>
    {length || "–"} ft × {width || "–"} ft × {height || "–"} ft
  </p>
  )}

</div>
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "12px",
    opacity: 0.8,
  }}
>
  <strong>Derived Values</strong>

{hasValidDimensions && (
 <p style={{ marginTop: "8px" }}>
  Volume: {dimensionsWithinLimits ? roomVolume : "–"} ft³
</p>
)}

{hasValidDimensions && (
  <p>
    L : W Ratio: {lengthWidthRatio || "–"}
  </p>
)}

{hasValidDimensions && (
  <p>
    W : H Ratio: {widthHeightRatio || "–"}
  </p>
)}

  {hasValidDimensions && (
  <p>
    Ceiling Height: {ceilingHeightFlag || "–"}
  </p>
)}

</div>

  {/* Screen Summary */}
  <div style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px"
  }}>
    <strong>Screen Recommendation</strong>

{hasValidDimensions && (
   <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "6px" }}>
{finalScreenDiagonalIn
  ? `${Math.round(Number(finalScreenDiagonalIn))}″`
    : "—"}
</p>
)}


{hasValidDimensions && (
<p
  style={{
    marginTop: "6px",
    fontSize: "12px",
    color: screenPhysicallyFits ? "#22C55E" : "#EF4444",
  }}
>
  {screenPhysicallyFits
    ? "✓ fits room"
    : "✕ Too large"}
</p>
)}


{hasValidDimensions && (
<p style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>
  {screenFeasibilityMessage}
</p>
)}

{hasValidDimensions && (
<p style={{ fontSize: "12px", opacity: 0.6 }}>
  Viewing distance: {dimensionsWithinLimits ? viewingDistance : "–"} ft
</p>
)}

{hasValidDimensions &&
  typeof finalScreenDiagonalIn === "number" &&
  finalScreenDiagonalIn !== screenDiagonalInches && (
    <p style={{ fontSize: "11px", color: "#FACC15", marginTop: "6px" }}>
      ⚠ Screen size auto-adjusted to meet physical and ergonomic limits
    </p>
)}

  </div>

  {/* ---------- Stage 4.3 : Projector Lens Shift ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
  }}
>
  <strong>Projector Lens Shift</strong>

  {hasValidDimensions && (
    <>
      <p style={{ marginTop: "6px", fontSize: "12px" }}>
        Required Shift:{" "}
        {typeof requiredHorizontalShiftPercent === "number"
          ? `${requiredHorizontalShiftPercent.toFixed(1)}%`
          : "—"}
      </p>

      <p
        style={{
          marginTop: "6px",
          fontSize: "13px",
          fontWeight: 600,
          color:
            horizontalLensShiftStatus === "OK"
              ? "#22C55E"
              : horizontalLensShiftStatus === "Warning"
              ? "#FACC15"
              : "#EF4444",
        }}
      >
        {horizontalLensShiftStatus}
      </p>

      <p style={{ fontSize: "12px", opacity: 0.65, marginTop: "4px" }}>
        {horizontalLensShiftMessage}
      </p>
    </>
  )}
</div>

{/* ---------- Stage 4.4 : Horizontal Lens Shift ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
  }}
>
  <strong>Horizontal Lens Shift</strong>

  {hasValidDimensions && (
    <>
      <p style={{ marginTop: "6px", fontSize: "12px" }}>
        Required Shift:{" "}
        {typeof requiredHorizontalShiftPercent === "number"
          ? `${requiredHorizontalShiftPercent.toFixed(1)}%`
          : "—"}
      </p>

      <p
        style={{
          marginTop: "6px",
          fontSize: "13px",
          fontWeight: 600,
          color:
            horizontalLensShiftStatus === "OK"
              ? "#22C55E"
              : horizontalLensShiftStatus === "Warning"
              ? "#FACC15"
              : "#EF4444",
        }}
      >
        {horizontalLensShiftStatus}
      </p>

      <p style={{ fontSize: "12px", opacity: 0.65, marginTop: "4px" }}>
        {horizontalLensShiftMessage}
      </p>
    </>
  )}
</div>

{/* ---------- Stage 4.5 : Ceiling Mount Feasibility ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
  }}
>
  <strong>Projector Mounting</strong>

  {hasValidDimensions && (
    <>
      <p
        style={{
          marginTop: "6px",
          fontSize: "14px",
          fontWeight: 600,
          color: ceilingMountFeasible ? "#22C55E" : "#EF4444",
        }}
      >
        Ceiling Mount
      </p>

      <p style={{ fontSize: "12px", opacity: 0.65, marginTop: "4px" }}>
        {ceilingMountMessage}
      </p>
    </>
  )}
</div>

{/* ---------- Stage 4.6 : Screen Bottom Height ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
  }}
>
  <strong>Screen Bottom Height</strong>

  {hasValidDimensions && (
    <>
      <p style={{ marginTop: "6px", fontSize: "12px" }}>
        Bottom Height:{" "}
        {typeof actualScreenBottomIn === "number"
          ? `${actualScreenBottomIn.toFixed(0)}″`
          : "—"}
      </p>

      <p
        style={{
          marginTop: "6px",
          fontSize: "13px",
          fontWeight: 600,
          color:
            screenBottomStatus === "Ideal"
              ? "#22C55E"
              : screenBottomStatus === "Acceptable"
              ? "#FACC15"
              : "#EF4444",
        }}
      >
        {screenBottomStatus}
      </p>

      <p style={{ fontSize: "12px", opacity: 0.65, marginTop: "4px" }}>
        {screenBottomMessage}
      </p>
    </>
  )}

{hasValidDimensions && screenPositionOptimized && (
  <p style={{ fontSize: "11px", color: "#22C55E", marginTop: "6px" }}>
    ✓ Screen height auto-optimized for comfort and speaker clearance
  </p>
)}

</div>

{/* Seating Summary */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
  }}
>
  <strong>Seating Layout</strong>

  {hasValidDimensions && (
    <p style={{ marginTop: "6px", fontSize: "13px" }}>
      {seatingRecommendation}
    </p>
  )}

  {seatingAutoRecommended && (
    <p style={{ fontSize: "11px", color: "#22C55E", marginTop: "4px" }}>
      ✓ Seating layout fits room geometry & sightline rules
    </p>
  )}

  {seatingRecommendation === "2 Rows Recommended" && (
    <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
      Riser Height:{" "}
      {typeof riserHeightFt === "number"
        ? `${(riserHeightFt * 12).toFixed(0)}″`
        : "—"}
    </p>
  )}

  {seatingWarning && (
    <p style={{ fontSize: "11px", color: "#FACC15", marginTop: "4px" }}>
      ⚠ {seatingWarning}
    </p>
  )}
</div>

{hasValidDimensions &&
  seatingRecommendation === "2 Rows Recommended" &&
  typeof riserHeightFt === "number" &&
  typeof seatDepthFt === "number" &&
  typeof width === "number" && (
    <>
      <div
        style={{
          background: "#020617",
          border: "1px dashed #334155",
          borderRadius: "8px",
          padding: "12px",
          fontSize: "12px",
          opacity: 0.85,
        }}
      >
        <strong>Riser Details</strong>
        <p style={{ marginTop: "6px" }}>
          Height: {(riserHeightFt * 12).toFixed(0)}″
        </p>
        <p>Width: {(Number(width) * 12).toFixed(0)}″</p>
      </div>
    </>
)}

  <div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "12px",
    opacity: 0.8,
  }}
>
  <strong>Vertical Viewing Comfort</strong>

{hasValidDimensions && (
  <p style={{ marginTop: "6px" }}>
    Angle:{" "}
    {typeof finalVerticalViewingAngleDegrees === "number"
      ? finalVerticalViewingAngleDegrees.toFixed(1)
      : "–"}
    °
  </p>
)}

{hasValidDimensions && (
  <p
    style={{
      color:
        finalVerticalComfort === "Comfortable"
          ? "#22C55E"
          : finalVerticalComfort === "Slightly High"
          ? "#FACC15"
          : "#EF4444",
    }}
  >
    {finalVerticalComfort || "–"}
  </p>
)}
</div>

{/* ---------- Stage 4.9 : Rear Row Sightline ---------- */}
{seatingRecommendation === "2 Rows Recommended" && (
  <div
    style={{
      background: "#020617",
      border: "1px solid #1F2937",
      borderRadius: "8px",
      padding: "16px",
    }}
  >
    <strong>Rear Row Viewing</strong>

    <p
      style={{
        marginTop: "6px",
        fontSize: "14px",
        fontWeight: 600,
        color:
          row2ViewingStatus === "Clear"
            ? "#22C55E"
            : row2ViewingStatus === "Compromised"
            ? "#FACC15"
            : "#EF4444",
      }}
    >
      {row2ViewingStatus}
    </p>

    <p style={{ fontSize: "12px", opacity: 0.65, marginTop: "4px" }}>
      {row2ViewingMessage}
    </p>
  </div>
)}

  {/* ----------  : Final Room Verdict ---------- */}
<div
  style={{
    background:
      roomVerdict === "Recommended"
        ? "#022c22"
        : roomVerdict === "Compromised"
        ? "#3f2d0a"
        : "#3f1d1d",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "16px",
  }}
>
  <div
    style={{
      fontSize: "18px",
      fontWeight: 700,
      color:
        roomVerdict === "Recommended"
          ? "#22c55e"
          : roomVerdict === "Compromised"
          ? "#facc15"
          : "#ef4444",
    }}
  >
    {roomVerdict}
  </div>

{hasValidDimensions && (
  <p
    style={{
      marginTop: "8px",
      fontSize: "13px",
      opacity: 0.9,
      lineHeight: 1.5,
    }}
  >
    {roomVerdictExplanation}
  </p>
)}

</div>

{/* ---------- Stage 10.4 : Client-facing explanation ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "10px",
    padding: "16px",
    lineHeight: 1.5,
    marginBottom: "14px",
  }}
>
  <strong style={{ fontSize: "14px" }}>
    What this means for your home theater
  </strong>

{hasValidDimensions && (
  <p
    style={{
      marginTop: "8px",
      fontSize: "13px",
      opacity: 0.8,
    }}
  >
    {finalVerdict === "Recommended" &&
      "This room has strong proportions for a premium home theater. With correct equipment selection and standard acoustic treatment, you can expect excellent performance."}

    {finalVerdict === "Compromised" &&
      "This room can work well, but careful acoustic planning and layout decisions are critical."}

    {finalVerdict === "Not Recommended" &&
      "This room has fundamental limitations. Structural or dimensional changes are recommended."}
  </p>
)}

{hasValidDimensions && (
  <p
    style={{
      marginTop: "10px",
      fontSize: "12px",
      opacity: 0.65,
    }}
  >
    Based on room geometry, seating distance, speaker behavior, and acoustic risk analysis.
  </p>
)}
</div>

{/* ---------- Stage 10.5 : Confidence Indicator ---------- */}
<div
  style={{
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${confidenceColor}`,
    background: `${confidenceColor}20`,
    fontSize: "13px",
    fontWeight: 600,
    color: confidenceColor,
    marginBottom: "18px",
  }}
>
  Confidence Level: {confidenceLabel}
</div>


{/* ---------- Stage 10.3 : Upgrade Path ---------- */}
{roomVerdict !== "Recommended" && (
  <div
    style={{
      background: "#020617",
      border: "1px dashed #334155",
      borderRadius: "10px",
      padding: "16px",
      marginBottom: "16px",
    }}
  >
    <strong>Recommended Upgrades</strong>

    <ol style={{ marginTop: "10px", paddingLeft: "18px", fontSize: "13px" }}>
      {finalUpgradeSteps.map((step, index) => (
        <li key={index} style={{ marginBottom: "8px", lineHeight: 1.5 }}>
          {step}
        </li>
      ))}
    </ol>
  </div>
)}

{/* ---------- Stage 10.6 : Acoustic Treatment Summary ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "18px",
    fontSize: "12px",
    lineHeight: 1.5,
  }}
>
  <strong>Recommended Acoustic Treatment</strong>

  {hasValidDimensions && (
    <p style={{ marginTop: "6px", fontSize: "12px" }}>
      Mode: <strong>{acousticMode}</strong>
    </p>
  )}

  {hasValidDimensions && (
    <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }}>
      All room geometry, speaker placement, and viewing calculations are
      performed after applying acoustic treatment thickness.
    </p>
  )}

  {hasValidDimensions && (
    <ul style={{ marginTop: "10px", paddingLeft: "18px" }}>
      {/* FRONT WALL */}
      <li>
        <strong>Front Wall:</strong>{" "}
        {frontWallDepthIn > 0
          ? `${frontWallDepthIn}″ absorption (screen & speaker reflection control)`
          : "No treatment applied"}
      </li>

      {/* SIDE WALLS */}
      <li>
        <strong>Left Wall:</strong>{" "}
        {leftWallDepthIn > 0
          ? `${leftWallDepthIn}″ absorption (early reflection control)`
          : "No treatment applied"}
      </li>

      <li>
        <strong>Right Wall:</strong>{" "}
        {rightWallDepthIn > 0
          ? `${rightWallDepthIn}″ absorption (early reflection control)`
          : "No treatment applied"}
      </li>

      {/* REAR WALL */}
      <li>
        <strong>Rear Wall:</strong>{" "}
        {backWallDepthIn > 0
          ? `${backWallDepthIn}″ absorption / diffusion (rear energy control)`
          : "No treatment applied"}
      </li>

      {/* CEILING */}
      <li>
        <strong>Ceiling:</strong>{" "}
        {CEILING_ACOUSTIC_DEPTH_IN > 0
          ? `${CEILING_ACOUSTIC_DEPTH_IN}″ acoustic zone (Atmos, HVAC, lighting)`
          : "No treatment applied"}
      </li>

      {/* BASS CONTROL */}
      <li>
        <strong>Bass Control:</strong>{" "}
        {bassTrapCoverage === "All"
          ? "Bass traps in all vertical corners"
          : bassTrapCoverage === "RearOnly"
          ? "Bass traps on rear corners"
          : "No dedicated bass traps recommended"}
      </li>
    </ul>
  )}
</div>
  
 {/* ---------- Stage 11.1 : Room & System Summary ---------- */}
<div style={{ marginBottom: "18px" }}>
  <div
    style={{
      fontSize: "11px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      opacity: 0.5,
      marginBottom: "6px",
    }}
  >
    Room & System Summary
  </div>

  {/* ---------- Design Intent Summary ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "12px",
    marginBottom: "16px",
  }}
>
  <strong>Design Intent</strong>

  {hasValidDimensions && (
    <>
      <p style={{ marginTop: "6px" }}>
        Usage Profile: {usageProfile}
      </p>
      <p>Client Style: {clientPreferenceStyle}</p>
      <p>Future Ready Level: {futureReadyLevel}</p>
    </>
  )}
</div>

  {/* Audio Summary */}
  <div style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px"
  }}>
<strong>Audio Layout</strong>

{hasValidDimensions && (
  <>
    <p style={{ fontSize: "14px", marginTop: "6px", fontWeight: 600 }}>
      {speakerLayoutLabel}
    </p>

    <p style={{ fontSize: "12px", opacity: 0.7 }}>
      Format: {speakerStandardLabel}
    </p>

    {speakerAutoRecommended && (
      <p style={{ fontSize: "11px", color: "#22C55E", marginTop: "4px" }}>
        ✓ Auto-recommended for room size & seating
      </p>
    )}

    {!speakerAutoRecommended && (
      <p style={{ fontSize: "11px", color: "#FACC15", marginTop: "4px" }}>
        ⚠ User-selected layout exceeds standard recommendation
      </p>
    )}
  </>
)}

  </div>

  {/* Speaker Layout */}
  <div style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "10px"
  }}>
    <strong>Speaker Layout Recommendation</strong>

    {hasValidDimensions && (
    <p style={{ fontSize: "14px", marginTop: "6px" }}>
      {speakerLayoutLabel}
    </p>
    )}

    {hasValidDimensions && (
    <p style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>
      Based on room width, seating, and ceiling height
    </p>
    )}
  </div>

  {/* ---------- Phase 5.1 : Front LCR Geometry ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "10px",
  }}
>
  <strong>Front LCR Geometry</strong>

  <p
    style={{
      marginTop: "6px",
      fontSize: "14px",
      fontWeight: 600,
      color:
        lcrGeometryStatus === "Ideal"
          ? "#22C55E"
          : lcrGeometryStatus === "Acceptable"
          ? "#FACC15"
          : "#EF4444",
    }}
  >
    {lcrGeometryStatus}
  </p>

  <p style={{ fontSize: "12px", opacity: 0.65, marginTop: "4px" }}>
    {lcrGeometryMessage}
  </p>

  <p style={{ fontSize: "11px", opacity: 0.6, marginTop: "6px" }}>
    L/R Angles: {leftSpeakerAngle.toFixed(1)}° /{" "}
    {rightSpeakerAngle.toFixed(1)}°
  </p>
</div>

  {/* Subwoofer Recommendation */}
  <div style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "10px"
  }}>
    <strong>Subwoofer Recommendation</strong>

    {hasValidDimensions && (
    <p style={{ fontSize: "14px", marginTop: "6px" }}>
      {subwooferCount} Subwoofer{subwooferCount > 1 ? "s" : ""}
    </p>
    )}


{hasValidDimensions && (
    <p style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>
      {subwooferPlacement}
    </p>
)}

  </div>
</div>


{hasValidDimensions && (
  <>
    {/* ---------- Stage 9.25 : Acoustic Risk Factors ---------- */}
    <div
      style={{
        background: "#020617",
        border: "1px dashed #334155",
        borderRadius: "8px",
        padding: "14px",
        marginTop: "10px",
        fontSize: "12px",
      }}
    >
      <strong>Primary Risk Factors</strong>

      {acousticRisks.length === 1 && acousticRisks[0] === "None" ? (
        <p style={{ marginTop: "6px", opacity: 0.7 }}>
          No significant acoustic risk factors detected.
        </p>
      ) : (
        <ul style={{ marginTop: "8px", paddingLeft: "18px", lineHeight: 1.5 }}>
          {acousticRisks
            .filter((risk) => risk !== "None")
            .map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
        </ul>
      )}
    </div>
  </>
)}

{hasValidDimensions && (
  <>
    {/* ---------- Stage 11.1 : Treatment Recommendations ---------- */}
    <div style={{ marginBottom: "18px" }}>
      <div
        style={{
          fontSize: "11px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: 0.5,
          marginBottom: "6px",
        }}
      >
        Treatment Recommendations
      </div>

      <div className="risk-card">
        <strong>Acoustic Recommendations</strong>

        {acousticRecommendations.length === 0 ? (
          <p style={{ fontSize: "12px", opacity: 0.6 }}>
            No specific recommendations required.
          </p>
        ) : (
          <ul className="risk-list">
            {acousticRecommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </>
)}

    {hasValidDimensions && (
  <>
    {/* ---------- Stage 8.8 : Acoustic Risk Toggles ---------- */}
    <div
      style={{
        background: "#020617",
        border: "1px solid #1F2937",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        fontSize: "12px",
      }}
    >
      <strong>Acoustic Risk Overlays</strong>

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={showEarlyReflectionRisk}
          onChange={(e) => setShowEarlyReflectionRisk(e.target.checked)}
        />
        Early Reflections (Side Walls)
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={showBassBuildUpRisk}
          onChange={(e) => setShowBassBuildUpRisk(e.target.checked)}
        />
        Bass Build-Up (Corners)
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={showRearWallRisk}
          onChange={(e) => setShowRearWallRisk(e.target.checked)}
        />
        Rear Wall Proximity
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={showCeilingRisk}
          onChange={(e) => setShowCeilingRisk(e.target.checked)}
        />
        Low Ceiling Risk
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={
            showEarlyReflectionRisk ||
            showBassBuildUpRisk ||
            showRearWallRisk ||
            showCeilingRisk
          }
          onChange={(e) => {
            const enabled = e.target.checked;
            setShowEarlyReflectionRisk(enabled);
            setShowBassBuildUpRisk(enabled);
            setShowRearWallRisk(enabled);
            setShowCeilingRisk(enabled);
          }}
        />
        Enable Acoustic Risk Overlays
      </label>

      <hr style={{ border: "none", borderTop: "1px solid #1F2937" }} />
    </div>
  </>
)}
{/* ---------- Stage 11.2 : Client Next Steps ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px solid #1F2937",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "12px",
    lineHeight: 1.5,
  }}
>
  <strong>Recommended Next Step</strong>

  {hasValidDimensions && (
  <p style={{ marginTop: "6px", opacity: 0.75 }}>
    {nextSteps}
  </p>
  )}


</div>

{/* ---------- Stage 11.3 : Export & Share ---------- */}
<div
  style={{
    background: "#020617",
    border: "1px dashed #334155",
    borderRadius: "10px",
    padding: "16px",
    fontSize: "12px",
    marginTop: "16px",
  }}
>
  <strong>Export & Share</strong>

{hasValidDimensions && (
  <p style={{ marginTop: "6px", opacity: 0.7 }}>
    This design summary is ready to be exported as a client-ready report.
  </p>
)}

{hasValidDimensions && (
  <ul style={{ marginTop: "8px", paddingLeft: "18px", opacity: 0.75 }}>
    <li>Room dimensions & feasibility</li>
    <li>Screen & seating analysis</li>
    <li>Speaker & subwoofer layout</li>
    <li>Acoustic risk & treatment recommendations</li>
  </ul>
)}

{hasValidDimensions && (
  <p style={{ marginTop: "10px", fontSize: "11px", opacity: 0.6 }}>
    PDF export and client sharing will be enabled in the next step.
  </p>
)}


{hasValidDimensions && (
  <>
    <button
      onClick={handleExportPDF}
      disabled={!hasValidDimensions}
      style={{
        width: "100%",
        padding: "12px",
        background: hasValidDimensions ? "#22C55E" : "#334155",
        color: hasValidDimensions ? "#022c22" : "#94A3B8",
        fontWeight: 700,
        cursor: hasValidDimensions ? "pointer" : "not-allowed",
      }}
    >
      Export PDF
    </button>
  </>
)}

</div>   {/* END RIGHT PANEL */}
</div>
</div>   {/* END MAIN GRID */}
</div>
);
};