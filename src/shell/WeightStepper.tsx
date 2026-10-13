import { useEffect } from 'react'
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { kgText, LOAD_MEANS, loadOf } from '../exercises/load'
import { useGym } from '../interaction/gymStore'
import { createStore } from '../lib/store'
import { kgFor, nudgeKg, useKg } from '../exercises/weights'

// What the last tap on a − or + changed, for screen readers: "Bicep curls 11 kg"
const said = createStore({ text: '' })

// The one line that reads a weight change out, once per page. It starts empty
// and the steppers show plain numbers: text already inside a status line when it
// appears can be read out too, and there are eleven steppers on the list.
export function WeightAnnouncer() {
  const text = said.useSelect((s) => s.text)
  useEffect(() => () => said.set({ text: '' }), []) // (leaving the page: nothing left to read out next time)
  return (
    <p className="visually-hidden" role="status">
      {text}
    </p>
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
  const nudge = (direction: -1 | 1) => {
    nudgeKg(kind, direction)
    said.set({ text: `${name} ${kgText(kgFor(kind)!)}` })
  }
  return (
    <div className="weight-stepper" role="group" aria-label={`Weight for ${name} (${LOAD_MEANS[load.of]})`}>
      <button
        type="button"
        className="list-button"
        aria-label={`Lighter: ${name}`}
        disabled={locked || kg <= load.min}
        onClick={() => nudge(-1)}
      >
        −
      </button>
      <span className="weight-kg">{kgText(kg)}</span>
      <button
        type="button"
        className="list-button"
        aria-label={`Heavier: ${name}`}
        disabled={locked || kg >= load.max}
        onClick={() => nudge(1)}
      >
        +
      </button>
    </div>
  )
}
