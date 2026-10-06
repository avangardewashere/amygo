import { ROOM, COLORS } from './dimensions'
import { Floor } from './Floor'
import { Walls } from './Walls'
import { WallArt } from './WallArt'

const { width: W, depth: D, height: H } = ROOM

export function Room() {
  return (
    <group>
      {/* Floor: rubber tiles, turf, cardio tiles, platforms */}
      <Floor />

      {/* Ceiling: facing down, so it hides when you look from above */}
      <mesh position-y={H} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, D]} />
        {/* The ceiling lights only shine down, and three.js doesn't bounce light off
            the floor, so the ceiling would be black. A faint glow fakes that bounce. */}
        <meshStandardMaterial
          color={COLORS.ceiling}
          roughness={1}
          emissive={COLORS.ceiling}
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Walls (each hides when the camera is behind it), with the band,
          stripe, slatted accent wall and mirror on them */}
      <Walls />
      {/* Painted words: the gym name, zone names, a motto */}
      <WallArt />
    </group>
  )
}
