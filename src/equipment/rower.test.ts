import { describe, expect, it } from 'vitest'
import { exercisePose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { HIP_Y } from '../player/proportions'
import { ROWER, rowerPosition, strokeState, strokesSince } from './rowerGeometry'
import { headline, progressText } from '../interaction/activityText'

// The rower is placed with their hips at z = 0 on the rail; the pose slides them from there
const onSeat = { y: ROWER.hipY - HIP_Y, z: 0 }
// 24 moments spread over one full stroke
const MOMENTS = Array.from({ length: 24 }, (_, i) => (i / 24) * ROWER.strokeSeconds)
const poseAt = (seconds: number) => exercisePose({ kind: 'row' }, 0, seconds)!

describe('rowing machine', () => {
  it('V2B2-T1: both hands stay on the handle through the whole stroke', () => {
    for (const seconds of MOMENTS) {
      const { hands } = limbEnds(poseAt(seconds), onSeat)
      const { handle } = rowerPosition(seconds)
      for (const hand of hands) {
        // Side view: the handle is wider than the shoulders (x)
        expect(Math.hypot(hand.y - handle.y, hand.z - handle.z)).toBeLessThan(0.03)
      }
    }
  })

  it('V2B2-T2: the feet stay on the footplates while the seat slides', () => {
    const seatPositions = new Set<string>()
    for (const seconds of MOMENTS) {
      const { feet } = limbEnds(poseAt(seconds), onSeat)
      seatPositions.add(rowerPosition(seconds).hipZ.toFixed(2))
      for (const foot of feet) {
        expect(Math.hypot(foot.y - ROWER.foot.y, foot.z - ROWER.foot.z)).toBeLessThan(0.03)
      }
    }
    // …and the seat really did slide (otherwise this test proves nothing)
    expect(seatPositions.size).toBeGreaterThan(5)
  })

  it('V2B2-T3: the elbows never bend backward', () => {
    for (const seconds of MOMENTS) {
      const pose = poseAt(seconds)
      for (const side of [1, -1]) {
        // Forearms only fold forward (negative); a positive angle would be an elbow bent the wrong way
        expect(pose.arms(side).elbowX).toBeLessThanOrEqual(0.01)
      }
    }
  })

  it('V2B2-T4: strokes count up once per stroke, and the popup shows pace and distance', () => {
    expect(strokesSince(ROWER.strokeSeconds - 0.01)).toBe(0)
    expect(strokesSince(ROWER.strokeSeconds)).toBe(1)
    expect(headline({ kind: 'row' })).toBe('Rowing · 2:00 /500m')
    // 10 strokes of 2.4 s = 24 s at 500 m per 2 minutes = 100 m
    expect(progressText({ kind: 'row', startedAt: 0 }, 24_000)).toBe('10 strokes · 0.10 km')
    expect(progressText({ kind: 'row', startedAt: 0 }, 2_400)).toBe('1 stroke · 0.01 km')
  })

  it('V2B2-T5: the stroke goes legs → back → arms, and back again in reverse', () => {
    const drive = ROWER.strokeSeconds * ROWER.driveShare
    // Early in the pull the legs are working but the arms are still straight
    const early = strokeState(drive * 0.25)
    expect(early.legs).toBeGreaterThan(0.2)
    expect(early.arms).toBe(0)
    // At the end of the pull everything is fully back
    expect(strokeState(drive * 0.999).arms).toBeGreaterThan(0.99)
    // Early in the slide back the arms go out first while the legs stay straight
    const recovery = strokeState(drive + (ROWER.strokeSeconds - drive) * 0.2)
    expect(recovery.arms).toBeLessThan(0.8)
    expect(recovery.legs).toBe(1)
  })
})
