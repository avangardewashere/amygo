import { describe, expect, it } from 'vitest'
import { exercisePose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { FOOT_DROP, HIP_Y, KNEE_DROP } from '../player/proportions'
import { BIKE, crankAngle, footOnPedal, pedalPosition } from './bikeGeometry'
import { headline, progressText } from '../interaction/activityText'

// The rider sits with their hips on the saddle, facing the handlebars (+z)
const onSaddle = { y: BIKE.hipY - HIP_Y, z: BIKE.hipZ }
const PACES = [
  { kind: 'ride', cadence: BIKE.cadence.easy },
  { kind: 'sprint', cadence: BIKE.cadence.sprint },
] as const

// 24 moments spread over one full turn of the pedals
const aroundOneTurn = (cadence: number) => Array.from({ length: 24 }, (_, i) => i / 24 / cadence)

describe('stationary bike', () => {
  it('V2B1-T1: each foot stays on its pedal all the way round', () => {
    for (const { kind, cadence } of PACES) {
      for (const seconds of aroundOneTurn(cadence)) {
        const { feet } = limbEnds(exercisePose({ kind }, 0, seconds)!, onSaddle)
        const angle = crankAngle(cadence, seconds)
        ;[1, -1].forEach((side, i) => {
          const target = footOnPedal(side, angle)
          // Side view only: the pedal is a little wider apart than the hips (x)
          expect(Math.hypot(feet[i].y - target.y, feet[i].z - target.z)).toBeLessThan(0.03)
        })
      }
    }
  })

  it('V2B1-T2: the pedals are always half a turn apart', () => {
    for (const seconds of aroundOneTurn(BIKE.cadence.easy)) {
      const angle = crankAngle(BIKE.cadence.easy, seconds)
      const left = pedalPosition(1, angle)
      const right = pedalPosition(-1, angle)
      // Opposite ends of the circle: their midpoint is the circle's middle
      expect((left.y + right.y) / 2).toBeCloseTo(BIKE.crankY, 6)
      expect((left.z + right.z) / 2).toBeCloseTo(BIKE.crankZ, 6)
      expect(Math.hypot(left.y - right.y, left.z - right.z)).toBeCloseTo(BIKE.crankLength * 2, 6)
    }
  })

  it('V2B1-T3: the saddle height fits: the leg never has to stretch past straight', () => {
    const straightLeg = KNEE_DROP + FOOT_DROP
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2
      const foot = footOnPedal(1, angle)
      const hipToFoot = Math.hypot(foot.y - BIKE.hipY, foot.z - BIKE.hipZ)
      expect(hipToFoot).toBeLessThan(straightLeg - 0.01) // a little bend left even at the bottom
    }
  })

  it('V2B1-T4: the popup shows speed in km/h, and distance = speed × time', () => {
    expect(headline({ kind: 'ride' })).toBe('Cycling · 20.0 km/h')
    expect(headline({ kind: 'sprint' })).toBe('Sprinting · 32.0 km/h')
    // 20 km/h for 27 s = 150 m
    expect(progressText({ kind: 'ride', startedAt: 0 }, 27_000)).toBe('0.15 km · 0:27')
    // 32 km/h for 75 s ≈ 667 m
    expect(progressText({ kind: 'sprint', startedAt: 0 }, 75_000)).toBe('0.67 km · 1:15')
  })

  it('V2B1-T5: both hands rest on the handlebars, at both paces', () => {
    for (const { kind } of PACES) {
      const { hands } = limbEnds(exercisePose({ kind }, 0, 0)!, onSaddle)
      for (const hand of hands) {
        // Side view: the grips are a little wider than the shoulders (x)
        expect(Math.hypot(hand.y - BIKE.bar.y, hand.z - BIKE.bar.z)).toBeLessThan(0.03)
      }
    }
  })
})
