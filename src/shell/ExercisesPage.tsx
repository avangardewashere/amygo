import { useEffect, useMemo, useState } from 'react'
import { EXERCISES } from '../exercises/catalog'
import { exerciseGroups } from '../exercises/list'
import { finishFromList, paceActions, startFromList, useGym } from '../interaction/gymStore'
import { headline, progressText } from '../interaction/activityText'
import { useBuild } from '../build/buildStore'

// What's going on right now, with the same words as the popup in the gym,
// plus the other paces (treadmill, bike) and Finish
function NowDoing() {
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

// The Exercises page: everything the gym can do, grouped by machine. Start
// puts the person on the nearest machine of that kind, doing it.
export function ExercisesPage() {
  const items = useBuild((s) => s.items)
  const doing = useGym((s) => s.activity?.kind)
  const holding = useGym((s) => s.holding)
  const groups = useMemo(() => exerciseGroups(items), [items])

  return (
    <section className="page" aria-labelledby="exercises-title">
      <h2 id="exercises-title">Exercises</h2>
      <NowDoing />
      {holding && <p className="page-note">Put the dumbbell down first (on Home) to start an exercise.</p>}
      {groups.map((group) => (
        <div key={group.machine} className={`machine-group${group.available ? '' : ' is-unavailable'}`}>
          <h3>
            {group.name}
            {!group.available && <span className="machine-missing"> · Not in your gym</span>}
          </h3>
          <ul>
            {group.exercises.map((kind) => (
              <li key={kind}>
                <span>{EXERCISES[kind].name}</span>
                {doing === kind ? (
                  <span className="doing-tag">Doing</span>
                ) : (
                  <button
                    type="button"
                    className="list-button"
                    disabled={!group.available || holding}
                    onClick={() => startFromList(kind)}
                  >
                    Start
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
