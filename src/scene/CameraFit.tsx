import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { ROOM } from './dimensions'

// The point the camera looks at: middle of the room, a bit above the floor
const TARGET = new Vector3(0, ROOM.height / 3, 0)

// Radius of an imaginary ball that just wraps the whole room
const ROOM_RADIUS = Math.hypot(ROOM.width / 2, ROOM.depth / 2, ROOM.height / 2)

// Landscape: look from the long side, so the room's length runs across the screen.
// Portrait: look from the short end, so the room's length runs up the screen.
const LANDSCAPE_DIRECTION = new Vector3(14, 11, 16).normalize()
const PORTRAIT_DIRECTION = new Vector3(20, 16, 7).normalize()

// How far back the camera must be for that ball to fit the screen.
// The camera's fov is vertical; a narrow (portrait) screen sees less sideways,
// so we work out the horizontal angle too and fit to whichever is tighter.
function fitDistance(camera: PerspectiveCamera, aspect: number) {
  const vHalf = MathUtils.degToRad(camera.fov / 2)
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  return ROOM_RADIUS / Math.sin(Math.min(vHalf, hHalf))
}

// Sets the starting camera so the whole room fits the screen.
// Runs on first load and whenever the screen size changes (e.g. a phone is rotated).
export function CameraFit() {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const { width, height } = useThree((state) => state.size)
  const controls = useThree((state) => state.controls) as unknown as { target: Vector3 } | null

  useEffect(() => {
    const aspect = width / height
    const direction = aspect < 1 ? PORTRAIT_DIRECTION : LANDSCAPE_DIRECTION
    camera.position.copy(TARGET).addScaledVector(direction, fitDistance(camera, aspect))
    camera.lookAt(TARGET)
    controls?.target.copy(TARGET) // the orbit pivot must match where the camera looks
  }, [camera, controls, width, height])

  return null
}
