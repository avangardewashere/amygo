// Measurements of the chest fly machine ("pec deck"), shared by the machine
// model, the person's pose and the tests, so its handles stay in your hands.
// In the machine's own coordinates: you sit facing +z.
import { ELBOW_DROP, HAND_DROP, HIP_Y, SHOULDER_X, SHOULDER_Y } from '../player/proportions'

export const FLY = {
  hipY: 0.5, // seat height (where the hips sit)
  hipZ: 0.1,
  open: 0.15, // arm sweep angle with arms open wide (radians)
  closed: 1.3, // arm sweep angle with hands together in front (~75°)
  pivotAbove: 0.5, // the machine's arms hang from pivots this far above your shoulders
}

// Shoulder height while seated
export const SEATED_SHOULDER_Y = FLY.hipY + (SHOULDER_Y - HIP_Y)

// Each machine arm pivots right above a shoulder, reaches out by an upper-arm's
// length (LEVER_REACH), then drops down to the handle (HANDLE_DROP below the
// pivot) — exactly where the hand is with the upper arm out and the forearm up
export const PIVOT_Y = SEATED_SHOULDER_Y + FLY.pivotAbove
export const LEVER_REACH = ELBOW_DROP
export const HANDLE_DROP = FLY.pivotAbove - HAND_DROP
export const HANDLE_FORWARD = 0.04 // the grip sits just in front of the bar, so the hand wraps it

// t: 0 = arms open (start of the rep), 1 = squeezed together
export const flyAngle = (t: number) => FLY.open + (FLY.closed - FLY.open) * t

// Where the middle of a handle is at point t of a rep. side: +1 left, −1 right.
// The left arm turns by −angle and the right by +angle around the pivot (the
// same sweep as the person's shoulders), so this is the handle's spot after
// turning by that angle.
export function handlePosition(side: number, t: number) {
  const turn = -side * flyAngle(t)
  const x = side * LEVER_REACH
  const z = HANDLE_FORWARD
  // Turning a point (x, z) around the vertical axis by `turn`
  return {
    x: side * SHOULDER_X + x * Math.cos(turn) + z * Math.sin(turn),
    y: PIVOT_Y - HANDLE_DROP,
    z: FLY.hipZ - x * Math.sin(turn) + z * Math.cos(turn),
  }
}
