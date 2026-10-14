import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EXERCISES, finishFromList, getGym, paceActions, tapDone, tapNextSet, useGym } from '../interaction/gymStore'
import { betweenText, headline, progressText } from '../interaction/activityText'

// Which card is showing: a set (each its own), the pause after a set, or none
const cardOf = ({ activity, between }: ReturnType<typeof getGym>) =>
  activity ? `set ${activity.session}` : between ? `after ${between.kind} ${between.set}` : null

// What's going on right now, with the same words as the popup in the gym,
// plus the other paces (treadmill, bike), Done when more sets of a target follow,
// and Finish. Between two sets: "Set 1 of 3 done", with Next set and Finish.
// Shown on the Exercises list and on an exercise's history page.
export function NowDoing() {
  const activity = useGym((s) => s.activity)
  const between = useGym((s) => s.between)
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!activity) return
    const timer = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(timer)
  }, [activity])

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
          <span>{betweenText(between)}</span>
        </div>
        <div className="now-actions" ref={actions}>
          <button key="next" type="button" className="list-button is-primary" data-next onClick={() => tapNextSet()}>
            Next set
          </button>
          <button key="finish" type="button" className="list-button" onClick={finishFromList}>
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
          <button key={action.label} type="button" className="list-button" onClick={action.run}>
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
          onClick={finishFromList}
        >
          Finish
        </button>
      </div>
    </div>
  )
}
