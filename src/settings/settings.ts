// Workout settings (v10, decision V10-D1): the tempo, how long the partner takes
// for one rep; how long to rest between sets; and whether the rest's end beeps
// and buzzes. Shown in a Workout settings section at the bottom of the Exercises
// page until a Settings tab exists. Saved in this browser under gym3d.settings,
// the key the Settings tab (N1) planned for its own choices too, so saving keeps
// whatever else is stored under it. Read the same careful way as the weights: a
// choice that doesn't check out falls back to its default, alone.
import { createStore } from '../lib/store'
import { storage } from '../lib/storage'

export const SETTINGS_KEY = 'gym3d.settings'

// Seconds per rep, there and back (decision P-D2). Normal is the rep clock's own pace.
export const TEMPOS = { slow: 3.5, normal: 2.4, fast: 1.8 }
export type Tempo = keyof typeof TEMPOS
export const TEMPO_NAMES: Record<Tempo, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' }

// Rest between sets, in seconds: one length for strength, one for cardio
// (decision P-D4: 90 s and 60 s), from 15 s to 5 minutes in steps of 15 s
export type RestKind = 'strength' | 'cardio'
export const REST_RANGE = { min: 15, max: 300, step: 15 }

export type Settings = { tempo: Tempo; rest: Record<RestKind, number>; beep: boolean; buzz: boolean }
export const DEFAULT_SETTINGS: Settings = { tempo: 'normal', rest: { strength: 90, cardio: 60 }, beep: true, buzz: true }

const isTempo = (value: unknown): value is Tempo => typeof value === 'string' && Object.hasOwn(TEMPOS, value)
const isRest = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) >= REST_RANGE.min &&
  (value as number) <= REST_RANGE.max &&
  (value as number) % REST_RANGE.step === 0

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
  const rest = (saved.rest && typeof saved.rest === 'object' ? saved.rest : {}) as Record<string, unknown>
  const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
  return {
    tempo: isTempo(saved.tempo) ? saved.tempo : DEFAULT_SETTINGS.tempo,
    rest: {
      strength: isRest(rest.strength) ? rest.strength : DEFAULT_SETTINGS.rest.strength,
      cardio: isRest(rest.cardio) ? rest.cardio : DEFAULT_SETTINGS.rest.cardio,
    },
    beep: flag(saved.beep, DEFAULT_SETTINGS.beep),
    buzz: flag(saved.buzz, DEFAULT_SETTINGS.buzz),
  }
}

const store = createStore({ settings: checkedSettings(readSaved()) })

export const getSettings = () => store.get().settings
// One setting in a component: const tempo = useSettings((s) => s.tempo)
export const useSettings = <S>(select: (s: Settings) => S) => store.useSelect((s) => select(s.settings))

// How long one rep takes at the chosen tempo. A set copies this when it starts
// and keeps it, so changing the tempo mid-set never makes its count jump.
export const repSecondsNow = () => TEMPOS[getSettings().tempo]

// Take a change, and save it
function save(settings: Settings) {
  store.set({ settings })
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify({ ...readSaved(), ...settings }))
  } catch {
    // Nothing to do: the choice still holds until the page closes
  }
}

export function setTempo(tempo: Tempo) {
  if (isTempo(tempo)) save({ ...getSettings(), tempo })
}

// The rest steppers' − and +: 15 s shorter or longer, never out of range
export function nudgeRest(kind: RestKind, direction: -1 | 1) {
  const settings = getSettings()
  const seconds = settings.rest[kind] + direction * REST_RANGE.step
  if (!isRest(seconds)) return
  save({ ...settings, rest: { ...settings.rest, [kind]: seconds } })
}

export const setBeep = (beep: boolean) => save({ ...getSettings(), beep })
export const setBuzz = (buzz: boolean) => save({ ...getSettings(), buzz })

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
