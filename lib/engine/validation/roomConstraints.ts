export type UnitSystem = "metric" | "imperial"

export type RoomDimensions = {
  width: number
  length: number
  height: number
}

/**
 * Hard maximum limits
 * Imperial:
 *  Length  ≤ 100 ft
 *  Width   ≤ 60 ft
 *  Height  ≤ 20 ft
 *
 * Metric equivalents:
 *  Length  ≤ 30.48 m
 *  Width   ≤ 18.288 m
 *  Height  ≤ 6.096 m
 */

const MAX_LIMITS_METRIC = {
  length: 30.48,
  width: 18.288,
  height: 6.096
}

const MAX_LIMITS_IMPERIAL = {
  length: 100,
  width: 60,
  height: 20
}

export function validateRoomDimensions(
  dims: RoomDimensions,
  unitSystem: UnitSystem
): {
  valid: boolean
  errors: string[]
} {

  const errors: string[] = []

  const max =
    unitSystem === "metric"
      ? MAX_LIMITS_METRIC
      : MAX_LIMITS_IMPERIAL

  if (dims.length <= 0) {
    errors.push("Length must be greater than 0.")
  } else if (dims.length > max.length) {
    errors.push(`Length exceeds maximum allowed (${max.length}).`)
  }

  if (dims.width <= 0) {
    errors.push("Width must be greater than 0.")
  } else if (dims.width > max.width) {
    errors.push(`Width exceeds maximum allowed (${max.width}).`)
  }

  if (dims.height <= 0) {
    errors.push("Height must be greater than 0.")
  } else if (dims.height > max.height) {
    errors.push(`Height exceeds maximum allowed (${max.height}).`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}