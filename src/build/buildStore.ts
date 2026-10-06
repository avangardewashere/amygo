import { MathUtils } from 'three'
import { createStore } from '../lib/store'
import { ROOM } from '../scene/dimensions'
import { CATALOG, type FurnitureType } from './catalog'

// Build mode: like the Sims, the game pauses and you arrange furniture.

export type Furniture = {
  id: string
  type: FurnitureType
  x: number // center of its floor footprint
  z: number
  turns: number // quarter turns clockwise: 0, 1, 2 or 3
}

type Drag = { id: string; valid: boolean }

type BuildState = {
  mode: 'play' | 'build'
  items: Furniture[]
  selectedId: string | null
  drag: Drag | null // the piece being dragged right now, and whether its spot is free
}

const store = createStore<BuildState>({
  mode: 'play',
  // Both start against the back wall: the rack facing into the room, the
  // treadmill turned around (2 quarter turns) so its runner faces the wall
  items: [
    { id: 'rack-1', type: 'dumbbellRack', x: -3, z: -5.6, turns: 0 },
    { id: 'treadmill-1', type: 'treadmill', x: 4, z: -4.75, turns: 2 },
    // Along the left side of the room, facing the front wall
    { id: 'legpress-1', type: 'legPress', x: -7.5, z: 3, turns: 0 },
    { id: 'bench-1', type: 'bench', x: 2.5, z: 3.5, turns: 0 },
    // Beside it, to its left
    { id: 'adjbench-1', type: 'adjustableBench', x: 1, z: 3.5, turns: 0 },
    // Back to the right-hand wall, facing into the room (1 quarter turn = facing -x)
    { id: 'chestfly-1', type: 'chestFly', x: 8.5, z: 1, turns: 1 },
    // Beside the treadmill, facing the back wall like it does
    { id: 'bike-1', type: 'bike', x: 5.25, z: -4.9, turns: 2 },
    // Along the left wall, between the leg press and the back corner
    { id: 'rower-1', type: 'rower', x: -9.25, z: -1.5, turns: 0 },
  ],
  selectedId: null,
  drag: null,
})

export const useBuild = <S>(select: (s: BuildState) => S) => store.useSelect(select)
export const getBuild = store.get

export const GRID = 0.25 // furniture snaps to a 25 cm grid
const WALL_GAP = 0.05

const snap = (value: number) => Math.round(value / GRID) * GRID

const findItem = (id: string) => store.get().items.find((item) => item.id === id)

const withItem = (next: Furniture) =>
  store.get().items.map((item) => (item.id === next.id ? next : item))

// Width/depth on the floor after rotating: a quarter turn swaps them
export function footprint(item: Furniture) {
  const { width, depth } = CATALOG[item.type]
  return item.turns % 2 === 1 ? { w: depth, d: width } : { w: width, d: depth }
}

// Two rectangles overlap when they overlap on both the x and z axes
function overlapsOthers(item: Furniture) {
  const a = footprint(item)
  return store.get().items.some((other) => {
    if (other.id === item.id) return false
    const b = footprint(other)
    return Math.abs(item.x - other.x) < (a.w + b.w) / 2 && Math.abs(item.z - other.z) < (a.d + b.d) / 2
  })
}

// Slide a piece back inside the walls if any part of it pokes through
function fitInRoom(item: Furniture): Furniture {
  const { w, d } = footprint(item)
  const limitX = ROOM.width / 2 - w / 2 - WALL_GAP
  const limitZ = ROOM.depth / 2 - d / 2 - WALL_GAP
  return {
    ...item,
    x: MathUtils.clamp(item.x, -limitX, limitX),
    z: MathUtils.clamp(item.z, -limitZ, limitZ),
  }
}

export function toggleBuildMode() {
  const { mode } = store.get()
  store.set({ mode: mode === 'play' ? 'build' : 'play', selectedId: null, drag: null })
}

export function select(id: string | null) {
  if (store.get().selectedId !== id) store.set({ selectedId: id })
}

// Remembered between dragTo calls: where the finger grabbed the piece, and
// where the piece was before the drag (to snap back if dropped somewhere taken)
let grab = { offsetX: 0, offsetZ: 0, startX: 0, startZ: 0 }

// floorX/floorZ: the point on the floor under the pointer
export function startDrag(id: string, floorX: number, floorZ: number) {
  const item = findItem(id)
  if (!item) return
  // Keep the grab offset so the piece doesn't jump to center itself on the pointer
  grab = { offsetX: item.x - floorX, offsetZ: item.z - floorZ, startX: item.x, startZ: item.z }
  store.set({ selectedId: id, drag: { id, valid: true } })
}

export function dragTo(floorX: number, floorZ: number) {
  const drag = store.get().drag
  const item = drag && findItem(drag.id)
  if (!drag || !item) return
  const next = fitInRoom({ ...item, x: snap(floorX + grab.offsetX), z: snap(floorZ + grab.offsetZ) })
  if (next.x === item.x && next.z === item.z) return // still in the same grid cell
  store.set({ items: withItem(next), drag: { id: drag.id, valid: !overlapsOthers(next) } })
}

export function endDrag() {
  const drag = store.get().drag
  const item = drag && findItem(drag.id)
  if (!drag || !item) return
  // Dropped on a taken spot: put it back where it started
  const items = drag.valid ? store.get().items : withItem({ ...item, x: grab.startX, z: grab.startZ })
  store.set({ items, drag: null })
}

export function rotateSelected() {
  const { selectedId } = store.get()
  const item = selectedId && findItem(selectedId)
  if (!item) return
  const next = fitInRoom({ ...item, turns: (item.turns + 1) % 4 })
  if (!overlapsOthers(next)) store.set({ items: withItem(next) })
}

// Solid rectangles the person can't walk through (and can stand next to, to use)
export function furnitureObstacles() {
  return store.get().items.map((item) => ({ id: item.id, type: item.type, x: item.x, z: item.z, ...footprint(item) }))
}
