// Keeping the workout log between visits, in this browser only (localStorage),
// the same careful way as the furniture layout (build/layoutStorage.ts):
// saving never breaks the app, and saved data is checked before it's trusted.
// Each saved set is checked on its own (checkedSets in sets.ts, which backups use
// too), so one damaged entry doesn't cost the rest.
import { checkedSets, type LoggedSet } from './sets'
import { storage } from '../lib/storage'

export const LOG_KEY = 'gym3d.log'
export const LOG_VERSION = 1

// Save quietly: if storage is full or blocked, the sets are still listed until
// the page closes. Returns whether it was saved.
export function saveLog(sets: LoggedSet[]) {
  try {
    const saved = storage()
    saved?.setItem(LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets }))
    return saved !== null
  } catch {
    return false // Nothing to do: the log is kept in memory for this visit
  }
}

// The saved sets that check out (oldest first, as saved). Anything unreadable
// (no storage, not JSON, another version) means an empty log, never a crash.
export function readSavedLog(): LoggedSet[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(storage()?.getItem(LOG_KEY) ?? 'null')
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const saved = parsed as { version?: unknown; sets?: unknown }
  if (saved.version !== LOG_VERSION || !Array.isArray(saved.sets)) return []
  return checkedSets(saved.sets).sets // (a repeated id is kept once)
}
