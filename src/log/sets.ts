// What a saved set is, and the rules for saving one. Plain data and maths:
// no React, no 3D, so it can be tested on its own and loads with the shell.
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { paceSeconds, repsDone, type Activity } from '../interaction/gymStore'
import { strokesSince } from '../equipment/rowerGeometry'

// One finished set. endedAt is the real time of day (ms since 1970), because
// the exercise clock (performance.now) starts again at every reload.
// The numbers are what the gym measures (no weights: the gym has no picker):
// reps for strength exercises, distance for cardio, plus strokes on the rower.
export type LoggedSet = {
  id: string
  kind: ExerciseKind
  endedAt: number
  seconds: number
  reps?: number
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
  return { kind, endedAt, seconds: cents(seconds), reps }
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
