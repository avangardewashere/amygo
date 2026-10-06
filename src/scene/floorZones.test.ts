import { describe, expect, it } from 'vitest'
import { DEFAULT_ITEMS, footprint, furnitureObstacles, type Furniture } from '../build/buildStore'
import { usableFrom } from '../build/walkable'
import { playerPose } from '../interaction/gymStore'
import { ROOM } from './dimensions'
import {
  CARDIO_TILES,
  FIXED_ZONES,
  PLATFORM_FRONT_BACK,
  PLATFORM_SIDE,
  TURF,
  TURF_LINES,
  WALKWAY_LINES,
  platformFor,
  rectsOverlap,
  type FloorRect,
} from './floorZones'

const racks = DEFAULT_ITEMS.filter((item) => item.type === 'squatRack')
const edges = ({ x, z, w, d }: FloorRect) => ({ left: x - w / 2, right: x + w / 2, back: z - d / 2, front: z + d / 2 })
const inside = (outer: FloorRect, inner: FloorRect) => {
  const o = edges(outer)
  const i = edges(inner)
  const e = 1e-9
  return i.left >= o.left - e && i.right <= o.right + e && i.back >= o.back - e && i.front <= o.front + e
}
const ROOM_RECT: FloorRect = { x: 0, z: 0, w: ROOM.width, d: ROOM.depth }

describe('the floor marks the zones', () => {
  it('L1B2-T1: every floor zone lies inside the room', () => {
    const all = [TURF, CARDIO_TILES, ...TURF_LINES, ...WALKWAY_LINES, ...racks.flatMap((rack) => Object.values(platformFor(rack)))]
    for (const rect of all) expect(inside(ROOM_RECT, rect), JSON.stringify(rect)).toBe(true)
  })

  it('L1B2-T2: a platform sticks out past its rack on every side (except into a wall), even moved or turned', () => {
    const cases: Furniture[] = [
      ...racks,
      { id: 'moved', type: 'squatRack', x: 1, z: 2, turns: 1 }, // middle of the room, turned
      { id: 'side', type: 'squatRack', x: -9.4, z: 0, turns: 3 }, // turned, against the left wall
    ]
    for (const rack of cases) {
      const { rubber, wood } = platformFor(rack)
      const r = edges({ x: rack.x, z: rack.z, w: footprint(rack).w, d: footprint(rack).d })
      const p = edges(rubber)
      const sideways = rack.turns % 2 === 1
      const marginX = sideways ? PLATFORM_FRONT_BACK : PLATFORM_SIDE
      const marginZ = sideways ? PLATFORM_SIDE : PLATFORM_FRONT_BACK
      // Each side: out by the full margin, or stopped by the wall
      const ok = (edge: number, wanted: number, wall: number) =>
        Math.abs(edge - wanted) < 1e-9 || Math.abs(edge - wall) < 1e-9
      expect(ok(p.left, r.left - marginX, -ROOM.width / 2), `${rack.id} left`).toBe(true)
      expect(ok(p.right, r.right + marginX, ROOM.width / 2), `${rack.id} right`).toBe(true)
      expect(ok(p.back, r.back - marginZ, -ROOM.depth / 2), `${rack.id} back`).toBe(true)
      expect(ok(p.front, r.front + marginZ, ROOM.depth / 2), `${rack.id} front`).toBe(true)
      // The wooden strip is on the platform, centered on the rack across the bar
      expect(inside(rubber, wood), `${rack.id} wood`).toBe(true)
      expect(sideways ? wood.z : wood.x).toBeCloseTo(sideways ? rack.z : rack.x)
    }
  })

  it('L1B2-T3: zones that stay put overlap neither each other nor the platforms', () => {
    const fixed = [...Object.values(FIXED_ZONES), ...WALKWAY_LINES]
    const platforms = racks.map((rack) => platformFor(rack).rubber)
    const all = [...fixed, ...platforms]
    for (const a of all) for (const b of all) if (a !== b) expect(rectsOverlap(a, b), `${JSON.stringify(a)} × ${JSON.stringify(b)}`).toBe(false)
    // The turf's lines stay on the turf
    for (const line of TURF_LINES) expect(inside(TURF, line)).toBe(true)
  })

  it('L1B2-T4: zones never block walking: every machine is still usable', () => {
    // Floor zones aren't obstacles at all; only furniture is
    expect(furnitureObstacles()).toHaveLength(DEFAULT_ITEMS.length)
    expect([...usableFrom(playerPose, furnitureObstacles())].sort()).toEqual(DEFAULT_ITEMS.map((item) => item.id).sort())
  })

  it('L1B2-T5: cardio machines stand fully on the cardio tiles, and nothing else is on the tiles or the turf', () => {
    for (const item of DEFAULT_ITEMS) {
      const rect = { x: item.x, z: item.z, ...footprint(item) }
      const cardio = item.type === 'treadmill' || item.type === 'bike'
      expect(inside(CARDIO_TILES, rect), `${item.id} on the cardio tiles`).toBe(cardio)
      if (!cardio) expect(rectsOverlap(CARDIO_TILES, rect), `${item.id} touches the cardio tiles`).toBe(false)
      expect(rectsOverlap(TURF, rect), `${item.id} on the turf`).toBe(false)
    }
  })
})
