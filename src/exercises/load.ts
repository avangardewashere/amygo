// The rules for an exercise's weight: its steps, its range, and how it's
// written. Plain maths and text (no saving, no React), read from the catalog's
// `load` table, so the stepper, the gym and the log can't disagree.
import { EXERCISES, type ExerciseKind, type Load } from './catalog'

// An exercise's weight settings, or undefined if it has none (cardio, pull-ups)
export const loadOf = (kind: ExerciseKind): Load | undefined => EXERCISES[kind].load

// A weight brought into an exercise's range and onto one of its steps
// (20, 22.5, 25… for the bar). Anything that isn't a number becomes the minimum.
export function fitKg(load: Load, kg: unknown) {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return load.min
  const steps = Math.round((kg - load.min) / load.step)
  return Math.min(load.max, Math.max(load.min, load.min + steps * load.step))
}

// One step lighter (-1) or heavier (+1), never past the ends of the range
export const stepKg = (load: Load, kg: number, direction: -1 | 1) => fitKg(load, fitKg(load, kg) + direction * load.step)

// "10 kg", "22.5 kg"
export const kgText = (kg: number) => `${Math.round(kg * 100) / 100} kg`

// What the number means on each kind of kit (read out with the stepper)
export const LOAD_MEANS: Record<Load['of'], string> = {
  dumbbell: 'each dumbbell',
  stack: "the machine's stack",
  bar: 'the bar with its plates',
}
