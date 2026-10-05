import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { machine } from './machineState'
import { FLY, HANDLE_DROP, HANDLE_FORWARD, LEVER_REACH, PIVOT_Y, flyAngle } from './chestFlyGeometry'
import { repPhase } from '../interaction/reps'
import { SHOULDER_X } from '../player/proportions'

const COLORS = {
  frame: '#2b2d31',
  pad: '#1c1d20',
  metal: '#b9bcc2',
  plate: '#17181b',
  accent: '#e4572e',
}

// Overall size in meters. The catalog uses these for the floor footprint.
export const CHEST_FLY_WIDTH = 1.3 // along x
export const CHEST_FLY_DEPTH = 1.3 // along z

const FRAME_X = 0.5
const BACK_Z = FLY.hipZ - 0.62 // the uprights and weight stack stand behind the seat
const PLATE_COUNT = 10
const PLATE_GAP = 0.045
const LIFTED_PLATES = 4 // the pin is set to lift the top four
const MAX_LIFT = 0.28 // how high the selected plates rise at full squeeze

type BoxProps = {
  size: [number, number, number]
  position: [number, number, number]
  color: string
}
function Box({ size, position, color }: BoxProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
    </mesh>
  )
}

// A seated chest fly ("pec deck"). You sit facing +z and hold two handles;
// squeezing them together in front of your chest swings the machine's arms
// and lifts part of the weight stack. `id` lets it know whether it's in use.
export function ChestFly({ id }: { id: string }) {
  const leftLever = useRef<Group>(null) // on the +x side
  const rightLever = useRef<Group>(null)
  const liftedPlates = useRef<Group>(null)
  const squeeze = useRef(0)

  useFrame((_, delta) => {
    const inUse = machine.activeId === id
    const target = inUse ? repPhase(machine.startedAt) : 0
    // In use: follow the rep exactly (so the handles stay in the hands).
    // Afterwards: let the arms swing back open gently.
    squeeze.current = inUse ? target : MathUtils.damp(squeeze.current, target, 5, delta)
    const angle = flyAngle(squeeze.current)
    // Same sweep rotation as the person's shoulders (see Person.tsx), so the
    // machine's arm and the person's arm move as one
    leftLever.current!.rotation.y = -angle
    rightLever.current!.rotation.y = angle
    liftedPlates.current!.position.y = squeeze.current * MAX_LIFT
  })

  const seatTop = FLY.hipY - 0.05
  return (
    <group>
      {/* Base frame on the floor */}
      {[-FRAME_X, FRAME_X].map((x) => (
        <Box key={x} size={[0.06, 0.06, 1.2]} position={[x, 0.03, -0.05]} color={COLORS.frame} />
      ))}
      <Box size={[1.06, 0.06, 0.06]} position={[0, 0.03, 0.52]} color={COLORS.frame} />
      <Box size={[1.06, 0.06, 0.06]} position={[0, 0.03, BACK_Z]} color={COLORS.frame} />

      {/* Seat on a post, and an upright backrest */}
      <Box size={[0.08, seatTop - 0.08, 0.08]} position={[0, (seatTop - 0.08) / 2, FLY.hipZ]} color={COLORS.frame} />
      <Box size={[0.45, 0.08, 0.4]} position={[0, seatTop - 0.04, FLY.hipZ + 0.05]} color={COLORS.pad} />
      <Box size={[0.45, 0.7, 0.08]} position={[0, FLY.hipY + 0.4, FLY.hipZ - 0.25]} color={COLORS.pad} />
      <Box size={[0.08, 0.5, 0.08]} position={[0, FLY.hipY + 0.2, FLY.hipZ - 0.32]} color={COLORS.frame} />

      {/* Uprights behind the seat, and two top beams reaching forward over your shoulders */}
      {[-FRAME_X, FRAME_X].map((x) => (
        <Box key={x} size={[0.07, PIVOT_Y + 0.08, 0.07]} position={[x, (PIVOT_Y + 0.08) / 2, BACK_Z]} color={COLORS.frame} />
      ))}
      <Box size={[1.07, 0.07, 0.07]} position={[0, PIVOT_Y + 0.08, BACK_Z]} color={COLORS.frame} />
      {[-SHOULDER_X, SHOULDER_X].map((x) => (
        <Box key={x} size={[0.06, 0.06, FLY.hipZ - BACK_Z]} position={[x, PIVOT_Y + 0.08, (FLY.hipZ + BACK_Z) / 2]} color={COLORS.frame} />
      ))}

      {/* The two swinging arms. Each pivots right above one of your shoulders,
          reaches out by an upper-arm's length, then drops down to a handle
          right where your hand is (upper arm out, forearm up). */}
      {[
        { side: 1, ref: leftLever },
        { side: -1, ref: rightLever },
      ].map(({ side, ref }) => (
        <group key={side} ref={ref} position={[side * SHOULDER_X, PIVOT_Y, FLY.hipZ]}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.06, 16]} />
            <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
          </mesh>
          <Box size={[LEVER_REACH, 0.05, 0.05]} position={[side * (LEVER_REACH / 2), 0, 0]} color={COLORS.frame} />
          <Box size={[0.05, HANDLE_DROP + 0.05, 0.05]} position={[side * LEVER_REACH, -HANDLE_DROP / 2, 0]} color={COLORS.frame} />
          {/* Handle: a padded vertical grip where the hand holds on */}
          <mesh position={[side * LEVER_REACH, -HANDLE_DROP, HANDLE_FORWARD]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.22, 12]} />
            <meshStandardMaterial color={COLORS.pad} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Weight stack behind the backrest: guide rods, a stack of plates, and
          the top few plates (the ones the pin selects) that rise with each rep */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.75, BACK_Z + 0.12]}>
          <cylinderGeometry args={[0.012, 0.012, 1.45, 8]} />
          <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {Array.from({ length: PLATE_COUNT - LIFTED_PLATES }, (_, i) => (
        <Box key={i} size={[0.3, 0.04, 0.16]} position={[0, 0.08 + i * PLATE_GAP, BACK_Z + 0.12]} color={COLORS.plate} />
      ))}
      <group ref={liftedPlates}>
        {Array.from({ length: LIFTED_PLATES }, (_, i) => (
          <Box
            key={i}
            size={[0.3, 0.04, 0.16]}
            position={[0, 0.08 + (PLATE_COUNT - LIFTED_PLATES + i) * PLATE_GAP, BACK_Z + 0.12]}
            color={i === LIFTED_PLATES - 1 ? COLORS.accent : COLORS.plate}
          />
        ))}
      </group>
    </group>
  )
}
