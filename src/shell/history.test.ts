import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { LOG_KEY, LOG_VERSION } from '../log/logStorage'
import { bestSet, lastSets, setsOf, type LoggedSet } from '../log/sets'
import type { ExerciseKind } from '../exercises/catalog'

// Times in local time, so the tests mean the same thing in any time zone
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime()
const NOW = at(2026, 10, 7, 15) // Wednesday 7 Oct 2026, 3 pm

let made = 0
const reps = (kind: ExerciseKind, endedAt: number, count: number): LoggedSet => ({
  id: `s${made++}`,
  kind,
  endedAt,
  seconds: count * 2.4,
  reps: count,
})
const distance = (kind: ExerciseKind, endedAt: number, meters: number, seconds = 300): LoggedSet => ({
  id: `s${made++}`,
  kind,
  endedAt,
  seconds,
  meters,
})

// A pretend browser: its history (entries, back, forward, and the "popstate"
// that arrives a moment after back or forward, as in a real browser), plus
// key presses. Android's back gesture is the browser's back.
// `entries`/`current` start it elsewhere, e.g. reloaded while on a history page's entry.
function fakeBrowser(entries: unknown[] = [null] /* the app's own page */, start = entries.length - 1) {
  const events = new EventTarget()
  let current = start
  const travel = (to: number) => {
    if (to < 0 || to >= entries.length) return // back from the first entry: leaving the app
    current = to
    queueMicrotask(() => events.dispatchEvent(Object.assign(new Event('popstate'), { state: entries[current] })))
  }
  return {
    history: {
      get state() {
        return entries[current]
      },
      pushState: (state: unknown) => {
        entries.splice(current + 1, Infinity, state)
        current++
      },
      replaceState: (state: unknown) => {
        entries[current] = state
      },
      back: () => travel(current - 1),
      forward: () => travel(current + 1),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    press: (code: string) => events.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat: false })),
    location: { search: '' },
    get current() {
      return current
    },
    get length() {
      return entries.length
    },
  }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// Source text of files, to check what can't be clicked without a browser
const sources = import.meta.glob(['/src/main.tsx', '/src/shell/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

// "Open the page": fresh app state with `sets` saved, switched on by the same
// startApp() as main.tsx (saving sets, the back gesture)
async function openApp(sets: LoggedSet[] = [], browser = fakeBrowser()) {
  const data = new Map([[LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets })]])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  vi.stubGlobal('window', browser)
  vi.resetModules()
  const app = {
    browser,
    tabs: await import('./tabs'),
    tabStore: await import('./tabStore'),
    gym: await import('../interaction/gymStore'),
    build: await import('../build/buildStore'),
    log: await import('../log/logStore'),
    words: await import('../log/logText'),
    clock: await import('./clock'),
    ExercisesPage: (await import('./ExercisesPage')).ExercisesPage,
  }
  ;(await import('./startup')).startApp()
  return app
}
type App = Awaited<ReturnType<typeof openApp>>

