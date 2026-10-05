import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Room } from './Room'
import { ROOM } from './dimensions'
import { Lighting } from './Lighting'
import { CameraFit } from './CameraFit'
import { Player } from '../player/Player'
import { FloorDumbbell } from '../equipment/PickableDumbbell'
import { FurnitureMenu } from '../equipment/FurnitureMenu'
import { FurnitureLayer } from '../build/Furniture'
import { BuildController } from '../build/BuildController'
import { select, useBuild } from '../build/buildStore'

export function GymScene() {
  const dragging = useBuild((s) => s.drag !== null)

  return (
    <Canvas
      shadows
      // Cap pixel ratio at 2: phones report 3+, which costs a lot of GPU for little gain
      dpr={[1, 2]}
      camera={{ fov: 50, near: 0.1, far: 200 }}
      // Tapping empty space (no furniture) clears the build-mode selection
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#111214']} />

      <Lighting />

      <Room />
      <FurnitureLayer />
      <BuildController />
      <FloorDumbbell />
      <FurnitureMenu />
      <Player />
      <CameraFit />

      <OrbitControls
        // makeDefault lets other components (CameraFit, Player) reach these controls
        makeDefault
        // Dragging furniture must not also spin the camera
        enabled={!dragging}
        target={[0, ROOM.height / 3, 0]}
        enableDamping
        minDistance={4}
        maxDistance={80}
        // Stop the camera from going under the floor
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </Canvas>
  )
}
