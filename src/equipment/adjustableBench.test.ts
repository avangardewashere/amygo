import { describe, expect, it } from 'vitest'
import { exercisePose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { TORSO_RADIUS } from '../player/proportions'
import { EXERCISES, getGym, menuActions, setNearFurniture, stepOnto, stopExercise } from '../interaction/gymStore'
import { ADJ, backrestFacing, backrestTarget } from './adjustableBenchGeometry'


// The person steps onto the machine's spot (in the game, <Player> does this every frame)
const stepOn = () => stepOnto(getGym().activity!.stand!)

const BENCH_EXERCISES = ['inclinePress', 'seatedCurl'] as const
// Through one rep: arms move, but the back should stay put
const MOMENTS = [0, 0.25, 0.5, 0.75, 1]

// The body fully settled into an exercise, sitting where it puts you
const bodyAt = (kind: (typeof BENCH_EXERCISES)[number], t: number) => {
  const { standAt } = EXERCISES[kind]
  return limbEnds(exercisePose({ kind }, t)!, { y: standAt!.y, z: standAt!.z })
}

// A point's position relative to the backrest's padded surface:
//   out: how far in front of the surface it is
//   along: how far up the backrest from the hinge it is
function againstBackrest(angle: number, point: { y: number; z: number }) {
  const facing = backrestFacing(angle)
  const dy = point.y - ADJ.seatTop
  const dz = point.z - ADJ.hingeZ
  return {
    out: dy * facing.y + dz * facing.z,
    along: dy * Math.sin(angle) - dz * Math.cos(angle),
  }
}

describe('adjustable bench', () => {
  it('V2B3-T1: the back lies against the backrest at both angles', () => {
    for (const kind of BENCH_EXERCISES) {
      const angle = EXERCISES[kind].backrest!
      for (const t of MOMENTS) {
        const { spine } = bodyAt(kind, t)
        for (const point of [spine.hips, spine.shoulders]) {
          // The spine runs one torso-thickness in front of the pad, so the back touches it
          expect(Math.abs(againstBackrest(angle, point).out - TORSO_RADIUS)).toBeLessThan(0.03)
        }
        // …and the shoulders are still on the pad, not leaning past its top
        const shoulders = againstBackrest(angle, spine.shoulders).along
        expect(shoulders).toBeGreaterThan(0)
        expect(shoulders).toBeLessThan(ADJ.backLength)
      }
    }
  })

  it('V2B3-T2: the incline press goes up along the incline, not straight up', () => {
    const lowered = bodyAt('inclinePress', 1)
    const pressed = bodyAt('inclinePress', 0)
    const facing = backrestFacing(ADJ.angles.incline)
    const tilt = (y: number, z: number) => Math.atan2(z, y) // 0 = straight up, + = toward the feet
    for (const i of [0, 1]) {
      // The dumbbells travel up and forward, square to the backrest (45°)
      const travel = pressed.hands[i].clone().sub(lowered.hands[i])
      expect(Math.abs(tilt(travel.y, travel.z) - tilt(facing.y, facing.z))).toBeLessThan(0.15)
      expect(travel.length()).toBeGreaterThan(0.25)
      // At the top the arms point the same way, straight out from the chest
      const reach = pressed.hands[i].clone().sub(pressed.spine.shoulders)
      expect(Math.abs(tilt(reach.y, reach.z) - tilt(facing.y, facing.z))).toBeLessThan(0.15)
    }
  })

  it('V2B3-T3: the backrest rises for each exercise, and goes back to flat after you get off', () => {
    setNearFurniture('adjbench-1')
    const start = (name: string) => {
      menuActions('furniture', getGym(), 'adjustableBench')
        .find((action) => action.label === name)!
        .run()
      stepOn()
    }

    start('Incline dumbbell press')
    expect(backrestTarget('adjbench-1')).toBeCloseTo(Math.PI / 4)
    expect(backrestTarget('bench-1')).toBe(0) // only the bench in use tilts
    stopExercise()
    expect(backrestTarget('adjbench-1')).toBe(0)

    start('Seated curls')
    expect(backrestTarget('adjbench-1')).toBeCloseTo(ADJ.angles.upright)
    stopExercise()
    expect(backrestTarget('adjbench-1')).toBe(0)
  })
})
