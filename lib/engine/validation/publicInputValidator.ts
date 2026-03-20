export type ValidationErrorCode =
  | "INVALID_ROOM_DIMENSIONS"
  | "INVALID_SUB_POSITION"
  | "INVALID_LISTENER_POSITION"
  | "INVALID_EAR_HEIGHT"
  | "INVALID_NUMERIC_VALUE";

export type ValidationError = {
  code: ValidationErrorCode;
  field: string;
  message: string;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && isFinite(value) && !isNaN(value);
}

export function validatePublicSimulationInput(
  roomWidth: number,
  roomHeight: number,
  roomLength: number,
  subs: { x: number; y: number; z: number }[],
  seatingCenterX: number,
  seatingY: number,
  earHeight: number
): ValidationResult {
  const errors: ValidationError[] = [];

  const numericFields: { field: string; value: number }[] = [
    { field: "roomWidth",      value: roomWidth      },
    { field: "roomHeight",     value: roomHeight     },
    { field: "roomLength",     value: roomLength     },
    { field: "seatingCenterX", value: seatingCenterX },
    { field: "seatingY",       value: seatingY       },
    { field: "earHeight",      value: earHeight      },
  ];

  subs.forEach((sub, i) => {
    numericFields.push({ field: "subs[" + String(i) + "].x", value: sub.x });
    numericFields.push({ field: "subs[" + String(i) + "].y", value: sub.y });
    numericFields.push({ field: "subs[" + String(i) + "].z", value: sub.z });
  });

  for (const entry of numericFields) {
    if (!isFiniteNumber(entry.value)) {
      errors.push({
        code: "INVALID_NUMERIC_VALUE",
        field: entry.field,
        message: entry.field + " must be a finite number.",
      });
    }
  }

  if (isFiniteNumber(roomWidth) && (roomWidth < 2 || roomWidth > 20)) {
    errors.push({
      code: "INVALID_ROOM_DIMENSIONS",
      field: "roomWidth",
      message: "roomWidth must be between 2 and 20 metres.",
    });
  }

  if (isFiniteNumber(roomHeight) && (roomHeight < 2 || roomHeight > 6)) {
    errors.push({
      code: "INVALID_ROOM_DIMENSIONS",
      field: "roomHeight",
      message: "roomHeight must be between 2 and 6 metres.",
    });
  }

  if (isFiniteNumber(roomLength) && (roomLength < 2 || roomLength > 30)) {
    errors.push({
      code: "INVALID_ROOM_DIMENSIONS",
      field: "roomLength",
      message: "roomLength must be between 2 and 30 metres.",
    });
  }

  subs.forEach((sub, i) => {
    const idx = String(i);

    if (isFiniteNumber(sub.x) && isFiniteNumber(roomWidth) && (sub.x < 0 || sub.x > roomWidth)) {
      errors.push({
        code: "INVALID_SUB_POSITION",
        field: "subs[" + idx + "].x",
        message: "subs[" + idx + "].x must be between 0 and roomWidth (" + String(roomWidth) + ").",
      });
    }

    if (isFiniteNumber(sub.y) && isFiniteNumber(roomLength) && (sub.y < 0 || sub.y > roomLength)) {
      errors.push({
        code: "INVALID_SUB_POSITION",
        field: "subs[" + idx + "].y",
        message: "subs[" + idx + "].y must be between 0 and roomLength (" + String(roomLength) + ").",
      });
    }

    if (isFiniteNumber(sub.z) && isFiniteNumber(roomHeight) && (sub.z < 0 || sub.z > roomHeight)) {
      errors.push({
        code: "INVALID_SUB_POSITION",
        field: "subs[" + idx + "].z",
        message: "subs[" + idx + "].z must be between 0 and roomHeight (" + String(roomHeight) + ").",
      });
    }
  });

  if (isFiniteNumber(seatingCenterX) && isFiniteNumber(roomWidth) && (seatingCenterX < 0 || seatingCenterX > roomWidth)) {
    errors.push({
      code: "INVALID_LISTENER_POSITION",
      field: "seatingCenterX",
      message: "seatingCenterX must be between 0 and roomWidth (" + String(roomWidth) + ").",
    });
  }

  if (isFiniteNumber(seatingY) && isFiniteNumber(roomLength) && (seatingY < 0 || seatingY > roomLength)) {
    errors.push({
      code: "INVALID_LISTENER_POSITION",
      field: "seatingY",
      message: "seatingY must be between 0 and roomLength (" + String(roomLength) + ").",
    });
  }

  if (isFiniteNumber(earHeight) && earHeight < 0) {
    errors.push({
      code: "INVALID_EAR_HEIGHT",
      field: "earHeight",
      message: "earHeight must be greater than or equal to 0.",
    });
  }

  if (isFiniteNumber(earHeight) && isFiniteNumber(roomHeight) && earHeight > roomHeight) {
    errors.push({
      code: "INVALID_EAR_HEIGHT",
      field: "earHeight",
      message: "earHeight must not exceed roomHeight (" + String(roomHeight) + ").",
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}