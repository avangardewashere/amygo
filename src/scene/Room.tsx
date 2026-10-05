import { ROOM, COLORS } from './dimensions'

const { width: W, depth: D, height: H } = ROOM
const STRIPE_HEIGHT = 0.25
const STRIPE_Y = 1.2

// Each wall is a flat plane facing *into* the room. Planes only render their
// front face, so when the camera orbits outside a wall, that wall disappears
// and you can see inside — a "dollhouse" view for free.
type Wall = {
  name: string
  length: number
  position: [number, number, number]
  rotationY: number
}

const walls: Wall[] = [
  { name: 'back', length: W, position: [0, H / 2, -D / 2], rotationY: 0 },
  { name: 'front', length: W, position: [0, H / 2, D / 2], rotationY: Math.PI },
  { name: 'left', length: D, position: [-W / 2, H / 2, 0], rotationY: Math.PI / 2 },
  { name: 'right', length: D, position: [W / 2, H / 2, 0], rotationY: -Math.PI / 2 },
]

export function Room() {
  return (
    <group>
      {/* Floor: rotated flat, facing up */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.95} />
      </mesh>

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

      {walls.map((wall) => (
        <group
          key={wall.name}
          position={wall.position}
          rotation-y={wall.rotationY}
        >
          <mesh receiveShadow>
            <planeGeometry args={[wall.length, H]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
          </mesh>
          {/* Accent stripe, nudged 1cm off the wall so it doesn't flicker */}
          <mesh position={[0, STRIPE_Y - H / 2, 0.01]}>
            <planeGeometry args={[wall.length, STRIPE_HEIGHT]} />
            <meshStandardMaterial color={COLORS.accent} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
