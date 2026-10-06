import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Vector3, type Group, type Mesh } from 'three'
import { machine } from './machineState'
import { repPhase } from '../interaction/reps'
import { SEAT_TO_HIP, SHOULDER_X } from '../player/proportions'
import { CABLE, activeCable, cableEnd, pushdownArm, rowPosition, stackLift } from './cableGeometry'

const COLORS = {
  frame: '#2b2d31',
  pad: '#1c1d20',
  metal: '#b9bcc2',
  plate: '#17181b',
  accent: '#e4572e',
  cable: '#8a8f98',
  rope: '#202227',
}

// Overall size in meters. The catalog uses these for the floor footprint.
export const CABLE_WIDTH = 1.0 // along x
export const CABLE_DEPTH = 1.8 // along z

const TOWER_Z = 0.75 // the uprights and weight stack
const TOWER_HEIGHT = 2.35
const STACK_Z = 0.68
const PLATE_COUNT = 12
const PLATE_GAP = 0.045
const LIFTED_PLATES = 5
const SEAT = { top: CABLE.row.hipY - SEAT_TO_HIP, from: -0.9, to: -0.3 }
// Where the handles hang when nobody is pulling them
const ROPE_REST = { y: CABLE.high.y - 0.45, z: CABLE.high.z }
const HANDLE_REST = { y: CABLE.low.y, z: CABLE.low.z - 0.08 }

// When an exercise begins, the rope or handle glides from where it hangs into
// the hands (and back again afterwards) at this rate, then follows the hands exactly
const GLIDE_EASE = 14
const GLIDE_SECONDS = 0.4

const UP = new Vector3(0, 1, 0)
const from = new Vector3()
const to = new Vector3()

// Stretch a thin bar (a box 1 m tall) between two points
function stretch(mesh: Mesh, a: Vector3, b: Vector3) {
  const length = a.distanceTo(b)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.y = length
  mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).divideScalar(length))
}

type BoxProps = { size: [number, number, number]; position: [number, number, number]; color: string; rotationX?: number }
function Box({ size, position, color, rotationX = 0 }: BoxProps) {
  return (
    <mesh position={position} rotation-x={rotationX} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
    </mesh>
  )
}

function Strand({ strandRef, width, color }: { strandRef: RefObject<Mesh | null>; width: number; color: string }) {
  return (
    <mesh ref={strandRef} castShadow>
      <boxGeometry args={[width, 1, width]} />
      <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
    </mesh>
  )
}

// A pulley wheel, turned so the cable runs along z
function Pulley({ y, z }: { y: number; z: number }) {
  return (
    <group position={[0, y, z]}>
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 20]} />
        <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
      </mesh>
      <Box size={[0.07, 0.11, 0.06]} position={[0, 0, 0.03]} color={COLORS.accent} />
    </group>
  )
}

