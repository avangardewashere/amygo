import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { LOG_KEY, LOG_VERSION } from './logStorage'
import { daysAgo, daysOf, dayKey, type LoggedSet } from './sets'
import { dayLabel, daySummary } from './logText'

// Times in local time, so the tests mean the same thing in any time zone
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime()

let made = 0
const curls = (endedAt: number, reps = 12): LoggedSet => ({ id: `s${made++}`, kind: 'curl', endedAt, seconds: reps * 2.4, reps })
const walk = (endedAt: number, meters: number, seconds = 300): LoggedSet => ({ id: `s${made++}`, kind: 'walk', endedAt, seconds, meters })

// A stand-in for the browser's localStorage holding `sets`, as the log saves them
function fakeStorage(sets: LoggedSet[] = []) {
  const data = new Map([[LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets })]])
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  }
}
const savedIn = (storage: ReturnType<typeof fakeStorage>) => JSON.parse(storage.data.get(LOG_KEY)!).sets as LoggedSet[]

// "Open the page": a fresh log, read from `storage`
async function openLog(storage: ReturnType<typeof fakeStorage>) {
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  return import('./logStore')
}

afterEach(() => vi.unstubAllGlobals())

describe('History by day', () => {
  it('V7B2-T1: sets group into local days, newest day first; days without sets don\'t appear', () => {
    const sets = [curls(at(2026, 10, 5, 9)), walk(at(2026, 10, 7, 8), 900), curls(at(2026, 10, 5, 18)), curls(at(2026, 10, 7, 19))]
    const days = daysOf(sets)
    expect(days.map((day) => day.key)).toEqual(['2026-10-07', '2026-10-05']) // the 6th had nothing
    expect(days[0].sets.map((set) => set.endedAt)).toEqual([at(2026, 10, 7, 19), at(2026, 10, 7, 8)]) // newest first inside a day
    expect(days[1].sets).toHaveLength(2)
    // Days stay in order across a month and a year
    expect(daysOf([curls(at(2025, 12, 31)), curls(at(2026, 1, 1)), curls(at(2026, 9, 30))]).map((day) => day.key)).toEqual([
      '2026-09-30',
      '2026-01-01',
      '2025-12-31',
    ])
  })

  it('V7B2-T2: 00:05 belongs to the new day, and a day when the clocks change is still one day', () => {
    expect(dayKey(at(2026, 10, 6, 23, 59))).toBe('2026-10-06')
    expect(dayKey(at(2026, 10, 7, 0, 5))).toBe('2026-10-07')
    expect(daysOf([curls(at(2026, 10, 6, 23, 59)), curls(at(2026, 10, 7, 0, 5))])).toHaveLength(2)

    // In London, clocks go forward on 29 March 2026: that day has 23 hours
    // (Node's own settings; the app's types don't include Node, so reached through globalThis)
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
    const zone = env.TZ
    env.TZ = 'Europe/London'
    try {
      const sets = [curls(at(2026, 3, 29, 0, 30)), curls(at(2026, 3, 29, 23, 30))]
      expect(daysOf(sets).map((day) => day.key)).toEqual(['2026-03-29']) // one day, both sets
      expect(daysAgo('2026-03-29', at(2026, 3, 30, 0, 30))).toBe(1) // just 23½ hours later, but the next day
      expect(dayLabel('2026-03-29', at(2026, 3, 30, 9))).toBe('Yesterday')
      expect(daysAgo('2026-03-28', at(2026, 3, 30, 9))).toBe(2)
      // …and back again on 25 October (25 hours)
      expect(daysAgo('2026-10-25', at(2026, 10, 26, 23, 30))).toBe(1)
    } finally {
      env.TZ = zone
    }
  })

  it('V7B2-T3: each day adds up its sets, time, reps per exercise and distance per cardio exercise', async () => {
    const sets = [curls(at(2026, 10, 6, 9), 12), curls(at(2026, 10, 6, 9, 5), 12), curls(at(2026, 10, 6, 9, 10), 12), walk(at(2026, 10, 6, 10), 700), walk(at(2026, 10, 6, 11), 500)]
    const [day] = daysOf(sets)
    expect(day.sets).toHaveLength(5)
    expect(day.seconds).toBeCloseTo(3 * 28.8 + 600, 5)
    expect(daySummary(day.sets)).toBe('Bicep curls 3 × 12 · Walk 1.20 km')
    expect(daySummary([curls(at(2026, 10, 6, 9), 12), curls(at(2026, 10, 6, 9, 5), 10), curls(at(2026, 10, 6, 9, 9), 8)])).toBe(
      'Bicep curls 12, 10, 8',
    )

    // On the page: under Earlier, the day's row with its totals and what was done
    // (plus a set dated tomorrow, as after the device's clock was moved back: it must still be listed)
    const log = await openLog(fakeStorage([...sets, curls(at(2026, 10, 7, 9)), curls(at(2026, 10, 8, 9), 7)]))
    const { TodayPage } = await import('../shell/TodayPage')
    const html = renderToString(createElement(TodayPage, { now: at(2026, 10, 7, 15) })).replaceAll('<!-- -->', '')
    expect(html).toContain('Earlier')
    expect(html).toContain('Yesterday · 5 sets · 11 min')
    expect(html).toContain('Bicep curls 3 × 12 · Walk 1.20 km')
    expect(html).not.toContain('Today · ') // today is above, not repeated under Earlier
    expect(html).toContain('Thu 8 Oct · 1 set · 17 s')
    expect(log.getLog().sets).toHaveLength(7)
  })

  it('V7B2-T4: day names at a fixed "now" (Wednesday 7 Oct 2026)', () => {
    const now = at(2026, 10, 7, 15)
    expect(dayLabel('2026-10-07', now)).toBe('Today')
    expect(dayLabel('2026-10-06', now)).toBe('Yesterday')
    expect(dayLabel('2026-10-02', now)).toBe('Fri 2 Oct') // within the week: the weekday
    expect(dayLabel('2026-10-01', now)).toBe('Thu 1 Oct')
    expect(dayLabel('2026-09-30', now)).toBe('30 Sep') // a week or more: the date
    expect(dayLabel('2026-01-15', now)).toBe('15 Jan')
    expect(dayLabel('2025-12-31', now)).toBe('31 Dec 2025') // another year: with the year
    // A day after today (only after the device's clock was moved back) is never called "Today"
    expect(dayLabel('2026-10-08', now)).toBe('Thu 8 Oct')
  })

  it('V7B2-T5: Clear history asks first; yes empties the list and the saved copy, cancel leaves both', async () => {
    const storage = fakeStorage([curls(at(2026, 10, 6)), walk(at(2026, 10, 7), 500)])
    let log = await openLog(storage)
    const questions: string[] = []
    expect(log.clearHistory((question) => (questions.push(question), false))).toBe(false)
    expect(questions).toEqual([log.CLEAR_QUESTION])
    expect(log.getLog().sets).toHaveLength(2)
    expect(savedIn(storage)).toHaveLength(2)

    expect(log.clearHistory(() => true)).toBe(true)
    expect(log.getLog().sets).toEqual([])
    log = await openLog(storage) // reload
    expect(log.getLog().sets).toEqual([])

    // The button is only there when there's something to clear
    const { TodayPage } = await import('../shell/TodayPage')
    expect(renderToString(createElement(TodayPage, { now: at(2026, 10, 7) }))).not.toContain('Clear history')
    log.recordSet({ kind: 'curl', endedAt: at(2026, 10, 7), seconds: 3, reps: 1 })
    expect(renderToString(createElement(TodayPage, { now: at(2026, 10, 7) }))).toContain('Clear history')
  })

  it('V7B2-T6: saving set 5,001 drops the oldest, and 5,000 sets still group quickly', async () => {
    // 5,000 sets, about three a day back from 7 Oct 2026
    const full = Array.from({ length: 5000 }, (_, i) => curls(at(2026, 10, 7, 20) - i * 8 * 3600_000))
    const oldest = full[full.length - 1]
    const storage = fakeStorage(full)
    const log = await openLog(storage)
    expect(log.MAX_SETS).toBe(5000)
    const newest = log.recordSet({ kind: 'walk', endedAt: at(2026, 10, 7, 21), seconds: 60, meters: 90 })
    const kept = log.getLog().sets
    expect(kept).toHaveLength(5000)
    expect(kept.some((set) => set.id === oldest.id)).toBe(false)
    expect(kept.some((set) => set.id === newest.id)).toBe(true)
    expect(savedIn(storage)).toHaveLength(5000)

    const start = performance.now()
    const days = daysOf(kept)
    const took = performance.now() - start
    expect(days.length).toBeGreaterThan(1600)
    expect(took).toBeLessThan(50)
  })
})
