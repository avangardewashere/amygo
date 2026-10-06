import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { machine } from './machineState'
import { FOOT_TO_PLATE, PRESS, alongSled, pressDistance } from './legPressGeometry'
import { repPhase } from '../interaction/reps'
import { LEG_PRESS_WIDTH, LEG_PRESS_DEPTH } from './sizes'
export { LEG_PRESS_WIDTH, LEG_PRESS_DEPTH }

const COLORS = {
  frame: '#2b2d31',
  pad: '#1c1d20',
  plate: '#17181b',
  metal: '#b9bcc2',
  accent: '#e4572e',
}

const RAIL_X = 0.36
const RAIL_DROP = 0.12 // rails run this far below the path of the feet

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

// A weight plate standing on its edge, its hole along x
function Plate({ x, radius }: { x: number; radius: number }) {
  return (
    <mesh position-x={x} rotation-z={Math.PI / 2} castShadow>
      <cylinderGeometry args={[radius, radius, 0.04, 28]} />
      <meshStandardMaterial color={COLORS.plate} roughness={0.8} />
    </mesh>
  )
}

// A 45°-style leg press: you sit reclined and push the sled up and away with
// your feet. You sit facing +z. `id` lets it know whether it's in use.
export function LegPress({ id }: { id: string }) {
  const sled = useRef<Group>(null)
  const travel = useRef(PRESS.extended)

  // Slide the sled along its rails to wherever the feet are in the rep
  useFrame((_, delta) => {
    const inUse = machine.activeId === id
    const target = inUse ? pressDistance(repPhase(machine.startedAt)) : PRESS.extended
    // Settle back gently onto its stops when you get off
    travel.current = inUse ? target : MathUtils.damp(travel.current, target, 6, delta)
    const [y, z] = alongSled(travel.current + FOOT_TO_PLATE)
    sled.current!.position.set(0, y, z)
  })

  // Backrest: behind the torso, tilted back by the recline angle
  const backUp = 0.38 // how far up the back from the hips its middle sits
  const backBehind = 0.24 // torso radius + half the pad's thickness
  const backY = PRESS.hipY + Math.cos(PRESS.lean) * backUp - Math.sin(PRESS.lean) * backBehind
  const backZ = PRESS.hipZ - Math.sin(PRESS.lean) * backUp - Math.cos(PRESS.lean) * backBehind

  // Rails run from just past the seat to beyond full extension
  const railStart = 0.3
  const railEnd = 1.35
  const [railY, railZ] = alongSled((railStart + railEnd) / 2, RAIL_DROP)
  const [nearY, nearZ] = alongSled(railStart, RAIL_DROP)
  const [farY, farZ] = alongSled(railEnd - 0.05, RAIL_DROP)

  return (
    <group>
      {/* Base: two long rails on the floor tied together front and back */}
      {[-0.5, 0.5].map((x) => (
        <Box key={x} size={[0.06, 0.06, 2.2]} position={[x, 0.03, 0]} color={COLORS.frame} />
      ))}
      {[-1.07, 0.95].map((z) => (
        <Box key={z} size={[1.06, 0.06, 0.06]} position={[0, 0.03, z]} color={COLORS.frame} />
      ))}

      {/* Seat (front edge slightly raised) on a post, and the reclined backrest */}
      <Box size={[0.08, 0.36, 0.08]} position={[0, 0.2, PRESS.hipZ]} color={COLORS.frame} />
      <Box size={[0.5, 0.08, 0.42]} position={[0, PRESS.hipY - 0.17, PRESS.hipZ + 0.02]} color={COLORS.pad} rotationX={-0.15} />
      <Box size={[0.06, 0.55, 0.06]} position={[0, 0.3, backZ]} color={COLORS.frame} />
      <Box size={[0.5, 0.8, 0.08]} position={[0, backY, backZ]} color={COLORS.pad} rotationX={-PRESS.lean} />

      {/* Handles beside the seat to hold on to */}
      {[-0.33, 0.33].map((x) => (
        <Box key={x} size={[0.04, 0.04, 0.25]} position={[x, PRESS.hipY - 0.05, PRESS.hipZ + 0.05]} color={COLORS.metal} />
      ))}

      {/* Sled rails, rising at the sled angle, held up by posts at each end */}
      {[-RAIL_X, RAIL_X].map((x) => (
        <group key={x}>
          <Box
            size={[0.06, 0.06, railEnd - railStart]}
            position={[x, railY, railZ]}
            color={COLORS.frame}
            rotationX={-PRESS.angle}
          />
          <Box size={[0.06, nearY, 0.06]} position={[x, nearY / 2, nearZ]} color={COLORS.frame} />
          <Box size={[0.06, farY, 0.06]} position={[x, farY / 2, farZ]} color={COLORS.frame} />
        </group>
      ))}

      {/* The sled: footplate facing you, carriage behind it, plates on its horns.
          Tilted so its "forward" runs along the rails. */}
      <group ref={sled} userData={{ moving: true }} rotation-x={-PRESS.angle}>
        <Box size={[0.62, 0.48, 0.035]} position={[0, 0, 0]} color={COLORS.frame} />
        <Box size={[0.58, 0.04, 0.02]} position={[0, -0.2, -0.02]} color={COLORS.accent} />
        <Box size={[0.5, 0.3, 0.12]} position={[0, 0, 0.08]} color={COLORS.frame} />
        {[-1, 1].map((side) => (
          <group key={side} position={[0, -0.05, 0.1]}>
            <mesh position-x={side * 0.38} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.025, 0.025, 0.2, 12]} />
              <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
            </mesh>
            <Plate x={side * 0.33} radius={0.2} />
            <Plate x={side * 0.38} radius={0.16} />
          </group>
        ))}
      </group>
    </group>
  )
}
