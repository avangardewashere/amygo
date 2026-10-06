import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { machine } from './machineState'
import { BIKE, machineCrank } from './bikeGeometry'
import { SEAT_TO_HIP } from '../player/proportions'

const COLORS = {
  frame: '#2b2d31',
  saddle: '#1c1d20',
  metal: '#b9bcc2',
  flywheel: '#3d4046',
  accent: '#e4572e',
  screen: '#38bdf8',
}

// Overall size in meters. The catalog uses these for the floor footprint.
export const BIKE_WIDTH = 0.6 // along x
export const BIKE_DEPTH = 1.3 // along z

const FLYWHEEL = { y: 0.36, z: 0.42, radius: 0.24 }
const FLYWHEEL_GEARING = 3 // the flywheel spins 3× for every turn of the pedals

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

// A tube between two points in the side view (y, z), lying in the middle (x = 0)
function Tube({ from, to, thickness = 0.06 }: { from: [number, number]; to: [number, number]; thickness?: number }) {
  const [y1, z1] = from
  const [y2, z2] = to
  const length = Math.hypot(y2 - y1, z2 - z1)
  // A box is upright (along y) to start with; tilt it to point from → to
  const tilt = Math.atan2(z2 - z1, y2 - y1)
  return (
    <Box
      size={[thickness, length, thickness]}
      position={[0, (y1 + y2) / 2, (z1 + z2) / 2]}
      color={COLORS.frame}
      rotationX={tilt}
    />
  )
}

// An upright stationary bike. You sit facing +z. `id` lets it know whether
// it's in use, so its cranks and flywheel turn.
export function Bike({ id }: { id: string }) {
  const leftCrank = useRef<Group>(null)
  const rightCrank = useRef<Group>(null)
  const leftPedal = useRef<Group>(null)
  const rightPedal = useRef<Group>(null)
  const flywheel = useRef<Group>(null)
  const angle = useRef(0)
  const cadence = useRef(0)

  useFrame((_, delta) => {
    if (machine.activeId === id) {
      // In use: the same clock as the rider's legs, so pedals and feet agree
      cadence.current = machine.cadence
      angle.current = machineCrank()
    } else {
      // Afterwards: the pedals coast to a stop
      cadence.current = MathUtils.damp(cadence.current, 0, 1.5, delta)
      angle.current += 2 * Math.PI * cadence.current * Math.min(delta, 0.1)
    }
    // Turning a crank arm by +angle around x moves its pedal the same way as
    // pedalPosition() in bikeGeometry.ts; the right arm points the other way
    leftCrank.current!.rotation.x = angle.current
    rightCrank.current!.rotation.x = angle.current
    // Pedals stay level while the cranks turn
    leftPedal.current!.rotation.x = -angle.current
    rightPedal.current!.rotation.x = -angle.current
    flywheel.current!.rotation.x = angle.current * FLYWHEEL_GEARING
  })

  const saddleTop = BIKE.hipY - SEAT_TO_HIP
  return (
    <group>
      {/* Feet: a bar across the floor at each end, joined by a low frame */}
      <Box size={[0.55, 0.05, 0.08]} position={[0, 0.025, -0.58]} color={COLORS.frame} />
      <Box size={[0.55, 0.05, 0.08]} position={[0, 0.025, 0.55]} color={COLORS.frame} />
      <Tube from={[0.06, -0.58]} to={[0.06, 0.55]} />

      {/* Seat tube up to the saddle */}
      <Tube from={[0.06, -0.45]} to={[saddleTop - 0.04, BIKE.hipZ - 0.03]} />
      <Box size={[0.2, 0.06, 0.3]} position={[0, saddleTop - 0.03, BIKE.hipZ + 0.02]} color={COLORS.saddle} />

      {/* Crank housing (where the pedals turn) and a tube up to the handlebars */}
      <mesh position={[0, BIKE.crankY, BIKE.crankZ]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.1, 20]} />
        <meshStandardMaterial color={COLORS.frame} metalness={0.4} roughness={0.5} />
      </mesh>
      <Tube from={[0.06, -0.35]} to={[BIKE.crankY, BIKE.crankZ]} />
      <Tube from={[0.06, 0.5]} to={[BIKE.bar.y - 0.06, BIKE.bar.z - 0.04]} thickness={0.07} />

      {/* Handlebars with grips, and a small console with a screen */}
      <mesh position={[0, BIKE.bar.y, BIKE.bar.z]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.018, 0.018, BIKE.bar.halfWidth * 2 + 0.1, 12]} />
        <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * BIKE.bar.halfWidth, BIKE.bar.y, BIKE.bar.z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.026, 0.026, 0.12, 12]} />
          <meshStandardMaterial color={COLORS.saddle} roughness={0.9} />
        </mesh>
      ))}
      <group position={[0, BIKE.bar.y + 0.12, BIKE.bar.z + 0.05]} rotation-x={-0.6}>
        <Box size={[0.24, 0.16, 0.05]} position={[0, 0, 0]} color={COLORS.frame} />
        <mesh position-z={-0.026} rotation-y={Math.PI}>
          <planeGeometry args={[0.18, 0.1]} />
          <meshBasicMaterial color={COLORS.screen} toneMapped={false} />
        </mesh>
      </group>

      {/* Flywheel at the front: a heavy disc with an orange stripe so you can see it spin */}
      <group ref={flywheel} position={[0, FLYWHEEL.y, FLYWHEEL.z]}>
        <mesh rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[FLYWHEEL.radius, FLYWHEEL.radius, 0.05, 32]} />
          <meshStandardMaterial color={COLORS.flywheel} metalness={0.6} roughness={0.4} />
        </mesh>
        <Box size={[0.052, 0.04, FLYWHEEL.radius * 2 - 0.02]} position={[0, 0, 0]} color={COLORS.accent} />
      </group>

      {/* Cranks: an arm on each side with a pedal on the end. The left arm points
          down at angle 0; the right one points up (half a turn round). */}
      {[
        { side: 1, crank: leftCrank, pedal: leftPedal },
        { side: -1, crank: rightCrank, pedal: rightPedal },
      ].map(({ side, crank, pedal }) => {
        const reach = side === 1 ? -BIKE.crankLength : BIKE.crankLength
        return (
          <group key={side} ref={crank} position={[side * BIKE.crankArmX, BIKE.crankY, BIKE.crankZ]}>
            <Box size={[0.025, BIKE.crankLength, 0.035]} position={[0, reach / 2, 0]} color={COLORS.metal} />
            <group ref={pedal} position={[side * (BIKE.pedalX - BIKE.crankArmX), reach, 0]}>
              <Box size={[0.1, 0.025, 0.12]} position={[0, 0, 0]} color={COLORS.saddle} />
            </group>
          </group>
        )
      })}
    </group>
  )
}
