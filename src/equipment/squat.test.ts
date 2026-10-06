import { describe, expect, it } from 'vitest'
import { exercisePose, legAngles } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { HIP_X, SHOE_Y, TORSO_RADIUS } from '../player/proportions'
import { getGym, menuActions, setNearFurniture, stopExercise } from '../interaction/gymStore'
import { SQUAT, barTarget, squatPosition } from './squatGeometry'

// The squatter stands on the floor a step back from the hooks
const standing = { z: SQUAT.standZ }
// 25 moments from standing (t = 0) down to the bottom (t = 1)
const DEPTHS = Array.from({ length: 25 }, (_, i) => i / 24)
const poseAt = (t: number) => exercisePose({ kind: 'squat' }, t)!

describe('squat rack', () => {
  it('V3B1-T1: the feet stay planted where they started, through the whole rep', () => {
    for (const t of DEPTHS) {
      const { feet } = limbEnds(poseAt(t), standing)
      ;[1, -1].forEach((side, i) => {
        const start = { x: side * HIP_X, y: SHOE_Y, z: SQUAT.standZ }
        const foot = feet[i]
        expect(Math.hypot(foot.x - start.x, foot.y - start.y, foot.z - start.z)).toBeLessThan(0.02)
      })
    }
  })

  it('V3B1-T2: the bar stays on the upper back, and both hands stay on the bar', () => {
    for (const t of DEPTHS) {
      const { hands, spine } = limbEnds(poseAt(t), standing)
      const { bar, lean } = squatPosition(t)
      ;[1, -1].forEach((side, i) => {
        const grip = { x: side * SQUAT.gripX, y: bar.y, z: bar.z }
        expect(Math.hypot(hands[i].x - grip.x, hands[i].y - grip.y, hands[i].z - grip.z)).toBeLessThan(0.03)
      })
      // The bar measured from between the shoulders, in the leaning body's own
      // directions: just above the shoulders, resting against the back
      const dy = bar.y - spine.shoulders.y
      const dz = bar.z - spine.shoulders.z
      const up = dy * Math.cos(lean) + dz * Math.sin(lean)
      const forward = -dy * Math.sin(lean) + dz * Math.cos(lean)
      expect(up).toBeGreaterThan(0)
      expect(up).toBeLessThan(0.08)
      expect(Math.abs(forward + TORSO_RADIUS + SQUAT.barRadius)).toBeLessThan(0.01)
    }
  })

  it('V3B1-T3: the bottom reaches thighs about level, and the knees never bend backward', () => {
    const bottom = limbEnds(poseAt(1), standing)
    for (const knee of bottom.knees) {
      // Thigh about level: knee within 6 cm of hip height
      expect(Math.abs(knee.y - bottom.spine.hips.y)).toBeLessThan(0.06)
      // …and the knees go forward over the feet, not back
      expect(knee.z).toBeGreaterThan(SQUAT.standZ)
    }
    for (const t of DEPTHS) {
      const pose = poseAt(t)
      for (const side of [1, -1]) {
        // A knee bends one way only (positive); negative would be bending backward
        expect(legAngles(pose.foot!(side), pose.lean).knee).toBeGreaterThanOrEqual(-0.01)
      }
    }
  })

  it('V3B1-T4: the bar comes off the hooks for a set, and goes back on them when you stop', () => {
    expect(barTarget('squatrack-1')).toEqual(SQUAT.hooks)
    setNearFurniture('squatrack-1')
    menuActions('furniture', getGym(), 'squatRack')
      .find((action) => action.label === 'Back squat')!
      .run()
    const onBack = barTarget('squatrack-1')
    expect(Math.hypot(onBack.y - SQUAT.hooks.y, onBack.z - SQUAT.hooks.z)).toBeGreaterThan(0.3)
    stopExercise()
    expect(barTarget('squatrack-1')).toEqual(SQUAT.hooks)
  })
})
