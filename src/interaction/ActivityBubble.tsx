import { useEffect, useState } from 'react'
import { paceActions, stopExercise, type Activity } from './gymStore'
import { headline, progressText } from './activityText'

// The popup over the person's head while they exercise, e.g.
// "Doing lateral raises · 3 reps done" or "Running · 10.8 km/h · 0.15 km · 0:50",
// with a Stop button, and buttons to change pace on the treadmill and bike.
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
      {paceActions(activity).map((action, i) => (
        <button key={action.label} type="button" className="activity-stop" onClick={action.run}>
          {action.label}
          <kbd className="key-hint">{i + 1}</kbd>
        </button>
      ))}
      <button type="button" className="activity-stop" onClick={stopExercise}>
        Stop
        <kbd className="key-hint">Esc</kbd>
      </button>
    </div>
  )
}
