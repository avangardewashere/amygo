// The time of day the pages label sets against ("Today", "Yesterday"). Read
// when the app starts, then again every minute, when the app comes back on
// screen (a phone that slept overnight), and whenever the log changes, so a
// set just finished, even just past midnight, is counted on the right day.
// Reading the clock here, outside of drawing, keeps the pages' drawing pure.
import { useSyncExternalStore } from 'react'
import { subscribeLog } from '../log/logStore'

let now = Date.now()
const listeners = new Set<() => void>()

// Read the clock again and tell the pages
export function refreshClock() {
  now = Date.now()
  listeners.forEach((notify) => notify())
}

export const currentTime = () => now

const MINUTE = 60_000
let stopSources: (() => void) | null = null

// The clock's sources run only while some page is showing it
function startSources() {
  const timer = setInterval(refreshClock, MINUTE)
  const onShow = () => {
    if (document.visibilityState === 'visible') refreshClock()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onShow)
  const stopLog = subscribeLog(refreshClock)
  return () => {
    clearInterval(timer)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onShow)
    stopLog()
  }
}

// Follow the clock (a page on screen does this through useNow). Returns a function that stops.
export function subscribeClock(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) stopSources = startSources()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stopSources?.()
      stopSources = null
    }
  }
}

// The time to label sets against. `fixed` is for tests, which need a known "now".
export function useNow(fixed?: number) {
  const live = useSyncExternalStore(subscribeClock, currentTime, currentTime)
  return fixed ?? live
}
