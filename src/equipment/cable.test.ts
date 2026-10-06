import { describe, expect, it } from 'vitest'
import { exercisePose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { HIP_Y, SHOULDER_X } from '../player/proportions'
import { getGym, menuActions, setNearFurniture, stepOnto, stopExercise } from '../interaction/gymStore'
import { CABLE, activeCable, pulleyFor, pushdownArm, rowPosition, stackLift } from './cableGeometry'


// The person steps onto the machine's spot (in the game, <Player> does this every frame)
const stepOn = () => stepOnto(getGym().activity!.stand!)

// 24 evenly spread moments through one rep (t goes 0 → 1; reps play it back down)
const MOMENTS = Array.from({ length: 24 }, (_, i) => i / 23)
// Where each exercise puts you: standing at the tower, or on the low seat
const AT = {
  pushdown: { z: CABLE.pushdown.standZ },
  cableRow: { y: CABLE.row.hipY - HIP_Y, z: CABLE.row.hipZ },
}
const bodyAt = (kind: 'pushdown' | 'cableRow', t: number) => limbEnds(exercisePose({ kind }, t)!, AT[kind])
const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('cable machine', () => {
  it('V3B2-T1: the cable ends stay in the hands at every point of both exercises', () => {
    for (const t of MOMENTS) {
      // Pushdowns: each rope end is in a hand
      const pushdown = bodyAt('pushdown', t)
      const { hand } = pushdownArm(t)
      ;[1, -1].forEach((side, i) => {
        expect(distance(pushdown.hands[i], { x: side * SHOULDER_X, ...hand })).toBeLessThan(0.02)
      })
      // Rows: both hands on the V-handle
      const row = bodyAt('cableRow', t)
      const { handle } = rowPosition(t)
      ;[1, -1].forEach((side, i) => {
        expect(distance(row.hands[i], { x: side * CABLE.row.gripX, ...handle })).toBeLessThan(0.02)
      })
    }
  })

  it('V3B2-T2: pushdowns: the elbows stay pinned (move less than 5 cm), only the forearms work', () => {
    const start = bodyAt('pushdown', 0).elbows
    let handTravel = 0
    for (const t of MOMENTS) {
      const { elbows, hands } = bodyAt('pushdown', t)
      elbows.forEach((elbow, i) => expect(distance(elbow, start[i])).toBeLessThan(0.05))
      handTravel = Math.max(handTravel, distance(hands[0], bodyAt('pushdown', 0).hands[0]))
    }
    // …while the hands really do travel (otherwise this test proves nothing)
    expect(handTravel).toBeGreaterThan(0.3)
  })

  it('V3B2-T3: the stack rises by exactly as much cable as the hands pull out', () => {
    for (const kind of ['pushdown', 'cableRow'] as const) {
      const pulley = pulleyFor(kind)
      // Where the cable ends, worked out from where the hands actually are
      const cableFromHands = (t: number) => {
        const { hands } = bodyAt(kind, t)
        const y = (hands[0].y + hands[1].y) / 2
        const z = (hands[0].z + hands[1].z) / 2
        // The rope's middle sits a little above the hands, toward the pulley
        const length = Math.hypot(pulley.y - y, pulley.z - z)
        return kind === 'pushdown' ? length - CABLE.ropeDrop : length
      }
      for (const t of MOMENTS) {
        expect(Math.abs(stackLift(kind, t) - (cableFromHands(t) - cableFromHands(0)))).toBeLessThan(0.02)
      }
      // The stack really lifts by the end of the pull
      expect(stackLift(kind, 1)).toBeGreaterThan(0.2)
    }
  })

  it('V3B2-T4: each exercise uses the right pulley, and the machine knows which is running', () => {
    expect(activeCable('cable-1')).toBeNull()
    const start = (name: string) => {
      setNearFurniture('cable-1')
      menuActions('furniture', getGym(), 'cableMachine')
        .find((action) => action.label === name)!
        .run()
      stepOn()
    }
    start('Tricep pushdowns')
    expect(activeCable('cable-1')).toBe('pushdown')
    expect(pulleyFor('pushdown')).toBe(CABLE.high) // pushing down from above
    stopExercise()
    start('Cable rows')
    expect(activeCable('cable-1')).toBe('cableRow')
    expect(pulleyFor('cableRow')).toBe(CABLE.low) // pulling in from low down
    stopExercise()
    expect(activeCable('cable-1')).toBeNull()
  })
})
