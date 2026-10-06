import { useMemo, useState } from 'react'
import { EXERCISES } from '../exercises/catalog'
import { removeSet, useLog } from '../log/logStore'
import { finishedAt, setLength, setNumbers, totalsText } from '../log/logText'
import { todaysSets, totals } from '../log/sets'

export const EMPTY_TODAY = 'No sets yet today. Start one from Exercises.'

// The Today page: every set finished today, newest first, with what it added
// up to. Remove is for a set you didn't mean to save.
// The clock is read once, when the page opens: no set can finish while it's
// open (Finish is on Exercises), so that's always recent enough.
// (`now` is for tests.)
export function TodayPage({ now }: { now?: number }) {
  const sets = useLog((s) => s.sets)
  const [opened] = useState(() => now ?? Date.now())
  const today = useMemo(() => todaysSets(sets, opened), [sets, opened])

  return (
    <section className="page" aria-labelledby="today-title">
      <h2 id="today-title">Today</h2>
      {today.length === 0 ? (
        <p className="page-note">{EMPTY_TODAY}</p>
      ) : (
        <>
          <p className="page-note today-totals">{totalsText(totals(today))}</p>
          <ul className="set-list">
            {today.map((set) => (
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
        </>
      )}
    </section>
  )
}
