// Switching pages, and what has to happen when the gym goes out of view.
// Also an exercise's history page, the one page inside a tab, and the back
// gesture that closes it.
import { endDrag, getBuild, toggleBuildMode } from '../build/buildStore'
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { input } from '../player/input'
import { getHistoryKind, getTab, setHistoryKind, setTab, type Tab } from './tabStore'

export function openTab(tab: Tab) {
  if (tab === getTab()) return
  closeHistory() // a history page belongs to its tab: leaving closes it
  if (tab !== 'home') {
    // Leaving the gym: finish any drag (a piece dropped somewhere taken snaps
    // back), and leave build mode, so nothing is left half-done out of view
    if (getBuild().drag) endDrag()
    if (getBuild().mode === 'build') toggleBuildMode()
    // Let go of movement, so the person doesn't walk on when the gym comes back
    input.keyboard.x = 0
    input.keyboard.y = 0
    input.joystick.x = 0
    input.joystick.y = 0
  }
  setTab(tab)
}

// ---------- An exercise's history page ----------

// Marks the browser-history entry added for a history page
const MARK = 'gym3dHistory'

// The browser's history, or null where there is none (tests, or a browser that refuses)
function browserHistory(): History | null {
  try {
    return globalThis.window?.history ?? null
  } catch {
    return null
  }
}

const isOurEntry = (state: unknown): state is Record<typeof MARK, ExerciseKind> => {
  const kind = (state as Record<string, unknown> | null)?.[MARK]
  return typeof kind === 'string' && Object.hasOwn(EXERCISES, kind)
}

// Open an exercise's history (from its row on the Exercises list). It adds
// one entry to the browser's history, so Android's back gesture (or the
// browser's Back) closes the page instead of leaving the app.
export function openHistory(kind: ExerciseKind) {
  if (getTab() !== 'exercises' || getHistoryKind() === kind) return
  setHistoryKind(kind)
  try {
    const history = browserHistory()
    // Already on one of our entries (another exercise's page is open): swap it, never stack a second
    if (history && isOurEntry(history.state)) history.replaceState({ [MARK]: kind }, '')
    else history?.pushState({ [MARK]: kind }, '')
  } catch {
    // Without browser history the page still opens; only the back gesture won't close it
  }
}

// Close it (its Back button, Escape, or leaving the tab), and step back over
// the entry it added, so the next back gesture does what it would have done
// before. That step arrives as a "popstate", which then finds nothing open.
export function closeHistory() {
  if (getHistoryKind() === null) return
  setHistoryKind(null)
  try {
    const history = browserHistory()
    if (history && isOurEntry(history.state)) history.back()
  } catch {
    // Nothing to undo
  }
}

// Our mark comes off an entry whose page isn't showing, so a later Back that
// lands on it can't bring back a page that was closed long ago
function unmark() {
  try {
    const history = browserHistory()
    if (history && isOurEntry(history.state)) history.replaceState(null, '')
  } catch {
    // Nothing to tidy
  }
}

// The back gesture, the browser's Back and Forward, and Escape. Arriving at a
// history page's entry shows that page (Forward, on the Exercises tab);
// arriving anywhere else closes it (Back). Returns a function that stops listening.
export function listenToBack() {
  // The browser keeps an entry's mark across a reload (and Android's restore
  // of a tab it put to sleep), but the app starts on Home with no page open
  unmark()
  const onPop = (event: Event) => {
    const state = (event as PopStateEvent).state
    // (Forward pressed on another tab can leave the browser on one of our entries
    // with no page showing; openHistory then swaps that entry instead of stacking on it)
    setHistoryKind(isOurEntry(state) && getTab() === 'exercises' ? state[MARK] : null)
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.code === 'Escape' && getHistoryKind() !== null) closeHistory()
  }
  window.addEventListener('popstate', onPop)
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('popstate', onPop)
    window.removeEventListener('keydown', onKey)
  }
}
