// Measurements of the squat rack and the back squat, shared by the rack model,
// the person's pose and the tests, so the bar sits on the person's back and
// their hands stay on it. In the rack's own coordinates: the uprights stand
// at the +z end, and you squat in front of them, facing them (+z).
import { HIP_Y, SHOULDER_Y, TORSO_RADIUS } from '../player/proportions'
import { machine } from './machineState'
import { repPhase } from '../interaction/reps'

export const SQUAT = {
  uprightZ: 0.25, // the two uprights
  uprightX: 0.6, // each upright, out from the middle
  height: 2.2,
  hooks: { y: 1.42, z: 0.15 }, // where the bar rests on the J-hooks
  safetyY: 0.85, // the safety arms, below the lowest the bar goes
  standZ: -0.2, // the person's feet, a step back from the hooks
  barRadius: 0.015,
  barLength: 2.2,
  gripX: 0.5, // each hand, out from the middle of the bar
  // Hips and torso at the top (standing tall) and at the bottom (thighs about
  // level with the floor, hips back, chest tipped forward but still up)
  top: { hipY: HIP_Y, hipZ: 0, lean: 0.05 },
  bottom: { hipY: 0.41, hipZ: -0.22, lean: 0.72 },
}

// The bar rests on the upper back: just above the shoulders, against the back
// of the torso. In the body's own coordinates (up the spine, forward), from the hips.
export const BAR_ON_BACK = { up: SHOULDER_Y - HIP_Y + 0.03, forward: -(TORSO_RADIUS + SQUAT.barRadius) }

const mix = (a: number, b: number, t: number) => a + (b - a) * t

// Everything about the squat at depth t (0 = standing, 1 = bottom):
//   rise: how far the hips have dropped (negative)   shift: how far back they've gone
//   lean: the torso's forward tip   bar: where the bar is, in the rack's coordinates
export function squatPosition(t: number) {
  const { top, bottom } = SQUAT
  const hipY = mix(top.hipY, bottom.hipY, t)
  const hipZ = mix(top.hipZ, bottom.hipZ, t)
  const lean = mix(top.lean, bottom.lean, t)
  // Tipping forward swings the bar (up the spine, behind it) forward and down
  const bar = {
    y: hipY + BAR_ON_BACK.up * Math.cos(lean) - BAR_ON_BACK.forward * Math.sin(lean),
    z: SQUAT.standZ + hipZ + BAR_ON_BACK.up * Math.sin(lean) + BAR_ON_BACK.forward * Math.cos(lean),
  }
  return { rise: hipY - HIP_Y, shift: hipZ, lean, bar }
}

// Where rack `id`'s bar should be right now: on the squatter's back during a
// set, otherwise on the hooks
export function barTarget(id: string, now = performance.now()) {
  if (machine.activeId !== id) return SQUAT.hooks
  return squatPosition(repPhase(machine.startedAt, now)).bar
}
