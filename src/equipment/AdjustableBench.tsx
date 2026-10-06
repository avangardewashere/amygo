import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group, type Mesh } from 'three'
import { ADJ, backrestFacing, backrestPoint, backrestTarget } from './adjustableBenchGeometry'
import { ADJ_BENCH_WIDTH, ADJ_BENCH_DEPTH } from './sizes'
export { ADJ_BENCH_WIDTH, ADJ_BENCH_DEPTH }

const COLORS = {
  frame: '#2b2d31',
  pad: '#1c1d20',
  trim: '#e4572e',
  foot: '#111214',
}

const PAD_THICKNESS = 0.1
// The same rate the person leans back at (POSTURE_EASE in Person.tsx), so
// the backrest and the person's back arrive together
const TILT_EASE = 8
// The strut that props the backrest up: from the base to under the backrest
const STRUT_BASE = { y: 0.08, z: ADJ.hingeZ - 0.05 }
const STRUT_ALONG = 0.35 // how far up the backrest it pushes

type BoxProps = { size: [number, number, number]; position: [number, number, number]; color: string }
function Box({ size, position, color }: BoxProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
    </mesh>
  )
}

// A pad with a thin orange trim line along each side, its top surface at y = 0
function Pad({ length, z }: { length: number; z: number }) {
  return (
    <group>
      <Box size={[ADJ.padWidth, PAD_THICKNESS, length]} position={[0, -PAD_THICKNESS / 2, z]} color={COLORS.pad} />
      {[-1, 1].map((side) => (
        <Box
          key={side}
          size={[0.006, 0.02, length - 0.02]}
          position={[side * (ADJ.padWidth / 2 + 0.003), -PAD_THICKNESS / 2, z]}
          color={COLORS.trim}
        />
      ))}
    </group>
  )
}

// A weight bench whose backrest tilts: flat when nobody uses it, then raised
// to whatever the chosen exercise needs (45° incline, or upright to sit).
export function AdjustableBench({ id }: { id: string }) {
  const backrest = useRef<Group>(null)
  const strut = useRef<Mesh>(null)

  useFrame((_, delta) => {
    const back = backrest.current!
    back.rotation.x = MathUtils.damp(back.rotation.x, backrestTarget(id), TILT_EASE, delta)

    // Strut: from the base to the underside of the backrest, stretched to fit
    const top = backrestPoint(back.rotation.x, STRUT_ALONG)
    const facing = backrestFacing(back.rotation.x)
    const end = { y: top.y - PAD_THICKNESS * facing.y, z: top.z - PAD_THICKNESS * facing.z }
    const dy = end.y - STRUT_BASE.y
    const dz = end.z - STRUT_BASE.z
    strut.current!.position.set(0, (end.y + STRUT_BASE.y) / 2, (end.z + STRUT_BASE.z) / 2)
    strut.current!.scale.y = Math.hypot(dy, dz)
    strut.current!.rotation.x = Math.atan2(dz, dy)
  })

  return (
    <group>
      {/* Seat: runs forward from the hinge */}
      <group position={[0, ADJ.seatTop, 0]}>
        <Pad length={ADJ.seatLength} z={ADJ.hingeZ + ADJ.seatLength / 2} />
      </group>

      {/* Backrest: pivots at the back edge of the seat. Rotating it lifts the far end. */}
      <group ref={backrest} position={[0, ADJ.seatTop, ADJ.hingeZ]}>
        <Pad length={ADJ.backLength} z={-ADJ.backLength / 2} />
      </group>

      {/* Steel frame: a beam along the floor, wide feet at each end, a post up to the seat */}
      <Box size={[0.08, 0.06, 1.2]} position={[0, 0.06, 0]} color={COLORS.frame} />
      {[-0.55, 0.55].map((z) => (
        <group key={z}>
          <Box size={[ADJ_BENCH_WIDTH, 0.05, 0.1]} position={[0, 0.025, z]} color={COLORS.frame} />
          {[-1, 1].map((side) => (
            <Box key={side} size={[0.06, 0.03, 0.1]} position={[side * (ADJ_BENCH_WIDTH / 2 - 0.03), 0.015, z]} color={COLORS.foot} />
          ))}
        </group>
      ))}
      <Box size={[0.08, ADJ.seatTop - PAD_THICKNESS - 0.06, 0.08]} position={[0, (ADJ.seatTop - PAD_THICKNESS + 0.06) / 2, ADJ.hingeZ + 0.2]} color={COLORS.frame} />
      {/* A short post at the back for the backrest to rest on when flat */}
      <Box size={[0.06, ADJ.seatTop - PAD_THICKNESS - 0.08, 0.06]} position={[0, (ADJ.seatTop - PAD_THICKNESS + 0.04) / 2, -0.45]} color={COLORS.frame} />

      {/* Strut (stretched each frame) */}
      <mesh ref={strut} castShadow>
        <boxGeometry args={[0.05, 1, 0.05]} />
        <meshStandardMaterial color={COLORS.frame} metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  )
}
