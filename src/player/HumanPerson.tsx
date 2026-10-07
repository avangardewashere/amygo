import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { Mesh } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Person, type PersonProps } from './Person'
import { poseModel, prepareModel } from './humanRig'

// "Man" by Quaternius, from Poly Pizza (CC0, public domain): a low-poly person
// with a skeleton. Our own person still does all the moving (its capsules are
// hidden); each frame the model's bones copy its joints (see humanRig.ts).
export const HUMAN_URL = `${import.meta.env.BASE_URL}models/man.glb`

export function HumanPerson(props: PersonProps) {
  const { scene } = useGLTF(HUMAN_URL, false)

  // Our own copy (a skinned model must be cloned with its skeleton), sized and
  // placed to match our body
  const model = useMemo(() => {
    const copy = clone(scene)
    copy.traverse((part) => {
      if ((part as Mesh).isMesh) part.castShadow = true
    })
    return prepareModel(copy)
  }, [scene])

  return (
    <group>
      <Person {...props} hidden onPosed={(rig) => poseModel(model, rig)} />
      <primitive object={model.scene} />
    </group>
  )
}
