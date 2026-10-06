import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group, type Mesh } from 'three'
import { machine } from './machineState'
import { ROWER, rowerPosition } from './rowerGeometry'
import { SEAT_TO_HIP } from '../player/proportions'
import { ROWER_WIDTH, ROWER_DEPTH } from './sizes'
export { ROWER_WIDTH, ROWER_DEPTH }

const COLORS = {
  frame: '#2b2d31',
  rail: '#9aa0a8',
  seat: '#1c1d20',
  metal: '#b9bcc2',
  housing: '#3d4046',
  accent: '#e4572e',
  chain: '#6b6f78',
}

const RAIL_Y = 0.3
const RAIL_BACK = -1.15
const RAIL_FRONT = 0.85
const FLYWHEEL = { y: 0.55, z: 1.05, radius: 0.22 }

type BoxProps = {
  size: [number, number, number]
  position: [number, number, number]
  color: string
  rotationX?: number
}
function Box({ size, position, color, rotationX = 0 }: BoxProps) {
  return (
    <mesh position={position} rotation-x={rotationX} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
    </mesh>
  )
}

// An air rowing machine: a long rail with a sliding seat, footplates, and a
// flywheel at the front that the handle's chain spins. You sit facing +z.
export function Rower({ id }: { id: string }) {
  const seat = useRef<Group>(null)
  const handle = useRef<Group>(null)
  const chain = useRef<Mesh>(null)
  const fan = useRef<Group>(null)
  const spin = useRef(0)
  const rest = rowerPosition(0) // the catch position, where it sits when nobody rows

  useFrame((_, delta) => {
    const inUse = machine.activeId === id
    const now = inUse ? rowerPosition((performance.now() - machine.startedAt) / 1000) : rest
    seat.current!.position.z = now.hipZ
    handle.current!.position.set(0, now.handle.y, now.handle.z)

    // Chain: a thin bar from the flywheel housing to the handle, stretched to fit
    const dz = ROWER.chainExit.z - now.handle.z
    const dy = ROWER.chainExit.y - now.handle.y
    chain.current!.position.set(0, (ROWER.chainExit.y + now.handle.y) / 2, (ROWER.chainExit.z + now.handle.z) / 2)
    chain.current!.scale.z = Math.hypot(dz, dy)
    chain.current!.rotation.x = -Math.atan2(dy, dz)

    // The fan keeps spinning while you row, then winds down
    spin.current = MathUtils.damp(spin.current, inUse ? 9 : 0, 1.2, delta)
    fan.current!.rotation.x += spin.current * Math.min(delta, 0.1)
  })

  return (
    <group>
      {/* Rail: a long beam the seat rolls along, on feet at each end */}
      <Box size={[0.1, 0.05, RAIL_FRONT - RAIL_BACK]} position={[0, RAIL_Y, (RAIL_FRONT + RAIL_BACK) / 2]} color={COLORS.rail} />
      <Box size={[0.45, 0.05, 0.08]} position={[0, 0.025, RAIL_BACK + 0.04]} color={COLORS.frame} />
      <Box size={[0.06, RAIL_Y - 0.03, 0.06]} position={[0, (RAIL_Y - 0.03) / 2, RAIL_BACK + 0.04]} color={COLORS.frame} />
      <Box size={[0.5, 0.05, 0.1]} position={[0, 0.025, 1.08]} color={COLORS.frame} />

      {/* Front: a frame rising from the rail up to the flywheel housing */}
      <Box size={[0.12, 0.08, 0.35]} position={[0, RAIL_Y + 0.02, RAIL_FRONT + 0.12]} color={COLORS.frame} />
      <Box size={[0.08, 0.5, 0.08]} position={[0, 0.3, 1.05]} color={COLORS.frame} />

      {/* Footplates, angled back toward you, with orange straps */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.1, ROWER.foot.y - 0.05, ROWER.foot.z + 0.06]} rotation-x={-0.6}>
          <Box size={[0.12, 0.03, 0.28]} position={[0, 0, 0]} color={COLORS.frame} />
          <Box size={[0.13, 0.02, 0.04]} position={[0, 0.03, 0.02]} color={COLORS.accent} />
        </group>
      ))}

      {/* Flywheel housing (a round cage) with a fan inside that spins */}
      <mesh position={[0, FLYWHEEL.y, FLYWHEEL.z]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[FLYWHEEL.radius, FLYWHEEL.radius, 0.16, 32, 1, true]} />
        <meshStandardMaterial color={COLORS.housing} metalness={0.4} roughness={0.5} side={2} />
      </mesh>
      <group ref={fan} position={[0, FLYWHEEL.y, FLYWHEEL.z]}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((angle) => (
          <Box key={angle} size={[0.12, 0.03, FLYWHEEL.radius * 1.8]} position={[0, 0, 0]} color={COLORS.accent} rotationX={angle} />
        ))}
      </group>

      {/* Sliding seat */}
      <group ref={seat}>
        <Box size={[0.3, 0.06, 0.32]} position={[0, ROWER.hipY - SEAT_TO_HIP - 0.03, 0]} color={COLORS.seat} />
        <Box size={[0.12, ROWER.hipY - 0.11 - RAIL_Y, 0.1]} position={[0, (ROWER.hipY - 0.11 + RAIL_Y) / 2, 0]} color={COLORS.frame} />
      </group>

      {/* Chain (stretched between the housing and the handle each frame) and the handle bar */}
      <mesh ref={chain} castShadow>
        <boxGeometry args={[0.015, 0.015, 1]} />
        <meshStandardMaterial color={COLORS.chain} metalness={0.7} roughness={0.4} />
      </mesh>
      <group ref={handle}>
        <mesh rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.56, 12]} />
          <meshStandardMaterial color={COLORS.seat} roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}
