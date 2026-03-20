import { Room, Seat, ScreenObject } from "./types"

export type ViewingStandard = "SMPTE" | "THX" | "IMMERSIVE"

function getViewingAngle(standard: ViewingStandard): number {
  switch (standard) {
    case "SMPTE":     return 30
    case "THX":       return 40
    case "IMMERSIVE": return 50
    default:          return 40
  }
}

export function createScreen(
  room: Room,
  primarySeat: Seat,
  standard: ViewingStandard
): ScreenObject {
  const angle = getViewingAngle(standard)
  const angleRad = (angle / 2) * (Math.PI / 180)
  const screenWidth = 2 * primarySeat.y * Math.tan(angleRad)
  const screenHeight = screenWidth * 0.56

  return {
    id: "screen",
    type: "screen",
    x: room.width / 2 - screenWidth / 2,
    y: 0.2,
    width: screenWidth,
    height: screenHeight
  }
}