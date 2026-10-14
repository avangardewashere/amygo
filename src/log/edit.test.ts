import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { ROWER, strokesSince } from '../equipment/rowerGeometry'
import { backupText } from './backup'
import { LOG_KEY, LOG_VERSION } from './logStorage'
import type { LoggedSet } from './sets'

// Node's own modules, loaded by name at run time (the app's types don't include Node)
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)

// A stand-in for the browser's localStorage holding `sets` as the log saves them
function fakeStorage(sets: LoggedSet[] = []) {
  const data = new Map([[LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets })]])
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  }
}
const saved = (storage: ReturnType<typeof fakeStorage>) => JSON.parse(storage.data.get(LOG_KEY)!).sets as LoggedSet[]

// Times in local time; "now" is 6 pm on 7 Oct 2026
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime()
const NOW = at(2026, 10, 7, 18)
const TODAY = (hour: number, minute = 0) => at(2026, 10, 7, hour, minute)
const YESTERDAY = (hour: number) => at(2026, 10, 6, hour)
const REP = 2.4

const curls = (id: string, endedAt: number, reps: number, kg?: number): LoggedSet => ({
  id,
  kind: 'curl',
  endedAt,
  seconds: reps * REP,
  reps,
  ...(kg !== undefined && { kg }),
})
const walk = (id: string, endedAt: number, seconds = 300): LoggedSet => ({ id, kind: 'walk', endedAt, seconds, meters: Math.round(seconds * 1.5 * 100) / 100 })
const row = (id: string, endedAt: number, seconds = 120): LoggedSet => ({
  id,
  kind: 'row',
  endedAt,
  seconds,
  meters: Math.round(seconds * ROWER.speed * 100) / 100,
  strokes: strokesSince(seconds),
})

