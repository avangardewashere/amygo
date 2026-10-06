import { useMemo } from 'react'
import { EXERCISES } from '../exercises/catalog'
import { clearHistory, removeSet, useLog } from '../log/logStore'
import { dayLabel, daySummary, finishedAt, setLength, setNumbers, totalsText } from '../log/logText'
import { dayKey, daysOf, todaysSets, totals, type LoggedSet } from '../log/sets'
import { useNow } from './clock'

export const EMPTY_TODAY = 'No sets yet today. Start one from Exercises.'

// One saved set, with Remove for a set you didn't mean to save
function SetList({ sets }: { sets: LoggedSet[] }) {
  return (
    <ul className="set-list">
      {sets.map((set) => (
        <li key={set.id}>
          <div>
            <strong>{EXERCISES[set.kind].name}</strong>
            <span>
              {setNumbers(set)} · {setLength(set)} · {finishedAt(set)}
            </span>
          </div>
          <button type="button" className="list-button" onClick={() => removeSet(set.id)}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}

// The Today page: every set finished today, newest first, with what it added
// up to; then the earlier days, each opening to its own sets; then Clear history.
// Days are counted from the shared clock (see clock.ts). (`now` is for tests.)
export function TodayPage({ now }: { now?: number }) {
  const sets = useLog((s) => s.sets)
  const clock = useNow(now)
  const today = useMemo(() => todaysSets(sets, clock), [sets, clock])
  // Every other day goes under Earlier (picked by date, not by its label)
  const earlier = useMemo(() => daysOf(sets).filter((day) => day.key !== dayKey(clock)), [sets, clock])

  return (
    <section className="page" aria-labelledby="today-title">
      <h2 id="today-title">Today</h2>
      {today.length === 0 ? (
        <p className="page-note">{EMPTY_TODAY}</p>
      ) : (
        <>
          <p className="page-note today-totals">{totalsText(totals(today))}</p>
          <SetList sets={today} />
        </>
      )}

      {earlier.length > 0 && (
        <>
          <h3 className="earlier-title">Earlier</h3>
          <div className="day-list">
            {earlier.map((day) => (
              // A native open/close row: works with touch, keyboard and screen readers, no state to keep
              <details key={day.key} className="day">
                <summary>
                  <strong>
                    {dayLabel(day.key, clock)} · {totalsText({ count: day.sets.length, seconds: day.seconds })}
                  </strong>
                  <span>{daySummary(day.sets)}</span>
                </summary>
                <SetList sets={day.sets} />
              </details>
            ))}
          </div>
        </>
      )}

      {sets.length > 0 && (
        <button type="button" className="list-button clear-history" onClick={() => clearHistory()}>
          Clear history
        </button>
      )}
    </section>
  )
}
