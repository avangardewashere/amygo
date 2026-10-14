// Rep timing, from the clock. Both the person's animation and the machines
// (like the leg press sled) use these, so they always move in step.
// No imports on purpose: machine models can use this without import loops.
// How long one rep takes is the tempo (a setting, see settings/settings.ts);
// each set keeps the tempo it started with, so its count never jumps.

export const REP_SECONDS = 2.4 // one full rep, there and back, at the Normal tempo

// Where in the current rep we are: 0 → 1 → 0, slow at the ends and fast in
// the middle, like a real controlled lift
export function repPhase(startedAt: number, now = performance.now(), repSeconds = REP_SECONDS) {
  const phase = ((now - startedAt) / 1000 / repSeconds) % 1
  return (1 - Math.cos(phase * Math.PI * 2)) / 2
}

export function repsSince(startedAt: number, now = performance.now(), repSeconds = REP_SECONDS) {
  return Math.floor((now - startedAt) / 1000 / repSeconds)
}
