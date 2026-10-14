import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const SETTINGS = 'gym3d.settings' // (spelt out: the saved key must not change by accident)

// A stand-in for the browser's localStorage. `broken` makes every access throw.
function fakeStorage(saved: Record<string, string> = {}, { broken = false } = {}) {
  const data = new Map(Object.entries(saved))
  const fail = () => {
    throw new Error('storage blocked')
  }
  return {
    data,
    getItem: (key: string) => (broken ? fail() : (data.get(key) ?? null)),
    setItem: (key: string, value: string) => (broken ? fail() : data.set(key, value)),
    removeItem: (key: string) => data.delete(key),
  }
}

let t = 0
const wait = (seconds: number) => (t += seconds * 1000)
beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openApp(storage = fakeStorage()) {
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  const app = {
    storage,
    settings: await import('./settings'),
    gym: await import('../interaction/gymStore'),
    log: await import('../log/logStore'),
    machine: (await import('../equipment/machineState')).machine,
    reps: await import('../interaction/reps'),
    squat: await import('../equipment/squatGeometry'),
  }
  app.log.startLogging()
  return app
}
const html = (element: Parameters<typeof renderToString>[0]) => renderToString(element).replaceAll('<!-- -->', '')

describe('Workout settings', { timeout: 30_000 }, () => {
  it('V10B1-T5: each tempo gives its seconds per rep; a set keeps the tempo it began with; the machines move at the set’s tempo', async () => {
    const app = await openApp()
    const { TEMPOS, getSettings, setTempo, repSecondsNow } = app.settings

    // Slow 3.5 s · Normal 2.4 s · Fast 1.8 s a rep (decision P-D2); Normal at first, the rep clock's own pace
    expect(TEMPOS).toEqual({ slow: 3.5, normal: 2.4, fast: 1.8 })
    expect(getSettings()).toMatchObject({ tempo: 'normal' })
    expect(repSecondsNow()).toBe(app.reps.REP_SECONDS)
    for (const [tempo, seconds] of Object.entries(TEMPOS)) {
      setTempo(tempo as keyof typeof TEMPOS)
      expect(repSecondsNow(), tempo).toBe(seconds)
    }
    setTempo('normal')

    // A set copies the tempo when it begins, and keeps it if the setting changes mid-set:
    // the count doesn't jump, and it ends at 12 × 2.4 s
    app.gym.startFromList('curl')
    const curls = app.gym.getGym().activity!
    expect(curls.repSeconds).toBe(2.4)
    wait(10)
    setTempo('fast')
    expect(app.gym.getGym().activity).toBe(curls)
    expect(app.gym.repsDone(curls, performance.now())).toBe(4) // 10 s at 2.4 s a rep
    wait(12 * 2.4 - 10 + 0.1)
    app.gym.stopExercise()
    expect(app.log.getLog().sets.at(-1)).toMatchObject({ reps: 12, seconds: 28.8 })

    // The next set is at the new tempo: 12 reps take 12 × 1.8 s
    app.gym.nextSet()
    const quick = app.gym.getGym().activity!
    expect(quick).toMatchObject({ set: 2, repSeconds: 1.8 })
    expect(app.gym.endsAt(quick)).toBeCloseTo(quick.startedAt + 21_600, 6)
    wait(7 * 1.8 + 0.1)
    expect(app.gym.repsDone(quick, performance.now())).toBe(7)

    // The person and the machines move at the set's tempo: half a fast rep (0.9 s) in is the bottom of the rep
    expect(app.machine.repSeconds).toBe(1.8)
    expect(app.gym.repProgress(quick, quick.startedAt + 900)).toBeCloseTo(1, 6)
    expect(app.reps.repPhase(app.machine.startedAt, quick.startedAt + 900, app.machine.repSeconds)).toBeCloseTo(1, 6)
    app.gym.finishExercise()
    setTempo('slow')
    app.gym.startFromList('squat')
    const squats = app.gym.getGym().activity!
    expect(app.machine.repSeconds).toBe(3.5)
    const rack = app.machine.activeId!
    // The bar on the squatter's back is lowest half a slow rep in (1.75 s), and back up at a whole one (3.5 s)
    const barY = (seconds: number) => app.squat.barTarget(rack, squats.startedAt + seconds * 1000).y
    expect(barY(1.75)).toBeCloseTo(app.squat.squatPosition(1).bar.y, 6)
    expect(barY(3.5)).toBeCloseTo(app.squat.squatPosition(0).bar.y, 6)
    // Each machine reads the set's tempo from the shared machine state, as it reads its start time
    const sources = import.meta.glob(
      ['/src/equipment/CableMachine.tsx', '/src/equipment/ChestFly.tsx', '/src/equipment/LegPress.tsx', '/src/equipment/squatGeometry.ts'],
      { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>
    for (const [file, source] of Object.entries(sources)) {
      expect(source.match(/repPhase\(/g), file).toHaveLength(1)
      expect(source, file).toMatch(/repPhase\(machine\.startedAt, (performance\.now\(\)|now), machine\.repSeconds\)/)
    }
    app.gym.finishExercise()

    // The choice is saved in this browser, beside whatever else is saved under the same key (the Settings tab's own choices)
    app.storage.data.set(SETTINGS, JSON.stringify({ graphics: 'low', tempo: 'slow' }))
    setTempo('fast')
    expect(JSON.parse(app.storage.data.get(SETTINGS)!)).toMatchObject({ graphics: 'low', tempo: 'fast' })
    // …so a reload brings it back
    expect((await openApp(app.storage)).settings.getSettings()).toMatchObject({ tempo: 'fast' })
    // A saved tempo that isn't one of the three, or a saved value that can't be read, is Normal
    for (const bad of [{ tempo: 'warp' }, { tempo: 1.8 }, { tempo: 'toString' }]) {
      const fresh = await openApp(fakeStorage({ [SETTINGS]: JSON.stringify(bad) }))
      expect(fresh.settings.getSettings(), JSON.stringify(bad)).toMatchObject({ tempo: 'normal' })
    }
    expect((await openApp(fakeStorage({ [SETTINGS]: '{oops' }))).settings.getSettings()).toMatchObject({ tempo: 'normal' })
    // With storage blocked nothing throws, and the choice holds until the page closes
    const blocked = await openApp(fakeStorage({}, { broken: true }))
    expect(() => blocked.settings.setTempo('slow')).not.toThrow()
    expect(blocked.settings.repSecondsNow()).toBe(3.5)
    // A tempo picked in another Amygo window is taken here too
    const other = new EventTarget()
    const tab = await openApp(app.storage)
    const stop = tab.settings.followSettings(other)
    app.storage.data.set(SETTINGS, JSON.stringify({ tempo: 'slow' }))
    other.dispatchEvent(Object.assign(new Event('storage'), { key: SETTINGS }))
    expect(tab.settings.getSettings()).toMatchObject({ tempo: 'slow' })
    stop()
    // …and the app itself follows it: startApp(), which main.tsx calls, listens on the real
    // window, to its own key and to storage being cleared, not to other keys
    const browserWindow = new EventTarget()
    const wired = await openApp()
    vi.stubGlobal('window', browserWindow)
    const stopApp = (await import('../shell/startup')).startApp()
    wired.storage.data.set(SETTINGS, JSON.stringify({ tempo: 'fast' }))
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: 'gym3d.weights' }))
    expect(wired.settings.getSettings()).toMatchObject({ tempo: 'normal' })
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: SETTINGS }))
    expect(wired.settings.getSettings()).toMatchObject({ tempo: 'fast' })
    wired.storage.data.clear()
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
    expect(wired.settings.getSettings()).toMatchObject({ tempo: 'normal' })
    stopApp()
    wired.settings.setTempo('slow')

    // The Workout settings section, at the bottom of the Exercises page: Slow · Normal · Fast, the chosen one pressed
    const { ExercisesPage } = await import('../shell/ExercisesPage')
    const page = html(createElement(ExercisesPage, { now: 0 }))
    const section = page.slice(page.indexOf('<section class="workout-settings"'))
    expect(section).toMatch(/^<section class="workout-settings" aria-labelledby="workout-settings-title"><h3 id="workout-settings-title">Workout settings<\/h3>/)
    expect(section).toContain('<span id="tempo-label">Tempo</span><div class="segmented" role="group" aria-labelledby="tempo-label">')
    expect(section).toContain(
      '<button type="button" class="list-button" aria-pressed="true">Slow</button><button type="button" class="list-button" aria-pressed="false">Normal</button><button type="button" class="list-button" aria-pressed="false">Fast</button>',
    )
    expect(section).toContain('One rep takes 3.5 s. A set keeps the tempo it started with.')
    expect(page.indexOf('workout-settings')).toBeGreaterThan(page.lastIndexOf('machine-group')) // under the list
    const settingsSource = import.meta.glob('/src/shell/WorkoutSettings.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(settingsSource['/src/shell/WorkoutSettings.tsx']).toMatch(/onClick=\{\(\) => setTempo\(choice\)\}/)
  })
})
