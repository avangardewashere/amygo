// Where the floor changes look: the turf lane, the cardio tiles, walkway lines,
// and a lifting platform under each squat rack. Plain rectangles (no drawing),
// so tests can check them and moving a zone is a one-line change.
// Floor zones are flat: the person walks on them, they never block anyone.
import { MathUtils } from 'three'
import { footprint, type Furniture } from '../build/buildStore'
import { ROOM } from './dimensions'

// A rectangle on the floor: center and size, in meters (w along x, d along z)
export type FloorRect = { x: number; z: number; w: number; d: number }

export const FLOOR_COLORS = {
  turf: '#3f6b3a',
  turfLine: '#e8e8e2',
  cardioTiles: '#45484e', // lighter rubber than the rest of the floor
  walkwayLine: '#e3b729',
  platformRubber: '#1c1d20',
  platformWood: '#b08a5a',
} as const

// Rectangle from its edges (easier to read when laying out the room)
const fromEdges = (left: number, right: number, back: number, front: number): FloorRect => ({
  x: (left + right) / 2,
  z: (back + front) / 2,
  w: right - left,
  d: front - back,
})

// The middle of the room: open floor for stretching and sled pushes (props in L2)
export const TURF = fromEdges(-0.75, 6.75, -1.75, 0.75)

// Under the treadmills and bikes along the right wall
export const CARDIO_TILES = fromEdges(7.5, ROOM.width / 2, -3, 5.25)

const LINE = 0.06 // painted line width

// Turf markings: a border, and a line across every 2.5 m (like a sprint lane)
export const TURF_LINES: FloorRect[] = [
  fromEdges(TURF.x - TURF.w / 2, TURF.x + TURF.w / 2, TURF.z - TURF.d / 2, TURF.z - TURF.d / 2 + LINE),
  fromEdges(TURF.x - TURF.w / 2, TURF.x + TURF.w / 2, TURF.z + TURF.d / 2 - LINE, TURF.z + TURF.d / 2),
  ...[0, 2.5, 5, 7.5].map((along) => {
    const x = MathUtils.clamp(TURF.x - TURF.w / 2 + along, TURF.x - TURF.w / 2 + LINE / 2, TURF.x + TURF.w / 2 - LINE / 2)
    return { x, z: TURF.z, w: LINE, d: TURF.d }
  }),
]

// The way in: two yellow lines from the front wall up to the turf
export const WALKWAY_LINES: FloorRect[] = [0.5, 2.5].map((x) => fromEdges(x - LINE / 2, x + LINE / 2, 1.25, 5.75))

// Zones that never move (squat-rack platforms move with their rack)
export const FIXED_ZONES = { turf: TURF, cardioTiles: CARDIO_TILES }

// A lifting platform: rubber all round, a wooden strip in the middle where you
// stand. It sticks out past the rack on every side (in the rack's own frame:
// PLATFORM_SIDE at the ends of the bar, PLATFORM_FRONT_BACK in front and behind),
// trimmed where it would go through a wall.
export const PLATFORM_SIDE = 0.3
export const PLATFORM_FRONT_BACK = 0.6
const WOOD_SHARE = 0.45 // the wooden strip's share of the platform's length along the bar

export function platformFor(rack: Furniture): { rubber: FloorRect; wood: FloorRect } {
  const { w, d } = footprint(rack)
  const sideways = rack.turns % 2 === 1 // a quarter turn swaps which margin goes along x
  const marginX = sideways ? PLATFORM_FRONT_BACK : PLATFORM_SIDE
  const marginZ = sideways ? PLATFORM_SIDE : PLATFORM_FRONT_BACK
  const rubber = fromEdges(
    Math.max(rack.x - w / 2 - marginX, -ROOM.width / 2),
    Math.min(rack.x + w / 2 + marginX, ROOM.width / 2),
    Math.max(rack.z - d / 2 - marginZ, -ROOM.depth / 2),
    Math.min(rack.z + d / 2 + marginZ, ROOM.depth / 2),
  )
  // The wood runs front to back, across the bar, centered on the rack
  const wood = sideways
    ? { x: rubber.x, z: rack.z, w: rubber.w, d: rubber.d * WOOD_SHARE }
    : { x: rack.x, z: rubber.z, w: rubber.w * WOOD_SHARE, d: rubber.d }
  return { rubber, wood }
}

// Do two floor rectangles overlap (touching edges don't count)?
export const rectsOverlap = (a: FloorRect, b: FloorRect) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-9 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-9
