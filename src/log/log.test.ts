import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { LOG_KEY, LOG_VERSION } from './logStorage'
import type { LoggedSet } from './sets'

// A stand-in for the browser's localStorage (as in the layout tests). `broken`
// makes every access throw, like a browser that blocks storage.
function fakeStorage({ broken = false, saved = null as string | null } = {}) {
  const data = new Map<string, string>()
  if (saved !== null) data.set(LOG_KEY, saved)
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

// The clocks, under the test's control: the exercise clock (performance.now)
// and the time of day (Date.now), 2:00 pm on 7 Oct 2026 local time when t = 0
const DAY_START = new Date(2026, 9, 7, 14, 0).getTime()
let t = 0
const wait = (seconds: number) => (t += seconds * 1000)

beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
  vi.spyOn(Date, 'now').mockImplementation(() => DAY_START + t)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// "Open the page": a fresh copy of the app's state (which reads the saved log),
// with the log watching the gym, as main.tsx does
async function openApp(storage = fakeStorage()) {
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  const gym = await import('../interaction/gymStore')
  const log = await import('./logStore')
  const actions = await import('../build/actions')
  const sets = await import('./sets')
  log.startLogging()
  return { gym, log, actions, sets, storage }
}
type App = Awaited<ReturnType<typeof openApp>>

const savedSets = (app: App) => app.log.getLog().sets

describe('Today tab: saving finished sets', () => {
  it('V7B1-T1: stopping after 12 curls saves one set, whichever of the six ways it stops', async () => {
    const app = await openApp()
    const { gym, actions } = app
    const ways: [string, () => void][] = [
      ['Stop in the gym menu', () => gym.menuActions('furniture', gym.getGym()).find((a) => a.label === 'Stop')!.run()],
      ['E', () => gym.toggleMenu()],
      ['walking away (what the player does)', () => gym.stopExercise()],
      ['going into build mode', () => (actions.switchMode(), actions.switchMode())],
      ['Finish on the list', () => gym.finishFromList()],
      ['starting another exercise', () => gym.startFromList('lateral')],
    ]
    for (const [way, stop] of ways) {
      gym.stopExercise()
      const before = savedSets(app).length
      gym.startFromList('curl')
      wait(12 * 2.4 + 0.2) // twelve reps and a moment
      stop()
      const added = savedSets(app).slice(before)
      expect(added, way).toHaveLength(1)
      expect(added[0], way).toMatchObject({ kind: 'curl', reps: 12, endedAt: DAY_START + t })
      expect(added[0].seconds, way).toBeCloseTo(29, 1)
    }
  })

  it('V7B1-T2: walk 60 s then run 60 s is two sets, adding up to the popup\'s distance', async () => {
    const app = await openApp()
    const { gym } = app
    gym.startFromList('walk')
    wait(60)
    gym.paceActions(gym.getGym().activity!).find((a) => a.label === 'Run')!.run()
    expect(savedSets(app).map((set) => set.kind)).toEqual(['walk']) // the walk is saved at the switch
    wait(60)
    const shown = gym.metersSoFar(gym.getGym().activity!, t) // what the popup says at the end
    gym.finishFromList()
    const [walk, run] = savedSets(app)
    expect(walk).toMatchObject({ kind: 'walk', seconds: 60, meters: 90 })
    expect(run).toMatchObject({ kind: 'run', seconds: 60, meters: 180 })
    expect(walk.meters! + run.meters!).toBeCloseTo(shown, 2)
  })

  it('V7B1-T3: false starts and an exercise stopped before reaching the machine are not saved', async () => {
    const app = await openApp()
    const { gym } = app
    gym.startFromList('curl')
    wait(2) // not one rep yet
    gym.finishFromList()
    gym.startFromList('walk')
    wait(9.9) // under 10 s
    gym.finishFromList()
    // Started at the treadmill itself: the person steps on first, and stops before getting there
    const treadmill = (await import('../build/buildStore')).getBuild().items.find((item) => item.type === 'treadmill')!
    gym.setNearFurniture(treadmill.id)
    gym.menuActions('furniture', gym.getGym(), 'treadmill').find((a) => a.label === 'Walk')!.run()
    expect(gym.getGym().activity!.arrived).toBe(false)
    wait(30)
    gym.stopExercise()
    expect(savedSets(app)).toEqual([])
    // …while exactly the minimum does count
    gym.startFromList('walk')
    wait(10)
    gym.finishFromList()
    expect(savedSets(app)).toHaveLength(1)
  })

  it('V7B1-T4: saved sets come back after a reload; bad entries are skipped one by one; blocked storage still works', async () => {
    const storage = fakeStorage()
    let app = await openApp(storage)
    app.gym.startFromList('row')
    wait(65)
    app.gym.finishFromList()
    const before = savedSets(app)
    expect(before).toHaveLength(1)
    expect(before[0]).toMatchObject({ kind: 'row', strokes: 27 }) // 65 s at 2.4 s a stroke
    app = await openApp(storage) // reload
    expect(savedSets(app)).toEqual(before)

    // Damaged entries: each is skipped, the good ones kept
    const good: LoggedSet = { id: 'a', kind: 'curl', endedAt: DAY_START, seconds: 29, reps: 12 }
    const entries = [
      good,
      { ...good, id: 'b', kind: 'jumpingJacks' }, // not an exercise the gym has
      { ...good, id: 'c', reps: undefined }, // a strength set without reps
      { id: 'd', kind: 'walk', endedAt: DAY_START, seconds: 60 }, // cardio without a distance
      { ...good, id: 'e', seconds: 'long' },
      { ...good, id: 'f', reps: -3 },
      null,
      'a set',
      { ...good, reps: 99 }, // the same id again
      { id: 'g', kind: 'run', endedAt: DAY_START, seconds: 60, meters: 180 },
    ]
    app = await openApp(fakeStorage({ saved: JSON.stringify({ version: LOG_VERSION, sets: entries }) }))
    expect(savedSets(app).map((set) => set.id)).toEqual(['a', 'g'])
    // Unreadable as a whole: an empty log, not a crash
    for (const saved of ['not json', JSON.stringify({ version: 99, sets: [good] }), JSON.stringify([good]), 'null']) {
      app = await openApp(fakeStorage({ saved }))
      expect(savedSets(app), saved).toEqual([])
    }

    // Storage blocked: nothing breaks, and the visit's sets are still listed
    app = await openApp(fakeStorage({ broken: true }))
    app.gym.startFromList('curl')
    wait(10)
    expect(() => app.gym.finishFromList()).not.toThrow()
    expect(savedSets(app)).toHaveLength(1)
  })

  it('V7B1-T5: Today shows only today\'s sets, newest first, with the right totals', async () => {
    const app = await openApp()
    const { log, sets } = app
    const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).getTime()
    log.recordSet({ kind: 'curl', endedAt: at(6, 23, 59), seconds: 29, reps: 12 }) // yesterday, just before midnight
    log.recordSet({ kind: 'walk', endedAt: at(7, 0, 5), seconds: 300, meters: 450 }) // just after
    log.recordSet({ kind: 'squat', endedAt: at(7, 14, 30), seconds: 24, reps: 10 })
    const now = at(7, 15, 0)
    const today = sets.todaysSets(savedSets(app), now)
    expect(today.map((set) => set.kind)).toEqual(['squat', 'walk'])
    expect(sets.totals(today)).toEqual({ count: 2, seconds: 324 })

    // The page itself
    const { TodayPage, EMPTY_TODAY } = await import('../shell/TodayPage')
    // (React marks where separate pieces of text meet with <!-- -->; a reader sees one line)
    const html = renderToString(createElement(TodayPage, { now })).replaceAll('<!-- -->', '')
    expect(html).toContain('2 sets · 5 min')
    expect(html.indexOf('Back squat')).toBeGreaterThan(-1)
    expect(html.indexOf('Back squat')).toBeLessThan(html.indexOf('Walk')) // newest first
    expect(html).toContain('10 reps · 0:24 · at 14:30')
    expect(html).toContain('0.45 km · 5:00 · at 0:05')
    expect(html).not.toContain('Bicep curls') // yesterday's
    expect(html.match(/>Remove</g)).toHaveLength(2)
    // A day with nothing done yet
    expect(renderToString(createElement(TodayPage, { now: at(8, 9, 0) }))).toContain(EMPTY_TODAY)
  })

  it('V7B1-T6: Remove takes a set out, and it stays out after a reload', async () => {
    const storage = fakeStorage()
    let app = await openApp(storage)
    const keep = app.log.recordSet({ kind: 'curl', endedAt: DAY_START, seconds: 29, reps: 12 })
    const mistake = app.log.recordSet({ kind: 'lateral', endedAt: DAY_START + 60_000, seconds: 3, reps: 1 })
    app.log.removeSet(mistake.id)
    expect(savedSets(app)).toEqual([keep])
    app = await openApp(storage) // reload
    expect(savedSets(app)).toEqual([keep])
  })

  it('V7B1-T7: the log imports nothing from three.js or the 3D code, and loads with the shell', () => {
    const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
      string,
      string
    >
    const resolve = (from: string, spec: string) => {
      const base = new URL(spec, 'file://' + from).pathname
      return [base, base + '.ts', base + '.tsx'].find((candidate) => candidate in sources) ?? base
    }
    // Follow real imports (not "import type", which disappears in the build)
    const reach = (start: string[]) => {
      const seen = new Set<string>()
      const problems: string[] = []
      const toVisit = [...start]
      while (toVisit.length) {
        const file = toVisit.pop()!
        if (seen.has(file) || !(file in sources)) continue
        seen.add(file)
        for (const match of sources[file].matchAll(/^(?:import|export)\s+(?!type\b)[^'"]*?from\s+'([^']+)'/gm)) {
          const spec = match[1]
          if (spec.startsWith('.')) toVisit.push(resolve(file, spec))
          else if (spec === 'three' || spec.startsWith('three/') || spec.startsWith('@react-three/')) problems.push(`${file} imports ${spec}`)
        }
      }
      return { seen, problems }
    }
    const logFiles = Object.keys(sources).filter((file) => file.startsWith('/src/log/') && !file.endsWith('.test.ts'))
    const fromLog = reach([...logFiles, '/src/shell/TodayPage.tsx'])
    expect(fromLog.problems).toEqual([])
    // No components besides the page itself (measurement files like proportions.ts are plain numbers)
    expect([...fromLog.seen].filter((file) => file.endsWith('.tsx') && file !== '/src/shell/TodayPage.tsx')).toEqual([])
    // It's part of the shell (so the shell's size budget, V6B3-T2, measures it)
    const shell = reach(['/src/main.tsx']).seen
    for (const file of [...logFiles, '/src/shell/TodayPage.tsx']) expect(shell.has(file), file).toBe(true)
  })
})
