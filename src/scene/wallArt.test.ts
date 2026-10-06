import { describe, expect, it } from 'vitest'
import { DEFAULT_ITEMS, footprint } from '../build/buildStore'
import type { FurnitureType } from '../build/catalog'
import { ROOM } from './dimensions'
import { MAX_TEXTURE, PIXELS_PER_METER, SIDE_MARGIN, canvasSize, fitFont } from './paintText'
import { GYM_NAME, WALLS, WALL_ART, WALL_PIECES, alongWall, type WallArt } from './wallDesign'

const E = 1e-9
type Box = { from: number; to: number; bottom: number; top: number }
const overlaps = (a: Box, b: Box) => a.from < b.to - E && b.from < a.to - E && a.bottom < b.top - E && b.bottom < a.top - E
const within = (outer: Box, inner: Box) =>
  inner.from >= outer.from - E && inner.to <= outer.to + E && inner.bottom >= outer.bottom - E && inner.top <= outer.top + E

// A stand-in for the browser's text measuring: bold capitals run about 0.62 of the font size wide
const measure = (text: string, px: number) => text.length * px * 0.62

const ZONE_TYPES: Record<NonNullable<WallArt['zone']>, FurnitureType[]> = {
  freeWeights: ['dumbbellRack', 'adjustableBench', 'bench'],
  cardio: ['treadmill', 'bike'],
  strength: ['squatRack'],
}

describe('painted words', () => {
  it('L2B2-T1: every word fits its wall, stays off the mirror and other words, and sits wholly on the slats or off them', () => {
    const mirrorParts = WALL_PIECES.filter((piece) => piece.look === 'mirror' || piece.look === 'mirrorFrame')
    const slats = WALL_PIECES.filter((piece) => piece.look === 'slats')
    for (const art of WALL_ART) {
      const half = WALLS[art.wall].length / 2
      expect(within({ from: -half, to: half, bottom: 0, top: ROOM.height }, art), art.id).toBe(true)
      for (const part of mirrorParts.filter((p) => p.wall === art.wall)) expect(overlaps(art, part), `${art.id} on the mirror`).toBe(false)
      for (const other of WALL_ART) {
        if (other !== art && other.wall === art.wall) expect(overlaps(art, other), `${art.id} × ${other.id}`).toBe(false)
      }
      for (const panel of slats.filter((p) => p.wall === art.wall)) {
        if (overlaps(art, panel)) expect(within(panel, art), `${art.id} half on the slats`).toBe(true)
      }
    }
    // The gym's name is up there, and big
    const name = WALL_ART.find((art) => art.text === GYM_NAME)!
    expect(name.top - name.bottom).toBeGreaterThanOrEqual(1)
  })

  it('L2B2-T2: each zone name sits over its zone, above the machines in it', () => {
    const zoned = WALL_ART.filter((art) => art.zone)
    expect(zoned.map((art) => art.zone).sort()).toEqual(['cardio', 'freeWeights', 'strength'])
    for (const art of zoned) {
      const pieces = DEFAULT_ITEMS.filter((item) => ZONE_TYPES[art.zone!].includes(item.type))
      // The zone's spread along that wall
      const spots = pieces.flatMap((item) => {
        const { w, d } = footprint(item)
        return [alongWall(art.wall, item.x - w / 2, item.z - d / 2), alongWall(art.wall, item.x + w / 2, item.z + d / 2)]
      })
      const middle = (art.from + art.to) / 2
      expect(middle, art.id).toBeGreaterThan(Math.min(...spots))
      expect(middle, art.id).toBeLessThan(Math.max(...spots))
      expect(art.bottom, `${art.id} above the machines`).toBeGreaterThanOrEqual(2.4)
    }
  })

  it('L2B2-T3: the canvas has the box\'s proportions, so words are never squashed, and the word fits it', () => {
    for (const art of WALL_ART) {
      const width = art.to - art.from
      const height = art.top - art.bottom
      const canvas = canvasSize(width, height)
      // Same shape as the box (to within rounding to whole pixels)
      expect(canvas.width / canvas.height, art.id).toBeCloseTo(width / height, 1)
      expect(Math.abs(canvas.width - (canvas.height * width) / height), art.id).toBeLessThanOrEqual(1)
      expect(Math.max(canvas.width, canvas.height), art.id).toBeLessThanOrEqual(MAX_TEXTURE)
      expect(canvas.width / width, `${art.id} sharpness`).toBeGreaterThanOrEqual(PIXELS_PER_METER - 1)
      // The word fits between the side margins and isn't tiny
      const px = fitFont(art.text, canvas, measure)
      expect(measure(art.text, px), art.id).toBeLessThanOrEqual(canvas.width * (1 - 2 * SIDE_MARGIN) + E)
      expect(px, art.id).toBeLessThanOrEqual(canvas.height * 1.2)
      expect(px, art.id).toBeGreaterThan(canvas.height * 0.5)
    }
    // A long word in a short box shrinks to fit instead of running off the edge
    const tight = canvasSize(1, 0.5)
    expect(measure('ONE MORE REP.', fitFont('ONE MORE REP.', tight, measure))).toBeLessThanOrEqual(tight.width * (1 - 2 * SIDE_MARGIN) + E)
  })
})
