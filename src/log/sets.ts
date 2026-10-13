// What a saved set is, and the rules for saving one. Plain data and maths:
// no React, no 3D, so it can be tested on its own and loads with the shell.
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { paceSeconds, repsDone, type Activity } from '../interaction/gymStore'
import { strokesSince } from '../equipment/rowerGeometry'

// One finished set. endedAt is the real time of day (ms since 1970), because
// the exercise clock (performance.now) starts again at every reload.
// The numbers are what the gym measures: reps for strength exercises (with the
// weight picked for them, in kg, on exercises that take one), distance for
// cardio, plus strokes on the rower. Sets saved before weights have no kg.
export type LoggedSet = {
  id: string
  kind: ExerciseKind
  endedAt: number
  seconds: number
  reps?: number
  kg?: number
  meters?: number
  strokes?: number
}
export type NewSet = Omit<LoggedSet, 'id'>

// Shorter than this is a false start, not a set (decision D3)
export const MIN_REPS = 1
export const MIN_CARDIO_SECONDS = 10

const cents = (value: number) => Math.round(value * 100) / 100

// The part of `activity` at its current pace, as a set finished at `now`
// (exercise clock) and `endedAt` (time of day), or null if it doesn't count:
// the person never reached the machine, or it's too short. After a change of
// pace only the new pace's part is counted; the part before it was saved at
// the switch (decision D4: walk then run is two sets).
export function finishedPart(activity: Activity, now: number, endedAt: number): NewSet | null {
  if (!activity.arrived) return null // still stepping on: it never started
  const { kind } = activity
  const { speed, strokes } = EXERCISES[kind]
  const seconds = Math.max(0, paceSeconds(activity, now))
  if (speed) {
    if (seconds < MIN_CARDIO_SECONDS) return null
    const meters = cents(speed * seconds)
    return strokes
      ? { kind, endedAt, seconds: cents(seconds), meters, strokes: strokesSince(seconds) }
      : { kind, endedAt, seconds: cents(seconds), meters }
  }
  const reps = repsDone(activity, now)
  if (reps < MIN_REPS) return null
  const set: NewSet = { kind, endedAt, seconds: cents(seconds), reps }
  if (activity.kg !== undefined && EXERCISES[kind].load) set.kg = activity.kg
  return set
}

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0
const isAmount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const KNOWN_FIELDS = new Set(['id', 'kind', 'endedAt', 'seconds', 'reps', 'meters', 'strokes', 'kg'])

// A stored entry (from this browser's log or a backup file) as a set, or null
// if it isn't a real one: a known exercise, a time, and the numbers that
// exercise records (reps for strength, with a weight in kg if it has one and
// the exercise takes one; distance for cardio; strokes too on the rower).
// Numbers that don't belong to its exercise are left behind; numbers a newer
// Amygo adds come along untouched.
export function checkedSet(entry: unknown): LoggedSet | null {
  if (typeof entry !== 'object' || entry === null) return null
  const stored = entry as Record<string, unknown>
  if (typeof stored.id !== 'string' || !stored.id) return null
  if (typeof stored.kind !== 'string' || !Object.hasOwn(EXERCISES, stored.kind)) return null
  if (!isAmount(stored.endedAt) || !isAmount(stored.seconds)) return null
  const kind = stored.kind as ExerciseKind
  const set: LoggedSet = { id: stored.id, kind, endedAt: stored.endedAt as number, seconds: stored.seconds as number }
  const { speed, strokes, load } = EXERCISES[kind]
  if (!speed) {
    if (!isCount(stored.reps)) return null
    set.reps = stored.reps as number
    // A weight is optional (sets from before weights have none), but if it's there it must be a real one
    if (load && stored.kg !== undefined) {
      if (!isAmount(stored.kg)) return null
      set.kg = stored.kg as number
    }
  } else {
    if (!isAmount(stored.meters) || (strokes && !isCount(stored.strokes))) return null
    set.meters = stored.meters as number
    if (strokes) set.strokes = stored.strokes as number
  }
  const extra = set as Record<string, unknown>
  for (const [field, value] of Object.entries(stored)) {
    if (!KNOWN_FIELDS.has(field) && isAmount(value)) extra[field] = value
  }
  return set
}

// The real sets among stored entries, in their order, each id once; and how
// many entries weren't sets (one damaged entry costs that set, not the rest)
export function checkedSets(entries: unknown[]) {
  const sets: LoggedSet[] = []
  const ids = new Set<string>()
  let skipped = 0
  for (const entry of entries) {
    const set = checkedSet(entry)
    if (!set) skipped++
    else if (!ids.has(set.id)) {
      ids.add(set.id)
      sets.push(set)
    }
  }
  return { sets, skipped }
}

