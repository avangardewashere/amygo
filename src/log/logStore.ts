// The workout log: every finished set, loaded from this browser at start and
// saved after every change. startLogging() watches the gym and saves a set
// whenever an exercise ends, however it ends (Stop, E, walking away, build
// mode, Finish, or starting something else), or changes pace. A saved set can
// be fixed (editSet) or removed, and a Remove can be undone for a few seconds.
import { createStore } from '../lib/store'
import type { ExerciseKind } from '../exercises/catalog'
import { setLastUsed, type Weights } from '../exercises/weights'
import { getGym, subscribeGym } from '../interaction/gymStore'
import { downloadFile } from '../lib/files'
import { LOG_KEY, readSavedLog, saveLog } from './logStorage'
import { backedUpText, backupName, backupText, CANT_READ, MAX_BACKUP_BYTES, readBackup, TOO_BIG, type Restored } from './backup'
import { applyEdit, changesNothing, type SetEdit } from './edit'
import { finishedPart, keepNewest, lastSets, mergeSets, type LoggedSet, type NewSet } from './sets'

// sets: the log. removed: sets just taken out of it, kept aside while their
// Undo is on offer (never saved: the log itself already has them gone).
const store = createStore({ sets: readSavedLog(), removed: [] as LoggedSet[] })

// The weight picker is told what each exercise was last done with, so a row with
// no weight picked in this browser starts from there (say, after a restore)
function tellWeights(sets: LoggedSet[]) {
  const last: Weights = {}
  for (const [kind, set] of Object.entries(lastSets(sets))) {
    if (set?.kg !== undefined) last[kind as ExerciseKind] = set.kg
  }
  setLastUsed(last)
}
tellWeights(store.get().sets)

// The log as it now is, everywhere it's shown. A set that is in it again (put
// back by a restore, or by another window) is no longer one of the removed.
function show(sets: LoggedSet[]) {
  const ids = new Set(sets.map((set) => set.id))
  for (const set of store.get().removed) if (ids.has(set.id)) forget(set.id)
  store.set({ sets })
  tellWeights(sets)
}

export const useLog = <S>(select: (s: { sets: LoggedSet[]; removed: LoggedSet[] }) => S) => store.useSelect(select)
export const getLog = store.get
// Be told whenever the log changes (the pages' clock uses this; see shell/clock.ts)
export const subscribeLog = store.subscribe

