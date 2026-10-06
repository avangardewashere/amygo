// What the app switches on once, before it's drawn. main.tsx calls startApp(),
// and the tests call the very same function, so what they check is what runs.
import { startLogging } from '../log/logStore'
import { listenToBack } from './tabs'

export function startApp() {
  // Save each set as it finishes (see the Today tab)
  const stopLogging = startLogging()
  // Android's back gesture (and Escape) closes an exercise's history page
  const stopBack = listenToBack()
  return () => {
    stopLogging()
    stopBack()
  }
}
