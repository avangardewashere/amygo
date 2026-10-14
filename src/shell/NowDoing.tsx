import { useEffect, useLayoutEffect, useRef } from 'react'
import {
  EXERCISES,
  swapSettled,
  getGym,
  paceActions,
  tapAgain,
  tapDone,
  tapFinish,
  tapMoreRest,
  tapNextSet,
  useGym,
} from '../interaction/gymStore'
import { betweenText, betweenWords, headline, progressText } from '../interaction/activityText'
import { useTicking } from '../lib/ticking'

// Which card is showing: a set (each its own), the pause after a set, or none
const cardOf = ({ activity, between }: ReturnType<typeof getGym>) =>
  activity ? `set ${activity.session}` : between ? `after ${between.kind} ${between.set}` : null

// What's going on right now, with the same words as the popup in the gym,
// plus the other paces (treadmill, bike), Done when more sets of a target follow,
// and Finish. Resting between sets: "Rest · 1:12 · set 2 of 3 next", with +30 s,
// Skip and Finish; after the last: "3 sets done", with Again and Finish.
// Shown on the Exercises list and on an exercise's history page.
export function NowDoing() {
  const activity = useGym((s) => s.activity)
  const between = useGym((s) => s.between)
  const resting = !activity && between !== null && between.until !== null
  const now = useTicking(activity !== null || resting, 500)

  // The card changes under the cursor: Done and Next set swap it, and so does a
  // set ending by itself. If the button that had the cursor went with it, the
  // cursor goes on to the new card's next step (Next set, Done or Finish), or to
  // the page's title when the card is gone. (Buttons keep their identity: the
  // cursor on Finish stays there, since Finish means the same on both cards.)
  const actions = useRef<HTMLDivElement>(null)
  const cursorOnCard = useRef(false) // as of the last redraw, or the last move of the cursor
  const page = useRef<HTMLElement | null>(null)
  const notice = (target: Node | null) => {
    cursorOnCard.current = actions.current?.contains(target) ?? false
    if (cursorOnCard.current) page.current = actions.current!.closest('.page')
  }
  useEffect(() => {
    const onFocus = (event: FocusEvent) => notice(event.target as Node)
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])
  const card = useGym(cardOf)
  const shown = useRef(card)
  useLayoutEffect(() => {
    if (card !== shown.current) {
      shown.current = card
      if (cursorOnCard.current && !actions.current?.contains(document.activeElement)) {
        const next = actions.current?.querySelector<HTMLButtonElement>('[data-next]') ?? page.current?.querySelector('h2')
        next?.focus()
      }
    }
    notice(document.activeElement) // (after every redraw: a cursor put there without a focus event counts too)
  })

  if (!activity && between) {
    return (
      <div className="now-card" role="status">
        <div>
          <strong>{EXERCISES[between.kind].name}</strong>
          <span aria-hidden="true">{betweenText(between, now)}</span>
          <span className="visually-hidden">{betweenWords(between)}</span>
        </div>
        <div className="now-actions" ref={actions}>
          {resting ? (
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
          <button key="finish" type="button" className="list-button" onClick={() => tapFinish()}>
            Finish
          </button>
        </div>
      </div>
    )
  }
  if (!activity) return null
  const moreToCome = activity.target !== undefined && (activity.set ?? 1) < activity.target.sets
  return (
    <div className="now-card" role="status">
      <div>
        <strong>{headline(activity)}</strong>
        <span>{progressText(activity, now)}</span>
      </div>
      <div className="now-actions" ref={actions}>
        {paceActions(activity).map((action) => (
          <button key={action.label} type="button" className="list-button" onClick={() => swapSettled() && action.run()}>
            {action.label}
          </button>
        ))}
        {moreToCome && (
          <button key="done" type="button" className="list-button" data-next onClick={() => tapDone()}>
            Done
          </button>
        )}
        <button
          key="finish"
          type="button"
          className="list-button is-primary"
          data-next={!moreToCome || undefined}
          onClick={() => tapFinish()}
        >
          Finish
        </button>
      </div>
    </div>
  )
}
