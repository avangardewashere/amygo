import { useEffect } from 'react'
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { kgText, LOAD_MEANS, loadOf } from '../exercises/load'
import { useGym } from '../interaction/gymStore'
import { kgFor, nudgeKg, useKg } from '../exercises/weights'
import { said, say } from './said'

// The one line that reads a weight or target change out, once per page. It starts
// empty and the steppers show plain numbers: text already inside a status line when
// it appears can be read out too, and there are eleven steppers on the list.
export function WeightAnnouncer() {
  const text = said.useSelect((s) => s.text)
  useEffect(() => () => said.set({ text: '' }), []) // (leaving the page: nothing left to read out next time)
  return (
    <p className="visually-hidden" role="status">
      {text}
    </p>
  )
}

type Side = { label: string; disabled: boolean }

// A "− value +" picker: the weight beside Start, and a target's sets and reps.
// `label` names the group; each button has its own name ("Lighter: Bicep curls").
export function Stepper(props: {
  className: string
  valueClass: string
  label: string
  value: string
  less: Side
  more: Side
  onNudge: (direction: -1 | 1) => void
}) {
  const { className, valueClass, label, value, less, more, onNudge } = props
  return (
    <div className={className} role="group" aria-label={label}>
      <button type="button" className="list-button" aria-label={less.label} disabled={less.disabled} onClick={() => onNudge(-1)}>
        −
      </button>
      <span className={valueClass}>{value}</span>
      <button type="button" className="list-button" aria-label={more.label} disabled={more.disabled} onClick={() => onNudge(1)}>
        +
      </button>
    </div>
  )
}

// The "− 10 kg +" picker beside Start on a strength exercise (decision D7): the
// weight the next Start uses, remembered per exercise, so the usual case is one
// tap. Draws nothing for exercises without a weight (cardio, pull-ups).
// `locked`: this exercise is being done, and a set keeps the weight it started
// with; so that's the number shown, whatever the log or another window does meanwhile.
export function WeightStepper({ kind, locked = false }: { kind: ExerciseKind; locked?: boolean }) {
  const picked = useKg(kind)
  const doingKg = useGym((s) => (s.activity?.kind === kind ? s.activity.kg : undefined))
  const kg = locked && doingKg !== undefined ? doingKg : picked
  const load = loadOf(kind)
  if (!load || kg === undefined) return null
  const { name } = EXERCISES[kind]
  return (
    <Stepper
      className="weight-stepper"
      valueClass="weight-kg"
      label={`Weight for ${name} (${LOAD_MEANS[load.of]})`}
      value={kgText(kg)}
      less={{ label: `Lighter: ${name}`, disabled: locked || kg <= load.min }}
      more={{ label: `Heavier: ${name}`, disabled: locked || kg >= load.max }}
      onNudge={(direction) => {
        nudgeKg(kind, direction)
        say(`${name} ${kgText(kgFor(kind)!)}`)
      }}
    />
  )
}
