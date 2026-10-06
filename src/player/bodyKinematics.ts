// "Forward kinematics": given a pose's joint angles, where do the hands and
// feet end up? It rebuilds the same chain of joints as <Person> (same order,
// same measurements from proportions.ts), so tests can check that hands meet
// handles and feet meet pedals without drawing anything.
import { Object3D, Vector3 } from 'three'
import { legJoints, type BodyPose } from './poseMath'
import {
  ELBOW_DROP,
  FOOT_DROP,
  HAND_DROP,
  HEAD_Y,
  HIP_X,
  HIP_Y,
  KNEE_DROP,
  SHOULDER_X,
  SHOULDER_Y,
} from './proportions'
import type { Rig } from './humanRig'

// Where the person's feet-origin stands (they face +z, unrotated)
type Origin = { x?: number; y?: number; z?: number }

// [left, right], plus the spine: from between the hips to between the shoulders
export type LimbEnds = {
  hands: [Vector3, Vector3]
  feet: [Vector3, Vector3]
  knees: [Vector3, Vector3]
  elbows: [Vector3, Vector3]
  spine: { hips: Vector3; shoulders: Vector3 }
  head: Vector3 // the middle of the head
}

const joint = (parent: Object3D, x: number, y: number, z = 0) => {
  const child = new Object3D()
  child.position.set(x, y, z)
  parent.add(child)
  return child
}

// The body's joints, fully settled into `pose` (as after the easing in
// <Person> has caught up), as a chain of objects under `root`. The same joints
// <Person> has, so the human model can be driven from either (see humanRig.ts).
export function buildBody(pose: BodyPose, origin: Origin = {}) {
  const root = new Object3D()
  // A sliding pose (the rower's seat) moves the whole body along z
  // (and squatting lowers it)
  root.position.set(origin.x ?? 0, (origin.y ?? 0) + (pose.rise ?? 0), (origin.z ?? 0) + (pose.shift ?? 0))

  // Posture pivots at hip height; everything inside leans with it
  const posture = joint(root, 0, HIP_Y)
  posture.rotation.x = pose.lean
  const body = joint(posture, 0, -HIP_Y)
  const neck = joint(body, 0, SHOULDER_Y)
  const head = joint(body, 0, HEAD_Y)

  const hips: Object3D[] = []
  const knees: Object3D[] = []
  const ankles: Object3D[] = []
  for (const side of [1, -1]) {
    const legs = pose.foot ? legJoints(pose.foot(side), pose.lean, side) : { hipX: 0, hipY: 0, hipZ: 0, knee: 0 }
    const hip = joint(body, side * HIP_X, HIP_Y)
    hip.rotation.set(legs.hipX, legs.hipY, legs.hipZ)
    const knee = joint(hip, 0, -KNEE_DROP)
    knee.rotation.x = legs.knee
    hips.push(hip)
    knees.push(knee)
    ankles.push(joint(knee, 0, -FOOT_DROP))
  }

  const shoulders: Object3D[] = []
  const elbows: Object3D[] = []
  const hands: Object3D[] = []
  for (const side of [1, -1]) {
    const angles = pose.arms(side)
    const shoulder = joint(body, side * SHOULDER_X, SHOULDER_Y)
    shoulder.rotation.set(angles.shoulderX, angles.shoulderY, angles.shoulderZ)
    const elbow = joint(shoulder, 0, -ELBOW_DROP)
    elbow.rotation.set(angles.elbowX, 0, angles.elbowZ)
    shoulders.push(shoulder)
    elbows.push(elbow)
    hands.push(joint(elbow, 0, -HAND_DROP))
  }

  root.updateMatrixWorld(true)
  const rig: Rig = { posture, hips, knees, ankles, shoulders, elbows }
  return { root, rig, neck, head, hands }
}

// Where the hands, feet and so on end up, in the same coordinates as `origin`
export function limbEnds(pose: BodyPose, origin: Origin = {}): LimbEnds {
  const { rig, neck, head, hands } = buildBody(pose, origin)
  const where = (point: Object3D) => point.getWorldPosition(new Vector3())
  return {
    hands: [where(hands[0]), where(hands[1])],
    feet: [where(rig.ankles[0]), where(rig.ankles[1])],
    knees: [where(rig.knees[0]), where(rig.knees[1])],
    elbows: [where(rig.elbows[0]), where(rig.elbows[1])],
    spine: { hips: where(rig.posture), shoulders: where(neck) },
    head: where(head),
  }
}
