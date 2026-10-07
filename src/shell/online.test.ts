import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { APP_DESCRIPTION, APP_NAME } from './brand'
import { GYM_NAME } from '../scene/wallDesign'
import { LAYOUT_KEY } from '../build/layoutStorage'
import { LOG_KEY } from '../log/logStorage'

// Node's own modules, loaded by name (this project's app code doesn't use Node's types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)

// Files' text: the pages a person sees, the app's code, and the deploy settings
const text = import.meta.glob(['/index.html', '/README.md', '/vercel.json', '/package.json', '/package-lock.json', '/vite.config.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const sources = import.meta.glob('/src/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

// A stand-in for the browser's localStorage. `broken` makes every access throw.
function fakeStorage({ broken = false, saved = {} as Record<string, string> } = {}) {
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

// A pretend window (key presses) and page (focus), since the tests run without a browser
function fakeBrowser() {
  const events = new EventTarget()
  const focused: string[] = []
  const press = (type: 'keydown' | 'keyup', code: string) => events.dispatchEvent(Object.assign(new Event(type), { code, repeat: false }))
  const window = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    location: { search: '' },
  }
  const document = { getElementById: (id: string) => ({ focus: () => focused.push(id) }) }
  return { window, document, press, focused }
}

// "Open the page": fresh app state reading `storage`, switched on by startApp() as in main.tsx
async function openApp(storage = fakeStorage(), browser = fakeBrowser()) {
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', browser.window)
  vi.stubGlobal('document', browser.document)
  vi.resetModules()
  const app = {
    storage,
    browser,
    tabStore: await import('./tabStore'),
    tabs: await import('./tabs'),
    gym: await import('../interaction/gymStore'),
    build: await import('../build/buildStore'),
    actions: await import('../build/actions'),
    input: await import('../player/input'),
    log: await import('../log/logStore'),
    firstVisit: await import('./firstVisit'),
    App: (await import('../App')).default,
  }
  ;(await import('./startup')).startApp()
  return app
}
type App = Awaited<ReturnType<typeof openApp>>
const show = (app: App) => renderToString(createElement(app.App)).replaceAll('<!-- -->', '')

// A log and a layout as v7 left them in a browser
const V7_LOG = JSON.stringify({ version: 1, sets: [{ id: 'a1', kind: 'curl', endedAt: 1791300000000, seconds: 28.9, reps: 12 }] })
const V7_LAYOUT = JSON.stringify({ version: 2, items: [{ id: 'rack-1', type: 'dumbbellRack', x: 0.5, z: 0.5, turns: 1 }] })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Amygo online', () => {
  it('V8B1-T1: the header, the page title and the painted wall all say Amygo; no page still says Gym 3D; the storage keys stay', async () => {
    expect(APP_NAME).toBe('Amygo')
    expect(GYM_NAME).toBe('AMYGO')
    const html = text['/index.html']
    expect(html).toContain(`<title>${APP_NAME}</title>`)
    expect(html).toContain(`<meta name="description" content="${APP_DESCRIPTION}" />`)
    const app = await openApp(fakeStorage({ saved: { [LOG_KEY]: V7_LOG } }))
    expect(show(app)).toContain(`<h1>${APP_NAME}</h1>`)
    // Nothing a person sees still uses the old name
    const seen = { '/index.html': html, '/README.md': text['/README.md'] }
    for (const [file, source] of Object.entries(sources)) if (file.startsWith('/src/shell/') && file.endsWith('.tsx')) Object.assign(seen, { [file]: source })
    for (const [file, source] of Object.entries(seen)) expect(source, file).not.toContain('Gym 3D')
    // The saved data's keys don't change (renaming them would lose what people saved)
    expect(LAYOUT_KEY).toBe('gym3d.layout')
    expect(LOG_KEY).toBe('gym3d.log')
  })

  it('V8B1-T2: the welcome opens on a first visit only; saved data still loads unchanged; blocked storage still works', async () => {
    // A first visit: nothing saved
    const storage = fakeStorage()
    let app = await openApp(storage)
    expect(app.tabStore.getWelcome()).toBe(true)
    app.tabs.closeWelcome()
    expect(app.tabStore.getWelcome()).toBe(false)
    expect(storage.data.get(app.firstVisit.WELCOMED_KEY)).toBe('1')
    app = await openApp(storage) // reload: not again
    expect(app.tabStore.getWelcome()).toBe(false)

    // Someone who saved sets, or moved furniture, has been here before: no welcome, and their data is untouched
    const withLog = fakeStorage({ saved: { [LOG_KEY]: V7_LOG } })
    app = await openApp(withLog)
    expect(app.tabStore.getWelcome()).toBe(false)
    expect(app.log.getLog().sets).toEqual(JSON.parse(V7_LOG).sets)
    expect(withLog.data.get(LOG_KEY)).toBe(V7_LOG)
    const withLayout = fakeStorage({ saved: { [LAYOUT_KEY]: V7_LAYOUT } })
    app = await openApp(withLayout)
    expect(app.tabStore.getWelcome()).toBe(false)
    expect(app.build.getBuild().items.find((item) => item.id === 'rack-1')).toMatchObject({ x: 0.5, z: 0.5, turns: 1 })
    expect(withLayout.data.get(LAYOUT_KEY)).toBe(V7_LAYOUT)

    // Storage blocked: the card shows, closes, and nothing throws
    app = await openApp(fakeStorage({ broken: true }))
    expect(app.tabStore.getWelcome()).toBe(true)
    expect(() => app.tabs.closeWelcome()).not.toThrow()
    expect(app.tabStore.getWelcome()).toBe(false)

    // The careful storage helper now lives in one place
    const copies = Object.entries(sources).filter(([, source]) => /function storage\(\)/.test(source)).map(([file]) => file)
    expect(copies).toEqual(['/src/lib/storage.ts'])
  })

  it('V8B1-T3: while the welcome is open, the gym\'s keys do nothing and its joystick and build button are gone', async () => {
    const app = await openApp()
    const { gym, build, input, tabs, browser } = app
    input.listenToKeyboard()
    gym.listenToInteractionKeys()
    app.actions.listenToBuildKeys()
    gym.setNearFurniture('rack-1') // standing at the rack, where E opens its menu
    expect(app.tabStore.getWelcome()).toBe(true)

    browser.press('keydown', 'KeyW')
    expect(input.input.keyboard.y).toBe(0)
    browser.press('keyup', 'KeyW')
    browser.press('keydown', 'KeyE')
    expect(gym.getGym().menu).toBeNull()
    browser.press('keydown', 'KeyB')
    expect(build.getBuild().mode).toBe('play')
    let page = show(app)
    expect(page).not.toContain('class="joystick"')
    expect(page).not.toContain('mode-toggle')
    expect(page).toContain('role="dialog"')
    expect(page).toContain('<div class="gym-layer" inert="">') // Tab can't reach the gym behind the card

    // Closed: all back
    tabs.closeWelcome()
    browser.press('keydown', 'KeyW')
    expect(input.input.keyboard.y).toBe(1)
    browser.press('keyup', 'KeyW')
    browser.press('keydown', 'KeyE')
    expect(gym.getGym().menu).toBe('furniture')
    page = show(app)
    expect(page).toContain('class="joystick"')
    expect(page).toContain('mode-toggle')
    expect(page).not.toContain('role="dialog"')
    expect(page).not.toContain('inert')
    gym.closeMenu()
    browser.press('keydown', 'KeyB')
    expect(build.getBuild().mode).toBe('build')
    browser.press('keydown', 'KeyB')
    expect(build.getBuild().mode).toBe('play')

    // A key still held when the card opens stays let go, even when another key is released meanwhile
    browser.press('keydown', 'KeyW')
    expect(input.input.keyboard.y).toBe(1)
    tabs.openWelcome()
    expect(input.input.keyboard.y).toBe(0)
    browser.press('keydown', 'Tab')
    browser.press('keyup', 'Tab')
    expect(input.input.keyboard.y).toBe(0)
  })

  it('V8B1-T4: Pick an exercise opens Exercises; "?" brings the card back; Escape closes it and returns focus to "?"; switching tabs closes it', async () => {
    const app = await openApp()
    const { tabs, tabStore, browser } = app
    // The card's two buttons and the header's "?" call these (read from the source: buttons can't be clicked here)
    expect(sources['/src/shell/Welcome.tsx']).toMatch(/onClick=\{pickAnExercise\}>\s*Pick an exercise/)
    expect(sources['/src/shell/Welcome.tsx']).toMatch(/onClick=\{\(\) => closeWelcome\(\)\}>\s*Look around/)
    expect(sources['/src/shell/Header.tsx']).toMatch(/id=\{WELCOME_BUTTON_ID\}[\s\S]*?onClick=\{openWelcome\}/)
    expect(show(app)).toMatch(/<button type="button" id="welcome-open"[^>]*aria-label="About Amygo: how it works"[^>]*>\?<\/button>/)

    tabs.pickAnExercise()
    expect(tabStore.getWelcome()).toBe(false)
    expect(tabStore.getTab()).toBe('exercises')
    expect(app.storage.data.get(app.firstVisit.WELCOMED_KEY)).toBe('1') // seen
    // "?" from anywhere: back on Home, with the card
    tabs.openWelcome()
    expect(tabStore.getTab()).toBe('home')
    expect(tabStore.getWelcome()).toBe(true)
    // Escape closes it, and focus goes back to "?"
    browser.press('keydown', 'Escape')
    expect(tabStore.getWelcome()).toBe(false)
    expect(browser.focused).toEqual(['welcome-open'])
    // Switching tabs closes it too
    tabs.openWelcome()
    tabs.openTab('today')
    expect(tabStore.getWelcome()).toBe(false)
    // Opening it in build mode leaves build mode (nothing half-done under the card)
    tabs.openTab('home')
    app.actions.switchMode()
    expect(app.build.getBuild().mode).toBe('build')
    tabs.openWelcome()
    expect(app.build.getBuild().mode).toBe('play')
    tabs.closeWelcome()

    // Mid-exercise, "?" then Escape closes only the card: the gym also listens for Escape
    // (it stops an exercise), and must not get this one. Same with an item's menu open.
    const { gym } = app
    gym.listenToInteractionKeys() // the gym's keys, switched on after startApp() as in the app
    gym.startFromList('curl')
    tabs.openWelcome()
    browser.press('keydown', 'Escape')
    expect(tabStore.getWelcome()).toBe(false)
    expect(gym.getGym().activity?.kind).toBe('curl') // still curling
    gym.stopExercise()
    gym.setNearFurniture('rack-1')
    gym.openMenu('furniture')
    tabs.openWelcome()
    browser.press('keydown', 'Escape')
    expect(tabStore.getWelcome()).toBe(false)
    expect(gym.getGym().menu).toBe('furniture') // still open
    // …while with the card closed, Escape is the gym's again
    browser.press('keydown', 'Escape')
    expect(gym.getGym().menu).toBeNull()
  })

  it('V8B1-T5: Vercel builds with npm run build (ending with the budget check) into dist; only /assets/ files are kept for a year', () => {
    const vercel = JSON.parse(text['/vercel.json'])
    const pkg = JSON.parse(text['/package.json'])
    expect(vercel.framework).toBe('vite')
    expect(vercel.buildCommand).toBe('npm run build')
    expect(pkg.scripts.build).toMatch(/node scripts\/check-budget\.mjs$/)
    expect(vercel.outputDirectory).toBe('dist')
    expect(text['/vite.config.ts']).not.toMatch(/outDir\s*:/) // nothing sets another folder: Vite writes to dist
    expect(vercel.headers).toEqual([
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      // (v8 Block 2: the offline worker is always checked, so phones notice a deploy)
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ])
    // Vercel uses the laptop's major Node version; the package carries Amygo's name
    expect(pkg.engines.node).toBe('24.x')
    expect(pkg.name).toBe('amygo')
    // The lockfile says the same, exactly as npm writes it (so an install doesn't quietly rewrite it)
    const lock = JSON.parse(text['/package-lock.json'])
    expect(lock.name).toBe('amygo')
    expect(lock.packages[''].name).toBe('amygo')
    expect(lock.packages[''].engines).toEqual(pkg.engines)
  })

  it('V8B1-T6: the Linux traps: every import and every public file is spelt with exactly the right capitals; Linux build tools are locked', async () => {
    const fs = await node('node:fs')
    // Does this path (from the project folder, e.g. /src/App.tsx) exist with exactly these capitals?
    // Each folder's real listing is compared name by name (Windows itself would ignore case).
    const existsExactly = (path: string) => {
      let folder = '.'
      for (const name of path.split('/').filter(Boolean)) {
        let names: string[]
        try {
          names = fs.readdirSync(folder)
        } catch {
          return false
        }
        if (!names.includes(name)) return false
        folder += '/' + name
      }
      return true
    }
    // Every relative import in the app and tests (static, dynamic, and stylesheets)
    const problems: string[] = []
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('.css')) continue
      for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)'(\.{1,2}\/[^'?]+)(?:\?[^']*)?'/g)) {
        const base = new URL(match[1], 'file://' + file).pathname
        if (![base, `${base}.ts`, `${base}.tsx`].some(existsExactly)) problems.push(`${file}: '${match[1]}'`)
      }
    }
    expect(problems).toEqual([])
    expect(existsExactly('/src/App.tsx') && !existsExactly('/src/app.tsx')).toBe(true) // (the check itself minds capitals)
    // Files in public/ the app asks for (in its code, not its comments; any capitals), against the names on
    // disk, folder included: Windows serves Models/man.glb fine, Vercel answers 404
    const asked = new Set<string>()
    const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('.test.ts')) continue
      for (const match of withoutComments(source).matchAll(/models\/[\w.-]+\.glb/gi)) asked.add(match[0])
    }
    for (const match of text['/index.html'].matchAll(/href="\/([^"]+)"/g)) asked.add(match[1])
    expect([...asked].sort()).toEqual(['favicon.svg', 'models/fitness-character.glb', 'models/man.glb'])
    for (const path of asked) expect(existsExactly(`/public/${path}`), path).toBe(true)
    // The lockfile has the Linux versions of the two native build tools Vercel's machines need
    expect(text['/package-lock.json']).toContain('"node_modules/@rolldown/binding-linux-x64-gnu"')
    expect(text['/package-lock.json']).toContain('"node_modules/lightningcss-linux-x64-gnu"')
  })

  it('V8B1-T7: the tab icon is exactly what the mark\'s script draws, small, and not Vite\'s', async () => {
    const { spawnSync } = await node('node:child_process')
    const fs = await node('node:fs')
    const check = spawnSync('node scripts/make-icons.mjs --check', { shell: true, encoding: 'utf8' })
    expect(check.status, check.stdout + check.stderr).toBe(0)
    const icon = fs.readFileSync('public/favicon.svg', 'utf8')
    expect(icon).not.toContain('#863bff') // Vite's purple bolt
    expect(icon).toContain('#e4572e') // Amygo orange
    expect(icon.length).toBeLessThan(2048)
    // (The shell's 60 KB budget is checked on a real build by V6B3-T2, in this same suite.)
  })
})
