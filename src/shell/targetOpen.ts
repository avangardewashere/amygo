import type { ExerciseKind } from '../exercises/catalog'
import { createStore } from '../lib/store'

// Which exercise's target steppers are open, under its "3 × 12" button: one at a time
const open = createStore({ kind: null as ExerciseKind | null })
export const useTargetOpen = (kind: ExerciseKind) => open.useSelect((s) => s.kind === kind)
export const toggleTarget = (kind: ExerciseKind) => open.set({ kind: open.get().kind === kind ? null : kind })
