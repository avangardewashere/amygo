import { useEffect, useState } from 'react'
import { useGym } from '../interaction/gymStore'
import { headline, progressText } from '../interaction/activityText'
import { useBuild } from '../build/buildStore'
import { ROOM } from '../scene/dimensions'
import { APP_NAME } from './brand'
import { useTab } from './tabStore'
import { WELCOME_BUTTON_ID, openWelcome } from './tabs'

// While exercising: "Doing bicep curls · 12 reps done", kept up to date
function Doing() {
  const activity = useGym((s) => s.activity)
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!activity) return
    const timer = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(timer)
  }, [activity])
  if (!activity) return null
  return (
    <p className="shell-doing">
      {headline(activity)} · {progressText(activity, now)}
    </p>
  )
}

// The bar across the top: the app's name, what the person is doing, and (on
// Home) how to play, with a "?" that brings back the welcome card
export function Header() {
  const home = useTab() === 'home'
  const building = useBuild((s) => s.mode === 'build')
  return (
    <header className="shell-header">
      <div className="shell-title">
        <h1>{APP_NAME}</h1>
        {home && !building && (
          <button
            type="button"
            id={WELCOME_BUTTON_ID}
            className="help-button"
            aria-label={`About ${APP_NAME}: how it works`}
            onClick={openWelcome}
          >
            ?
          </button>
        )}
      </div>
      <Doing />
      {home &&
        (building ? (
          <>
            <p className="hint hint-desktop">Build mode · drag furniture · R to rotate · B when done</p>
            <p className="hint hint-touch">Build mode · drag furniture to move it</p>
          </>
        ) : (
          <>
            <p className="hint hint-desktop">
              {ROOM.width} × {ROOM.depth} m · WASD or arrows to walk · E to use items · B to build · drag to rotate
            </p>
            <p className="hint hint-touch">Joystick to walk · tap a label to use it · drag to rotate · pinch to zoom</p>
          </>
        ))}
    </header>
  )
}
