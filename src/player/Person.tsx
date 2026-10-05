import { useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { repProgress, secondsSince, type Activity } from '../interaction/gymStore'
import { arm, exercisePose, legAngles } from './poseMath'
import {
  ELBOW_DROP,
  FOOT_DROP,
  HAND_DROP,
  HIP_X,
  HIP_Y,
  KNEE_DROP,
  SHOULDER_X,
  SHOULDER_Y,
} from './proportions'

// How much the person is walking right now, written by <Player> every frame.
// amount: 0 = standing still, 1 = full walk. Anything that reads this can
// animate itself — so a downloaded 3D model could replace this file later.
export type Gait = { amount: number }

// What's in each hand (or nothing)
export type Hands = { left?: ReactNode; right?: ReactNode }

const COLORS = {
  skin: '#e0b48f',
  shirt: '#3b82c4',
  shorts: '#22252a',
  shoes: '#f2f0eb',
  eyes: '#1a1a1a',
}

const STRIDE_SPEED = 9 // leg swings per second (radians), at full walk
const SWING = 0.6 // how far legs/arms swing, in radians (~35°)
const WALK_KNEE = 0.9 // how much the back leg's knee bends mid-stride
const LOADED_ARM_SWING = 0.35 // an arm carrying weight swings much less
const RELAXED_ELBOW = -0.1 // arms hang with a tiny bend, not locked straight
const RUNNING_ELBOW = -1.5 // runners pump their arms bent at about 90°
const JOINT_EASE = 14 // how fast joints move toward their target angle
// Following a moving machine part (pedals at 72 rpm move ~1.3 m/s): easing at
// JOINT_EASE would let hands and feet trail ~7 cm behind, so track closely
const FOLLOW_EASE = 60
const POSTURE_EASE = 8 // how fast the body leans back into a seat or lies down

// What any body for the player receives (so looks can be swapped, see <Player>)
export type PersonProps = { gait: RefObject<Gait>; hands?: Hands; activity?: Activity | null }

// A simple person (~1.8 m tall) made of capsules and spheres. Faces +z.
// Every limb is wrapped in a group placed at its joint (hip, knee, shoulder,
// elbow), so rotating the group swings the limb from the joint, not its middle.
export function Person({ gait, hands = {}, activity = null }: PersonProps) {
  const body = useRef<Group>(null)
  const posture = useRef<Group>(null) // leans the whole body back, pivoting at the hips
  const hips = [useRef<Group>(null), useRef<Group>(null)] // left, right
  const knees = [useRef<Group>(null), useRef<Group>(null)]
  const shoulders = [useRef<Group>(null), useRef<Group>(null)]
  const elbows = [useRef<Group>(null), useRef<Group>(null)]
  const phase = useRef(0)

  useFrame((_, delta) => {
    const amount = gait.current.amount
    phase.current += delta * STRIDE_SPEED * amount
    const swing = Math.sin(phase.current) * SWING * amount
    const pose = activity ? exercisePose(activity, repProgress(activity), secondsSince(activity)) : null
    const jointSpeed = pose?.follow ? FOLLOW_EASE : JOINT_EASE
    const ease = (from: number, to: number, speed = jointSpeed) => MathUtils.damp(from, to, speed, delta)

    // Small bounce: the body rises twice per stride
    body.current!.position.y = Math.abs(Math.sin(phase.current)) * 0.04 * amount
    // Slide with a moving seat (the rower), or stay put
    body.current!.position.z = ease(body.current!.position.z, pose?.shift ?? 0)

    // Lean back (seat, bench) or stand upright
    const lean = posture.current!
    // (On a machine whose lean changes every rep, like the rower, the torso must
    // keep up too, or the arms reach from where it should be and miss the handle)
    lean.rotation.x = ease(lean.rotation.x, pose?.lean ?? 0, pose?.follow ? FOLLOW_EASE : POSTURE_EASE)

    // ---- Legs ----
    // Feet planted somewhere (sled, floor while seated or lying): bend hips and
    // knees to reach (see poseMath.ts). Otherwise: walking legs.
    ;[1, -1].forEach((side, i) => {
      const planted = pose?.foot ? legAngles(pose.foot(side), lean.rotation.x) : null
      const legSwing = side * swing // legs opposite to each other
      const hipTarget = planted ? planted.hip : legSwing
      // Walking: the knee bends while that leg is behind you, like a real stride
      const kneeTarget = planted ? planted.knee : Math.max(legSwing, 0) * WALK_KNEE
      const hip = hips[i].current!
      const knee = knees[i].current!
      hip.rotation.x = ease(hip.rotation.x, hipTarget)
      knee.rotation.x = ease(knee.rotation.x, kneeTarget)
    })

    // ---- Arms ----
    const elbowBend = activity?.kind === 'run' ? RUNNING_ELBOW : RELAXED_ELBOW
    ;[1, -1].forEach((side, i) => {
      const loaded = side === 1 ? hands.left : hands.right
      const walkSwing = -side * swing * (loaded ? LOADED_ARM_SWING : 1)
      const target = pose ? pose.arms(side) : arm({ shoulderX: walkSwing, elbowX: elbowBend })

      // Ease each joint toward its target, so poses blend instead of snapping
      const shoulder = shoulders[i].current!
      const elbow = elbows[i].current!
      shoulder.rotation.x = ease(shoulder.rotation.x, target.shoulderX)
      shoulder.rotation.y = ease(shoulder.rotation.y, target.shoulderY)
      shoulder.rotation.z = ease(shoulder.rotation.z, target.shoulderZ)
      elbow.rotation.x = ease(elbow.rotation.x, target.elbowX)
      elbow.rotation.z = ease(elbow.rotation.z, target.elbowZ)
    })
  })

  return (
    <group ref={body}>
      {/* Posture: pivots at hip height. Everything inside leans with it. */}
      <group ref={posture} position-y={HIP_Y}>
        <group position-y={-HIP_Y}>
          {/* Legs: hip joint → thigh → knee joint → shin → shoe */}
          {[
            { x: HIP_X, i: 0 },
            { x: -HIP_X, i: 1 },
          ].map(({ x, i }) => (
            <group key={x} ref={hips[i]} position={[x, HIP_Y, 0]}>
              <mesh position-y={-KNEE_DROP / 2} castShadow>
                <capsuleGeometry args={[0.085, 0.27, 4, 12]} />
                <meshStandardMaterial color={COLORS.skin} />
              </mesh>
              <group ref={knees[i]} position-y={-KNEE_DROP}>
                <mesh position-y={-FOOT_DROP / 2 + 0.02} castShadow>
                  <capsuleGeometry args={[0.07, 0.3, 4, 12]} />
                  <meshStandardMaterial color={COLORS.skin} />
                </mesh>
                <mesh position={[0, -FOOT_DROP, 0.05]} castShadow>
                  <boxGeometry args={[0.12, 0.08, 0.26]} />
                  <meshStandardMaterial color={COLORS.shoes} />
                </mesh>
              </group>
            </group>
          ))}

          {/* Shorts */}
          <mesh position-y={HIP_Y - 0.05} castShadow>
            <cylinderGeometry args={[0.2, 0.22, 0.3, 16]} />
            <meshStandardMaterial color={COLORS.shorts} />
          </mesh>

          {/* Torso */}
          <mesh position-y={1.22} castShadow>
            <capsuleGeometry args={[0.2, 0.36, 4, 16]} />
            <meshStandardMaterial color={COLORS.shirt} />
          </mesh>

          {/* Arms: shoulder joint → upper arm → elbow joint → forearm → hand */}
          {[
            { x: SHOULDER_X, i: 0, held: hands.left },
            { x: -SHOULDER_X, i: 1, held: hands.right },
          ].map(({ x, i, held }) => (
            <group key={x} ref={shoulders[i]} position={[x, SHOULDER_Y, 0]}>
              <mesh position-y={-ELBOW_DROP / 2} castShadow>
                <capsuleGeometry args={[0.06, 0.2, 4, 12]} />
                <meshStandardMaterial color={COLORS.skin} />
              </mesh>
              <group ref={elbows[i]} position-y={-ELBOW_DROP}>
                <mesh position-y={-HAND_DROP / 2} castShadow>
                  <capsuleGeometry args={[0.055, 0.19, 4, 12]} />
                  <meshStandardMaterial color={COLORS.skin} />
                </mesh>
                {/* Hand: anything held is placed here and follows every joint above it */}
                <group position-y={-HAND_DROP}>{held}</group>
              </group>
            </group>
          ))}

          {/* Head, with eyes so you can tell which way the person is facing */}
          <group position-y={1.68}>
            <mesh castShadow>
              <sphereGeometry args={[0.13, 24, 16]} />
              <meshStandardMaterial color={COLORS.skin} />
            </mesh>
            {[0.045, -0.045].map((x) => (
              <mesh key={x} position={[x, 0.02, 0.12]}>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshStandardMaterial color={COLORS.eyes} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}
