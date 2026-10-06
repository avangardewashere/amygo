import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROOM } from '../scene/dimensions'
import { DEFAULT_ITEMS, footprint, furnitureObstacles, getBuild } from './buildStore'
import { CATALOG, type FurnitureType } from './catalog'
import { LAYOUT_KEY } from './layoutStorage'
import { usableFrom } from './walkable'
import { machine } from '../equipment/machineState'
import { EXERCISES, getGym, menuActions, playerPose, setNearFurniture, stepOnto, stopExercise } from '../interaction/gymStore'

// How many of each kind the zoned gym has (docs/PLAN-layout.md, "The new floor plan")
const COUNTS: Record<FurnitureType, number> = {
  pullupBar: 2,
  dumbbellRack: 2,
  adjustableBench: 3,
  bench: 3,
  squatRack: 2,
  cableMachine: 2,
  treadmill: 4,
  bike: 3,
  legPress: 2,
  chestFly: 2,
  rower: 3,
}

afterEach(() => vi.unstubAllGlobals())

describe('the zoned gym', () => {
  it('L1B1-T1: every piece is inside the walls and overlaps no other piece', () => {
    for (const item of DEFAULT_ITEMS) {
      const { w, d } = footprint(item)
      expect(Math.abs(item.x) + w / 2, item.id).toBeLessThanOrEqual(ROOM.width / 2)
      expect(Math.abs(item.z) + d / 2, item.id).toBeLessThanOrEqual(ROOM.depth / 2)
      for (const other of DEFAULT_ITEMS) {
        if (other === item) continue
        const o = footprint(other)
        const overlaps = Math.abs(item.x - other.x) < (w + o.w) / 2 && Math.abs(item.z - other.z) < (d + o.d) / 2
        expect(overlaps, `${item.id} overlaps ${other.id}`).toBe(false)
      }
    }
  })

  it('L1B1-T2: ids are unique and every kind has its planned count', () => {
    const ids = DEFAULT_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    const counted = Object.fromEntries(Object.keys(CATALOG).map((type) => [type, 0])) as Record<FurnitureType, number>
    for (const item of DEFAULT_ITEMS) counted[item.type]++
    expect(counted).toEqual(COUNTS)
    expect(DEFAULT_ITEMS).toHaveLength(28)
  })

  it('L1B1-T3: the person can walk up to and use every machine from where they start', () => {
    const usable = usableFrom(playerPose, furnitureObstacles())
    const missing = DEFAULT_ITEMS.map((item) => item.id).filter((id) => !usable.has(id))
    expect(missing).toEqual([])
  })

  it('L1B1-T4: two machines of the same kind keep separate state', () => {
    setNearFurniture('treadmill-2')
    menuActions('furniture', getGym(), 'treadmill')
      .find((action) => action.label === EXERCISES.walk.name)!
      .run()
    const activity = getGym().activity!
    expect(activity.machineId).toBe('treadmill-2')
    stepOnto(activity.stand!)
    expect(machine.activeId).toBe('treadmill-2') // only this treadmill's belt runs
    // Its stand spot is on treadmill-2, not on the first treadmill
    const two = getBuild().items.find((item) => item.id === 'treadmill-2')!
    expect(Math.abs(activity.stand!.z - two.z)).toBeLessThan(0.45)
    stopExercise()
  })

  it('L1B1-T5: a version-1 save (the old 11-piece gym) is ignored; a version-2 save is applied', async () => {
    const open = async (saved: object) => {
      vi.stubGlobal('localStorage', { getItem: (key: string) => (key === LAYOUT_KEY ? JSON.stringify(saved) : null), setItem() {} })
      vi.resetModules()
      return (await import('./buildStore')).getBuild().items.find((item) => item.id === 'rack-1')!
    }
    const moved = [{ id: 'rack-1', type: 'dumbbellRack', x: 0, z: 0, turns: 1 }]
    expect(await open({ version: 1, items: moved })).toEqual(DEFAULT_ITEMS.find((item) => item.id === 'rack-1'))
    expect(await open({ version: 2, items: moved })).toMatchObject({ x: 0, z: 0, turns: 1 })
  })
})
