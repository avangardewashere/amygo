// The person's pose maths: what every joint should do for each exercise, and
// the leg "inverse kinematics". Pure functions with no drawing, so they can be
// tested (see poseMath.test.ts) and shared by <Person> and bodyKinematics.ts.
import { Euler, Matrix4, Vector3 } from 'three'
import type { Activity } from '../interaction/gymStore'
import { PRESS, pressDistance } from '../equipment/legPressGeometry'
import { LYING_HIP, SEATED_HIP } from '../equipment/benchGeometry'
import { FLY, flyAngle } from '../equipment/chestFlyGeometry'
import { BIKE, crankAngle, footOnPedal } from '../equipment/bikeGeometry'
import { ROWER, rowerPosition } from '../equipment/rowerGeometry'
import { ADJ, hipsAgainstBackrest, leanFor } from '../equipment/adjustableBenchGeometry'
import { BAR_ON_BACK, SQUAT, squatPosition } from '../equipment/squatGeometry'
import { CABLE, pushdownArm, rowPosition as cableRowPosition } from '../equipment/cableGeometry'
import { PULLUP, pullupPosition } from '../equipment/pullupGeometry'
import { ELBOW_DROP, FOOT_DROP, HAND_DROP, HIP_Y, KNEE_DROP, SHOE_Y, SHOULDER_X, SHOULDER_Y } from './proportions'

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
//   lean: how far the body tips at the hips: positive forward (bike), negative
//         back (leg press; −π/2 = lying flat on the bench)
//   foot: where each foot goes, relative to the hips (z forward, y up); null = walking legs
//   arms: the pose of each arm
//   follow: hands or feet must keep up with a moving machine part (pedals,
//           a sled, handles), so joints track their targets closely instead
//           of easing in gently
//   shift: slide the whole body forward (+) / back (−) from where it was
//          placed, in meters (the rower's sliding seat, hips going back in a squat)
//   rise: lift (+) / lower (−) the whole body, in meters (squatting down)
//   flatFeet: keep the shoes flat on the floor however the shins tip
// side is +1 for the left, −1 for the right
type Spot = { z: number; y: number }
export type BodyPose = {
  lean: number
  foot: ((side: number) => Spot) | null
  arms: (side: number) => ArmPose
  follow?: boolean
  shift?: number
  rise?: number
  flatFeet?: boolean
}

// Sitting upright with both feet flat on the floor in front
const seatedFeet = (hipY: number) => () => ({ z: FEET_FORWARD, y: SHOE_Y - hipY })

// Pressing dumbbells away from the chest, relative to the body (so lying flat
// it presses at the ceiling, and on an incline it presses up along the incline).
// t = 0: arms straight out from the chest; t = 1: weights lowered beside the
// chest, elbows out to the sides, forearms pointing the way you press.
const pressArms = (t: number) => (s: number) =>
  arm({ shoulderX: -1.55 * (1 - t), shoulderZ: s * 1.45 * t, elbowX: -0.05 - 1.55 * t })

// Curling: upper arms hang down by the sides (tucked back by `tuck`), only the
// elbows bend, bringing the weights up
const curlArms = (t: number, tuck: number) => () => arm({ shoulderX: tuck, elbowX: -(0.2 + 2.0 * t) })

