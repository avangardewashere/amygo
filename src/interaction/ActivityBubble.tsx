import { useEffect, useState } from 'react'
import {
  EXERCISES,
  swapSettled,
  paceActions,
  tapAgain,
  tapDone,
  tapFinish,
  tapMoreRest,
  tapNextSet,
  type Activity,
  type Between,
} from './gymStore'
import { betweenText, betweenWords, headline, progressText } from './activityText'
import { useTicking } from '../lib/ticking'

// The popup over the person's head while they exercise (with a mouse: a phone
// has the workout card), e.g. "Doing lateral raises · 10 kg" over "Set 1 of 3 ·
// 7 of 12 reps", with Done (this set ends and is saved; Space), buttons to change
// pace on the treadmill and bike, and Finish (the round ends too; Esc).
export function ActivityBubble({ activity }: { activity: Activity }) {
  const [now, setNow] = useState(() => performance.now())

  // Refresh a few times a second (the numbers come from the clock, so they
  // always match what the person is doing)
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="activity-bubble" role="status">
      <div>
        <strong>{headline(activity)}</strong>
        <span>{progressText(activity, now)}</span>
      </div>
      <div className="bubble-actions">
        {paceActions(activity).map((action, i) => (
          <button key={action.label} type="button" className="activity-stop" onClick={() => swapSettled() && action.run()}>
            {action.label}
            <kbd className="key-hint">{i + 1}</kbd>
          </button>
        ))}
        <button type="button" className="activity-stop" onClick={() => tapDone()}>
          Done
          <kbd className="key-hint">Space</kbd>
        </button>
        <button type="button" className="activity-stop" onClick={() => tapFinish()}>
          Finish
          <kbd className="key-hint">Esc</kbd>
        </button>
      </div>
    </div>
  )
}

// The same popup after a set of a round: resting ("Bicep curls" over "Rest ·
// 1:12 · set 2 of 3 next", with +30 s, Skip and Finish), or after the last set
// ("3 sets done", with Again and Finish)
export function BetweenBubble({ between }: { between: Between }) {
  const resting = between.until !== null
  const now = useTicking(resting, 250)
  return (
    <div className="activity-bubble" role="status">
      <div>
        <strong>{EXERCISES[between.kind].name}</strong>
        <span aria-hidden="true">{betweenText(between, now)}</span>
        <span className="visually-hidden">{betweenWords(between)}</span>
      </div>
      <div className="bubble-actions">
        {resting ? (
          <>
            <button type="button" className="activity-stop" onClick={() => tapMoreRest()}>
              +30 s
            </button>
            <button type="button" className="activity-stop" onClick={() => tapNextSet()}>
              Skip
              <kbd className="key-hint">Space</kbd>
            </button>
          </>
        ) : (
          <button type="button" className="activity-stop" onClick={() => tapAgain()}>
            Again
          </button>
        )}
        <button type="button" className="activity-stop" onClick={() => tapFinish()}>
          Finish
          <kbd className="key-hint">Esc</kbd>
        </button>
      </div>
    </div>
  )
}