// A cable tower: a weight stack, a high pulley with a rope (tricep pushdowns)
// and a low pulley with a V-handle, plus a low seat and footplate (rows).
// You face the tower (+z). The cables stretch to wherever the handles are.
export function CableMachine({ id }: { id: string }) {
  const highCable = useRef<Mesh>(null)
  const lowCable = useRef<Mesh>(null)
  const leftRope = useRef<Mesh>(null)
  const rightRope = useRef<Mesh>(null)
  const handle = useRef<Group>(null)
  const lifted = useRef<Group>(null)
  // Where the rope (its middle, its ends) and the V-handle are right now
  const rope = useRef({ y: ROPE_REST.y, z: ROPE_REST.z, handY: ROPE_REST.y - 0.3, handZ: ROPE_REST.z, spread: 0.04 })
  const grip = useRef({ ...HANDLE_REST })

  useFrame((_, delta) => {
    const kind = activeCable(id)
    const t = kind ? repPhase(machine.startedAt) : 0
    // Gliding into the hands at the start (or back to rest after); otherwise exact
    const gliding = !kind || performance.now() - machine.startedAt < GLIDE_SECONDS * 1000
    const follow = (from: number, to: number) => (gliding ? MathUtils.damp(from, to, GLIDE_EASE, delta) : to)

    // High pulley: the cable runs down to the rope's middle; each rope end is
    // in a hand during pushdowns, or hangs down when nobody holds it
    const ropeTarget = kind === 'pushdown' ? cableEnd('pushdown', t) : ROPE_REST
    const handTarget = kind === 'pushdown' ? pushdownArm(t).hand : { y: ROPE_REST.y - 0.3, z: ROPE_REST.z }
    const r = rope.current
    r.y = follow(r.y, ropeTarget.y)
    r.z = follow(r.z, ropeTarget.z)
    r.handY = follow(r.handY, handTarget.y)
    r.handZ = follow(r.handZ, handTarget.z)
    r.spread = follow(r.spread, kind === 'pushdown' ? SHOULDER_X : 0.04)
    const ropeMiddle = r
    stretch(highCable.current!, from.set(0, CABLE.high.y, CABLE.high.z), to.set(0, ropeMiddle.y, ropeMiddle.z))
    const hand = { y: r.handY, z: r.handZ }
    const spread = r.spread
    ;[
      { side: 1, rope: leftRope },
      { side: -1, rope: rightRope },
    ].forEach(({ side, rope }) => {
      stretch(rope.current!, from.set(0, ropeMiddle.y, ropeMiddle.z), to.set(side * spread, hand.y, hand.z))
    })

    // Low pulley: the cable runs to the V-handle
    const gripTarget = kind === 'cableRow' ? rowPosition(t).handle : HANDLE_REST
    const g = grip.current
    g.y = follow(g.y, gripTarget.y)
    g.z = follow(g.z, gripTarget.z)
    handle.current!.position.set(0, g.y, g.z)
    stretch(lowCable.current!, from.set(0, CABLE.low.y, CABLE.low.z), to.set(0, g.y, g.z + 0.07))

    // The stack rises by exactly as much cable as has been pulled out; after a
    // set it settles back down
    const lift = lifted.current!
    lift.position.y = kind ? stackLift(kind, t) : MathUtils.damp(lift.position.y, 0, 6, delta)
  })

  return (
    <group>
      {/* Base: two floor rails, joined under the tower and under the seat */}
      {[-0.4, 0.4].map((x) => (
        <Box key={x} size={[0.06, 0.06, 1.75]} position={[x, 0.03, 0]} color={COLORS.frame} />
      ))}
      <Box size={[0.86, 0.06, 0.08]} position={[0, 0.03, TOWER_Z]} color={COLORS.frame} />
      <Box size={[0.86, 0.06, 0.08]} position={[0, 0.03, -0.75]} color={COLORS.frame} />

      {/* Tower: two uprights, a top beam, and an arm reaching out to the high pulley */}
      {[-0.3, 0.3].map((x) => (
        <Box key={x} size={[0.07, TOWER_HEIGHT, 0.07]} position={[x, TOWER_HEIGHT / 2, TOWER_Z]} color={COLORS.frame} />
      ))}
      <Box size={[0.67, 0.07, 0.07]} position={[0, TOWER_HEIGHT, TOWER_Z]} color={COLORS.frame} />
      <Box size={[0.06, 0.06, TOWER_Z - CABLE.high.z + 0.03]} position={[0, CABLE.high.y + 0.1, (TOWER_Z + CABLE.high.z) / 2]} color={COLORS.frame} />
      <Box size={[0.05, TOWER_HEIGHT - CABLE.high.y - 0.12, 0.05]} position={[0, (TOWER_HEIGHT + CABLE.high.y + 0.12) / 2, TOWER_Z]} color={COLORS.frame} />
      <Pulley y={CABLE.high.y + 0.045} z={CABLE.high.z} />

      {/* Low pulley on a bracket at the foot of the tower */}
      <Box size={[0.06, CABLE.low.y - 0.06, 0.06]} position={[0, CABLE.low.y / 2, CABLE.low.z + 0.04]} color={COLORS.frame} />
      <Pulley y={CABLE.low.y} z={CABLE.low.z} />

      {/* Weight stack between the uprights: guide rods, resting plates, and the
          top plates (picked by the pin) that rise as cable is pulled out */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 1.0, STACK_Z]}>
          <cylinderGeometry args={[0.012, 0.012, 1.95, 8]} />
          <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {Array.from({ length: PLATE_COUNT - LIFTED_PLATES }, (_, i) => (
        <Box key={i} size={[0.3, 0.04, 0.16]} position={[0, 0.1 + i * PLATE_GAP, STACK_Z]} color={COLORS.plate} />
      ))}
      <group ref={lifted}>
        {Array.from({ length: LIFTED_PLATES }, (_, i) => (
          <Box
            key={i}
            size={[0.3, 0.04, 0.16]}
            position={[0, 0.1 + (PLATE_COUNT - LIFTED_PLATES + i) * PLATE_GAP, STACK_Z]}
            color={i === LIFTED_PLATES - 1 ? COLORS.accent : COLORS.plate}
          />
        ))}
        {/* The stack's own cable, running up to the top of the tower */}
        <mesh position={[0, 1.8, STACK_Z]}>
          <cylinderGeometry args={[0.006, 0.006, 1.4, 6]} />
          <meshStandardMaterial color={COLORS.cable} metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Row station: a low seat on two posts, and an angled footplate */}
      <Box size={[0.32, 0.08, SEAT.to - SEAT.from]} position={[0, SEAT.top - 0.04, (SEAT.from + SEAT.to) / 2]} color={COLORS.pad} />
      {[SEAT.from + 0.1, SEAT.to - 0.1].map((z) => (
        <Box key={z} size={[0.06, SEAT.top - 0.08, 0.06]} position={[0, (SEAT.top - 0.08) / 2, z]} color={COLORS.frame} />
      ))}
      <Box size={[0.42, 0.03, 0.26]} position={[0, CABLE.row.foot.y - 0.06, CABLE.row.foot.z + 0.08]} color={COLORS.frame} rotationX={-1.0} />
      <Box size={[0.06, CABLE.row.foot.y - 0.1, 0.06]} position={[0, (CABLE.row.foot.y - 0.1) / 2, CABLE.row.foot.z + 0.13]} color={COLORS.frame} />

      {/* Cables and handles (moved every frame) */}
      <Strand strandRef={highCable} width={0.008} color={COLORS.cable} />
      <Strand strandRef={lowCable} width={0.008} color={COLORS.cable} />
      <Strand strandRef={leftRope} width={0.022} color={COLORS.rope} />
      <Strand strandRef={rightRope} width={0.022} color={COLORS.rope} />
      <group ref={handle}>
        {/* V-handle: a short grip bar, and a bracket reaching to the cable clip */}
        <mesh rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.018, 0.018, CABLE.row.gripX * 2 + 0.08, 12]} />
          <meshStandardMaterial color={COLORS.pad} roughness={0.8} />
        </mesh>
        <Box size={[0.03, 0.03, 0.08]} position={[0, 0, 0.04]} color={COLORS.metal} />
      </group>
    </group>
  )
}
