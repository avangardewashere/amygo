// The props that stand on the floor. Each model's origin is the middle of its
// footprint, on the floor, facing +z (like the machines).
import { Merged } from '../build/Merged'
import { useBuild } from '../build/buildStore'
import { FIXED_PROPS, MATS, PROP_SIZE, plateTreeFor, type FloorPropKind } from './propLayout'

type Vec = [number, number, number]

function Box({ size, at, color, metal = 0.2, shadow = true }: { size: Vec; at: Vec; color: string; metal?: number; shadow?: boolean }) {
  return (
    <mesh position={at} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={metal} roughness={0.6} />
    </mesh>
  )
}

// A disc standing on its edge, facing along x (how plates hang on a tree)
function Plate({ radius, at, color }: { radius: number; at: Vec; color: string }) {
  return (
    <mesh position={at} rotation-z={Math.PI / 2} castShadow>
      <cylinderGeometry args={[radius, radius, 0.045, 28]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
}

const STEEL = '#2b2d31'
// Bumper plate colours, heaviest first (red 25 kg, blue 20, yellow 15)
const BUMPERS = [
  { radius: 0.225, color: '#b8322a' },
  { radius: 0.225, color: '#2f5aa6' },
  { radius: 0.2, color: '#d2a019' },
]

function PlateTree() {
  const { w } = PROP_SIZE.plateTree
  return (
    <group>
      <Box size={[w, 0.04, w]} at={[0, 0.02, 0]} color={STEEL} />
      <mesh position-y={0.62} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 12]} />
        <meshStandardMaterial color={STEEL} metalness={0.4} roughness={0.5} />
      </mesh>
      {BUMPERS.map(({ radius, color }, i) => {
        const y = 0.3 + i * 0.3
        return [-1, 1].map((side) => (
          <group key={`${i}${side}`}>
            {/* The peg the plate hangs on, then the plate */}
            <Box size={[0.14, 0.03, 0.03]} at={[side * 0.07, y, 0]} color={STEEL} shadow={false} />
            <Plate radius={radius} at={[side * 0.11, y, 0]} color={color} />
          </group>
        ))
      })}
    </group>
  )
}

// Kettlebell colours by weight (8, 12, 16, 20, 24, 28 kg), the usual competition scheme
const BELLS = ['#e2709b', '#3d7fd1', '#e0b52c', '#8a5bc9', '#3f9b55', '#e0752c']

// Bells are small and sit on a shelf: their shadows would hardly show, and leaving
// them out lets each bell and its handle merge into one draw per colour
function Kettlebell({ at, color, size }: { at: Vec; color: string; size: number }) {
  return (
    <group position={at}>
      <mesh position-y={size}>
        <sphereGeometry args={[size, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position-y={size * 2.05}>
        <torusGeometry args={[size * 0.62, size * 0.16, 8, 16, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    </group>
  )
}

function KettlebellShelf() {
  const { w, d } = PROP_SIZE.kettlebellShelf
  const shelves = [0.06, 0.48]
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Box key={`${sx}${sz}`} size={[0.04, 0.82, 0.04]} at={[sx * (w / 2 - 0.02), 0.41, sz * (d / 2 - 0.02)]} color={STEEL} />),
      )}
      {shelves.map((y) => (
        <Box key={y} size={[w, 0.03, d]} at={[0, y, 0]} color={STEEL} metal={0.4} />
      ))}
      {BELLS.map((color, i) => {
        const shelf = i < 3 ? shelves[1] : shelves[0] // lighter bells on top
        const slot = i % 3
        const size = 0.075 + (i / BELLS.length) * 0.04
        return <Kettlebell key={color} color={color} size={size} at={[(slot - 1) * 0.42, shelf + 0.015, 0]} />
      })}
    </group>
  )
}

