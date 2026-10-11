import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { LOG_KEY, LOG_VERSION } from './logStorage'
import { backupText } from './backup'
import type { LoggedSet } from './sets'

// Times in local time, so the tests mean the same thing in any time zone
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime()
const NOW = at(2026, 10, 7, 18)
const MADE_NOW = 'backup made Today, 18:00' // how a restore names a backup made at NOW

let made = 0
const curls = (endedAt: number, reps = 12): LoggedSet => ({ id: `c${made++}`, kind: 'curl', endedAt, seconds: reps * 2.4, reps })
const walk = (endedAt: number, meters = 450): LoggedSet => ({ id: `w${made++}`, kind: 'walk', endedAt, seconds: meters / 1.5, meters })
const row = (endedAt: number): LoggedSet => ({ id: `r${made++}`, kind: 'row', endedAt, seconds: 120, meters: 500, strokes: 52 })

// A stand-in for the browser's localStorage holding `sets` as the log saves them.
// `broken` makes every access throw, like a browser that blocks storage.
function fakeStorage(sets: LoggedSet[] = [], { broken = false } = {}) {
  const data = new Map([[LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets })]])
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
const savedInStorage = (storage: ReturnType<typeof fakeStorage>) => JSON.parse(storage.data.get(LOG_KEY)!).sets as LoggedSet[]

// "Open the page" in a browser with this storage: a fresh copy of the app's state
async function openApp(storage = fakeStorage()) {
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  const log = await import('./logStore')
  const backup = await import('./backup')
  // The line shown under the buttons after a restore, at NOW
  const say = (outcome: Parameters<typeof backup.restoreText>[0]) => backup.restoreText(outcome, log.MAX_SETS, NOW)
  return { log, backup, storage, say }
}

// A backup file made from these sets, as Back up writes it, at NOW (no app
// needed: the file's text is plain code)
const backupOf = (sets: LoggedSet[], madeAt = NOW) => backupText(sets, madeAt)

