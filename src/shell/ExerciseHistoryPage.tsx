import { useEffect, useMemo, useRef } from 'react'
import { EXERCISES, MACHINE_NAMES, type ExerciseKind } from '../exercises/catalog'
import { LOAD_MEANS } from '../exercises/load'
import { useBuild } from '../build/buildStore'
import { startFromList, useGym } from '../interaction/gymStore'
import { cancelEdit } from '../log/editing'
import { forgetRemoved, useLog } from '../log/logStore'
import { emptyHistory, finishedAt, setDay, setLength, setNumbers } from '../log/logText'
import { bestSet, setsOf } from '../log/sets'
import { NowDoing } from './NowDoing'
import { SetAnnouncer, SetRows } from './SetRows'
import { WeightStepper } from './WeightStepper'
import { useNow } from './clock'
import { closeHistory } from './tabs'

// One exercise's history, opened from its row on the Exercises list: last
// time, best, and every set newest first, with Start. It covers the list
// (which stays underneath, keeping its scroll) until Back.
// Days are counted from the shared clock (see clock.ts). (`now` is for tests.)
export function ExerciseHistoryPage({ kind, now }: { kind: ExerciseKind; now?: number }) {
  const sets = useLog((s) => s.sets)
  const clock = useNow(now)
  const mine = useMemo(() => setsOf(sets, kind), [sets, kind])
  // Its sets just removed keep their place for a few seconds, with Undo
  const removed = useLog((s) => s.removed)
  const removedMine = useMemo(() => removed.filter((set) => set.kind === kind), [removed, kind])
  const best = useMemo(() => bestSet(mine), [mine])
  const items = useBuild((s) => s.items)
  const doing = useGym((s) => s.activity?.kind) === kind
  const holding = useGym((s) => s.holding)
  const { name, machine, load } = EXERCISES[kind]
  const available = items.some((item) => item.type === machine)

  // Focus moves to the page's title, so keyboards and screen readers start here
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [kind])

  // Leaving the page: an open form closes unsaved, and what was removed stays removed
  useEffect(
    () => () => {
      cancelEdit()
      forgetRemoved()
    },
    [kind],
  )

  return (
    <section className="page history-page" aria-labelledby="history-title">
      <button type="button" className="back-button" onClick={closeHistory}>
        ‹ Exercises
      </button>
      <h2 id="history-title" ref={title} tabIndex={-1}>
        {name}
      </h2>
      <p className="page-note">
        {MACHINE_NAMES[machine]}
        {!available && ' · Not in your gym'}
      </p>
      <NowDoing />
      {holding && <p className="page-note">Put the dumbbell down first (on Home) to start an exercise.</p>}
      {!doing && (
        <div className="history-start-row">
          {/* The same weight picker as on the list, before Start as there: this Start uses it too */}
          <WeightStepper kind={kind} />
          <button
            type="button"
            className="list-button is-primary history-start"
            disabled={!available || holding}
            onClick={() => {
              // The list's own Start; the page stays open, so the set appears here when finished.
              // Start is replaced by the live card, so focus goes to the title (the next Tab is Finish).
              startFromList(kind)
              title.current?.focus()
            }}
          >
            Start
          </button>
          {load && <small className="last-line weight-means">Weight: {LOAD_MEANS[load.of]}</small>}
        </div>
      )}

      {mine.length === 0 && removedMine.length === 0 ? (
        <p className="page-note history-empty">{emptyHistory(kind)}</p>
      ) : (
        <>
          {best && (
            <div className="history-stats">
              <div>
                <span>Last time</span>
                <strong>{setNumbers(mine[0])}</strong>
                <small>{setDay(mine[0], clock)}</small>
              </div>
              <div>
                <span>Best</span>
                <strong>{setNumbers(best)}</strong>
                <small>{setDay(best, clock)}</small>
              </div>
            </div>
          )}
          <h3 className="earlier-title">
            All sets · {mine.length}
          </h3>
          <SetRows
            sets={mine}
            removed={removedMine}
            heading={(set) => `${setDay(set, clock)} · ${finishedAt(set)}`}
            detail={(set) => `${setNumbers(set)} · ${setLength(set)}`}
          />
        </>
      )}
      <SetAnnouncer />
    </section>
  )
}
