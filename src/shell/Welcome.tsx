import { useEffect, useRef } from 'react'
import { APP_NAME } from './brand'
import { installApp, useInstallChoice } from './install'
import { useWelcome } from './tabStore'
import { closeWelcome, pickAnExercise } from './tabs'

// What a stranger arriving from a link needs: what this is, how to move, how
// to start an exercise, and where their data goes
const LINES = [
  `${APP_NAME} is a 3D gym you can train in.`,
  'Walk with the joystick (or WASD on a keyboard), and drag to look around.',
  'Walk up to a machine and tap its label (or press E) to use it. Or pick an exercise from the list.',
  'Your sets are saved on this device only. Nothing is sent anywhere.',
]

export const INSTALL_FROM_MENU = `Not installed yet? Use your browser's menu: Install app, or Add to Home screen.`

// Installing: Chrome's own install sheet behind a button when it offers one;
// otherwise the browser's menu (Firefox, or Chrome before it's ready); nothing
// in the installed app itself
function InstallLine() {
  const choice = useInstallChoice()
  if (choice === 'none') return null
  if (choice === 'button')
    return (
      <button type="button" className="list-button welcome-install" onClick={installApp}>
        Install {APP_NAME}
      </button>
    )
  // (Worded for someone who may have installed it already: in a plain tab, the browser can't tell us)
  return <p className="welcome-install-note">{INSTALL_FROM_MENU}</p>
}

// The welcome card, over the gym on a first visit (and from the header's "?").
// A dim layer behind it keeps taps and drags off the gym, and the gym itself is
// made inert (see App), so Tab can't reach it either.
export function Welcome() {
  const open = useWelcome()
  // Focus starts on the title, so a screen reader reads the card from the top (the
  // next Tab is "Pick an exercise"). Without scrolling: on a phone held sideways the
  // card is taller than the space, and it must open showing its top.
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (open) title.current?.focus({ preventScroll: true })
  }, [open])
  if (!open) return null

  return (
    <div className="welcome-layer">
      <section className="welcome-card" role="dialog" aria-labelledby="welcome-title">
        <h2 id="welcome-title" ref={title} tabIndex={-1}>
          Welcome to {APP_NAME}
        </h2>
        <ul>
          {LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="welcome-actions">
          <button type="button" className="list-button is-primary" onClick={pickAnExercise}>
            Pick an exercise
          </button>
          <button type="button" className="list-button" onClick={() => closeWelcome()}>
            Look around
          </button>
        </div>
        <InstallLine />
      </section>
    </div>
  )
}
