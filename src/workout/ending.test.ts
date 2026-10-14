import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

// The clocks, all under the test's control (fake timers): the time of day starts
// at 9:00 on 14 Oct 2026, and the exercise clock (performance.now) counts from
// there, so a timer that goes off reads the very moment it was set for
const DAY_START = new Date(2026, 9, 14, 9).getTime()
const pass = (seconds: number) => vi.advanceTimersByTime(seconds * 1000)
const REP = 2.4 // seconds per rep at the Normal tempo
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

// "Open the page": fresh app state, switched on by the same startApp() as
// main.tsx. Nothing here draws frames: the gym's render loop never runs.
async function openApp() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('requestAnimationFrame', () => {
    throw new Error('no frames: the gym is not being drawn')
  })
  vi.resetModules()
  const app = {
    gym: await import('../interaction/gymStore'),
    log: await import('../log/logStore'),
    build: await import('../build/buildStore'),
    targets: await import('../exercises/targets'),
    weights: await import('../exercises/weights'),
    tabs: await import('../shell/tabStore'),
    text: await import('../interaction/activityText'),
    ending: await import('./ending'),
  }
  stopApp = (await import('../shell/startup')).startApp()
  return app
}
type App = Awaited<ReturnType<typeof openApp>>
const saved = (app: App) => app.log.getLog().sets
const doing = (app: App) => app.gym.getGym().activity

// Pages as they'd show, as plain text
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
async function nowCard() {
  const { NowDoing } = await import('../shell/NowDoing')
  return text(renderToString(createElement(NowDoing)))
}
async function header() {
  const { Header } = await import('../shell/Header')
  return text(renderToString(createElement(Header)))
}

