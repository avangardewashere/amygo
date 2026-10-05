import { describe, expect, it } from 'vitest'
import { blocked, closestInReach, type Obstacle } from './reach'

// Two machines either side of a person standing at (0, 0):
// a bench whose edge is 0.6 m away, and a chest fly whose edge is 0.55 m away
const bench: Obstacle = { id: 'bench', x: 0.9, z: 0, w: 0.6, d: 1.3 }
const chestFly: Obstacle = { id: 'chestFly', x: -1.2, z: 0, w: 1.3, d: 1.3 }

describe('which machine you can use', () => {
  it('B0-T5a: with two machines in reach, the closest one wins (whatever order they are listed in)', () => {
    expect(closestInReach(0, 0, [bench, chestFly])).toBe('chestFly')
    expect(closestInReach(0, 0, [chestFly, bench])).toBe('chestFly')
  })

  it('B0-T5b: nothing is in reach when every machine is too far away', () => {
    expect(closestInReach(5, 5, [bench, chestFly])).toBeNull()
  })

  it('B0-T5c: furniture is solid, with room left for the body', () => {
    expect(blocked(0.9, 0, [bench])).toBe(true) // standing inside the bench
    expect(blocked(0.9 - 0.55, 0, [bench])).toBe(true) // body overlapping its edge
    expect(blocked(0, 0, [bench])).toBe(false) // just beside it
  })
})
