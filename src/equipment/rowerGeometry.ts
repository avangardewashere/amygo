// Measurements and stroke timing of the rowing machine, shared by the machine
// model, the person's pose and the tests, so the seat, feet and handle all
// line up. In the rower's own coordinates: you sit facing +z (the flywheel).
import { HIP_Y, SHOULDER_Y } from '../player/proportions'

export const ROWER = {
  hipY: 0.45, // hips on the sliding seat
  foot: { y: 0.25, z: 0.55 }, // middle of each shoe, strapped to the footplates
  // Hip-to-foot distance at the "catch" (knees bent, seat forward) and the
  // "finish" (legs pushed almost straight, seat back)
  catchReach: 0.45,
  finishReach: 0.81,
  // Torso: leaning forward at the catch, slightly back at the finish (radians)
  leanCatch: 0.35,
  leanFinish: -0.3,
  handleY: 0.62, // the handle is pulled level, just above the knees
  armStraight: 0.58, // shoulder-to-hand distance with the arms reaching forward
  pulledIn: 0.18, // how far in front of the shoulders the handle ends up (at the ribs)
  chainExit: { y: 0.62, z: 1.0 }, // where the chain comes out of the flywheel housing
  strokeSeconds: 2.4, // one full stroke (25 strokes a minute)
  driveShare: 0.35, // the pull takes about a third of the stroke; the slide back the rest
  speed: 500 / 120, // m/s: a 2:00 per 500 m pace
}

// 0 → 1 with gentle ends, for parts of the body that start and stop smoothly
const ease = (x: number) => {
  const c = Math.min(Math.max(x, 0), 1)
  return c * c * (3 - 2 * c)
}

// How far through its own movement each body part is, at `seconds` into
// rowing: 0 = catch position (forward, bent), 1 = finish (back, pulled in).
//   Drive (pull):    legs push first, then the back swings, then the arms pull
//   Recovery (slide back): the reverse: arms out, then back, then legs bend
export function strokeState(seconds: number) {
  const phase = (seconds / ROWER.strokeSeconds) % 1
  if (phase < ROWER.driveShare) {
    const d = phase / ROWER.driveShare
    return { legs: ease(d / 0.5), back: ease((d - 0.3) / 0.4), arms: ease((d - 0.6) / 0.4) }
  }
  const r = (phase - ROWER.driveShare) / (1 - ROWER.driveShare)
  return { arms: 1 - ease(r / 0.4), back: 1 - ease((r - 0.3) / 0.4), legs: 1 - ease((r - 0.5) / 0.5) }
}

export const strokesSince = (seconds: number) => Math.floor(seconds / ROWER.strokeSeconds)

// Everything about the rower and its rower at one moment:
//   hipZ: where the hips (and seat) are along the rail
//   lean: the torso's tilt (positive = forward)
//   handle: where the handle is
export function rowerPosition(seconds: number) {
  const { legs, back, arms } = strokeState(seconds)
  // Seat position: push the hips away from the feet as the legs straighten
  const reach = ROWER.catchReach + (ROWER.finishReach - ROWER.catchReach) * legs
  const drop = ROWER.hipY - ROWER.foot.y
  const hipZ = ROWER.foot.z - Math.sqrt(reach ** 2 - drop ** 2)
  const lean = ROWER.leanCatch + (ROWER.leanFinish - ROWER.leanCatch) * back
  // Shoulders sit on top of the leaning torso
  const rise = SHOULDER_Y - HIP_Y
  const shoulder = { y: ROWER.hipY + rise * Math.cos(lean), z: hipZ + rise * Math.sin(lean) }
  // Handle: at arm's length in front of the shoulders, pulled in toward the ribs by the arms
  const height = shoulder.y - ROWER.handleY
  const armsOut = Math.sqrt(ROWER.armStraight ** 2 - height ** 2)
  const handle = { y: ROWER.handleY, z: shoulder.z + armsOut + (ROWER.pulledIn - armsOut) * arms }
  return { hipZ, lean, shoulder, handle }
}
