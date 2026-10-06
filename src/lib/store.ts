import { useSyncExternalStore } from 'react'

// A tiny shared-state container. State lives outside React so the 3D scene,
// keyboard handlers and on-screen buttons can all read and change it.
// Components re-render only when the piece they selected changes.
export function createStore<T extends object>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    get: () => state,
    set(patch: Partial<T>) {
      state = { ...state, ...patch }
      listeners.forEach((notify) => notify())
    },
    // Pick a single field or an existing object; building a new object/array
    // inside `select` would look "changed" every time and re-render forever.
    useSelect<S>(select: (s: T) => S): S {
      // (the same value when rendered outside a browser, e.g. in a test)
      return useSyncExternalStore(subscribe, () => select(state), () => select(state))
    },
  }
}
