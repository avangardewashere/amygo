// Driving the human model (public/models/man.glb) with our joint maths.
//
// The model comes with its own skeleton of bones. We don't animate those
// directly: the body's joints (the same ones <Person> and bodyKinematics.ts
// use) are posed as always, and each frame every mapped bone is turned to
// point the way its joint points. Measurements in proportions.ts were taken
// from this model, so the bones and joints are the same lengths and the
// model's hands and feet land where the joints say.
import { Box3, Quaternion, Vector3, type Bone, type Object3D } from 'three'
import { ELBOW_DROP, HAND_DROP, HIP_X, HIP_Y, KNEE_DROP, SHOULDER_X, SHOULDER_Y } from './proportions'

// The body's joints, [left, right] where there are two (left = +x)
export type Rig = {
  posture: Object3D // leans the whole body, pivoting at the hips
  hips: Object3D[]
  knees: Object3D[]
  ankles: Object3D[] // the foot point (the heel)
  shoulders: Object3D[]
  elbows: Object3D[]
}

// Which bone follows which joint (the loader drops the dots from Blender's
// names: "UpperLeg.L" becomes "UpperLegL")
export const BONE_FOR = {
  posture: 'Body',
  hips: ['UpperLegL', 'UpperLegR'],
  knees: ['LowerLegL', 'LowerLegR'],
  ankles: ['FootL', 'FootR'],
  shoulders: ['UpperArmL', 'UpperArmR'],
  elbows: ['LowerArmL', 'LowerArmR'],
} as const
// The bone each limb bone points at, to find which way the limb runs at rest
const POINTS_AT: Record<string, string> = {
  UpperLegL: 'LowerLegL',
  UpperLegR: 'LowerLegR',
  LowerLegL: 'FootL',
  LowerLegR: 'FootR',
  UpperArmL: 'LowerArmL',
  UpperArmR: 'LowerArmR',
  LowerArmL: 'PalmL',
  LowerArmR: 'PalmR',
}

// Every bone this file uses: the ones joints drive, plus the ones it measures
const NEEDED = [
  ...Object.values(BONE_FOR).flat(),
  ...Object.values(POINTS_AT),
  'Torso',
  'MiddleHandL',
  'MiddleHandR',
]
export const missingBones = (names: string[]) => [...new Set(NEEDED)].filter((name) => !names.includes(name))

export const MODEL_HEIGHT = 1.8 // meters, the same as the classic person

const DOWN = new Vector3(0, -1, 0)

// One bone and how it follows its joint: `turn` is the bone's rest
// orientation relative to the joint's (with limbs straightened to hang
// straight down, the way our joints hang at rest); `offset` is where it sits
// in the joint's own coordinates (only for bones placed by position too)
type Drive = { bone: Bone; joint: (rig: Rig) => Object3D; turn: Quaternion; offset?: Vector3 }

export type HumanModel = { scene: Object3D; bones: Record<string, Bone>; drives: Drive[] }