// Every exercise as a body pose. t: where in the rep (0 → 1 → 0, see reps.ts);
// seconds: time since starting (for things that keep going round, like pedals).
// Exercises not listed (walking and running on the treadmill) use the walking pose.
// seconds: at the current pace; activity.pace carries the pedals' angle from before a pace change.
export function exercisePose(
  activity: Pick<Activity, 'kind'> & Partial<Pick<Activity, 'pace'>>,
  t: number,
  seconds = 0,
): BodyPose | null {
  switch (activity.kind) {
    case 'curl':
      return { lean: 0, foot: null, arms: curlArms(t, 0.12) }
    case 'lateral':
      // Arms lift out sideways to shoulder height, elbows soft
      return { lean: 0, foot: null, arms: (s) => arm({ shoulderX: 0.1, shoulderZ: s * (0.15 + 1.3 * t), elbowX: -0.3 }) }
    case 'legPress': {
      // Reclined, feet on the sled; hands holding the handles beside the seat.
      // (Leaning back swings hanging arms forward; shoulderX brings them back down.)
      const d = pressDistance(t)
      return {
        lean: -PRESS.lean,
        follow: true,
        foot: () => ({ z: PRESS.dirZ * d, y: PRESS.dirY * d }),
        arms: (s) => arm({ shoulderX: 0.6, shoulderZ: s * 0.12, elbowX: -0.5 }),
      }
    }
    case 'benchPress':
      // Lying flat on your back, feet on the floor, pressing at the ceiling
      return { lean: -Math.PI / 2, foot: () => ({ z: 0.35, y: SHOE_Y - LYING_HIP.y }), arms: pressArms(t) }
    case 'inclinePress': {
      // Back on the 45° backrest, so the same press goes up and forward
      const { incline } = ADJ.angles
      return { lean: leanFor(incline), foot: seatedFeet(hipsAgainstBackrest(incline).y), arms: pressArms(t) }
    }
    case 'seatedCurl': {
      // Sitting against the upright backrest. It tilts the body back a little,
      // so the upper arms tuck forward by the same amount to hang straight down.
      const lean = leanFor(ADJ.angles.upright)
      return { lean, foot: seatedFeet(hipsAgainstBackrest(ADJ.angles.upright).y), arms: curlArms(t, 0.05 - lean) }
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
        follow: true,
        foot: seatedFeet(FLY.hipY),
        arms: (s) => arm({ shoulderZ: s * (Math.PI / 2), shoulderY: -s * flyAngle(t), elbowZ: s * (Math.PI / 2) }),
      }
    case 'ride':
    case 'sprint':
      return bikePose(activity.kind === 'sprint' ? 'sprint' : 'easy', seconds, activity.pace?.crank ?? 0)
    case 'row':
      return rowPose(seconds)
    case 'squat':
      return squatPose(t)
    case 'pushdown':
      return pushdownPose(t)
    case 'cableRow':
      return cableRowPose(t)
    case 'pullup':
      return pullupPose(t)
    default:
      return null
  }
}

// Back squat: the hips drop and go back, the torso tips forward, the feet stay
// flat where they are. The bar rides on the upper back, so relative to the
// body it never moves, and neither do the arms holding it.
function squatPose(t: number): BodyPose {
  const { rise, shift, lean } = squatPosition(t)
  return {
    lean,
    rise,
    shift,
    follow: true,
    flatFeet: true,
    // Feet stay where they started: straight under where the hips were
    foot: () => ({ z: -shift, y: SHOE_Y - (HIP_Y + rise) }),
    arms: (side) =>
      armTo3D(side, {
        x: side * (SQUAT.gripX - SHOULDER_X),
        y: HIP_Y + BAR_ON_BACK.up - SHOULDER_Y,
        z: BAR_ON_BACK.forward,
      }),
  }
}

// Tricep pushdown: standing, leaning slightly into the tower. The upper arms
// stay pinned at the sides; the hands follow the rope (pushdownArm), so only
// the forearms turn.
function pushdownPose(t: number): BodyPose {
  const { lean } = CABLE.pushdown
  const { shoulder, hand } = pushdownArm(t)
  const grip = reachWithHand(hand.z - shoulder.z, hand.y - shoulder.y)
  return {
    lean,
    follow: true,
    foot: null,
    arms: () => arm({ shoulderX: wrap(grip.upper - lean), elbowX: wrap(grip.lower - grip.upper) }),
  }
}

// Pull-up: the whole body hangs off the floor (rise) and is lifted toward the
// bar; the hands stay on the bar and the arms fold under them, elbows flaring
// out and down. Legs hang with the knees slightly bent.
function pullupPose(t: number): BodyPose {
  const { rise, lean } = pullupPosition(t)
  const shoulder = {
    y: HIP_Y + rise + (SHOULDER_Y - HIP_Y) * Math.cos(lean),
    z: PULLUP.standZ + (SHOULDER_Y - HIP_Y) * Math.sin(lean),
  }
  return {
    lean,
    rise,
    follow: true,
    foot: () => PULLUP.feet,
    arms: (side) => armTo3D(side, inBody(PULLUP.gripX * side - SHOULDER_X * side, PULLUP.bar, shoulder, lean), { out: 1.2, back: 0.3 }),
  }
}