// A restore (decision D3: always a merge). Sets whose id is already here stay
// exactly as they are here, even if the incoming copy differs; the rest are
// added. The result is oldest first, as the log is saved.
export function mergeSets(here: LoggedSet[], incoming: LoggedSet[]) {
  const ids = new Set(here.map((set) => set.id))
  const added = incoming.filter((set) => !ids.has(set.id) && ids.add(set.id))
  return {
    sets: [...here, ...added].sort((a, b) => a.endedAt - b.endedAt),
    added,
    already: incoming.length - added.length,
  }
}

// At most `max` sets, oldest first: past it, the oldest go first
export function keepNewest(sets: LoggedSet[], max: number) {
  return sets.length > max ? [...sets].sort((a, b) => a.endedAt - b.endedAt).slice(-max) : sets
}

// The local calendar day a moment falls on, e.g. "2026-10-07". Built from the
// local year, month and day (not from 24-hour blocks), so a day when the
// clocks change is still one day (decision D7: a set belongs to the day it finished)
export function dayKey(time: number) {
  const date = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Today's sets, newest first
export function todaysSets(sets: LoggedSet[], now: number) {
  const today = dayKey(now)
  return sets.filter((set) => dayKey(set.endedAt) === today).sort((a, b) => b.endedAt - a.endedAt)
}

// How much a list of sets adds up to
export function totals(sets: LoggedSet[]) {
  return { count: sets.length, seconds: sets.reduce((sum, set) => sum + set.seconds, 0) }
}

// One day of the log: its key ("2026-10-07"), its sets newest first, and what they add up to
export type Day = { key: string; sets: LoggedSet[]; seconds: number }

// The log grouped into days, newest day first. Only days with sets appear.
export function daysOf(sets: LoggedSet[]): Day[] {
  const byDay = new Map<string, LoggedSet[]>()
  for (const set of sets) {
    const key = dayKey(set.endedAt)
    const day = byDay.get(key)
    if (day) day.push(set)
    else byDay.set(key, [set])
  }
  return [...byDay]
    .map(([key, daySets]) => ({
      key,
      sets: daySets.sort((a, b) => b.endedAt - a.endedAt),
      seconds: totals(daySets).seconds,
    }))
    .sort((a, b) => (a.key < b.key ? 1 : -1)) // "2026-10-07" sorts after "2026-10-06" as text too
}

// How many calendar days `key` is before the day `now` falls on (0 = today).
// Counted from noon to noon, so a 23- or 25-hour day (clocks changing) still counts as one.
export function daysAgo(key: string, now: number) {
  const noon = (dayText: string) => {
    const [year, month, day] = dayText.split('-').map(Number)
    return new Date(year, month - 1, day, 12).getTime()
  }
  return Math.round((noon(dayKey(now)) - noon(key)) / 86_400_000)
}

// One exercise's sets, newest first. Walk and run are different exercises
// (decision D4), so each keeps its own history.
export function setsOf(sets: LoggedSet[], kind: ExerciseKind) {
  return sets.filter((set) => set.kind === kind).sort((a, b) => b.endedAt - a.endedAt)
}

// What makes one set better than another. Strength: the heavier set; at the
// same weight, more reps (a set with no weight, from before weights, counts as
// 0 kg). Cardio: more distance. The rower too: its pace is fixed (2:00 per
// 500 m), so on pace every row would tie.
const score = (set: LoggedSet) => set.reps ?? set.meters ?? 0
const beats = (set: LoggedSet, other: LoggedSet) => {
  const heavier = (set.kg ?? 0) - (other.kg ?? 0)
  return heavier !== 0 ? heavier > 0 : score(set) > score(other)
}

// The best of one exercise's sets; on a tie, the earlier set (the first time
// you reached it). null when there are none.
export function bestSet(sets: LoggedSet[]): LoggedSet | null {
  let best: LoggedSet | null = null
  for (const set of sets) {
    const better = !best || beats(set, best) || (!beats(best, set) && set.endedAt < best.endedAt)
    if (better) best = set
  }
  return best
}

// Each exercise's most recent set (for the "Last:" line on the Exercises list)
export function lastSets(sets: LoggedSet[]) {
  const last: Partial<Record<ExerciseKind, LoggedSet>> = {}
  for (const set of sets) {
    const seen = last[set.kind]
    if (!seen || set.endedAt > seen.endedAt) last[set.kind] = set
  }
  return last
}
