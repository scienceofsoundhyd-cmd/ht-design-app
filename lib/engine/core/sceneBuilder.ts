import { ViewingStandard } from "./screen";
import {
  Room,
  RoomObject,
  ScreenObject,
  Seat,
  Speaker,
  Subwoofer,
  SceneObject,
  AxialMode,
  PhaseAlignment,
  SpeakerSystemType,
  RoomGeometry,
} from "./types";
import { buildRoomGeometry } from "./buildRoomGeometry";

// ── Exported config types ─────────────────────────────────────────────────────
export type LCRMode     = "stereo" | "lcr";
export type SurroundMode = "none" | "side" | "side_rear";
export type CeilingCount = 0 | 2 | 4 | 6;

export type SpeakerConfig = {
  lcr:          LCRMode;
  surrounds:    SurroundMode;
  ceilingCount: CeilingCount;
};

// ── Scene output type ─────────────────────────────────────────────────────────
export type AcousticScene = {
  room:             Room;
  geometry:         RoomGeometry;       // full three-stage pipeline
  objects:          SceneObject[];
  speakers:         Speaker[];
  listeners:        Seat[];
  phaseAlignments:  PhaseAlignment[];
  modes:            AxialMode[];
  schroederFrequency: number;
  systemType:       SpeakerSystemType;  // derived for downstream compat
};

// ─────────────────────────────────────────────────────────────────────────────

const SPEED_OF_SOUND = 343;

function computeModes(width: number, length: number, height: number): AxialMode[] {
  const axes: { axis: "x" | "y" | "z"; dim: number }[] = [
    { axis: "x", dim: width  },
    { axis: "y", dim: length },
    { axis: "z", dim: height },
  ];
  const result: AxialMode[] = [];
  for (const { axis, dim } of axes) {
    for (let n = 1; n <= 5; n++) {
      result.push({
        axis,
        order: n,
        frequency: (n * SPEED_OF_SOUND) / (2 * dim),
        type: "axial",
      });
    }
  }
  return result;
}

