import { useEffect, useMemo } from 'react'
import { CanvasTexture, PlaneGeometry, RepeatWrapping, SRGBColorSpace, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useBuild } from '../build/buildStore'
import { COLORS, ROOM } from './dimensions'
import {
  CARDIO_TILES,
  FLOOR_COLORS,
  TURF,
  TURF_LINES,
  WALKWAY_LINES,
  platformFor,
  type FloorRect,
} from './floorZones'

const { width: W, depth: D } = ROOM

// Each layer sits a couple of millimetres above the one below. That alone
// flickers from far away (the depth buffer can't tell them apart), so each
// layer also gets pulled toward the camera when drawing (polygonOffset).
const LAYER = [0, 0.002, 0.004] as const
const layerMaterial = (layer: 1 | 2) => ({ polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer })

// Many rectangles as ONE flat shape, so they cost one draw instead of one each
function mergedRects(rects: FloorRect[], y: number): BufferGeometry {
  const parts = rects.map(({ x, z, w, d }) => new PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z))
  const merged = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return merged
}

// Rubber floor tiles, 1 × 1 m, painted in code at load (no image to download):
// speckles like rubber granules, and a darker seam round the edge
function rubberTiles() {
  const size = 256 // pixels per tile
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = COLORS.floor
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 1400; i++) {
    const light = Math.random() < 0.5
    g.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2)
  }
  g.strokeStyle = 'rgba(0,0,0,0.45)'
  g.lineWidth = 3
  g.strokeRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(W, D) // one tile per meter
  texture.anisotropy = 8 // keeps the seams crisp at a low viewing angle
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Rect({ rect, y, color, layer }: { rect: FloorRect; y: number; color: string; layer: 1 | 2 }) {
  return (
    <mesh position={[rect.x, y, rect.z]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[rect.w, rect.d]} />
      <meshStandardMaterial color={color} roughness={0.95} {...layerMaterial(layer)} />
    </mesh>
  )
}

// Follows its squat rack around, including while it's dragged in build mode
function Platforms() {
  // Select the existing list and filter here: filtering inside useBuild would
  // build a new array on every read and re-render forever
  const items = useBuild((s) => s.items)
  return items.filter((item) => item.type === 'squatRack').map((rack) => {
    const { rubber, wood } = platformFor(rack)
    return (
      <group key={rack.id}>
        <Rect rect={rubber} y={LAYER[1]} color={FLOOR_COLORS.platformRubber} layer={1} />
        <Rect rect={wood} y={LAYER[2]} color={FLOOR_COLORS.platformWood} layer={2} />
      </group>
    )
  })
}

export function Floor() {
  const tiles = useMemo(() => rubberTiles(), [])
  const turfLines = useMemo(() => mergedRects(TURF_LINES, LAYER[2]), [])
  const walkwayLines = useMemo(() => mergedRects(WALKWAY_LINES, LAYER[2]), [])
  useEffect(
    () => () => {
      tiles.dispose()
      turfLines.dispose()
      walkwayLines.dispose()
    },
    [tiles, turfLines, walkwayLines],
  )

  return (
    <group>
      {/* The whole floor: rubber tiles */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={tiles} roughness={0.95} />
      </mesh>

      <Rect rect={TURF} y={LAYER[1]} color={FLOOR_COLORS.turf} layer={1} />
      <Rect rect={CARDIO_TILES} y={LAYER[1]} color={FLOOR_COLORS.cardioTiles} layer={1} />
      <mesh geometry={turfLines} receiveShadow>
        <meshStandardMaterial color={FLOOR_COLORS.turfLine} roughness={0.9} {...layerMaterial(2)} />
      </mesh>
      <mesh geometry={walkwayLines} receiveShadow>
        <meshStandardMaterial color={FLOOR_COLORS.walkwayLine} roughness={0.8} {...layerMaterial(2)} />
      </mesh>

      <Platforms />
    </group>
  )
}
