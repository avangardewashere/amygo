// The workout log: every finished set, loaded from this browser at start and
// saved after every change. startLogging() watches the gym and saves a set
// whenever an exercise ends, however it ends (Stop, E, walking away, build
// mode, Finish, or starting something else), or changes pace.
import { createStore } from '../lib/store'
import { getGym, subscribeGym } from '../interaction/gymStore'
import { readSavedLog, saveLog } from './logStorage'
import { finishedPart, type LoggedSet, type NewSet } from './sets'

const store = createStore({ sets: readSavedLog() })

export const useLog = <S>(select: (s: { sets: LoggedSet[] }) => S) => store.useSelect(select)
export const getLog = store.get
// Be told whenever the log changes (the pages' clock uses this; see shell/clock.ts)
export const subscribeLog = store.subscribe

let made = 0
// An id that stays unique in this browser (crypto.randomUUID needs https,
// which a phone opening the laptop's address over Wi-Fi doesn't have)
const newId = (endedAt: number) => `${endedAt.toString(36)}-${(made++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

function update(sets: LoggedSet[]) {
  store.set({ sets })
  saveLog(sets)
}

// The most sets kept (decision D6: years of use, about 500 KB); past it, the oldest go first
export const MAX_SETS = 5000

export function recordSet(set: NewSet): LoggedSet {
  const saved = { id: newId(set.endedAt), ...set }
  let sets = [...store.get().sets, saved]
  if (sets.length > MAX_SETS) sets = sets.sort((a, b) => a.endedAt - b.endedAt).slice(-MAX_SETS)
  update(sets)
  return saved
}

export function removeSet(id: string) {
  update(store.get().sets.filter((set) => set.id !== id))
}

export const CLEAR_QUESTION = "Delete every saved set? This can't be undone."

// Clear history can't be undone, so it asks first. Returns whether it cleared.
// (`ask` is the browser's own yes/no box; tests answer it themselves.)
export function clearHistory(ask: (question: string) => boolean = (question) => window.confirm(question)) {
  if (!ask(CLEAR_QUESTION)) return false
  update([])
  return true
}

let stopWatching: (() => void) | null = null

// Start saving sets as they finish (once; calling again changes nothing).
// Returns a function that stops it.
export function startLogging() {
  if (stopWatching) return stopWatching
  let previous = getGym().activity
  const unsubscribe = subscribeGym(() => {
    const current = getGym().activity
    if (current === previous) return
    const before = previous
    previous = current
    if (!before) return // something started: nothing finished yet
    const ended = current?.session !== before.session
    const newPace = !ended && current!.kind !== before.kind
    if (!ended && !newPace) return // the same set carrying on (e.g. arriving on the machine)
    // At a change of pace, the old pace ends exactly where the new one begins
    const now = newPace ? current!.pace!.since : performance.now()
    const set = finishedPart(before, now, Date.now())
    if (set) recordSet(set)
  })
  stopWatching = () => {
    unsubscribe()
    stopWatching = null
  }
  return stopWatching
}
