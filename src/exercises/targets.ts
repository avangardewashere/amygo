// The target picked for each exercise (v10): how many sets, and in each set how
// many reps (strength) or minutes (cardio). Chosen on the Exercises row before
// Start and remembered, kept in this browser the same careful way as the
// weights: saving never breaks the app, and what was saved is checked first.
import { createStore } from '../lib/store'
import { storage } from '../lib/storage'
import { EXERCISES, type ExerciseKind } from './catalog'

export const TARGETS_KEY = 'gym3d.targets'
export const TARGETS_VERSION = 1

export type Target = { sets: number; reps: number; minutes?: never } | { sets: number; minutes: number; reps?: never }
export type TargetPart = 'sets' | 'reps' | 'minutes'

// What each number may be (decision P-D3)
export const TARGET_RANGES: Record<TargetPart, { min: number; max: number }> = {
  sets: { min: 1, max: 10 },
  reps: { min: 1, max: 50 },
  minutes: { min: 1, max: 60 },
}

// Cardio is what moves at a speed (treadmill, bike, rower). Not "has no
// weight": pull-ups have no weight and are counted in reps.
export const isCardio = (kind: ExerciseKind) => EXERCISES[kind].speed !== undefined

export const defaultTarget = (kind: ExerciseKind): Target =>
  isCardio(kind) ? { sets: 1, minutes: 10 } : { sets: 3, reps: 12 }

// A whole number brought into its range; anything else is `fallback`
function fit(part: TargetPart, value: unknown, fallback: number) {
  if (!Number.isInteger(value)) return fallback
  const { min, max } = TARGET_RANGES[part]
  return Math.min(max, Math.max(min, value as number))
}

// A saved target as one that checks out for this exercise: each number in its
// range, and the default for any that isn't a whole number
function checkedTarget(kind: ExerciseKind, saved: unknown): Target {
  const fallback = defaultTarget(kind)
  const entry = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  const sets = fit('sets', entry.sets, fallback.sets)
  return fallback.minutes !== undefined
    ? { sets, minutes: fit('minutes', entry.minutes, fallback.minutes) }
    : { sets, reps: fit('reps', entry.reps, fallback.reps) }
}

type Targets = Partial<Record<ExerciseKind, Target>>

// The saved picks. Anything unreadable just means "none remembered".
function readSavedTargets(): Targets {
  let parsed: unknown
  try {
    parsed = JSON.parse(storage()?.getItem(TARGETS_KEY) ?? 'null')
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object') return {}
  const saved = parsed as { version?: unknown; targets?: unknown }
  if (saved.version !== TARGETS_VERSION || !saved.targets || typeof saved.targets !== 'object') return {}
  const targets: Targets = {}
  for (const [kind, target] of Object.entries(saved.targets)) {
    if (Object.hasOwn(EXERCISES, kind)) targets[kind as ExerciseKind] = checkedTarget(kind as ExerciseKind, target)
  }
  return targets
}

const store = createStore({ targets: readSavedTargets() })

// The target the next Start uses: the one picked, or the default
export const targetFor = (kind: ExerciseKind): Target => store.get().targets[kind] ?? defaultTarget(kind)

// The same, for a component (it redraws when the target changes)
export const useTarget = (kind: ExerciseKind): Target => store.useSelect((s) => s.targets[kind]) ?? defaultTarget(kind)

// One step up or down. Minutes go by one up to 10, then by five (15, 20 … 60),
// so a long run is a few taps away.
function step(part: TargetPart, value: number, direction: -1 | 1) {
  if (part !== 'minutes') return value + direction
  if (direction > 0) return value < 10 ? value + 1 : (Math.floor(value / 5) + 1) * 5
  return value <= 10 ? value - 1 : (Math.ceil(value / 5) - 1) * 5
}

// The − and + of a target's steppers, never out of range. A part the exercise
// doesn't have (minutes on curls, reps on a run) changes nothing.
export function nudgeTarget(kind: ExerciseKind, part: TargetPart, direction: -1 | 1) {
  const target = targetFor(kind) as Record<TargetPart, number | undefined>
  const value = target[part]
  if (value === undefined) return
  const next = checkedTarget(kind, { ...target, [part]: fit(part, step(part, value, direction), value) })
  const targets = { ...store.get().targets, [kind]: next }
  store.set({ targets })
  try {
    storage()?.setItem(TARGETS_KEY, JSON.stringify({ version: TARGETS_VERSION, targets }))
  } catch {
    // Nothing to do: the target is still remembered until the page closes
  }
}

// "3 × 12", "1 × 10 min"
export const targetText = (target: Target) =>
  target.minutes !== undefined ? `${target.sets} × ${target.minutes} min` : `${target.sets} × ${target.reps}`

// The same in words, for screen readers: "3 sets of 12 reps", "1 set of 10 minutes"
export function targetWords(target: Target) {
  const sets = `${target.sets} ${target.sets === 1 ? 'set' : 'sets'}`
  return target.minutes !== undefined
    ? `${sets} of ${target.minutes} ${target.minutes === 1 ? 'minute' : 'minutes'}`
    : `${sets} of ${target.reps} ${target.reps === 1 ? 'rep' : 'reps'}`
}

// Another Amygo window picked a target: take its picks, as the weights do
export function followTargets(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window) {
  const onChange = (event: Event) => {
    const { key } = event as StorageEvent
    if (key === TARGETS_KEY || key === null) store.set({ targets: readSavedTargets() }) // (null: storage was cleared)
  }
  target.addEventListener('storage', onChange)
  return () => target.removeEventListener('storage', onChange)
}
