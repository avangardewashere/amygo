// Workout settings (v10, decision V10-D1): for now the tempo, how long the
// partner takes for one rep. Shown in a Workout settings section at the bottom
// of the Exercises page until a Settings tab exists. Saved in this browser under
// gym3d.settings, the key the Settings tab (N1) planned for its own choices too,
// so saving keeps whatever else is stored under it. Read the same careful way as
// the weights: a choice that doesn't check out falls back to its default, alone.
import { createStore } from '../lib/store'
import { storage } from '../lib/storage'

export const SETTINGS_KEY = 'gym3d.settings'

// Seconds per rep, there and back (decision P-D2). Normal is the rep clock's own pace.
export const TEMPOS = { slow: 3.5, normal: 2.4, fast: 1.8 }
export type Tempo = keyof typeof TEMPOS
export const TEMPO_NAMES: Record<Tempo, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' }

export type Settings = { tempo: Tempo }
export const DEFAULT_SETTINGS: Settings = { tempo: 'normal' }

const isTempo = (value: unknown): value is Tempo => typeof value === 'string' && Object.hasOwn(TEMPOS, value)

// Everything saved under the key, as it is (the Settings tab's choices included),
// or nothing if it can't be read
function readSaved(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(SETTINGS_KEY) ?? 'null')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// The settings in what was saved: each one that checks out, the default for the rest
function checkedSettings(saved: Record<string, unknown>): Settings {
  return { tempo: isTempo(saved.tempo) ? saved.tempo : DEFAULT_SETTINGS.tempo }
}

const store = createStore({ settings: checkedSettings(readSaved()) })

export const getSettings = () => store.get().settings
// One setting in a component: const tempo = useSettings((s) => s.tempo)
export const useSettings = <S>(select: (s: Settings) => S) => store.useSelect((s) => select(s.settings))

// How long one rep takes at the chosen tempo. A set copies this when it starts
// and keeps it, so changing the tempo mid-set never makes its count jump.
export const repSecondsNow = () => TEMPOS[getSettings().tempo]

export function setTempo(tempo: Tempo) {
  if (!isTempo(tempo)) return
  const settings = { ...getSettings(), tempo }
  store.set({ settings })
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify({ ...readSaved(), ...settings }))
  } catch {
    // Nothing to do: the choice still holds until the page closes
  }
}

// Another Amygo window (the installed app and a Chrome tab share this browser's
// storage) changed a setting: take it, as the weights do
export function followSettings(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window) {
  const onChange = (event: Event) => {
    const { key } = event as StorageEvent
    if (key === SETTINGS_KEY || key === null) store.set({ settings: checkedSettings(readSaved()) }) // (null: storage was cleared)
  }
  target.addEventListener('storage', onChange)
  return () => target.removeEventListener('storage', onChange)
}