function Sled() {
  const { w, d } = PROP_SIZE.sled
  return (
    <group>
      {/* Two skids it slides on, and the deck across them */}
      {[-1, 1].map((side) => (
        <Box key={side} size={[0.06, 0.05, d]} at={[side * (w / 2 - 0.03), 0.025, 0]} color={STEEL} />
      ))}
      <Box size={[w - 0.08, 0.03, d - 0.25]} at={[0, 0.065, 0]} color="#3a3d43" />
      {/* Push handles at the back, joined at the top */}
      {[-1, 1].map((side) => (
        <Box key={side} size={[0.04, 1.0, 0.04]} at={[side * 0.25, 0.55, -d / 2 + 0.08]} color={STEEL} />
      ))}
      <Box size={[0.54, 0.04, 0.04]} at={[0, 1.04, -d / 2 + 0.08]} color={STEEL} />
      {/* Weight post with two plates on it */}
      <mesh position={[0, 0.3, 0.05]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.45, 12]} />
        <meshStandardMaterial color={STEEL} metalness={0.4} roughness={0.5} />
      </mesh>
      {[0.1, 0.15].map((y, i) => (
        <mesh key={y} position={[0, y, 0.05]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.045, 28]} />
          <meshStandardMaterial color={BUMPERS[i + 1].color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function WaterFountain() {
  const { w, d } = PROP_SIZE.waterFountain
  return (
    <group>
      <Box size={[w, 0.9, d]} at={[0, 0.45, 0]} color="#b7bcc2" metal={0.6} />
      <Box size={[w - 0.04, 0.05, d - 0.06]} at={[0, 0.925, 0.01]} color="#6d737a" metal={0.7} />
      <Box size={[0.03, 0.07, 0.03]} at={[0, 0.98, -0.05]} color="#9aa0a7" metal={0.7} shadow={false} />
    </group>
  )
}

function Plant() {
  return (
    <group>
      <mesh position-y={0.22} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.44, 20]} />
        <meshStandardMaterial color="#34363b" roughness={0.8} />
      </mesh>
      {[
        { at: [0, 0.78, 0] as Vec, r: 0.3 },
        { at: [0.1, 1.08, -0.05] as Vec, r: 0.2 },
        { at: [-0.12, 0.98, 0.08] as Vec, r: 0.18 },
      ].map(({ at, r }) => (
        <mesh key={at.join()} position={at} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color="#3f7a3a" roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  )
}

const MODELS: Record<FloorPropKind, () => React.JSX.Element> = {
  plateTree: PlateTree,
  kettlebellShelf: KettlebellShelf,
  sled: Sled,
  waterFountain: WaterFountain,
  plant: Plant,
}

// Mats lie on the turf (a few mm up, so they don't flicker with it), one with a foam roller on it
function Mats() {
  return MATS.map((mat, i) => (
    <group key={mat.id} position={[mat.x, 0, mat.z]}>
      <Box size={[mat.w, 0.012, mat.d]} at={[0, 0.012, 0]} color="#2d3f52" shadow={false} />
      {i === 0 && (
        <mesh position={[mat.w / 2 - 0.2, 0.093, 0]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.45, 20]} />
          <meshStandardMaterial color="#3a78c9" roughness={0.8} />
        </mesh>
      )}
    </group>
  ))
}

// Plate trees follow their squat rack (each merged on its own, so it moves with it)
function PlateTrees() {
  const items = useBuild((s) => s.items) // select the list, filter after (see store.ts)
  return items
    .filter((item) => item.type === 'squatRack')
    .map((rack) => {
      const tree = plateTreeFor(rack)
      return (
        <group key={rack.id} position={[tree.x, 0, tree.z]} rotation-y={-tree.turns * (Math.PI / 2)}>
          <Merged>
            <PlateTree />
          </Merged>
        </group>
      )
    })
}

export function FloorProps() {
  return (
    <>
      {/* Props that never move: all merged together, a handful of draws in all */}
      <Merged>
        {FIXED_PROPS.map((prop) => {
          const Model = MODELS[prop.kind]
          return (
            <group key={prop.id} position={[prop.x, 0, prop.z]} rotation-y={-prop.turns * (Math.PI / 2)}>
              <Model />
            </group>
          )
        })}
        <Mats />
      </Merged>
      <PlateTrees />
    </>
  )
}
