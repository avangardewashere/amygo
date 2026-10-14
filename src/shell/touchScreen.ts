// Is the main pointer a finger (a phone or tablet)? Then the gym shows the
// joystick and the workout card; with a mouse it shows the popup over the person
// (decision P-D6). The same question the CSS asks for the joystick,
// (pointer: coarse), asked once here for the code, and followed if it changes
// (a tablet's keyboard folded away). No browser to ask (a test): a mouse.
import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: coarse)'
const query = () => globalThis.window?.matchMedia?.(QUERY) ?? null

export const isTouchScreen = () => query()?.matches ?? false

function subscribe(listener: () => void) {
  const list = query()
  list?.addEventListener?.('change', listener)
  return () => list?.removeEventListener?.('change', listener)
}

// (the same answer when drawn outside a browser, e.g. in a test, from whatever window there is)
export const useTouchScreen = () => useSyncExternalStore(subscribe, isTouchScreen, isTouchScreen)
