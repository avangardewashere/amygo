// Switching pages, and what has to happen when the gym goes out of view.
import { endDrag, getBuild, toggleBuildMode } from '../build/buildStore'
import { input } from '../player/input'
import { getTab, setTab, type Tab } from './tabStore'

export function openTab(tab: Tab) {
  if (tab === getTab()) return
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
