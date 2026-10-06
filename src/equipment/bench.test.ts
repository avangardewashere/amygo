import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { exercisePose, type BodyPose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { HIP_X, SHOE_Y } from '../player/proportions'
import { EXERCISES, type ExerciseKind } from '../interaction/gymStore'
import { BENCH, LYING_HIP, placeHips } from './benchGeometry'

// The pad: 30 cm wide, 1.2 m long, its top 45 cm up and 10 cm thick (see Bench.tsx)
const PAD = { halfWidth: BENCH.padWidth / 2, top: BENCH.topY, bottom: BENCH.topY - 0.1, halfLength: BENCH.length / 2 }
// How thick each part of the leg is (the capsules in Person.tsx)
const THIGH_RADIUS = 0.085
const SHIN_RADIUS = 0.07

const lying = placeHips(LYING_HIP)
const MOMENTS = Array.from({ length: 13 }, (_, i) => i / 12)

// Is a point of a limb this thick touching the pad? True distance from the
// point to the pad's box (so past the pad's edges and corners it's measured
// diagonally, as a round limb meets a corner), compared with the limb's thickness.
const inPad = (p: Vector3, radius: number) => {
  const nearest = new Vector3(
    Math.min(Math.max(p.x, -PAD.halfWidth), PAD.halfWidth),
    Math.min(Math.max(p.y, PAD.bottom), PAD.top),
    Math.min(Math.max(p.z, -PAD.halfLength), PAD.halfLength),
  )
  return p.distanceTo(nearest) < radius
}

// 11 points along a limb segment, end to end
const along = (a: Vector3, b: Vector3) => Array.from({ length: 11 }, (_, i) => a.clone().lerp(b, i / 10))

describe('flat bench: legs straddle it', () => {
  it('V4B3-T1: bench press: thighs and shins stay clear of the pad through the whole rep', () => {
    for (const t of MOMENTS) {
      const { spine, knees, feet } = limbEnds(exercisePose({ kind: 'benchPress' }, t)!, lying)
      ;[1, -1].forEach((side, i) => {
        // The hip joint sits HIP_X out from the middle of the hips
        const hip = spine.hips.clone().add(new Vector3(side * HIP_X, 0, 0))
        for (const p of along(hip, knees[i])) expect(inPad(p, THIGH_RADIUS)).toBe(false)
        for (const p of along(knees[i], feet[i])) expect(inPad(p, SHIN_RADIUS)).toBe(false)
      })
    }
  })

  it('V4B3-T2: the feet are on the floor, wider than the bench, and stay put through the rep', () => {
    const start = limbEnds(exercisePose({ kind: 'benchPress' }, 0)!, lying).feet
    for (const t of MOMENTS) {
      const { feet } = limbEnds(exercisePose({ kind: 'benchPress' }, t)!, lying)
      feet.forEach((foot, i) => {
        expect(Math.abs(foot.y - SHOE_Y)).toBeLessThan(0.01) // on the floor
        expect(Math.abs(foot.x)).toBeGreaterThan(PAD.halfWidth + 0.06) // the shoe (12 cm wide) is beside the pad
        expect(foot.distanceTo(start[i])).toBeLessThan(0.01) // planted
      })
    }
  })

  it('V4B3-T3: every other pose keeps its legs in line, with no sideways swing', () => {
    for (const kind of Object.keys(EXERCISES) as ExerciseKind[]) {
      if (kind === 'benchPress') continue
      for (const t of [0, 0.5, 1]) {
        const pose: BodyPose | null = exercisePose({ kind }, t, 1.3)
        if (!pose?.foot) continue // walking legs
        const { knees } = limbEnds(pose, {})
        ;[1, -1].forEach((side, i) => {
          expect(pose.foot!(side).x, kind).toBeUndefined()
          // Knees straight in front of the hip joints, not swung out
          expect(knees[i].x, kind).toBeCloseTo(side * HIP_X, 6)
        })
      }
    }
  })
})
