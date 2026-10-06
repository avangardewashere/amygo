// Measurements of the cable machine and its two exercises, shared by the
// machine model, the person's poses and the tests, so the cable always ends in
// the person's hands. In the machine's own coordinates: the tower stands at
// the +z end and you face it (+z).
import type { ExerciseKind } from '../interaction/gymStore'
import { ELBOW_DROP, HAND_DROP, HIP_Y, SHOULDER_X, SHOULDER_Y } from '../player/proportions'
import { machine } from './machineState'

type Spot = { y: number; z: number }

export const CABLE = {
  frontZ: 0.5, // the tower's front face
  high: { y: 2.15, z: 0.45 }, // the high pulley (pushdowns)
  low: { y: 0.62, z: 0.45 }, // the low pulley (rows)
  pushdown: {
    standZ: -0.05, // standing a step back from the tower
    lean: 0.15, // leaning slightly into it
    upperArm: 0.05, // upper arms hang almost straight down, pinned at the sides
    // The forearm's angle from hanging straight down: a little above level at
    // the top, nearly straight at the bottom
    forearmTop: 1.8,
    forearmBottom: 0.12,
  },
  row: {
    hipY: 0.45, // on the low seat
    hipZ: -0.55,
    foot: { y: 0.3, z: 0.22 }, // on the footplate
    leanReach: 0.2, // reaching forward at the start
    leanPulled: -0.05, // sitting tall at the end
    handleY: 0.7, // the handle travels level, at stomach height
    gripX: 0.06, // hands close together on the V-handle
    pulledZ: -0.33, // the handle at the stomach
  },
  ropeDrop: 0.12, // the rope's middle (where the cable clips on) hangs this far above the hands
}

const rise = SHOULDER_Y - HIP_Y // hips to shoulders
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// Shoulder position (side view) for hips at `hip`, leaning by `lean`
export const shoulderAt = (hip: Spot, lean: number) => ({
  y: hip.y + rise * Math.cos(lean),
  z: hip.z + rise * Math.sin(lean),
})

// Tricep pushdown at t (0 = forearms up, 1 = pushed down): the elbows stay
// pinned at the sides and only the forearms turn
export function pushdownArm(t: number) {
  const { standZ, lean, upperArm, forearmTop, forearmBottom } = CABLE.pushdown
  const shoulder = shoulderAt({ y: HIP_Y, z: standZ }, lean)
  const elbow = { y: shoulder.y - ELBOW_DROP * Math.cos(upperArm), z: shoulder.z + ELBOW_DROP * Math.sin(upperArm) }
  const forearm = mix(forearmTop, forearmBottom, t)
  const hand = { y: elbow.y - HAND_DROP * Math.cos(forearm), z: elbow.z + HAND_DROP * Math.sin(forearm) }
  return { shoulder, elbow, hand }
}

// Seated cable row at t (0 = reaching forward, arms straight; 1 = handle pulled
// to the stomach)
export function rowPosition(t: number) {
  const { hipY, hipZ, leanReach, leanPulled, handleY, gripX, pulledZ } = CABLE.row
  const lean = mix(leanReach, leanPulled, t)
  const reach = shoulderAt({ y: hipY, z: hipZ }, leanReach)
  // At full reach the arms are straight (1 cm short, so the elbows aren't locked)
  const out = SHOULDER_X - gripX
  const dy = handleY - reach.y
  const reachZ = reach.z + Math.sqrt((ELBOW_DROP + HAND_DROP - 0.01) ** 2 - dy ** 2 - out ** 2)
  return { lean, shoulder: shoulderAt({ y: hipY, z: hipZ }, lean), handle: { y: handleY, z: mix(reachZ, pulledZ, t) } }
}

// Which pulley each exercise uses
export const pulleyFor = (kind: ExerciseKind) => (kind === 'pushdown' ? CABLE.high : CABLE.low)

// Where the cable ends (the rope's middle, or the row handle) at t
export function cableEnd(kind: ExerciseKind, t: number): Spot {
  if (kind !== 'pushdown') return rowPosition(t).handle
  // The rope's middle sits between the hands, a little toward the pulley
  const { hand } = pushdownArm(t)
  const toY = CABLE.high.y - hand.y
  const toZ = CABLE.high.z - hand.z
  const length = Math.hypot(toY, toZ)
  return { y: hand.y + (toY / length) * CABLE.ropeDrop, z: hand.z + (toZ / length) * CABLE.ropeDrop }
}

const cableLength = (kind: ExerciseKind, t: number) => {
  const pulley = pulleyFor(kind)
  const end = cableEnd(kind, t)
  return Math.hypot(end.y - pulley.y, end.z - pulley.z)
}

// How far the weight stack has risen: exactly as much cable as has been pulled
// out of the pulley since the start of the rep
export const stackLift = (kind: ExerciseKind, t: number) => Math.max(cableLength(kind, t) - cableLength(kind, 0), 0)

// Which cable exercise machine `id` is running, if any
export const activeCable = (id: string) => (machine.activeId === id ? machine.exercise : null)
