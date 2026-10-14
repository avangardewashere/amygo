import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import {
  nudgeTarget,
  TARGET_RANGES,
  targetFor,
  targetText,
  targetWords,
  useTarget,
  type TargetPart,
} from '../exercises/targets'
import { useGym } from '../interaction/gymStore'
import { say } from './said'
import { toggleTarget, useTargetOpen } from './targetOpen'
import { Stepper } from './WeightStepper'

// The target beside the weight (v10): a "3 × 12" button that opens − / +
// steppers for the sets and the reps (or minutes) underneath. One open at a time.

// Where the picker is (the list, or an exercise's own page over it), so the two
// copies' ids differ
type Place = 'list' | 'history'
const editorId = (kind: ExerciseKind, place: Place) => `target-${place}-${kind}`

// The target of the round of this exercise that's going on (a set of it, or the
// pause between two), if any. It holds until the round is over, as a set holds
// its weight, so that's the one shown.
const useShownTarget = (kind: ExerciseKind) => {
  const picked = useTarget(kind)
  const round = useGym((s) =>
    s.activity?.kind === kind ? s.activity.target : s.between?.kind === kind ? s.between.target : undefined,
  )
  return { target: round ?? picked, locked: round !== undefined }
}

export function TargetChip({ kind, place }: { kind: ExerciseKind; place: Place }) {
  const { target } = useShownTarget(kind)
  const isOpen = useTargetOpen(kind)
  return (
    <button
      type="button"
      className="list-button target-chip"
      aria-label={`${targetText(target)}: target for ${EXERCISES[kind].name}, ${targetWords(target)}`}
      aria-expanded={isOpen}
      aria-controls={isOpen ? editorId(kind, place) : undefined}
      onClick={() => toggleTarget(kind)}
    >
      {targetText(target)}
    </button>
  )
}

const WORDS: Record<TargetPart, { title: string; one: string; many: string; less: string; more: string }> = {
  sets: { title: 'Sets', one: 'set', many: 'sets', less: 'Fewer sets', more: 'More sets' },
  reps: { title: 'Reps', one: 'rep', many: 'reps', less: 'Fewer reps', more: 'More reps' },
  minutes: { title: 'Minutes', one: 'min', many: 'min', less: 'Shorter', more: 'Longer' },
}

// Why a target's buttons are off while its round goes on
const LOCKED_NOTE = 'Kept for this round. Change it after Finish.'

// The steppers, while the chip is open: "− 3 sets +" and "− 12 reps +" (or "− 10 min +")
export function TargetEditor({ kind, place }: { kind: ExerciseKind; place: Place }) {
  const { target, locked } = useShownTarget(kind)
  const isOpen = useTargetOpen(kind)
  if (!isOpen) return null
  const { name } = EXERCISES[kind]
  const stepper = (part: TargetPart, value: number) => {
    const words = WORDS[part]
    return (
      <Stepper
        className="target-stepper"
        valueClass="target-value"
        label={`${words.title} for ${name}`}
        value={`${value} ${value === 1 ? words.one : words.many}`}
        less={{ label: `${words.less}: ${name}`, disabled: locked || value <= TARGET_RANGES[part].min }}
        more={{ label: `${words.more}: ${name}`, disabled: locked || value >= TARGET_RANGES[part].max }}
        onNudge={(direction) => {
          nudgeTarget(kind, part, direction)
          say(`${name} ${targetWords(targetFor(kind))}`)
        }}
      />
    )
  }
  const why = `${editorId(kind, place)}-why`
  return (
    <div
      className="target-editor"
      id={editorId(kind, place)}
      role="group"
      aria-label={`Target for ${name}`}
      aria-describedby={locked ? why : undefined}
    >
      {stepper('sets', target.sets)}
      {target.minutes !== undefined ? stepper('minutes', target.minutes) : stepper('reps', target.reps)}
      {locked && (
        <small id={why} className="last-line target-why">
          {LOCKED_NOTE}
        </small>
      )}
    </div>
  )
}
