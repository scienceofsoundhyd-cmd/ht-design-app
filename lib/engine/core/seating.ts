import { Room, Seat } from "./types"

export function createPrimarySeat(room: Room): Seat {
  return {
    id: "seat-primary",
    type: "seat",
    x: room.width / 2,
    y: room.length * 0.38
  }
}