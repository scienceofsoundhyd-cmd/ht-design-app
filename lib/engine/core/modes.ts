import { Room, AxialMode } from "./types"
import { SPEED_OF_SOUND } from "./units"

function calculateAxialModes(room: Room): AxialMode[] {
  const modes: AxialMode[] = []
  const dims = [
    { axis: "x" as const, length: room.width },
    { axis: "y" as const, length: room.length },
    { axis: "z" as const, length: room.height }
  ]
  dims.forEach(({ axis, length }) => {
    for (let n = 1; n <= 8; n++) {
      modes.push({
        axis, order: n,
        frequency: Number(((n * SPEED_OF_SOUND) / (2 * length)).toFixed(1)),
        type: "axial"
      })
    }
  })
  return modes
}

function calculateTangentialModes(room: Room): AxialMode[] {
  const modes: AxialMode[] = []
  const c = SPEED_OF_SOUND
  const { length: L, width: W, height: H } = room

  const pairs = [
    { axis: "x" as const, dims: [W, L] },
    { axis: "x" as const, dims: [W, H] },
    { axis: "y" as const, dims: [L, H] }
  ]

  pairs.forEach(({ axis, dims }) => {
    for (let nx = 1; nx <= 4; nx++) {
      for (let ny = 1; ny <= 4; ny++) {
        const freq = (c / 2) * Math.sqrt(
          Math.pow(nx / dims[0], 2) + Math.pow(ny / dims[1], 2)
        )
        if (freq < 300) {
          modes.push({ axis, order: nx * 10 + ny, frequency: Number(freq.toFixed(1)), type: "tangential" })
        }
      }
    }
  })
  return modes
}

function calculateObliqueModes(room: Room): AxialMode[] {
  const modes: AxialMode[] = []
  const c = SPEED_OF_SOUND
  const { length: L, width: W, height: H } = room

  for (let nx = 1; nx <= 3; nx++) {
    for (let ny = 1; ny <= 3; ny++) {
      for (let nz = 1; nz <= 3; nz++) {
        const freq = (c / 2) * Math.sqrt(
          Math.pow(nx / W, 2) + Math.pow(ny / L, 2) + Math.pow(nz / H, 2)
        )
        if (freq < 300) {
          modes.push({ axis: "x", order: nx * 100 + ny * 10 + nz, frequency: Number(freq.toFixed(1)), type: "oblique" })
        }
      }
    }
  }
  return modes
}

function calculateSchroederFrequency(room: Room): number {
  const volume = room.width * room.length * room.height
  return Number((2000 * Math.sqrt(0.4 / volume)).toFixed(1))
}

export function calculateAllModes(room: Room): {
  modes: AxialMode[]
  schroederFrequency: number
  modeDensity: { frequency: number; count: number }[]
} {
  const allModes = [
    ...calculateAxialModes(room),
    ...calculateTangentialModes(room),
    ...calculateObliqueModes(room)
  ].sort((a, b) => a.frequency - b.frequency)

  const schroeder = calculateSchroederFrequency(room)

  const modeDensity: { frequency: number; count: number }[] = []
  for (let freq = 20; freq < 300; freq += 10) {
    modeDensity.push({
      frequency: freq,
      count: allModes.filter(m => m.frequency >= freq && m.frequency < freq + 10).length
    })
  }

  return { modes: allModes, schroederFrequency: schroeder, modeDensity }
}

export function findModeClusters(modes: AxialMode[]) {
  const clusters: { frequency: number; count: number; modes: AxialMode[] }[] = []
  const tolerance = 3

  modes.forEach(mode => {
    const existing = clusters.find(c => Math.abs(c.frequency - mode.frequency) < tolerance)
    if (existing) {
      existing.count++
      existing.modes.push(mode)
      existing.frequency = (existing.frequency + mode.frequency) / 2
    } else {
      clusters.push({ frequency: mode.frequency, count: 1, modes: [mode] })
    }
  })

  return clusters.filter(c => c.count >= 3).sort((a, b) => b.count - a.count)
}