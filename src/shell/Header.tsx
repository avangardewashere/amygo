import { EXERCISES, useGym } from '../interaction/gymStore'
import { useTicking } from '../lib/ticking'
import { betweenText, headline, progressText } from '../interaction/activityText'
import { useBuild } from '../build/buildStore'
import { ROOM } from '../scene/dimensions'
import { APP_NAME } from './brand'
import { installApp, useInstallChoice } from './install'
import { useTab } from './tabStore'
import { WELCOME_BUTTON_ID, openWelcome } from './tabs'

// While exercising: "Doing bicep curls · 10 kg · 7 of 12 reps", kept up to date;
// resting: "Bicep curls · Rest · 1:12 · set 2 of 3 next"; after a round's last
// set: "Bicep curls · 3 sets done"
function Doing() {
  const activity = useGym((s) => s.activity)
  const between = useGym((s) => s.between)
  const resting = !activity && between !== null && between.until !== null
  const now = useTicking(activity !== null || resting, 500)
  if (!activity && between) {
    return (
      <p className="shell-doing">
        {EXERCISES[between.kind].name} · {betweenText(between, now)}
      </p>
    )
  }
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
  const installChoice = useInstallChoice()
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
        {/* Chrome offers installing only after a tap and some time on the page, usually after
            the welcome card has closed: so the offer shows here too, on every visit */}
        {installChoice === 'button' && (
          <button type="button" className="install-chip" onClick={installApp}>
            Install
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
