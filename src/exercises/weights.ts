// The weight picked for each exercise (decision D7: chosen on the Exercises row
// before Start, and remembered). Kept in this browser only, the same careful way
// as the layout and the log: saving never breaks the app, and what was saved is
// checked before it's trusted.
import { createStore } from '../lib/store'
import { storage } from '../lib/storage'
import { EXERCISES, type ExerciseKind } from './catalog'
import { fitKg, loadOf, stepKg } from './load'

export const WEIGHTS_KEY = 'gym3d.weights'
export const WEIGHTS_VERSION = 1

export type Weights = Partial<Record<ExerciseKind, number>>

// Weights that check out: known exercises that take a weight, each brought into
// its range and onto a step. Anything else is left out.
function checkedWeights(entries: object): Weights {
  const weights: Weights = {}
  for (const [kind, kg] of Object.entries(entries)) {
    if (!Object.hasOwn(EXERCISES, kind)) continue
    const load = loadOf(kind as ExerciseKind)
    if (load && typeof kg === 'number' && Number.isFinite(kg)) weights[kind as ExerciseKind] = fitKg(load, kg)
  }
  return weights
}

// The saved picks. Anything unreadable just means "none remembered".
function readSavedWeights(): Weights {
  let parsed: unknown
  try {
    parsed = JSON.parse(storage()?.getItem(WEIGHTS_KEY) ?? 'null')
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object') return {}
  const saved = parsed as { version?: unknown; kg?: unknown }
  if (saved.version !== WEIGHTS_VERSION || !saved.kg || typeof saved.kg !== 'object') return {}
  return checkedWeights(saved.kg)
}

// kg: what was picked here (and saved). lastUsed: the weight of each exercise's
// most recent logged set, told by the log (see logStore.ts); never saved, since
// the log already holds it.
const store = createStore({ kg: readSavedWeights(), lastUsed: {} as Weights })

// Be told whenever a weight changes (the stepper redraws through useKg)
export const subscribeWeights = store.subscribe

// The weight an exercise will be started with: the one picked for it; if none
// was picked in this browser, the one its last logged set used (so a log
// restored into a new browser brings its weights along); the first time ever,
// its minimum. undefined for exercises without a weight (cardio, pull-ups).
export function kgFor(kind: ExerciseKind) {
  const load = loadOf(kind)
  if (!load) return undefined
  const { kg, lastUsed } = store.get()
  return kg[kind] ?? lastUsed[kind] ?? load.min
}

// The same, for a component (it redraws when the weight changes)
export const useKg = (kind: ExerciseKind) => {
  const known = store.useSelect((s) => s.kg[kind] ?? s.lastUsed[kind])
  const load = loadOf(kind)
  return load ? (known ?? load.min) : undefined
}

// Pick a weight: brought into the exercise's range and onto its steps, then
// remembered. Nothing happens for an exercise without a weight.
export function setKg(kind: ExerciseKind, kg: number) {
  const load = loadOf(kind)
  if (!load) return
  const weights = { ...store.get().kg, [kind]: fitKg(load, kg) }
  store.set({ kg: weights })
  try {
    storage()?.setItem(WEIGHTS_KEY, JSON.stringify({ version: WEIGHTS_VERSION, kg: weights }))
  } catch {
    // Nothing to do: the weight is still remembered until the page closes
  }
}

// The stepper's − and +: one step lighter or heavier, never out of range
export function nudgeKg(kind: ExerciseKind, direction: -1 | 1) {
  const load = loadOf(kind)
  if (load) setKg(kind, stepKg(load, kgFor(kind)!, direction))
}

// The log says which weight each exercise was last done with (at the start,
// and whenever the log changes: a set finished, a backup restored)
export function setLastUsed(last: Weights) {
  store.set({ lastUsed: checkedWeights(last) })
}

// Another Amygo window (the installed app and a Chrome tab share this browser's
// storage) picked a weight: take its picks, so this window shows them, and its
// next pick is saved on top of them instead of over them
export function followWeights(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window) {
  const onChange = (event: Event) => {
    const { key } = event as StorageEvent
    if (key === WEIGHTS_KEY || key === null) store.set({ kg: readSavedWeights() }) // (null: storage was cleared)
  }
  target.addEventListener('storage', onChange)
  return () => target.removeEventListener('storage', onChange)
}
