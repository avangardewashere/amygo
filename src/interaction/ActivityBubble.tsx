import { useEffect, useState } from 'react'
import { EXERCISES, repsDone, secondsSince, stopExercise, type Activity } from './gymStore'

// m/s → km/h, the unit treadmill consoles show
const toKmh = (metersPerSecond: number) => (metersPerSecond * 3.6).toFixed(1)

// 75 seconds → "1:15"
function clock(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function progressText(activity: Activity, now: number) {
  const { speed } = EXERCISES[activity.kind]
  if (speed) {
    // Treadmill: distance = speed × time
    const seconds = secondsSince(activity, now)
    const km = (speed * seconds) / 1000
    return `${km.toFixed(2)} km · ${clock(seconds)}`
  }
  const reps = repsDone(activity, now)
  return reps === 0 ? 'First rep…' : `${reps} ${reps === 1 ? 'rep' : 'reps'} done`
}

function headline(activity: Activity) {
  const { doing, speed } = EXERCISES[activity.kind]
  return speed ? `${doing} · ${toKmh(speed)} km/h` : doing
}

// The popup over the person's head while they exercise, e.g.
// "Doing lateral raises · 3 reps done" or "Running · 10.8 km/h · 0.15 km · 0:50",
// with a Stop button.
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
      <button type="button" className="activity-stop" onClick={stopExercise}>
        Stop
        <kbd className="key-hint">Esc</kbd>
      </button>
    </div>
  )
}
