import { closeMenu, stopExercise } from '../interaction/gymStore'
import { getBuild, rotateSelected, select, toggleBuildMode } from './buildStore'
import { onHome } from '../shell/tabStore'

// Switching modes also closes any open item menu (so it doesn't pop back later)
// and ends any exercise in progress
export function switchMode() {
  closeMenu()
  stopExercise()
  toggleBuildMode()
}

// Keyboard: B toggles build mode. While building: R rotates, Esc deselects.
export function listenToBuildKeys() {
  const onDown = (e: KeyboardEvent) => {
    if (e.repeat || !onHome()) return // (only while the gym is in front)
    const building = getBuild().mode === 'build'
    if (e.code === 'KeyB') switchMode()
    else if (building && e.code === 'KeyR') rotateSelected()
    else if (building && e.code === 'Escape') select(null)
  }
  window.addEventListener('keydown', onDown)
  return () => window.removeEventListener('keydown', onDown)
}
