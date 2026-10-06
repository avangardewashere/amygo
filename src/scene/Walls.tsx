import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { COLORS, ROOM } from './dimensions'
import { MIRROR, WALLS, WALL_COLORS, WALL_PIECES, slatSpans, type WallName, type WallPiece } from './wallDesign'

const H = ROOM.height

// Each layer sits a little further off the wall, and is pulled toward the
// camera when drawn (polygonOffset) so stacked layers never flicker
const LAYER_GAP = 0.006
const layered = (layer: number) => ({ polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer })

// A wall-frame rectangle as a flat shape, facing into the room.
// The wall's group is centered at half the room's height, hence `- H / 2`.
const rect = (left: number, right: number, bottom: number, top: number, z: number) =>
  new PlaneGeometry(right - left, top - bottom).translate((left + right) / 2, (bottom + top) / 2 - H / 2, z)

// All the slats as ONE shape: one draw for the whole slat wall
function slatGeometry(piece: WallPiece) {
  const z = piece.layer * LAYER_GAP
  const parts = slatSpans(piece).map(({ left, right }) => rect(left, right, piece.bottom, piece.top, z))
  const merged = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return merged
}

// A fake mirror (D5). From across a gym, a mirror mostly shows the dark floor
// and equipment in front of it, catching light only near the top. So the glass
// fades from a cool light grey at the top to near-black at the bottom (a flat
// light panel read as a whiteboard). A real reflection would draw the whole gym
// a second time every frame.
const GLASS_TOP = new Color('#9fabb5')
const GLASS_BOTTOM = new Color('#262b30')
function glassGeometry(z: number) {
  const glass = rect(MIRROR.from, MIRROR.to, MIRROR.bottom, MIRROR.top, z)
  const positions = glass.attributes.position
  const colors: number[] = []
  for (let i = 0; i < positions.count; i++) {
    const shade = positions.getY(i) > MIRROR.bottom + (MIRROR.top - MIRROR.bottom) / 2 - H / 2 ? GLASS_TOP : GLASS_BOTTOM
    colors.push(shade.r, shade.g, shade.b)
  }
  glass.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return glass
}

// Two faint diagonal streaks of light across the glass, which is what makes
// a flat panel read as a mirror from across the room. Each streak is a
// slanted strip that stays inside the glass.
function sheenGeometry(z: number) {
  const { from, to, bottom, top } = MIRROR
  const width = to - from
  const strip = (start: number, size: number) => {
    const lean = width * 0.18 // how far the strip slants left to right going up
    const x0 = from + width * start
    const geometry = new BufferGeometry()
    // Two triangles: bottom-left, bottom-right, top-right / bottom-left, top-right, top-left
    const [b, t] = [bottom - H / 2, top - H / 2]
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        [x0, b, z, x0 + size, b, z, x0 + size + lean, t, z, x0, b, z, x0 + size + lean, t, z, x0 + lean, t, z],
        3,
      ),
    )
    return geometry
  }
  const parts = [strip(0.22, width * 0.07), strip(0.36, width * 0.025)]
  const merged = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return merged
}

function Mirror({ piece }: { piece: WallPiece }) {
  const z = piece.layer * LAYER_GAP
  const glass = useMemo(() => glassGeometry(z), [z])
  const sheen = useMemo(() => sheenGeometry(z + LAYER_GAP / 2), [z])
  useEffect(
    () => () => {
      glass.dispose()
      sheen.dispose()
    },
    [glass, sheen],
  )
  return (
    <>
      <mesh geometry={glass}>
        <meshStandardMaterial vertexColors roughness={0.12} metalness={0.15} {...layered(piece.layer)} />
      </mesh>
      <mesh geometry={sheen}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} {...layered(piece.layer + 1)} />
      </mesh>
    </>
  )
}

function Slats({ piece }: { piece: WallPiece }) {
  const geometry = useMemo(() => slatGeometry(piece), [piece])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={WALL_COLORS.slat} roughness={0.7} {...layered(piece.layer)} />
    </mesh>
  )
}

const FLAT_COLORS = {
  band: WALL_COLORS.band,
  stripe: COLORS.accent,
  panel: WALL_COLORS.panel,
  mirrorFrame: WALL_COLORS.mirrorFrame,
} as const

function Flat({ piece, color }: { piece: WallPiece; color: string }) {
  const { from, to, bottom, top, layer } = piece
  return (
    <mesh position={[(from + to) / 2, (bottom + top) / 2 - H / 2, layer * LAYER_GAP]} receiveShadow>
      <planeGeometry args={[to - from, top - bottom]} />
      <meshStandardMaterial color={color} roughness={0.85} {...layered(layer)} />
    </mesh>
  )
}

function WallPieceView({ piece }: { piece: WallPiece }) {
  if (piece.look === 'slats') return <Slats piece={piece} />
  if (piece.look === 'mirror') return <Mirror piece={piece} />
  return <Flat piece={piece} color={FLAT_COLORS[piece.look]} />
}

// The four walls and everything on them
export function Walls() {
  return (Object.keys(WALLS) as WallName[]).map((name) => {
    const wall = WALLS[name]
    return (
      <group key={name} position={wall.position} rotation-y={wall.rotationY}>
        <mesh receiveShadow>
          <planeGeometry args={[wall.length, H]} />
          <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
        </mesh>
        {WALL_PIECES.filter((piece) => piece.wall === name).map((piece) => (
          <WallPieceView key={piece.id} piece={piece} />
        ))}
      </group>
    )
  })
}
