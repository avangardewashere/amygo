import { Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { MathUtils, Vector3, type Group, type Object3D } from 'three'
import { ROOM } from '../scene/dimensions'
import { Person, type Gait, type Hands } from './Person'
import { FitnessCharacter, MODEL_URL } from './FitnessCharacter'
import { HUMAN_URL, HumanPerson } from './HumanPerson'
import { listenToKeyboard, readMove } from './input'
import { HandDumbbell, HeldDumbbellMenu } from '../equipment/PickableDumbbell'
import { ActivityBubble } from '../interaction/ActivityBubble'
import {
  EXERCISES,
  PICKUP_RANGE,
  getGym,
  listenToInteractionKeys,
  playerPose,
  setNear,
  setNearFurniture,
  stepOffSpot,
  stepOnto,
  stopExercise,
  useGym,
  type Activity,
} from '../interaction/gymStore'
import { furnitureObstacles, getBuild } from '../build/buildStore'
import { propObstacles } from '../props/propLayout'
import { BODY_RADIUS, blocked, closestInReach } from './reach'

const WALK_SPEED = 3 // meters per second
const TURN_SPEED = 12 // how quickly the person turns to face where they walk
const STEP_EASE = 8 // how quickly the person steps onto a machine


// Walls are at ±width/2 and ±depth/2; stop the body before touching them
const LIMIT_X = ROOM.width / 2 - BODY_RADIUS
const LIMIT_Z = ROOM.depth / 2 - BODY_RADIUS

// Reused every frame instead of creating new vectors (avoids garbage collection stutter)
const forward = new Vector3()
const right = new Vector3()
const move = new Vector3()
const before = new Vector3()
const shift = new Vector3()
const UP = new Vector3(0, 1, 0)

type Controls = { target: Vector3 }

const STANDING_STILL = { x: 0, y: 0 }

// Which body the player has:
//   'human': the imported "Man" model, moved by our own person's joints
//   'fitness': the imported Fitness Character (one solid piece; limbs don't move)
//   'classic': our own capsule person, with walking and exercise animations
const LOOK = 'human' as 'human' | 'fitness' | 'classic'
const Body = { human: HumanPerson, fitness: FitnessCharacter, classic: Person }[LOOK]
// Only fetch a model file when that look is actually used
if (LOOK === 'fitness') useGLTF.preload(MODEL_URL)
if (LOOK === 'human') useGLTF.preload(HUMAN_URL)

// Turn smoothly toward an angle, the short way round
function turnToward(object: Object3D, yaw: number, delta: number) {
  let diff = yaw - object.rotation.y
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  object.rotation.y += diff * Math.min(1, TURN_SPEED * delta)
}

// Which dumbbells are in which hand right now
function handsFor(holding: boolean, activity: Activity | null): Hands {
  if (holding) return { right: <HandDumbbell grip="forward" /> }
  const grip = activity && EXERCISES[activity.kind].weights
  if (!grip) return {}
  const weight = <HandDumbbell grip={grip} scale={0.85} />
  return { left: weight, right: weight }
}

// Owns where the person is and how they move. <Person> only handles looks.
export function Player() {
  const root = useRef<Group>(null)
  const gait = useRef<Gait>({ amount: 0 })
  const lastActivity = useRef<Activity | null>(null)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as Controls | null

  const holding = useGym((s) => s.holding)
  const activity = useGym((s) => s.activity)

  useEffect(() => listenToKeyboard(), [])
  useEffect(() => listenToInteractionKeys(), [])

  useFrame((_, rawDelta) => {
    const player = root.current!
    // If the tab was in the background, delta can be huge; cap it so we don't teleport
    const delta = Math.min(rawDelta, 0.1)
    before.copy(player.position)
    // In build mode the game is paused: the person stands still
    const stick = getBuild().mode === 'build' ? STANDING_STILL : readMove()

    // "Forward" means away from the camera, flattened onto the floor.
    // That way pushing up always walks into the screen, whatever the camera angle.
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, UP)

    move.set(0, 0, 0).addScaledVector(forward, stick.y).addScaledVector(right, stick.x)
    const strength = move.length() // 0…1, a half-pushed joystick walks slower

    // Walking away ends the exercise, like the Sims: any move cancels the action
    if (strength > 0.1 && getGym().activity) stopExercise()
    const current = getGym().activity

    // Just finished using a machine you stood on: step back off to where you were
    const previous = lastActivity.current
    const stepOff = previous !== current ? stepOffSpot(previous, current) : null
    if (stepOff) player.position.set(stepOff.x, stepOff.y, stepOff.z)
    lastActivity.current = current

    if (current?.stand) {
      // On a machine: ease onto the spot and face the way it faces
      const { x, y, z } = current.stand
      player.position.x = MathUtils.damp(player.position.x, x, STEP_EASE, delta)
      player.position.y = MathUtils.damp(player.position.y, y, STEP_EASE, delta)
      player.position.z = MathUtils.damp(player.position.z, z, STEP_EASE, delta)
      turnToward(player, current.faceYaw, delta)
      stepOnto(player.position) // once on the spot, the exercise begins
      // Legs only walk on machines that move under you (the treadmill); seated ones keep still
      const pace = EXERCISES[current.kind].stride ?? 0
      gait.current.amount = MathUtils.damp(gait.current.amount, pace, 4, delta)
    } else {
      if (strength > 0.01) {
        const nextX = MathUtils.clamp(player.position.x + move.x * WALK_SPEED * delta, -LIMIT_X, LIMIT_X)
        const nextZ = MathUtils.clamp(player.position.z + move.z * WALK_SPEED * delta, -LIMIT_Z, LIMIT_Z)
        // Furniture is solid. Try each axis on its own, so walking diagonally into
        // a rack slides you along its side instead of stopping dead. If you are
        // already inside one (it was placed on top of you), you can walk out.
        // Machines and floor props are both solid (props are never something to use, though)
        const furniture = [...furnitureObstacles(), ...propObstacles()]
        const stuck = blocked(player.position.x, player.position.z, furniture)
        if (stuck || !blocked(nextX, player.position.z, furniture)) player.position.x = nextX
        if (stuck || !blocked(player.position.x, nextZ, furniture)) player.position.z = nextZ

        turnToward(player, Math.atan2(move.x, move.z), delta)
      }
      // Exercising at a rack: turn to face away from it
      if (current) turnToward(player, current.faceYaw, delta)
      // Ease the walk animation in and out instead of snapping
      gait.current.amount = MathUtils.damp(gait.current.amount, strength, 10, delta)
    }

    // Share where we are, and check what's within reach
    playerPose.x = player.position.x
    playerPose.z = player.position.z
    playerPose.yaw = player.rotation.y
    const { holding: carrying, dumbbell } = getGym()
    setNear(
      !carrying &&
        !current &&
        Math.hypot(dumbbell.x - player.position.x, dumbbell.z - player.position.z) < PICKUP_RANGE,
    )
    setNearFurniture(closestInReach(player.position.x, player.position.z, furnitureObstacles()))

    // Camera follows: shift the camera and its orbit point by however far we moved
    // (sideways only, so stepping onto a machine doesn't bob the camera)
    shift.set(player.position.x - before.x, 0, player.position.z - before.z)
    if (controls && shift.lengthSq() > 0) {
      camera.position.add(shift)
      controls.target.add(shift)
    }
  })

  return (
    <group ref={root}>
      {/* While the model file loads, show our own person so there's never a gap */}
      <Suspense fallback={<Person gait={gait} hands={handsFor(holding, activity)} activity={activity} />}>
        <Body gait={gait} hands={handsFor(holding, activity)} activity={activity} />
      </Suspense>
      {holding && <HeldDumbbellMenu />}
      {activity && (
        <Html position={[0, 2.05, 0]} zIndexRange={[20, 0]}>
          <div className="item-anchor">
            <ActivityBubble activity={activity} />
          </div>
        </Html>
      )}
    </group>
  )
}
