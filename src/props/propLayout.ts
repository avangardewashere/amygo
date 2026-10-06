// Where the props go: the small things that make a gym feel used. Plain data
// and maths (no drawing), so tests can check them.
//
// Props are decoration (D7): you can't drag them and they have no menu. Floor
// props are solid, so the person walks round them, but they never count as
// something to use (that's machines only).
import { footprint, getBuild, type Furniture } from '../build/buildStore'
import type { Obstacle } from '../player/reach'
import type { WallName } from '../scene/wallDesign'

export type FloorPropKind = 'plateTree' | 'kettlebellShelf' | 'sled' | 'waterFountain' | 'plant'
export type FloorProp = { id: string; kind: FloorPropKind; x: number; z: number; w: number; d: number; turns: number }

// Size on the floor of each solid prop (w along x, d along z, before turning)
export const PROP_SIZE: Record<FloorPropKind, { w: number; d: number }> = {
  plateTree: { w: 0.5, d: 0.5 },
  kettlebellShelf: { w: 1.4, d: 0.45 },
  sled: { w: 0.7, d: 0.9 },
  waterFountain: { w: 0.45, d: 0.35 },
  plant: { w: 0.5, d: 0.5 },
}

const prop = (id: string, kind: FloorPropKind, x: number, z: number, turns = 0): FloorProp => {
  const { w, d } = PROP_SIZE[kind]
  return { id, kind, x, z, turns, ...(turns % 2 === 1 ? { w: d, d: w } : { w, d }) }
}

// Props that never move (facing: 0 turns faces the front wall, like furniture)
export const FIXED_PROPS: FloorProp[] = [
  // Just off the back edge of the turf, facing it
  prop('kettlebells', 'kettlebellShelf', 2.5, -2.1),
  // On the turf, at the far end, ready to push toward the front
  prop('sled', 'sled', 5.9, -0.5),
  // By the way in, against the front wall, facing into the room
  prop('fountain', 'waterFountain', -2, 5.75, 2),
  // Corners: beside the bikes, and by the way in
  prop('plant-1', 'plant', 9.6, 5.6),
  prop('plant-2', 'plant', 3.25, 5.6),
]

// Mats and foam rollers lie flat on the turf: you walk over them, so they're not solid
export const MATS = [
  { id: 'mat-1', x: 3.1, z: -1.05, w: 1.8, d: 0.62 },
  { id: 'mat-2', x: 3.1, z: -0.2, w: 1.8, d: 0.62 },
]

// A plate tree stands at one end of its squat rack's bar, a little apart.
// Worked out in the rack's own frame and turned with it, so it follows the rack.
export const TREE_GAP = 0.1
export function plateTreeFor(rack: Furniture): FloorProp {
  const along = rack.turns % 2 === 1 ? footprint(rack).d : footprint(rack).w // the rack's length along its bar
  const local = along / 2 + TREE_GAP + PROP_SIZE.plateTree.w / 2
  const angle = -rack.turns * (Math.PI / 2)
  // Turn the local point (local, 0) the way the rack is turned
  const x = rack.x + local * Math.cos(angle)
  const z = rack.z - local * Math.sin(angle)
  return prop(`tree-${rack.id}`, 'plateTree', x, z, rack.turns)
}

export function floorProps(items: Furniture[] = getBuild().items): FloorProp[] {
  return [...FIXED_PROPS, ...items.filter((item) => item.type === 'squatRack').map(plateTreeFor)]
}

// Solid rectangles for walking round (never for "what can I use")
export const propObstacles = (items?: Furniture[]): Obstacle[] =>
  floorProps(items).map(({ id, x, z, w, d }) => ({ id, x, z, w, d }))

// Things on the walls, in each wall's frame (see wallDesign.ts)
export type WallPropKind = 'tv' | 'clock' | 'speaker'
export type WallProp = { id: string; kind: WallPropKind; wall: WallName; from: number; to: number; bottom: number; top: number }

export const WALL_PROPS: WallProp[] = [
  // Above the treadmills, under CARDIO (right wall: "along" is world z)
  { id: 'tv-1', kind: 'tv', wall: 'right', from: -2.4, to: -1.1, bottom: 1.85, top: 2.6 },
  { id: 'tv-2', kind: 'tv', wall: 'right', from: 0.1, to: 1.4, bottom: 1.85, top: 2.6 },
  // Left wall, between the motto and the back corner, high up
  { id: 'clock', kind: 'clock', wall: 'left', from: 3.95, to: 4.45, bottom: 2.8, top: 3.3 },
  // Up in the back corners
  { id: 'speaker-1', kind: 'speaker', wall: 'back', from: -9.6, to: -9.25, bottom: 3.5, top: 4.0 },
  { id: 'speaker-2', kind: 'speaker', wall: 'back', from: 9.25, to: 9.6, bottom: 3.5, top: 4.0 },
]

// Clock hands, as angles clockwise from 12 o'clock (radians), from the time of day
export function clockAngles(date: Date) {
  const seconds = date.getSeconds() + date.getMilliseconds() / 1000
  const minutes = date.getMinutes() + seconds / 60
  const hours = (date.getHours() % 12) + minutes / 60
  const turn = 2 * Math.PI
  return { hour: (hours / 12) * turn, minute: (minutes / 60) * turn, second: (seconds / 60) * turn }
}
