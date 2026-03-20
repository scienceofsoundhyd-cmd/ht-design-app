import { SpeakerConfiguration } from "../config/speakerConfigurations"

export type CeilingValidationResult = {
  configId: string
  allowed: boolean
  warning: boolean
  reason?: string
}

export function evaluateCeilingSuitability(
  roomHeightMeters: number,
  configurations: SpeakerConfiguration[]
): CeilingValidationResult[] {

  const HARD_MIN = 2.44        // 8 ft
  const WARNING_MIN = 2.7      // ~9 ft
  const HIGH_CEILING_MIN = 3   // ~10 ft

  return configurations.map(config => {

    // No ceiling channels → always allowed
    if (!config.requiresCeiling) {
      return {
        configId: config.id,
        allowed: true,
        warning: false
      }
    }

    // Below hard minimum
    if (roomHeightMeters < HARD_MIN) {
      return {
        configId: config.id,
        allowed: false,
        warning: false,
        reason: "Ceiling height below 8 ft minimum"
      }
    }

    // Requires high ceiling but not tall enough
    if (config.requiresHighCeiling && roomHeightMeters < HIGH_CEILING_MIN) {
      return {
        configId: config.id,
        allowed: false,
        warning: false,
        reason: "Very high ceiling required"
      }
    }

    // Warning zone
    if (roomHeightMeters < WARNING_MIN) {
      return {
        configId: config.id,
        allowed: true,
        warning: true,
        reason: "Low ceiling for height speakers"
      }
    }

    // Fully allowed
    return {
      configId: config.id,
      allowed: true,
      warning: false
    }
  })
}