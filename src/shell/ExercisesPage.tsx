import { useEffect, useMemo, useRef } from 'react'
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { exerciseGroups } from '../exercises/list'
import { startFromList, useGym } from '../interaction/gymStore'
import { useBuild } from '../build/buildStore'
import { useLog } from '../log/logStore'
import { lastLine } from '../log/logText'
import { lastSets } from '../log/sets'
import { useNow } from './clock'
import { ExerciseHistoryPage } from './ExerciseHistoryPage'
import { NowDoing } from './NowDoing'
import { useHistoryKind } from './tabStore'
import { openHistory } from './tabs'

// The History button's id for an exercise (focus goes back to it on Back)
const historyButtonId = (kind: ExerciseKind) => `history-${kind}`

// The Exercises page: everything the gym can do, grouped by machine. Start
// puts the person on the nearest machine of that kind, doing it; History
// opens that exercise's own page over the list. Under each exercise done
// before: "Last: 12 reps · Yesterday".
// Days are counted from the shared clock (see clock.ts). (`now` is for tests.)
export function ExercisesPage({ now }: { now?: number }) {
  const items = useBuild((s) => s.items)
  const doing = useGym((s) => s.activity?.kind)
  const holding = useGym((s) => s.holding)
  const groups = useMemo(() => exerciseGroups(items), [items])
  const sets = useLog((s) => s.sets)
  const last = useMemo(() => lastSets(sets), [sets])
  const clock = useNow(now)
  const historyKind = useHistoryKind()

  // Back from an exercise's history: focus returns to its History button
  const shownBefore = useRef<ExerciseKind | null>(null)
  useEffect(() => {
    if (shownBefore.current && !historyKind) document.getElementById(historyButtonId(shownBefore.current))?.focus()
    shownBefore.current = historyKind
  }, [historyKind])

  return (
    <>
      {/* While a history page covers it, the list is kept (with its scroll) but out of reach */}
      <section className="page" aria-labelledby="exercises-title" inert={historyKind !== null}>
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
              {group.exercises.map((kind) => {
                const lastSet = last[kind]
                return (
                  <li key={kind}>
                    <div className="exercise-name">
                      <span>{EXERCISES[kind].name}</span>
                      {lastSet && <small className="last-line">{lastLine(lastSet, clock)}</small>}
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        id={historyButtonId(kind)}
                        className="list-button is-quiet"
                        aria-label={`History: ${EXERCISES[kind].name}`}
                        onClick={() => openHistory(kind)}
                      >
                        History
                      </button>
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
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>
      {historyKind && <ExerciseHistoryPage kind={historyKind} now={now} />}
    </>
  )
}