function computeSchroeder(rt60: number, volume: number): number {
  return 2000 * Math.sqrt(rt60 / volume);
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ── Derive legacy SpeakerSystemType for AcousticScene compat ─────────────────
function deriveSystemType(cfg: SpeakerConfig): SpeakerSystemType {
  if (cfg.ceilingCount > 0)           return "7.1.4";
  if (cfg.surrounds === "side_rear")  return "7.1";
  return "5.1";
}

// ─────────────────────────────────────────────────────────────────────────────
// buildScene
// ─────────────────────────────────────────────────────────────────────────────
export function buildScene(
  _standard:      ViewingStandard,
  speakerConfig:  SpeakerConfig,
  mountType:      "inWall" | "onWall"                   = "onWall",
  screenPlacement: "behindScreen" | "besideScreen"      = "behindScreen",
  seatingConfig: {
    rowCount:       number;
    seatsPerRow:    number;
    riserHeight:    number;
    seatType:       "standard" | "luxury";
    rowPitchM?:     number;
    frontClearance?: number;
    primaryRow?:    number;
  } = {
    rowCount:    1,
    seatsPerRow: 3,
    riserHeight: 0.3,
    seatType:    "standard",
  },
  screenConfig: {
    screenWidthMeters: number;
    screenHeight:      number;
    throwDistance:     number;
    aspectRatioMode:   "16:9" | "2.35:1" | "custom";
  } = {
    screenWidthMeters: 3,
    screenHeight:      1.69,
    throwDistance:     4.2,
    aspectRatioMode:   "16:9",
  },
  roomDims: {
    width:  number;
    length: number;
    height: number;
  } = { width: 6, length: 8, height: 2.8 },
  subConfig: {
    count:     number;
    placement: string;
    enclosure: "sealed" | "ported";
  } = { count: 1, placement: "frontWall", enclosure: "sealed" },
): AcousticScene {

  // ── Room + Geometry Pipeline ──────────────────────────────────────────────
  const room: Room = {
    width:  roomDims.width,
    length: roomDims.length,
    height: roomDims.height,
  };
  const { width, length, height } = room;
  const rt60   = 0.4;

  // Build three-stage geometry pipeline (Raw → Acoustic → Usable)
  const geometry = buildRoomGeometry({
    width,
    length,
    height,
    rt60,
  });
  const volume = geometry.raw.volume;

  // ── Layout constants ────────────────────────────────────────────────────────
  const SIDE_CLEARANCE    = 0.30;
  const frontAcousticDepth = 0.50;
  const rowDepth          = seatingConfig.rowPitchM  ?? 1.25;
  const frontClear        = seatingConfig.frontClearance ?? frontAcousticDepth + 0.80;

  // Speaker depth offset (on-wall proud vs in-wall flush)
  const speakerDepthOffset = mountType === "inWall" ? 0.05 : 0.15;

  // ── Room boundary object ────────────────────────────────────────────────────
  const roomObject: RoomObject = {
    id:     "room-0",
    type:   "room",
    x:      0,
    y:      0,
    width,
    height: length,
  };

  // ── Screen ─────────────────────────────────────────────────────────────────
  const screenOffsetDepth =
    mountType === "inWall" && screenPlacement === "behindScreen" ? 0.10 : 0;
  const screen: ScreenObject = {
    id:     "screen-0",
    type:   "screen",
    x:      (width - screenConfig.screenWidthMeters) / 2,
    y:      0.50 + screenOffsetDepth,
    width:  screenConfig.screenWidthMeters,
    height: screenConfig.screenHeight,
  };

  // ── Seating ─────────────────────────────────────────────────────────────────
  const seatWidth    = seatingConfig.seatType === "luxury" ? 0.75 : 0.60;
  const usableWidth  = width - 2 * SIDE_CLEARANCE;
  const seatSpacing  = usableWidth / seatingConfig.seatsPerRow;
  const firstRowY    = frontClear;

  const seats:     Seat[] = [];
  const listeners: Seat[] = [];

  const targetPrimaryRow = Math.max(0, Math.min(seatingConfig.primaryRow ?? 0, seatingConfig.rowCount - 1))
  for (let row = 0; row < seatingConfig.rowCount; row++) {
    const rowY = firstRowY + row * rowDepth;
    for (let s = 0; s < seatingConfig.seatsPerRow; s++) {
      const seatX = SIDE_CLEARANCE + s * seatSpacing + seatSpacing / 2;
      const id    = `seat-r${row}s${s}`;
      seats.push({ id, type: "seat", x: seatX, y: rowY });
      if (row === targetPrimaryRow && s === Math.floor(seatingConfig.seatsPerRow / 2)) {
        listeners.push({ id: `listener-${id}`, type: "seat", x: seatX, y: rowY });
      }
    }
  }

  const primarySeat: Seat = listeners[0] ?? seats[0] ?? {
    id: "seat-0", type: "seat" as const,
    x: width / 2, y: firstRowY,
  };

  // ── Subwoofer positions — match 3D subConfig placement logic ──────────────
  const subFreq = 80;
  const subFY   = 0.30;   // front wall Y
  const subRY   = length - 0.30;  // rear wall Y
  const subOff  = 0.38;  // corner offset

  type SubPos = { x: number; y: number };
  const subPositions: SubPos[] = []
  const sc = subConfig
  if (sc.count === 1 || sc.placement === "frontWall") {
    subPositions.push({ x: width / 2, y: subFY })
  } else if (sc.placement === "frontCorners") {
    subPositions.push({ x: subOff, y: subFY }, { x: width - subOff, y: subFY })
  } else if (sc.placement === "haas") {
    subPositions.push({ x: subOff, y: subFY }, { x: width - subOff, y: subFY }, { x: width / 2, y: subRY })
  } else if (sc.placement === "distributed") {
    subPositions.push({ x: subOff, y: subFY }, { x: width - subOff, y: subFY }, { x: subOff, y: subRY }, { x: width - subOff, y: subRY })
  } else {
    subPositions.push({ x: width / 2, y: subFY })
  }
  const activeSubs = subPositions.slice(0, sc.count)

  // Phase reference from first sub
  const refSub = activeSubs[0]
  const subDist = dist(refSub.x, refSub.y, primarySeat.x, primarySeat.y);
  const wavelength      = SPEED_OF_SOUND / subFreq;
  const phaseDifference = ((subDist / wavelength) * 360) % 360;
  const delaySuggestion = (subDist / SPEED_OF_SOUND) * 1000;

  const subwoofers: Subwoofer[] = activeSubs.map((pos, i) => ({
    id: `sub-${i}`, type: "subwoofer" as const,
    x: pos.x, y: pos.y,
    distance: dist(pos.x, pos.y, primarySeat.x, primarySeat.y),
    frequency: subFreq,
  }))
  // Keep legacy single-ref for phaseAlignment
  const subwoofer = subwoofers[0]
  const phaseAlignment: PhaseAlignment = {
    subId: subwoofer.id,
    distance: subDist,
    phaseDifference,
    delaySuggestion,
  };

  // ── Speaker positions ──────────────────────────────────────────────────────
  const { lcr, surrounds, ceilingCount } = speakerConfig;

  const frontY     = 0.50 + speakerDepthOffset;
  const screenW    = screenConfig.screenWidthMeters;
  const scrL       = (width - screenW) / 2;
  const scrR       = (width + screenW) / 2;

  // LCR X positions — beside-screen spreads L/R outside screen edges
  const flX = screenPlacement === "besideScreen"
    ? Math.max(0.12, scrL - 0.45)
    : Math.max(0.15, scrL - 0.10);
  const frX = screenPlacement === "besideScreen"
    ? Math.min(width - 0.12, scrR + 0.45)
    : Math.min(width - 0.15, scrR + 0.10);
  const cX  = width / 2;

  const speakers: Speaker[] = [];

  // ── Front stage ────────────────────────────────────────────────────────────
  speakers.push({ id: "spk-fl", type: "speaker", channel: "FL", x: flX, y: frontY });
  speakers.push({ id: "spk-fr", type: "speaker", channel: "FR", x: frX, y: frontY });
  if (lcr === "lcr") {
    speakers.push({ id: "spk-c", type: "speaker", channel: "C", x: cX, y: frontY });
  }

  // ── Side surrounds ────────────────────────────────────────────────────────
  // Primary pair only — at primary listener Z position.
  // Extra pairs for long rooms are handled by TheatreView3D's extraSidePairs loop.
  if (surrounds !== "none") {
    const slOffset = speakerDepthOffset + 0.04   // acoustic depth + mounting offset
    speakers.push({ id: "spk-sl", type: "speaker", channel: "SL", x: slOffset,           y: primarySeat.y });
    speakers.push({ id: "spk-sr", type: "speaker", channel: "SR", x: width - slOffset,   y: primarySeat.y });
  }

  // ── Rear surrounds ────────────────────────────────────────────────────────
  if (surrounds === "side_rear") {
    speakers.push({ id: "spk-rl", type: "speaker", channel: "RL", x: width * 0.25, y: length - 0.50 });
    speakers.push({ id: "spk-rr", type: "speaker", channel: "RR", x: width * 0.75, y: length - 0.50 });
  }

  // ── In-ceiling (Atmos) ────────────────────────────────────────────────────
  // 2 OH  → front pair only  (TFL / TFR)
  // 4 OH  → front + rear     (TFL / TFR / TRL / TRR)
  // 6 OH  → front + mid + rear (TFL / TFR / TML / TMR / TRL / TRR)
  if (ceilingCount >= 2) {
    // Front overhead — inside front third of room
    speakers.push({ id: "spk-tfl", type: "speaker", channel: "TFL", x: width * 0.26, y: length * 0.22 });
    speakers.push({ id: "spk-tfr", type: "speaker", channel: "TFR", x: width * 0.74, y: length * 0.22 });
  }
  if (ceilingCount >= 4) {
    // Rear overhead — inside rear third of room
    speakers.push({ id: "spk-trl", type: "speaker", channel: "TRL", x: width * 0.26, y: length * 0.73 });
    speakers.push({ id: "spk-trr", type: "speaker", channel: "TRR", x: width * 0.74, y: length * 0.73 });
  }
  if (ceilingCount === 6) {
    // Mid overhead — geometric centre of room (TML / TMR per Dolby Atmos spec)
    speakers.push({ id: "spk-tml", type: "speaker", channel: "TML", x: width * 0.26, y: length * 0.50 });
    speakers.push({ id: "spk-tmr", type: "speaker", channel: "TMR", x: width * 0.74, y: length * 0.50 });
  }

  // ── Objects list ────────────────────────────────────────────────────────────
  const objects: SceneObject[] = [
    roomObject,
    screen,
    ...seats,
    ...subwoofers,
    ...speakers,
  ];

  // ── Physics ─────────────────────────────────────────────────────────────────
  const modes              = computeModes(width, length, height);
  const schroederFrequency = computeSchroeder(rt60, volume);
  const systemType         = deriveSystemType(speakerConfig);

  return {
    room,
    geometry,
    objects,
    speakers,
    listeners,
    phaseAlignments:   [phaseAlignment],
    modes,
    schroederFrequency,
    systemType,
  };
}