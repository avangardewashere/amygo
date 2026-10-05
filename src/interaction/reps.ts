// Rep timing, from the clock. Both the person's animation and the machines
// (like the leg press sled) use these, so they always move in step.
// No imports on purpose: machine models can use this without import loops.

export const REP_SECONDS = 2.4 // one full rep, there and back

// Where in the current rep we are: 0 → 1 → 0, slow at the ends and fast in
// the middle, like a real controlled lift
export function repPhase(startedAt: number, now = performance.now()) {
  const phase = ((now - startedAt) / 1000 / REP_SECONDS) % 1
  return (1 - Math.cos(phase * Math.PI * 2)) / 2
}

export function repsSince(startedAt: number, now = performance.now()) {
  return Math.floor((now - startedAt) / 1000 / REP_SECONDS)
}
