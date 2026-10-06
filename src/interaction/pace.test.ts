import { describe, expect, it } from 'vitest'
import { exercisePose } from '../player/poseMath'
import { limbEnds } from '../player/bodyKinematics'
import { HIP_Y } from '../player/proportions'
import { BIKE, footOnPedal, machineCrank } from '../equipment/bikeGeometry'
import { machine } from '../equipment/machineState'
import { progressText } from './activityText'
import {
  crankSoFar,
  getGym,
  menuActions,
  paceSeconds,
  setNearFurniture,
  stepOffSpot,
  stopExercise,
  withNewPace,
  type Activity,
} from './gymStore'

// What the menu (and the exercise popup) offers mid-exercise
const midExercise = (kind: Activity['kind']) =>
  menuActions('furniture', { holding: false, activity: { kind } as Activity }).map((action) => action.label)

const start = (machineId: string, type: 'treadmill' | 'bike', label: string) => {
  setNearFurniture(machineId)
  menuActions('furniture', getGym(), type)
    .find((action) => action.label === label)!
    .run()
}
const pick = (label: string) =>
  menuActions('furniture', getGym())
    .find((action) => action.label === label)!
    .run()

describe('changing pace without stopping', () => {
  it('V4B1-T1: mid-walk you can Run, mid-ride you can Sprint, mid-curl you can only Stop', () => {
    expect(midExercise('walk')).toEqual(['Stop', 'Run'])
    expect(midExercise('run')).toEqual(['Stop', 'Walk'])
    expect(midExercise('ride')).toEqual(['Stop', 'Sprint'])
    expect(midExercise('sprint')).toEqual(['Stop', 'Easy ride'])
    expect(midExercise('curl')).toEqual(['Stop'])
    expect(midExercise('row')).toEqual(['Stop'])
  })

  it('V4B1-T2: switching keeps you on the machine and sets the new speed', () => {
    start('treadmill-1', 'treadmill', 'Walk')
    const walking = getGym().activity!
    pick('Run')
    const running = getGym().activity!
    expect(running.kind).toBe('run')
    expect(running.stand).toEqual(walking.stand) // same spot on the belt
    expect(running.startedAt).toBe(walking.startedAt) // same session
    expect(stepOffSpot(walking, running)).toBeNull() // so the person doesn't step off
    expect(machine.speed).toBe(3)
    expect(machine.activeId).toBe('treadmill-1')
    // Stopping still steps you off
    stopExercise()
    expect(stepOffSpot(running, getGym().activity)).toEqual({ x: running.returnTo!.x, y: 0, z: running.returnTo!.z })
  })

  it('V4B1-T3: time and distance carry on across a switch', () => {
    const walking: Activity = { kind: 'walk', machineId: 'treadmill-1', startedAt: 0, faceYaw: 0 }
    // 60 s walking at 1.5 m/s, then 60 s running at 3 m/s: 90 m + 180 m, 2 minutes
    const running = withNewPace(walking, 'run', 60_000)
    expect(progressText(running, 120_000)).toBe('0.27 km · 2:00')
    // Switching back and forth again keeps adding up
    const walkingAgain = withNewPace(running, 'walk', 120_000)
    expect(progressText(walkingAgain, 180_000)).toBe('0.36 km · 3:00')
  })

  it('V4B1-T4: the pedals never jump when switching from Easy ride to Sprint', () => {
    const easy: Activity = { kind: 'ride', machineId: 'bike-1', startedAt: 0, faceYaw: 0 }
    const sprint = withNewPace(easy, 'sprint', 10_000)
    // Just before and just after the switch, the pedals are where they were
    expect(crankSoFar(sprint, 10_000)).toBeCloseTo(crankSoFar(easy, 10_000), 9)
    // …and so are the rider's feet (on the pedals, same spot)
    const saddle = { y: BIKE.hipY - HIP_Y, z: BIKE.hipZ }
    const before = limbEnds(exercisePose(easy, 0, paceSeconds(easy, 10_000))!, saddle).feet[0]
    const after = limbEnds(exercisePose(sprint, 0, paceSeconds(sprint, 10_000))!, saddle).feet[0]
    expect(before.distanceTo(after)).toBeLessThan(0.001)
    expect(Math.hypot(after.y - footOnPedal(1, crankSoFar(sprint, 10_000)).y, after.z - footOnPedal(1, crankSoFar(sprint, 10_000)).z)).toBeLessThan(0.03)

    // The bike model reads the same angle as the rider, through a real switch in the game
    stopExercise() // (in case an earlier test left a session running)
    start('bike-1', 'bike', 'Easy ride')
    pick('Sprint')
    const now = performance.now()
    expect(machineCrank(now)).toBeCloseTo(crankSoFar(getGym().activity!, now), 6)
    stopExercise()
  })
})
