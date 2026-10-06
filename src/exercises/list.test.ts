import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISES, MACHINE_NAMES, type ExerciseKind, type MachineType } from './catalog'
import { exerciseGroups, nearestMachine } from './list'
import { getBuild, type Furniture } from '../build/buildStore'
import { machine } from '../equipment/machineState'
import {
  finishFromList,
  getGym,
  menuActions,
  playerPose,
  setNearFurniture,
  startFromList,
  stepOffSpot,
  stepOnto,
  stopExercise,
} from '../interaction/gymStore'

const kinds = Object.keys(EXERCISES) as ExerciseKind[]

// Start an exercise at its machine, the in-gym way (menu, then step on)
function startAtMachine(kind: ExerciseKind) {
  stopExercise()
  const piece = getBuild().items.find((item) => item.type === EXERCISES[kind].machine)!
  setNearFurniture(piece.id)
  menuActions('furniture', getGym(), piece.type)
    .find((action) => action.label === EXERCISES[kind].name)!
    .run()
  const stepping = getGym().activity!
  if (stepping.stand) stepOnto(stepping.stand)
  return getGym().activity!
}

afterEach(() => {
  stopExercise()
  playerPose.x = 0
  playerPose.z = 0
})

describe('Exercises list', () => {
  it('V6B2-T1: lists every exercise once, under its own machine', () => {
    const groups = exerciseGroups(getBuild().items)
    const listed = groups.flatMap((group) => group.exercises)
    expect([...listed].sort()).toEqual([...kinds].sort()) // all of them, none twice
    for (const group of groups) {
      for (const kind of group.exercises) expect(EXERCISES[kind].machine, kind).toBe(group.machine)
    }
    // Every machine has a heading, even one with a single exercise
    expect(groups.map((group) => group.machine)).toEqual(Object.keys(MACHINE_NAMES))
  })

  it("V6B2-T2: a machine that isn't in the gym is marked, and its Start does nothing", () => {
    const withoutRower = getBuild().items.filter((item) => item.type !== 'rower')
    const rower = exerciseGroups(withoutRower).find((group) => group.machine === 'rower')!
    expect(rower.available).toBe(false)
    expect(exerciseGroups(getBuild().items).find((group) => group.machine === 'rower')!.available).toBe(true)
    // Start: no rower to go to, so nothing happens
    expect(nearestMachine('rower', withoutRower, playerPose)).toBeNull()
    const original = getBuild().items
    getBuild().items = withoutRower // (the store's own list, swapped for this check)
    try {
      expect(startFromList('row')).toBe(false)
      expect(getGym().activity).toBeNull()
    } finally {
      getBuild().items = original
    }
  })

  it('V6B2-T3: starting from the list ends in the same exercise as starting at the machine', () => {
    for (const kind of kinds) {
      const atMachine = startAtMachine(kind)
      stopExercise()
      expect(startFromList(kind), kind).toBe(true)
      const fromList = getGym().activity!
      expect(fromList.kind, kind).toBe(atMachine.kind)
      expect(fromList.machineId, kind).toBe(atMachine.machineId)
      expect(fromList.arrived, kind).toBe(true) // going straight away, the count running
      expect(machine.activeId, kind).toBe(atMachine.machineId)
      // Machines you get on: the very same spot. (The dumbbell rack is used from
      // beside it; from the list the person is put just in front of it.)
      if (atMachine.stand) expect(fromList.stand, kind).toEqual(atMachine.stand)
      else expect(fromList.stand, kind).toBeDefined()
    }
  })

  it('V6B2-T4: with two of the same machine, Start picks the one nearest the person', () => {
    const racks: Furniture[] = [
      { id: 'rack-far', type: 'dumbbellRack', x: 8, z: 4, turns: 0 },
      { id: 'rack-near', type: 'dumbbellRack', x: -2, z: 1, turns: 0 },
    ]
    expect(nearestMachine('dumbbellRack', racks, { x: 0, z: 0 })!.id).toBe('rack-near')
    expect(nearestMachine('dumbbellRack', racks, { x: 7, z: 3 })!.id).toBe('rack-far')
    // …and through Start itself, with a second rack placed in the gym
    const original = getBuild().items
    const nearest = { id: 'rack-2', type: 'dumbbellRack' as MachineType, x: 1.5, z: 1.5, turns: 0 }
    getBuild().items = [...original, nearest]
    try {
      playerPose.x = 1
      playerPose.z = 1
      startFromList('curl')
      expect(getGym().activity!.machineId).toBe('rack-2')
    } finally {
      stopExercise()
      getBuild().items = original
    }
  })

  it('V6B2-T5: Finish from the list leaves the same state as Stop in the gym', () => {
    // It is the very same action as the in-gym menu's Stop…
    const stop = menuActions('furniture', { holding: false, activity: startAtMachine('legPress') }).find(
      (action) => action.label === 'Stop',
    )!
    stop.run()
    const afterStop = { activity: getGym().activity, active: machine.activeId }

    startFromList('legPress')
    const fromList = getGym().activity!
    finishFromList()
    // …and ends in the same place: nothing running, the machine at rest, the person stepped off
    expect({ activity: getGym().activity, active: machine.activeId }).toEqual(afterStop)
    expect(stepOffSpot(fromList, null)).toEqual({ x: fromList.returnTo!.x, y: 0, z: fromList.returnTo!.z })
  })

  it('V6B2-T6: the catalog and the list import nothing from three.js or the 3D code', () => {
    // Every source file's text, so imports can be followed without running them
    const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
      string,
      string
    >
    const imported = (file: string) => {
      const found: string[] = []
      // Real imports only: "import type" (and "export type") disappear when the app is built
      for (const match of sources[file].matchAll(/^(?:import|export)\s+(?!type\b)[^'"]*?from\s+'([^']+)'/gm)) {
        found.push(match[1])
      }
      return found
    }
    const resolve = (from: string, spec: string) => {
      const base = new URL(spec, 'file://' + from).pathname
      return [base, base + '.ts', base + '.tsx'].find((candidate) => candidate in sources) ?? base
    }

    const seen = new Set<string>()
    const toVisit = ['/src/exercises/catalog.ts', '/src/exercises/list.ts']
    const problems: string[] = []
    while (toVisit.length) {
      const file = toVisit.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      if (file.endsWith('.tsx')) problems.push(`${file} is a component`)
      for (const spec of imported(file)) {
        if (!spec.startsWith('.')) {
          if (spec === 'three' || spec.startsWith('three/') || spec.startsWith('@react-three/')) problems.push(`${file} imports ${spec}`)
          continue
        }
        toVisit.push(resolve(file, spec))
      }
    }
    expect(problems).toEqual([])
    expect(seen.size).toBeGreaterThan(2) // it really did follow the imports
  })
})
