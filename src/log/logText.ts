// The words for saved sets, e.g. "12 reps", "0.45 km", "4 sets · 9 min".
// Kept apart from the page so they can be tested.
import { clock } from '../interaction/activityText'
import type { LoggedSet } from './sets'

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
