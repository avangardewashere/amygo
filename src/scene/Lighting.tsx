import { useEffect, useRef } from 'react'
import type { DirectionalLight } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { ROOM } from './dimensions'
import { QUALITY_LEVELS, perfStore } from './quality'

// Area lights need some lookup tables loaded once before the first render
RectAreaLightUniformsLib.init()

// Long LED panels on the ceiling, in two rows of three
const PANEL = { length: 2.4, width: 0.3 } // meters
const PANEL_X = [-6, 0, 6]
const PANEL_Z = [-3, 3]
const PANEL_COLOR = '#fff6e8' // slightly warm white, like real gym LEDs
// Area-light brightness is per square meter of panel, and these strips are
// thin (0.72 m²), so it takes a big number to light a 20 × 12 m room
const PANEL_BRIGHTNESS = 60
const FRAME_COLOR = '#55585e'

// The lowest point of the fixtures, just under the ceiling
const FIXTURE_Y = ROOM.height - 0.02

// One ceiling panel: the fixture you can see, plus the light it gives off.
// Every part faces down (like the ceiling itself), so in the overhead
// "dollhouse" view the fixtures hide instead of blocking the room.
function CeilingPanel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, FIXTURE_Y, z]}>
      {/* Housing: a dark frame a little bigger than the glowing strip */}
      <mesh position-y={0.01} rotation-x={Math.PI / 2}>
        <planeGeometry args={[PANEL.length + 0.12, PANEL.width + 0.12]} />
        <meshStandardMaterial color={FRAME_COLOR} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* The glowing strip. MeshBasicMaterial ignores lighting, so it always
          looks fully lit; toneMapped={false} lets it stay pure bright white. */}
      <mesh rotation-x={Math.PI / 2}>
        <planeGeometry args={[PANEL.length, PANEL.width]} />
        <meshBasicMaterial color={PANEL_COLOR} toneMapped={false} />
      </mesh>
      {/* The actual light: a glowing rectangle that shines downward.
          Area lights shine along their -z; tilting -90° turns that to face the floor. */}
      <rectAreaLight
        args={[PANEL_COLOR, PANEL_BRIGHTNESS, PANEL.length, PANEL.width]}
        rotation-x={-Math.PI / 2}
        position-y={-0.01}
      />
    </group>
  )
}

export function Lighting() {
  // Shadow detail follows the quality level (lowered on slow devices, see quality.ts)
  const shadowMap = perfStore.useSelect((s) => QUALITY_LEVELS[s.level].shadowMap)
  const sun = useRef<DirectionalLight>(null)
  useEffect(() => {
    const light = sun.current!
    if (!shadowMap || light.shadow.mapSize.x === shadowMap) return
    // A new size needs a new shadow map: drop the old one and it's rebuilt
    light.shadow.mapSize.set(shadowMap, shadowMap)
    light.shadow.map?.dispose()
    light.shadow.map = null
  }, [shadowMap])

  return (
    <>
      {/* A little light everywhere, so shadowed corners aren't pitch black */}
      <ambientLight intensity={0.15} />
      <hemisphereLight args={['#ffffff', '#3a3a3a', 0.35]} />

      {PANEL_X.flatMap((x) => PANEL_Z.map((z) => <CeilingPanel key={`${x},${z}`} x={x} z={z} />))}

      {/* Area lights can't cast shadows in three.js. This gentle light from
          almost straight above does it instead, so things still have shadows
          under them, like they would under ceiling lights. */}
      <directionalLight
        ref={sun}
        position={[2, ROOM.height + 10, 1.5]}
        intensity={0.5}
        castShadow={shadowMap > 0}
        shadow-mapSize={[QUALITY_LEVELS[0].shadowMap, QUALITY_LEVELS[0].shadowMap]}
        // The shadow only covers a box around the light; stretch it over the whole room
        shadow-camera-left={-ROOM.width / 2 - 2}
        shadow-camera-right={ROOM.width / 2 + 2}
        shadow-camera-top={ROOM.depth / 2 + 2}
        shadow-camera-bottom={-ROOM.depth / 2 - 2}
        shadow-camera-far={ROOM.height + 20}
      />
    </>
  )
}
