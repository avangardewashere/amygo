// Which page of the app is open, and which exercise's history (a page inside
// the Exercises tab), if any. Kept tiny, with no imports that run code (the
// exercise type disappears in the build), so the gym's input code can ask
// "is Home open?" without import loops.
import { createStore } from '../lib/store'
import type { ExerciseKind } from '../exercises/catalog'

export type Tab = 'home' | 'exercises' | 'today'
export const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'exercises', label: 'Exercises' },
  { id: 'today', label: 'Today' },
]

const store = createStore({ tab: 'home' as Tab, history: null as ExerciseKind | null, welcome: false })

export const useTab = () => store.useSelect((s) => s.tab)
export const getTab = () => store.get().tab
export const setTab = (tab: Tab) => store.set({ tab })

// The exercise whose history page is open on the Exercises tab (null: the list)
export const useHistoryKind = () => store.useSelect((s) => s.history)
export const getHistoryKind = () => store.get().history
export const setHistoryKind = (history: ExerciseKind | null) => store.set({ history })

// Is the welcome card open over the gym?
export const useWelcome = () => store.useSelect((s) => s.welcome)
export const getWelcome = () => store.get().welcome
export const setWelcome = (welcome: boolean) => store.set({ welcome })

// Is the gym the page in front, with nothing over it? (Its keys and joystick
// only work then: every key handler asks this one question.)
export const onHome = () => store.get().tab === 'home' && !store.get().welcome

// The gym keeps drawing only while it's in front. Its canvas stays mounted on
// other pages (rebuilding a WebGL scene is a visible stall on phones), but with
// 'never' the graphics chip does no work for it.
export const frameloopFor = (tab: Tab) => (tab === 'home' ? 'always' : 'never')
