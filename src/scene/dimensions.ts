// Room size in meters. One Three.js unit = one meter.
// Everything else in the scene reads from here, so resizing the gym is a one-line change.
export const ROOM = {
  width: 20, // x axis (long side)
  depth: 12, // z axis
  height: 4.5, // y axis
} as const

export const COLORS = {
  floor: '#2a2c30', // rubber gym flooring
  wall: '#d9d6cf',
  accent: '#e4572e', // stripe along the walls
  ceiling: '#bfbcb5',
} as const
