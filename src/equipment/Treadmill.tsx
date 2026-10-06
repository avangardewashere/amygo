import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { machine } from './machineState'
import { TREADMILL_WIDTH, TREADMILL_DEPTH, DECK_HEIGHT } from './sizes'
export { TREADMILL_WIDTH, TREADMILL_DEPTH, DECK_HEIGHT }

const COLORS = {
  frame: '#2b2d31',
  cover: '#9aa0a8',
  belt: '#16171a',
  slat: '#2c2e33',
  screen: '#38bdf8',
}

// How high the running surface is: the person stands this far off the floor

// The belt runs from the back edge to just under the motor hood
const BELT_WIDTH = 0.56
const BELT_BACK = -0.9
const BELT_FRONT = 0.66
const BELT_LENGTH = BELT_FRONT - BELT_BACK
const SLAT_COUNT = 12

type BoxProps = { size: [number, number, number]; position: [number, number, number]; color: string; rotationX?: number }
function Box({ size, position, color, rotationX = 0 }: BoxProps) {
  return (
    <mesh position={position} rotation-x={rotationX} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
    </mesh>
  )
}

// A treadmill. The console is at the front (+z); you stand facing it.
// `id` lets it know whether it's the one being used, so only that belt moves.
export function Treadmill({ id }: { id: string }) {
  const slats = useRef<Group>(null)
  const travelled = useRef(0)
  const speed = useRef(0)

  // Move the belt: shift every slat backward and wrap it to the front when it
  // falls off the back, which looks like one endless loop
  useFrame((_, delta) => {
    const target = machine.activeId === id ? machine.speed : 0
    speed.current = MathUtils.damp(speed.current, target, 3, delta) // belts spin up/down, not instantly
    travelled.current += speed.current * Math.min(delta, 0.1)
    slats.current!.children.forEach((slat, i) => {
      const along = (i / SLAT_COUNT) * BELT_LENGTH - travelled.current
      const wrapped = ((along % BELT_LENGTH) + BELT_LENGTH) % BELT_LENGTH
      slat.position.z = BELT_FRONT - wrapped
    })
  })

  return (
    <group>
      {/* Deck: the long base everything sits on, with small feet */}
      <Box size={[0.8, 0.14, 1.9]} position={[0, 0.11, -0.05]} color={COLORS.frame} />
      {/* Side rails either side of the belt, where you put your feet to step off */}
      {[-0.35, 0.35].map((x) => (
        <Box key={x} size={[0.1, 0.03, 1.8]} position={[x, DECK_HEIGHT + 0.005, -0.1]} color={COLORS.cover} />
      ))}

      {/* Belt surface, with slats that slide along it */}
      <mesh position={[0, DECK_HEIGHT, (BELT_FRONT + BELT_BACK) / 2]} receiveShadow>
        <boxGeometry args={[BELT_WIDTH, 0.01, BELT_LENGTH]} />
        <meshStandardMaterial color={COLORS.belt} roughness={0.95} />
      </mesh>
      <group ref={slats}>
        {Array.from({ length: SLAT_COUNT }, (_, i) => (
          <mesh key={i} position-y={DECK_HEIGHT + 0.007}>
            <boxGeometry args={[BELT_WIDTH - 0.02, 0.004, 0.03]} />
            <meshStandardMaterial color={COLORS.slat} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Motor hood over the front end of the belt */}
      <Box size={[0.8, 0.14, 0.3]} position={[0, 0.25, 0.83]} color={COLORS.frame} />

      {/* Two uprights holding the console */}
      {[-0.4, 0.4].map((x) => (
        <Box key={x} size={[0.06, 1.15, 0.08]} position={[x, 0.75, 0.86]} color={COLORS.frame} />
      ))}
      {/* Handrails you can hold, running back from the uprights */}
      {[-0.4, 0.4].map((x) => (
        <Box key={x} size={[0.04, 0.04, 0.55]} position={[x, 1.05, 0.6]} color={COLORS.cover} />
      ))}

      {/* Console, tilted toward the runner, with a glowing screen on its face */}
      <group position={[0, 1.36, 0.84]} rotation-x={-0.5}>
        <Box size={[0.86, 0.3, 0.1]} position={[0, 0, 0]} color={COLORS.frame} />
        <mesh position-z={-0.051} rotation-y={Math.PI}>
          <planeGeometry args={[0.46, 0.16]} />
          <meshBasicMaterial color={COLORS.screen} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
