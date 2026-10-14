// Fixing a saved set (decision D8). Its numbers can change: reps and kg for
// strength; the time for cardio, with the distance (and the rower's strokes)
// worked out again from it. When it happened and what exercise it was never
// change. Plain rules and text here: no React, no saving.
import { EXERCISES } from '../exercises/catalog'
import { cardioNumbers, MIN_CARDIO_SECONDS, MIN_REPS, type LoggedSet } from './sets'

// Generous upper ends, so a slip of the thumb (1200 reps) is caught
export const MAX_REPS = 999
export const MAX_CARDIO_SECONDS = 24 * 3600

// What the edit form holds: text, as typed. Which fields there are depends on the exercise.
export type Typed = { reps?: string; kg?: string; minutes?: string; seconds?: string }
export type EditField = keyof Typed

// The form's starting text for a set: what the row shows now. (A cardio set's
// time is kept to the hundredth of a second; the row's clock cuts it to whole
// seconds, 299.6 s reading 4:59, and so does the form.)
export function typedFor(set: LoggedSet): Typed {
  const { speed, load } = EXERCISES[set.kind]
  if (speed) {
    const whole = Math.floor(set.seconds)
    return { minutes: String(Math.floor(whole / 60)), seconds: String(whole % 60).padStart(2, '0') }
  }
  const reps = String(set.reps ?? 0)
  return load ? { reps, kg: set.kg === undefined ? '' : String(set.kg) } : { reps }
}

// The new numbers an edit asks for: only what really differs from the set.
// (kg null: the set has no weight any more.)
export type SetEdit = { reps?: number; kg?: number | null; seconds?: number }
export type EditErrors = { reps?: string; kg?: string; time?: string }

const WHOLE = /^\d{1,6}$/
const AMOUNT = /^\d{1,4}([.,]\d{1,2})?$/ // "62.5" (or "62,5", as some keyboards type it)

// What was typed, checked: the changes it asks for, and for each field that
// isn't right, why (shown under the fields; Save stays off until there are none).
// A field left as it was is never wrong and changes nothing.
export function checkEdit(set: LoggedSet, typed: Typed): { edit: SetEdit; errors: EditErrors } {
  const edit: SetEdit = {}
  const errors: EditErrors = {}
  const { speed, load } = EXERCISES[set.kind]
  const now = typedFor(set)

  if (speed) {
    const minutes = (typed.minutes ?? '').trim() || '0'
    const seconds = (typed.seconds ?? '').trim() || '0'
    if (Number(minutes) === Number(now.minutes) && Number(seconds) === Number(now.seconds)) return { edit, errors }
    const total = Number(minutes) * 60 + Number(seconds)
    if (!WHOLE.test(minutes) || !WHOLE.test(seconds) || Number(seconds) > 59) {
      errors.time = 'Time: whole minutes, and seconds from 0 to 59.'
    } else if (total < MIN_CARDIO_SECONDS) {
      errors.time = `Time: at least ${MIN_CARDIO_SECONDS} seconds.`
    } else if (total > MAX_CARDIO_SECONDS) {
      errors.time = 'Time: 24 hours at most.'
    } else {
      edit.seconds = total
    }
    return { edit, errors }
  }

  const reps = (typed.reps ?? '').trim()
  if (reps !== now.reps) {
    if (!WHOLE.test(reps) || Number(reps) < MIN_REPS || Number(reps) > MAX_REPS) {
      errors.reps = `Reps: a whole number from ${MIN_REPS} to ${MAX_REPS}.`
    } else if (Number(reps) !== set.reps) {
      edit.reps = Number(reps)
    }
  }
  if (load) {
    const kg = (typed.kg ?? '').trim()
    const value = Number(kg.replace(',', '.'))
    if (kg === '') {
      if (set.kg !== undefined) edit.kg = null
    } else if (kg !== now.kg && value !== set.kg) {
      if (!AMOUNT.test(kg) || value < load.min || value > load.max) {
        errors.kg = `Weight: from ${load.min} to ${load.max} kg, or empty for none.`
      } else {
        edit.kg = value
      }
    }
  }
  return { edit, errors }
}

export const hasErrors = (errors: EditErrors) => Object.keys(errors).length > 0
export const changesNothing = (edit: SetEdit) => Object.keys(edit).length === 0

// The set with an edit's new numbers. Its id, exercise and time of day stay;
// a cardio set's distance (and strokes) follow from its new time, by the same
// sums as a freshly finished set (cardioNumbers in sets.ts).
export function applyEdit(set: LoggedSet, edit: SetEdit): LoggedSet {
  const next = { ...set }
  const { speed, load } = EXERCISES[set.kind]
  if (speed) return edit.seconds === undefined ? next : { ...next, ...cardioNumbers(set.kind, edit.seconds) }
  if (edit.reps !== undefined) next.reps = edit.reps
  if (edit.kg === null) delete next.kg
  else if (edit.kg !== undefined && load) next.kg = edit.kg
  return next
}
