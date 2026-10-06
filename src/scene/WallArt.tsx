import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { ROOM } from './dimensions'
import { canvasSize, fitFont, fontFor } from './paintText'
import { WALLS, WALL_ART, type WallArt as Art } from './wallDesign'

const H = ROOM.height
// In front of the slats (layer 2) and mirror (layer 3), and pulled toward the
// camera when drawn, so the paint never flickers against what's under it
const Z = 4 * 0.006
const OFFSET = { polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }

// Paint the word on a canvas with the box's proportions, in a system font
// (no font file to download), centered
function paint(art: Art) {
  const size = canvasSize(art.to - art.from, art.top - art.bottom)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const g = canvas.getContext('2d')!
  const measure = (text: string, px: number) => {
    g.font = fontFor(px)
    return g.measureText(text).width
  }
  g.font = fontFor(fitFont(art.text, size, measure))
  g.fillStyle = art.color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(art.text, size.width / 2, size.height / 2)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8 // stays crisp seen at an angle along the wall
  return texture
}

function PaintedWord({ art }: { art: Art }) {
  const texture = useMemo(() => paint(art), [art])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[(art.from + art.to) / 2, (art.bottom + art.top) / 2 - H / 2, Z]}>
      <planeGeometry args={[art.to - art.from, art.top - art.bottom]} />
      {/* Lit like the wall it's painted on; see-through around the letters */}
      <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={0.8} {...OFFSET} />
    </mesh>
  )
}

// Every painted word, each on its wall (flat and facing in, so it hides with
// its wall in the dollhouse view)
export function WallArt() {
  return WALL_ART.map((art) => {
    const wall = WALLS[art.wall]
    return (
      <group key={art.id} position={wall.position} rotation-y={wall.rotationY}>
        <PaintedWord art={art} />
      </group>
    )
  })
}
