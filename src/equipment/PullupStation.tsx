import { PULLUP } from './pullupGeometry'

const COLORS = {
  frame: '#2b2d31',
  pad: '#1c1d20',
  bar: '#c9ccd1',
  accent: '#e4572e',
  foot: '#111214',
}

// Overall size in meters. The catalog uses these for the floor footprint.
export const PULLUP_WIDTH = 1.4 // along x
export const PULLUP_DEPTH = 1.4 // along z

const POST = 0.07
const TOWER_HEIGHT = 2.45

type BoxProps = { size: [number, number, number]; position: [number, number, number]; color: string }
function Box({ size, position, color }: BoxProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
    </mesh>
  )
}

// A round part lying along x (the bar and its grips)
function Round({ radius, length, x, color }: { radius: number; length: number; x: number; color: string }) {
  return (
    <mesh position={[x, PULLUP.bar.y, PULLUP.bar.z]} rotation-z={Math.PI / 2} castShadow>
      <cylinderGeometry args={[radius, radius, length, 20]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
    </mesh>
  )
}

// A freestanding pull-up station ("power tower"): two uprights on long feet,
// arms reaching out to a bar overhead. You hang under the bar facing the
// tower. Nothing on it moves; the person does all the work.
export function PullupStation() {
  const { towerX, towerZ, bar } = PULLUP
  const armLength = towerZ - bar.z
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Long foot along the floor, with rubber caps at each end */}
          <Box size={[0.08, 0.06, 1.3]} position={[side * towerX, 0.03, 0]} color={COLORS.frame} />
          <Box size={[0.1, 0.03, 0.1]} position={[side * towerX, 0.015, -0.6]} color={COLORS.foot} />
          <Box size={[0.1, 0.03, 0.1]} position={[side * towerX, 0.015, 0.6]} color={COLORS.foot} />
          {/* Upright */}
          <Box size={[POST, TOWER_HEIGHT, POST]} position={[side * towerX, TOWER_HEIGHT / 2, towerZ]} color={COLORS.frame} />
          {/* Arm reaching back from the upright to hold the bar */}
          <Box size={[0.06, 0.06, armLength + 0.04]} position={[side * towerX, bar.y, (towerZ + bar.z) / 2]} color={COLORS.frame} />
          {/* Foam grips where the hands go */}
          <Round radius={0.024} length={0.16} x={side * PULLUP.gripX} color={COLORS.accent} />
        </group>
      ))}

      {/* Braces between the uprights: at the top, and low down in front of you */}
      <Box size={[towerX * 2 + POST, POST, POST]} position={[0, TOWER_HEIGHT - POST / 2, towerZ]} color={COLORS.frame} />
      <Box size={[towerX * 2, 0.06, 0.06]} position={[0, 0.5, towerZ]} color={COLORS.frame} />

      {/* Back pad on a crossbar (what you'd lean on for knee raises) */}
      <Box size={[towerX * 2, 0.06, 0.06]} position={[0, 1.2, towerZ]} color={COLORS.frame} />
      <Box size={[0.4, 0.5, 0.07]} position={[0, 1.2, towerZ - 0.06]} color={COLORS.pad} />

      {/* The pull-up bar */}
      <Round radius={PULLUP.barRadius} length={towerX * 2 + 0.06} x={0} color={COLORS.bar} />
    </group>
  )
}
