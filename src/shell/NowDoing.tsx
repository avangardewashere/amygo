import { useEffect, useState } from 'react'
import { finishFromList, paceActions, useGym } from '../interaction/gymStore'
import { headline, progressText } from '../interaction/activityText'

// What's going on right now, with the same words as the popup in the gym,
// plus the other paces (treadmill, bike) and Finish. Shown on the Exercises
// list and on an exercise's history page.
export function NowDoing() {
  const activity = useGym((s) => s.activity)
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!activity) return
    const timer = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(timer)
  }, [activity])
  if (!activity) return null
  return (
    <div className="now-card" role="status">
      <div>
        <strong>{headline(activity)}</strong>
        <span>{progressText(activity, now)}</span>
      </div>
      <div className="now-actions">
        {paceActions(activity).map((action) => (
          <button key={action.label} type="button" className="list-button" onClick={action.run}>
            {action.label}
          </button>
        ))}
        <button type="button" className="list-button is-primary" onClick={finishFromList}>
          Finish
        </button>
      </div>
    </div>
  )
}
