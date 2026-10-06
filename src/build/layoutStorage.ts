// Remembering the furniture layout between visits. It's saved in this browser
// only (localStorage): nothing is sent anywhere, and another browser or device
// starts with the default layout.
//
// Saved data can't be trusted blindly: it may be damaged, from an older
// version, or name furniture that no longer exists. So it's only ever used to
// move pieces the gym already has, and anything that doesn't check out is
// ignored in favour of the starting layout.
import type { Furniture } from './buildStore'

export const LAYOUT_KEY = 'gym3d.layout'
// 2: the zoned 28-piece gym (L1). A version-1 save placed the old 11 pieces
// where they would now land on top of new ones, so it is ignored once.
export const LAYOUT_VERSION = 2

// The browser's storage, or null where there is none (private browsing can
// block it, and even reading the property can throw)
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readSavedLayout(): string | null {
  try {
    return storage()?.getItem(LAYOUT_KEY) ?? null
  } catch {
    return null
  }
}

// Save quietly: if storage is full or blocked, the gym just won't remember
export function saveLayout(items: Furniture[]) {
  try {
    const pieces = items.map(({ id, type, x, z, turns }) => ({ id, type, x, z, turns }))
    storage()?.setItem(LAYOUT_KEY, JSON.stringify({ version: LAYOUT_VERSION, items: pieces }))
  } catch {
    // Nothing to do: remembering the layout is a convenience, not a requirement
  }
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

// The starting layout with any trustworthy saved positions applied. Each
// default piece keeps its own id and type; only its spot and turn can come
// from the save, and only if the saved entry is for the same piece.
export function applySavedLayout(defaults: Furniture[], saved: string | null): Furniture[] {
  let entries: unknown[] = []
  try {
    const parsed: unknown = saved === null ? null : JSON.parse(saved)
    if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === LAYOUT_VERSION && 'items' in parsed) {
      if (Array.isArray(parsed.items)) entries = parsed.items
    }
  } catch {
    entries = [] // not valid JSON: ignore it
  }

  return defaults.map((piece) => {
    const entry = entries.find(
      (candidate): candidate is Record<string, unknown> =>
        typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>).id === piece.id,
    )
    if (!entry || entry.type !== piece.type) return piece
    const { x, z, turns } = entry
    if (!isNumber(x) || !isNumber(z) || !isNumber(turns) || ![0, 1, 2, 3].includes(turns)) return piece
    return { ...piece, x, z, turns }
  })
}
