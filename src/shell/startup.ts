// What the app switches on once, before it's drawn. main.tsx calls startApp(),
// and the tests call the very same function, so what they check is what runs.
import { followWeights } from '../exercises/weights'
import { followOtherWindows, startLogging } from '../log/logStore'
import { isFirstVisit } from './firstVisit'
import { listenForInstall } from './install'
import { setWelcome } from './tabStore'
import { listenToBack, listenToWelcomeKeys } from './tabs'

export function startApp() {
  // Someone here for the first time sees the welcome card before the gym
  if (isFirstVisit()) setWelcome(true)
  // Save each set as it finishes (see the Today tab)
  const stopLogging = startLogging()
  // …and take sets saved in another Amygo window (the installed app and a tab share them)
  const stopFollowing = followOtherWindows()
  const stopFollowingWeights = followWeights() // (and the weights picked there)
  // Android's back gesture (and Escape) closes an exercise's history page
  const stopBack = listenToBack()
  // Escape closes the welcome card
  const stopWelcomeKeys = listenToWelcomeKeys()
  // Chrome's offer to install (it can come before React draws), and keeping data once installed
  const stopInstall = listenForInstall()
  return () => {
    stopLogging()
    stopFollowing()
    stopFollowingWeights()
    stopBack()
    stopWelcomeKeys()
    stopInstall()
  }
}