// A spot measured from the shoulder (side view), turned into the leaning
// body's own directions (up its spine, forward from its chest)
function inBody(x: number, spot: Spot, shoulder: Spot, lean: number) {
  const dy = spot.y - shoulder.y
  const dz = spot.z - shoulder.z
  return { x, y: dy * Math.cos(lean) + dz * Math.sin(lean), z: -dy * Math.sin(lean) + dz * Math.cos(lean) }
}

// Seated cable row: feet on the footplate, both hands on the V-handle, which
// comes in to the stomach while the torso goes from reaching to sitting tall
function cableRowPose(t: number): BodyPose {
  const { hipY, hipZ, foot, gripX } = CABLE.row
  const { lean, shoulder, handle } = cableRowPosition(t)
  // The handle measured from the shoulder, turned into the leaning body's own directions
  const dy = handle.y - shoulder.y
  const dz = handle.z - shoulder.z
  const up = dy * Math.cos(lean) + dz * Math.sin(lean)
  const forward = -dy * Math.sin(lean) + dz * Math.cos(lean)
  return {
    lean,
    follow: true,
    foot: () => ({ z: foot.z - hipZ, y: foot.y - hipY }),
    // Elbows drop and draw back past the sides as the handle comes in
    arms: (side) => armTo3D(side, { x: side * (gripX - SHOULDER_X), y: up, z: forward }, { out: 0.25, back: 0.6 }),
  }
}

// On the rower: the seat slides (shift), the feet stay strapped to the
// footplates, and the hands hold the handle. rowerPosition() says where the
// hips, torso and handle are at this moment of the stroke.
function rowPose(seconds: number): BodyPose {
  const { hipZ, lean, shoulder, handle } = rowerPosition(seconds)
  const grip = reachWithHand(handle.z - shoulder.z, handle.y - shoulder.y)
  return {
    lean,
    follow: true,
    shift: hipZ, // the person is placed with their hips at z = 0 on the rail
    foot: () => ({ z: ROWER.foot.z - hipZ, y: ROWER.foot.y - ROWER.hipY }),
    arms: () => arm({ shoulderX: wrap(grip.upper - lean), elbowX: wrap(grip.lower - grip.upper) }),
  }
}

// On the bike: leaning forward, each foot on its pedal going round, hands on
// the handlebars. Feet and hands are worked out with the two-bone maths below.
function bikePose(pace: 'easy' | 'sprint', seconds: number, crankBefore = 0): BodyPose {
  const lean = BIKE.lean[pace]
  const angle = crankBefore + crankAngle(BIKE.cadence[pace], seconds)
  // Leaning forward moves the shoulders forward and down; find where they are
  const rise = SHOULDER_Y - HIP_Y
  const shoulder = { z: BIKE.hipZ + rise * Math.sin(lean), y: BIKE.hipY + rise * Math.cos(lean) }
  const grip = reachWithHand(BIKE.bar.z - shoulder.z, BIKE.bar.y - shoulder.y)
  return {
    lean,
    follow: true,
    foot: (side) => {
      const foot = footOnPedal(side, angle)
      return { z: foot.z - BIKE.hipZ, y: foot.y - BIKE.hipY }
    },
    // Shoulders sit inside the leaning body, so subtract the lean (as for hips)
    arms: () => arm({ shoulderX: wrap(grip.upper - lean), elbowX: wrap(grip.lower - grip.upper) }),
  }
}

// ---------- Arm maths in 3D ----------

