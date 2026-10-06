// The words for saved sets, e.g. "12 reps", "0.45 km", "4 sets · 9 min".
// Kept apart from the page so they can be tested.
import { clock } from '../interaction/activityText'
import { EXERCISES } from '../exercises/catalog'
import { daysAgo, type LoggedSet } from './sets'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// What the set achieved: reps, or distance (with strokes on the rower)
export function setNumbers(set: LoggedSet) {
  if (set.reps !== undefined) return plural(set.reps, 'rep', 'reps')
  const km = `${((set.meters ?? 0) / 1000).toFixed(2)} km`
  return set.strokes !== undefined ? `${plural(set.strokes, 'stroke', 'strokes')} · ${km}` : km
}

// How long it lasted, as on the popup: "0:29"
export const setLength = (set: LoggedSet) => clock(set.seconds)

// When it finished, on the device's clock: "at 14:05" (the "at" keeps it from
// reading as another length next to "0:29")
export function finishedAt(set: LoggedSet) {
  const date = new Date(set.endedAt)
  return `at ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

// "4 sets · 9 min" (under a minute in all: "1 set · 45 s")
export function totalsText({ count, seconds }: { count: number; seconds: number }) {
  const time = seconds < 60 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`
  return `${plural(count, 'set', 'sets')} · ${time}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A day's name, the way you'd say it: "Today", "Yesterday", "Mon" within the
// last week, then "5 Oct", and "5 Oct 2025" once it's another year
export function dayLabel(key: string, now: number) {
  const ago = daysAgo(key, now)
  if (ago === 0) return 'Today'
  if (ago === 1) return 'Yesterday'
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (ago < 7) return `${WEEKDAYS[date.getDay()]} ${day} ${MONTHS[month - 1]}`
  const thisYear = new Date(now).getFullYear()
  return year === thisYear ? `${day} ${MONTHS[month - 1]}` : `${day} ${MONTHS[month - 1]} ${year}`
}

// What a day's sets were, one exercise at a time in the order first done:
// "Bicep curls 3 × 12 · Walk 1.20 km" (reps listed one by one when they differ: "12, 10, 8")
export function daySummary(sets: LoggedSet[]) {
  const byKind = new Map<LoggedSet['kind'], LoggedSet[]>()
  for (const set of [...sets].sort((a, b) => a.endedAt - b.endedAt)) {
    byKind.set(set.kind, [...(byKind.get(set.kind) ?? []), set])
  }
  return [...byKind]
    .map(([kind, done]) => {
      const name = EXERCISES[kind].name
      if (done[0].reps === undefined) {
        const meters = done.reduce((sum, set) => sum + (set.meters ?? 0), 0)
        return `${name} ${(meters / 1000).toFixed(2)} km`
      }
      const reps = done.map((set) => set.reps)
      return reps.every((count) => count === reps[0]) ? `${name} ${reps.length} × ${reps[0]}` : `${name} ${reps.join(', ')}`
    })
    .join(' · ')
}
