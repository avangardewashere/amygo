import { setTempo, TEMPO_NAMES, TEMPOS, useSettings, type Tempo } from '../settings/settings'

// Workout settings (decision V10-D1), at the bottom of the Exercises page until
// there's a Settings tab: for now the tempo, how long the partner takes for one rep
export function WorkoutSettings() {
  const tempo = useSettings((s) => s.tempo)
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
    </section>
  )
}
