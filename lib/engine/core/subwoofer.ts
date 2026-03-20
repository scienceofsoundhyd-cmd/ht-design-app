import { Room, Seat, Subwoofer, PhaseAlignment } from "./types";

const SPEED_OF_SOUND = 343;

export function calculatePhaseAlignment(
  sub: Subwoofer,
  speaker: { id: string; x: number; y: number },
  listener: Seat,
  frequency: number = 80
): PhaseAlignment {
  const wl = SPEED_OF_SOUND / frequency;

  const subDist = Math.sqrt(
    Math.pow(sub.x - listener.x, 2) + Math.pow(sub.y - listener.y, 2)
  );
  const spkDist = Math.sqrt(
    Math.pow(speaker.x - listener.x, 2) + Math.pow(speaker.y - listener.y, 2)
  );

  const diff = Math.abs(subDist - spkDist);

  return {
    subId: sub.id,
    distance: diff,
    phaseDifference: (diff / wl * 360) % 360,
    delaySuggestion: Number(((diff / SPEED_OF_SOUND) * 1000).toFixed(2)),
  };
}

export function createSubwoofer(
  room: Room,
  listener: Seat,
  position: "front-center" | "front-corner" | "rear-corner" | "mid-side" = "front-center"
): Subwoofer {
  let x: number, y: number;

  switch (position) {
    case "front-center": x = room.width / 2; y = 0.3; break;
    case "front-corner": x = 0.3;            y = 0.3; break;
    case "rear-corner":  x = 0.3;            y = room.length - 0.3; break;
    case "mid-side":     x = 0.3;            y = room.length / 2; break;
    default:             x = room.width / 2; y = 0.3;
  }

  const distance = Math.sqrt(
    Math.pow(x - listener.x, 2) + Math.pow(y - listener.y, 2)
  );

  return {
    id: `subwoofer-${position}`,
    type: "subwoofer",
    x,
    y,
    distance: Number(distance.toFixed(2)),
    frequency: 80,
  };
}

export function createDualSubwoofers(room: Room, listener: Seat): Subwoofer[] {
  return [
    createSubwoofer(room, listener, "front-corner"),
    createSubwoofer(room, listener, "rear-corner"),
  ];
}

export function calculateSBIR(
  subDistance: number,
  rearWallDistance: number
): { frequency: number; type: "null" | "peak" }[] {
  const reflectionPath = 2 * rearWallDistance;
  const pathDiff = reflectionPath - subDistance;
  const results: { frequency: number; type: "null" | "peak" }[] = [];

  for (let n = 1; n <= 5; n++) {
    const nullFreq = (SPEED_OF_SOUND * (2 * n - 1)) / (2 * pathDiff);
    const peakFreq = (SPEED_OF_SOUND * n) / pathDiff;
    results.push({ frequency: Number(nullFreq.toFixed(1)), type: "null" });
    results.push({ frequency: Number(peakFreq.toFixed(1)), type: "peak" });
  }

  return results.filter((r) => r.frequency < 200);
}