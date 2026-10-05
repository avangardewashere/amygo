import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, MathUtils, Vector3, type Group, type Mesh } from 'three'
import { PRESS } from '../equipment/legPressGeometry'
import { isArmExercise, repProgress } from '../interaction/gymStore'
import { HIP_Y } from './proportions'
import type { PersonProps } from './Person'

// "Fitness Character" by iPoly3D, from Poly Pizza (CC0, public domain).
// It's one solid statue with no skeleton, so its arms and legs can't bend;
// we move the whole body instead (bob, sway, lean).
export const MODEL_URL = `${import.meta.env.BASE_URL}models/fitness-character.glb`
const TARGET_HEIGHT = 1.8 // meters, same as our own person
const STRIDE_SPEED = 9 // same rhythm as <Person>, so footsteps feel the same

// Where its hands are (measured from the model once it's scaled): arms held
// out at an angle, palms just inside the fingertips. Held items go here.
const HAND = { x: 0.6, y: 1.0, z: 0.07 }

export function FitnessCharacter({ gait, hands = {}, activity = null }: PersonProps) {
  const { scene } = useGLTF(MODEL_URL)
  const body = useRef<Group>(null)
  const posture = useRef<Group>(null)
  const phase = useRef(0)

  // Fit the model once: scale it to our person's height, stand its feet on the
  // floor, center it, and let it cast shadows. Models from other artists come
  // in any size and position, so we measure instead of guessing.
  const fitted = useMemo(() => {
    const model = scene.clone(true)
    model.traverse((part) => {
      if ((part as Mesh).isMesh) part.castShadow = true
    })
    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    return {
      model,
      scale: TARGET_HEIGHT / size.y,
      offset: [-center.x, -box.min.y, -center.z] as [number, number, number],
    }
  }, [scene])

  useFrame((_, delta) => {
    const amount = gait.current.amount
    phase.current += delta * STRIDE_SPEED * amount
    // Walking: bob up twice per stride and rock gently side to side
    body.current!.position.y = Math.abs(Math.sin(phase.current)) * 0.05 * amount
    body.current!.rotation.z = Math.sin(phase.current) * 0.06 * amount
    // Dumbbell exercises: the arms can't move, so the whole body works in rhythm
    // with each rep instead: a slight rock back and lift at the top
    const lift = activity && isArmExercise(activity.kind) ? repProgress(activity) : 0
    body.current!.position.y += lift * 0.03
    // Leg press: lean back into the seat (pivoting at the hips, like <Person>)
    const leanTarget = activity?.kind === 'legPress' ? -PRESS.lean : -lift * 0.08
    posture.current!.rotation.x = MathUtils.damp(posture.current!.rotation.x, leanTarget, 8, delta)
  })

  return (
    <group ref={body}>
      <group ref={posture} position-y={HIP_Y}>
        <group position-y={-HIP_Y} scale={fitted.scale}>
          <primitive object={fitted.model} position={fitted.offset} />
        </group>
        {/* Hands: anything held (dumbbells) sits here. Left hand is +x, as in <Person>. */}
        <group position={[HAND.x, HAND.y - HIP_Y, HAND.z]}>{hands.left}</group>
        <group position={[-HAND.x, HAND.y - HIP_Y, HAND.z]}>{hands.right}</group>
      </group>
    </group>
  )
}

