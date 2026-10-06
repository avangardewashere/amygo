import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { machine } from './machineState'
import { SQUAT, barTarget } from './squatGeometry'

const COLORS = {
  frame: '#2b2d31',
  accent: '#e4572e',
  bar: '#c9ccd1',
  plate: '#1c1d20',
  foot: '#111214',
}

// Overall size in meters. The catalog uses these for the floor footprint.
export const SQUAT_RACK_WIDTH = 2.3 // along x (the barbell is 2.2 m long)
export const SQUAT_RACK_DEPTH = 1.1 // along z

const POST = 0.07 // the uprights are 7 cm square steel
// The bar glides between the hooks and the person's back at this rate, then
// tracks the back closely during the set (like hands on a moving handle)
const LIFT_EASE = 6
const RIDE_EASE = 60
const LIFT_SECONDS = 0.6

type BoxProps = { size: [number, number, number]; position: [number, number, number]; color: string }
function Box({ size, position, color }: BoxProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
    </mesh>
  )
}

// A round part lying along x (bar, sleeve, collar, plate)
function Round({ radius, length, x, color }: { radius: number; length: number; x: number; color: string }) {
  return (
    <mesh position-x={x} rotation-z={Math.PI / 2} castShadow>
      <cylinderGeometry args={[radius, radius, length, 24]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
    </mesh>
  )
}

// A squat stand: two uprights with J-hooks holding a loaded barbell, and
// safety arms reaching out toward you. You squat in front of it, facing it.
export function SquatRack({ id }: { id: string }) {
  const barbell = useRef<Group>(null)

  useFrame((_, delta) => {
    const inUse = machine.activeId === id
    const lifting = !inUse || performance.now() - machine.startedAt < LIFT_SECONDS * 1000
    const rate = lifting ? LIFT_EASE : RIDE_EASE
    const target = barTarget(id)
    const bar = barbell.current!.position
    bar.y = MathUtils.damp(bar.y, target.y, rate, delta)
    bar.z = MathUtils.damp(bar.z, target.z, rate, delta)
  })

  const { uprightX, uprightZ, height, hooks, safetyY } = SQUAT
  const safetyLength = 0.7
  return (
    <group>
      {/* Base: a floor beam under each upright, joined at the back */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box size={[0.08, 0.06, 0.6]} position={[side * uprightX, 0.03, 0.25]} color={COLORS.frame} />
          <Box size={[0.1, 0.03, 0.1]} position={[side * uprightX, 0.015, 0.5]} color={COLORS.foot} />
          <Box size={[0.1, 0.03, 0.1]} position={[side * uprightX, 0.015, 0]} color={COLORS.foot} />

          {/* Upright */}
          <Box size={[POST, height, POST]} position={[side * uprightX, height / 2, uprightZ]} color={COLORS.frame} />

          {/* J-hook: a short arm out from the upright with a lip, so the bar can't roll off */}
          <Box size={[0.05, 0.03, 0.14]} position={[side * uprightX, hooks.y - 0.03, uprightZ - 0.1]} color={COLORS.accent} />
          <Box size={[0.05, 0.06, 0.02]} position={[side * uprightX, hooks.y - 0.005, uprightZ - 0.17]} color={COLORS.accent} />

          {/* Safety arm: catches the bar if a rep goes wrong */}
          <Box size={[0.06, 0.06, safetyLength]} position={[side * uprightX, safetyY, uprightZ - safetyLength / 2]} color={COLORS.frame} />
        </group>
      ))}
      <Box size={[uprightX * 2, 0.06, 0.08]} position={[0, 0.03, 0.5]} color={COLORS.frame} />
      <Box size={[uprightX * 2 + POST, POST, POST]} position={[0, height - POST / 2, uprightZ]} color={COLORS.frame} />

      {/* Barbell: a 2.2 m bar with thicker sleeves, a big plate and a collar each side */}
      <group ref={barbell} userData={{ moving: true }} position={[0, hooks.y, hooks.z]}>
        <Round radius={SQUAT.barRadius} length={1.3} x={0} color={COLORS.bar} />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Round radius={0.025} length={0.45} x={side * 0.875} color={COLORS.bar} />
            <Round radius={0.225} length={0.05} x={side * 0.75} color={COLORS.plate} />
            <Round radius={0.035} length={0.03} x={side * 0.79} color={COLORS.accent} />
          </group>
        ))}
      </group>
    </group>
  )
}
