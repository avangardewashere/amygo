import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const DAY_START = new Date(2026, 9, 15, 9).getTime()
const pass = (seconds: number) => vi.advanceTimersByTime(seconds * 1000)
const SET_OF_12 = 12 * 2.4 + 0.1 // twelve reps, and the moment the set ends by itself
const REST = 90

// A stand-in for the browser's sound (AudioContext): counts how often one is
// made, how many tones start, and how often it's asked to resume
class FakeSound {
  static made = 0
  static tones = 0
  static resumed = 0
  state: 'running' | 'suspended' = 'running'
  currentTime = 0
  destination = {}
  constructor() {
    FakeSound.made++
  }
  createOscillator() {
    return { type: '', frequency: { value: 0 }, connect: (next: unknown) => next, start: () => FakeSound.tones++, stop: () => {} }
  }
  createGain() {
    return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: (next: unknown) => next }
  }
  resume() {
    FakeSound.resumed++
    return Promise.resolve()
  }
}

let stopApp: (() => void) | undefined
let buzzes: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(DAY_START)
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - DAY_START)
  FakeSound.made = FakeSound.tones = FakeSound.resumed = 0
  buzzes = vi.fn(() => true)
  vi.stubGlobal('AudioContext', FakeSound)
  vi.stubGlobal('navigator', { vibrate: buzzes })
})
afterEach(() => {
  stopApp?.()
  stopApp = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openApp(saved: Record<string, string> = {}) {
  stopApp?.()
  const data = new Map(Object.entries(saved))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  vi.stubGlobal('window', new EventTarget())
  vi.resetModules()
  const app = {
    data,
    gym: await import('../interaction/gymStore'),
    settings: await import('../settings/settings'),
    cues: await import('./cues'),
  }
  stopApp = (await import('../shell/startup')).startApp()
  return app
}
type App = Awaited<ReturnType<typeof openApp>>
const doing = (app: App) => app.gym.getGym().activity
// A set of 12 and the rest after it, up to a moment before the rest's end
function setAndMostOfTheRest() {
  pass(SET_OF_12)
  pass(REST - 0.1)
}

describe('The rest’s end: a beep and a buzz', { timeout: 30_000 }, () => {
  it('V10B2-T5: the cues come once, at the rest’s end; not when switched off; nothing throws without them; the sound is made once', async () => {
    const app = await openApp()

    // The tap that starts a set makes the sound ready, once
    app.gym.startFromList('curl')
    expect(FakeSound.made).toBe(1)

    // At the rest's end, one beep and one buzz of 200 ms, and set 2 starts
    setAndMostOfTheRest()
    expect([FakeSound.tones, buzzes.mock.calls.length]).toEqual([0, 0])
    pass(0.2)
    expect([FakeSound.tones, buzzes.mock.calls.length]).toEqual([1, 1])
    expect(buzzes).toHaveBeenCalledWith(200)
    expect(doing(app)).toMatchObject({ set: 2 })
    // …and the next rest's end, the same, with the same sound
    setAndMostOfTheRest()
    pass(0.2)
    expect([FakeSound.tones, buzzes.mock.calls.length, FakeSound.made]).toEqual([2, 2, 1])

    // Skip and Finish are the person's own doing: no cue
    app.gym.finishExercise()
    app.gym.startFromList('curl')
    pass(SET_OF_12)
    pass(1)
    app.gym.tapNextSet()
    pass(SET_OF_12)
    app.gym.finishFromList()
    pass(REST * 2)
    expect([FakeSound.tones, buzzes.mock.calls.length]).toEqual([2, 2])

    // Switched off in Workout settings: no beep, no buzz (the next set still starts)
    app.settings.setBeep(false)
    app.gym.startFromList('curl')
    setAndMostOfTheRest()
    pass(0.2)
    expect([FakeSound.tones, buzzes.mock.calls.length]).toEqual([2, 3])
    app.settings.setBeep(true)
    app.settings.setBuzz(false)
    setAndMostOfTheRest()
    pass(0.2)
    expect([FakeSound.tones, buzzes.mock.calls.length]).toEqual([3, 3])
    expect(doing(app)).toMatchObject({ set: 3 })
    app.gym.finishExercise()
    expect(JSON.parse(app.data.get('gym3d.settings')!)).toMatchObject({ beep: true, buzz: false })

    // A sound held back by the browser (no tap yet) is asked to resume as it's used
    vi.stubGlobal('AudioContext', class extends FakeSound {
      state = 'suspended' as const
    })
    const fresh = await openApp()
    fresh.gym.startFromList('curl')
    setAndMostOfTheRest()
    pass(0.2)
    expect(FakeSound.resumed).toBe(1)

    // No buzzing on this device (a laptop, an iPhone): nothing throws, the beep still plays
    vi.stubGlobal('AudioContext', FakeSound)
    vi.stubGlobal('navigator', {})
    const laptop = await openApp()
    const tonesBefore = FakeSound.tones
    laptop.gym.startFromList('curl')
    setAndMostOfTheRest()
    expect(() => pass(0.2)).not.toThrow()
    expect(FakeSound.tones).toBe(tonesBefore + 1)
    expect(doing(laptop)).toMatchObject({ set: 2 })
    // …nor when buzzing or the sound fails
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('not allowed')
      },
    })
    expect(laptop.cues.buzz()).toBe(false)
    vi.stubGlobal('AudioContext', undefined)
    const silent = await openApp()
    silent.gym.startFromList('curl')
    setAndMostOfTheRest()
    expect(() => pass(0.2)).not.toThrow()
    expect(doing(silent)).toMatchObject({ set: 2 })
    expect(silent.cues.beep()).toBe(false)

    // Before the page has been tapped the browser allows neither, so neither is tried (it would only complain)
    vi.stubGlobal('AudioContext', FakeSound)
    vi.stubGlobal('navigator', { vibrate: buzzes, userActivation: { hasBeenActive: false } })
    const untouched = await openApp()
    const [madeBefore, buzzesBefore] = [FakeSound.made, buzzes.mock.calls.length]
    untouched.gym.startFromList('curl')
    expect(FakeSound.made).toBe(madeBefore)
    expect(untouched.cues.buzz()).toBe(false)
    expect(buzzes.mock.calls.length).toBe(buzzesBefore)
    vi.stubGlobal('navigator', { vibrate: buzzes, userActivation: { hasBeenActive: true } })
    untouched.gym.finishExercise()
    untouched.gym.startFromList('curl')
    expect(FakeSound.made).toBe(madeBefore + 1)
    expect(untouched.cues.buzz()).toBe(true)

    // Switching Beep on is a tap, so the sound is made ready then: the rest going on beeps at its end
    vi.stubGlobal('navigator', { vibrate: buzzes })
    const late = await openApp({ 'gym3d.settings': JSON.stringify({ beep: false }) })
    const [madeNow, tonesNow] = [FakeSound.made, FakeSound.tones]
    late.gym.startFromList('curl')
    pass(SET_OF_12)
    expect(FakeSound.made).toBe(madeNow) // (no sound while beeps are off)
    late.settings.setBeep(true) // the checkbox's onChange: these two…
    late.cues.primeSound() // …together
    pass(REST)
    expect(FakeSound.tones).toBe(tonesNow + 1)
    const settingsSource = (import.meta.glob('/src/shell/WorkoutSettings.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/shell/WorkoutSettings.tsx']
    expect(settingsSource).toMatch(/setBeep\(event\.target\.checked\)\s*primeSound\(\)/)

    // With beeps switched off from the start, no sound is made at all
    vi.stubGlobal('AudioContext', FakeSound)
    const made = FakeSound.made
    const quiet = await openApp({ 'gym3d.settings': JSON.stringify({ beep: false }) })
    quiet.gym.startFromList('curl')
    expect(FakeSound.made).toBe(made)
    // (a saved switch that isn't true or false is the default, on)
    const odd = await openApp({ 'gym3d.settings': JSON.stringify({ beep: 'no', buzz: 0 }) })
    expect(odd.settings.getSettings()).toMatchObject({ beep: true, buzz: true })

    // The Workout settings section: the rest lengths, and a switch for each cue
    const { ExercisesPage } = await import('../shell/ExercisesPage')
    const page = renderToString(createElement(ExercisesPage, { now: 0 })).replaceAll('<!-- -->', '')
    const section = page.slice(page.indexOf('<section class="workout-settings"'))
    const words = section.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    expect(words).toContain('Rest between sets Strength − 1:30 + Cardio − 1:00 +')
    expect(words).toContain('Beep when a rest is over Buzz when a rest is over (on phones that can, like Android)')
    expect(section).toContain('aria-label="Rest after a strength set"')
    expect(section).toContain('aria-label="Shorter rest: cardio"')
    expect(section.match(/<input type="checkbox" checked=""\/>/g)).toHaveLength(2)
    const source = (import.meta.glob('/src/shell/WorkoutSettings.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/shell/WorkoutSettings.tsx']
    expect(source).toMatch(/checked=\{beep\}\s*onChange=\{\(event\) => \{\s*setBeep\(event\.target\.checked\)/)
    expect(source).toMatch(/checked=\{buzz\} onChange=\{\(event\) => setBuzz\(event\.target\.checked\)\}/)
    expect(source).toMatch(/onNudge=\{\(direction\) => \{\s*nudgeRest\(kind, direction\)\s*say\(`Rest after a \$\{kind\} set \$\{clock\(getSettings\(\)\.rest\[kind\]\)\}`\)/)
    // The sound is made ready where a set starts (most starts are a tap)
    const gym = (import.meta.glob('/src/interaction/gymStore.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/interaction/gymStore.ts']
    expect(gym).toMatch(/if \(!piece \|\| holding\) return\s*primeSound\(\)/)
  })
})
