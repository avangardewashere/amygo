import { BENCH } from './benchGeometry'

const COLORS = {
  frame: '#2b2d31',
  pad: '#1c1d20',
  trim: '#e4572e',
  foot: '#111214',
}

// Overall size in meters. The catalog uses these for the floor footprint.
export const BENCH_WIDTH = 0.6 // along x (the feet stick out wider than the pad)
export const BENCH_DEPTH = 1.3 // along z

const PAD_THICKNESS = 0.1

type BoxProps = { size: [number, number, number]; position: [number, number, number]; color: string }
function Box({ size, position, color }: BoxProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
    </mesh>
  )
}

// A flat weight bench running along z. Nothing on it moves; the person does
// the work (lying on it to bench press, or sitting on the end to shoulder press).
export function Bench() {
  const padY = BENCH.topY - PAD_THICKNESS / 2
  return (
    <group>
      {/* Padded top, with a thin orange trim line along each side */}
      <Box size={[BENCH.padWidth, PAD_THICKNESS, BENCH.length]} position={[0, padY, 0]} color={COLORS.pad} />
      {[-1, 1].map((side) => (
        <Box
          key={side}
          size={[0.006, 0.02, BENCH.length - 0.02]}
          position={[side * (BENCH.padWidth / 2 + 0.003), padY, 0]}
          color={COLORS.trim}
        />
      ))}

      {/* Steel frame: a beam under the pad, two legs, and wide feet for stability */}
      <Box size={[0.08, 0.06, BENCH.length - 0.2]} position={[0, BENCH.topY - PAD_THICKNESS - 0.03, 0]} color={COLORS.frame} />
      {[-0.45, 0.45].map((z) => (
        <group key={z}>
          <Box size={[0.08, BENCH.topY - PAD_THICKNESS - 0.04, 0.08]} position={[0, (BENCH.topY - PAD_THICKNESS) / 2, z]} color={COLORS.frame} />
          <Box size={[BENCH_WIDTH, 0.05, 0.1]} position={[0, 0.025, z]} color={COLORS.frame} />
          {[-1, 1].map((side) => (
            <Box key={side} size={[0.06, 0.03, 0.1]} position={[side * (BENCH_WIDTH / 2 - 0.03), 0.015, z]} color={COLORS.foot} />
          ))}
        </group>
      ))}
    </group>
  )
}
