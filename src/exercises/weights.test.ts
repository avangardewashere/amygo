import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { EXERCISES, type ExerciseKind, type Load } from './catalog'
import { fitKg, kgText, stepKg } from './load'
import { LOG_KEY, LOG_VERSION } from '../log/logStorage'
import { backupText } from '../log/backup'
import type { LoggedSet } from '../log/sets'

const WEIGHTS = 'gym3d.weights' // (spelt out: the saved key must not change by accident)
// Node's own modules, loaded by name at run time (the app's types don't include Node)
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)
const KINDS = Object.keys(EXERCISES) as ExerciseKind[]

// A stand-in for the browser's localStorage. `broken` makes every access throw,
// like a browser that blocks storage.
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
const savedLog = (sets: LoggedSet[]) => ({ [LOG_KEY]: JSON.stringify({ version: LOG_VERSION, sets }) })

// The clocks, under the test's control: the exercise clock (performance.now)
// and the time of day (Date.now), 2:00 pm on 7 Oct 2026 local time when t = 0
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime()
const DAY_START = at(2026, 10, 7, 14)
let t = 0
const wait = (seconds: number) => (t += seconds * 1000)
const REP = 2.4 // seconds per rep

beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
  vi.spyOn(Date, 'now').mockImplementation(() => DAY_START + t)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// "Open the page": a fresh copy of the app's state reading `storage`, with the
// log watching the gym, as main.tsx sets it up
async function openApp(storage = fakeStorage()) {
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  const app = {
    storage,
    weights: await import('./weights'),
    gym: await import('../interaction/gymStore'),
    build: await import('../build/buildStore'),
    log: await import('../log/logStore'),
    sets: await import('../log/sets'),
    text: await import('../interaction/activityText'),
    words: await import('../log/logText'),
    backup: await import('../log/backup'),
    tabs: await import('../shell/tabs'),
  }
  app.log.startLogging()
  return app
}
type App = Awaited<ReturnType<typeof openApp>>
const lastSet = (app: App) => app.log.getLog().sets.at(-1)!

// Do `reps` of an exercise from the Exercises list, then Finish
function doSet(app: App, kind: ExerciseKind, reps: number) {
  expect(app.gym.startFromList(kind), kind).toBe(true)
  wait(reps * REP + 0.2)
  app.gym.finishFromList()
  return lastSet(app)
}

// The Exercises page as it would show, and one exercise's row on it
const clean = (html: string) => html.replaceAll('<!-- -->', '').replaceAll('&#x27;', "'")
async function exercisesPage() {
  const { ExercisesPage } = await import('../shell/ExercisesPage')
  return clean(renderToString(createElement(ExercisesPage, { now: DAY_START })))
}
const row = (html: string, name: string) => html.split('<li>').find((part) => part.includes(`<span>${name}</span>`)) ?? ''

const DUMBBELLS: Load = { of: 'dumbbell', step: 1, min: 1, max: 50 }
const STACK: Load = { of: 'stack', step: 5, min: 5, max: 200 }
const BAR: Load = { of: 'bar', step: 2.5, min: 20, max: 300 }
// Decision D6, written out row by row (undefined: no weight)
const D6: Record<ExerciseKind, Load | undefined> = {
  curl: DUMBBELLS,
  lateral: DUMBBELLS,
  benchPress: DUMBBELLS,
  shoulderPress: DUMBBELLS,
  inclinePress: DUMBBELLS,
  seatedCurl: DUMBBELLS,
  legPress: STACK,
  chestFly: STACK,
  pushdown: STACK,
  cableRow: STACK,
  squat: BAR,
  pullup: undefined,
  walk: undefined,
  run: undefined,
  ride: undefined,
  sprint: undefined,
  row: undefined,
}

