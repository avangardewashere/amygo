import { describe, expect, it } from 'vitest'
import { DEFAULT_ITEMS, footprint, furnitureObstacles, type Furniture } from '../build/buildStore'
import { usableFrom } from '../build/walkable'
import { playerPose } from '../interaction/gymStore'
import { ROOM } from '../scene/dimensions'
import { TURF } from '../scene/floorZones'
import { WALLS, WALL_ART, WALL_PIECES, alongWall } from '../scene/wallDesign'
import { drawCount, renderScene } from '../test/renderScene'
import { Props } from './Props'
import { MATS, PROP_SIZE, TREE_GAP, WALL_PROPS, clockAngles, floorProps, plateTreeFor, propObstacles } from './propLayout'

// Measured 2026-10-07: 66 draws for every prop (78 before the kettlebells stopped casting shadows), plus 30 % (as D4)
export const PROPS_DRAW_BUDGET = 86

const SCENE_TIMEOUT = 20_000 // building the scene takes ~1 s; give it room when the laptop is busy
const E = 1e-9
type Rect = { x: number; z: number; w: number; d: number }
const rectsOverlap = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - E && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - E
const furnitureRect = (item: Furniture): Rect => ({ x: item.x, z: item.z, ...footprint(item) })
type Box = { from: number; to: number; bottom: number; top: number }
const boxesOverlap = (a: Box, b: Box) => a.from < b.to - E && b.from < a.to - E && a.bottom < b.top - E && b.bottom < a.top - E

describe('props that make it feel used', () => {
  it('L2B3-T1: props sit inside the room, clear of the machines, each other, and the wall words', () => {
    const props = floorProps(DEFAULT_ITEMS)
    for (const prop of props) {
      expect(Math.abs(prop.x) + prop.w / 2, prop.id).toBeLessThanOrEqual(ROOM.width / 2)
      expect(Math.abs(prop.z) + prop.d / 2, prop.id).toBeLessThanOrEqual(ROOM.depth / 2)
      for (const item of DEFAULT_ITEMS) expect(rectsOverlap(prop, furnitureRect(item)), `${prop.id} × ${item.id}`).toBe(false)
      for (const other of props) if (other !== prop) expect(rectsOverlap(prop, other), `${prop.id} × ${other.id}`).toBe(false)
    }
    // The mats lie on the turf
    for (const mat of MATS) expect(Math.abs(mat.x - TURF.x) + mat.w / 2 <= TURF.w / 2 && Math.abs(mat.z - TURF.z) + mat.d / 2 <= TURF.d / 2, mat.id).toBe(true)
    // Wall props: on their wall, clear of the words, the mirror and each other
    const taken = [...WALL_ART, ...WALL_PIECES.filter((piece) => piece.look === 'mirror' || piece.look === 'mirrorFrame')]
    for (const prop of WALL_PROPS) {
      const half = WALLS[prop.wall].length / 2
      expect(prop.from >= -half && prop.to <= half && prop.bottom >= 0 && prop.top <= ROOM.height, prop.id).toBe(true)
      for (const thing of taken.filter((t) => t.wall === prop.wall)) expect(boxesOverlap(prop, thing), `${prop.id} × ${thing.id}`).toBe(false)
      for (const other of WALL_PROPS) if (other !== prop && other.wall === prop.wall) expect(boxesOverlap(prop, other), `${prop.id} × ${other.id}`).toBe(false)
    }
    // The TVs hang over the treadmill row, above head height on a treadmill
    const treadmills = DEFAULT_ITEMS.filter((item) => item.type === 'treadmill')
    const row = treadmills.flatMap((item) => [item.z - footprint(item).d / 2, item.z + footprint(item).d / 2]).map((z) => alongWall('right', 0, z))
    for (const tv of WALL_PROPS.filter((p) => p.kind === 'tv')) {
      expect(tv.wall).toBe('right')
      expect(tv.from).toBeGreaterThanOrEqual(Math.min(...row))
      expect(tv.to).toBeLessThanOrEqual(Math.max(...row))
      expect(tv.bottom).toBeGreaterThanOrEqual(1.8)
    }
  })

  it('L2B3-T2: every machine can still be walked to and used, with the props in the way', () => {
    const machines = furnitureObstacles()
    const usable = usableFrom(playerPose, machines, [...machines, ...propObstacles()])
    expect(DEFAULT_ITEMS.map((item) => item.id).filter((id) => !usable.has(id))).toEqual([])
  })

  it('L2B3-T3: the clock hands point the right way', () => {
    const quarter = Math.PI / 2
    const at = (h: number, m: number) => clockAngles(new Date(2026, 9, 7, h, m, 0))
    expect(at(3, 0).hour).toBeCloseTo(quarter) // 3:00: hour hand a quarter turn round…
    expect(at(3, 0).minute).toBeCloseTo(0) // …minute hand at 12
    expect(at(15, 0).hour).toBeCloseTo(quarter) // 3 pm is the same as 3 am on a clock face
    const sixThirty = at(6, 30)
    expect(sixThirty.hour).toBeCloseTo(6.5 * (Math.PI / 6)) // halfway between 6 and 7
    expect(sixThirty.minute).toBeCloseTo(Math.PI) // pointing at 6
    expect(clockAngles(new Date(2026, 9, 7, 0, 0, 15)).second).toBeCloseTo(quarter) // 15 s: a quarter turn
  })

  it('L2B3-T4: a plate tree stays at the end of its squat rack\'s bar, however the rack is moved or turned', () => {
    const racks: Furniture[] = [
      ...DEFAULT_ITEMS.filter((item) => item.type === 'squatRack'),
      ...[0, 1, 2, 3].map((turns) => ({ id: `r${turns}`, type: 'squatRack' as const, x: 1, z: 2, turns })),
    ]
    for (const rack of racks) {
      const tree = plateTreeFor(rack)
      const rect = furnitureRect(rack)
      expect(rectsOverlap(tree, rect), rack.id).toBe(false)
      // On the bar's line, just past the end of the rack
      const barAlongX = rack.turns % 2 === 0
      const length = barAlongX ? rect.w : rect.d
      const sideways = barAlongX ? tree.z - rack.z : tree.x - rack.x
      const along = barAlongX ? Math.abs(tree.x - rack.x) : Math.abs(tree.z - rack.z)
      expect(sideways, rack.id).toBeCloseTo(0)
      expect(along, rack.id).toBeCloseTo(length / 2 + TREE_GAP + PROP_SIZE.plateTree.w / 2)
    }
    // …and it turns WITH the rack, staying at the same end: one more quarter turn of
    // the rack swings the tree a quarter turn the same way the model turns
    // (three.js turns furniture by -turns × 90° about the vertical, taking (x, z) to (-z, x))
    for (const turns of [0, 1, 2, 3]) {
      const offset = (t: number) => {
        const tree = plateTreeFor({ id: 'r', type: 'squatRack', x: 1, z: 2, turns: t })
        return { x: tree.x - 1, z: tree.z - 2 }
      }
      const now = offset(turns)
      const next = offset((turns + 1) % 4)
      expect(next.x, `turns ${turns}`).toBeCloseTo(-now.z)
      expect(next.z, `turns ${turns}`).toBeCloseTo(now.x)
    }
  })

  it('L2B3-T5: the props stay under their draw budget', async () => {
    const { scene, unmount } = await renderScene(Props, {})
    expect(drawCount(scene)).toBeLessThanOrEqual(PROPS_DRAW_BUDGET)
    await unmount()
  }, SCENE_TIMEOUT)
})
