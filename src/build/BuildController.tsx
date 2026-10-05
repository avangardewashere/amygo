import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { Raycaster, Vector2, Vector3 } from 'three'
import { ROOM } from '../scene/dimensions'
import { FLOOR } from './Furniture'
import { GRID, dragTo, endDrag, useBuild } from './buildStore'
import { listenToBuildKeys } from './actions'

// Lives inside the 3D canvas. Handles dragging furniture and shows the
// placement grid while in build mode.
export function BuildController() {
  const building = useBuild((s) => s.mode === 'build')
  const dragging = useBuild((s) => s.drag !== null)
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)

  useEffect(() => listenToBuildKeys(), [])

  // While dragging: follow the pointer anywhere on screen (window-wide, so it
  // keeps working if the finger slides off the piece). The camera is frozen
  // meanwhile by <GymScene>, which turns the orbit controls off while dragging.
  useEffect(() => {
    if (!dragging) return
    document.body.style.cursor = 'grabbing'

    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const hit = new Vector3()

    const onMove = (e: PointerEvent) => {
      // Screen pixels → -1…1 coordinates → a ray from the camera → where it hits the floor
      const rect = canvas.getBoundingClientRect()
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(FLOOR, hit)) dragTo(hit.x, hit.z)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      document.body.style.cursor = ''
    }
  }, [dragging, camera, canvas])

  if (!building) return null

  return (
    <Grid
      position-y={0.003}
      args={[ROOM.width, ROOM.depth]}
      cellSize={GRID}
      cellThickness={0.6}
      cellColor="#4a4d55"
      sectionSize={1}
      sectionThickness={1.2}
      sectionColor="#6b6f78"
      fadeDistance={60}
    />
  )
}
