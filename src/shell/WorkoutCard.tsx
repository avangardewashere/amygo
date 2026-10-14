import { useEffect, useLayoutEffect, useRef } from 'react'
import { cardKey, cardWords } from '../interaction/activityText'
import {
  paceActions,
  swapSettled,
  tapAgain,
  tapDone,
  tapFinish,
  tapMoreRest,
  tapNextSet,
  useGym,
} from '../interaction/gymStore'
import { kgFor } from '../exercises/weights'
import { useTicking } from '../lib/ticking'
import { followCardHeight } from './cardHeight'
import { openTab, showInList } from './tabs'

// What the workout card and the strip show, read from the gym (and the clock,
// ticking while something counts)
function useWorkout() {
  const activity = useGym((s) => s.activity)
  const between = useGym((s) => s.between)
  const resting = !activity && between !== null && between.until !== null
  const now = useTicking(activity !== null || resting, 500)
  // Resting, the weight shown is the one the next set will use: the picker's
  const nextKg = resting ? kgFor(between.kind) : undefined
  return { activity, between, resting, words: cardWords({ activity, between }, now, nextKg) }
}

// What's going on, for a screen reader: the calm words (nothing that ticks), in a
// status line that is always there, so that the first words are a change too
function SaidAloud({ words }: { words: string | undefined }) {
  return (
    <p className="visually-hidden" role="status">
      {words ?? ''}
    </p>
  )
}

// The workout card (v10 Block 3), across the bottom of the gym on a phone, under
// your thumb: "Bicep curls · set 2 of 3", "7 / 12 reps", "10 kg", with Done (or
// +30 s and Skip while resting, Again after the last set), Change and Finish.
// It takes the place of the popup over the person, which stays on a desktop.
// One row of buttons and lines that don't wrap, so its height stays the same
// from set to rest (the joystick above it doesn't move under the thumb).
export function WorkoutCard() {
  const { activity, between, resting, words } = useWorkout()

  // The joystick moves up by the card's height while it's shown
  const card = useRef<HTMLDivElement>(null)
  const shown = words !== null
  useLayoutEffect(() => (card.current ? followCardHeight(card.current) : undefined), [shown])

  // The card changes under the cursor: Done and Skip swap it, and so does a set
  // or a rest ending by itself. If the button that had the cursor went with it,
  // the cursor goes on to the new card's next step (Skip, Done or Again), or to
  // the tab bar's Gym tab when the card is gone. (Buttons keep their identity:
  // the cursor on Change or Finish stays there, as they mean the same on every
  // card; a pace button keeps its place when its pace changes.)
  const actions = useRef<HTMLDivElement>(null)
  const cursorOnCard = useRef(false) // as of the last redraw, or the last move of the cursor
  const notice = (target: Node | null) => {
    cursorOnCard.current = actions.current?.contains(target) ?? false
  }
  useEffect(() => {
    const onFocus = (event: FocusEvent) => notice(event.target as Node)
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])
  const which = useGym(cardKey)
  const before = useRef(which)
  useLayoutEffect(() => {
    if (which !== before.current) {
      before.current = which
      if (cursorOnCard.current && !actions.current?.contains(document.activeElement)) {
        const next =
          actions.current?.querySelector<HTMLButtonElement>('[data-next]') ??
          document.querySelector<HTMLButtonElement>('.tabbar-tab[aria-current="page"]')
        next?.focus()
      }
    }
    notice(document.activeElement) // (after every redraw: a cursor put there without a focus event counts too)
  })

  const kind = activity?.kind ?? between?.kind
  return (
    <>
      <SaidAloud words={words?.words} />
      {words && kind && (
        <div className="workout-card" ref={card}>
          {/* For the eyes (the words above say it all, without the ticking) */}
          <div className="workout-card-top" aria-hidden="true">
            <strong>{words.what}</strong>
            {words.extra && <span>{words.extra}</span>}
          </div>
          <p className="workout-count" aria-hidden="true">
            {words.count}
          </p>
          <div className="workout-actions" ref={actions}>
            {activity ? (
              <>
                {paceActions(activity).map((action, i) => (
                  <button key={`pace ${i}`} type="button" className="list-button" onClick={() => swapSettled() && action.run()}>
                    {action.label}
                  </button>
                ))}
                <button key="done" type="button" className="list-button is-primary" data-next onClick={() => tapDone()}>
                  Done
                </button>
              </>
            ) : resting ? (
              <>
                <button key="more" type="button" className="list-button" onClick={() => tapMoreRest()}>
                  +30 s
                </button>
                <button key="skip" type="button" className="list-button is-primary" data-next onClick={() => tapNextSet()}>
                  Skip
                </button>
              </>
            ) : (
              <button key="again" type="button" className="list-button is-primary" data-next onClick={() => tapAgain()}>
                Again
              </button>
            )}
            <button key="change" type="button" className="list-button" onClick={() => swapSettled() && showInList(kind)}>
              Change
            </button>
            <button key="finish" type="button" className="list-button" onClick={() => tapFinish()}>
              Finish
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// The same in one line, above the tab bar on the other tabs: "Bicep curls · set
// 2 of 3 · 7 / 12 reps". The name gives way, never the count. Tapping it opens
// the gym, with the cursor on the card's next step (or the Gym tab).
export function WorkoutStrip() {
  const { words } = useWorkout()
  return (
    <>
      <SaidAloud words={words?.words} />
      {words && (
        <button type="button" className="workout-strip" onClick={openGym}>
          <span className="strip-what" aria-hidden="true">
            {words.what}
          </span>
          <span className="strip-count" aria-hidden="true">
            · {words.count}
          </span>
          <span className="visually-hidden">{words.words}. Open the gym</span>
        </button>
      )}
    </>
  )
}

function openGym() {
  openTab('home')
  // (once the gym's card has been drawn)
  setTimeout(() => {
    const next =
      document.querySelector<HTMLElement>('.workout-card [data-next]') ??
      document.querySelector<HTMLElement>('.tabbar-tab[aria-current="page"]')
    next?.focus()
  }, 0)
}
