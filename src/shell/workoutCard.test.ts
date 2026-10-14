import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

// The clocks, all under the test's control (fake timers): the exercise clock
// (performance.now) counts from 9:00 on 15 Oct 2026
const DAY_START = new Date(2026, 9, 15, 9).getTime()
const pass = (seconds: number) => vi.advanceTimersByTime(seconds * 1000)
const REP = 2.4
// Node's own modules, loaded by name at run time (the app's types don't include Node)
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)

let stopApp: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(DAY_START)
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - DAY_START)
})
afterEach(() => {
  stopApp?.()
  stopApp = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// A pretend browser: key presses, and whether the main pointer is a finger
function fakeWindow(touch: boolean) {
  const events = new EventTarget()
  return {
    events,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    location: { search: '' },
    matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' && touch, addEventListener() {}, removeEventListener() {} }),
  }
}

// "Open the page" on a phone (touch) or a computer, the welcome card already seen
async function openApp({ touch = true } = {}) {
  stopApp?.()
  const data = new Map([['gym3d.welcomed', '1']])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  const browser = fakeWindow(touch)
  vi.stubGlobal('window', browser)
  vi.resetModules()
  const app = {
    browser,
    gym: await import('../interaction/gymStore'),
    tabStore: await import('./tabStore'),
    tabs: await import('./tabs'),
    weights: await import('../exercises/weights'),
    targets: await import('../exercises/targets'),
    text: await import('../interaction/activityText'),
    log: await import('../log/logStore'),
    card: await import('./WorkoutCard'),
    App: (await import('../App')).default,
  }
  stopApp = (await import('./startup')).startApp()
  return app
}
type App = Awaited<ReturnType<typeof openApp>>
const html = (element: Parameters<typeof renderToString>[0]) => renderToString(element).replaceAll('<!-- -->', '')
const words = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
// The card as drawn, the screen reader's line apart
const cardMarkup = (app: App) => html(createElement(app.card.WorkoutCard))
const cardOf = (app: App) => {
  const markup = cardMarkup(app)
  return words(markup.slice(markup.indexOf('<div class="workout-card"') >>> 0))
}
const saidOf = (markup: string) => markup.match(/<p class="visually-hidden" role="status">([^<]*)<\/p>/)?.[1]
const stripOf = (app: App) => {
  const markup = html(createElement(app.card.WorkoutStrip))
  const at = markup.indexOf('<button')
  return at < 0 ? '' : words(markup.slice(at))
}
const page = (app: App) => html(createElement(app.App))
const count = (text: string, part: string) => text.split(part).length - 1
const sources = import.meta.glob(
  ['/src/shell/WorkoutCard.tsx', '/src/App.tsx', '/src/shell/Header.tsx', '/src/shell/ExercisesPage.tsx', '/src/shell/UpdateNote.tsx', '/src/player/Player.tsx'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>
// When the set going on began, on the exercise clock
const doingStart = (app: App) => app.gym.getGym().activity!.startedAt

describe('The workout card', { timeout: 30_000 }, () => {
  it('V10B3-T1: the card shows the exercise, set x of y, the reps against the target (or the rest), and the weight, from the popup’s own measure', async () => {
    const app = await openApp()
    app.weights.setKg('curl', 10)
    app.gym.startFromList('curl')
    pass(7 * REP + 0.1)
    expect(cardOf(app)).toBe('Bicep curls · set 1 of 3 10 kg 7 / 12 reps Done Change Finish')
    // …the very count the popup shows, at every moment (one measure for both)
    for (const seconds of [0, 1.1, 2.5, 9.9, 20]) {
      const now = doingStart(app) + seconds * 1000
      const card = app.text.cardWords(app.gym.getGym(), now)!.count.split(' / ')[0]
      expect(app.text.progressText(app.gym.getGym().activity!, now), `${seconds} s`).toContain(`${card} of 12 reps`)
    }
    // For a screen reader: calm words in a status line of their own, before the card and apart from its
    // buttons (whose names change from card to card); everything that ticks is for the eyes only
    const markup = cardMarkup(app)
    expect(markup).toMatch(/^<p class="visually-hidden" role="status">Bicep curls, set 1 of 3, 12 reps, 10 kg<\/p><div class="workout-card">/)
    expect(markup).toContain('<div class="workout-card-top" aria-hidden="true">')
    expect(markup).toContain('<p class="workout-count" aria-hidden="true">7 / 12 reps</p>')
    expect(count(markup, 'role="status"')).toBe(1)

    // Resting: what comes next, the countdown, and the weight the next set will use (the picker's)
    pass(5 * REP)
    app.weights.setKg('curl', 12)
    expect(cardOf(app)).toBe('Bicep curls · set 2 of 3 next 12 kg Rest 1:30 +30 s Skip Change Finish')
    expect(saidOf(cardMarkup(app))).toBe('Bicep curls, Resting 1:30 before set 2 of 3')
    pass(18)
    expect(cardOf(app)).toContain('Rest 1:12')
    expect(saidOf(cardMarkup(app))).toBe('Bicep curls, Resting 1:30 before set 2 of 3') // (unchanged: nothing ticks for the ear)
    app.gym.finishExercise()

    // Cardio: the distance and the time against the target, with the speed
    app.gym.startFromList('walk')
    pass(100.5)
    expect(cardOf(app)).toBe('Walk 5.4 km/h 0.15 km · 1:40 / 10:00 Run Done Change Finish')
    expect(saidOf(cardMarkup(app))).toBe('Walk, 10 minutes, 5.4 km/h')
    // …never past its end, even read a moment late (a set's own end is a timer, and a phone can hold it up)
    const walkStart = doingStart(app)
    expect(app.text.cardWords(app.gym.getGym(), walkStart + 700_000)?.count).toBe('0.90 km · 10:00 / 10:00')
    app.gym.finishExercise()
    app.gym.startFromList('curl')
    expect(app.text.cardWords(app.gym.getGym(), doingStart(app) + 13 * REP * 1000 + 100)?.count).toBe('12 / 12 reps')
    app.gym.finishExercise()
    // The rower counts strokes, and its time against the target
    app.gym.startFromList('row')
    pass(100.5)
    expect(cardOf(app)).toMatch(/^Row 2:00 \/500m \d+ strokes · 1:40 \/ 10:00 Done Change Finish$/)
    app.gym.finishExercise()

    // After the last set: "1 set done", with Again
    for (let i = 0; i < 2; i++) app.targets.nudgeTarget('pullup', 'sets', -1)
    app.gym.startFromList('pullup')
    pass(12 * REP + 0.1)
    expect(cardOf(app)).toBe('Pull-ups 1 set done Again Change Finish')
    expect(saidOf(cardMarkup(app))).toBe('Pull-ups, 1 set done')
    // A set without a target counts up (the card's words for one)
    const free = { ...app.gym.getGym(), activity: { ...app.gym.getGym().activity, kind: 'curl' as const, startedAt: 0, arrived: true, machineId: 'x', session: 9, faceYaw: 0 }, between: null }
    expect(app.text.cardWords(free, 7 * REP * 1000 + 100)).toMatchObject({ what: 'Bicep curls', count: '7 reps', words: 'Bicep curls' })

    // The card is the same height whatever it shows (the joystick sits on it): lines that don't wrap, one row of buttons
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    expect(css).toMatch(/\.workout-card-top strong \{\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;/)
    expect(css).toMatch(/\.workout-count \{[^}]*text-overflow: ellipsis;\n  white-space: nowrap;/)
    expect(css).toMatch(/\.workout-actions \{\n  display: flex;\n  gap: 6px;\n\}/)
    expect(css).toMatch(/\.workout-actions \.list-button \{\n  flex: 1 1 auto;\n  min-width: 0;[^}]*white-space: nowrap;/)
  })

  it('V10B3-T2: the card’s buttons do what the popup’s do (Done, Skip, +30 s, Again, Finish); Change opens the list on the exercise’s row', async () => {
    const app = await openApp()
    const card = sources['/src/shell/WorkoutCard.tsx']
    expect(card).toMatch(/key="done" [^>]*data-next onClick=\{\(\) => tapDone\(\)\}>\s*Done/)
    expect(card).toMatch(/key="more" [^>]*onClick=\{\(\) => tapMoreRest\(\)\}>\s*\+30 s/)
    expect(card).toMatch(/key="skip" [^>]*data-next onClick=\{\(\) => tapNextSet\(\)\}>\s*Skip/)
    expect(card).toMatch(/key="again" [^>]*data-next onClick=\{\(\) => tapAgain\(\)\}>\s*Again/)
    expect(card).toMatch(/key="finish" [^>]*onClick=\{\(\) => tapFinish\(\)\}>\s*Finish/)
    // (pace buttons keep their place when their pace changes, so the cursor stays on them)
    expect(card).toMatch(/key=\{`pace \$\{i\}`\} [^>]*onClick=\{\(\) => swapSettled\(\) && action\.run\(\)\}/)
    // Change waits out the 0.6 s too: it takes Skip's and Finish's places from one card to the next
    expect(card).toMatch(/key="change" [^>]*onClick=\{\(\) => swapSettled\(\) && showInList\(kind\)\}>\s*Change/)

    // Change: the Exercises tab, with that exercise's row to bring into view; the set carries on
    app.gym.startFromList('squat')
    pass(3 * REP)
    app.tabs.showInList('squat')
    expect(app.tabStore.getTab()).toBe('exercises')
    expect(app.tabStore.getRowToShow()).toBe('squat')
    expect(app.gym.getGym().activity).toMatchObject({ kind: 'squat' })
    // …which the list does as it opens: the row to the middle, the cursor on its History button (no second scroll)
    const { bringRowIntoView, historyButtonId } = await import('./rowInView')
    const scrolled: unknown[] = []
    const focused: unknown[] = []
    const button = { closest: (selector: string) => (selector === 'li' ? { scrollIntoView: (how: unknown) => scrolled.push(how) } : null), focus: (how: unknown) => focused.push(how) }
    const fakePage = { getElementById: (id: string) => (id === 'history-squat' ? button : null) } as unknown as Document
    expect(bringRowIntoView('squat', fakePage)).toBe(true)
    expect([scrolled, focused]).toEqual([[{ block: 'center' }], [{ preventScroll: true }]])
    expect(bringRowIntoView('curl', fakePage)).toBe(false)
    expect(historyButtonId('squat')).toBe('history-squat')
    const list = sources['/src/shell/ExercisesPage.tsx']
    expect(list).toMatch(/if \(!rowToShow\) return\s*bringRowIntoView\(rowToShow\)\s*setRowToShow\(null\)\s*\}, \[rowToShow\]\)/)
    expect(list).toMatch(/id=\{historyButtonId\(kind\)\}/)
    // …during the rest too: Change is on every card
    pass(12 * REP)
    expect(cardOf(app)).toMatch(/\+30 s Skip Change Finish$/)
  })

  it('V10B3-T3: on the other tabs a strip shows it in one line (the name gives way, never the count), and tapping it opens the gym', async () => {
    const app = await openApp()
    app.weights.setKg('curl', 10)
    app.gym.startFromList('curl')
    pass(7 * REP + 0.1)
    for (const tab of ['exercises', 'today'] as const) {
      app.tabs.openTab(tab)
      const shown = page(app)
      expect(shown, tab).toContain('<button type="button" class="workout-strip">')
      expect(shown, tab).toContain(
        '<span class="strip-what" aria-hidden="true">Bicep curls · set 1 of 3</span><span class="strip-count" aria-hidden="true">· 7 / 12 reps</span><span class="visually-hidden">Bicep curls, set 1 of 3, 12 reps, 10 kg. Open the gym</span>',
      )
      expect(shown).not.toContain('class="workout-card"')
    }
    expect(stripOf(app)).toBe('Bicep curls · set 1 of 3 · 7 / 12 reps Bicep curls, set 1 of 3, 12 reps, 10 kg. Open the gym')
    // …and a screen reader hears what changes, as on the gym: a status line kept beside the strip, empty or not
    expect(page(app)).toContain('<p class="visually-hidden" role="status">Bicep curls, set 1 of 3, 12 reps, 10 kg</p><button type="button" class="workout-strip">')
    // Resting, in the same line
    pass(5 * REP)
    expect(stripOf(app)).toMatch(/^Bicep curls · set 2 of 3 next · Rest 1:30 /)
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    expect(css).toMatch(/\.strip-what \{\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n\}\n\n\.strip-count \{\n  flex: none;\n\}/)
    expect(css).toMatch(/\.workout-strip \{\n  flex: none;\n  display: flex;[^}]*min-height: 44px;[^}]*white-space: nowrap;/)
    // Tapping it: the gym, with the card, and the cursor on its next step (or the Gym tab)
    const card = sources['/src/shell/WorkoutCard.tsx']
    expect(card).toMatch(/className="workout-strip" onClick=\{openGym\}/)
    expect(card).toMatch(
      /function openGym\(\) \{\s*openTab\('home'\)[\s\S]*?setTimeout\(\(\) => \{\s*const next =\s*document\.querySelector<HTMLElement>\('\.workout-card \[data-next\]'\) \?\?\s*document\.querySelector<HTMLElement>\('\.tabbar-tab\[aria-current="page"\]'\)\s*next\?\.focus\(\)/,
    )
    app.tabs.openTab('home')
    expect(page(app)).toContain('class="workout-card"')
    expect(page(app)).not.toContain('workout-strip')
    // The strip sits just above the tab bar (the update note's place, which waits while a round goes on)
    expect(sources['/src/App.tsx']).toMatch(/\{!home && <WorkoutStrip \/>\}\s*<UpdateNote \/>\s*<TabBar \/>/)
    expect(sources['/src/shell/UpdateNote.tsx']).toMatch(/const busy = useGym\(\(s\) => s\.activity !== null \|\| s\.between !== null\)/)
  })

  it('V10B3-T4: with nothing going on there is no card and no strip, and the joystick sits in its corner', async () => {
    const app = await openApp()
    for (const tab of ['home', 'exercises', 'today'] as const) {
      app.tabs.openTab(tab)
      const shown = page(app)
      expect(shown, tab).not.toContain('workout-card')
      expect(shown, tab).not.toContain('workout-strip')
      // (the screen reader's line waits, empty, so the first words are heard)
      expect(shown, tab).toContain('<p class="visually-hidden" role="status"></p>')
    }
    // The joystick moves up by the card's height, kept on the app while the card is shown and taken away with it
    const { followCardHeight, CARD_HEIGHT } = await import('./cardHeight')
    const style = new Map<string, string>()
    const observed: unknown[] = []
    let resized = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(fit: () => void) {
          resized = fit
        }
        observe(target: unknown) {
          observed.push(target)
        }
        disconnect() {
          observed.length = 0
        }
      },
    )
    const app_ = { style: { setProperty: (key: string, value: string) => style.set(key, value), removeProperty: (key: string) => style.delete(key) } }
    const card = { offsetHeight: 135, closest: (selector: string) => (selector === '.app' ? app_ : null) }
    const stop = followCardHeight(card as unknown as HTMLElement)
    expect(style.get(CARD_HEIGHT)).toBe('135px')
    expect(observed).toEqual([card])
    card.offsetHeight = 150
    resized()
    expect(style.get(CARD_HEIGHT)).toBe('150px')
    stop()
    expect(style.has(CARD_HEIGHT)).toBe(false)
    expect(observed).toEqual([])
    expect(CARD_HEIGHT).toBe('--workout-card')
    // (the card follows its own height while it's drawn: from when it appears to when it goes)
    expect(sources['/src/shell/WorkoutCard.tsx']).toMatch(/useLayoutEffect\(\(\) => \(card\.current \? followCardHeight\(card\.current\) : undefined\), \[shown\]\)/)
    expect(sources['/src/shell/WorkoutCard.tsx']).toMatch(/<div className="workout-card" ref=\{card\}>/)
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    expect(css).toMatch(
      /\.joystick \{[^}]*bottom: min\(calc\(max\(24px, env\(safe-area-inset-bottom\)\) \+ var\(--workout-card, 0px\)\), calc\(100% - 128px\)\);/,
    )
    // A phone on its side: the card on the right, the joystick left in its corner
    expect(css).toMatch(
      /@media \(orientation: landscape\) and \(max-height: 520px\) \{\n  \.workout-card \{\n    left: auto;\n    width: min\(400px, 58%\);[\s\S]*?\.joystick \{\n    bottom: max\(24px, env\(safe-area-inset-bottom\)\);/,
    )
    // …and after a round, nothing again
    app.tabs.openTab('home')
    app.gym.startFromList('curl')
    expect(page(app)).toContain('class="workout-card"')
    app.gym.finishExercise()
    expect(page(app)).not.toContain('workout-card')
  })

  it('V10B3-T5: the header’s line and the list’s card are gone: what’s going on shows exactly once on any tab', async () => {
    const app = await openApp()
    app.weights.setKg('curl', 10)
    app.gym.startFromList('curl')
    pass(7 * REP + 0.1)
    for (const tab of ['home', 'exercises', 'today'] as const) {
      app.tabs.openTab(tab)
      const shown = page(app)
      expect(count(shown, '7 / 12 reps'), tab).toBe(1)
      expect(count(shown, 'role="status">Bicep curls, set 1 of 3'), tab).toBe(1)
      expect(count(shown, '>Done<'), tab).toBe(tab === 'home' ? 1 : 0)
      expect(shown, tab).not.toContain('Doing bicep curls')
      expect(shown, tab).not.toContain('shell-doing')
    }
    // On a history page too: the strip, and nothing on the page itself
    app.tabs.openTab('exercises')
    app.tabs.openHistory('curl')
    expect(count(page(app), '7 / 12 reps')).toBe(1)
    // With a mouse, the gym keeps its popup over the person, and has no card
    const desk = await openApp({ touch: false })
    desk.gym.startFromList('curl')
    expect(page(desk)).not.toContain('workout-card')
    expect(sources['/src/App.tsx']).toMatch(/\{home && !welcome && touch && <WorkoutCard \/>\}/)
    expect(sources['/src/player/Player.tsx']).toMatch(/const popup = !useTouchScreen\(\)/)
    expect(sources['/src/player/Player.tsx']).toMatch(/\{popup && activity && \(/)
    expect(sources['/src/player/Player.tsx']).toMatch(/\{popup && !activity && between && \(/)
    expect(sources['/src/shell/Header.tsx']).not.toMatch(/useGym|activity/)
    const shell = import.meta.glob('/src/shell/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(Object.keys(shell)).not.toContain('/src/shell/NowDoing.tsx')

    // Which card is showing, for the cursor to move on when it changes: each set its own, the
    // rest after a set, the end of a round; the same card through a change of pace or +30 s
    const { cardKey } = desk.text
    const set = (session: number, kind = 'curl') => ({ activity: { session, kind } as never, between: null })
    const after = (setNo: number, until: number | null) => ({ activity: null, between: { kind: 'curl', set: setNo, until } as never })
    const keys = [cardKey(set(1)), cardKey(set(2)), cardKey(after(1, 5)), cardKey(after(2, 9)), cardKey(after(3, null)), cardKey({ activity: null, between: null })]
    expect(new Set(keys).size).toBe(keys.length)
    expect(cardKey(set(1, 'run'))).toBe(cardKey(set(1, 'walk')))
    expect(cardKey(after(1, 5))).toBe(cardKey(after(1, 35)))
    expect(cardKey(after(3, 5))).not.toBe(cardKey(after(3, null)))
    expect(keys.at(-1)).toBeNull()
  })

  it('V10B3-T6: Space is Done during a set and Skip during the rest, on the gym only; Esc still stops; Space in a field or on a keyboard-chosen button is theirs', async () => {
    const app = await openApp()
    const stop = app.gym.listenToInteractionKeys()
    // A stand-in for what has the cursor: a field, or a button (chosen with the keyboard, or left focused by a click)
    const focusOn = (tag: 'input' | 'button' | 'a', { keyboard = false } = {}) => {
      const element = {
        blurred: false,
        closest: (selector: string) => (selector.split(',').map((s) => s.trim()).includes(tag) ? element : null),
        matches: (selector: string) => selector === ':focus-visible' && keyboard,
        blur() {
          element.blurred = true
        },
      }
      return element
    }
    const press = (code: string, target?: unknown) => {
      const event = Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false })
      if (target) Object.defineProperty(event, 'target', { value: target })
      app.browser.events.dispatchEvent(event)
      return event
    }
    app.gym.startFromList('curl')
    pass(3 * REP + 0.1)
    // On another tab, Space is nothing to the gym
    app.tabStore.setTab('exercises')
    press('Space')
    expect(app.gym.getGym().activity).not.toBeNull()
    app.tabStore.setTab('home')
    // In a field, or on a button the keyboard took you to, Space is theirs
    for (const target of [focusOn('input'), focusOn('button', { keyboard: true }), focusOn('a', { keyboard: true })]) {
      expect(press('Space', target).defaultPrevented).toBe(false)
      expect(app.gym.getGym().activity).not.toBeNull()
    }
    // On a button a click merely left the cursor on (the Gym tab, +30 s): Space is Done, and the button lets go
    const clicked = focusOn('button')
    const done = press('Space', clicked)
    expect(done.defaultPrevented).toBe(true)
    expect(clicked.blurred).toBe(true)
    expect(app.gym.getGym()).toMatchObject({ activity: null, between: { set: 1 } })
    expect(app.log.getLog().sets.at(-1)).toMatchObject({ reps: 3 })
    // Space again at once: its meaning has just changed (Done → Skip), so it waits, as a tap does…
    press('Space')
    expect(app.gym.getGym()).toMatchObject({ activity: null, between: { set: 1 } })
    // …and a moment later, Skip
    pass(0.7)
    expect(press('Space').defaultPrevented).toBe(true)
    expect(app.gym.getGym().activity).toMatchObject({ set: 2 })
    // A Space just as set 2 began (the rest ran out under it) doesn't end it with no rep
    press('Space')
    expect(app.gym.getGym().activity).toMatchObject({ set: 2 })
    // Esc: Stop, the round with it, at once (a key that always means the same)
    press('Escape')
    expect(app.gym.getGym()).toMatchObject({ activity: null, between: null })
    // After the last set, Space does nothing (Again is a button's)
    for (let i = 0; i < 2; i++) app.targets.nudgeTarget('curl', 'sets', -1)
    app.gym.startFromList('curl')
    pass(12 * REP + 0.1)
    expect(app.gym.getGym().between).toMatchObject({ until: null })
    pass(1)
    press('Space')
    expect(app.gym.getGym()).toMatchObject({ activity: null, between: { until: null } })
    stop()
    // The popup names the keys
    const { ActivityBubble } = await import('../interaction/ActivityBubble')
    app.gym.startFromList('curl')
    expect(words(html(createElement(ActivityBubble, { activity: app.gym.getGym().activity! })))).toMatch(/Done Space Finish Esc$/)
  })
})
