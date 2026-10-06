import { describe, expect, it } from 'vitest'
import type { Mesh } from 'three'
import { DEFAULT_ITEMS, footprint } from '../build/buildStore'
import { drawCount, renderScene } from '../test/renderScene'
import { ROOM } from './dimensions'
import { Walls } from './Walls'
import { MIRROR, WALLS, WALL_PIECES, slatSpans } from './wallDesign'

// Building the scene takes ~1 s; give it room when the laptop is busy (it timed out at the 5 s default)
const SCENE_TIMEOUT = 20_000

// Measured 2026-10-07: 17 draws for the four walls and everything on them, plus 30 % (as D4)
export const WALLS_DRAW_BUDGET = 22

const E = 1e-9

describe('wall finishes and a mirror', () => {
  it('L2B1-T1: every wall piece lies within its wall and the room height', () => {
    for (const piece of WALL_PIECES) {
      const half = WALLS[piece.wall].length / 2
      expect(piece.from, piece.id).toBeGreaterThanOrEqual(-half - E)
      expect(piece.to, piece.id).toBeLessThanOrEqual(half + E)
      expect(piece.bottom, piece.id).toBeGreaterThanOrEqual(0)
      expect(piece.top, piece.id).toBeLessThanOrEqual(ROOM.height + E)
      expect(piece.to, piece.id).toBeGreaterThan(piece.from)
      expect(piece.top, piece.id).toBeGreaterThan(piece.bottom)
    }
  })

  it('L2B1-T2: the mirror is on the back wall, behind both dumbbell racks, covering their full width', () => {
    const mirror = WALL_PIECES.find((piece) => piece.look === 'mirror')!
    expect(mirror.wall).toBe('back')
    const racks = DEFAULT_ITEMS.filter((item) => item.type === 'dumbbellRack')
    expect(racks).toHaveLength(2)
    for (const rack of racks) {
      const { w, d } = footprint(rack)
      // Against the back wall (on the back wall, "along" is world x)…
      expect(rack.z - d / 2, rack.id).toBeLessThan(-ROOM.depth / 2 + 0.2)
      // …and the mirror spans it with room to spare
      expect(rack.x - w / 2, rack.id).toBeGreaterThan(MIRROR.from)
      expect(rack.x + w / 2, rack.id).toBeLessThan(MIRROR.to)
    }
    // Starts low enough to see the dumbbells in it, ends above head height
    expect(MIRROR.bottom).toBeLessThanOrEqual(0.5)
    expect(MIRROR.top).toBeGreaterThan(2)
  })

  it('L2B1-T3: pieces on the same wall only overlap when they stack on different layers', () => {
    for (const a of WALL_PIECES) {
      for (const b of WALL_PIECES) {
        if (a === b || a.wall !== b.wall || a.layer !== b.layer) continue
        const overlap = a.from < b.to - E && b.from < a.to - E && a.bottom < b.top - E && b.bottom < a.top - E
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false)
      }
    }
    // The stripe sits right on top of the band
    for (const wall of Object.keys(WALLS)) {
      const band = WALL_PIECES.find((piece) => piece.id === `${wall}-band`)!
      const stripe = WALL_PIECES.find((piece) => piece.id === `${wall}-stripe`)!
      expect(stripe.bottom).toBe(band.top)
    }
    // Slats stay on their panel and don't touch each other
    for (const piece of WALL_PIECES.filter((p) => p.look === 'slats')) {
      const spans = slatSpans(piece)
      expect(spans.length).toBeGreaterThan(10)
      spans.forEach((span, i) => {
        expect(span.left).toBeGreaterThan(piece.from)
        expect(span.right).toBeLessThan(piece.to)
        if (i > 0) expect(span.left).toBeGreaterThan(spans[i - 1].right)
      })
    }
  })

  it('L2B1-T4: the walls stay under their draw budget, and the whole slat wall is one draw', async () => {
    const { scene, unmount } = await renderScene(Walls, {})
    expect(drawCount(scene)).toBeLessThanOrEqual(WALLS_DRAW_BUDGET)
    const slatCount = slatSpans(WALL_PIECES.find((p) => p.look === 'slats')!).length
    // Each slat is 2 triangles; one mesh must hold them all
    const slatMeshes: Mesh[] = []
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh && (mesh.geometry.index?.count ?? 0) === slatCount * 6) slatMeshes.push(mesh)
    })
    expect(slatMeshes).toHaveLength(1)
    await unmount()
  }, SCENE_TIMEOUT)
})
