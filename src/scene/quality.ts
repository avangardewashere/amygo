// Keeping the gym smooth on slower devices (phones). Every frame's duration
// is watched; if the speed stays under TARGET_FPS for a few seconds, quality
// steps down one level, and that repeats until it's smooth or at the lowest.
// Plain logic with no drawing, so the rules can be tested.

import { createStore } from '../lib/store'

export type QualityLevel = {
  name: string
  shadowMap: number // shadow detail (pixels per side); 0 = no shadows
  dpr: number // most screen pixels per CSS pixel (sharpness); phones report 2–3
}

// Shadows go first (they cost the most and are missed the least), then sharpness
export const QUALITY_LEVELS: QualityLevel[] = [
  { name: 'High', shadowMap: 2048, dpr: 2 },
  { name: 'Softer shadows', shadowMap: 1024, dpr: 2 },
  { name: 'No shadows', shadowMap: 0, dpr: 2 },
  { name: 'Less sharp', shadowMap: 0, dpr: 1.5 },
  { name: 'Lowest', shadowMap: 0, dpr: 1 },
]
export const LOWEST = QUALITY_LEVELS.length - 1

export const TARGET_FPS = 30 // frames per second
const SLOW_SECONDS = 3 // how long it must stay slow before stepping down
const SETTLE_SECONDS = 2 // after loading or a step, let things settle before judging
const WINDOW_SECONDS = 0.5 // frame rate is measured over this long
const PAUSE_SECONDS = 0.5 // a frame this long means the tab was hidden or paused, not slow

// Watches frame times and decides the quality level
export function createFpsWatch() {
  let level = 0
  let sinceChange = 0 // seconds since the page loaded or quality last changed
  let slowFor = 0 // seconds the speed has stayed under the target
  let windowTime = 0
  let windowFrames = 0
  let fps = 0

  return {
    // Call once per frame with how long it took (seconds). Returns true if
    // quality just stepped down.
    frame(delta: number) {
      if (delta > PAUSE_SECONDS) {
        // The tab was in the background: start measuring afresh
        windowTime = 0
        windowFrames = 0
        return false
      }
      sinceChange += delta
      windowTime += delta
      windowFrames += 1
      if (windowTime < WINDOW_SECONDS) return false

      fps = windowFrames / windowTime
      const measured = windowTime
      windowTime = 0
      windowFrames = 0
      if (sinceChange < SETTLE_SECONDS) return false

      slowFor = fps < TARGET_FPS ? slowFor + measured : 0
      if (slowFor < SLOW_SECONDS || level === LOWEST) return false
      level += 1
      slowFor = 0
      sinceChange = 0
      return true
    },
    get level() {
      return level
    },
    get fps() {
      return fps
    },
  }
}

// The speed readout is shown only when the address asks for it (…/?perf)
export const perfEnabled = (search: string) => new URLSearchParams(search).has('perf')

// What the readout shows, written a couple of times a second from inside the 3D scene
export const perfStore = createStore({ level: 0, fps: 0, drawCalls: 0, triangles: 0 })
