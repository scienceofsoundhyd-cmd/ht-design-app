export type SpeakerLayoutEngine =
  | "dolby"
  | "auro"
  | "experimental"

export type SpeakerConfiguration = {
  id: string
  label: string
  engineType: SpeakerLayoutEngine
  baseChannels: number
  subwoofers: number
  heightChannels: number
  requiresCeiling: boolean
  requiresHighCeiling: boolean
  description: string
}

export const speakerConfigurations: SpeakerConfiguration[] = [

  // =========================
  // DOLBY STANDARD
  // =========================
  {
    id: "5.1",
    label: "5.1",
    engineType: "dolby",
    baseChannels: 5,
    subwoofers: 1,
    heightChannels: 0,
    requiresCeiling: false,
    requiresHighCeiling: false,
    description: "Suitable for small rooms"
  },
  {
    id: "7.1",
    label: "7.1",
    engineType: "dolby",
    baseChannels: 7,
    subwoofers: 1,
    heightChannels: 0,
    requiresCeiling: false,
    requiresHighCeiling: false,
    description: "Medium room recommended"
  },
  {
    id: "5.1.2",
    label: "5.1.2",
    engineType: "dolby",
    baseChannels: 5,
    subwoofers: 1,
    heightChannels: 2,
    requiresCeiling: true,
    requiresHighCeiling: false,
    description: "Entry Atmos configuration"
  },
  {
    id: "5.1.4",
    label: "5.1.4",
    engineType: "dolby",
    baseChannels: 5,
    subwoofers: 1,
    heightChannels: 4,
    requiresCeiling: true,
    requiresHighCeiling: false,
    description: "Balanced Atmos layout"
  },
  {
    id: "7.1.2",
    label: "7.1.2",
    engineType: "dolby",
    baseChannels: 7,
    subwoofers: 1,
    heightChannels: 2,
    requiresCeiling: true,
    requiresHighCeiling: false,
    description: "Surround enhanced Atmos"
  },
  {
    id: "7.1.4",
    label: "7.1.4",
    engineType: "dolby",
    baseChannels: 7,
    subwoofers: 1,
    heightChannels: 4,
    requiresCeiling: true,
    requiresHighCeiling: false,
    description: "Reference Atmos layout"
  },
  {
    id: "7.1.6",
    label: "7.1.6",
    engineType: "dolby",
    baseChannels: 7,
    subwoofers: 1,
    heightChannels: 6,
    requiresCeiling: true,
    requiresHighCeiling: true,
    description: "Large room with tall ceiling required"
  },
  {
    id: "9.1",
    label: "9.1",
    engineType: "dolby",
    baseChannels: 9,
    subwoofers: 1,
    heightChannels: 0,
    requiresCeiling: false,
    requiresHighCeiling: false,
    description: "Large room required"
  },
  {
    id: "9.1.4",
    label: "9.1.4",
    engineType: "dolby",
    baseChannels: 9,
    subwoofers: 1,
    heightChannels: 4,
    requiresCeiling: true,
    requiresHighCeiling: false,
    description: "Large room & Atmos ceiling required"
  },
  {
    id: "9.1.6",
    label: "9.1.6",
    engineType: "dolby",
    baseChannels: 9,
    subwoofers: 1,
    heightChannels: 6,
    requiresCeiling: true,
    requiresHighCeiling: true,
    description: "Very high ceiling required"
  },

  // =========================
  // AURO-3D
  // =========================
  {
    id: "auro-9.1",
    label: "Auro-3D 9.1",
    engineType: "auro",
    baseChannels: 9,
    subwoofers: 1,
    heightChannels: 4,
    requiresCeiling: true,
    requiresHighCeiling: false,
    description: "Height layer configuration"
  },
  {
    id: "auro-10.1",
    label: "Auro-3D 10.1 (VoG)",
    engineType: "auro",
    baseChannels: 10,
    subwoofers: 1,
    heightChannels: 5,
    requiresCeiling: true,
    requiresHighCeiling: true,
    description: "Voice of God channel included"
  },
  {
    id: "auro-13.1",
    label: "Auro-3D 13.1 (Reference)",
    engineType: "auro",
    baseChannels: 13,
    subwoofers: 1,
    heightChannels: 8,
    requiresCeiling: true,
    requiresHighCeiling: true,
    description: "Reference cinema requirements"
  },

  // =========================
  // EXTREME
  // =========================
  {
    id: "11.1.4",
    label: "11.1.4",
    engineType: "dolby",
    baseChannels: 11,
    subwoofers: 1,
    heightChannels: 4,
    requiresCeiling: true,
    requiresHighCeiling: true,
    description: "Not suitable for compact rooms"
  },
  {
    id: "11.2.4",
    label: "11.2.4",
    engineType: "dolby",
    baseChannels: 11,
    subwoofers: 2,
    heightChannels: 4,
    requiresCeiling: true,
    requiresHighCeiling: true,
    description: "Dual sub large room system"
  },
  {
    id: "22.2",
    label: "22.2 (NHK / Experimental)",
    engineType: "experimental",
    baseChannels: 22,
    subwoofers: 2,
    heightChannels: 0,
    requiresCeiling: false,
    requiresHighCeiling: true,
    description: "Experimental / research-grade only"
  }
]