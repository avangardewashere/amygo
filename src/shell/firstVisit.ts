// Who sees the welcome card on their own: someone on a first visit. That is
// someone never welcomed before, with nothing saved: a saved log or a moved
// piece of furniture means they've been here (so your own browser skips it).
// (Not named welcome.ts: imports leave out the extension and Windows ignores
// capital letters, so './welcome' could pick up Welcome.tsx on the laptop only.)
import { LAYOUT_KEY } from '../build/layoutStorage'
import { LOG_KEY } from '../log/logStorage'
import { storage } from '../lib/storage'

export const WELCOMED_KEY = 'gym3d.welcomed'

export function isFirstVisit() {
  try {
    const saved = storage()
    if (!saved) return true // no storage at all: every visit is a first one
    return [WELCOMED_KEY, LAYOUT_KEY, LOG_KEY].every((key) => saved.getItem(key) === null)
  } catch {
    return true // blocked storage: the card shows, and still closes
  }
}

// Closing the card remembers it, quietly (if storage is blocked, it simply shows next time too)
export function rememberWelcomed() {
  try {
    storage()?.setItem(WELCOMED_KEY, '1')
  } catch {
    // Nothing to do
  }
}
