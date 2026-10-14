import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

// The clocks, all under the test's control (fake timers): the time of day starts
// at 9:00 on 15 Oct 2026, and the exercise clock (performance.now) counts from
// there, so a timer that goes off reads the very moment it was set for
const DAY_START = new Date(2026, 9, 15, 9).getTime()
const pass = (seconds: number) => vi.advanceTimersByTime(seconds * 1000)
// The phone asleep: the clocks move on, and its timers are held up meanwhile
const sleep = (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000)
const REP = 2.4 // seconds per rep at the Normal tempo
const SET_OF_12 = 12 * REP + 0.1 // twelve reps, and the moment the set ends by itself
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
async function openApp(saved: Record<string, string> = {}) {
  const data = new Map(Object.entries(saved))
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
    data,
    gym: await import('../interaction/gymStore'),
    log: await import('../log/logStore'),
    build: await import('../build/buildStore'),
    targets: await import('../exercises/targets'),
    weights: await import('../exercises/weights'),
    settings: await import('../settings/settings'),
    tabs: await import('../shell/tabStore'),
    text: await import('../interaction/activityText'),
  }
  stopApp = (await import('../shell/startup')).startApp()
  return app
}
type App = Awaited<ReturnType<typeof openApp>>
const doing = (app: App) => app.gym.getGym().activity
const resting = (app: App) => app.gym.getGym().between
const saved = (app: App) => app.log.getLog().sets
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
// Set a target with the steppers
function target(app: App, kind: Parameters<App['targets']['targetFor']>[0], sets: number, amount: number) {
  const now = app.targets.targetFor(kind)
  const part = now.minutes !== undefined ? 'minutes' : 'reps'
  for (let i = now.sets; i !== sets; i += sets > i ? 1 : -1) app.targets.nudgeTarget(kind, 'sets', sets > i ? 1 : -1)
  while (app.targets.targetFor(kind)[part] !== amount) app.targets.nudgeTarget(kind, part, amount > app.targets.targetFor(kind)[part]! ? 1 : -1)
}

