import { beforeAll, describe, expect, it } from 'vitest'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Vector3, type Bone, type Object3D } from 'three'
// The model file itself, embedded by Vite as text (base64)
import manGlb from '../../public/models/man.glb?inline'
import { exercisePose } from './poseMath'
import { buildBody } from './bodyKinematics'
import { BONE_FOR, missingBones, modelFoot, modelHand, poseModel, prepareModel, type HumanModel } from './humanRig'
import { ELBOW_DROP, FOOT_DROP, HAND_DROP, HIP_X, HIP_Y, KNEE_DROP, SHOULDER_X, SHOULDER_Y } from './proportions'
import { EXERCISES, type ExerciseKind } from '../interaction/gymStore'

// Load the real model file, the same one the browser loads
async function loadModel(): Promise<Object3D> {
  const bytes = Uint8Array.from(atob(manGlb.split(',')[1]), (c) => c.charCodeAt(0))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '')
  return gltf.scene
}

// A fresh model placed in its own space, with a body to drive it
async function freshModel() {
  const model = prepareModel(await loadModel())
  return model
}

let asMade: HumanModel // the model exactly as its artist made it, only scaled and placed

const at = (model: HumanModel, name: string) => {
  model.scene.updateMatrixWorld(true)
  return model.bones[name].getWorldPosition(new Vector3())
}

// Checked on the file itself, before anything is prepared (a missing bone would
// stop the preparing used by the other tests)
describe('human model file', () => {
  it('V5B2-T1: every joint our poses use has a bone in the model', async () => {
    const names: string[] = []
    ;(await loadModel()).traverse((object) => {
      if ((object as Bone).isBone) names.push(object.name)
    })
    expect(missingBones(names)).toEqual([])
    // …including one bone for each joint, both sides
    const joints = [BONE_FOR.posture, ...BONE_FOR.hips, ...BONE_FOR.knees, ...BONE_FOR.ankles, ...BONE_FOR.shoulders, ...BONE_FOR.elbows]
    expect(joints).toHaveLength(11)
  })
})

describe('human model', () => {
  beforeAll(async () => {
    asMade = prepareModel(await loadModel(), { fitToBody: false })
  })

  it("V5B2-T3: our body measurements are the model's own (within 2 cm, before any fitting)", () => {
    // Measured on the model as made (fitting would make it match any numbers).
    // The left side: the model's right arm is a little shorter, and our body is symmetric.
    const m = asMade
    const d = (a: string, b: string) => at(m, a).distanceTo(at(m, b))
    expect(Math.abs(d('UpperLegL', 'LowerLegL') - KNEE_DROP)).toBeLessThan(0.02)
    expect(Math.abs(d('LowerLegL', 'FootL') - FOOT_DROP)).toBeLessThan(0.02)
    expect(Math.abs(d('UpperArmL', 'LowerArmL') - ELBOW_DROP)).toBeLessThan(0.02)
    expect(Math.abs(at(m, 'LowerArmL').distanceTo(modelHand(m, 0)) - HAND_DROP)).toBeLessThan(0.02)
    expect(Math.abs(at(m, 'UpperLegL').x - HIP_X)).toBeLessThan(0.02)
    expect(Math.abs(at(m, 'UpperLegL').y - HIP_Y)).toBeLessThan(0.02)
    expect(Math.abs(at(m, 'UpperArmL').x - SHOULDER_X)).toBeLessThan(0.02)
    expect(Math.abs(at(m, 'UpperArmL').y - SHOULDER_Y)).toBeLessThan(0.02)
  })

  it("V5B2-T2: in every exercise, the model's hands and feet land within 1 cm of the joints'", async () => {
    const model = await freshModel()
    for (const kind of Object.keys(EXERCISES) as ExerciseKind[]) {
      for (const t of [0, 0.5, 1]) {
        const pose = exercisePose({ kind }, t, 0.9)
        if (!pose) continue // walking legs: nothing planted
        const { root, rig, hands } = buildBody(pose)
        // The model stands in the same space as the body
        root.add(model.scene)
        root.updateMatrixWorld(true)
        poseModel(model, rig)
        for (const side of [0, 1] as const) {
          const hand = hands[side].getWorldPosition(modelHand(model, side).clone())
          expect(modelHand(model, side).distanceTo(hand), `${kind} t=${t} hand ${side}`).toBeLessThan(0.01)
          if (pose.foot) {
            const foot = rig.ankles[side].getWorldPosition(modelFoot(model, side).clone())
            expect(modelFoot(model, side).distanceTo(foot), `${kind} t=${t} foot ${side}`).toBeLessThan(0.01)
          }
        }
        root.remove(model.scene)
      }
    }
  })
})
