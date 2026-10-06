import { Suspense, lazy } from 'react'
import { Joystick } from './player/Joystick'
import { BuildBar } from './build/BuildBar'
import { useBuild } from './build/buildStore'
import { PerfReadout } from './scene/PerfReadout'
import { perfEnabled } from './scene/quality'
import { Header } from './shell/Header'
import { TabBar } from './shell/TabBar'
import { ExercisesPage } from './shell/ExercisesPage'
import { useTab } from './shell/tabStore'

// Add ?perf to the address to see the speed readout
const SHOW_PERF = perfEnabled(window.location.search)

// The 3D gym (and three.js with it) is a separate download, asked for after
// the header, tabs and list have shown: they don't need it
const GymScene = lazy(() => import('./scene/GymScene').then((module) => ({ default: module.GymScene })))

export const LOADING_TEXT = 'Loading the gym…'

// The app: a header, the page in the middle, and the tab bar at the bottom.
// The gym (Home) is always there underneath; other pages cover it.
export default function App() {
  const home = useTab() === 'home'
  const building = useBuild((s) => s.mode === 'build')

  return (
    <main className="app">
      <Header />
      <div className="stage">
        <Suspense fallback={<p className="gym-loading">{LOADING_TEXT}</p>}>
          <GymScene />
        </Suspense>
        {home && !building && <Joystick />}
        {home && <BuildBar />}
        {!home && <ExercisesPage />}
        {SHOW_PERF && <PerfReadout />}
      </div>
      <TabBar />
    </main>
  )
}
