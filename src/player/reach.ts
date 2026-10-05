// Where the person can walk, and which machine they can use. Pure functions
// over the list of furniture rectangles, so they can be tested on their own.

// A piece of furniture as a rectangle on the floor (center + size)
export type Obstacle = { id: string; x: number; z: number; w: number; d: number }

export const BODY_RADIUS = 0.3 // the person keeps this far from walls and furniture
export const FURNITURE_REACH = 0.7 // meters from a machine's edge

// Is this spot inside a piece of furniture (with room for the body)?
export function blocked(x: number, z: number, obstacles: Obstacle[]) {
  return obstacles.some(
    (o) => Math.abs(x - o.x) < o.w / 2 + BODY_RADIUS && Math.abs(z - o.z) < o.d / 2 + BODY_RADIUS,
  )
}

// The closest piece of furniture whose edge is within reach, if any
// (when two machines stand side by side, you use the one you're nearest to)
export function closestInReach(x: number, z: number, obstacles: Obstacle[]) {
  let closest: string | null = null
  let closestDistance = FURNITURE_REACH
  for (const o of obstacles) {
    // Distance from a point to a rectangle's edge (0 inside it)
    const dx = Math.max(Math.abs(x - o.x) - o.w / 2, 0)
    const dz = Math.max(Math.abs(z - o.z) - o.d / 2, 0)
    const distance = Math.hypot(dx, dz)
    if (distance < closestDistance) {
      closest = o.id
      closestDistance = distance
    }
  }
  return closest
}