// Size and place the model so its hips sit where ours do (facing +z), and work
// out how each bone follows its joint. `scene` must not be in the scene graph yet.
// fitToBody: false leaves the bones as the model's artist made them (only
// scaled and placed), to compare the model with our measurements.
export function prepareModel(scene: Object3D, { fitToBody = true } = {}): HumanModel {
  const bones: Record<string, Bone> = {}
  scene.traverse((object) => {
    if ((object as Bone).isBone) bones[object.name] = object as Bone
    // Bones move the mesh beyond its resting bounds; don't let it vanish at the edge of view
    object.frustumCulled = false
  })
  // A different model (or a renamed bone) would otherwise fail somewhere obscure
  const missing = missingBones(Object.keys(bones))
  if (missing.length) throw new Error(`The human model is missing bones: ${missing.join(', ')}`)

  // Scale to 1.8 m tall, then line the hip joints up with ours and the spine with z = 0
  scene.position.set(0, 0, 0)
  scene.scale.setScalar(1)
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene, true)
  scene.scale.setScalar(MODEL_HEIGHT / (box.max.y - box.min.y))
  scene.updateMatrixWorld(true)
  const at = (name: string) => bones[name].getWorldPosition(new Vector3())
  const hips = at('UpperLegL').add(at('UpperLegR')).multiplyScalar(0.5)
  const spineZ = at('Torso').z
  scene.position.set(-hips.x, HIP_Y - hips.y, -spineZ)
  scene.updateMatrixWorld(true)

  // Fit each limb to our exact lengths (the model's right arm, for one, is a
  // little shorter than its left; our body is the same on both sides). Moving a
  // bone a centimeter or two only stretches the skin a touch.
  const fit = (name: string, next: string, length: number) => {
    const child = bones[next]
    child.position.multiplyScalar(length / at(name).distanceTo(at(next)))
    scene.updateMatrixWorld(true)
  }
  // Put the shoulder and hip joints exactly where ours are (the model's sit a
  // couple of centimeters off, and every bone below would carry that offset)
  const place = (name: string, x: number, y: number) => {
    const bone = bones[name]
    bone.position.copy(bone.parent!.worldToLocal(new Vector3(x, y, 0)))
    scene.updateMatrixWorld(true)
  }
  for (const [side, sign] of fitToBody ? ([['L', 1], ['R', -1]] as const) : []) {
    place(`UpperArm${side}`, sign * SHOULDER_X, SHOULDER_Y)
    place(`UpperLeg${side}`, sign * HIP_X, HIP_Y)
  }
  for (const side of fitToBody ? ['L', 'R'] : []) {
    fit(`UpperLeg${side}`, `LowerLeg${side}`, KNEE_DROP)
    fit(`UpperArm${side}`, `LowerArm${side}`, ELBOW_DROP)
    // Elbow → middle of the palm: move the wrist so the palm's middle lands at HAND_DROP
    const wrist = at(`LowerArm${side}`).distanceTo(at(`Palm${side}`))
    const grip = at(`LowerArm${side}`).distanceTo(handMiddle(bones, side))
    fit(`LowerArm${side}`, `Palm${side}`, wrist + HAND_DROP - grip)
  }

  // The joints at rest: every joint is unturned, so its orientation is the
  // body's own; the posture pivot sits at (0, HIP_Y, 0)
  const restTurn = (name: string) => bones[name].getWorldQuaternion(new Quaternion())
  const limb = (name: string) => {
    // Turn the bone so the way it runs (toward the next bone) hangs straight
    // down. A forearm aims at the middle of the hand, not the wrist: the palm
    // sits a little off the forearm's line, and the grip is what must land on
    // our forearm's line (at HAND_DROP).
    const toward = name.startsWith('LowerArm') ? handMiddle(bones, name.slice(-1)) : at(POINTS_AT[name])
    const runs = toward.sub(at(name)).normalize()
    return new Quaternion().setFromUnitVectors(runs, DOWN).multiply(restTurn(name))
  }
  const drives: Drive[] = [
    {
      bone: bones[BONE_FOR.posture],
      joint: (rig) => rig.posture,
      turn: restTurn(BONE_FOR.posture),
      offset: at(BONE_FOR.posture).sub(new Vector3(0, HIP_Y, 0)),
    },
  ]
  for (const i of [0, 1]) {
    drives.push({ bone: bones[BONE_FOR.hips[i]], joint: (rig) => rig.hips[i], turn: limb(BONE_FOR.hips[i]) })
    drives.push({ bone: bones[BONE_FOR.knees[i]], joint: (rig) => rig.knees[i], turn: limb(BONE_FOR.knees[i]) })
    // The feet hang off the skeleton's root in this model, not off the shins,
    // so they're placed at the foot point as well as turned
    drives.push({
      bone: bones[BONE_FOR.ankles[i]],
      joint: (rig) => rig.ankles[i],
      turn: restTurn(BONE_FOR.ankles[i]),
      offset: new Vector3(),
    })
    drives.push({ bone: bones[BONE_FOR.shoulders[i]], joint: (rig) => rig.shoulders[i], turn: limb(BONE_FOR.shoulders[i]) })
    drives.push({ bone: bones[BONE_FOR.elbows[i]], joint: (rig) => rig.elbows[i], turn: limb(BONE_FOR.elbows[i]) })
  }
  return { scene, bones, drives }
}

const turnNow = new Quaternion()
const parentTurn = new Quaternion()
const spot = new Vector3()

// Pose the model like the joints: each bone gets its joint's orientation
// (times its rest turn), in parent-first order so each one builds on the last
export function poseModel(model: HumanModel, rig: Rig) {
  for (const { bone, joint, turn, offset } of model.drives) {
    const target = joint(rig)
    target.updateWorldMatrix(true, false)
    bone.parent!.updateWorldMatrix(true, false)
    target.getWorldQuaternion(turnNow).multiply(turn)
    bone.parent!.getWorldQuaternion(parentTurn)
    bone.quaternion.copy(parentTurn.invert().multiply(turnNow))
    if (offset) {
      spot.copy(offset)
      target.localToWorld(spot)
      bone.position.copy(bone.parent!.worldToLocal(spot))
    }
    bone.updateMatrixWorld(true)
  }
}

// The middle of the palm (where a hand grips): halfway from the wrist to the knuckles
function handMiddle(bones: Record<string, Bone>, side: string) {
  const wrist = bones[`Palm${side}`].getWorldPosition(new Vector3())
  return wrist.lerp(bones[`MiddleHand${side}`].getWorldPosition(new Vector3()), 0.5)
}

// Where the model's hand grips and its foot point are (side 0 = left)
export const modelHand = (model: HumanModel, side: 0 | 1) => handMiddle(model.bones, side === 0 ? 'L' : 'R')
export const modelFoot = (model: HumanModel, side: 0 | 1) =>
  model.bones[BONE_FOR.ankles[side]].getWorldPosition(new Vector3())
