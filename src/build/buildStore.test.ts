import { beforeEach, describe, expect, it, vi } from 'vitest'

// The build state is shared app-wide, so every test loads a fresh copy of it
// (vi.resetModules) instead of carrying moves over from the previous test.
let build: typeof import('./buildStore')
beforeEach(async () => {
  vi.resetModules()
  build = await import('./buildStore')
})

const rack = () => build.getBuild().items.find((item) => item.id === 'rack-1')!

// Drag the rack by grabbing its middle and letting go over (x, z)
function dragRackTo(x: number, z: number) {
  const start = rack()
  build.startDrag(start.id, start.x, start.z)
  build.dragTo(x, z)
}

describe('build mode', () => {
  it('B0-T4a: furniture snaps to the 25 cm grid', () => {
    dragRackTo(-0.87, 0.13)
    build.endDrag()
    expect(rack().x).toBe(-0.75)
    expect(rack().z).toBe(0.25)
  })

  it('B0-T4b: furniture cannot be dragged out of the room', () => {
    dragRackTo(100, 100)
    build.endDrag()
    // 20 × 12 m room; the rack is 1.3 × 0.7 m and keeps 5 cm from the walls
    expect(rack().x).toBeCloseTo(10 - 0.65 - 0.05)
    expect(rack().z).toBeCloseTo(6 - 0.35 - 0.05)
  })

  it('B0-T4c: dropping onto another piece is refused, and it snaps back', () => {
    const start = { ...rack() }
    const bench = build.getBuild().items.find((item) => item.type === 'bench')!
    dragRackTo(bench.x, bench.z)
    expect(build.getBuild().drag?.valid).toBe(false) // shown red while over the bench
    build.endDrag()
    expect(rack().x).toBe(start.x)
    expect(rack().z).toBe(start.z)
  })

  it('B0-T4d: rotating a quarter turn swaps its width and depth', () => {
    const before = build.footprint(rack())
    build.select('rack-1')
    build.rotateSelected()
    const after = build.footprint(rack())
    expect(rack().turns).toBe(1)
    expect(after.w).toBe(before.d)
    expect(after.d).toBe(before.w)
  })
})