// Joint angles that put one hand on a spot anywhere around its shoulder (x out
// to the side, y up, z forward; relative to the shoulder, in the body's own
// coordinates). The elbow is free to sit anywhere on a circle, so it's
// pointed as far down as it can go (and, by `hint.out`, out to the side, and
// by `hint.back`, back), the way you'd hold a bar on your back.
export function armTo3D(
  side: number,
  hand: { x: number; y: number; z: number },
  hint = { out: 0.5, back: 0 },
): ArmPose {
  const target = new Vector3(hand.x, hand.y, hand.z)
  const distance = Math.min(target.length(), ELBOW_DROP + HAND_DROP - 0.001)
  const toHand = target.clone().normalize()
  // The elbow circle: its middle sits `along` the line to the hand, `radius` out from it
  const along = (distance ** 2 + ELBOW_DROP ** 2 - HAND_DROP ** 2) / (2 * distance)
  const radius = Math.sqrt(Math.max(ELBOW_DROP ** 2 - along ** 2, 0))
  const toward = new Vector3(side * hint.out, -1, -hint.back)
  const sideways = toward.sub(toHand.clone().multiplyScalar(toward.dot(toHand))).normalize()
  const elbow = toHand.clone().multiplyScalar(along).add(sideways.multiplyScalar(radius))
  const upper = elbow.clone().normalize()
  const fore = toHand.clone().multiplyScalar(distance).sub(elbow).normalize()

  // The shoulder's own axes: the arm hangs along its −y, and the elbow (a
  // hinge about its x) folds the forearm within its y–z plane
  const y = upper.clone().negate()
  let x = new Vector3().crossVectors(y, fore).normalize()
  let z = new Vector3().crossVectors(x, y)
  // Fold the elbow the natural way (forearm toward the front of the arm)
  if (fore.dot(z) < 0) {
    x = x.negate()
    z = new Vector3().crossVectors(x, y)
  }
  const shoulder = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z))
  return arm({
    shoulderX: shoulder.x,
    shoulderY: shoulder.y,
    shoulderZ: shoulder.z,
    elbowX: Math.atan2(-fore.dot(z), -fore.dot(y)),
  })
}

// ---------- Leg maths ----------

// Keep an angle between -π and π, so easing always takes the short way round
export const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

// A limb hanging straight down has rotation 0. This is the rotation that points
// it along a direction instead (z = forward, y = up).
const pointAlong = (z: number, y: number) => Math.atan2(-z, -y)

// "Inverse kinematics" for a two-part limb (thigh + shin, or upper arm +
// forearm): given where its end must be (relative to the joint it hangs from;
// z forward, y up), work out the angle of each part. Returns both parts'
// rotations as seen from the room.
//   bend +1: the middle joint goes up and forward (a knee)
//   bend −1: it goes down and back (an elbow reaching forward)
function twoBoneReach(z: number, y: number, first: number, second: number, bend: 1 | -1) {
  // Can't reach further than the limb held straight
  const distance = Math.hypot(z, y)
  const reach = Math.min(distance, first + second - 0.001)
  const endZ = (z / distance) * reach
  const endY = (y / distance) * reach
  // Law of cosines: the angle at the top joint between the first part and the line to the end
  const topBend = Math.acos((first ** 2 + reach ** 2 - second ** 2) / (2 * first * reach))
  const firstAngle = Math.atan2(endY, endZ) + bend * topBend
  const middleZ = first * Math.cos(firstAngle)
  const middleY = first * Math.sin(firstAngle)
  return {
    upper: pointAlong(Math.cos(firstAngle), Math.sin(firstAngle)),
    lower: pointAlong(endZ - middleZ, endY - middleY),
  }
}

// One leg: bend so the knee goes up and forward (not backward through the seat)
export function reachWithFoot(z: number, y: number) {
  const { upper, lower } = twoBoneReach(z, y, KNEE_DROP, FOOT_DROP, 1)
  return { thigh: upper, shin: lower }
}

// One arm reaching forward: the elbow drops below the line to the hand
export const reachWithHand = (z: number, y: number) => twoBoneReach(z, y, ELBOW_DROP, HAND_DROP, -1)

// Hip and knee joint angles that put a foot on its spot. The hips sit inside
// the leaning body, so the body's current lean is subtracted to get the hip
// angle relative to it.
export function legAngles(foot: { z: number; y: number }, lean: number) {
  const { thigh, shin } = reachWithFoot(foot.z, foot.y)
  return { hip: wrap(thigh - lean), knee: wrap(shin - thigh) }
}
