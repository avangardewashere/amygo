import { describe, expect, it } from 'vitest'
import { exercisePose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { HIP_Y } from '../player/proportions'
import { FOOT_TO_PLATE, PRESS, plateCenter } from './legPressGeometry'
import { FLY, HANDLE_FORWARD, handlePosition } from './chestFlyGeometry'

// 24 evenly spread moments through one rep (t goes 0 → 1; reps play it back down)
const MOMENTS = Array.from({ length: 24 }, (_, i) => i / 23)

describe('leg press', () => {
  // The person sits with their hips on the seat, facing the sled (+z)
  const seated = { y: PRESS.hipY - HIP_Y, z: PRESS.hipZ }

  it('B0-T1: both feet stay on the footplate through the whole rep', () => {
    for (const t of MOMENTS) {
      const { feet } = limbEnds(exercisePose({ kind: 'legPress' }, t)!, seated)
      const [plateY, plateZ] = plateCenter(t)
      for (const foot of feet) {
        // Shoe middle to plate (ignoring left/right): the shoe's half-thickness, give or take 1 cm
        const gap = Math.hypot(foot.y - plateY, foot.z - plateZ)
        expect(gap).toBeLessThan(FOOT_TO_PLATE + 0.01)
      }
    }
  })
})

describe('chest fly', () => {
  const seated = { y: FLY.hipY - HIP_Y, z: FLY.hipZ }

  it('B0-T2: both hands stay on the handles through the whole rep', () => {
    for (const t of MOMENTS) {
      const { hands } = limbEnds(exercisePose({ kind: 'chestFly' }, t)!, seated)
      ;[1, -1].forEach((side, i) => {
        const handle = handlePosition(side, t)
        const hand = hands[i]
        const gap = Math.hypot(hand.x - handle.x, hand.y - handle.y, hand.z - handle.z)
        // The grip sits HANDLE_FORWARD in front of the bar so the hand wraps it; allow 1 cm on top
        expect(gap).toBeLessThan(HANDLE_FORWARD + 0.01)
      })
    }
  })
})