describe('Rest between sets', { timeout: 30_000 }, () => {
  it('V10B2-T1: after set 1 of 3 the rest is 90 s (60 s for cardio), and at zero set 2 starts on the same machine with the same weight and target', async () => {
    const app = await openApp()
    app.tabs.setTab('exercises')
    app.weights.setKg('curl', 14)
    app.gym.startFromList('curl')
    const first = doing(app)!
    pass(SET_OF_12)

    // The rest begins as set 1 ends
    const rest = resting(app)!
    expect(rest).toMatchObject({ kind: 'curl', set: 1, target: { sets: 3, reps: 12 }, machineId: first.machineId })
    expect(rest.until! - rest.since).toBe(90_000)
    expect(app.text.betweenText(rest, performance.now())).toBe('Rest · 1:30 · set 2 of 3 next')

    // Wherever the person wanders meanwhile (here: right beside another rack), the next set is on the same one
    const other = app.build.getBuild().items.find((item) => item.type === 'dumbbellRack' && item.id !== first.machineId)!
    app.gym.playerPose.x = other.x
    app.gym.playerPose.z = other.z
    app.weights.setKg('curl', 16) // (the weight picked for it may change between sets)
    pass(90 - 0.1)
    expect(doing(app)).toBeNull()
    expect(app.text.betweenText(resting(app)!, performance.now())).toBe('Rest · 0:01 · set 2 of 3 next')
    pass(0.2)
    expect(doing(app)).toMatchObject({ kind: 'curl', set: 2, target: { sets: 3, reps: 12 }, kg: 16, machineId: first.machineId })
    expect(doing(app)!.returnTo).toEqual(first.returnTo)
    expect(resting(app)).toBeNull()
    // …and after set 2, set 3 the same way
    pass(SET_OF_12)
    expect(resting(app)).toMatchObject({ set: 2 })
    pass(90)
    expect(doing(app)).toMatchObject({ set: 3 })
    app.gym.finishExercise()

    // Cardio rests 60 s: a walk of 2 × 1 minute
    target(app, 'walk', 2, 1)
    app.gym.startFromList('walk')
    pass(60 + 0.1)
    expect(resting(app)!.until! - resting(app)!.since).toBe(60_000)
    pass(60)
    expect(doing(app)).toMatchObject({ kind: 'walk', set: 2, target: { sets: 2, minutes: 1 } })
    app.gym.finishExercise()

    // The lengths are Workout settings: 15 s to 5 minutes, in steps of 15 s, remembered
    app.settings.nudgeRest('strength', 1)
    app.settings.nudgeRest('cardio', -1)
    expect(app.settings.getSettings().rest).toEqual({ strength: 105, cardio: 45 })
    app.gym.startFromList('curl')
    pass(SET_OF_12)
    expect(resting(app)!.until! - resting(app)!.since).toBe(105_000)
    app.gym.finishExercise()
    for (let i = 0; i < 30; i++) app.settings.nudgeRest('strength', 1)
    for (let i = 0; i < 30; i++) app.settings.nudgeRest('cardio', -1)
    expect(app.settings.getSettings().rest).toEqual({ strength: 300, cardio: 15 })
    expect(JSON.parse(app.data.get('gym3d.settings')!).rest).toEqual({ strength: 300, cardio: 15 })
    // A saved length that isn't on the steps, or out of range, is the default (alone)
    const odd = await openApp({ 'gym3d.settings': JSON.stringify({ rest: { strength: 100, cardio: 45 }, tempo: 'fast' }) })
    expect(odd.settings.getSettings()).toMatchObject({ tempo: 'fast', rest: { strength: 90, cardio: 45 } })
    const far = await openApp({ 'gym3d.settings': JSON.stringify({ rest: { strength: 600, cardio: 0 } }) })
    expect(far.settings.getSettings().rest).toEqual({ strength: 90, cardio: 60 })
    // …and saved lengths that check out come back after a reload
    const back = await openApp({ 'gym3d.settings': JSON.stringify({ rest: { strength: 120, cardio: 45 } }) })
    expect(back.settings.getSettings().rest).toEqual({ strength: 120, cardio: 45 })
  })

  it('V10B2-T2: +30 s makes the rest 30 s longer; Skip starts the next set now; Finish ends the round with no rest and no next set', async () => {
    const app = await openApp()
    app.gym.startFromList('curl')
    pass(SET_OF_12)
    const rest = resting(app)!

    // +30 s, twice: the next set starts a minute later
    pass(1)
    expect(app.gym.tapMoreRest()).toBe(true)
    expect(app.gym.tapMoreRest()).toBe(true)
    expect(resting(app)!.until).toBe(rest.until! + 60_000)
    expect(app.text.betweenText(resting(app)!, performance.now())).toBe('Rest · 2:29 · set 2 of 3 next')
    pass(89 + 0.1)
    expect(doing(app)).toBeNull() // (the 90 s it was)
    pass(60)
    expect(doing(app)).toMatchObject({ set: 2 })
    // …never more than 10 minutes from now
    pass(SET_OF_12)
    pass(1)
    for (let i = 0; i < 40; i++) app.gym.tapMoreRest()
    expect(resting(app)!.until).toBe(performance.now() + 600_000)

    // Skip: the next set, now
    expect(app.gym.tapNextSet()).toBe(true)
    expect(doing(app)).toMatchObject({ set: 3 })
    expect(vi.getTimerCount()).toBe(1) // (set 3's own end; the rest's timer went)
    app.gym.finishExercise()

    // Finish during the rest: no rest, and nothing starts later
    app.gym.startFromList('curl')
    pass(SET_OF_12)
    expect(resting(app)).not.toBeNull()
    app.gym.finishFromList()
    expect(resting(app)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    pass(600)
    expect(doing(app)).toBeNull()
    expect(saved(app).length).toBe(3) // (sets 1 and 2, and this one; set 3 was finished before its first rep)

    // +30 s and Skip, like Done, ignore a tap in the first 0.6 s (a tap meant for the button that was there)
    app.gym.startFromList('curl')
    pass(SET_OF_12)
    pass(0.3)
    expect(app.gym.tapMoreRest()).toBe(false)
    expect(app.gym.tapNextSet()).toBe(false)
    expect(resting(app)).toMatchObject({ set: 1 })
    pass(0.4)
    expect(app.gym.tapAgain()).toBe(false) // (Again is for after the last set, not a rest)
    expect(app.gym.tapNextSet()).toBe(true)
    // …and so does Finish, which appears where Skip was: a double tap on Skip doesn't end set 2 at once
    pass(0.2)
    expect(app.gym.tapFinish()).toBe(false)
    expect(doing(app)).toMatchObject({ set: 2 })
    pass(0.5)
    expect(app.gym.tapFinish()).toBe(true)
    expect([doing(app), resting(app)]).toEqual([null, null])
    // …and a pace button, which takes the place of +30 s on the treadmill (Walk ↔ Run swap in place too)
    target(app, 'walk', 2, 1)
    app.gym.startFromList('walk')
    pass(60 + 0.1)
    pass(60)
    expect(doing(app)).toMatchObject({ kind: 'walk', set: 2 })
    pass(0.3)
    expect(app.gym.swapSettled()).toBe(false)
    pass(0.4)
    expect(app.gym.swapSettled()).toBe(true)
    app.gym.paceActions(doing(app)!).find((action) => action.label === 'Run')!.run()
    pass(0.3)
    expect(app.gym.swapSettled()).toBe(false) // (the change of pace swapped the buttons: Run became Walk)
    app.gym.finishExercise()
    // (Block 3: the workout card has one Finish for every card; the popup one for a set and one after it)
    const sources = import.meta.glob(['/src/shell/WorkoutCard.tsx', '/src/interaction/ActivityBubble.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [file, source] of Object.entries(sources)) {
      expect(source, file).toMatch(/onClick=\{\(\) => swapSettled\(\) && action\.run\(\)\}/)
      expect(source.match(/onClick=\{\(\) => tapFinish\(\)\}/g)?.length, file).toBe(file.includes('WorkoutCard') ? 1 : 2)
    }

    // +30 s when the rest's end has passed (its timer held up): 30 s from now
    app.gym.startFromList('curl')
    pass(SET_OF_12)
    const late = resting(app)!.until! + 5000
    expect(app.gym.moreRest(late)).toBe(true)
    expect(resting(app)!.until).toBe(late + 30_000)
    app.gym.finishExercise()
  })

  it('V10B2-T3: after the last set there is no rest: "3 sets done", and Again starts one more set with the same target', async () => {
    const app = await openApp()
    target(app, 'curl', 2, 2)
    app.gym.startFromList('curl')
    pass(2 * REP + 0.1)
    pass(90)
    pass(2 * REP + 0.1)

    // Two sets done: no rest, no timer, nothing more starts by itself
    expect(resting(app)).toMatchObject({ set: 2, until: null, target: { sets: 2, reps: 2 } })
    expect(app.text.betweenText(resting(app)!, performance.now())).toBe('2 sets done')
    expect(vi.getTimerCount()).toBe(0)
    pass(600)
    expect(doing(app)).toBeNull()
    expect(saved(app)).toHaveLength(2)
    expect(app.gym.tapNextSet()).toBe(false) // (Skip isn't offered: there's nothing to skip)
    expect(app.gym.moreRest()).toBe(false) // (nor +30 s)

    // Again: one more, counted as set 3 of 3
    expect(app.gym.tapAgain()).toBe(true)
    expect(doing(app)).toMatchObject({ set: 3, target: { sets: 3, reps: 2 } })
    expect(app.text.progressText(doing(app)!, performance.now())).toBe('Set 3 of 3 · 0 of 2 reps')
    pass(2 * REP + 0.1)
    expect(resting(app)).toMatchObject({ set: 3, until: null })
    expect(app.text.betweenText(resting(app)!, performance.now())).toBe('3 sets done')
    // (a Done tapped just as that set ended by itself would land on Again: it waits out the swap too)
    expect(app.gym.tapAgain(performance.now() + 300)).toBe(false)
    expect(saved(app)).toHaveLength(3)
    app.gym.finishExercise()
    expect(resting(app)).toBeNull()

    // A round of one set (cardio's 1 × 10 minutes) never rests: it's done at once
    app.gym.startFromList('walk')
    pass(600 + 0.1)
    expect(resting(app)).toMatchObject({ set: 1, until: null })
    expect(app.text.betweenText(resting(app)!, performance.now())).toBe('1 set done')
    // A set without a target has no round at all: nothing to rest after
    expect(app.text.betweenText({ set: 1, target: { sets: 3, reps: 12 }, since: 0, until: null }, 0)).toBe('1 set done')
    const gymSource = import.meta.glob('/src/interaction/gymStore.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(gymSource['/src/interaction/gymStore.ts']).toMatch(/if \(!target \|\| !activity\.arrived\) return null/)
  })

  it('V10B2-T4: walking away mid-set leads to rest like Done (V10-D4), and walking about during the rest lets it carry on', async () => {
    const app = await openApp()
    app.gym.startFromList('curl')
    pass(5 * REP + 0.1)
    // Walking away is the gym's Done: the set is saved, and the rest begins
    app.gym.stopExercise()
    expect(saved(app).at(-1)).toMatchObject({ kind: 'curl', reps: 5 })
    expect(resting(app)).toMatchObject({ set: 1 })
    // The person walks about (they're put back on the machine at zero)
    app.gym.playerPose.x += 3
    pass(90)
    expect(doing(app)).toMatchObject({ set: 2 })

    // The walking rule, frame by frame: a push during a set is walking away (Done); a stick already
    // held as a set begins (the next set starting under someone walking about) isn't, until let go once
    const { watchWalkingAway } = await import('../player/walkAway')
    const walking = watchWalkingAway()
    const [one, two] = [{ session: 1 }, { session: 2 }]
    expect(walking(0, one)).toBe(false)
    expect(walking(0.05, one)).toBe(false) // (a slight push is standing still)
    expect(walking(1, one)).toBe(true)
    expect(walking(1, null)).toBe(false) // resting: just walking about
    expect(walking(1, two)).toBe(false) // set 2 starts while the stick is held
    expect(walking(0.8, two)).toBe(false)
    expect(walking(0, two)).toBe(false) // let go…
    expect(walking(0.8, two)).toBe(true) // …and a new push is walking away
    const fresh = watchWalkingAway()
    expect(fresh(0, two)).toBe(false)
    expect(fresh(0.5, two)).toBe(true) // (a set begun with the stick idle: the first push counts)

    // Through the app: wandering about all through a rest, still walking as it runs out
    const walker = watchWalkingAway()
    const frame = () => {
      if (walker(1, doing(app))) app.gym.stopExercise()
    }
    pass(SET_OF_12)
    frame()
    expect(resting(app)).toMatchObject({ set: 2 })
    for (let i = 0; i < 90; i++) {
      pass(1)
      frame()
    }
    expect(doing(app)).toMatchObject({ set: 3 }) // set 3 started under the held stick, and goes on
    pass(1)
    frame()
    expect(doing(app)).toMatchObject({ set: 3 })
    walker(0, doing(app)) // let go
    pass(2 * REP)
    frame() // and walk away: Done
    expect(doing(app)).toBeNull()
    expect(saved(app).at(-1)).toMatchObject({ reps: 2 })

    // (The gym asks this rule every frame, and only ever means Done by it: nothing about walking ends a rest)
    const playerSource = (import.meta.glob('/src/player/Player.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/player/Player.tsx']
    expect(playerSource).toMatch(/const \[walkingAway\] = useState\(watchWalkingAway\)/)
    expect(playerSource).toMatch(/if \(walkingAway\(strength, getGym\(\)\.activity\)\) stopExercise\(\)/)
    expect(playerSource).not.toMatch(/finishExercise|between: null|strength > 0\.1 &&/)
  })

  it('V10B2-T6: the rest and the next set work with the render loop off, and the countdown is right after a 40 s pause', async () => {
    const app = await openApp()
    app.tabs.setTab('today') // (the gym isn't drawn; and no frames are drawn here at all)
    app.gym.startFromList('squat')
    pass(SET_OF_12)
    const rest = resting(app)!

    // The phone sleeps 40 s mid-rest: the countdown is worked out from the clock, so it's right on waking
    pass(10)
    sleep(40)
    expect(app.text.betweenText(rest, performance.now())).toBe('Rest · 0:40 · set 2 of 3 next')
    const { WorkoutCard } = await import('../shell/WorkoutCard')
    expect(text(renderToString(createElement(WorkoutCard)))).toContain('squat · set 2 of 3 next 20 kg Rest 0:40')

    // The held-up timer still starts set 2 when it goes off: late, but not lost, and from then
    expect(doing(app)).toBeNull()
    vi.advanceTimersToNextTimer()
    expect(doing(app)).toMatchObject({ kind: 'squat', set: 2 })
    expect(doing(app)!.startedAt).toBe(performance.now())
    expect(performance.now() - rest.until!).toBe(40_000)

    // The app switches the rest's timer on: startApp(), which main.tsx calls
    const startup = (import.meta.glob('/src/shell/startup.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/shell/startup.ts']
    expect(startup).toMatch(/const stopRounds = startRounds\(\)[\s\S]*stopRounds\(\)/)
    // The card and the strip count down every half second; the popup every quarter
    const sources = import.meta.glob(['/src/shell/WorkoutCard.tsx', '/src/interaction/ActivityBubble.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(sources['/src/shell/WorkoutCard.tsx']).toMatch(/useTicking\(activity !== null \|\| resting, 500\)/)
    expect(sources['/src/interaction/ActivityBubble.tsx']).toMatch(/useTicking\(resting, 250\)/)
    // A status line that changed every second would be read out every second: the ticking part is hidden from screen readers
    expect(sources['/src/shell/WorkoutCard.tsx']).toMatch(/<p className="workout-count" aria-hidden="true">\s*\{words\.count\}\s*<\/p>/)
    expect(sources['/src/shell/WorkoutCard.tsx']).toMatch(/<p className="visually-hidden" role="status">\s*\{words \?\? ''\}\s*<\/p>/)
    expect(app.text.betweenWords(rest)).toBe('Resting 1:30 before set 2 of 3')
    // (a display whose clock last ticked before the rest began shows the rest's full length, not 1:31)
    expect(app.text.betweenText(rest, rest.since - 400)).toBe('Rest · 1:30 · set 2 of 3 next')
    // The countdown hooks read the clock itself on every tick (never add up ticks, which a sleeping phone skips)
    const ticking = (import.meta.glob('/src/lib/ticking.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['/src/lib/ticking.ts']
    expect(ticking).toMatch(/const timer = setInterval\(\(\) => setNow\(performance\.now\(\)\), ms\)/)
  })

  it('V10B2-T7: the resting pose (hands on hips, breathing) is used only while resting and standing still; walking about drops the pose, not the rest', async () => {
    const { restingPose, BREATH_SECONDS, HANDS_ON_HIPS } = await import('../player/poseMath')
    const { limbEnds } = await import('../player/bodyKinematics')
    // Hands on the hips: each hand at the side of the waist, elbows out wider
    const pose = restingPose(0)
    const ends = limbEnds(pose)
    for (const [i, side] of [
      [0, 1],
      [1, -1],
    ]) {
      const hand = ends.hands[i]
      expect(hand.x * side, `hand ${i}`).toBeCloseTo(HANDS_ON_HIPS.x, 1)
      expect(hand.y, `hand ${i}`).toBeCloseTo(HANDS_ON_HIPS.y, 1)
      expect(hand.z, `hand ${i}`).toBeCloseTo(HANDS_ON_HIPS.z, 1)
      expect(ends.elbows[i].x * side, `elbow ${i}`).toBeGreaterThan(hand.x * side + 0.05)
    }
    // Breathing: the body sways a little back and forth, once every 4 seconds (a slow, resting breath)
    expect(BREATH_SECONDS).toBe(4)
    expect(restingPose(1).lean).toBeGreaterThan(0.015)
    expect(restingPose(3).lean).toBeLessThan(-0.015)
    expect(restingPose(4).lean).toBeCloseTo(0, 6)
    expect(pose.foot).toBeNull() // (standing legs)

    // The person takes it only while resting between sets (not after the last) and standing still
    const sources = import.meta.glob(['/src/player/Person.tsx', '/src/player/Player.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(sources['/src/player/Person.tsx']).toMatch(/: resting && amount < STILL\s*\? restingPose\(performance\.now\(\) \/ 1000\)\s*: null/)
    expect(sources['/src/player/Player.tsx']).toMatch(/const resting = !activity && between !== null && between\.until !== null/)
    expect(sources['/src/player/Player.tsx'].match(/resting=\{resting\}/g)).toHaveLength(2) // (the model, and the stand-in while it loads)

    // Walking about mid-rest: the rest carries on (the user's decision for Block 2), and ends on time
    const app = await openApp()
    app.gym.startFromList('curl')
    pass(SET_OF_12)
    app.gym.playerPose.x += 4
    pass(45)
    expect(resting(app)).toMatchObject({ set: 1 })
    pass(45)
    expect(doing(app)).toMatchObject({ set: 2 })
    // The settings section offers the rest lengths and the cues (see WorkoutSettings)
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    expect(css).toMatch(/\.setting-toggle input \{\n  width: 20px;\n  height: 20px;/)
  })
})
