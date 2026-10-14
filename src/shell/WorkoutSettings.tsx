import { clock } from '../interaction/activityText'
import {
  getSettings,
  nudgeRest,
  REST_RANGE,
  setBeep,
  setBuzz,
  setTempo,
  TEMPO_NAMES,
  TEMPOS,
  useSettings,
  type RestKind,
  type Tempo,
} from '../settings/settings'
import { primeSound } from '../workout/cues'
import { say } from './said'
import { Stepper } from './WeightStepper'

const REST_NAMES: Record<RestKind, string> = { strength: 'Strength', cardio: 'Cardio' }

// Workout settings (decision V10-D1), at the bottom of the Exercises page until
// there's a Settings tab: the tempo (how long the partner takes for one rep), the
// rest between sets, and whether the rest's end beeps and buzzes
export function WorkoutSettings() {
  const tempo = useSettings((s) => s.tempo)
  const rest = useSettings((s) => s.rest)
  const beep = useSettings((s) => s.beep)
  const buzz = useSettings((s) => s.buzz)
  return (
    <section className="workout-settings" aria-labelledby="workout-settings-title">
      <h3 id="workout-settings-title">Workout settings</h3>
      <div className="setting-row">
        <span id="tempo-label">Tempo</span>
        <div className="segmented" role="group" aria-labelledby="tempo-label">
          {(Object.keys(TEMPOS) as Tempo[]).map((choice) => (
            <button
              key={choice}
              type="button"
              className="list-button"
              aria-pressed={choice === tempo}
              onClick={() => setTempo(choice)}
            >
              {TEMPO_NAMES[choice]}
            </button>
          ))}
        </div>
      </div>
      <p className="page-note">One rep takes {TEMPOS[tempo]} s. A set keeps the tempo it started with.</p>
      <div className="setting-row">
        <span>Rest between sets</span>
        <div className="rest-choices">
          {(Object.keys(REST_NAMES) as RestKind[]).map((kind) => (
            <div key={kind} className="rest-choice">
              <span>{REST_NAMES[kind]}</span>
              <Stepper
                className="target-stepper"
                valueClass="target-value"
                label={`Rest after a ${kind} set`}
                value={clock(rest[kind])}
                less={{ label: `Shorter rest: ${kind}`, disabled: rest[kind] <= REST_RANGE.min }}
                more={{ label: `Longer rest: ${kind}`, disabled: rest[kind] >= REST_RANGE.max }}
                onNudge={(direction) => {
                  nudgeRest(kind, direction)
                  say(`Rest after a ${kind} set ${clock(getSettings().rest[kind])}`)
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={beep}
          onChange={(event) => {
            setBeep(event.target.checked)
            primeSound() // (a tap: the one chance to make the sound ready, for the rest going on too)
          }}
        />
        Beep when a rest is over
      </label>
      <label className="setting-toggle">
        <input type="checkbox" checked={buzz} onChange={(event) => setBuzz(event.target.checked)} />
        Buzz when a rest is over <small className="last-line">(on phones that can, like Android)</small>
      </label>
    </section>
  )
}
