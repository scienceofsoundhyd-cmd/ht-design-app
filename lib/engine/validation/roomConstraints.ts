export type UnitSystem = "metric" | "imperial"

export type RoomDimensions = {
  width: number
  length: number
  height: number
}

/**
 * NOTE: dims are ALWAYS in metres regardless of unitSystem.
 * unitSystem is used only to format error messages.
 *
 * Hard minimum limits (master spec: 12' × 10' × 8')
 *   Length  ≥ 3.6576 m  (12 ft)
 *   Width   ≥ 3.048  m  (10 ft)
 *   Height  ≥ 2.4384 m  ( 8 ft)
 *
 * Hard maximum limits
 *   Length  ≤ 30.48  m  (100 ft)
 *   Width   ≤ 18.288 m  ( 60 ft)
 *   Height  ≤  6.096 m  ( 20 ft)
 */

const MIN_M = { length: 3.6576, width: 3.048,  height: 2.4384 }
const MAX_M = { length: 30.48,  width: 18.288, height: 6.096  }

// Friendly display: metric shows metres, imperial shows feet
function fmtM (m: number, imperial: boolean) {
  if (imperial) {
    const ft = Math.round(m * 3.28084)
    return `${ft} ft`
  }
  return `${m} m`
}

export function validateRoomDimensions(
  dims: RoomDimensions,   // always in metres
  unitSystem: UnitSystem
): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const imp = unitSystem === "imperial"

  if (dims.length <= 0) {
    errors.push("Length must be greater than 0.")
  } else if (dims.length < MIN_M.length) {
    errors.push(`Length must be at least ${fmtM(MIN_M.length, imp)} (minimum 12 ft).`)
  } else if (dims.length > MAX_M.length) {
    errors.push(`Length exceeds maximum allowed (${fmtM(MAX_M.length, imp)}).`)
  }

  if (dims.width <= 0) {
    errors.push("Width must be greater than 0.")
  } else if (dims.width < MIN_M.width) {
    errors.push(`Width must be at least ${fmtM(MIN_M.width, imp)} (minimum 10 ft).`)
  } else if (dims.width > MAX_M.width) {
    errors.push(`Width exceeds maximum allowed (${fmtM(MAX_M.width, imp)}).`)
  }

  if (dims.height <= 0) {
    errors.push("Height must be greater than 0.")
  } else if (dims.height < MIN_M.height) {
    errors.push(`Height must be at least ${fmtM(MIN_M.height, imp)} (minimum 8 ft).`)
  } else if (dims.height > MAX_M.height) {
    errors.push(`Height exceeds maximum allowed (${fmtM(MAX_M.height, imp)}).`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
