import { GymScene } from './scene/GymScene'
import { ROOM } from './scene/dimensions'
import { Joystick } from './player/Joystick'
import { BuildBar } from './build/BuildBar'
import { useBuild } from './build/buildStore'
import { PerfReadout } from './scene/QualityControl'
import { perfEnabled } from './scene/quality'

// Add ?perf to the address to see the speed readout
const SHOW_PERF = perfEnabled(window.location.search)

export default function App() {
  const building = useBuild((s) => s.mode === 'build')

  return (
    <main className="app">
      <GymScene />
      <header className="hud">
        <h1>Gym 3D</h1>
        <p>
          {ROOM.width} × {ROOM.depth} m
        </p>
        {building ? (
          <>
            <p className="hint hint-desktop">Build mode · drag furniture · R to rotate · B when done</p>
            <p className="hint hint-touch">Build mode · drag furniture to move it</p>
          </>
        ) : (
          <>
            <p className="hint hint-desktop">WASD or arrows to walk · E to use items · B to build · drag to rotate</p>
            <p className="hint hint-touch">Joystick to walk · tap items to use · drag to rotate · pinch to zoom</p>
          </>
        )}
      </header>
      {!building && <Joystick />}
      <BuildBar />
      {SHOW_PERF && <PerfReadout />}
    </main>
  )
}
