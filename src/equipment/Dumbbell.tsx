import type { ThreeElements } from '@react-three/fiber'

const COLORS = {
  head: '#1c1d20', // rubber-coated hex heads
  metal: '#b9bcc2', // chrome handle and collars
}

// Sizes in meters, roughly a 10 kg hex dumbbell
const HEAD_RADIUS = 0.075 // center to a corner of the hexagon
const HEAD_LENGTH = 0.1
const HANDLE_RADIUS = 0.016
const HANDLE_LENGTH = 0.14
const COLLAR_LENGTH = 0.015

// Distance from the floor to the center of a hexagon resting on a flat side
export const REST_HEIGHT = HEAD_RADIUS * Math.cos(Math.PI / 6)

// Where each head sits along the bar, measured from the middle
const HEAD_OFFSET = HANDLE_LENGTH / 2 + COLLAR_LENGTH + HEAD_LENGTH / 2

// The dumbbell itself, centered on its handle, with the bar along x.
// Used on the floor (<Dumbbell>) and in the person's hand.
export function DumbbellModel(props: ThreeElements['group']) {
  return (
    <group {...props}>
      {/* Cylinders stand upright by default; turn this one on its side (along x) */}
      <group rotation-z={Math.PI / 2}>
        {/* Handle runs through the whole thing */}
        <mesh castShadow>
          <cylinderGeometry args={[HANDLE_RADIUS, HANDLE_RADIUS, HEAD_OFFSET * 2, 16]} />
          <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
        </mesh>

        {[-1, 1].map((side) => (
          <group key={side}>
            {/* Collar: the small metal ring between handle and head */}
            <mesh position-y={side * (HANDLE_LENGTH / 2 + COLLAR_LENGTH / 2)} castShadow>
              <cylinderGeometry args={[0.028, 0.028, COLLAR_LENGTH, 16]} />
              <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Head: a cylinder with only 6 sides is a hexagon. The 30° start
                angle turns it so a flat side (not a corner) faces the floor. */}
            <mesh position-y={side * HEAD_OFFSET} castShadow receiveShadow>
              <cylinderGeometry args={[HEAD_RADIUS, HEAD_RADIUS, HEAD_LENGTH, 6, 1, false, Math.PI / 6]} />
              <meshStandardMaterial color={COLORS.head} roughness={0.85} flatShading />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

// A dumbbell lying on the floor. Pass position/rotation like any 3D object:
//   <Dumbbell position={[2, 0, -1]} rotation-y={0.4} />
// The y in position is the floor; it lifts itself so the heads rest on it.
export function Dumbbell(props: ThreeElements['group']) {
  return (
    <group {...props}>
      <DumbbellModel position-y={REST_HEIGHT} />
    </group>
  )
}