let made = 0
// An id that stays unique in this browser (crypto.randomUUID needs https,
// which a phone opening the laptop's address over Wi-Fi doesn't have)
const newId = (endedAt: number) => `${endedAt.toString(36)}-${(made++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// Show the new log at once, then save it (returns whether it was saved)
function update(sets: LoggedSet[]) {
  show(sets)
  return saveLog(sets)
}

// The most sets kept (decision D6: years of use, about 500 KB); past it, the oldest go first
export const MAX_SETS = 5000

export function recordSet(set: NewSet): LoggedSet {
  const saved = { id: newId(set.endedAt), ...set }
  update(keepNewest([...store.get().sets, saved], MAX_SETS))
  return saved
}

// How long Undo stays on offer after Remove (decision D8)
export const UNDO_SECONDS = 6
const undoTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Stop offering Undo for a removed set: it's gone for good
function forget(id: string) {
  clearTimeout(undoTimers.get(id))
  undoTimers.delete(id)
  const { removed } = store.get()
  if (removed.some((set) => set.id === id)) store.set({ removed: removed.filter((set) => set.id !== id) })
}

// Remove takes the set out of the log at once (and saves that), and keeps it
// aside for six seconds in case it was the wrong row: each removed set has its
// own Undo and its own six seconds.
export function removeSet(id: string) {
  const { sets, removed } = store.get()
  const set = sets.find((candidate) => candidate.id === id)
  if (!set) return
  store.set({ removed: [...removed, set] })
  undoTimers.set(id, setTimeout(() => forget(id), UNDO_SECONDS * 1000))
  update(sets.filter((candidate) => candidate !== set))
}

// Undo: the set goes back as it was, same id, and so into the same place (the
// lists are in time order). Returns whether there was anything to undo.
export function undoRemove(id: string) {
  const set = store.get().removed.find((candidate) => candidate.id === id)
  if (!set) return false
  forget(id)
  const { sets } = store.get()
  // (if another window has put it back meanwhile, it's kept once)
  if (!sets.some((candidate) => candidate.id === id)) {
    update(keepNewest([...sets, set].sort((a, b) => a.endedAt - b.endedAt), MAX_SETS))
  }
  return true
}

// Leaving the page: whatever was removed stays removed, with no Undo left
export function forgetRemoved() {
  for (const set of [...store.get().removed]) forget(set.id)
  flippedAt.clear()
}

// A row's Remove and Undo buttons sit in the same spot, one replacing the other,
// so the second tap of a double-tap would land on the opposite one and take the
// first back. For a moment after one of them, the other is ignored. Timed on
// the page's steady clock, not the time of day, which can be set back.
// (`now` is for tests.) Each returns whether the tap did anything.
export const FLIP_PAUSE_MS = 600
const flippedAt = new Map<string, number>()
const tooSoon = (id: string, now: number) => now - (flippedAt.get(id) ?? -Infinity) < FLIP_PAUSE_MS

export function tapRemove(id: string, now = performance.now()) {
  if (tooSoon(id, now) || !store.get().sets.some((set) => set.id === id)) return false
  flippedAt.set(id, now)
  removeSet(id)
  return true
}

export function tapUndo(id: string, now = performance.now()) {
  if (tooSoon(id, now)) return false
  flippedAt.set(id, now)
  return undoRemove(id)
}

// Fix a set's numbers (edit.ts has the rules; the form checks them first).
// Returns the set as it now is, or null if it isn't in the log.
export function editSet(id: string, edit: SetEdit) {
  const { sets } = store.get()
  const set = sets.find((candidate) => candidate.id === id)
  if (!set) return null
  if (changesNothing(edit)) return set // nothing to save
  const fixed = applyEdit(set, edit)
  update(sets.map((candidate) => (candidate === set ? fixed : candidate)))
  return fixed
}

export const CLEAR_QUESTION = "Delete every saved set? This can't be undone."

// Clear history can't be undone, so it asks first. Returns whether it cleared.
// (`ask` is the browser's own yes/no box; tests answer it themselves.)
export function clearHistory(ask: (question: string) => boolean = (question) => window.confirm(question)) {
  if (!ask(CLEAR_QUESTION)) return false
  forgetRemoved()
  update([])
  return true
}

// Back up: the whole log (every day, not just today) as a file, handed to the
// browser's own download. Returns the line to show under the buttons.
export function backUpLog(now: number, download = downloadFile) {
  const { sets } = store.get()
  const name = backupName(now)
  download(name, backupText(sets, now))
  return backedUpText(sets.length, name)
}

// Restore a backup's text (decision D3: always a merge, so nothing here is ever
// lost or doubled). A file that isn't a backup changes nothing. The counts are
// taken after the 5,000 cap, so "added" means sets that are really in the log now.
export function restoreBackup(text: string): Restored | { reason: string } {
  const backup = readBackup(text)
  if (!backup.ok) return { reason: backup.reason }
  const here = store.get().sets
  const merged = mergeSets(here, backup.sets)
  const sets = keepNewest(merged.sets, MAX_SETS)
  const kept = new Set(sets.map((set) => set.id))
  const added = merged.added.filter((set) => kept.has(set.id)).length
  const dropped = here.filter((set) => !kept.has(set.id)).length // this browser's own, let go for room
  // (Nothing changed: nothing to show or save)
  const saved = added || dropped ? update(sets) : true
  return {
    added,
    already: merged.already,
    skipped: backup.skipped,
    tooOld: merged.added.length - added, // the file's, older than all 5,000 kept
    dropped,
    saved,
    madeAt: backup.madeAt,
  }
}

// Restore from a file the person picked (anything too big to be ours isn't read)
export async function restoreFile(file: Blob) {
  if (file.size > MAX_BACKUP_BYTES) return { reason: TOO_BIG }
  let text: string
  try {
    text = await file.text()
  } catch {
    return { reason: CANT_READ }
  }
  return restoreBackup(text)
}

// Another Amygo window (the installed app and a Chrome tab share this
// browser's storage) saved a change: take it, so this window's next save
// starts from it instead of writing over it (say, over a restore made there)
export function followOtherWindows(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window) {
  const onChange = (event: Event) => {
    const { key } = event as StorageEvent
    if (key === LOG_KEY || key === null) show(readSavedLog()) // (null: storage was cleared)
  }
  target.addEventListener('storage', onChange)
  return () => target.removeEventListener('storage', onChange)
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
