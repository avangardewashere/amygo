import { describe, expect, it } from 'vitest'
import { REP_SECONDS, repPhase, repsSince } from './reps'

describe('rep timing', () => {
  const rep = REP_SECONDS * 1000 // one rep in milliseconds

  it('B0-T3a: each rep goes 0 → 1 → 0 (start, halfway, end)', () => {
    expect(repPhase(0, 0)).toBeCloseTo(0, 5)
    expect(repPhase(0, rep / 2)).toBeCloseTo(1, 5)
    expect(repPhase(0, rep)).toBeCloseTo(0, 5)
    // Counted from when the exercise started, not from zero
    expect(repPhase(5000, 5000 + rep / 2)).toBeCloseTo(1, 5)
  })

  it('B0-T3b: the rep count goes up once per completed rep', () => {
    expect(repsSince(0, rep - 1)).toBe(0)
    expect(repsSince(0, rep)).toBe(1)
    expect(repsSince(0, 3 * rep + 1)).toBe(3)
  })
})
