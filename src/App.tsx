import { GymScene } from './scene/GymScene'
import { Joystick } from './player/Joystick'
import { BuildBar } from './build/BuildBar'
import { useBuild } from './build/buildStore'
import { PerfReadout } from './scene/QualityControl'
import { perfEnabled } from './scene/quality'
import { Header } from './shell/Header'
import { TabBar } from './shell/TabBar'
import { ExercisesPage } from './shell/ExercisesPage'
import { useTab } from './shell/tabStore'

// Add ?perf to the address to see the speed readout
const SHOW_PERF = perfEnabled(window.location.search)

// The app: a header, the page in the middle, and the tab bar at the bottom.
// The gym (Home) is always there underneath; other pages cover it.
export default function App() {
  const home = useTab() === 'home'
  const building = useBuild((s) => s.mode === 'build')

  return (
    <main className="app">
      <Header />
      <div className="stage">
        <GymScene />
        {home && !building && <Joystick />}
        {home && <BuildBar />}
        {!home && <ExercisesPage />}
        {SHOW_PERF && <PerfReadout />}
      </div>
      <TabBar />
    </main>
  )
}
