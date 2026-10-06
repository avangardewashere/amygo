// Which page of the app is open. Kept tiny and free of other imports, so the
// gym's input code can ask "is Home open?" without import loops.
import { createStore } from '../lib/store'

export type Tab = 'home' | 'exercises'
export const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'exercises', label: 'Exercises' },
]

const store = createStore({ tab: 'home' as Tab })

export const useTab = () => store.useSelect((s) => s.tab)
export const getTab = () => store.get().tab
export const setTab = (tab: Tab) => store.set({ tab })

// Is the gym the page in front? (Its keys and joystick only work then.)
export const onHome = () => store.get().tab === 'home'

// The gym keeps drawing only while it's in front. Its canvas stays mounted on
// other pages (rebuilding a WebGL scene is a visible stall on phones), but with
// 'never' the graphics chip does no work for it.
export const frameloopFor = (tab: Tab) => (tab === 'home' ? 'always' : 'never')
