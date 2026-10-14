import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { EXERCISES, type ExerciseKind } from './catalog'

const TARGETS = 'gym3d.targets' // (spelt out: the saved key must not change by accident)
const KINDS = Object.keys(EXERCISES) as ExerciseKind[]
// Node's own modules, loaded by name at run time (the app's types don't include Node)
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)
// Decision P-D3, written out: cardio is what moves at a speed; everything else (pull-ups too) counts reps
const CARDIO: ExerciseKind[] = ['walk', 'run', 'ride', 'sprint', 'row']

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
const savedTargets = (targets: unknown, version: unknown = 1) => ({ [TARGETS]: JSON.stringify({ version, targets }) })

let t = 0
beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// "Open the page": a fresh copy of the app's state reading `storage`
async function openApp(storage = fakeStorage()) {
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  return {
    storage,
    targets: await import('./targets'),
    weights: await import('./weights'),
    gym: await import('../interaction/gymStore'),
    text: await import('../interaction/activityText'),
    open: await import('../shell/targetOpen'),
  }
}

// The Exercises page as it would show, and one exercise's row on it
const clean = (html: string) => html.replaceAll('<!-- -->', '').replaceAll('&#x27;', "'")
async function exercisesPage() {
  const { ExercisesPage } = await import('../shell/ExercisesPage')
  return clean(renderToString(createElement(ExercisesPage, { now: 0 })))
}
const row = (html: string, name: string) =>
  (html.split('<li>').find((part) => part.includes(`<span>${name}</span>`)) ?? '').split('</li>')[0]
// A row's words as plain text, in order
const words = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const off = (part: string, label: string) =>
  new RegExp(`disabled=""[^>]*aria-label="${label}"|aria-label="${label}"[^>]*disabled=""`).test(part)