beforeEach(() => {
  vi.spyOn(Date, 'now').mockImplementation(() => NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
// Only the timers are the test's to move (Undo's six seconds, the pause after typing); the clock stays put
const holdTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

// "Open the page" in a browser holding these sets: a fresh copy of the app's state
async function openApp(sets: LoggedSet[] = []) {
  const storage = fakeStorage(sets)
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  const app = {
    storage,
    log: await import('./logStore'),
    editing: await import('./editing'),
    rules: await import('./edit'),
    sets: await import('./sets'),
    words: await import('./logText'),
    weights: await import('../exercises/weights'),
  }
  // Open a set's form afresh, fill it in and press Save, as the page does
  const fix = (id: string, typed: Record<string, string>) => {
    app.editing.cancelEdit()
    app.editing.startEdit(id)
    for (const [field, text] of Object.entries(typed)) app.editing.typeEdit(field as 'reps', text)
    return app.editing.saveEdit()
  }
  const set = (id: string) => app.log.getLog().sets.find((candidate) => candidate.id === id)!
  const ids = () => app.log.getLog().sets.map((candidate) => candidate.id)
  return { ...app, fix, set, ids }
}

// A page as it would show. (A row's text is drawn in parts that never break across lines; read here as plain text.)
const clean = (html: string) =>
  html
    .replaceAll('<!-- -->', '')
    .replaceAll('&#x27;', "'")
    .replace(/<span class="part">([^<]*)<\/span>/g, '$1')
async function todayPage() {
  const { TodayPage } = await import('../shell/TodayPage')
  return clean(renderToString(createElement(TodayPage, { now: NOW })))
}
async function historyPage(kind: ExerciseKind) {
  const { ExerciseHistoryPage } = await import('../shell/ExerciseHistoryPage')
  return clean(renderToString(createElement(ExerciseHistoryPage, { kind, now: NOW })))
}
// The rows of a page's set lists, in order, as plain text ("Bicep curls 12 reps · 10 kg · 0:28 · at 9:00 Edit Remove")
const rows = (html: string) =>
  [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
// The Today page in two: today's part, and the earlier days
const halves = (page: string) => {
  const cut = page.indexOf('<h3 class="earlier-title">Earlier')
  return cut < 0 ? { today: page.slice(0, page.indexOf('class="log-tools"')), earlier: '' } : { today: page.slice(0, cut), earlier: page.slice(cut, page.indexOf('class="log-tools"')) }
}

describe('Fix a set', { timeout: 30_000 }, () => {
  it('V9B3-T1: editing reps and kg changes only that set; its id, exercise and time of day are kept, and the change is saved', async () => {
    const before = [
      curls('a', TODAY(9), 12, 10),
      { ...curls('b', TODAY(10), 10, 12), effort: 7 } as LoggedSet, // (a number a newer Amygo might add: it stays)
      walk('c', TODAY(11)),
      { id: 'p', kind: 'pullup', endedAt: TODAY(12), seconds: 12, reps: 5 } as LoggedSet,
    ]
    const app = await openApp(before)
    const shown = app.log.getLog().sets
    const [a, b, c, p] = shown
    const heard = vi.fn()
    app.log.subscribeLog(heard)

    expect(app.fix('b', { reps: '8', kg: '14' })).toBe(true)
    expect(app.set('b')).toEqual({ id: 'b', kind: 'curl', endedAt: TODAY(10), seconds: 10 * REP, reps: 8, kg: 14, effort: 7 })
    expect(app.editing.getEditing()).toBe(null) // the form closed
    // The pages are told, once, and get a new list with a new set in it (that's what makes them redraw)
    expect(heard).toHaveBeenCalledTimes(1)
    expect(app.log.getLog().sets).not.toBe(shown)
    expect(app.set('b')).not.toBe(b)
    // The others are the very same sets as before
    expect(app.set('a')).toBe(a)
    expect(app.set('c')).toBe(c)
    expect(app.set('p')).toBe(p)
    expect(app.ids()).toEqual(['a', 'b', 'c', 'p'])
    // Saved: the same after a reload
    expect(saved(app.storage)).toEqual(app.log.getLog().sets)
    expect((await openApp(saved(app.storage))).set('b')).toMatchObject({ reps: 8, kg: 14 })

    // One number at a time; a weight between the picker's steps is fine; "12,5" is read as 12.5
    const again = await openApp(before)
    expect(again.fix('a', { reps: '15' })).toBe(true)
    expect(again.set('a')).toMatchObject({ reps: 15, kg: 10 })
    expect(again.fix('a', { kg: '12,5' })).toBe(true)
    expect(again.set('a')).toMatchObject({ reps: 15, kg: 12.5 })
    // The weight emptied: the set has none any more
    expect(again.fix('a', { kg: '' })).toBe(true)
    expect('kg' in again.set('a')).toBe(false)
    expect(again.set('a').reps).toBe(15)
    // …and one can be given to a set that had none
    expect(again.fix('a', { kg: '9' })).toBe(true)
    expect(again.set('a').kg).toBe(9)

    // Pull-ups take no weight: only reps can change
    expect(again.rules.typedFor(again.set('p'))).toEqual({ reps: '5' })
    expect(again.fix('p', { reps: '7', kg: '20' })).toBe(true)
    expect(again.set('p')).toEqual({ id: 'p', kind: 'pullup', endedAt: TODAY(12), seconds: 12, reps: 7 })
    expect('kg' in again.rules.applyEdit(again.set('p'), { kg: 20 })).toBe(false)

    // An edit can't reach what it isn't about
    const fixed = again.rules.applyEdit(again.set('a'), { reps: 3, kg: 20, seconds: 99 })
    expect(fixed).toMatchObject({ id: 'a', kind: 'curl', endedAt: TODAY(9), seconds: 12 * REP, reps: 3, kg: 20 })
    expect(again.log.editSet('nobody', { reps: 3 })).toBe(null)
  })

  it("V9B3-T2: editing a cardio set's time recalculates its distance (and strokes on the rower) at the exercise's speed", async () => {
    const tagged = { ...walk('w', TODAY(9), 300), effort: 6 } as LoggedSet
    const app = await openApp([tagged, row('r', TODAY(10), 120), curls('k', TODAY(11), 12, 10)])
    expect(app.rules.typedFor(app.set('w'))).toEqual({ minutes: '5', seconds: '00' })

    expect(app.fix('w', { minutes: '10', seconds: '30' })).toBe(true)
    expect(app.set('w')).toEqual({ id: 'w', kind: 'walk', endedAt: TODAY(9), seconds: 630, meters: 945, effort: 6 }) // 1.5 m/s
    expect(app.fix('r', { minutes: '4', seconds: '0' })).toBe(true)
    expect(app.set('r')).toEqual({
      id: 'r',
      kind: 'row',
      endedAt: TODAY(10),
      seconds: 240,
      meters: Math.round(ROWER.speed * 240 * 100) / 100,
      strokes: strokesSince(240),
    })
    expect(app.set('r').strokes).toBeGreaterThan(strokesSince(120))
    expect(saved(app.storage)).toEqual(app.log.getLog().sets)

    // The same numbers a set of that length gets when it's saved as it finishes
    for (const kind of ['walk', 'run', 'ride', 'sprint', 'row'] as ExerciseKind[]) {
      const going = { kind, machineId: 'm', session: 1, arrived: true, startedAt: 0, faceYaw: 0 }
      const finished = app.sets.finishedPart(going, 754_000, NOW)!
      const edited = app.rules.applyEdit({ id: 'x', kind, endedAt: NOW, seconds: 60, meters: 1 }, { seconds: 754 })
      expect({ ...edited, id: undefined }, kind).toEqual({ ...finished, id: undefined })
      expect(edited.meters, kind).toBeCloseTo(EXERCISES[kind].speed! * 754, 1)
    }
    // A strength set has no time to edit, and a cardio set no reps
    expect(app.rules.typedFor(app.set('k'))).toEqual({ reps: '12', kg: '10' })
    expect(app.rules.applyEdit(app.set('w'), { reps: 9, kg: 9 })).toEqual(app.set('w'))
  })

  it('V9B3-T3: 0 reps, 5 seconds, a weight outside the range, or letters are refused with a reason, and the set stays as it was', async () => {
    const squat: LoggedSet = { id: 's', kind: 'squat', endedAt: TODAY(8), seconds: 12, reps: 5, kg: 60 }
    const app = await openApp([curls('a', TODAY(9), 12, 10), walk('w', TODAY(10), 300), squat])
    const shown = app.log.getLog().sets
    const savedText = app.storage.data.get(LOG_KEY)
    const heard = vi.fn()
    app.log.subscribeLog(heard)
    const REPS = 'Reps: a whole number from 1 to 999.'
    const DUMBBELL = 'Weight: from 1 to 50 kg, or empty for none.'
    const CLOCK = 'Time: whole minutes, and seconds from 0 to 59.'

    const refused: [string, Record<string, string>, Record<string, string>][] = [
      ['a', { reps: '0' }, { reps: REPS }],
      ['a', { reps: '' }, { reps: REPS }],
      ['a', { reps: 'twelve' }, { reps: REPS }],
      ['a', { reps: '1.5' }, { reps: REPS }],
      ['a', { reps: '-3' }, { reps: REPS }],
      ['a', { reps: '1000' }, { reps: REPS }],
      ['a', { kg: '0.5' }, { kg: DUMBBELL }],
      ['a', { kg: '51' }, { kg: DUMBBELL }],
      ['a', { kg: 'heavy' }, { kg: DUMBBELL }],
      ['a', { kg: '12.345' }, { kg: DUMBBELL }],
      ['a', { kg: '12.' }, { kg: DUMBBELL }], // (still being typed)
      ['a', { reps: '0', kg: '99' }, { reps: REPS, kg: DUMBBELL }], // both said
      ['a', { reps: '8', kg: '99' }, { kg: DUMBBELL }], // one right, one wrong: nothing is saved, not even the right one
      ['s', { kg: '10' }, { kg: 'Weight: from 20 to 300 kg, or empty for none.' }], // lighter than the bar
      ['w', { minutes: '0', seconds: '5' }, { time: 'Time: at least 10 seconds.' }],
      ['w', { minutes: '', seconds: '' }, { time: 'Time: at least 10 seconds.' }],
      ['w', { minutes: '5', seconds: '60' }, { time: CLOCK }],
      ['w', { minutes: '5', seconds: '75' }, { time: CLOCK }],
      ['w', { minutes: 'five', seconds: '00' }, { time: CLOCK }],
      ['w', { minutes: '2.5', seconds: '00' }, { time: CLOCK }],
      ['w', { minutes: '1500', seconds: '00' }, { time: 'Time: 24 hours at most.' }],
    ]
    for (const [id, typed, errors] of refused) {
      const label = `${id} ${JSON.stringify(typed)}`
      expect(app.fix(id, typed), label).toBe(false)
      const open = app.editing.getEditing()!
      expect(open.id, label).toBe(id) // the form stays open, holding what was typed
      expect(open.typed, label).toMatchObject(typed)
      expect(open.settled, label).toBe(true) // and says why at once
      expect(app.rules.checkEdit(app.set(id), open.typed).errors, label).toEqual(errors)
    }
    app.editing.cancelEdit()
    // Exactly as before: the same sets on screen, the same saved text, and no change announced
    expect(app.log.getLog().sets).toBe(shown)
    expect(app.storage.data.get(LOG_KEY)).toBe(savedText)
    expect(heard).not.toHaveBeenCalled()

    // The ends of each range are allowed
    expect(app.rules.checkEdit(app.set('a'), { reps: '1', kg: '1' })).toEqual({ edit: { reps: 1, kg: 1 }, errors: {} })
    expect(app.rules.checkEdit(app.set('a'), { reps: '999', kg: '50' })).toEqual({ edit: { reps: 999, kg: 50 }, errors: {} })
    expect(app.rules.checkEdit(app.set('w'), { minutes: '0', seconds: '10' })).toEqual({ edit: { seconds: 10 }, errors: {} })
    expect(app.rules.checkEdit(app.set('w'), { minutes: '4', seconds: '59' })).toEqual({ edit: { seconds: 299 }, errors: {} })
    expect(app.rules.checkEdit(app.set('w'), { minutes: '1440', seconds: '0' })).toEqual({ edit: { seconds: 86_400 }, errors: {} })

    // A number left as it was is never the problem, even one outside today's limits (say, from another
    // version's backup): the other number can still be fixed
    const odd = { ...curls('o', TODAY(7), 12, 60), kg: 60 } // heavier than any dumbbell here
    const none = { ...curls('z', TODAY(6), 0, 10) } // no reps
    expect(app.rules.checkEdit(odd, { reps: '10', kg: '60' })).toEqual({ edit: { reps: 10 }, errors: {} })
    expect(app.rules.checkEdit(none, { reps: '0', kg: '12' })).toEqual({ edit: { kg: 12 }, errors: {} })
    expect(app.rules.checkEdit({ ...curls('k0', TODAY(5), 12, 0) }, { reps: '11', kg: '0' })).toEqual({ edit: { reps: 11 }, errors: {} })
  })

  it('V9B3-T4: Undo within six seconds puts the set back with the same id and in its place; after six seconds it is gone', async () => {
    holdTimers()
    const a = curls('a', TODAY(9), 12, 10)
    const b = curls('b', TODAY(10), 10, 12)
    const c = walk('c', TODAY(11))
    const app = await openApp([a, b, c])
    const original = app.set('b')

    // Remove: out of the log (and saved so), kept aside with Undo
    app.log.removeSet('b')
    expect(app.ids()).toEqual(['a', 'c'])
    expect(saved(app.storage).map((set) => set.id)).toEqual(['a', 'c'])
    expect(app.log.getLog().removed.map((set) => set.id)).toEqual(['b'])
    // On the page its row stays where it was, between the other two, and the sums no longer count it
    let page = await todayPage()
    expect(rows(page)).toEqual([
      'Walk 0.45 km · 5:00 · at 11:00 Edit Remove',
      'Removed Bicep curls · 10 reps · 12 kg Undo',
      'Bicep curls 12 reps · 10 kg · 0:28 · at 9:00 Edit Remove',
    ])
    expect(page).toContain('2 sets · 5 min')

    // Undo just inside the six seconds: back, the very same set, in its place
    vi.advanceTimersByTime(5_900)
    expect(app.log.undoRemove('b')).toBe(true)
    expect(app.ids()).toEqual(['a', 'b', 'c'])
    expect(app.set('b')).toBe(original)
    expect(app.log.getLog().removed).toEqual([])
    expect(saved(app.storage)).toEqual([a, b, c])
    page = await todayPage()
    expect(rows(page).map((text) => text.split(' ').slice(0, 2).join(' '))).toEqual(['Walk 0.45', 'Bicep curls', 'Bicep curls'])
    expect(page).toContain('3 sets · 6 min')
    expect(page).not.toContain('Undo')
    expect(app.weights.kgFor('curl')).toBe(12) // (and the weight picker goes by the latest set again)

    // Removed again straight away: this Undo has six seconds of its own (the first Remove's clock is not still running)
    app.log.removeSet('b')
    vi.advanceTimersByTime(5_999)
    expect(app.log.getLog().removed.map((set) => set.id)).toEqual(['b'])
    expect(app.weights.kgFor('curl')).toBe(10)
    // Left alone, the Undo goes after six seconds, and the set with it for good
    vi.advanceTimersByTime(1)
    expect(app.log.getLog().removed).toEqual([])
    expect(app.log.undoRemove('b')).toBe(false)
    expect(app.ids()).toEqual(['a', 'c'])
    expect(await todayPage()).not.toContain('Removed')
    expect((await openApp(saved(app.storage))).ids()).toEqual(['a', 'c'])

    // Two rows removed: two Undo lines, each with its own six seconds
    const two = await openApp([a, b, c])
    two.log.removeSet('a')
    vi.advanceTimersByTime(4_000)
    two.log.removeSet('c')
    expect(two.log.getLog().removed.map((set) => set.id)).toEqual(['a', 'c'])
    expect(rows(await todayPage()).filter((text) => text.startsWith('Removed'))).toHaveLength(2)
    vi.advanceTimersByTime(2_000) // a's six seconds are up; c has four left
    expect(two.log.getLog().removed.map((set) => set.id)).toEqual(['c'])
    expect(two.log.undoRemove('a')).toBe(false)
    expect(two.log.undoRemove('c')).toBe(true)
    expect(two.ids()).toEqual(['b', 'c'])

    // Leaving the page drops what was removed for good; so does Clear history; removing what isn't there does nothing
    two.log.removeSet('b')
    two.log.forgetRemoved()
    expect(two.log.getLog().removed).toEqual([])
    expect(two.log.undoRemove('b')).toBe(false)
    two.log.removeSet('c')
    two.log.clearHistory(() => true)
    expect(two.log.undoRemove('c')).toBe(false)
    expect(two.log.getLog()).toMatchObject({ sets: [], removed: [] })
    two.log.removeSet('nobody')
    expect(two.log.getLog().removed).toEqual([])
    expect(two.log.UNDO_SECONDS).toBe(6)

    // Remove and Undo sit in the same spot, so the second tap of a double-tap is ignored, not taken as the opposite
    const taps = await openApp([a, b, c])
    const t0 = NOW
    expect(taps.log.tapRemove('b', t0)).toBe(true)
    expect(taps.log.tapUndo('b', t0 + 250)).toBe(false) // (a double-tap on Remove: still removed, Undo still on offer)
    expect(taps.log.getLog().removed.map((set) => set.id)).toEqual(['b'])
    expect(taps.log.tapUndo('b', t0 + 700)).toBe(true)
    expect(taps.log.tapRemove('b', t0 + 950)).toBe(false) // (a double-tap on Undo: still back)
    expect(taps.ids()).toEqual(['a', 'b', 'c'])
    expect(taps.log.tapRemove('b', t0 + 1_400)).toBe(true) // a real second thought, a moment later, counts
    expect(taps.log.tapRemove('a', t0 + 1_450)).toBe(true) // (another row is never held up)
    expect(taps.log.tapRemove('nobody', t0)).toBe(false)
    expect(taps.log.FLIP_PAUSE_MS).toBeGreaterThanOrEqual(500)
    // (timed on the page's steady clock when the page calls it: the time of day can be set back)
    const steady = vi.spyOn(performance, 'now').mockReturnValue(5_000)
    expect(taps.log.tapRemove('c')).toBe(true)
    steady.mockReturnValue(5_300)
    expect(taps.log.tapUndo('c')).toBe(false)
    steady.mockReturnValue(5_700)
    expect(taps.log.tapUndo('c')).toBe(true)
    expect(taps.ids()).toEqual(['c'])

    // A set that comes back while its Undo is on offer (a backup holding it is restored) is simply back:
    // shown once, counted, and Undo can't save it twice
    const back = await openApp([a, b, c])
    back.log.removeSet('b')
    expect(back.log.restoreBackup(backupText([b], NOW))).toMatchObject({ added: 1 })
    expect(back.log.getLog().removed).toEqual([])
    expect(back.ids()).toEqual(['a', 'b', 'c'])
    page = await todayPage()
    expect(rows(page)).toHaveLength(3)
    expect(page).not.toContain('Removed')
    expect(page).toContain('3 sets · 6 min')
    expect(back.log.undoRemove('b')).toBe(false)
    expect(back.ids()).toEqual(['a', 'b', 'c'])
    vi.advanceTimersByTime(10_000)
    expect(back.ids()).toEqual(['a', 'b', 'c'])

    // The days on the page: today's only set removed, then one of yesterday's two
    const days = await openApp([curls('y1', YESTERDAY(9), 12, 10), curls('y2', YESTERDAY(10), 8, 14), curls('t', TODAY(9), 12, 10)])
    days.log.removeSet('t')
    let shown = halves(await todayPage())
    expect(shown.today).not.toContain('No sets yet today') // not "nothing today": the Undo row is there
    expect(rows(shown.today)).toEqual(['Removed Bicep curls · 12 reps · 10 kg Undo'])
    expect(shown.today).toContain('0 sets · 0 s')
    expect(shown.earlier).not.toContain('Removed') // and it shows on its own day only
    expect(rows(shown.earlier)).toHaveLength(2)
    days.log.undoRemove('t')
    days.log.removeSet('y1')
    shown = halves(await todayPage())
    expect(shown.today).not.toContain('Removed')
    expect(rows(shown.today)).toHaveLength(1)
    expect(rows(shown.earlier)).toEqual(['Bicep curls 8 reps · 14 kg · 0:19 · at 10:00 Edit Remove', 'Removed Bicep curls · 12 reps · 10 kg Undo'])
    expect(shown.earlier).toContain('<strong>Yesterday · 1 set · 19 s</strong><span>Bicep curls 1 × 8 @ 14 kg</span>') // sums and summary: only what's left
  })

  it("V9B3-T5: after an edit, the day's totals and summary and the exercise's best set reflect the new numbers", async () => {
    const app = await openApp([
      curls('y1', YESTERDAY(9), 12, 10),
      curls('y2', YESTERDAY(10), 12, 10),
      walk('y3', YESTERDAY(11), 300),
      curls('t1', TODAY(9), 12, 10),
      walk('t2', TODAY(10), 300),
    ])
    let page = await todayPage()
    expect(page).toContain('2 sets · 5 min') // today
    expect(page).toContain('Yesterday · 3 sets · 6 min')
    expect(page).toContain('Bicep curls 2 × 12 @ 10 kg · Walk 0.45 km')
    expect(app.sets.bestSet(app.sets.setsOf(app.log.getLog().sets, 'curl'))?.id).toBe('y1')

    // Yesterday's second set was really 8 reps at 14 kg, and its walk 20 minutes
    expect(app.fix('y2', { reps: '8', kg: '14' })).toBe(true)
    expect(app.fix('y3', { minutes: '20', seconds: '00' })).toBe(true)
    // …and today's walk 12 and a half minutes
    expect(app.fix('t2', { minutes: '12', seconds: '30' })).toBe(true)
    page = await todayPage()
    expect(page).toContain('2 sets · 13 min')
    expect(page).toContain('Yesterday · 3 sets · 21 min')
    expect(page).toContain('Bicep curls 12 @ 10 kg, 8 @ 14 kg · Walk 1.80 km')
    expect(rows(page)).toContain('Walk 1.13 km · 12:30 · at 10:00 Edit Remove')
    // The heavier set is the best now, and the exercise's own page says so
    expect(app.sets.bestSet(app.sets.setsOf(app.log.getLog().sets, 'curl'))?.id).toBe('y2')
    const history = await historyPage('curl')
    expect(history).toMatch(/<span>Best<\/span><strong>8 reps · 14 kg<\/strong><small>Yesterday<\/small>/)
    expect(history).toMatch(/<span>Last time<\/span><strong>12 reps · 10 kg<\/strong><small>Today<\/small>/)
    // Edited back down, the first set to reach 12 at 10 kg is best again
    expect(app.fix('y2', { reps: '12', kg: '10' })).toBe(true)
    expect(app.sets.bestSet(app.sets.setsOf(app.log.getLog().sets, 'curl'))?.id).toBe('y1')
    // The line on the Exercises list follows the latest set too, and so does the weight its picker starts from
    expect(app.weights.kgFor('curl')).toBe(10)
    expect(app.fix('t1', { reps: '9', kg: '16' })).toBe(true)
    expect(app.words.lastLine(app.sets.lastSets(app.log.getLog().sets).curl!, NOW)).toBe('Last: 9 reps · 16 kg · Today')
    expect(app.weights.kgFor('curl')).toBe(16)

    // An older backup restored afterwards doesn't undo the fix: this browser's copy of a set it has stays
    const asItWas = backupText([curls('t1', TODAY(9), 12, 10), walk('y3', YESTERDAY(11), 300)], NOW)
    expect(app.log.restoreBackup(asItWas)).toMatchObject({ added: 0, already: 2 })
    expect(app.set('t1')).toMatchObject({ reps: 9, kg: 16 })
    expect(app.set('y3')).toMatchObject({ seconds: 1200, meters: 1800 })
  })

  it('V9B3-T6: Cancel and Escape leave the set unchanged', async () => {
    const odd = { ...walk('w', TODAY(10), 300.25), meters: 450.38 } // as the gym saves it: not a whole second
    const late = { ...walk('v', TODAY(11), 299.6), meters: 449.4 } // shown as 4:59 (the row's clock cuts the fraction off)
    const app = await openApp([curls('a', TODAY(9), 12, 10), odd, late])
    const shown = app.log.getLog().sets
    const savedText = app.storage.data.get(LOG_KEY)
    const heard = vi.fn()
    app.log.subscribeLog(heard)

    // Typed, then Cancel
    app.editing.startEdit('a')
    app.editing.typeEdit('reps', '99')
    app.editing.typeEdit('kg', '45')
    expect(app.editing.getEditing()).toMatchObject({ id: 'a', typed: { reps: '99', kg: '45' } })
    app.editing.cancelEdit()
    expect(app.editing.getEditing()).toBe(null)
    // Opened again, the form shows the set's own numbers, not what was typed last time
    app.editing.startEdit('a')
    expect(app.editing.getEditing()).toMatchObject({ id: 'a', typed: { reps: '12', kg: '10' } })
    app.editing.cancelEdit()

    // Save with nothing changed changes nothing either: the form shows what the row shows (5:00 for 300.25 s,
    // 4:59 for 299.6 s), and the fraction of a second stays
    expect(app.rules.typedFor(app.set('w'))).toEqual({ minutes: '5', seconds: '00' })
    expect(app.rules.typedFor(app.set('v'))).toEqual({ minutes: '4', seconds: '59' })
    expect(rows(await todayPage())[0]).toBe('Walk 0.45 km · 4:59 · at 11:00 Edit Remove')
    expect(app.fix('w', {})).toBe(true)
    expect(app.fix('v', {})).toBe(true)
    expect(app.fix('v', { minutes: '4', seconds: '59' })).toBe(true) // typed again as shown: still no change
    expect(app.fix('a', { reps: '12', kg: '10.0' })).toBe(true)
    expect(app.editing.getEditing()).toBe(null)

    expect(app.log.getLog().sets).toBe(shown)
    expect(app.set('w')).toEqual(odd)
    expect(app.set('v')).toEqual(late)
    expect(app.storage.data.get(LOG_KEY)).toBe(savedText)
    expect(heard).not.toHaveBeenCalled()
    // Nothing to do without a form, or for a set that isn't there
    expect(app.editing.saveEdit()).toBe(false)
    expect(app.editing.startEdit('nobody')).toBe(false)
    expect(app.editing.getEditing()).toBe(null)
    app.editing.typeEdit('reps', '5')
    expect(app.editing.getEditing()).toBe(null)
    // (a real change to that walk does save: 5:00 is 300 s)
    expect(app.fix('v', { minutes: '5', seconds: '00' })).toBe(true)
    expect(app.set('v')).toMatchObject({ seconds: 300, meters: 450 })

    // Edit on another row while this form holds a change: this form stays open and the other doesn't open.
    // The change is neither thrown away nor saved as it stands ("1" may be on its way to "15").
    expect(app.editing.startEdit('a')).toBe(true)
    app.editing.typeEdit('reps', '1')
    expect(app.editing.getEditing()).toMatchObject({ blocked: false })
    expect(app.editing.startEdit('w')).toBe(false)
    expect(app.editing.getEditing()).toMatchObject({ id: 'a', typed: { reps: '1', kg: '10' }, settled: true, blocked: true })
    expect(app.set('a')).toMatchObject({ reps: 12, kg: 10 })
    // …and says so itself, under its fields, where the eye is sent (until the next key)
    let blockedPage = await todayPage()
    expect(blockedPage).toContain('<p id="edit-why-a" class="edit-why" role="status">Save or cancel this set first.</p>')
    app.editing.typeEdit('reps', '15')
    expect(app.editing.getEditing()).toMatchObject({ blocked: false })
    blockedPage = await todayPage()
    expect(blockedPage).toContain('<p id="edit-why-a" class="edit-why" role="status"></p>')
    // (the same with the weight emptied to retype it, and with a wrong number)
    app.editing.typeEdit('reps', '12')
    app.editing.typeEdit('kg', '')
    expect(app.editing.startEdit('w')).toBe(false)
    expect(app.set('a').kg).toBe(10)
    app.editing.typeEdit('kg', '99')
    expect(app.editing.startEdit('w')).toBe(false)
    expect(app.editing.getEditing()).toMatchObject({ id: 'a', settled: true, blocked: true })
    // (a wrong number is the reason shown then, not the general sentence)
    blockedPage = await todayPage()
    expect(blockedPage).toContain('role="status">Weight: from 1 to 50 kg, or empty for none.</p>')
    expect(blockedPage).not.toContain('Save or cancel this set first.')
    // With nothing changed in it, it just closes and the other row's form opens
    app.editing.typeEdit('kg', '10')
    expect(app.editing.startEdit('w')).toBe(true)
    expect(app.editing.getEditing()).toMatchObject({ id: 'w', typed: { minutes: '5', seconds: '00' } })
    expect(app.set('a')).toMatchObject({ reps: 12, kg: 10 })
    expect(app.set('w')).toEqual(odd)

    // Another window saves something else (the whole log is read afresh, this set's numbers the same):
    // the form stays, with what was typed
    app.editing.cancelEdit()
    app.editing.startEdit('a')
    app.editing.typeEdit('reps', '13')
    const otherWindow = new EventTarget()
    app.log.followOtherWindows(otherWindow)
    app.storage.data.set(LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets: [app.set('a')] }))
    otherWindow.dispatchEvent(Object.assign(new Event('storage'), { key: LOG_KEY }))
    expect(app.ids()).toEqual(['a'])
    expect(app.editing.getEditing()).toMatchObject({ id: 'a', typed: { reps: '13' } })
    // The set under an open form changes there (or goes, with Clear history): the form closes
    app.storage.data.set(LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets: [{ ...app.set('a'), reps: 15 }] }))
    otherWindow.dispatchEvent(Object.assign(new Event('storage'), { key: LOG_KEY }))
    expect(app.set('a').reps).toBe(15)
    expect(app.editing.getEditing()).toBe(null) // (so it can't put its old numbers back over the newer ones)
    app.editing.startEdit('a')
    app.log.clearHistory(() => true)
    expect(app.editing.getEditing()).toBe(null)

    // Escape is Cancel, and stops there (on an exercise's page it must not also close the page); the
    // buttons call what they say (they can't be pressed without a browser, so read what they call)
    const sources = import.meta.glob('/src/shell/{SetRows,TodayPage,ExerciseHistoryPage}.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const form = sources['/src/shell/SetRows.tsx']
    expect(form).toMatch(/if \(event\.key !== 'Escape'\) return\s+event\.stopPropagation\(\)\s+cancelEdit\(\)/)
    expect(form).toMatch(/<form onSubmit=\{submit\} onKeyDown=\{keys\}/)
    expect(form).toMatch(/const submit = [^\n]*\{\s+event\.preventDefault\(\)\s+saveEdit\(\)/)
    expect(form).toMatch(/<button type="button" className="list-button" onClick=\{cancelEdit\}>\s+Cancel/)
    expect(form).toMatch(/onChange=\{\(event\) => typeEdit\(id, event\.target\.value\)\}/)
    expect(form).toMatch(/onClick=\{\(\) => edit\(set\)\}/)
    expect(form).toMatch(/onClick=\{\(\) => remove\(set\)\}/)
    expect(form).toMatch(/const remove = [^\n]*\{\s+if \(tapRemove\(set\.id\)\) announce\(/)
    expect(form).toMatch(/const undo = [^\n]*\{\s+if \(!tapUndo\(set\.id\)\) return\s+announce\(/)
    expect(form).toMatch(/onClick=\{\(\) => undo\(set\)\}>\s+Undo/)
    // Edit that can't open (another form holds a change) says so and brings that form into view, even
    // from inside a closed day
    expect(form).toMatch(/const edit = [^\n]*\{\s+if \(startEdit\(set\.id\)\) return\s+setTimeout\(\(\) => \{\s+const form = document\.querySelector<HTMLFormElement>\('\.set-list form'\)/)
    expect(form).toMatch(/if \(day\) day\.open = true\s+const wrong = form\?\.querySelector<HTMLInputElement>\('\[aria-invalid="true"\]'\)\s+;\(wrong \?\? form\?\.querySelector<HTMLInputElement>\('input'\)\)\?\.focus\(\)\s+\}, 0\)/)
    expect(form).toMatch(/const why = Object\.values\(shown\)\.join\(' '\) \|\| \(blocked \? SAVE_FIRST : ''\)/)
    // What's read out is emptied first and set a moment later, so the same words twice still count as new
    expect(form).toMatch(/function announce\(text: string\) \{\s+said\.set\(\{ text: '' \}\)\s+setTimeout\(\(\) => said\.set\(\{ text \}\), 100\)/)
    // Focus: back to the row's Edit button when its form closes, to its Remove button after Undo, and,
    // if an Undo row runs out while focus is on it, to the row that took its place, without moving the page
    expect(form).toMatch(/if \(wasEditing\.current && !editingId\) document\.getElementById\(`edit-\$\{wasEditing\.current\}`\)\?\.focus\(\)/)
    expect(form).toMatch(/setTimeout\(\(\) => document\.getElementById\(`remove-\$\{set\.id\}`\)\?\.focus\(\), 0\)/)
    expect(form).toMatch(/const leftAt = wasShown\.current\.findIndex\(\(id\) => !shownIds\.includes\(id\)\)\s+if \(leftAt >= 0 && document\.activeElement === document\.body\) \{\s+const neighbour = list\.current\?\.children\[Math\.min\(leftAt, shownIds\.length - 1\)\]\s+neighbour\?\.querySelector\('button'\)\?\.focus\(\{ preventScroll: true \}\)/)
    // A list follows only which row has the form; the form's own row follows the typing (a long log
    // doesn't redraw at every key)
    expect(form).toMatch(/const editingId = useEditingId\(\)/)
    expect(form).toMatch(/function EditRow\([^\n]*\{\s+const editing = useEditing\(\)/)
    const editingSource = (import.meta.glob('/src/log/editing.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/log/editing.ts']
    expect(editingSource).toMatch(/export const useEditingId = \(\) => store\.useSelect\(\(s\) => s\.editing\?\.id \?\? null\)/)
    // Leaving either page (and only leaving it) closes an open form unsaved and drops the Undo lines
    expect(sources['/src/shell/TodayPage.tsx']).toMatch(/useEffect\(\s*\(\) => \(\) => \{\s+cancelEdit\(\)\s+forgetRemoved\(\)\s+\},\s+\[\],\s+\)/)
    expect(sources['/src/shell/ExerciseHistoryPage.tsx']).toMatch(/useEffect\(\s*\(\) => \(\) => \{\s+cancelEdit\(\)\s+forgetRemoved\(\)\s+\},\s+\[kind\],\s+\)/)
  })

  it('V9B3-T7: every saved set has Edit beside Remove; Edit turns the row into a form with the right fields, and Save is off while a number is wrong', async () => {
    holdTimers()
    const pullups: LoggedSet = { id: 'p', kind: 'pullup', endedAt: TODAY(12), seconds: 12, reps: 5 }
    const app = await openApp([curls('y', YESTERDAY(9), 12, 10), curls('a', TODAY(9), 12, 10), walk('w', TODAY(10), 300), pullups])
    let page = await todayPage()
    // Today's three and yesterday's one: each with Edit and Remove, named in full for screen readers
    expect(page.match(/>Edit<\/button>/g)).toHaveLength(4)
    expect(page.match(/>Remove<\/button>/g)).toHaveLength(4)
    expect(page).toContain('id="edit-a" class="list-button is-quiet" aria-label="Edit: Bicep curls, 12 reps · 10 kg · 0:28 · at 9:00">Edit</button>')
    expect(page).toContain('id="remove-a" class="list-button" aria-label="Remove: Bicep curls, 12 reps · 10 kg · 0:28 · at 9:00">Remove</button>')
    expect(page.indexOf('id="edit-a"')).toBeLessThan(page.indexOf('id="remove-a"'))
    expect(page).not.toContain('<form')
    // One line reads a Remove or an Undo out; it starts empty
    expect(page.match(/<p class="visually-hidden" role="status"><\/p>/g)).toHaveLength(1)
    // A row's text is drawn in parts, so it only breaks between them on a narrow phone
    const { TodayPage } = await import('../shell/TodayPage')
    const raw = renderToString(createElement(TodayPage, { now: NOW })).replaceAll('<!-- -->', '')
    expect(raw).toContain('<span><span class="part">12 reps</span> · <span class="part">10 kg</span> · <span class="part">0:28</span> · <span class="part">at 9:00</span></span>')
    // …each part a block that moves to the next line whole, but may still wrap inside when it is wider than
    // the line (a long exercise name beside two buttons must never push them off the row)
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    const rule = (selector: string) => css.slice(css.indexOf(`\n${selector} {\n`), css.indexOf('}', css.indexOf(`\n${selector} {\n`)))
    expect(rule('.set-list .part')).toContain('display: inline-block;')
    expect(rule('.set-list .part')).not.toContain('nowrap')
    expect(rule('.set-list li > div:first-child')).toContain('min-width: 0;')
    expect(rule('.edit-why')).toMatch(/min-height: [\d.]+em;/) // (the reasons line keeps its place: nothing jumps when one appears)

    // Edit on the curls: reps and kg, holding the set's numbers; the phone's number pad (with a decimal point for kg)
    app.editing.startEdit('a')
    page = await todayPage()
    const form = () => page.match(/<form[\s\S]*?<\/form>/)![0]
    const input = (label: string) => form().match(new RegExp(`<label class="edit-field"><input([^>]*)/?>${label}</label>`))?.[1].toLowerCase() ?? null
    expect(form()).toContain('aria-label="Edit Bicep curls"')
    expect(form()).toContain('<strong>Bicep curls</strong>')
    expect(input('reps')).toContain('inputmode="numeric"')
    expect(input('reps')).toContain('value="12"')
    expect(input('kg')).toContain('inputmode="decimal"')
    expect(input('kg')).toContain('value="10"')
    expect([input('min'), input('sec')]).toEqual([null, null])
    // Edit puts you in the first field; the keyboard's own key goes on to the next, and saves from the last
    expect(input('reps')).toContain('autofocus')
    expect(input('kg')).not.toContain('autofocus')
    expect(input('reps')).toContain('enterkeyhint="next"')
    expect(input('kg')).toContain('enterkeyhint="done"')
    expect(form()).toMatch(/<button type="submit" class="list-button is-primary">Save<\/button><button type="button" class="list-button">Cancel<\/button>/)
    expect(form()).toMatch(/<p id="edit-why-a" class="edit-why" role="status"><\/p>/)
    // That row has no Edit or Remove while it's a form; the others keep theirs
    expect(page.match(/>Edit<\/button>/g)).toHaveLength(3)
    expect(page).not.toContain('id="remove-a"')

    // A wrong number: Save is off at once; the reason, and the mark on the field, wait for a pause in the
    // typing ("6" on the way to "62.5" isn't a mistake)
    app.editing.typeEdit('reps', '0')
    page = await todayPage()
    expect(form()).toMatch(/<button type="submit" class="list-button is-primary" disabled="">Save<\/button>/)
    expect(form()).toContain('role="status"></p>')
    expect(input('reps')).toContain('aria-invalid="false"')
    vi.advanceTimersByTime(app.editing.TYPING_PAUSE_MS - 1)
    page = await todayPage()
    expect(form()).toContain('role="status"></p>')
    vi.advanceTimersByTime(1)
    page = await todayPage()
    expect(form()).toContain('<p id="edit-why-a" class="edit-why" role="status">Reps: a whole number from 1 to 999.</p>')
    expect(input('reps')).toContain('aria-invalid="true"')
    expect(input('kg')).toContain('aria-invalid="false"')
    // More typing hides it again until the next pause; then both reasons
    app.editing.typeEdit('kg', '99')
    page = await todayPage()
    expect(form()).toContain('role="status"></p>')
    vi.advanceTimersByTime(app.editing.TYPING_PAUSE_MS)
    page = await todayPage()
    expect(form()).toContain('Reps: a whole number from 1 to 999. Weight: from 1 to 50 kg, or empty for none.')
    expect([input('reps'), input('kg')].map((field) => field!.includes('aria-invalid="true"'))).toEqual([true, true])
    // Save pressed anyway (Enter): refused, and the reason is there at once
    app.editing.typeEdit('kg', '10')
    expect(app.editing.saveEdit()).toBe(false)
    page = await todayPage()
    expect(form()).toContain('role="status">Reps: a whole number from 1 to 999.</p>')
    // Put right, Save is on again
    app.editing.typeEdit('reps', '8')
    app.editing.typeEdit('kg', '14')
    page = await todayPage()
    expect(form()).toMatch(/<button type="submit" class="list-button is-primary">Save<\/button>/)
    vi.advanceTimersByTime(app.editing.TYPING_PAUSE_MS)
    page = await todayPage()
    expect(form()).toContain('role="status"></p>')
    app.editing.cancelEdit()

    // Cardio: minutes and seconds (a wrong time marks both). Pull-ups: reps only, and it is the last field.
    app.editing.startEdit('w')
    page = await todayPage()
    expect(form()).toContain('aria-label="Edit Walk"')
    expect(input('min')).toContain('value="5"')
    expect(input('sec')).toContain('value="00"')
    expect(input('min')).toContain('autofocus')
    expect([input('min')!.includes('enterkeyhint="next"'), input('sec')!.includes('enterkeyhint="done"')]).toEqual([true, true])
    expect([input('reps'), input('kg')]).toEqual([null, null])
    app.editing.typeEdit('seconds', '75')
    vi.advanceTimersByTime(app.editing.TYPING_PAUSE_MS)
    page = await todayPage()
    expect([input('min'), input('sec')].map((field) => field!.includes('aria-invalid="true"'))).toEqual([true, true])
    app.editing.cancelEdit()
    app.editing.startEdit('p')
    page = await todayPage()
    expect(input('reps')).toContain('value="5"')
    expect(input('reps')).toContain('enterkeyhint="done"')
    expect(input('kg')).toBe(null)
    app.editing.cancelEdit()

    // An exercise's own page has the same rows: Edit, Remove, the form, and Undo after Remove
    let history = await historyPage('curl')
    expect(history.match(/>Edit<\/button>/g)).toHaveLength(2)
    expect(history).toContain('All sets · 2')
    expect(history).toContain('aria-label="Edit: Yesterday · at 9:00, 12 reps · 10 kg · 0:28">Edit</button>')
    expect(history.match(/<p class="visually-hidden" role="status"><\/p>/g)).toHaveLength(1)
    app.editing.startEdit('y')
    history = await historyPage('curl')
    expect(history).toMatch(/<form[^>]*aria-label="Edit Bicep curls"/)
    expect(history.match(/>Edit<\/button>/g)).toHaveLength(1)
    app.editing.cancelEdit()
    app.log.removeSet('a')
    history = await historyPage('curl')
    expect(history).toContain('All sets · 1')
    expect(rows(history)).toEqual(['Removed Bicep curls · 12 reps · 10 kg Undo', 'Yesterday · at 9:00 12 reps · 10 kg · 0:28 Edit Remove'])
    // Remove leaves you on Undo
    expect(history).toMatch(/<li class="is-removed"><div><strong>Removed<\/strong><span>Bicep curls · 12 reps · 10 kg<\/span><\/div><button[^>]*autofocus=""[^>]*>Undo<\/button><\/li>/i)
    // Its last set removed: the page still shows the Undo row (not "nothing saved yet") until it goes
    app.log.removeSet('y')
    history = await historyPage('curl')
    expect(history).toContain('All sets · 0')
    expect(rows(history).filter((text) => text.startsWith('Removed'))).toHaveLength(2)
    expect(history).not.toContain('Nothing saved for')
    expect(history).not.toContain('history-stats')
    app.log.forgetRemoved()
    expect(await historyPage('curl')).toContain('Nothing saved for Bicep curls yet.')

    // On Today, a day whose only set was just removed keeps its row (with Undo) until it goes
    const lone = await openApp([curls('only', YESTERDAY(9), 12, 10)])
    lone.log.removeSet('only')
    page = await todayPage()
    expect(page).toContain('Yesterday · 0 sets · 0 s')
    expect(rows(page)).toEqual(['Removed Bicep curls · 12 reps · 10 kg Undo'])
    lone.log.forgetRemoved()
    expect(await todayPage()).not.toContain('Yesterday')
  })
})