describe('A set with a target', { timeout: 30_000 }, () => {
  it('V10B1-T2: a set with target 12 ends by itself at exactly 12 reps and is saved with 12; without a target there is no end', async () => {
    const app = await openApp()
    app.tabs.setTab('exercises')
    expect(app.gym.startFromList('curl')).toBe(true)
    const set = doing(app)!
    expect(set).toMatchObject({ kind: 'curl', target: { sets: 3, reps: 12 }, set: 1, repSeconds: REP })

    // A moment before the twelfth rep is done it's still going…
    pass(12 * REP - 0.1)
    expect(doing(app)).toBe(set)
    expect(app.text.progressText(set, performance.now())).toBe('Set 1 of 3 · 11 of 12 reps')
    expect(saved(app)).toHaveLength(0)
    // …and just after, it has ended by itself and is saved: 12 reps, timed to the twelfth
    pass(0.1 + app.ending.END_MARGIN_MS / 1000)
    expect(doing(app)).toBeNull()
    expect(saved(app)).toHaveLength(1)
    expect(saved(app)[0]).toMatchObject({ kind: 'curl', reps: 12, seconds: 28.8 })
    expect(vi.getTimerCount()).toBe(1) // (its end timer went; this one is the rest's, before set 2: Block 2)

    // A set's end comes from its target and tempo: exactly 12 × 2.4 s after it began
    expect(app.gym.endsAt(set)).toBeCloseTo(set.startedAt + 28_800, 6)
    // Without a target there's no end: it runs until it's stopped, counting up
    expect(app.gym.endsAt({ ...set, target: undefined })).toBeNull()
    expect(app.text.progressText({ ...set, target: undefined }, set.startedAt + 20 * REP * 1000 + 100)).toBe('20 reps done')
    // A sleeping phone can hold a timer up: whenever the set is saved, it's saved as it would have ended, on time
    // …and at the time of day it would have ended
    const { finishedPart } = await import('../log/sets')
    const late = set.startedAt + 300_000
    expect(finishedPart(set, late, DAY_START + late)).toMatchObject({ reps: 12, seconds: 28.8, endedAt: DAY_START + set.startedAt + 28_800 })
    expect(finishedPart({ ...set, target: undefined }, late, DAY_START + late)).toMatchObject({ reps: 125, seconds: 300, endedAt: DAY_START + late })
    // The same through the app: curls at 23:50, the phone asleep until 8:50 the next morning
    // (its timer held up, so it's the waking that ends the set)
    vi.setSystemTime(new Date(2026, 9, 14, 23, 50))
    app.gym.startFromList('curl')
    const evening = doing(app)!
    vi.setSystemTime(new Date(2026, 9, 15, 8, 50))
    app.gym.stopExercise()
    expect(saved(app).at(-1)).toMatchObject({ reps: 12, seconds: 28.8, endedAt: DAY_START + evening.startedAt + 28_800 })
    expect(new Date(saved(app).at(-1)!.endedAt).getDate()).toBe(14)
    app.gym.finishExercise()
  })

  it('V10B1-T3: Done at 7 of 12 saves 7; cardio ends at its minutes with the matching distance; Stop and another exercise put the end timer away', async () => {
    const app = await openApp()
    app.tabs.setTab('exercises')

    // Done (the popup's button) at 7 of 12: saved with 7
    app.gym.startFromList('curl')
    pass(7 * REP + 0.3)
    const source = import.meta.glob('/src/interaction/ActivityBubble.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(source['/src/interaction/ActivityBubble.tsx']).toMatch(/onClick=\{\(\) => tapDone\(\)\}>\s*Done/)
    app.gym.stopExercise()
    expect(saved(app).at(-1)).toMatchObject({ kind: 'curl', reps: 7 })
    expect(vi.getTimerCount()).toBe(1) // its end timer went with it (this one is the rest's: Block 2)
    pass(60)
    expect(saved(app)).toHaveLength(1) // and nothing ends late

    // Cardio: a walk with its target of 10 minutes ends at 10:00, with 10 minutes' distance (1.5 m/s)
    app.gym.startFromList('walk')
    pass(600 - 0.1)
    expect(doing(app)?.kind).toBe('walk')
    pass(0.2)
    expect(doing(app)).toBeNull()
    expect(saved(app).at(-1)).toMatchObject({ kind: 'walk', seconds: 600, meters: 900 })
    // …and a change of pace keeps the session's end: walk 4 minutes, run the rest, 10 minutes in all
    app.gym.startFromList('walk')
    pass(240)
    app.gym.paceActions(doing(app)!).find((action) => action.label === 'Run')!.run()
    pass(360 + 0.1)
    expect(doing(app)).toBeNull()
    expect(saved(app).slice(-2)).toMatchObject([
      { kind: 'walk', seconds: 240, meters: 360 },
      { kind: 'run', seconds: 360, meters: 1080 },
    ])

    // Stop (Finish, Esc) puts the end timer away
    app.gym.startFromList('curl')
    pass(5)
    expect(vi.getTimerCount()).toBe(1)
    app.gym.finishExercise()
    expect(vi.getTimerCount()).toBe(0)

    // Starting another exercise mid-set: the first one's timer goes, the new one's is set
    app.gym.startFromList('curl')
    const curls = doing(app)!
    pass(5)
    app.gym.startFromList('lateral')
    const raises = doing(app)!
    expect(vi.getTimerCount()).toBe(1)
    pass(12 * REP - 5) // the curls would have ended here: the raises carry on
    expect(doing(app)).toBe(raises)
    pass(5 - 0.1)
    expect(doing(app)).toBe(raises)
    pass(0.2)
    expect(doing(app)).toBeNull()
    expect(saved(app).slice(-2)).toMatchObject([
      { kind: 'curl', reps: 2 },
      { kind: 'lateral', reps: 12 },
    ])
    expect(curls.session).not.toBe(raises.session)

    // Switching the app off (as a test does between runs) leaves no timer behind
    app.gym.startFromList('curl')
    expect(vi.getTimerCount()).toBe(1)
    stopApp!()
    stopApp = undefined
    expect(vi.getTimerCount()).toBe(0)
  })

  it('V10B1-T4: the end timer works with the render loop off; on a machine you step onto, the reps count from arriving', async () => {
    const app = await openApp()
    // On the Today tab the gym isn't drawn (and here nothing is ever drawn: no frames at all)
    app.tabs.setTab('today')
    app.gym.startFromList('squat')
    pass(12 * REP + 0.1)
    expect(doing(app)).toBeNull()
    expect(saved(app).at(-1)).toMatchObject({ kind: 'squat', reps: 12 })

    // In the gym, from the leg press's own menu: the person steps on first, and the
    // set (and its clock) begins on arrival, so stepping on never eats into the reps
    app.tabs.setTab('home')
    const press = app.build.getBuild().items.find((item) => item.type === 'legPress')!
    app.gym.setNearFurniture(press.id)
    app.gym.menuActions('furniture', app.gym.getGym(), 'legPress')[0].run()
    expect(doing(app)).toMatchObject({ kind: 'legPress', arrived: false })
    expect(vi.getTimerCount()).toBe(0) // no end yet: it hasn't begun
    pass(10)
    const stand = doing(app)!.stand!
    app.gym.stepOnto(stand) // (the one frame that sees the person reach the seat)
    app.tabs.setTab('today') // …and then the gym isn't drawn again
    expect(vi.getTimerCount()).toBe(1)
    pass(12 * REP - 0.1)
    expect(doing(app)?.kind).toBe('legPress')
    pass(0.2)
    expect(doing(app)).toBeNull()
    expect(saved(app).at(-1)).toMatchObject({ kind: 'legPress', reps: 12, seconds: 28.8 })

    // The app itself switches it on: startApp(), which main.tsx calls
    const startup = import.meta.glob('/src/shell/startup.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(startup['/src/shell/startup.ts']).toMatch(/const stopEnding = startEnding\(\)[\s\S]*stopEnding\(\)/)
  })

  it('V10B1-T7: between sets the card says what comes next, with Finish; the round keeps its target to the last set', async () => {
    const app = await openApp()
    app.tabs.setTab('exercises')
    app.weights.setKg('curl', 10)
    app.gym.startFromList('curl')
    const cameFrom = doing(app)!.returnTo
    expect(await nowCard()).toBe('Doing bicep curls · 10 kg Set 1 of 3 · 0 of 12 reps Done Finish')
    expect(await header()).toContain('Doing bicep curls · 10 kg · Set 1 of 3 · 0 of 12 reps')
    // In the gym's popup: Done for this set, and Finish (Esc) for the round
    const { BetweenBubble, ActivityBubble } = await import('../interaction/ActivityBubble')
    expect(text(renderToString(createElement(ActivityBubble, { activity: doing(app)! })))).toBe(
      'Doing bicep curls · 10 kg Set 1 of 3 · 0 of 12 reps Done Finish Esc',
    )
    pass(12 * REP + 0.1)

    // Set 1 is saved, and the round waits: on the card, in the header and over the person in the gym
    // (Block 2: it rests, "Rest · 1:30 · set 2 of 3 next", with +30 s, Skip and Finish)
    expect(saved(app)).toHaveLength(1)
    expect(app.gym.getGym().between).toMatchObject({ kind: 'curl', set: 1, target: { sets: 3, reps: 12 } })
    expect(await nowCard()).toBe('Bicep curls Rest · 1:30 · set 2 of 3 next Resting 1:30 before set 2 of 3 +30 s Skip Finish')
    expect(await header()).toContain('Bicep curls · Rest · 1:30 · set 2 of 3 next')
    expect(text(renderToString(createElement(BetweenBubble, { between: app.gym.getGym().between! })))).toBe(
      'Bicep curls Rest · 1:30 · set 2 of 3 next Resting 1:30 before set 2 of 3 +30 s Skip Finish Esc',
    )

    // The round keeps its target: a change now is for the next round
    app.targets.nudgeTarget('curl', 'reps', -1)
    app.weights.setKg('curl', 12) // (the weight can change between sets)
    app.gym.playerPose.x = 2.5 // (wherever the person is now: the next set still steps back to where they came from)
    expect(app.gym.nextSet()).toBe(true)
    expect(doing(app)).toMatchObject({ kind: 'curl', set: 2, target: { sets: 3, reps: 12 }, kg: 12 })
    expect(doing(app)!.returnTo).toEqual(cameFrom)
    expect(app.gym.getGym().between).toBeNull()
    pass(12 * REP + 0.1)
    expect(app.gym.getGym().between).toMatchObject({ set: 2 })
    app.gym.nextSet()
    // The last set: Done is all there is, and it takes Esc
    expect(text(renderToString(createElement(ActivityBubble, { activity: doing(app)! })))).toBe(
      'Doing bicep curls · 12 kg Set 3 of 3 · 0 of 12 reps Done Esc',
    )
    expect(await nowCard()).toBe('Doing bicep curls · 12 kg Set 3 of 3 · 0 of 12 reps Finish')
    pass(12 * REP + 0.1)
    expect(doing(app)).toBeNull()
    // After the last set there's no rest (Block 2: "3 sets done", with Again and Finish)
    expect(app.gym.getGym().between).toMatchObject({ set: 3, until: null })
    expect(saved(app).map((set) => [set.reps, set.kg])).toEqual([
      [12, 10],
      [12, 12],
      [12, 12],
    ])
    expect(await nowCard()).toBe('Bicep curls 3 sets done 3 sets done Again Finish')
    app.gym.finishFromList()
    expect(await nowCard()).toBe('')

    // Finish between sets ends the round; Finish (or Esc, or Stop) mid-set ends it with no next set
    app.gym.startFromList('curl')
    expect(doing(app)?.target).toEqual({ sets: 3, reps: 11 }) // the new round has the new target
    pass(3 * REP + 0.1)
    app.gym.stopExercise() // Done
    expect(app.gym.getGym().between).toMatchObject({ set: 1 })
    app.gym.finishFromList()
    expect(app.gym.getGym().between).toBeNull()
    expect(doing(app)).toBeNull()
    app.gym.startFromList('curl')
    pass(3 * REP + 0.1)
    app.gym.finishExercise()
    expect(app.gym.getGym().between).toBeNull()
    // Walking away mid-set counts as Done (V10-D4); one that never got going (no rep yet) isn't a set
    app.gym.startFromList('curl')
    pass(3 * REP + 0.1)
    app.gym.stopExercise()
    expect(app.gym.getGym().between).toMatchObject({ set: 1 })
    app.gym.nextSet()
    pass(1)
    app.gym.stopExercise()
    expect(app.gym.getGym().between).toBeNull()
    // Starting something else between sets ends the round
    app.gym.startFromList('curl')
    pass(3 * REP + 0.1)
    app.gym.stopExercise()
    app.gym.startFromList('squat')
    expect(app.gym.getGym().between).toBeNull()
    app.gym.finishExercise()
    // A cardio round counts a set that changed pace near its end: its first part is saved
    for (let i = 0; i < 2; i++) app.targets.nudgeTarget('walk', 'sets', 1)
    app.gym.startFromList('walk')
    pass(595)
    app.gym.paceActions(doing(app)!).find((action) => action.label === 'Run')!.run()
    pass(5 + 0.1) // the walk's 10 minutes are up 5 s into the run
    expect(saved(app).at(-1)).toMatchObject({ kind: 'walk', seconds: 595 })
    expect(app.gym.getGym().between).toMatchObject({ set: 1, target: { sets: 3, minutes: 10 } })
    app.gym.nextSet()
    expect(doing(app)).toMatchObject({ kind: 'run', set: 2 }) // (carrying on at the pace it ended on)
    pass(180)
    app.gym.paceActions(doing(app)!).find((action) => action.label === 'Walk')!.run()
    pass(5)
    app.gym.stopExercise() // Done 5 s into the walk
    expect(app.gym.getGym().between).toMatchObject({ set: 2 })
    app.gym.finishExercise()
    // …but only by what's saved, counted up to its end: a 1-minute ride whose pace changed every
    // 8 s (no part long enough to save) isn't one of its sets, even when its end comes an hour late
    app.targets.nudgeTarget('ride', 'sets', 1)
    for (let i = 0; i < 9; i++) app.targets.nudgeTarget('ride', 'minutes', -1)
    expect(app.targets.targetFor('ride')).toEqual({ sets: 2, minutes: 1 })
    const before = saved(app).length
    app.gym.startFromList('ride')
    for (let i = 0; i < 7; i++) {
      pass(8)
      app.gym.paceActions(doing(app)!)[0].run()
    }
    pass(3) // 59 s in: the last part is 3 s long, and the phone falls asleep
    vi.setSystemTime(Date.now() + 3_600_000)
    app.gym.stopExercise() // (its held-up timer, on waking)
    expect(saved(app)).toHaveLength(before)
    expect(app.gym.getGym().between).toBeNull()

    // Picking up the floor dumbbell between sets is doing something else: the round is over
    app.gym.startFromList('curl')
    pass(3 * REP + 0.1)
    app.gym.stopExercise()
    expect(app.gym.getGym().between).toMatchObject({ set: 1 })
    app.gym.setNear(true)
    app.gym.menuActions('dumbbell', app.gym.getGym()).find((action) => action.label === 'Pick up')!.run()
    expect(app.gym.getGym()).toMatchObject({ holding: true, between: null })
    app.gym.menuActions('dumbbell', app.gym.getGym()).find((action) => action.label === 'Drop')!.run()

    // Done and Next set take each other's place: a tap within 0.6 s of the swap was meant for
    // the button that was there, and is ignored (as Remove and Undo do)
    app.gym.startFromList('curl')
    pass(0.3)
    expect(app.gym.tapDone()).toBe(false) // the second tap of a double tap on Start or Next set
    expect(doing(app)?.set).toBe(1)
    pass((app.gym.endsAt(doing(app)!)! - performance.now()) / 1000 + 0.1) // the set ends by itself…
    pass(0.2)
    expect(app.gym.tapNextSet()).toBe(false) // …just as Done was tapped: it lands on Next set
    expect(doing(app)).toBeNull()
    pass(0.4)
    expect(app.gym.tapNextSet()).toBe(true) // a real tap, a moment later
    expect(doing(app)?.set).toBe(2)
    pass(0.2)
    expect(app.gym.tapDone()).toBe(false) // its second tap lands on the new set's Done
    expect(doing(app)?.set).toBe(2)
    pass(0.5)
    expect(app.gym.tapDone()).toBe(true)
    expect(saved(app).at(-1)).toMatchObject({ kind: 'curl' })
    app.gym.finishExercise()

    // E mid-set (the gym's "stop") and switching to build mode end the round too
    app.gym.startFromList('curl')
    pass(3 * REP + 0.1)
    app.gym.toggleMenu()
    expect([doing(app), app.gym.getGym().between]).toEqual([null, null])
    app.gym.startFromList('curl')
    pass(3 * REP + 0.1)
    const { switchMode } = await import('../build/actions')
    switchMode()
    expect([doing(app), app.gym.getGym().between]).toEqual([null, null])
    switchMode()

    // The buttons do what they say (they can't be clicked without a browser, so read what they call)
    const sources = import.meta.glob(['/src/shell/NowDoing.tsx', '/src/interaction/ActivityBubble.tsx', '/src/interaction/gymStore.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const card = sources['/src/shell/NowDoing.tsx']
    // (Block 2: Skip and +30 s while resting; Again after the last set)
    expect(card).toMatch(/key="skip" [^>]*data-next onClick=\{\(\) => tapNextSet\(\)\}>\s*Skip/)
    expect(card).toMatch(/key="more" [^>]*onClick=\{\(\) => tapMoreRest\(\)\}>\s*\+30 s/)
    expect(card).toMatch(/key="again" [^>]*data-next onClick=\{\(\) => tapAgain\(\)\}>\s*Again/)
    // (Block 2: Finish waits out the swap pause too, as Skip moves to where it appears)
    expect(card).toMatch(/key="finish" [^>]*onClick=\{\(\) => tapFinish\(\)\}>\s*Finish/)
    expect(card).toMatch(/key="done" [^>]*data-next onClick=\{\(\) => tapDone\(\)\}>\s*Done/)
    expect(card).toMatch(/key="finish"\s*type="button"\s*className="list-button is-primary"\s*data-next=\{!moreToCome \|\| undefined\}\s*onClick=\{\(\) => tapFinish\(\)\}/)
    // The card changes under the cursor (Done, Next set, a set ending by itself): if the button
    // with the cursor went, the cursor goes on to the new card's next step, or to the page's title
    // (where the cursor is: noticed as it moves, and after every redraw, before which the card's change is checked)
    expect(card).toMatch(/const notice = \(target: Node \| null\) => \{\s*cursorOnCard\.current = actions\.current\?\.contains\(target\) \?\? false/)
    expect(card).toMatch(/const onFocus = \(event: FocusEvent\) => notice\(event\.target as Node\)\s*document\.addEventListener\('focusin', onFocus\)/)
    expect(card).toMatch(
      /useLayoutEffect\(\(\) => \{\s*if \(card !== shown\.current\) \{\s*shown\.current = card\s*if \(cursorOnCard\.current && !actions\.current\?\.contains\(document\.activeElement\)\) \{\s*const next = actions\.current\?\.querySelector<HTMLButtonElement>\('\[data-next\]'\) \?\? page\.current\?\.querySelector\('h2'\)\s*next\?\.focus\(\)\s*\}\s*\}\s*notice\(document\.activeElement\)/,
    )
    const pages = import.meta.glob(['/src/shell/ExercisesPage.tsx', '/src/shell/ExerciseHistoryPage.tsx', '/src/App.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(pages['/src/shell/ExercisesPage.tsx']).toMatch(/<h2 id="exercises-title" tabIndex=\{-1\}>/)
    expect(pages['/src/shell/ExerciseHistoryPage.tsx']).toMatch(/<h2 id="history-title" ref=\{title\} tabIndex=\{-1\}>/)
    // The gym, its popups included, is out of reach while another tab covers it
    expect(pages['/src/App.tsx']).toMatch(/<div className="gym-layer" inert=\{welcome \|\| !home\}>/)
    // On a phone the popup's buttons go under its words, and the header line stays one line
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    expect(css).toMatch(/\n\.bubble-actions \{\n  display: contents;\n\}/) // (beside the words on a desktop, as before)
    expect(css).toMatch(
      /@media \(max-width: 480px\) \{\n  \.activity-bubble \{\n    flex-direction: column;\n    align-items: flex-start;\n    gap: 8px;\n    width: max-content;\n    max-width: calc\(100vw - 24px\);\n  \}\n\n  \.bubble-actions \{\n    display: flex;\n    flex-wrap: wrap;/,
    )
    expect(sources['/src/interaction/ActivityBubble.tsx'].match(/<div className="bubble-actions">/g)).toHaveLength(2)
    expect(css).toMatch(/\.shell-doing \{\n  overflow: hidden;[\s\S]*?text-overflow: ellipsis;\n  white-space: nowrap;\n\}/)
    expect(sources['/src/interaction/ActivityBubble.tsx']).toMatch(/onClick=\{\(\) => tapNextSet\(\)\}>\s*Skip/)
    expect(sources['/src/interaction/ActivityBubble.tsx']).toMatch(/onClick=\{\(\) => tapMoreRest\(\)\}>\s*\+30 s/)
    expect(sources['/src/interaction/ActivityBubble.tsx']).toMatch(/onClick=\{\(\) => tapAgain\(\)\}>\s*Again/)
    expect(sources['/src/interaction/ActivityBubble.tsx']).toMatch(/onClick=\{\(\) => tapFinish\(\)\}>\s*Finish/)
    // Esc in the gym, and its menu's Stop, mean Finish
    expect(sources['/src/interaction/gymStore.ts']).toMatch(/e\.code === 'Escape'\) \{\s*if \(state\.menu\) closeMenu\(\)\s*else finishExercise\(\)/)
    expect(sources['/src/interaction/gymStore.ts']).toMatch(/\{ label: 'Stop', run: finishExercise \}/)
  })
})