describe('Targets', { timeout: 30_000 }, () => {
  it('V10B1-T1: targets are remembered per exercise, kept in range, 3 × 12 or 1 × 10 min at first; a saved value that is not valid falls back', async () => {
    const app = await openApp()
    const { targetFor, nudgeTarget } = app.targets

    // At first: 3 × 12 for strength (pull-ups too, which have no weight), 1 × 10 minutes for cardio
    for (const kind of KINDS) {
      expect(targetFor(kind), kind).toEqual(CARDIO.includes(kind) ? { sets: 1, minutes: 10 } : { sets: 3, reps: 12 })
    }

    // − and + change one number by a step, never out of range (sets 1–10, reps 1–50)
    nudgeTarget('curl', 'sets', 1)
    nudgeTarget('curl', 'reps', -1)
    expect(targetFor('curl')).toEqual({ sets: 4, reps: 11 })
    for (let i = 0; i < 20; i++) nudgeTarget('curl', 'sets', 1)
    for (let i = 0; i < 60; i++) nudgeTarget('curl', 'reps', 1)
    expect(targetFor('curl')).toEqual({ sets: 10, reps: 50 })
    for (let i = 0; i < 20; i++) nudgeTarget('squat', 'sets', -1)
    for (let i = 0; i < 60; i++) nudgeTarget('squat', 'reps', -1)
    expect(targetFor('squat')).toEqual({ sets: 1, reps: 1 })

    // Minutes go by one up to 10, then by five, up to 60 and down to 1
    const minutes = (direction: -1 | 1, taps: number) => {
      const seen = []
      for (let i = 0; i < taps; i++) {
        nudgeTarget('run', 'minutes', direction)
        seen.push(targetFor('run').minutes)
      }
      return seen
    }
    expect(minutes(1, 12)).toEqual([15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 60, 60])
    expect(minutes(-1, 12)).toEqual([55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 9, 8])
    expect(minutes(-1, 9)).toEqual([7, 6, 5, 4, 3, 2, 1, 1, 1])

    // A number an exercise doesn't have changes nothing (minutes on curls, reps on a walk)
    nudgeTarget('curl', 'minutes', 1)
    nudgeTarget('walk', 'reps', 1)
    expect(targetFor('curl')).toEqual({ sets: 10, reps: 50 })
    expect(targetFor('walk')).toEqual({ sets: 1, minutes: 10 })

    // Each exercise keeps its own, saved in this browser…
    expect(JSON.parse(app.storage.data.get(TARGETS)!)).toEqual({
      version: 1,
      targets: { curl: { sets: 10, reps: 50 }, squat: { sets: 1, reps: 1 }, run: { sets: 1, minutes: 1 } },
    })
    // …so a reload brings them back, and the next Start uses them
    const reloaded = await openApp(app.storage)
    expect(reloaded.targets.targetFor('squat')).toEqual({ sets: 1, reps: 1 })
    expect(reloaded.targets.targetFor('lateral')).toEqual({ sets: 3, reps: 12 })
    expect(reloaded.gym.startFromList('squat')).toBe(true)
    expect(reloaded.gym.getGym().activity).toMatchObject({ kind: 'squat', target: { sets: 1, reps: 1 }, set: 1 })

    // Saved values that don't check out: out of range is brought into range; anything
    // that isn't a whole number is the default for that number alone; a number the
    // exercise doesn't have is left behind; unknown exercises are dropped
    const odd = await openApp(
      fakeStorage(
        savedTargets({
          curl: { sets: 0, reps: 99 },
          squat: { sets: '4', reps: 8.5 },
          walk: { sets: 2, minutes: 600, reps: 12 },
          run: { sets: 3, reps: 20 },
          lateral: 'lots',
          pullup: { sets: 25, reps: 5 },
          bench: { sets: 5, reps: 5 },
        }),
      ),
    )
    expect(odd.targets.targetFor('curl')).toEqual({ sets: 1, reps: 50 })
    expect(odd.targets.targetFor('squat')).toEqual({ sets: 3, reps: 12 })
    expect(odd.targets.targetFor('walk')).toEqual({ sets: 2, minutes: 60 })
    expect(odd.targets.targetFor('run')).toEqual({ sets: 3, minutes: 10 })
    expect(odd.targets.targetFor('lateral')).toEqual({ sets: 3, reps: 12 })
    expect(odd.targets.targetFor('pullup')).toEqual({ sets: 10, reps: 5 }) // (sets have their own range)
    // A different version, or something that isn't the saved shape at all: nothing remembered
    for (const saved of [savedTargets({ curl: { sets: 5, reps: 5 } }, 2), { [TARGETS]: '{not json' }, { [TARGETS]: '[1,2]' }]) {
      const fresh = await openApp(fakeStorage(saved))
      expect(fresh.targets.targetFor('curl')).toEqual({ sets: 3, reps: 12 })
    }

    // With storage blocked nothing throws: targets hold until the page closes
    const blocked = await openApp(fakeStorage({}, { broken: true }))
    expect(blocked.targets.targetFor('curl')).toEqual({ sets: 3, reps: 12 })
    expect(() => blocked.targets.nudgeTarget('curl', 'reps', -1)).not.toThrow()
    expect(blocked.targets.targetFor('curl')).toEqual({ sets: 3, reps: 11 })

    // A target picked in another Amygo window (they share this browser's storage) is taken here too
    const other = new EventTarget()
    const tab = await openApp(app.storage)
    const stop = tab.targets.followTargets(other)
    app.storage.data.set(TARGETS, JSON.stringify({ version: 1, targets: { curl: { sets: 2, reps: 8 } } }))
    other.dispatchEvent(Object.assign(new Event('storage'), { key: TARGETS }))
    expect(tab.targets.targetFor('curl')).toEqual({ sets: 2, reps: 8 })
    stop()
    // …and the app itself follows them: startApp(), which main.tsx calls, listens on the real
    // window, to its own key and to storage being cleared, not to other keys
    const browserWindow = new EventTarget()
    const wired = await openApp()
    vi.stubGlobal('window', browserWindow)
    const stopApp = (await import('../shell/startup')).startApp()
    wired.storage.data.set(TARGETS, JSON.stringify({ version: 1, targets: { squat: { sets: 5, reps: 5 } } }))
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: 'gym3d.log' }))
    expect(wired.targets.targetFor('squat')).toEqual({ sets: 3, reps: 12 })
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: TARGETS }))
    expect(wired.targets.targetFor('squat')).toEqual({ sets: 5, reps: 5 })
    wired.storage.data.clear()
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
    expect(wired.targets.targetFor('squat')).toEqual({ sets: 3, reps: 12 })
    stopApp()
  })

  it('V10B1-T6: rows read "3 × 12 · 10 kg · Start" and "1 × 10 min · Start"; the counter says "7 of 12 reps" with a target, "7 reps done" without', async () => {
    const app = await openApp()
    app.weights.setKg('curl', 10)
    let page = await exercisesPage()

    // The target sits before the weight, which sits before Start (the phone layout places them in this order)
    expect(words(row(page, 'Bicep curls'))).toMatch(/History 3 × 12 − 10 kg \+ Start$/)
    expect(words(row(page, 'Walk'))).toMatch(/History 1 × 10 min Start$/)
    expect(words(row(page, 'Pull-ups'))).toMatch(/History 3 × 12 Start$/)
    expect(words(row(page, 'Row'))).toMatch(/History 1 × 10 min Start$/)
    // Every row has one, named in words for screen readers, closed at first
    expect(page.match(/class="list-button target-chip"/g)).toHaveLength(KINDS.length)
    const curl = row(page, 'Bicep curls')
    // (the name starts with what it shows, so "tap 3 × 12" works by voice too)
    expect(curl).toContain('aria-label="3 × 12: target for Bicep curls, 3 sets of 12 reps" aria-expanded="false">3 × 12</button>')
    expect(row(page, 'Walk')).toContain('aria-label="1 × 10 min: target for Walk, 1 set of 10 minutes"')
    expect(page).not.toContain('target-editor')

    // Open, it shows its steppers under the row: − 3 sets + and − 12 reps + (or − 10 min +)
    app.open.toggleTarget('curl')
    page = await exercisesPage()
    expect(row(page, 'Bicep curls')).toContain('aria-expanded="true" aria-controls="target-list-curl"')
    expect(words(row(page, 'Bicep curls'))).toMatch(/Start − 3 sets \+ − 12 reps \+$/)
    expect(row(page, 'Bicep curls')).toContain('id="target-list-curl" role="group" aria-label="Target for Bicep curls"')
    expect(row(page, 'Bicep curls')).toMatch(/<\/div><div class="target-editor"/) // (after the row's buttons, so it takes a line of its own)
    expect(page.match(/class="target-editor"/g)).toHaveLength(1) // one open at a time
    app.open.toggleTarget('walk')
    page = await exercisesPage()
    expect(page.match(/class="target-editor"/g)).toHaveLength(1)
    expect(words(row(page, 'Walk'))).toMatch(/Start − 1 set \+ − 10 min \+$/)
    // At the ends of a range the button that would go past it is off
    expect([off(row(page, 'Walk'), 'Fewer sets: Walk'), off(row(page, 'Walk'), 'More sets: Walk')]).toEqual([true, false])
    expect([off(row(page, 'Walk'), 'Shorter: Walk'), off(row(page, 'Walk'), 'Longer: Walk')]).toEqual([false, false])
    for (let i = 0; i < 12; i++) app.targets.nudgeTarget('walk', 'minutes', 1)
    page = await exercisesPage()
    expect([off(row(page, 'Walk'), 'Shorter: Walk'), off(row(page, 'Walk'), 'Longer: Walk')]).toEqual([false, true])
    expect(words(row(page, 'Walk'))).toContain('History 1 × 60 min Start − 1 set + − 60 min +')
    app.open.toggleTarget('walk')
    expect(await exercisesPage()).not.toContain('target-editor') // the same button closes it

    // While a round of that exercise goes on, its target holds (as a set holds its weight): shown, not changeable
    app.open.toggleTarget('curl')
    app.gym.startFromList('curl')
    app.targets.nudgeTarget('curl', 'reps', 1) // (say, from another window)
    page = await exercisesPage()
    const KEPT = 'Kept for this round. Change it after Finish.'
    expect(words(row(page, 'Bicep curls'))).toBe(`Bicep curls History 3 × 12 − 10 kg + Doing − 3 sets + − 12 reps + ${KEPT}`)
    const buttonsOff = () => ['Fewer sets', 'More sets', 'Fewer reps', 'More reps'].map((label) => off(row(page, 'Bicep curls'), `${label}: Bicep curls`))
    expect(buttonsOff()).toEqual([true, true, true, true])
    expect(row(page, 'Bicep curls')).toContain('aria-describedby="target-list-curl-why"')
    expect(row(page, 'Bicep curls')).toContain('id="target-list-curl-why"')
    app.gym.finishExercise()
    page = await exercisesPage()
    expect(words(row(page, 'Bicep curls'))).toBe('Bicep curls History 3 × 13 − 10 kg + Start − 3 sets + − 13 reps +')
    expect(buttonsOff()).toEqual([false, false, false, false])
    // …and between its sets too: after Done on set 1 the round's target is shown, and kept
    app.gym.startFromList('curl')
    t += 3 * 2400 + 100
    app.gym.stopExercise()
    expect(app.gym.getGym().between).toMatchObject({ kind: 'curl', set: 1 })
    app.targets.nudgeTarget('curl', 'reps', 1)
    page = await exercisesPage()
    expect(words(row(page, 'Bicep curls'))).toBe(`Bicep curls History 3 × 13 − 10 kg + Start − 3 sets + − 13 reps + ${KEPT}`)
    expect(buttonsOff()).toEqual([true, true, true, true])
    app.gym.finishFromList()
    page = await exercisesPage()
    expect(words(row(page, 'Bicep curls'))).toBe('Bicep curls History 3 × 14 − 10 kg + Start − 3 sets + − 14 reps +')

    // The buttons do what they say (they can't be clicked without a browser, so read what they call)
    const sources = import.meta.glob(['/src/shell/TargetPicker.tsx', '/src/shell/ExerciseHistoryPage.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const picker = sources['/src/shell/TargetPicker.tsx']
    expect(picker).toMatch(/onClick=\{\(\) => toggleTarget\(kind\)\}/)
    expect(picker).toMatch(/onNudge=\{\(direction\) => \{\s*nudgeTarget\(kind, part, direction\)\s*say\(`\$\{name\} \$\{targetWords\(targetFor\(kind\)\)\}`\)/)
    // On a phone the target sits under the name, beside the weight; on the narrowest phones
    // a strength row gives it a line of its own; open, its steppers span the row
    const css = ((await node('node:fs')).readFileSync('src/index.css', 'utf8') as string).replace(/\r\n/g, '\n')
    const phone = css.slice(css.indexOf('@media (max-width: 599px) {\n  .machine-group li {'))
    expect(phone).toMatch(/\.machine-group li \.target-chip \{\n    grid-column: 1;\n    justify-self: start;/)
    expect(phone).toMatch(/\.machine-group li \.row-start,\n  \.machine-group li \.doing-tag \{\n    grid-column: 3;/)
    expect(css).toMatch(/@media \(max-width: 359px\) \{\n  \.machine-group li:has\(\.weight-stepper\) \.target-chip \{\n    grid-column: 1 \/ -1;/)
    expect(css).toMatch(/\n\.target-editor \{\n  grid-column: 1 \/ -1;/)
    expect(css).toMatch(/\n\.machine-group li \{\n  display: grid;\n  grid-template-columns: minmax\(0, 1fr\) auto;/)
    // An exercise's own page has the same picker before its Start
    expect(sources['/src/shell/ExerciseHistoryPage.tsx']).toMatch(/<TargetChip kind=\{kind\} place="history" \/>\s*<WeightStepper kind=\{kind\} \/>/)

    // The counter: against the target, with the set when there's more than one
    const curls = { kind: 'curl' as const, startedAt: 0, arrived: true, repSeconds: 2.4 }
    const at = (reps: number) => reps * 2400 + 100
    expect(app.text.progressText({ ...curls, target: { sets: 1, reps: 12 } }, at(7))).toBe('7 of 12 reps')
    expect(app.text.progressText({ ...curls, target: { sets: 3, reps: 12 }, set: 2 }, at(7))).toBe('Set 2 of 3 · 7 of 12 reps')
    expect(app.text.progressText({ ...curls, target: { sets: 3, reps: 12 } }, at(0))).toBe('Set 1 of 3 · 0 of 12 reps')
    expect(app.text.progressText(curls, at(7))).toBe('7 reps done')
    expect(app.text.progressText(curls, at(0))).toBe('First rep…')
    // …never past it, even read a moment after the set should have ended
    expect(app.text.progressText({ ...curls, target: { sets: 1, reps: 12 } }, at(13))).toBe('12 of 12 reps')
    // …at the set's own tempo
    expect(app.text.progressText({ ...curls, repSeconds: 1.8, target: { sets: 1, reps: 12 } }, 7 * 1800 + 100)).toBe('7 of 12 reps')
    // Cardio: the time against the target (a walk is 1.5 m/s: 100 s is 0.15 km), never past it; the rower counts strokes
    const walk = { kind: 'walk' as const, startedAt: 0, arrived: true, target: { sets: 1, minutes: 10 } }
    expect(app.text.progressText(walk, 100_500)).toBe('0.15 km · 1:40 of 10:00')
    expect(app.text.progressText(walk, 700_000)).toBe('0.90 km · 10:00 of 10:00')
    expect(app.text.progressText({ ...walk, target: undefined }, 100_500)).toBe('0.15 km · 1:40')
    expect(app.text.progressText({ ...walk, kind: 'row' as const }, 100_500)).toMatch(/^\d+ strokes · 1:40 of 10:00$/)
  })
})
