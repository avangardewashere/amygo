import { clamp } from '../lib/math'
import { createStore } from '../lib/store'
import { ROOM } from '../scene/dimensions'
import { CATALOG_DATA, type FurnitureType } from './catalogData'
import { applySavedLayout, readSavedLayout, saveLayout } from './layoutStorage'

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

// Pieces keep this far from the walls (declared up here: the store below uses it as it starts)
const WALL_GAP = 0.05

// The starting layout (also what Reset layout goes back to), grouped into zones
// like a real gym (see docs/PLAN-layout.md for the map). Facing: 0 turns faces
// the front wall (+z), 1 faces left (-x), 2 faces the back wall (-z), 3 faces right (+x).
export const DEFAULT_ITEMS: Furniture[] = [
  // Pull-up corner: back-left, towers against the back wall
  { id: 'pullup-1', type: 'pullupBar', x: -8.5, z: -5.25, turns: 2 },
  { id: 'pullup-2', type: 'pullupBar', x: -6.5, z: -5.25, turns: 2 },

  // Free weights: two dumbbell racks against the back wall (the mirror goes behind
  // them in L2), then two rows of benches facing them
  { id: 'rack-1', type: 'dumbbellRack', x: -4.25, z: -5.6, turns: 0 },
  { id: 'rack-2', type: 'dumbbellRack', x: -2.75, z: -5.6, turns: 0 },
  { id: 'adjbench-1', type: 'adjustableBench', x: -5, z: -3.75, turns: 2 },
  { id: 'adjbench-2', type: 'adjustableBench', x: -3.5, z: -3.75, turns: 2 },
  { id: 'adjbench-3', type: 'adjustableBench', x: -2, z: -3.75, turns: 2 },
  { id: 'bench-1', type: 'bench', x: -5, z: -1.5, turns: 2 },
  { id: 'bench-2', type: 'bench', x: -3.5, z: -1.5, turns: 2 },
  { id: 'bench-3', type: 'bench', x: -2, z: -1.5, turns: 2 },

  // Strength: two squat racks along the back wall; you face the wall to squat
  { id: 'squatrack-1', type: 'squatRack', x: 0.75, z: -5.4, turns: 2 },
  { id: 'squatrack-2', type: 'squatRack', x: 3.75, z: -5.4, turns: 2 },

  // Cable corner: back-right, side by side, towers against the back wall
  { id: 'cable-1', type: 'cableMachine', x: 6.25, z: -5, turns: 2 },
  { id: 'cable-2', type: 'cableMachine', x: 7.75, z: -5, turns: 2 },

  // Cardio: a row along the right wall, all facing it (the TVs go above them in L2)
  { id: 'treadmill-1', type: 'treadmill', x: 8.75, z: -2.25, turns: 3 },
  { id: 'treadmill-2', type: 'treadmill', x: 8.75, z: -1, turns: 3 },
  { id: 'treadmill-3', type: 'treadmill', x: 8.75, z: 0.25, turns: 3 },
  { id: 'treadmill-4', type: 'treadmill', x: 8.75, z: 1.5, turns: 3 },
  { id: 'bike-1', type: 'bike', x: 9.25, z: 2.75, turns: 3 },
  { id: 'bike-2', type: 'bike', x: 9.25, z: 3.75, turns: 3 },
  { id: 'bike-3', type: 'bike', x: 9.25, z: 4.75, turns: 3 },

  // Machines: along the left wall, backs to it, facing into the room
  { id: 'legpress-1', type: 'legPress', x: -9.25, z: -2.25, turns: 0 },
  { id: 'legpress-2', type: 'legPress', x: -9.25, z: 0.25, turns: 0 },
  { id: 'chestfly-1', type: 'chestFly', x: -9.25, z: 2.5, turns: 3 },
  { id: 'chestfly-2', type: 'chestFly', x: -9.25, z: 4, turns: 3 },

  // Rowing: front-left, side by side
  { id: 'rower-1', type: 'rower', x: -7, z: 4.5, turns: 0 },
  { id: 'rower-2', type: 'rower', x: -6, z: 4.5, turns: 0 },
  { id: 'rower-3', type: 'rower', x: -5, z: 4.5, turns: 0 },
]

const store = createStore<BuildState>({
  mode: 'play',
  // Where you left everything last time (this browser), or the starting layout.
  // Pieces are kept inside the room in case it has changed size since.
  items: applySavedLayout(DEFAULT_ITEMS, readSavedLayout()).map((item) => fitInRoom(item)),
  selectedId: null,
  drag: null,
})

export const useBuild = <S>(select: (s: BuildState) => S) => store.useSelect(select)
export const getBuild = store.get

export const GRID = 0.25 // furniture snaps to a 25 cm grid

const snap = (value: number) => Math.round(value / GRID) * GRID

const findItem = (id: string) => store.get().items.find((item) => item.id === id)

const withItem = (next: Furniture) =>
  store.get().items.map((item) => (item.id === next.id ? next : item))

// Width/depth on the floor after rotating: a quarter turn swaps them
export function footprint(item: Furniture) {
  const { width, depth } = CATALOG_DATA[item.type]
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
// (a function declaration, so the store can use it while it's being created)
function fitInRoom(item: Furniture): Furniture {
  const { w, d } = footprint(item)
  const limitX = ROOM.width / 2 - w / 2 - WALL_GAP
  const limitZ = ROOM.depth / 2 - d / 2 - WALL_GAP
  return {
    ...item,
    x: clamp(item.x, -limitX, limitX),
    z: clamp(item.z, -limitZ, limitZ),
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
  saveLayout(items)
}

export function rotateSelected() {
  const { selectedId } = store.get()
  const item = selectedId && findItem(selectedId)
  if (!item) return
  const next = fitInRoom({ ...item, turns: (item.turns + 1) % 4 })
  if (overlapsOthers(next)) return
  const items = withItem(next)
  store.set({ items })
  saveLayout(items)
}

// Put every piece back where it started (and remember that)
export function resetLayout() {
  store.set({ items: DEFAULT_ITEMS, selectedId: null, drag: null })
  saveLayout(DEFAULT_ITEMS)
}

// Solid rectangles the person can't walk through (and can stand next to, to use)
export function furnitureObstacles() {
  return store.get().items.map((item) => ({ id: item.id, type: item.type, x: item.x, z: item.z, ...footprint(item) }))
}
