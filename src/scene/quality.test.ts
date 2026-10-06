import { describe, expect, it } from 'vitest'
import { LOWEST, QUALITY_LEVELS, TARGET_FPS, createFpsWatch, perfEnabled } from './quality'

// Feed the watch `seconds` of frames at a steady `fps`; returns how many times it stepped down
function run(watch: ReturnType<typeof createFpsWatch>, fps: number, seconds: number) {
  let steps = 0
  for (let t = 0; t < seconds; t += 1 / fps) if (watch.frame(1 / fps)) steps += 1
  return steps
}

describe('quality step-down', () => {
  it('V5B3-T1: steps down only after a sustained slowdown, and never below the lowest level', () => {
    const watch = createFpsWatch()
    run(watch, 60, 10) // smooth
    expect(watch.level).toBe(0)

    // One slow frame (a hiccup) among smooth ones: no change
    watch.frame(0.4)
    run(watch, 60, 5)
    expect(watch.level).toBe(0)

    // A tab put in the background for 5 s (one huge frame): no change
    watch.frame(5)
    run(watch, 60, 5)
    expect(watch.level).toBe(0)

    // Slow, but only for 2.5 s: no change
    run(watch, 20, 2.5)
    run(watch, 60, 3)
    expect(watch.level).toBe(0)

    // Slow for 4 s: one step down
    expect(run(watch, 20, 4)).toBe(1)
    expect(watch.level).toBe(1)
    // …and it measures slower than the target while slow
    expect(watch.fps).toBeLessThan(TARGET_FPS)

    // Staying slow keeps stepping down, but stops at the lowest level
    run(watch, 10, 120)
    expect(watch.level).toBe(LOWEST)
    expect(run(watch, 10, 30)).toBe(0)
  })

  it('V5B3-T2: each step lowers shadows first, then sharpness', () => {
    // Starts at full quality: shadows on, sharpness 2×
    expect(QUALITY_LEVELS[0].shadowMap).toBeGreaterThan(0)
    expect(QUALITY_LEVELS[0].dpr).toBe(2)
    let sharpnessLowered = false
    for (let i = 1; i < QUALITY_LEVELS.length; i++) {
      const before = QUALITY_LEVELS[i - 1]
      const after = QUALITY_LEVELS[i]
      const lessShadow = after.shadowMap < before.shadowMap
      const lessSharp = after.dpr < before.dpr
      // Each step lowers exactly one thing…
      expect(lessShadow !== lessSharp, after.name).toBe(true)
      // …and shadows are all gone before sharpness is touched
      if (lessSharp) sharpnessLowered = true
      if (lessShadow) expect(sharpnessLowered, after.name).toBe(false)
    }
    // Ends with no shadows at plain sharpness
    expect(QUALITY_LEVELS[LOWEST]).toMatchObject({ shadowMap: 0, dpr: 1 })
  })

  it('V5B3-T3: the speed readout only shows when the address asks for it (?perf)', () => {
    expect(perfEnabled('')).toBe(false)
    expect(perfEnabled('?layout=1')).toBe(false)
    expect(perfEnabled('?perf')).toBe(true)
    expect(perfEnabled('?x=1&perf')).toBe(true)
  })
})
