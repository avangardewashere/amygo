import { describe, expect, it } from 'vitest'
import { exercisePose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { HEAD_RADIUS, SHOE_Y } from '../player/proportions'
import { getGym, menuActions, playerPose, setNearFurniture, stepOffSpot, stepOnto, stopExercise } from '../interaction/gymStore'
import { PULLUP } from './pullupGeometry'


// The person steps onto the machine's spot (in the game, <Player> does this every frame)
const stepOn = () => stepOnto(getGym().activity!.stand!)

// The person is placed on the floor under the bar; the pose lifts them
const underBar = { z: PULLUP.standZ }
// 25 moments from hanging (t = 0) up to chin over the bar (t = 1)
const HEIGHTS = Array.from({ length: 25 }, (_, i) => i / 24)
const bodyAt = (t: number) => limbEnds(exercisePose({ kind: 'pullup' }, t)!, underBar)

describe('pull-up bar', () => {
  it('V3B3-T1: both hands stay on the bar through the whole rep', () => {
    for (const t of HEIGHTS) {
      const { hands } = bodyAt(t)
      ;[1, -1].forEach((side, i) => {
        const grip = { x: side * PULLUP.gripX, ...PULLUP.bar }
        expect(Math.hypot(hands[i].x - grip.x, hands[i].y - grip.y, hands[i].z - grip.z)).toBeLessThan(0.02)
      })
    }
  })

  it('V3B3-T2: at the top the chin is level with or above the bar, and the head clears it', () => {
    const top = bodyAt(1)
    expect(top.head.y - HEAD_RADIUS).toBeGreaterThanOrEqual(PULLUP.bar.y)
    // The face passes behind the bar, not through it
    expect(PULLUP.bar.z - top.head.z).toBeGreaterThan(HEAD_RADIUS + PULLUP.barRadius)
    // …and at the bottom it really is a hang, well below the bar
    expect(bodyAt(0).head.y - HEAD_RADIUS).toBeLessThan(PULLUP.bar.y - 0.3)
  })

  it('V3B3-T3: the feet never touch the floor during the set', () => {
    for (const t of HEIGHTS) {
      for (const foot of bodyAt(t).feet) {
        // The shoe's bottom (half its height below its middle) stays at least 5 cm up
        expect(foot.y - SHOE_Y).toBeGreaterThan(0.05)
      }
    }
  })

  it('V3B3-T4: after stopping, the person stands on the floor where they started', () => {
    playerPose.x = 1.5
    playerPose.z = 2
    setNearFurniture('pullup-1')
    menuActions('furniture', getGym(), 'pullupBar')
      .find((action) => action.label === 'Pull-ups')!
      .run()
    stepOn()
    const set = getGym().activity
    expect(set?.kind).toBe('pullup')
    expect(set?.stand?.y).toBe(0) // placed on the floor; only the pose lifts the body
    stopExercise()
    expect(stepOffSpot(set)).toEqual({ x: 1.5, y: 0, z: 2 })
  })
})
