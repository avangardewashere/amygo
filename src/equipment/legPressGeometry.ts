// Measurements of the leg press, shared by the machine model and the person's
// leg animation so the feet and the footplate always meet.
// All positions are in the machine's own coordinates: you sit facing +z.

const SLED_ANGLE = (40 * Math.PI) / 180 // the sled slides up and away at 40°

export const PRESS = {
  hipY: 0.55, // where the hips sit
  hipZ: -0.5,
  lean: 0.9, // backrest recline, radians back from upright (~50°)
  angle: SLED_ANGLE,
  // Direction the sled travels, split into forward (z) and up (y) parts
  dirZ: Math.cos(SLED_ANGLE),
  dirY: Math.sin(SLED_ANGLE),
  extended: 0.74, // hip → foot distance with legs (almost) straight
  bent: 0.46, // hip → foot distance at the bottom of the rep
}

// t: 0 = legs extended (start of the rep), 1 = knees bent (bottom)
export const pressDistance = (t: number) => PRESS.extended - (PRESS.extended - PRESS.bent) * t

// Foot point (the heel, just above the sole) to the footplate's surface
export const FOOT_TO_PLATE = 0.03

// A point along the sled's path, `d` meters from the hips, shifted `below`
// meters underneath it. Returns [y, z].
export function alongSled(d: number, below = 0): [number, number] {
  return [PRESS.hipY + PRESS.dirY * d - PRESS.dirZ * below, PRESS.hipZ + PRESS.dirZ * d + PRESS.dirY * below]
}

// Where the footplate is at point t of a rep, as [y, z]
export const plateCenter = (t: number) => alongSled(pressDistance(t) + FOOT_TO_PLATE)
