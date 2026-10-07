import { Suspense, lazy } from 'react'
import { Joystick } from './player/Joystick'
import { BuildBar } from './build/BuildBar'
import { useBuild } from './build/buildStore'
import { PerfReadout } from './scene/PerfReadout'
import { perfEnabled } from './scene/quality'
import { Header } from './shell/Header'
import { TabBar } from './shell/TabBar'
import { ExercisesPage } from './shell/ExercisesPage'
import { TodayPage } from './shell/TodayPage'
import { useTab, useWelcome } from './shell/tabStore'
import { Welcome } from './shell/Welcome'

// Add ?perf to the address to see the speed readout
const SHOW_PERF = perfEnabled(window.location.search)

// The 3D gym (and three.js with it) is a separate download, asked for after
// the header, tabs and list have shown: they don't need it
const GymScene = lazy(() => import('./scene/GymScene').then((module) => ({ default: module.GymScene })))

export const LOADING_TEXT = 'Loading the gym…'

// The app: a header, the page in the middle, and the tab bar at the bottom.
// The gym (Home) is always there underneath; other pages cover it.
export default function App() {
  const tab = useTab()
  const home = tab === 'home'
  const building = useBuild((s) => s.mode === 'build')
  const welcome = useWelcome()

  return (
    <main className="app">
      <Header />
      <div className="stage">
        {/* The gym: out of reach (inert) while the welcome card is over it */}
        <div className="gym-layer" inert={welcome}>
          <Suspense fallback={<p className="gym-loading">{LOADING_TEXT}</p>}>
            <GymScene />
          </Suspense>
          {home && !building && !welcome && <Joystick />}
          {home && !welcome && <BuildBar />}
        </div>
        {home && <Welcome />}
        {tab === 'exercises' && <ExercisesPage />}
        {tab === 'today' && <TodayPage />}
        {SHOW_PERF && <PerfReadout />}
      </div>
      <TabBar />
    </main>
  )
}