// Node's time zone, changed for one test and always put back, by name: on
// Windows, deleting TZ doesn't bring the old zone back (and assigning undefined
// writes the text "undefined", which is UTC)
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const zoneInUse = () => Intl.DateTimeFormat().resolvedOptions().timeZone
function inZone<T>(zone: string, run: () => T): T {
  const before = env.TZ ?? zoneInUse()
  env.TZ = zone
  try {
    return run()
  } finally {
    env.TZ = before
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// (Each test reloads the app's code several times; a busy laptop can need more than Vitest's usual 5 s)
describe('Back up and restore', { timeout: 30_000 }, () => {
  it('V9B1-T1: back up then restore into an empty log gives back the same sets, same ids, same numbers', async () => {
    // (kg stands for a number a newer Amygo adds: it travels untouched)
    const sets = [curls(at(2026, 9, 30, 9)), { ...curls(at(2026, 10, 1, 9), 8), kg: 10 } as LoggedSet, walk(at(2026, 10, 2, 7)), row(at(2026, 10, 6, 19))]
    const file = backupOf(sets)

    const phone = await openApp() // a browser with no sets yet
    const outcome = phone.log.restoreBackup(file)
    expect(outcome).toEqual({ added: 4, already: 0, skipped: 0, tooOld: 0, dropped: 0, saved: true, madeAt: NOW })
    expect(phone.log.getLog().sets).toEqual(sets)
    expect(phone.say(outcome)).toBe(`Added 4 sets · 0 already here · ${MADE_NOW}`)
    // …and they're saved: still there after a reload
    expect((await openApp(phone.storage)).log.getLog().sets).toEqual(sets)

    // The same through a picked file (what Restore reads)
    const laptop = await openApp()
    expect(await laptop.log.restoreFile(new Blob([file], { type: 'application/json' }))).toMatchObject({ added: 4 })
    expect(laptop.log.getLog().sets).toEqual(sets)

    // Storage that refuses: the restored sets still show for this visit, and the line says they won't be kept
    const warning = `Added 4 sets · 0 already here · ${MADE_NOW}. This browser isn't saving them: they'll be gone when Amygo closes.`
    const blocked = await openApp(fakeStorage([], { broken: true }))
    const unsaved = blocked.log.restoreBackup(file)
    expect(unsaved).toMatchObject({ added: 4, saved: false })
    expect(blocked.log.getLog().sets).toEqual(sets)
    expect(blocked.say(unsaved)).toBe(warning)

    // …and storage that can't even be reached (Chrome with site data blocked: reading localStorage throws)
    vi.unstubAllGlobals()
    const own = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      vi.resetModules()
      const log = await import('./logStore')
      const { restoreText } = await import('./backup')
      const unreachable = log.restoreBackup(file)
      expect(unreachable).toMatchObject({ added: 4, saved: false })
      expect(log.getLog().sets).toEqual(sets)
      expect(restoreText(unreachable, log.MAX_SETS, NOW)).toBe(warning)
    } finally {
      if (own) Object.defineProperty(globalThis, 'localStorage', own)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })

  it('V9B1-T2: restoring into a log that already has some of the sets adds only the new ones, and keeps this copy of the rest', async () => {
    const first = curls(at(2026, 10, 1, 9), 12)
    const second = walk(at(2026, 10, 2, 9))
    const third = curls(at(2026, 10, 3, 9), 10)
    const fourth = row(at(2026, 10, 4, 9))
    // The file's copy of `first` differs from this browser's (say it was changed here since)
    const file = backupOf([{ ...first, reps: 99, seconds: 1 }, second, fourth, third])

    const app = await openApp(fakeStorage([first, second]))
    const outcome = app.log.restoreBackup(file)
    expect(outcome).toMatchObject({ added: 2, already: 2, skipped: 0, tooOld: 0, dropped: 0, saved: true })
    expect(app.say(outcome)).toBe(`Added 2 sets · 2 already here · ${MADE_NOW}`)
    // This browser's copy kept as it was; nothing doubled; oldest first, as the log is saved
    expect(app.log.getLog().sets).toEqual([first, second, third, fourth])
    expect(savedInStorage(app.storage)).toEqual([first, second, third, fourth])

    // The same file again: nothing new, and nothing saved or redrawn
    const shown = app.log.getLog().sets
    const listener = vi.fn()
    app.log.subscribeLog(listener)
    const again = app.log.restoreBackup(file)
    expect(again).toMatchObject({ added: 0, already: 4 })
    expect(app.say(again)).toBe(`Added 0 sets · 4 already here · ${MADE_NOW}`)
    expect(app.log.getLog().sets).toBe(shown)
    expect(listener).not.toHaveBeenCalled()
  })

  it("V9B1-T3: a file with damaged entries keeps the good ones, skips the bad, and the counts say so", async () => {
    const good = curls(at(2026, 10, 1, 9))
    const alsoGood = row(at(2026, 10, 2, 9))
    const entries = [
      good,
      null,
      'a set',
      { ...curls(at(2026, 10, 1, 10)), kind: 'cartwheel' }, // no such exercise
      { ...curls(at(2026, 10, 1, 11)), reps: undefined }, // a curl with no reps
      { ...curls(at(2026, 10, 1, 12)), reps: 1.5 }, // half a rep
      { ...walk(at(2026, 10, 1, 13)), meters: -5 },
      { ...row(at(2026, 10, 1, 14)), strokes: undefined },
      { ...curls(at(2026, 10, 1, 15)), id: '' },
      { ...curls(at(2026, 10, 1, 16)), endedAt: 'yesterday' },
      alsoGood,
      { ...good }, // the same set twice in one file: kept once, and not damaged
    ]
    const file = JSON.stringify({ app: 'amygo', version: 1, exportedAt: new Date(NOW).toISOString(), sets: entries })

    const app = await openApp()
    const contents = app.backup.readBackup(file)
    expect(contents).toEqual({ ok: true, sets: [good, alsoGood], skipped: 9, madeAt: NOW })
    const outcome = app.log.restoreBackup(file)
    expect(outcome).toMatchObject({ added: 2, already: 0, skipped: 9 })
    expect(app.log.getLog().sets).toEqual([good, alsoGood])
    expect(app.say(outcome)).toBe(`Added 2 sets · 0 already here · 9 couldn't be read · ${MADE_NOW}`)

    // Numbers that don't belong to the exercise are left behind (a walk has no reps; a curl no distance)
    const odd = JSON.stringify({ app: 'amygo', version: 1, sets: [{ ...walk(NOW), reps: 7 }, { ...curls(NOW), meters: 3, note: 'x' }] })
    const cleaned = app.backup.readBackup(odd)
    expect(cleaned.ok && cleaned.sets.map((set) => [set.reps, set.meters, 'note' in set])).toEqual([
      [undefined, 450, false],
      [12, undefined, false],
    ])
  })

  it('V9B1-T4: not JSON, another app\'s file, or a newer version is refused with a message, and the log is exactly as before', async () => {
    const before = [curls(at(2026, 10, 1, 9)), walk(at(2026, 10, 2, 9))]
    const app = await openApp(fakeStorage(before))
    const { NOT_A_BACKUP, NEWER_BACKUP, TOO_BIG, CANT_READ } = app.backup
    const savedText = app.storage.data.get(LOG_KEY)
    const shown = app.log.getLog().sets
    const listener = vi.fn()
    app.log.subscribeLog(listener)

    const refused: [string, string][] = [
      ['not JSON {', NOT_A_BACKUP],
      ['', NOT_A_BACKUP],
      ['null', NOT_A_BACKUP],
      ['[]', NOT_A_BACKUP],
      ['"amygo"', NOT_A_BACKUP],
      [JSON.stringify({ app: 'gymtracker', version: 1, sets: [curls(NOW)] }), NOT_A_BACKUP], // another app's
      [JSON.stringify({ version: 1, sets: [curls(NOW)] }), NOT_A_BACKUP],
      [JSON.stringify({ app: 'amygo', sets: [curls(NOW)] }), NOT_A_BACKUP],
      [JSON.stringify({ app: 'amygo', version: '1', sets: [curls(NOW)] }), NOT_A_BACKUP],
      [JSON.stringify({ app: 'amygo', version: 1, sets: { one: curls(NOW) } }), NOT_A_BACKUP],
      [JSON.stringify({ app: 'amygo', version: 2, sets: [curls(NOW)] }), NEWER_BACKUP], // from a newer Amygo
    ]
    for (const [text, reason] of refused) {
      const outcome = app.log.restoreBackup(text)
      expect(outcome, text).toEqual({ reason })
      expect(app.say(outcome), text).toBe(reason)
    }
    expect(NOT_A_BACKUP).toBe("That file isn't an Amygo backup. Nothing was changed.")

    // A picked file far too big to be ours isn't even read; one that can't be read says so
    const huge = { size: 50_000_000, text: vi.fn(async () => '{}') }
    expect(await app.log.restoreFile(huge as unknown as Blob)).toEqual({ reason: TOO_BIG })
    expect(huge.text).not.toHaveBeenCalled()
    const unreadable = { size: 10, text: async () => Promise.reject(new Error('gone')) }
    expect(await app.log.restoreFile(unreadable as unknown as Blob)).toEqual({ reason: CANT_READ })

    // Exactly as before: the same sets on screen, the same saved text, and no change announced
    expect(app.log.getLog().sets).toBe(shown)
    expect(app.log.getLog().sets).toEqual(before)
    expect(app.storage.data.get(LOG_KEY)).toBe(savedText)
    expect(listener).not.toHaveBeenCalled()
  })

  it('V9B1-T5: restoring past 5,000 sets keeps the newest 5,000, and says whose sets didn\'t fit', async () => {
    const start = at(2026, 1, 1)
    const older = Array.from({ length: 10 }, (_, i) => curls(at(2025, 6, 1) + i * 60_000))
    const newer = Array.from({ length: 10 }, (_, i) => walk(at(2026, 10, 7, 9) + i * 60_000))
    const keeps = 'the log keeps 5,000'
    const mixedFile = backupOf([...older, ...newer])
    const newerFile = backupOf(newer)
    const oldFile = backupOf(older)

    // 4,990 here, and a file with 10 sets older than all of them and 10 newer:
    // the 10 older ones are the ones that don't fit, and none of this browser's go
    const here = Array.from({ length: 4990 }, (_, i) => curls(start + i * 60_000))
    const app = await openApp(fakeStorage(here))
    const outcome = app.log.restoreBackup(mixedFile)
    expect(outcome).toMatchObject({ added: 10, already: 0, tooOld: 10, dropped: 0, saved: true })
    expect(app.say(outcome)).toBe(`Added 10 sets · 0 already here · 10 too old to keep · ${keeps} · ${MADE_NOW}`)
    expect(app.log.getLog().sets).toEqual([...here, ...newer])
    expect((await openApp(app.storage)).log.getLog().sets).toHaveLength(5000)

    // 4,995 here and 10 newer in the file: this browser's 5 oldest make room
    const fuller = Array.from({ length: 4995 }, (_, i) => curls(start + i * 60_000))
    const tight = await openApp(fakeStorage(fuller))
    const squeezed = tight.log.restoreBackup(newerFile)
    expect(squeezed).toMatchObject({ added: 10, tooOld: 0, dropped: 5 })
    expect(tight.say(squeezed)).toBe(`Added 10 sets · 0 already here · 5 of the oldest here let go · ${keeps} · ${MADE_NOW}`)
    expect(tight.log.getLog().sets).toEqual([...fuller.slice(5), ...newer])

    // A full log and a file that's all older: nothing changes, and restoring it again says the same
    const full = tight.log.getLog().sets
    for (let time = 0; time < 2; time++) {
      const outcomeAgain = tight.log.restoreBackup(oldFile)
      expect(outcomeAgain).toMatchObject({ added: 0, already: 0, tooOld: 10, dropped: 0 })
      expect(tight.say(outcomeAgain)).toBe(`Added 0 sets · 0 already here · 10 too old to keep · ${keeps} · ${MADE_NOW}`)
      expect(tight.log.getLog().sets).toBe(full)
    }
  })

  it('V9B1-T6: the file name carries the date it was made; exportedAt is the moment it was made, and a restore names it', async () => {
    const { backupName, readBackup, restoreText } = await import('./backup')
    const zoneBefore = zoneInUse()
    // 13 hours ahead of UTC in October: just after midnight there is still yesterday in UTC.
    // (Not the laptop's own zone, so the check at the end can tell whether it was put back.)
    inZone('Pacific/Auckland', () => {
      const madeAt = at(2026, 10, 8, 0, 30)
      expect(backupName(madeAt)).toBe('amygo-log-2026-10-08.json')
      expect(backupName(at(2026, 10, 7, 23, 59))).toBe('amygo-log-2026-10-07.json')

      const sets = [curls(at(2026, 10, 7, 9)), walk(at(2026, 10, 7, 10))]
      const text = backupText(sets, madeAt)
      const file = JSON.parse(text)
      expect(file).toEqual({ app: 'amygo', version: 1, exportedAt: '2026-10-07T11:30:00.000Z', sets })
      expect(new Date(file.exportedAt).getTime()).toBe(madeAt)
      // One set per line, so the file can be read by eye
      expect(text.split('\n').filter((line) => line.startsWith('{"id"'))).toHaveLength(2)
      expect(JSON.parse(backupText([], madeAt)).sets).toEqual([])

      // A restore says when its backup was made (so an older one picked by mistake shows), in local time
      const restored = { added: 2, already: 0, skipped: 0, tooOld: 0, dropped: 0, saved: true }
      const contents = readBackup(text)
      expect(contents.ok && contents.madeAt).toBe(madeAt)
      expect(restoreText({ ...restored, madeAt }, 5000, at(2026, 10, 8, 20))).toBe('Added 2 sets · 0 already here · backup made Today, 0:30')
      expect(restoreText({ ...restored, madeAt }, 5000, at(2026, 10, 9, 8))).toBe('Added 2 sets · 0 already here · backup made Yesterday, 0:30')
      // A file without a readable time just doesn't say
      const undated = readBackup(JSON.stringify({ app: 'amygo', version: 1, exportedAt: 'soon', sets }))
      expect(undated.ok && undated.madeAt).toBe(null)
      expect(restoreText({ ...restored, madeAt: null }, 5000, madeAt)).toBe('Added 2 sets · 0 already here')
    })
    expect(zoneInUse()).toBe(zoneBefore) // put back as it was
  })

  it('V9B1-T7: the Today page offers Restore even with no sets (Back up and Clear history once there are); Back up downloads the whole log', async () => {
    const page = async (sets: LoggedSet[]) => {
      await openApp(fakeStorage(sets))
      const { TodayPage } = await import('../shell/TodayPage')
      return renderToString(createElement(TodayPage, { now: NOW })).replaceAll('<!-- -->', '').replaceAll('&#x27;', "'")
    }
    const empty = await page([])
    expect(empty).toContain('>Restore</button>')
    expect(empty).toMatch(/<input[^>]*type="file"[^>]*accept=".json,application\/json"[^>]*hidden/)
    expect(empty).toContain('Saved in this browser only.')
    expect(empty).toContain('role="status"')
    expect(empty).not.toContain('Back up</button>')
    expect(empty).not.toContain('Clear history')

    const full = await page([curls(at(2026, 10, 7, 9))])
    for (const button of ['>Back up</button>', '>Restore</button>', '>Clear history</button>']) expect(full).toContain(button)

    // What Back up does: every day of the log (not just today) goes into the file it hands over
    const days = [curls(at(2026, 9, 12, 9)), walk(at(2026, 10, 5, 7)), row(at(2026, 10, 7, 9))]
    const app = await openApp(fakeStorage(days))
    const download = vi.fn()
    const line = app.log.backUpLog(NOW, download)
    expect(download).toHaveBeenCalledTimes(1)
    const [name, text] = download.mock.calls[0]
    expect(name).toBe('amygo-log-2026-10-07.json')
    expect(JSON.parse(text).sets).toEqual(days)
    // (it can't see whether the browser saved it, or as "… (1).json", so it doesn't claim to know)
    expect(line).toBe('Backing up 3 sets as amygo-log-2026-10-07.json. Look in your downloads; a second backup the same day may end in (1).')

    // The download: a JSON file with that name, released later (not while it may still be starting)
    vi.useFakeTimers()
    const link = { href: '', download: '', hidden: false, click: vi.fn(), remove: vi.fn() }
    const append = vi.fn()
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { append } })
    const files: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => (files.push(blob as Blob), 'blob:amygo/1'))
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { downloadFile, takePickedFile } = await import('../lib/files')
    downloadFile(name, text)
    expect(link).toMatchObject({ href: 'blob:amygo/1', download: 'amygo-log-2026-10-07.json', hidden: true })
    expect(append).toHaveBeenCalledWith(link)
    expect(link.click).toHaveBeenCalledTimes(1)
    expect(link.remove).toHaveBeenCalledTimes(1)
    expect(files[0].type).toBe('application/json')
    expect(await files[0].text()).toBe(text)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revoke).toHaveBeenCalledWith('blob:amygo/1')

    // Restore's picker is emptied after each pick, so picking the same file again still restores it
    const picked = new File([text], name, { type: 'application/json' })
    const picker = { files: [picked], value: 'C:\\fakepath\\amygo-log-2026-10-07.json' }
    expect(takePickedFile(picker)).toBe(picked)
    expect(picker.value).toBe('')
    expect(takePickedFile({ files: [], value: '' })).toBe(null)
  })

  it('V9B1-T8: a restore made in another Amygo window is kept when this window saves a set', async () => {
    const old = [curls(at(2026, 9, 20, 9)), walk(at(2026, 9, 21, 9)), row(at(2026, 9, 22, 9))]
    const oldFile = backupOf(old)
    // The installed app and a Chrome tab: two windows, one storage
    const shared = fakeStorage([curls(at(2026, 10, 7, 8))])
    const tab = await openApp(shared)
    const tabWindow = new EventTarget()
    tab.log.followOtherWindows(tabWindow)
    const installed = await openApp(shared) // opened later, in the same browser

    // The installed app restores the phone's old sets…
    expect(installed.log.restoreBackup(oldFile)).toMatchObject({ added: 3 })
    // …the browser tells the tab its storage changed (as browsers do between windows)…
    tabWindow.dispatchEvent(Object.assign(new Event('storage'), { key: LOG_KEY }))
    // …and a set finished in the tab is saved alongside them, not over them
    tab.log.recordSet({ kind: 'curl', endedAt: at(2026, 10, 7, 19), seconds: 24, reps: 10 })
    const saved = savedInStorage(shared)
    expect(saved).toHaveLength(5)
    for (const set of old) expect(saved).toContainEqual(set)
    expect((await openApp(shared)).log.getLog().sets).toHaveLength(5) // and the installed app sees them all next time

    // Other storage keys don't make it reread; a cleared storage does
    const read = vi.fn()
    tab.log.subscribeLog(read)
    tabWindow.dispatchEvent(Object.assign(new Event('storage'), { key: 'gym3d.layout' }))
    expect(read).not.toHaveBeenCalled()
    tabWindow.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
    expect(read).toHaveBeenCalledTimes(1)

    // The app itself switches this on: startApp(), which main.tsx calls, follows the real window
    const browserWindow = new EventTarget()
    const app = await openApp(fakeStorage([]))
    vi.stubGlobal('window', browserWindow)
    const stop = (await import('../shell/startup')).startApp()
    app.storage.data.set(LOG_KEY, JSON.stringify({ version: LOG_VERSION, sets: old }))
    browserWindow.dispatchEvent(Object.assign(new Event('storage'), { key: LOG_KEY }))
    expect(app.log.getLog().sets).toEqual(old)
    stop()
  })
})
