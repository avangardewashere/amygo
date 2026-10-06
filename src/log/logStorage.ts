// Keeping the workout log between visits, in this browser only (localStorage),
// the same careful way as the furniture layout (build/layoutStorage.ts):
// saving never breaks the app, and saved data is checked before it's trusted.
// Each saved set is checked on its own, so one damaged entry doesn't cost the rest.
import { EXERCISES } from '../exercises/catalog'
import type { LoggedSet } from './sets'

export const LOG_KEY = 'gym3d.log'
export const LOG_VERSION = 1

// The browser's storage, or null where there is none (private browsing can
// block it, and even reading the property can throw)
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// Save quietly: if storage is full or blocked, the sets are still listed until the page closes
export function saveLog(sets: LoggedSet[]) {
  try {
    storage()?.setItem(LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets }))
  } catch {
    // Nothing to do: the log is kept in memory for this visit
  }
}

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0
const isAmount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0

// A saved entry that is a real set: a known exercise, a time, and the numbers
// that exercise records (reps for strength; distance for cardio; strokes too on the rower)
function isSet(entry: unknown): entry is LoggedSet {
  if (typeof entry !== 'object' || entry === null) return false
  const set = entry as Record<string, unknown>
  if (typeof set.id !== 'string' || !set.id) return false
  if (typeof set.kind !== 'string' || !Object.hasOwn(EXERCISES, set.kind)) return false
  if (!isAmount(set.endedAt) || !isAmount(set.seconds)) return false
  const { speed, strokes } = EXERCISES[set.kind as LoggedSet['kind']]
  if (!speed) return isCount(set.reps)
  if (!isAmount(set.meters)) return false
  return strokes ? isCount(set.strokes) : true
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
  const ids = new Set<string>()
  return saved.sets.filter((entry): entry is LoggedSet => {
    if (!isSet(entry) || ids.has(entry.id)) return false // (a repeated id is kept once)
    ids.add(entry.id)
    return true
  })
}
