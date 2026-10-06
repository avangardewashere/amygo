// Which machines the person can actually walk up to and use. Pure, so the
// starting layout (and later floor zones and props) can be checked by tests.
import { ROOM } from '../scene/dimensions'
import { BODY_RADIUS, blocked, closestInReach, type Obstacle } from '../player/reach'

const STEP = 0.25 // the build grid: fine enough to find any gap the body fits through

// Every machine the person can use, walking from `start`: flood out over the
// floor in grid steps, never through furniture or walls, and at each spot ask
// the same question the game asks ("which machine is closest in reach?").
// A machine hidden behind its neighbours never wins that question, so it
// can't be used, even if its edge is close.
export function usableFrom(start: { x: number; z: number }, obstacles: Obstacle[]) {
  const limitX = ROOM.width / 2 - BODY_RADIUS
  const limitZ = ROOM.depth / 2 - BODY_RADIUS
  const key = (i: number, j: number) => `${i},${j}`
  const first = { i: Math.round(start.x / STEP), j: Math.round(start.z / STEP) }

  const seen = new Set([key(first.i, first.j)])
  const queue = [first]
  const usable = new Set<string>()
  while (queue.length > 0) {
    const { i, j } = queue.pop()!
    const x = i * STEP
    const z = j * STEP
    const near = closestInReach(x, z, obstacles)
    if (near) usable.add(near)
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { i: i + di, j: j + dj }
      const nx = next.i * STEP
      const nz = next.j * STEP
      if (seen.has(key(next.i, next.j))) continue
      if (Math.abs(nx) > limitX || Math.abs(nz) > limitZ || blocked(nx, nz, obstacles)) continue
      seen.add(key(next.i, next.j))
      queue.push(next)
    }
  }
  return usable
}