// The Exercises tab as it would show (React marks where pieces of text meet with <!-- -->)
const show = (app: App) => renderToString(createElement(app.ExercisesPage, { now: NOW })).replaceAll('<!-- -->', '')
// Just the history page's part of it
const historyPart = (html: string) => html.slice(html.indexOf('history-page'))
// The list's row for one exercise
const row = (html: string, name: string) => html.split('<li>').find((part) => part.includes(`<span>${name}</span>`)) ?? ''

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('History by exercise', () => {
  it('V7B3-T1: an exercise\'s history has only its own sets, newest first (Walk and Run kept apart)', async () => {
    const sets = [
      reps('curl', at(2026, 10, 5), 10),
      distance('walk', at(2026, 10, 6), 900),
      reps('curl', at(2026, 10, 7, 9), 12),
      distance('run', at(2026, 10, 6, 13), 1800),
      reps('lateral', at(2026, 10, 7, 10), 8),
      reps('curl', at(2026, 10, 6), 11),
    ]
    expect(setsOf(sets, 'curl').map((set) => set.reps)).toEqual([12, 11, 10])
    expect(setsOf(sets, 'walk').map((set) => set.meters)).toEqual([900])
    expect(setsOf(sets, 'run').map((set) => set.meters)).toEqual([1800])
    expect(setsOf(sets, 'pushdown')).toEqual([])

    // On the page: the curls only, newest first, each with its day and time
    const app = await openApp(sets)
    app.tabs.openTab('exercises')
    app.tabs.openHistory('curl')
    const page = historyPart(show(app))
    expect(page).toContain('All sets · 3')
    const lines = [...page.matchAll(/<span>(\d+ reps) · /g)].map((match) => match[1])
    expect(lines).toEqual(['12 reps', '11 reps', '10 reps'])
    expect(page).toContain('Today · at 9:00')
    expect(page).toContain('Mon 5 Oct · at 12:00')
    expect(page).not.toContain('8 reps') // the lateral raises
  })

  it('V7B3-T2: best is the most reps or the longest distance (the rower too); on a tie, the earlier set', async () => {
    expect(bestSet([])).toBeNull()
    const curls = [reps('curl', at(2026, 10, 1), 10), reps('curl', at(2026, 10, 3), 15), reps('curl', at(2026, 10, 6), 12)]
    expect(bestSet(curls)!.reps).toBe(15)
    for (const kind of ['walk', 'run', 'ride', 'sprint', 'row'] as ExerciseKind[]) {
      const done = [distance(kind, at(2026, 10, 1), 800), distance(kind, at(2026, 10, 2), 2400), distance(kind, at(2026, 10, 3), 1200)]
      expect(bestSet(done)!.meters, kind).toBe(2400)
    }
    // A tie: the first time it was reached counts
    const first = reps('squat', at(2026, 9, 20), 10)
    const tied = [reps('squat', at(2026, 10, 6), 10), first, reps('squat', at(2026, 10, 1), 8)]
    expect(bestSet(tied)).toBe(first)

    // On the page: Last time and Best, each with its day
    const app = await openApp(curls)
    app.tabs.openTab('exercises')
    app.tabs.openHistory('curl')
    const page = historyPart(show(app))
    expect(page).toMatch(/<span>Last time<\/span><strong>12 reps<\/strong><small>Yesterday<\/small>/)
    expect(page).toMatch(/<span>Best<\/span><strong>15 reps<\/strong><small>Sat 3 Oct<\/small>/)
  })

  it('V7B3-T3: the "Last:" line under each exercise is right, and missing for one never done', async () => {
    const sets = [
      reps('curl', at(2026, 10, 2), 9),
      reps('curl', at(2026, 10, 6, 18), 12),
      distance('row', at(2026, 10, 7, 8), 520, 120),
      distance('walk', at(2026, 9, 1), 1500),
    ]
    sets[2].strokes = 50
    expect(lastSets(sets).curl!.reps).toBe(12)
    expect(lastSets(sets).lateral).toBeUndefined()

    const app = await openApp(sets)
    app.tabs.openTab('exercises')
    const list = show(app)
    expect(row(list, 'Bicep curls')).toContain('Last: 12 reps · Yesterday')
    expect(row(list, 'Row')).toContain('Last: 50 strokes · 0.52 km · Today')
    expect(row(list, 'Walk')).toContain('Last: 1.50 km · 1 Sep')
    expect(row(list, 'Lateral raises (side fly)')).not.toContain('Last:')
    expect(row(list, 'Run')).not.toContain('Last:') // Walk's history isn't Run's
    expect(list.match(/Last: /g)).toHaveLength(3)

    // The days count from a clock read again whenever the log changes, every
    // minute, and when the app comes back on screen. Here a workout crosses midnight.
    let wall = at(2026, 10, 5, 23, 30) // Monday night
    vi.spyOn(Date, 'now').mockImplementation(() => wall)
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const screen = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('document', screen)
    const late = await openApp()
    const live = () => renderToString(createElement(late.ExercisesPage)).replaceAll('<!-- -->', '') // no fixed "now"
    const stopFollowing = late.clock.subscribeClock(() => {}) // as the page on screen does
    late.log.recordSet({ kind: 'squat', endedAt: wall, seconds: 24, reps: 10 })
    expect(row(live(), 'Back squat')).toContain('Last: 10 reps · Today')
    wall = at(2026, 10, 6, 0, 5) // curls finish just past midnight, on Tuesday
    late.log.recordSet({ kind: 'curl', endedAt: wall, seconds: 29, reps: 12 })
    expect(row(live(), 'Bicep curls')).toContain('Last: 12 reps · Today')
    expect(row(live(), 'Back squat')).toContain('Last: 10 reps · Yesterday') // Monday's, now yesterday
    // The phone sleeps on the Exercises tab and wakes on Wednesday morning
    wall = at(2026, 10, 7, 7, 0)
    screen.dispatchEvent(new Event('visibilitychange'))
    expect(row(live(), 'Bicep curls')).toContain('Last: 12 reps · Yesterday')
    // …and while it stays open, a minute later on Thursday's first minute
    wall = at(2026, 10, 8, 0, 0)
    vi.advanceTimersByTime(60_000)
    expect(row(live(), 'Bicep curls')).toContain('Last: 12 reps · Tue 6 Oct')
    // No page following the clock: nothing keeps reading it
    stopFollowing()
    wall = at(2026, 10, 9, 9, 0)
    vi.advanceTimersByTime(60_000)
    expect(late.clock.currentTime()).toBe(at(2026, 10, 8, 0, 0))
  })

  it('V7B3-T4: Back (Android\'s gesture) closes the page and stays on Exercises; the page\'s Back, Escape and leaving the tab close it too', async () => {
    const app = await openApp()
    const { tabs, tabStore, browser } = app
    tabs.openTab('exercises')
    tabs.openHistory('curl')
    expect(tabStore.getHistoryKind()).toBe('curl')
    expect(browser.current).toBe(1) // one entry added for the page

    // The back gesture: the page closes, the app stays, on Exercises
    browser.history.back()
    await settle()
    expect(tabStore.getHistoryKind()).toBeNull()
    expect(tabStore.getTab()).toBe('exercises')
    // …and Forward brings it back
    browser.history.forward()
    await settle()
    expect(tabStore.getHistoryKind()).toBe('curl')

    // The page's own Back: closes, and takes away the entry it added, so the
    // next back gesture does what it did before the page was opened
    tabs.closeHistory()
    expect(tabStore.getHistoryKind()).toBeNull()
    await settle()
    expect(browser.current).toBe(0)
    expect(tabStore.getHistoryKind()).toBeNull()

    // Another exercise's page opened from inside one: swapped, not stacked (one back closes it)
    tabs.openHistory('curl')
    tabs.openHistory('walk')
    expect(browser.length).toBe(2)
    browser.history.back()
    await settle()
    expect(tabStore.getHistoryKind()).toBeNull()

    // Escape (keyboards)
    tabs.openHistory('row')
    browser.press('Escape')
    expect(tabStore.getHistoryKind()).toBeNull()
    await settle()
    expect(browser.current).toBe(0)

    // Leaving the tab closes it, and coming back shows the list
    tabs.openHistory('squat')
    tabs.openTab('today')
    expect(tabStore.getHistoryKind()).toBeNull()
    await settle()
    expect(browser.current).toBe(0)
    tabs.openTab('exercises')
    expect(tabStore.getHistoryKind()).toBeNull()

    // History pages only open on the Exercises tab
    tabs.openTab('home')
    tabs.openHistory('curl')
    expect(tabStore.getHistoryKind()).toBeNull()
    expect(browser.current).toBe(0)

    // Forward pressed on another tab: no page opens there, and the entry it
    // lands on can't bring that page back later
    tabs.openTab('exercises')
    tabs.openHistory('curl')
    browser.history.back()
    await settle()
    tabs.openTab('home')
    browser.history.forward()
    await settle()
    expect(tabStore.getHistoryKind()).toBeNull()
    tabs.openTab('exercises')
    tabs.openHistory('squat')
    browser.history.back()
    await settle()
    expect(tabStore.getHistoryKind()).toBeNull() // the list, not Bicep curls' old page

    // Reloaded (or restored by Android) while on a history page's entry: the
    // browser keeps the entry, the app starts on Home with no page open
    const reloaded = await openApp([], fakeBrowser([null, { gym3dHistory: 'curl' }]))
    expect(reloaded.browser.history.state).toBeNull() // the leftover mark is taken off
    reloaded.tabs.openTab('exercises')
    reloaded.tabs.openHistory('squat')
    reloaded.tabs.closeHistory() // the page's Back
    await settle()
    expect(reloaded.tabStore.getHistoryKind()).toBeNull() // the list, not Bicep curls' page
    reloaded.tabs.openHistory('squat')
    reloaded.browser.history.back() // the gesture
    await settle()
    expect(reloaded.tabStore.getHistoryKind()).toBeNull()

    // The app itself switches this on: main.tsx calls the same startApp() as these tests
    expect(sources['/src/main.tsx']).toMatch(/^startApp\(\)$/m)
  })

  it('V7B3-T5: Start on a history page starts that exercise exactly as the list\'s Start does', async () => {
    // Both buttons call the list's own start (buttons can't be clicked without a browser, so read what they call)
    expect(sources['/src/shell/ExercisesPage.tsx']).toMatch(/onClick=\{\(\) => startFromList\(kind\)\}/)
    expect(sources['/src/shell/ExerciseHistoryPage.tsx']).toMatch(
      /history-start"[\s\S]*?onClick=\{\(\) => \{[^}]*?\n\s*startFromList\(kind\)\n/,
    )
    // …and with a history page open, it ends in the same exercise as from the list, the page staying open
    for (const kind of ['curl', 'legPress', 'walk'] as ExerciseKind[]) {
      const fromPage = await openApp()
      fromPage.tabs.openTab('exercises')
      fromPage.tabs.openHistory(kind)
      fromPage.gym.startFromList(kind)
      const viaPage = fromPage.gym.getGym().activity!
      expect(fromPage.tabStore.getHistoryKind(), kind).toBe(kind) // the page stays open
      expect(fromPage.tabStore.getTab(), kind).toBe('exercises')

      const fromList = await openApp()
      fromList.gym.startFromList(kind)
      const viaList = fromList.gym.getGym().activity!
      const same = (activity: typeof viaPage) => ({ ...activity, startedAt: 0 }) // (the clock differs, nothing else may)
      expect(same(viaPage), kind).toEqual(same(viaList))
    }

    // While doing it, the page shows the live card with Finish instead of Start,
    // and the finished set appears on the page
    let t = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    vi.spyOn(Date, 'now').mockImplementation(() => NOW)
    const app = await openApp()
    app.tabs.openTab('exercises')
    app.tabs.openHistory('curl')
    expect(historyPart(show(app))).toContain('>Start<')
    app.gym.startFromList('curl')
    t += 12 * 2.4 * 1000 + 100
    let page = historyPart(show(app))
    expect(page).toContain('>Finish<')
    expect(page).not.toContain('>Start<')
    app.gym.finishFromList()
    page = historyPart(show(app))
    expect(page).toContain('All sets · 1')
    expect(page).toContain('<strong>12 reps</strong>')

    // Start is off when the machine isn't in the gym, as on the list
    app.build.getBuild().items = app.build.getBuild().items.filter((item) => item.type !== 'rower')
    app.tabs.openHistory('row')
    expect(historyPart(show(app))).toMatch(/<button type="button" class="list-button is-primary history-start" disabled="">Start/)
  })

  it('V7B3-T6: the Exercises tab still has all 17 Starts, and a history page with no sets says so', async () => {
    const app = await openApp()
    app.tabs.openTab('exercises')
    const list = show(app)
    expect(list.match(/>Start</g)).toHaveLength(17)
    expect(list.match(/>History</g)).toHaveLength(17)
    expect(list).not.toContain('history-page')
    expect(list).not.toContain('inert')

    app.tabs.openHistory('pushdown')
    const withPage = show(app)
    expect(historyPart(withPage)).toContain(app.words.emptyHistory('pushdown'))
    expect(historyPart(withPage)).not.toContain('Best')
    expect(withPage.match(/>Start</g)).toHaveLength(18) // the list's 17, kept underneath, and the page's own
    expect(withPage).toMatch(/<section class="page" aria-labelledby="exercises-title" inert="">/) // the list is out of reach
    // …and the page is beside the list, not inside it (inside, every button on the page would be dead too)
    expect(withPage).toContain('</section><section class="page history-page"')
    expect(withPage.slice(0, withPage.indexOf('</section>'))).not.toContain('history-page')
  })
})
