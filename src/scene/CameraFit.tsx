import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { PerspectiveCamera, Vector3 } from 'three'
import { TARGET, startPosition } from './cameraStart'

// Sets the starting camera so the whole room fits the screen.
// Runs on first load and whenever the screen size changes (e.g. a phone is rotated).
export function CameraFit() {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const { width, height } = useThree((state) => state.size)
  const controls = useThree((state) => state.controls) as unknown as { target: Vector3 } | null

  useEffect(() => {
    camera.position.copy(startPosition(width / height, camera.fov))
    camera.lookAt(TARGET)
    controls?.target.copy(TARGET) // the orbit pivot must match where the camera looks
  }, [camera, controls, width, height])

  return null
}
