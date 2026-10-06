// What's on the walls: the dark lower band, the orange stripe, the slatted
// accent wall and the mirror. Plain data (no drawing), so tests can check it
// and moving a piece is a one-line change.
//
// Positions are in each wall's own frame, as seen from inside the room:
// `from`/`to` run left to right along the wall (0 = its middle), `bottom`/`top`
// are heights off the floor. On the back wall, "along" is the same as world x.
import { ROOM } from './dimensions'

const { width: W, depth: D, height: H } = ROOM

export type WallName = 'back' | 'front' | 'left' | 'right'

// Each wall is a flat surface facing into the room. Surfaces only show their
// front, so when the camera orbits outside a wall, that wall disappears and you
// can see in (the "dollhouse" view). Everything on a wall is flat and faces in
// too, so it disappears with its wall instead of floating in mid-air.
export const WALLS: Record<WallName, { length: number; position: [number, number, number]; rotationY: number }> = {
  back: { length: W, position: [0, H / 2, -D / 2], rotationY: 0 },
  front: { length: W, position: [0, H / 2, D / 2], rotationY: Math.PI },
  left: { length: D, position: [-W / 2, H / 2, 0], rotationY: Math.PI / 2 },
  right: { length: D, position: [W / 2, H / 2, 0], rotationY: -Math.PI / 2 },
}

export const WALL_COLORS = {
  band: '#2f3136', // dark charcoal, where people knock into walls
  panel: '#232428', // the accent wall behind the slats
  slat: '#9a7550', // warm wood
  mirrorFrame: '#1b1c1f',
} as const

// Pieces stack in layers: a higher layer sits in front of a lower one.
// Pieces in the same layer on the same wall must not overlap.
export type WallLook = 'band' | 'stripe' | 'panel' | 'slats' | 'mirrorFrame' | 'mirror'
export type WallPiece = {
  id: string
  wall: WallName
  look: WallLook
  from: number
  to: number
  bottom: number
  top: number
  layer: 1 | 2 | 3
}

export const BAND_TOP = 1.2
export const STRIPE_TOP = 1.35

// The accent wall: behind the squat racks, above the stripe, up to the ceiling
const ACCENT = { from: -1, to: 5.5 }

// The mirror: behind both dumbbell racks, from just above the floor to head height and more
export const MIRROR = { from: -5.5, to: -1.5, bottom: 0.3, top: 2.4 }
const FRAME = 0.05 // the dark frame showing round the glass

const allWalls = Object.keys(WALLS) as WallName[]

export const WALL_PIECES: WallPiece[] = [
  ...allWalls.flatMap((wall): WallPiece[] => {
    const half = WALLS[wall].length / 2
    return [
      { id: `${wall}-band`, wall, look: 'band', from: -half, to: half, bottom: 0, top: BAND_TOP, layer: 1 },
      { id: `${wall}-stripe`, wall, look: 'stripe', from: -half, to: half, bottom: BAND_TOP, top: STRIPE_TOP, layer: 1 },
    ]
  }),
  { id: 'accent-panel', wall: 'back', look: 'panel', ...ACCENT, bottom: STRIPE_TOP, top: H, layer: 1 },
  { id: 'accent-slats', wall: 'back', look: 'slats', ...ACCENT, bottom: STRIPE_TOP, top: H, layer: 2 },
  {
    id: 'mirror-frame',
    wall: 'back',
    look: 'mirrorFrame',
    from: MIRROR.from - FRAME,
    to: MIRROR.to + FRAME,
    bottom: MIRROR.bottom - FRAME,
    top: MIRROR.top + FRAME,
    layer: 2,
  },
  { id: 'mirror', wall: 'back', look: 'mirror', ...MIRROR, layer: 3 },
]

// The slats on a slatted piece: each one's left and right edge along the wall.
// Spread evenly, with the same gap at both ends as between slats.
export const SLAT_WIDTH = 0.07
export const SLAT_GAP = 0.07
export function slatSpans(piece: Pick<WallPiece, 'from' | 'to'>) {
  const count = Math.floor((piece.to - piece.from - SLAT_GAP) / (SLAT_WIDTH + SLAT_GAP))
  const used = count * SLAT_WIDTH + (count + 1) * SLAT_GAP
  const start = piece.from + (piece.to - piece.from - used) / 2 + SLAT_GAP
  return Array.from({ length: count }, (_, i) => {
    const left = start + i * (SLAT_WIDTH + SLAT_GAP)
    return { left, right: left + SLAT_WIDTH }
  })
}
