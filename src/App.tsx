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
import { useTouchScreen } from './shell/touchScreen'
import { WorkoutCard, WorkoutStrip } from './shell/WorkoutCard'
import { Welcome } from './shell/Welcome'
import { UpdateNote } from './shell/UpdateNote'
import { gymArrived } from './offline/register'

// Add ?perf to the address to see the speed readout
const SHOW_PERF = perfEnabled(window.location.search)

// The 3D gym (and three.js with it) is a separate download, asked for after
// the header, tabs and list have shown: they don't need it. Once it has
// arrived, the offline copy can be made (from the browser's cache, not a second download).
const GymScene = lazy(() =>
  import('./scene/GymScene').then((module) => {
    gymArrived()
    return { default: module.GymScene }
  }),
)

export const LOADING_TEXT = 'Loading the gym…'

// The app: a header, the page in the middle, and the tab bar at the bottom.
// The gym (Home) is always there underneath; other pages cover it.
export default function App() {
  const tab = useTab()
  const home = tab === 'home'
  const building = useBuild((s) => s.mode === 'build')
  const welcome = useWelcome()
  const touch = useTouchScreen()

  return (
    <main className="app">
      <Header />
      <div className="stage">
        {/* The gym: out of reach (inert) while the welcome card or another tab is over it
            (its popups over the person are still drawn behind the page) */}
        <div className="gym-layer" inert={welcome || !home}>
          <Suspense fallback={<p className="gym-loading">{LOADING_TEXT}</p>}>
            <GymScene />
          </Suspense>
          {home && !building && !welcome && <Joystick />}
          {home && !welcome && <BuildBar />}
          {/* On a phone, the workout under your thumb (a mouse gets the popup over the person) */}
          {home && !welcome && touch && <WorkoutCard />}
        </div>
        {home && <Welcome />}
        {tab === 'exercises' && <ExercisesPage />}
        {tab === 'today' && <TodayPage />}
        {SHOW_PERF && <PerfReadout />}
      </div>
      {/* On the other tabs, the workout in one line: tap it for the gym */}
      {!home && <WorkoutStrip />}
      <UpdateNote />
      <TabBar />
    </main>
  )
}
