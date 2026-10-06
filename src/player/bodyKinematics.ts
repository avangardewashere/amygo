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

// The body fully settled into `pose` (joints at their targets, as after the
// easing in <Person> has caught up). Returns the middle of each hand and the
// middle of each shoe (and the spine), in the same coordinates as `origin`.
export function limbEnds(pose: BodyPose, origin: Origin = {}): LimbEnds {
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

  const kneeJoints: Object3D[] = []
  const feet = [1, -1].map((side) => {
    const legs = pose.foot ? legJoints(pose.foot(side), pose.lean, side) : { hipX: 0, hipY: 0, hipZ: 0, knee: 0 }
    const hip = joint(body, side * HIP_X, HIP_Y)
    hip.rotation.set(legs.hipX, legs.hipY, legs.hipZ)
    const knee = joint(hip, 0, -KNEE_DROP)
    knee.rotation.x = legs.knee
    kneeJoints.push(knee)
    return joint(knee, 0, -FOOT_DROP)
  })

  const elbowJoints: Object3D[] = []
  const hands = [1, -1].map((side) => {
    const angles = pose.arms(side)
    const shoulder = joint(body, side * SHOULDER_X, SHOULDER_Y)
    shoulder.rotation.set(angles.shoulderX, angles.shoulderY, angles.shoulderZ)
    const elbow = joint(shoulder, 0, -ELBOW_DROP)
    elbow.rotation.set(angles.elbowX, 0, angles.elbowZ)
    elbowJoints.push(elbow)
    return joint(elbow, 0, -HAND_DROP)
  })

  root.updateMatrixWorld(true)
  const where = (point: Object3D) => point.getWorldPosition(new Vector3())
  return {
    hands: [where(hands[0]), where(hands[1])],
    feet: [where(feet[0]), where(feet[1])],
    knees: [where(kneeJoints[0]), where(kneeJoints[1])],
    elbows: [where(elbowJoints[0]), where(elbowJoints[1])],
    spine: { hips: where(posture), shoulders: where(neck) },
    head: where(head),
  }
}