describe('Weights in kg', { timeout: 30_000 }, () => {
  it("V9B2-T1: every row's steps and range match D6; − and + never go below the minimum or above the maximum", async () => {
    for (const kind of KINDS) expect(EXERCISES[kind].load, kind).toEqual(D6[kind])
    // Every exercise done with dumbbells in the hands is weighed per dumbbell; nothing with a speed is weighed
    for (const kind of KINDS) {
      if (EXERCISES[kind].weights) expect(EXERCISES[kind].load?.of, kind).toBe('dumbbell')
      if (EXERCISES[kind].speed) expect(EXERCISES[kind].load, kind).toBeUndefined()
    }

    const app = await openApp()
    const { kgFor, nudgeKg, setKg } = app.weights
    for (const kind of KINDS) {
      const load = D6[kind]
      if (!load) {
        // No weight: nothing to pick, and picking does nothing
        expect(kgFor(kind), kind).toBeUndefined()
        setKg(kind, 10)
        nudgeKg(kind, 1)
        expect(kgFor(kind), kind).toBeUndefined()
        continue
      }
      expect(kgFor(kind), kind).toBe(load.min) // a row never touched starts at its minimum
      nudgeKg(kind, -1)
      expect(kgFor(kind), kind).toBe(load.min) // − at the bottom stays there
      // + all the way up: every stop is one step on, and it ends exactly at the maximum
      const stops = [kgFor(kind)!]
      for (let taps = 0; taps < 500 && kgFor(kind)! < load.max; taps++) {
        nudgeKg(kind, 1)
        stops.push(kgFor(kind)!)
      }
      expect(stops.length - 1, kind).toBe((load.max - load.min) / load.step)
      stops.forEach((kg, i) => expect(kg, kind).toBe(load.min + i * load.step))
      nudgeKg(kind, 1)
      expect(kgFor(kind), kind).toBe(load.max) // + at the top stays there
      nudgeKg(kind, -1)
      expect(kgFor(kind), kind).toBe(load.max - load.step)
    }

    // Each change is announced once to whoever is listening (that's how the stepper redraws)
    const heard = vi.fn()
    const stop = app.weights.subscribeWeights(heard)
    setKg('curl', 20)
    nudgeKg('curl', 1)
    expect(heard).toHaveBeenCalledTimes(2)
    expect(kgFor('curl')).toBe(21)
    stop()

    // A weight set from anywhere is brought into range and onto a step
    setKg('curl', 999)
    expect(kgFor('curl')).toBe(50)
    setKg('curl', -3)
    expect(kgFor('curl')).toBe(1)
    setKg('curl', 12.4)
    expect(kgFor('curl')).toBe(12)
    setKg('squat', 61) // the bar goes in 2.5s: 60, 62.5…
    expect(kgFor('squat')).toBe(60)
    setKg('squat', 61.3)
    expect(kgFor('squat')).toBe(62.5)
    setKg('legPress', NaN)
    expect(kgFor('legPress')).toBe(5)
    expect([fitKg(BAR, 20), fitKg(BAR, 19), fitKg(BAR, 301), fitKg(STACK, 7.4), fitKg(STACK, 7.6)]).toEqual([20, 20, 300, 5, 10])
    expect([stepKg(BAR, 20, -1), stepKg(BAR, 20, 1), stepKg(BAR, 300, 1), stepKg(STACK, 200, -1)]).toEqual([20, 22.5, 300, 195])
  })

  it('V9B2-T2: a set finished with a weight chosen carries that kg; cardio and pull-up sets never do', async () => {
    const app = await openApp()
    const { gym, weights, sets } = app

    // From the Exercises list
    weights.setKg('curl', 12)
    expect(doSet(app, 'curl', 10)).toMatchObject({ kind: 'curl', reps: 10, kg: 12 })
    // A machine never touched goes at its minimum (the stepper shows that before Start)
    expect(doSet(app, 'legPress', 8)).toMatchObject({ kind: 'legPress', reps: 8, kg: 5 })
    weights.setKg('squat', 62.5)
    expect(doSet(app, 'squat', 5)).toMatchObject({ kind: 'squat', reps: 5, kg: 62.5 })

    // From the menu at the machine (E): the same remembered weight
    const rack = app.build.getBuild().items.find((item) => item.type === 'dumbbellRack')!
    gym.setNearFurniture(rack.id)
    gym.menuActions('furniture', gym.getGym(), 'dumbbellRack').find((action) => action.label === 'Bicep curls')!.run()
    expect(gym.getGym().activity).toMatchObject({ kind: 'curl', kg: 12 })
    wait(6 * REP + 0.2)
    gym.stopExercise()
    expect(lastSet(app)).toMatchObject({ kind: 'curl', reps: 6, kg: 12 })

    // …and on a machine you step onto, where the exercise only begins on arrival
    weights.setKg('legPress', 80)
    const press = app.build.getBuild().items.find((item) => item.type === 'legPress')!
    gym.setNearFurniture(press.id)
    gym.menuActions('furniture', gym.getGym(), 'legPress').find((action) => action.label === 'Leg press')!.run()
    expect(gym.getGym().activity).toMatchObject({ kind: 'legPress', kg: 80, arrived: false })
    gym.stepOnto(gym.getGym().activity!.stand!)
    expect(gym.getGym().activity).toMatchObject({ kind: 'legPress', kg: 80, arrived: true })
    wait(7 * REP + 0.2)
    gym.stopExercise()
    expect(lastSet(app)).toMatchObject({ kind: 'legPress', reps: 7, kg: 80 })

    // The picker changed mid-set: this set keeps the weight it started with, the next one gets the new one
    gym.startFromList('curl')
    wait(3 * REP)
    weights.setKg('curl', 14)
    wait(3 * REP + 0.2)
    gym.finishFromList()
    expect(lastSet(app)).toMatchObject({ reps: 6, kg: 12 })
    expect(doSet(app, 'curl', 4)).toMatchObject({ reps: 4, kg: 14 })

    // Cardio and pull-ups: never a weight
    gym.startFromList('walk')
    wait(60)
    gym.finishFromList()
    expect(lastSet(app).kind).toBe('walk')
    expect('kg' in lastSet(app)).toBe(false)
    const pullups = doSet(app, 'pullup', 5)
    expect(pullups).toMatchObject({ kind: 'pullup', reps: 5 })
    expect('kg' in pullups).toBe(false)
    expect(gym.getGym().activity).toBe(null)
    // …even if an exercise in progress somehow carried one
    const going = { kind: 'pullup' as const, kg: 20, machineId: 'x', session: 1, arrived: true, startedAt: 0, faceYaw: 0 }
    const finished = sets.finishedPart(going, 5 * REP * 1000 + 100, DAY_START)!
    expect(finished.reps).toBe(5)
    expect('kg' in finished).toBe(false)
    const walking = { ...going, kind: 'walk' as const }
    expect('kg' in sets.finishedPart(walking, 60_000, DAY_START)!).toBe(false)
  })

  it('V9B2-T3: the last weight per exercise is remembered across a reload, and a row never seen starts at its minimum', async () => {
    const first = await openApp()
    first.weights.setKg('curl', 12)
    first.weights.setKg('squat', 62.5)
    first.weights.nudgeKg('legPress', 1) // 5 → 10
    expect(JSON.parse(first.storage.data.get(WEIGHTS)!)).toEqual({ version: 1, kg: { curl: 12, squat: 62.5, legPress: 10 } })

    const reloaded = await openApp(first.storage)
    expect(reloaded.weights.kgFor('curl')).toBe(12)
    expect(reloaded.weights.kgFor('squat')).toBe(62.5)
    expect(reloaded.weights.kgFor('legPress')).toBe(10)
    expect(reloaded.weights.kgFor('lateral')).toBe(1) // never seen: its minimum
    expect(reloaded.weights.kgFor('pushdown')).toBe(5)
    expect(doSet(reloaded, 'curl', 3)).toMatchObject({ kg: 12 }) // and it's what the next set uses

    // Saved weights that don't check out are ignored one by one, never a crash
    const odd = { curl: 'heavy', squat: 61, legPress: 9999, lateral: -4, walk: 30, cartwheel: 5, pushdown: null }
    const messy = await openApp(fakeStorage({ [WEIGHTS]: JSON.stringify({ version: 1, kg: odd }) }))
    expect(messy.weights.kgFor('curl')).toBe(1) // not a number: its minimum
    expect(messy.weights.kgFor('squat')).toBe(60) // onto a step
    expect(messy.weights.kgFor('legPress')).toBe(200) // into range
    expect(messy.weights.kgFor('lateral')).toBe(1)
    expect(messy.weights.kgFor('pushdown')).toBe(5)
    expect(messy.weights.kgFor('walk')).toBeUndefined()
    // …and only what checked out is ever written back (the next pick saves the whole list)
    messy.weights.setKg('curl', 2)
    expect(JSON.parse(messy.storage.data.get(WEIGHTS)!).kg).toEqual({ curl: 2, squat: 60, legPress: 200, lateral: 1 })
    for (const text of ['not JSON {', 'null', '[]', '"12"', JSON.stringify({ version: 2, kg: { curl: 12 } }), JSON.stringify({ version: 1 })]) {
      const app = await openApp(fakeStorage({ [WEIGHTS]: text }))
      expect(app.weights.kgFor('curl'), text).toBe(1)
    }

    // Storage blocked: the weight still holds for this visit
    const blocked = await openApp(fakeStorage({}, { broken: true }))
    blocked.weights.setKg('curl', 9)
    expect(blocked.weights.kgFor('curl')).toBe(9)
    expect(doSet(blocked, 'curl', 2)).toMatchObject({ kg: 9 })

    // Picking a weight touches nothing else that's saved
    const sets: LoggedSet[] = [{ id: 'a', kind: 'curl', endedAt: DAY_START, seconds: 24, reps: 10 }]
    const withLog = await openApp(fakeStorage(savedLog(sets)))
    const logText = withLog.storage.data.get(LOG_KEY)
    withLog.weights.setKg('curl', 20)
    expect(withLog.storage.data.get(LOG_KEY)).toBe(logText)
  })

  it('V9B2-T4: the weight shows on the popup, on each set, and in the day\'s summary', async () => {
    const app = await openApp()
    const { headline } = app.text
    const { setNumbers, daySummary, lastLine } = app.words
    expect(kgText(10)).toBe('10 kg')
    expect(kgText(62.5)).toBe('62.5 kg')

    // The popup (the header and the "now doing" card use the same words)
    app.weights.setKg('curl', 10)
    app.gym.startFromList('curl')
    expect(headline(app.gym.getGym().activity!)).toBe('Doing bicep curls · 10 kg')
    // …and the popup over the person in the gym draws those words
    const { ActivityBubble } = await import('../interaction/ActivityBubble')
    const popup = clean(renderToString(createElement(ActivityBubble, { activity: app.gym.getGym().activity! })))
    expect(popup).toContain('<strong>Doing bicep curls · 10 kg</strong>')
    app.gym.stopExercise()
    expect(headline({ kind: 'squat', kg: 62.5 })).toBe('Doing back squats · 62.5 kg')
    expect(headline({ kind: 'curl' })).toBe('Doing bicep curls')
    app.gym.startFromList('walk')
    expect(headline(app.gym.getGym().activity!)).toBe('Walking · 5.4 km/h') // cardio: as before
    app.gym.stopExercise()
    app.gym.startFromList('pullup')
    expect(headline(app.gym.getGym().activity!)).toBe('Doing pull-ups')
    app.gym.stopExercise()

    // A saved set
    let made = 0
    const curls = (reps: number, kg?: number, minute = made): LoggedSet => ({
      id: `s${made++}`,
      kind: 'curl',
      endedAt: DAY_START + minute * 60_000,
      seconds: reps * REP,
      reps,
      ...(kg !== undefined && { kg }),
    })
    expect(setNumbers(curls(12, 10))).toBe('12 reps · 10 kg')
    expect(setNumbers(curls(1, 10))).toBe('1 rep · 10 kg')
    expect(setNumbers(curls(12))).toBe('12 reps') // from before weights
    expect(setNumbers({ id: 'q', kind: 'squat', endedAt: DAY_START, seconds: 12, reps: 5, kg: 62.5 })).toBe('5 reps · 62.5 kg')
    expect(lastLine(curls(12, 10), DAY_START + 86_400_000)).toBe('Last: 12 reps · 10 kg · Yesterday')

    // The day's summary
    const walk: LoggedSet = { id: 'w', kind: 'walk', endedAt: DAY_START + 3_600_000, seconds: 300, meters: 450 }
    expect(daySummary([curls(12, 10), curls(12, 10), curls(12, 10)])).toBe('Bicep curls 3 × 12 @ 10 kg')
    expect(daySummary([curls(12, 10), curls(10, 12)])).toBe('Bicep curls 12 @ 10 kg, 10 @ 12 kg') // the mixed form
    expect(daySummary([curls(12, 10), curls(10, 10), curls(8, 10)])).toBe('Bicep curls 12, 10, 8 @ 10 kg')
    expect(daySummary([curls(12, 10), curls(12, 12.5)])).toBe('Bicep curls 12 @ 10 kg, 12 @ 12.5 kg')
    expect(daySummary([curls(12), curls(12), curls(12)])).toBe('Bicep curls 3 × 12') // old sets: as before
    // An old set beside newer ones says it has no weight (or "12, 10 @ 12 kg" would read as both at 12 kg)
    expect(daySummary([curls(12), curls(10, 12)])).toBe('Bicep curls 12 (no weight), 10 @ 12 kg')
    expect(daySummary([curls(12), curls(10), curls(8, 10)])).toBe('Bicep curls 12 (no weight), 10 (no weight), 8 @ 10 kg')
    expect(daySummary([curls(12, 12), curls(10, 12)])).toBe('Bicep curls 12, 10 @ 12 kg') // (both at 12 kg)
    expect(daySummary([curls(12, 10), curls(12, 10), walk])).toBe('Bicep curls 2 × 12 @ 10 kg · Walk 0.45 km')
  })

  it('V9B2-T5: best set: heavier beats more reps; at equal weight more reps wins; old sets without a weight rank as 0 kg', async () => {
    const app = await openApp()
    const { bestSet } = app.sets
    let made = 0
    const curls = (day: number, reps: number, kg?: number): LoggedSet => ({
      id: `b${made++}`,
      kind: 'curl',
      endedAt: at(2026, 10, day, 9),
      seconds: reps * REP,
      reps,
      ...(kg !== undefined && { kg }),
    })
    const best = (sets: LoggedSet[]) => {
      const forward = bestSet(sets)
      expect(bestSet([...sets].reverse())).toBe(forward) // whatever order they're in
      return forward
    }

    const light = curls(1, 12, 10)
    const heavy = curls(2, 8, 12)
    expect(best([light, heavy])).toBe(heavy) // heavier beats more reps
    const more = curls(3, 12, 12)
    expect(best([light, heavy, more])).toBe(more) // the same weight: more reps
    const old = curls(4, 30) // before weights: 30 reps, no kg
    const first = curls(5, 3, 1)
    expect(best([old, first])).toBe(first) // an old set counts as 0 kg, so it loses to any weight
    const olderStill = curls(1, 25)
    expect(best([old, olderStill])).toBe(old) // among old sets, more reps wins, as before
    const again = curls(6, 12, 12)
    expect(best([more, again])).toBe(more) // a tie: the first time you reached it
    expect(best([curls(1, 5, 0), curls(2, 9)])?.reps).toBe(9) // 0 kg and no weight rank the same: reps decide
    expect(bestSet([])).toBe(null)

    // Cardio is still by distance
    const walk = (day: number, meters: number): LoggedSet => ({ id: `w${made++}`, kind: 'walk', endedAt: at(2026, 10, day), seconds: meters / 1.5, meters })
    const far = walk(2, 900)
    expect(best([walk(1, 450), far, walk(3, 600)])).toBe(far)

    // An exercise's History marks the heaviest set as best
    const withSets = await openApp(fakeStorage(savedLog([light, heavy, old])))
    const { ExerciseHistoryPage } = await import('../shell/ExerciseHistoryPage')
    const page = clean(renderToString(createElement(ExerciseHistoryPage, { kind: 'curl', now: at(2026, 10, 7, 18) })))
    expect(withSets.log.getLog().sets).toHaveLength(3)
    expect(page).toMatch(/<span>Best<\/span><strong>8 reps · 12 kg<\/strong>/)
    expect(page).toMatch(/<span>Last time<\/span><strong>30 reps<\/strong>/)
  })

  it('V9B2-T6: an old saved log (no kg) and a Block 1 backup both load with every set intact', async () => {
    const old: LoggedSet[] = [
      { id: 'o1', kind: 'curl', endedAt: at(2026, 10, 1, 9), seconds: 28.8, reps: 12 },
      { id: 'o2', kind: 'walk', endedAt: at(2026, 10, 2, 9), seconds: 300, meters: 450 },
      { id: 'o3', kind: 'row', endedAt: at(2026, 10, 3, 9), seconds: 120, meters: 500, strokes: 52 },
      { id: 'o4', kind: 'squat', endedAt: at(2026, 10, 4, 9), seconds: 12, reps: 5 },
      { id: 'o5', kind: 'pullup', endedAt: at(2026, 10, 5, 9), seconds: 12, reps: 5 },
    ]
    // A log saved before weights
    const app = await openApp(fakeStorage(savedLog(old)))
    expect(app.log.getLog().sets).toEqual(old)
    for (const set of app.log.getLog().sets) expect('kg' in set, set.id).toBe(false)
    // A backup made by Block 1 (the same file format, no kg): into an empty browser
    const phone = await openApp()
    expect(phone.log.restoreBackup(backupText(old, DAY_START))).toMatchObject({ added: 5, skipped: 0 })
    expect(phone.log.getLog().sets).toEqual(old)
    // The saved formats did not change
    expect([LOG_VERSION, phone.backup.BACKUP_VERSION]).toEqual([1, 1])

    // New sets, with their weights, survive a reload and a backup too
    phone.weights.setKg('squat', 62.5)
    const squats = doSet(phone, 'squat', 5)
    expect(squats.kg).toBe(62.5)
    const all = phone.log.getLog().sets
    expect((await openApp(phone.storage)).log.getLog().sets).toEqual(all)
    const laptop = await openApp()
    laptop.log.restoreBackup(backupText(all, DAY_START))
    expect(laptop.log.getLog().sets).toEqual(all)
    expect(laptop.log.getLog().sets.find((set) => set.id === squats.id)?.kg).toBe(62.5)

    // A weight that isn't a real one costs that set (and it's counted); a weight
    // where none belongs (a walk, pull-ups) is left behind and the set kept
    const good = { id: 'g', kind: 'curl', endedAt: DAY_START, seconds: 24, reps: 10, kg: 0 } // 0 kg is a weight
    const entries = [
      good,
      { ...good, id: 'bad1', kg: 'heavy' },
      { ...good, id: 'bad2', kg: -5 },
      { ...good, id: 'bad3', kg: null },
      { ...old[1], id: 'walk-kg', kg: 10 },
      { ...old[4], id: 'pullup-kg', kg: 10 },
    ]
    const checked = laptop.sets.checkedSets(entries)
    expect(checked.skipped).toBe(3)
    expect(checked.sets.map((set) => [set.id, set.kg])).toEqual([
      ['g', 0],
      ['walk-kg', undefined],
      ['pullup-kg', undefined],
    ])
  })

  it('V9B2-T7: strength rows have a − kg + stepper beside Start showing the remembered weight; cardio and pull-ups have none', async () => {
    const app = await openApp()
    app.weights.setKg('curl', 12)
    let page = await exercisesPage()

    // One stepper per exercise that takes a weight, none on the others
    expect(page.match(/class="weight-stepper"/g)).toHaveLength(KINDS.filter((kind) => D6[kind]).length)
    for (const kind of KINDS) {
      const part = row(page, EXERCISES[kind].name)
      expect(part, kind).not.toBe('')
      expect(part.includes('weight-stepper'), kind).toBe(D6[kind] !== undefined)
    }
    expect(page).toContain('Weights are for each dumbbell, the stack on a machine, or the bar with its plates.')

    // It shows the weight Start will use, says what the number means, and sits before Start
    const curl = row(page, 'Bicep curls')
    const shows = (kg: string) => `<span class="weight-kg">${kg}</span>`
    expect(curl).toContain(shows('12 kg'))
    expect(curl).toContain('role="group" aria-label="Weight for Bicep curls (each dumbbell)"')
    expect(curl).toMatch(/aria-label="Lighter: Bicep curls">−<\/button><span class="weight-kg">12 kg<\/span><button[^>]*aria-label="Heavier: Bicep curls">\+<\/button>/)
    expect(curl.indexOf('weight-stepper')).toBeLessThan(curl.indexOf('>Start<'))
    expect(curl.indexOf('>History<')).toBeLessThan(curl.indexOf('weight-stepper')) // (the phone layout places them in this order)
    expect(row(page, 'Leg press')).toContain(`aria-label="Weight for Leg press (the machine's stack)"`)
    expect(row(page, 'Leg press')).toContain(shows('5 kg'))
    expect(row(page, 'Back squat')).toContain('aria-label="Weight for Back squat (the bar with its plates)"')
    expect(row(page, 'Back squat')).toContain(shows('20 kg'))

    // A change is read out from one line that starts empty; the numbers themselves aren't status lines
    // (eleven of them appearing with text would each be read out when the page opens)
    expect(page.match(/role="status"/g)).toHaveLength(1)
    expect(page).toContain('<p class="visually-hidden" role="status"></p>')
    expect(page).not.toContain('<output')

    // At the ends of the range the button that would go past is off
    const off = (part: string, label: string) => new RegExp(`disabled=""[^>]*aria-label="${label}|aria-label="${label}[^>]*disabled=""`).test(part)
    expect([off(curl, 'Lighter'), off(curl, 'Heavier')]).toEqual([false, false])
    expect([off(row(page, 'Back squat'), 'Lighter'), off(row(page, 'Back squat'), 'Heavier')]).toEqual([true, false]) // at its minimum
    app.weights.setKg('curl', 50)
    page = await exercisesPage()
    expect([off(row(page, 'Bicep curls'), 'Lighter'), off(row(page, 'Bicep curls'), 'Heavier')]).toEqual([false, true])

    // While an exercise is being done its weight is fixed (the set keeps what it started with); other rows stay free
    app.weights.setKg('curl', 12)
    app.gym.startFromList('curl')
    page = await exercisesPage()
    expect([off(row(page, 'Bicep curls'), 'Lighter'), off(row(page, 'Bicep curls'), 'Heavier')]).toEqual([true, true])
    expect([off(row(page, 'Leg press'), 'Lighter'), off(row(page, 'Leg press'), 'Heavier')]).toEqual([true, false]) // (at its minimum, not locked)
    // …and it shows the weight this set started with, even if the pick changes meanwhile (say, in another window)
    app.weights.setKg('curl', 14)
    page = await exercisesPage()
    expect(row(page, 'Bicep curls')).toContain(shows('12 kg'))
    app.gym.stopExercise()
    expect(row(await exercisesPage(), 'Bicep curls')).toContain(shows('14 kg')) // free again: the pick

    // The buttons do what they say (they can't be clicked without a browser, so read what they call)
    const sources = import.meta.glob('/src/shell/WeightStepper.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const stepper = sources['/src/shell/WeightStepper.tsx']
    expect(stepper).toMatch(/aria-label=\{`Lighter: \$\{name\}`\}[\s\S]*?onClick=\{\(\) => nudge\(-1\)\}/)
    expect(stepper).toMatch(/aria-label=\{`Heavier: \$\{name\}`\}[\s\S]*?onClick=\{\(\) => nudge\(1\)\}/)
    // …a tap changes the weight, then says what it now is…
    expect(stepper).toMatch(/const nudge = [^\n]*\{\s*nudgeKg\(kind, direction\)\s*said\.set\(\{ text: `\$\{name\} \$\{kgText\(kgFor\(kind\)!\)\}` \}\)/)
    // …and the number redraws because it's read through the store (see T1: every change is announced)
    expect(stepper).toMatch(/const picked = useKg\(kind\)/)
    const weightsSource = (import.meta.glob('/src/exercises/weights.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/exercises/weights.ts']
    expect(weightsSource).toMatch(/export const useKg = [\s\S]*?store\.useSelect\(/)

    // On a phone the row is laid out on purpose: History beside the name, the weight and Start together beneath.
    // Rows without a picker are laid out as they always were (they must not wrap).
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    const phone = css.slice(css.indexOf('@media (max-width: 599px) {\n  .machine-group li:has(.weight-stepper)'))
    expect(phone).toMatch(/^@media \(max-width: 599px\) \{\n  \.machine-group li:has\(\.weight-stepper\) \{\n    display: grid;\n    grid-template-columns: minmax\(0, 1fr\) auto auto;/)
    expect(phone).toMatch(/li:has\(\.weight-stepper\) \.exercise-name \{\n    grid-column: 1 \/ 3;/)
    expect(phone).toMatch(/li:has\(\.weight-stepper\) \.row-actions \{\n    display: contents;/)
    expect(phone).toMatch(/li:has\(\.weight-stepper\) \.weight-stepper \{\n    grid-column: 2;/)
    const block = (selector: string) => css.slice(css.indexOf(`\n${selector} {\n`), css.indexOf('}', css.indexOf(`\n${selector} {\n`)))
    expect(block('.machine-group li')).not.toContain('flex-wrap')
    expect(block('.row-actions')).toContain('flex: none')
    expect(block('.row-actions')).not.toContain('flex-wrap')

    // An exercise's own page has the same picker before its Start, free to change, with what the number means
    app.weights.setKg('squat', 62.5)
    const { ExerciseHistoryPage } = await import('../shell/ExerciseHistoryPage')
    const history = (kind: ExerciseKind) => clean(renderToString(createElement(ExerciseHistoryPage, { kind, now: DAY_START })))
    const startRow = history('squat').match(/<div class="history-start-row">[\s\S]*?<\/small><\/div>/)?.[0] ?? ''
    expect(startRow).toContain(shows('62.5 kg'))
    expect(startRow.indexOf('weight-stepper')).toBeLessThan(startRow.indexOf('>Start<'))
    expect(startRow.indexOf('weight-stepper')).toBeGreaterThan(-1)
    expect([off(startRow, 'Lighter'), off(startRow, 'Heavier')]).toEqual([false, false])
    expect(startRow).toContain('<small class="last-line weight-means">Weight: the bar with its plates</small>')
    expect(history('legPress')).toContain(`<small class="last-line weight-means">Weight: the machine's stack</small>`)
    expect(history('curl')).toContain('<small class="last-line weight-means">Weight: each dumbbell</small>')
    expect(history('walk')).not.toContain('weight-stepper')
    expect(history('walk')).not.toContain('weight-means')
    expect(history('pullup')).not.toContain('weight-stepper')
    // While that exercise is being done, the page has no picker (the set keeps the weight it started with)
    app.gym.startFromList('squat')
    expect(history('squat')).not.toContain('weight-stepper')
    expect(history('squat')).toContain('Doing back squats · 62.5 kg')
    app.gym.stopExercise()
  })

  it("V9B2-T8: a row with no weight picked here starts from its last logged set's weight; weights picked in another window are kept", async () => {
    // A log restored into a new browser brings its weights along: the row says "Last: 10 reps · 12 kg", and so does its picker
    const logged: LoggedSet[] = [
      { id: 'a', kind: 'curl', endedAt: at(2026, 10, 5, 9), seconds: 24, reps: 10, kg: 10 },
      { id: 'b', kind: 'curl', endedAt: at(2026, 10, 6, 9), seconds: 24, reps: 10, kg: 12 }, // the latest curls
      { id: 'c', kind: 'squat', endedAt: at(2026, 10, 6, 10), seconds: 12, reps: 5, kg: 62.5 },
      { id: 'd', kind: 'legPress', endedAt: at(2026, 10, 6, 11), seconds: 20, reps: 8 }, // from before weights
      { id: 'e', kind: 'chestFly', endedAt: at(2026, 10, 6, 12), seconds: 20, reps: 8, kg: 7 }, // off the machine's steps
      { id: 'f', kind: 'pushdown', endedAt: at(2026, 10, 5, 13), seconds: 20, reps: 8, kg: 20 },
      { id: 'g', kind: 'pushdown', endedAt: at(2026, 10, 6, 13), seconds: 20, reps: 8, kg: 30 }, // the latest pushdowns
    ]
    const fresh = await openApp()
    expect(fresh.weights.kgFor('curl')).toBe(1)
    fresh.log.restoreBackup(backupText(logged, DAY_START))
    expect(fresh.weights.kgFor('curl')).toBe(12)
    expect(fresh.weights.kgFor('squat')).toBe(62.5)
    expect(fresh.weights.kgFor('legPress')).toBe(5) // its last set has no weight: the minimum
    expect(fresh.weights.kgFor('chestFly')).toBe(5) // brought onto a step
    expect(fresh.weights.kgFor('lateral')).toBe(1) // never done
    expect(row(await exercisesPage(), 'Bicep curls')).toContain('<span class="weight-kg">12 kg</span>')
    expect(doSet(fresh, 'curl', 3)).toMatchObject({ kg: 12 }) // one tap on Start uses it
    // It isn't a pick, so it isn't saved as one: it's read from the log again on the next visit
    expect(fresh.storage.data.has(WEIGHTS)).toBe(false)
    expect((await openApp(fresh.storage)).weights.kgFor('squat')).toBe(62.5)
    // A weight picked here wins over the log, and + goes on from what was shown
    const again = await openApp(fresh.storage)
    again.weights.nudgeKg('squat', 1)
    expect(again.weights.kgFor('squat')).toBe(65)
    expect(doSet(again, 'squat', 2)).toMatchObject({ kg: 65 })
    again.weights.setKg('curl', 8)
    expect(doSet(again, 'curl', 2)).toMatchObject({ kg: 8 })
    // A row never picked keeps following the log: remove its latest set and it goes by the one before…
    expect(again.weights.kgFor('pushdown')).toBe(30)
    again.log.removeSet('g')
    expect(again.weights.kgFor('pushdown')).toBe(20)
    // …and with the history cleared there is nothing to go by: it's back at its minimum
    again.log.clearHistory(() => true)
    expect(again.weights.kgFor('pushdown')).toBe(5)
    expect(again.weights.kgFor('squat')).toBe(65) // (picked, so kept)
    expect((await openApp(fakeStorage(savedLog(logged)))).weights.kgFor('curl')).toBe(12) // …and read at the start, not only on restore

    // The installed app and a Chrome tab: two windows, one storage
    const shared = fakeStorage({ [WEIGHTS]: JSON.stringify({ version: 1, kg: { curl: 10 } }) })
    const tab = await openApp(shared)
    const tabWindow = new EventTarget()
    tab.weights.followWeights(tabWindow)
    const installed = await openApp(shared) // opened later, in the same browser
    installed.weights.setKg('squat', 60)
    // …the browser tells the tab its storage changed (as browsers do between windows)…
    tabWindow.dispatchEvent(Object.assign(new Event('storage'), { key: WEIGHTS }))
    expect(tab.weights.kgFor('squat')).toBe(60) // the tab shows it, and uses it
    // …and a weight picked in the tab is saved on top of the other window's, not over it
    tab.weights.nudgeKg('curl', 1)
    expect(JSON.parse(shared.data.get(WEIGHTS)!).kg).toEqual({ curl: 11, squat: 60 })
    // Other storage keys don't make it reread; a cleared storage does
    const heard = vi.fn()
    tab.weights.subscribeWeights(heard)
    tabWindow.dispatchEvent(Object.assign(new Event('storage'), { key: LOG_KEY }))
    expect(heard).not.toHaveBeenCalled()
    shared.data.delete(WEIGHTS)
    tabWindow.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
    expect(heard).toHaveBeenCalledTimes(1)
    expect(tab.weights.kgFor('squat')).toBe(20)

    // A log change in the other window (a restore there) moves this window's unpicked rows too
    tab.log.followOtherWindows(tabWindow)
    expect(tab.weights.kgFor('pushdown')).toBe(5)
    installed.log.restoreBackup(backupText(logged, DAY_START))
    tabWindow.dispatchEvent(Object.assign(new Event('storage'), { key: LOG_KEY }))
    expect(tab.weights.kgFor('pushdown')).toBe(30)

    // The app itself switches this on: startApp(), which main.tsx calls, follows the real window
    const browserWindow = new EventTarget()
    const app = await openApp(fakeStorage())
    vi.stubGlobal('window', browserWindow)
    const stopApp = (await import('../shell/startup')).startApp()
    app.storage.data.set(WEIGHTS, JSON.stringify({ version: 1, kg: { legPress: 100 } }))
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: WEIGHTS }))
    expect(app.weights.kgFor('legPress')).toBe(100)
    stopApp()
  })
})
