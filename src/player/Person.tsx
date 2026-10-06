import { useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { paceSeconds, repProgress, type Activity } from '../interaction/gymStore'
import { arm, exercisePose, legJoints } from './poseMath'
import type { Rig } from './humanRig'
import {
  ELBOW_DROP,
  FOOT_DROP,
  HAND_DROP,
  HEAD_RADIUS,
  HEAD_Y,
  HIP_X,
  HIP_Y,
  KNEE_DROP,
  SHOE_Y,
  SHOULDER_X,
  SHOULDER_Y,
  TORSO_RADIUS,
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

// Thickness of each capsule, and how long it must be to span its joints
// (a capsule's length doesn't count its rounded ends, which add one radius each)
const LIMB = { thigh: 0.075, shin: 0.062, upperArm: 0.052, forearm: 0.046 }
const span = (drop: number, radius: number) => Math.max(drop - 2 * radius + 0.02, 0.01)
// The torso runs from just below the hips to just above the shoulders
const TORSO_BOTTOM = HIP_Y - 0.04
const TORSO_TOP = SHOULDER_Y + 0.1

// What any body for the player receives (so looks can be swapped, see <Player>)
export type PersonProps = { gait: RefObject<Gait>; hands?: Hands; activity?: Activity | null }

// Extra options for driving another look with this body's joints (see HumanPerson):
//   hidden: animate the joints but don't draw the capsules
//   onPosed: called every frame once the joints are set
type DriverProps = { hidden?: boolean; onPosed?: (rig: Rig) => void }

// A simple person (~1.8 m tall) made of capsules and spheres. Faces +z.
// Every limb is wrapped in a group placed at its joint (hip, knee, shoulder,
// elbow), so rotating the group swings the limb from the joint, not its middle.
export function Person({ gait, hands = {}, activity = null, hidden = false, onPosed }: PersonProps & DriverProps) {
  const show = !hidden
  const body = useRef<Group>(null)
  const posture = useRef<Group>(null) // leans the whole body back, pivoting at the hips
  const hips = [useRef<Group>(null), useRef<Group>(null)] // left, right
  const knees = [useRef<Group>(null), useRef<Group>(null)]
  const shoulders = [useRef<Group>(null), useRef<Group>(null)]
  const elbows = [useRef<Group>(null), useRef<Group>(null)]
  const ankles = [useRef<Group>(null), useRef<Group>(null)]
  const phase = useRef(0)
  const rise = useRef(0) // how far the whole body is lowered (squatting)

  useFrame((_, delta) => {
    const amount = gait.current.amount
    phase.current += delta * STRIDE_SPEED * amount
    const swing = Math.sin(phase.current) * SWING * amount
    // Still stepping onto a machine: stand normally until there
    const pose = activity?.arrived ? exercisePose(activity, repProgress(activity), paceSeconds(activity)) : null
    const jointSpeed = pose?.follow ? FOLLOW_EASE : JOINT_EASE
    const ease = (from: number, to: number, speed = jointSpeed) => MathUtils.damp(from, to, speed, delta)

    // Small bounce: the body rises twice per stride. Plus lowering the whole
    // body (squatting down).
    rise.current = ease(rise.current, pose?.rise ?? 0)
    body.current!.position.y = Math.abs(Math.sin(phase.current)) * 0.04 * amount + rise.current
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
      const planted = pose?.foot ? legJoints(pose.foot(side), lean.rotation.x, side) : null
      const legSwing = side * swing // legs opposite to each other
      const hipTarget = planted ? planted.hipX : legSwing
      // Walking: the knee bends while that leg is behind you, like a real stride
      const kneeTarget = planted ? planted.knee : Math.max(legSwing, 0) * WALK_KNEE
      const hip = hips[i].current!
      const knee = knees[i].current!
      hip.rotation.x = ease(hip.rotation.x, hipTarget)
      // Swinging the leg out to the side (straddling a bench); 0 otherwise
      hip.rotation.y = ease(hip.rotation.y, planted?.hipY ?? 0)
      hip.rotation.z = ease(hip.rotation.z, planted?.hipZ ?? 0)
      knee.rotation.x = ease(knee.rotation.x, kneeTarget)
      // Flat feet: tip the shoe back by everything above it, so it stays level
      const ankle = ankles[i].current!
      const level = -(lean.rotation.x + hip.rotation.x + knee.rotation.x)
      ankle.rotation.x = ease(ankle.rotation.x, pose?.flatFeet ? level : 0)
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

    // Hand the finished joints to whoever is following them (the human model)
    onPosed?.({
      posture: posture.current!,
      hips: hips.map((ref) => ref.current!),
      knees: knees.map((ref) => ref.current!),
      ankles: ankles.map((ref) => ref.current!),
      shoulders: shoulders.map((ref) => ref.current!),
      elbows: elbows.map((ref) => ref.current!),
    })
  })

  return (
    <group ref={body}>
      {/* Posture: pivots at hip height. Everything inside leans with it. */}
      <group ref={posture} position-y={HIP_Y}>
        <group position-y={-HIP_Y}>
          {/* Legs: hip joint → thigh → knee joint → shin → ankle → shoe */}
          {[
            { x: HIP_X, i: 0 },
            { x: -HIP_X, i: 1 },
          ].map(({ x, i }) => (
            <group key={x} ref={hips[i]} position={[x, HIP_Y, 0]}>
              <mesh visible={show} position-y={-KNEE_DROP / 2} castShadow>
                <capsuleGeometry args={[LIMB.thigh, span(KNEE_DROP, LIMB.thigh), 4, 12]} />
                <meshStandardMaterial color={COLORS.skin} />
              </mesh>
              <group ref={knees[i]} position-y={-KNEE_DROP}>
                <mesh visible={show} position-y={-FOOT_DROP / 2} castShadow>
                  <capsuleGeometry args={[LIMB.shin, span(FOOT_DROP, LIMB.shin), 4, 12]} />
                  <meshStandardMaterial color={COLORS.skin} />
                </mesh>
                <group ref={ankles[i]} position-y={-FOOT_DROP}>
                  {/* The foot point is the heel, just above the sole: the shoe sits on the floor below it */}
                  <mesh visible={show} position={[0, 0.04 - SHOE_Y, 0.05]} castShadow>
                    <boxGeometry args={[0.1, 0.08, 0.24]} />
                    <meshStandardMaterial color={COLORS.shoes} />
                  </mesh>
                </group>
              </group>
            </group>
          ))}

          {/* Shorts */}
          <mesh visible={show} position-y={HIP_Y - 0.03} castShadow>
            <cylinderGeometry args={[TORSO_RADIUS + 0.04, TORSO_RADIUS + 0.07, 0.24, 16]} />
            <meshStandardMaterial color={COLORS.shorts} />
          </mesh>

          {/* Torso */}
          <mesh visible={show} position-y={(TORSO_BOTTOM + TORSO_TOP) / 2} castShadow>
            <capsuleGeometry args={[TORSO_RADIUS, TORSO_TOP - TORSO_BOTTOM - 2 * TORSO_RADIUS, 4, 16]} />
            <meshStandardMaterial color={COLORS.shirt} />
          </mesh>

          {/* Arms: shoulder joint → upper arm → elbow joint → forearm → hand */}
          {[
            { x: SHOULDER_X, i: 0, held: hands.left },
            { x: -SHOULDER_X, i: 1, held: hands.right },
          ].map(({ x, i, held }) => (
            <group key={x} ref={shoulders[i]} position={[x, SHOULDER_Y, 0]}>
              <mesh visible={show} position-y={-ELBOW_DROP / 2} castShadow>
                <capsuleGeometry args={[LIMB.upperArm, span(ELBOW_DROP, LIMB.upperArm), 4, 12]} />
                <meshStandardMaterial color={COLORS.skin} />
              </mesh>
              <group ref={elbows[i]} position-y={-ELBOW_DROP}>
                <mesh visible={show} position-y={-HAND_DROP / 2} castShadow>
                  <capsuleGeometry args={[LIMB.forearm, span(HAND_DROP, LIMB.forearm), 4, 12]} />
                  <meshStandardMaterial color={COLORS.skin} />
                </mesh>
                {/* Hand: anything held is placed here and follows every joint above it */}
                <group position-y={-HAND_DROP}>{held}</group>
              </group>
            </group>
          ))}

          {/* Head, with eyes so you can tell which way the person is facing */}
          <group position-y={HEAD_Y}>
            <mesh visible={show} castShadow>
              <sphereGeometry args={[HEAD_RADIUS, 24, 16]} />
              <meshStandardMaterial color={COLORS.skin} />
            </mesh>
            {[0.045, -0.045].map((x) => (
              <mesh visible={show} key={x} position={[x, 0.02, 0.12]}>
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
