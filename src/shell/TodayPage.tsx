import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { EXERCISES } from '../exercises/catalog'
import { takePickedFile } from '../lib/files'
import { restoreText } from '../log/backup'
import { cancelEdit } from '../log/editing'
import { backUpLog, clearHistory, forgetRemoved, MAX_SETS, restoreFile, useLog } from '../log/logStore'
import { dayLabel, daySummary, finishedAt, setLength, setNumbers, totalsText } from '../log/logText'
import { dayKey, daysOf, todaysSets, totals, type LoggedSet } from '../log/sets'
import { SetAnnouncer, SetRows } from './SetRows'
import { useNow } from './clock'

export const EMPTY_TODAY = 'No sets yet today. Start one from Exercises.'
export const LOG_TOOLS_NOTE = "Saved in this browser only. Back up makes a file of your log; Restore adds a file's sets here."

// A day's sets, each with Edit and Remove (see SetRows.tsx): the exercise, then
// its numbers, how long it took and when it finished
function SetList({ sets, removed }: { sets: LoggedSet[]; removed: LoggedSet[] }) {
  return (
    <SetRows
      sets={sets}
      removed={removed}
      heading={(set) => EXERCISES[set.kind].name}
      detail={(set) => `${setNumbers(set)} · ${setLength(set)} · ${finishedAt(set)}`}
    />
  )
}

// Back up, Restore and Clear history, under the log. Restore is there even with
// no sets: it's how a log arrives in a new browser (decisions D2–D4).
function LogTools({ hasSets }: { hasSets: boolean }) {
  const [result, setResult] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const line = useRef<HTMLParagraphElement>(null)

  // A new result is emptied first and shown a moment later, so the same words
  // twice still read (and are announced) as new. (A timer, not the next frame:
  // frames stop while the page is hidden, a timer only slows.)
  const show = (text: string) => {
    setResult('')
    setTimeout(() => setResult(text), 100)
  }
  // …and brought into view: a restore can add many days above it
  useEffect(() => {
    if (result) line.current?.scrollIntoView({ block: 'nearest' })
  }, [result])

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = takePickedFile(event.currentTarget)
    if (file) show(restoreText(await restoreFile(file), MAX_SETS, Date.now()))
  }

  return (
    <div className="log-tools">
      <h3 className="earlier-title">Your log</h3>
      <p className="page-note">{LOG_TOOLS_NOTE}</p>
      <div className="log-tools-row">
        {hasSets && (
          <button type="button" className="list-button" onClick={() => show(backUpLog(Date.now()))}>
            Back up
          </button>
        )}
        <button type="button" className="list-button" onClick={() => picker.current?.click()}>
          Restore
        </button>
        <input ref={picker} type="file" accept=".json,application/json" hidden onChange={restore} />
      </div>
      <p ref={line} className="log-tools-result" role="status">
        {result}
      </p>
      {hasSets && (
        <button type="button" className="list-button clear-history" onClick={() => clearHistory() && setResult('')}>
          Clear history
        </button>
      )}
    </div>
  )
}

// The Today page: every set finished today, newest first, with what it added
// up to; then the earlier days, each opening to its own sets; then the log's
// tools (Back up, Restore, Clear history). Each set can be fixed (Edit) or
// removed; a removed one stays in its place for a few seconds with Undo.
// Days are counted from the shared clock (see clock.ts). (`now` is for tests.)
export function TodayPage({ now }: { now?: number }) {
  const sets = useLog((s) => s.sets)
  const removed = useLog((s) => s.removed)
  const clock = useNow(now)
  const today = useMemo(() => todaysSets(sets, clock), [sets, clock])
  // Sets just removed keep their place, and their day, while Undo is on offer:
  // the days shown come from both, and each day's sums count only what's left
  const gone = useMemo(() => new Set(removed.map((set) => set.id)), [removed])
  const left = (all: LoggedSet[]) => all.filter((set) => !gone.has(set.id))
  const taken = (all: LoggedSet[]) => all.filter((set) => gone.has(set.id))
  const removedToday = removed.filter((set) => dayKey(set.endedAt) === dayKey(clock))
  // Every other day goes under Earlier (picked by date, not by its label)
  const earlier = useMemo(
    () => daysOf([...sets, ...removed]).filter((day) => day.key !== dayKey(clock)),
    [sets, removed, clock],
  )

  // Leaving the page: an open form closes unsaved, and what was removed stays removed
  useEffect(
    () => () => {
      cancelEdit()
      forgetRemoved()
    },
    [],
  )

  return (
    <section className="page" aria-labelledby="today-title">
      <h2 id="today-title">Today</h2>
      {today.length === 0 && removedToday.length === 0 ? (
        <p className="page-note">{EMPTY_TODAY}</p>
      ) : (
        <>
          <p className="page-note today-totals">{totalsText(totals(today))}</p>
          <SetList sets={today} removed={removedToday} />
        </>
      )}

      {earlier.length > 0 && (
        <>
          <h3 className="earlier-title">Earlier</h3>
          <div className="day-list">
            {earlier.map((day) => {
              const kept = left(day.sets)
              return (
                // A native open/close row: works with touch, keyboard and screen readers, no state to keep
                <details key={day.key} className="day">
                  <summary>
                    <strong>
                      {dayLabel(day.key, clock)} · {totalsText(totals(kept))}
                    </strong>
                    <span>{daySummary(kept)}</span>
                  </summary>
                  <SetList sets={kept} removed={taken(day.sets)} />
                </details>
              )
            })}
          </div>
        </>
      )}

      <LogTools hasSets={sets.length > 0} />
      <SetAnnouncer />
    </section>
  )
}
