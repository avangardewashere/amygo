import { afterEach, describe, expect, it, vi } from 'vitest'
import { frameloopFor, getTab } from './tabStore'
import { openTab } from './tabs'
import { input, listenToKeyboard } from '../player/input'
import {
  getGym,
  listenToInteractionKeys,
  menuActions,
  setNearFurniture,
  stepOnto,
  stopExercise,
  type ExerciseKind,
} from '../interaction/gymStore'
import { progressText } from '../interaction/activityText'
import { endDrag, getBuild, startDrag, dragTo, toggleBuildMode } from '../build/buildStore'
import type { FurnitureType } from '../build/catalog'

// Start an exercise from a machine's menu, stepping onto it where there's a spot
function start(machineId: string, type: FurnitureType, kind: ExerciseKind, label: string) {
  stopExercise()
  setNearFurniture(machineId)
  menuActions('furniture', getGym(), type)
    .find((action) => action.label === label)!
    .run()
  const stepping = getGym().activity!
  if (stepping.stand) stepOnto(stepping.stand)
  expect(getGym().activity!.kind).toBe(kind)
  return getGym().activity!
}

// A pretend window to send key presses to (the tests run without a browser)
function pressKeys() {
  const fake = new EventTarget()
  vi.stubGlobal('window', fake)
  const key = (type: 'keydown' | 'keyup', code: string) => fake.dispatchEvent(Object.assign(new Event(type), { code, repeat: false }))
  return key
}

afterEach(() => {
  openTab('home')
  stopExercise()
  vi.unstubAllGlobals()
})

describe('app shell', () => {
  it('V6B1-T1: switching tabs and back leaves a running exercise untouched', () => {
    const curls = start('rack-1', 'dumbbellRack', 'curl', 'Bicep curls')
    openTab('exercises')
    expect(getGym().activity).toBe(curls) // the very same exercise, still going
    openTab('home')
    expect(getGym().activity).toBe(curls)
    expect(getTab()).toBe('home')
  })

  it('V6B1-T2: the gym draws on Home and stops drawing on every other tab', () => {
    expect(frameloopFor('home')).toBe('always')
    expect(frameloopFor('exercises')).toBe('never')
  })

  it('V6B1-T3: walking keys and E do nothing while Home isn\'t open, and work again on return', () => {
    const key = pressKeys()
    const stopKeyboard = listenToKeyboard()
    const stopInteraction = listenToInteractionKeys()
    setNearFurniture('rack-1') // standing at the rack, where E opens its menu

    openTab('exercises')
    key('keydown', 'KeyW')
    expect(input.keyboard.y).toBe(0)
    key('keydown', 'KeyE')
    expect(getGym().menu).toBeNull()
    key('keyup', 'KeyW')

    openTab('home')
    key('keydown', 'KeyW')
    expect(input.keyboard.y).toBe(1)
    key('keyup', 'KeyW')
    key('keydown', 'KeyE')
    expect(getGym().menu).toBe('furniture')

    stopKeyboard()
    stopInteraction()
  })

  it('V6B1-T4: thirty seconds on another tab mid-walk adds thirty seconds and the matching distance', () => {
    const walk = start('treadmill-1', 'treadmill', 'walk', 'Walk')
    openTab('exercises')
    // Nothing is drawn meanwhile, but the counters come from the clock.
    // (Read half a second past the 30 s mark, away from rounding edges: start
    // times are fractions of a millisecond, so exactly 30 s can come out a hair
    // under and show 0:29; and 30 s of walking is exactly 0.045 km, which
    // rounds either way. At 30.5 s it's 0.04575 km.)
    const later = walk.startedAt + 30_500
    openTab('home')
    expect(getGym().activity).toBe(walk)
    expect(progressText(getGym().activity!, later)).toBe('0.05 km · 0:30')
  })

  it('V6B1-T6 (found in the browser): a clock read before the start shows the start, never a negative count', () => {
    const curls = start('rack-1', 'dumbbellRack', 'curl', 'Bicep curls')
    expect(progressText(curls, curls.startedAt - 25_000)).toBe('First rep…')
    const walk = start('treadmill-1', 'treadmill', 'walk', 'Walk')
    expect(progressText(walk, walk.startedAt - 25_000)).toBe('0.00 km · 0:00')
  })

  it('V6B1-T5: leaving Home in build mode ends build mode, with no drag left half-done', () => {
    toggleBuildMode()
    const rack = getBuild().items.find((item) => item.id === 'rack-1')!
    const bench = getBuild().items.find((item) => item.id === 'bench-1')!
    // Mid-drag, over the bench (a taken spot)
    startDrag(rack.id, rack.x, rack.z)
    dragTo(bench.x, bench.z)
    expect(getBuild().drag?.valid).toBe(false)

    openTab('exercises')
    expect(getBuild().mode).toBe('play')
    expect(getBuild().drag).toBeNull()
    // The rack went back where it was, not left on top of the bench
    expect(getBuild().items.find((item) => item.id === 'rack-1')).toMatchObject({ x: rack.x, z: rack.z })
    endDrag()
  })
})
