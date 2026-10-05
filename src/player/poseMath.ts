// The person's pose maths: what every joint should do for each exercise, and
// the leg "inverse kinematics". Pure functions with no drawing, so they can be
// tested (see poseMath.test.ts) and shared by <Person> and bodyKinematics.ts.
import type { Activity } from '../interaction/gymStore'
import { PRESS, pressDistance } from '../equipment/legPressGeometry'
import { LYING_HIP, SEATED_HIP } from '../equipment/benchGeometry'
import { FLY, flyAngle } from '../equipment/chestFlyGeometry'
import { FOOT_DROP, KNEE_DROP, SHOE_Y } from './proportions'

const FEET_FORWARD = 0.38 // seated: feet planted this far in front of the hips

// Target angles (radians) for one arm, at the shoulder and elbow joints:
//   shoulderX swings the arm forward (−) / back (+)
//   shoulderZ lifts it out to the side (+ for the left arm, − for the right)
//   shoulderY sweeps a raised arm toward the front (used for the chest fly)
//   elbowX bends the forearm forward, like a curl (−)
//   elbowZ bends the forearm up, when the upper arm is out to the side
export type ArmPose = { shoulderX: number; shoulderY: number; shoulderZ: number; elbowX: number; elbowZ: number }
export const arm = (pose: Partial<ArmPose>): ArmPose => ({
  shoulderX: 0,
  shoulderY: 0,
  shoulderZ: 0,
  elbowX: 0,
  elbowZ: 0,
  ...pose,
})

// The whole body for one moment of an exercise:
//   lean: how far the body tips back at the hips (−π/2 = lying flat)
//   foot: where the feet go, relative to the hips (z forward, y up); null = walking legs
//   arms: the pose of each arm; side is +1 for the left, −1 for the right
export type BodyPose = { lean: number; foot: { z: number; y: number } | null; arms: (side: number) => ArmPose }

// Sitting upright with both feet flat on the floor in front
const seatedFeet = (hipY: number) => ({ z: FEET_FORWARD, y: SHOE_Y - hipY })

// Every exercise as a body pose. t: where in the rep (0 → 1 → 0, see reps.ts).
// Exercises not listed (walking and running on the treadmill) use the walking pose.
export function exercisePose(activity: Pick<Activity, 'kind'>, t: number): BodyPose | null {
  switch (activity.kind) {
    case 'curl':
      // Upper arms stay by the sides; only the elbows bend, bringing the weights up
      return { lean: 0, foot: null, arms: () => arm({ shoulderX: 0.12, elbowX: -(0.2 + 2.0 * t) }) }
    case 'lateral':
      // Arms lift out sideways to shoulder height, elbows soft
      return { lean: 0, foot: null, arms: (s) => arm({ shoulderX: 0.1, shoulderZ: s * (0.15 + 1.3 * t), elbowX: -0.3 }) }
    case 'legPress': {
      // Reclined, feet on the sled; hands holding the handles beside the seat.
      // (Leaning back swings hanging arms forward; shoulderX brings them back down.)
      const d = pressDistance(t)
      return {
        lean: -PRESS.lean,
        foot: { z: PRESS.dirZ * d, y: PRESS.dirY * d },
        arms: (s) => arm({ shoulderX: 0.6, shoulderZ: s * 0.12, elbowX: -0.5 }),
      }
    }
    case 'benchPress':
      // Lying flat on your back, feet on the floor. t = 0: arms straight up
      // toward the ceiling; t = 1: weights lowered to the chest, elbows out to
      // the sides, forearms pointing up.
      return {
        lean: -Math.PI / 2,
        foot: { z: 0.35, y: SHOE_Y - LYING_HIP.y },
        arms: (s) => arm({ shoulderX: -1.55 * (1 - t), shoulderZ: s * 1.45 * t, elbowX: -0.05 - 1.55 * t }),
      }
    case 'shoulderPress':
      // Seated upright. t = 0: weights at shoulder height (upper arms out to the
      // sides, forearms up); t = 1: pressed straight overhead.
      return {
        lean: 0,
        foot: seatedFeet(SEATED_HIP.y),
        arms: (s) => arm({ shoulderZ: s * (1.5 + 1.35 * t), elbowZ: s * (1.6 - 1.4 * t) }),
      }
    case 'chestFly':
      // Seated upright, upper arms raised out to the sides and forearms up,
      // holding the handles. The rep sweeps the arms together in front of the
      // chest; the machine's arms use the very same sweep angle (flyAngle).
      return {
        lean: 0,
        foot: seatedFeet(FLY.hipY),
        arms: (s) => arm({ shoulderZ: s * (Math.PI / 2), shoulderY: -s * flyAngle(t), elbowZ: s * (Math.PI / 2) }),
      }
    default:
      return null
  }
}

// ---------- Leg maths ----------

// Keep an angle between -π and π, so easing always takes the short way round
export const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

// A limb hanging straight down has rotation 0. This is the rotation that points
// it along a direction instead (z = forward, y = up).
const pointAlong = (z: number, y: number) => Math.atan2(-z, -y)

// "Inverse kinematics" for one leg: given where the foot must be (relative to
// the hip; z forward, y up), work out how to bend the hip and knee to reach it.
// Returns the thigh's and shin's rotations as seen from the room.
export function reachWithFoot(z: number, y: number) {
  // Can't reach further than a straight leg
  const distance = Math.hypot(z, y)
  const reach = Math.min(distance, KNEE_DROP + FOOT_DROP - 0.001)
  const footZ = (z / distance) * reach
  const footY = (y / distance) * reach
  // Law of cosines: the angle at the hip between the thigh and the hip→foot line
  const hipBend = Math.acos((KNEE_DROP ** 2 + reach ** 2 - FOOT_DROP ** 2) / (2 * KNEE_DROP * reach))
  // Bend so the knee goes up and forward (not backward through the seat)
  const thighAngle = Math.atan2(footY, footZ) + hipBend
  const kneeZ = KNEE_DROP * Math.cos(thighAngle)
  const kneeY = KNEE_DROP * Math.sin(thighAngle)
  return {
    thigh: pointAlong(Math.cos(thighAngle), Math.sin(thighAngle)),
    shin: pointAlong(footZ - kneeZ, footY - kneeY),
  }
}

// Hip and knee joint angles that put a foot on its spot. The hips sit inside
// the leaning body, so the body's current lean is subtracted to get the hip
// angle relative to it.
export function legAngles(foot: { z: number; y: number }, lean: number) {
  const { thigh, shin } = reachWithFoot(foot.z, foot.y)
  return { hip: wrap(thigh - lean), knee: wrap(shin - thigh) }
}
