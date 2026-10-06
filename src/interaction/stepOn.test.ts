import { describe, expect, it } from 'vitest'
import { getBuild } from '../build/buildStore'
import { machine } from '../equipment/machineState'
import { activeCable } from '../equipment/cableGeometry'
import { barTarget, SQUAT } from '../equipment/squatGeometry'
import { backrestTarget } from '../equipment/adjustableBenchGeometry'
import {
  ARRIVE_DISTANCE,
  EXERCISES,
  getGym,
  menuActions,
  paceActions,
  paceSeconds,
  repProgress,
  repsDone,
  setNearFurniture,
  stepOffSpot,
  stepOnto,
  stopExercise,
  type ExerciseKind,
} from './gymStore'

// Pick an exercise from the machine's menu, as the player would
function start(kind: ExerciseKind) {
  stopExercise()
  const piece = getBuild().items.find((item) => item.type === EXERCISES[kind].machine)!
  setNearFurniture(piece.id)
  menuActions('furniture', getGym(), piece.type)
    .find((action) => action.label === EXERCISES[kind].name)!
    .run()
  return getGym().activity!
}

describe('step on, then start', () => {
  it('V4B2-T1: while stepping on, the clock has not started and every machine is at rest', () => {
    for (const kind of ['walk', 'pushdown', 'squat', 'inclinePress', 'ride'] as const) {
      const stepping = start(kind)
      expect(stepping.arrived).toBe(false)
      expect(repsDone(stepping, stepping.startedAt + 10_000)).toBeGreaterThan(0) // (the clock would count…)
      expect(machine.activeId).toBeNull() // …but the machine hasn't woken up
      expect(machine.speed).toBe(0)
      expect(paceActions(stepping)).toEqual([]) // no pace switching until you're on
    }
    // Each machine's moving parts read "at rest"
    start('pushdown')
    expect(activeCable('cable-1')).toBeNull()
    start('squat')
    expect(barTarget('squatrack-1')).toEqual(SQUAT.hooks)
    start('inclinePress')
    expect(backrestTarget('adjbench-1')).toBe(0)
    stopExercise()
  })

  it('V4B2-T2: the exercise begins once the person is within 2 cm of the spot, and not before', () => {
    const stepping = start('cableRow')
    const spot = stepping.stand!
    // 3 cm away: still stepping on
    stepOnto({ x: spot.x + 0.03, y: spot.y, z: spot.z }, 5_000)
    expect(getGym().activity!.arrived).toBe(false)
    expect(machine.activeId).toBeNull()
    // 1.5 cm away: on the machine, and the clock starts now
    stepOnto({ x: spot.x, y: spot.y + 0.015, z: spot.z }, 6_000)
    const begun = getGym().activity!
    expect(ARRIVE_DISTANCE).toBe(0.02)
    expect(begun.arrived).toBe(true)
    expect(begun.startedAt).toBe(6_000)
    expect(machine.activeId).toBe('cable-1')
    expect(activeCable('cable-1')).toBe('cableRow')
    // Same session: arriving must not make the person step off again
    expect(stepOffSpot(stepping, begun)).toBeNull()
    stopExercise()
  })

  it('V4B2-T3: on arrival, every exercise starts its first rep from the start, on the same clock as its machine', () => {
    for (const kind of Object.keys(EXERCISES) as ExerciseKind[]) {
      const stepping = start(kind)
      if (stepping.stand) stepOnto(stepping.stand, 20_000)
      const begun = getGym().activity!
      expect(begun.arrived, kind).toBe(true)
      // Machines you get on start their clock at the moment you arrive
      if (stepping.stand) expect(begun.startedAt, kind).toBe(20_000)
      expect(machine.activeId, kind).toBe(begun.machineId)
      expect(machine.startedAt, kind).toBe(begun.startedAt) // person and machine share one clock
      // The first frame on the machine is the very start of a rep (t = 0), which is
      // where every machine's own tests check that hands and feet meet their parts
      expect(repProgress(begun, begun.startedAt), kind).toBe(0)
      expect(paceSeconds(begun, begun.startedAt), kind).toBe(0)
    }
    stopExercise()
  })

  it('V4B2-T4: stopping while still stepping on cancels cleanly', () => {
    const stepping = start('legPress')
    stopExercise()
    expect(getGym().activity).toBeNull()
    expect(machine.activeId).toBeNull()
    // Back to where they started from, feet on the floor
    expect(stepOffSpot(stepping, null)).toEqual({ x: stepping.returnTo!.x, y: 0, z: stepping.returnTo!.z })
    // A late arrival after stopping does nothing
    stepOnto(stepping.stand!)
    expect(getGym().activity).toBeNull()
    expect(machine.activeId).toBeNull()
  })
})
