// What the Exercises list shows, worked out from the catalog and the layout.
// Like the catalog, no 3D code here.
import { EXERCISES, MACHINE_NAMES, type ExerciseKind, type MachineType } from './catalog'

type Placed = { id: string; type: MachineType; x: number; z: number }

export type ExerciseGroup = {
  machine: MachineType
  name: string
  available: boolean // is one of these machines in the gym right now?
  exercises: ExerciseKind[]
}

// Every exercise, under its machine, in the catalog's machine order
export function exerciseGroups(items: Pick<Placed, 'type'>[]): ExerciseGroup[] {
  const kinds = Object.keys(EXERCISES) as ExerciseKind[]
  return (Object.keys(MACHINE_NAMES) as MachineType[]).map((machine) => ({
    machine,
    name: MACHINE_NAMES[machine],
    available: items.some((item) => item.type === machine),
    exercises: kinds.filter((kind) => EXERCISES[kind].machine === machine),
  }))
}

// The machine of a type closest to a spot (the person), or null if there's none
export function nearestMachine<T extends Placed>(type: MachineType, items: T[], from: { x: number; z: number }): T | null {
  let best: T | null = null
  let bestDistance = Infinity
  for (const item of items) {
    if (item.type !== type) continue
    const distance = Math.hypot(item.x - from.x, item.z - from.z)
    if (distance < bestDistance) {
      best = item
      bestDistance = distance
    }
  }
  return best
}
