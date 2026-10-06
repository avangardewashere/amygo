import { DumbbellModel, REST_HEIGHT } from './Dumbbell'
import { RACK_WIDTH, RACK_DEPTH } from './sizes'
export { RACK_WIDTH, RACK_DEPTH }

const COLORS = {
  frame: '#2b2d31',
  tray: '#3d4046',
}

const TRAY_WIDTH = RACK_WIDTH - 0.01
const TRAY_DEPTH = 0.34
const TRAY_THICKNESS = 0.03
const TRAY_TILT = 0.2 // radians (~11°), front edge lower so dumbbells roll toward you
const SIDE_X = RACK_WIDTH / 2 - 0.03

// Two shelves, stepped like stairs: the low one at the front, the high one behind
const TRAYS = [
  { y: 0.42, z: 0.14 },
  { y: 0.8, z: -0.14 },
]

// Five dumbbells per shelf, lightest on the left. Scale 1 = the 10 kg one.
const DUMBBELL_SCALES = [0.75, 0.82, 0.9, 0.97, 1.05]
const DUMBBELL_SPACING = 0.25

type Metal = { color: string }
function Box({ size, position, color }: Metal & { size: [number, number, number]; position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
    </mesh>
  )
}

// A two-tier dumbbell rack. Front faces +z; centered on its floor footprint.
export function DumbbellRack() {
  return (
    <group>
      {/* Side frames: a base rail on the floor plus three posts holding the trays */}
      {[-SIDE_X, SIDE_X].map((x) => (
        <group key={x}>
          <Box size={[0.05, 0.05, RACK_DEPTH - 0.04]} position={[x, 0.025, 0]} color={COLORS.frame} />
          <Box size={[0.05, 0.42, 0.05]} position={[x, 0.21, 0.28]} color={COLORS.frame} />
          <Box size={[0.05, 0.8, 0.05]} position={[x, 0.4, 0]} color={COLORS.frame} />
          <Box size={[0.05, 0.82, 0.05]} position={[x, 0.41, -0.28]} color={COLORS.frame} />
        </group>
      ))}

      {TRAYS.map((tray) => (
        // Each tray is its own tilted group, so the dumbbells on it tilt with it
        <group key={tray.y} position={[0, tray.y, tray.z]} rotation-x={TRAY_TILT}>
          <Box size={[TRAY_WIDTH, TRAY_THICKNESS, TRAY_DEPTH]} position={[0, 0, 0]} color={COLORS.tray} />
          {/* Lip along the front edge that stops dumbbells sliding off */}
          <Box
            size={[TRAY_WIDTH, 0.05, 0.02]}
            position={[0, 0.025, TRAY_DEPTH / 2]}
            color={COLORS.frame}
          />
          {DUMBBELL_SCALES.map((scale, i) => (
            <DumbbellModel
              key={scale}
              scale={scale}
              // Bar points front-to-back (along z), resting on the tray surface
              rotation-y={Math.PI / 2}
              position={[
                (i - (DUMBBELL_SCALES.length - 1) / 2) * DUMBBELL_SPACING,
                TRAY_THICKNESS / 2 + REST_HEIGHT * scale,
                0,
              ]}
            />
          ))}
        </group>
      ))}
    </group>
  )
}
