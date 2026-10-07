import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { APP_DESCRIPTION, APP_NAME } from './brand'
import { INSTALL_FROM_MENU } from './Welcome'

// Node's own modules, loaded by name (this project's app code doesn't use Node's types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)

const OUT = 'dist-install' // this file's own build folder (git ignores dist-*)
const sources = import.meta.glob(['/index.html', '/src/shell/Welcome.tsx', '/src/shell/Header.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

type Manifest = {
  id: string
  start_url: string
  scope: string
  name: string
  short_name: string
  description: string
  display: string
  background_color: string
  theme_color: string
  icons: { src: string; sizes: string; type: string; purpose: string }[]
}
let manifest: Manifest
let fs: { readFileSync(path: string, encoding?: string): string & Uint8Array; existsSync(path: string): boolean }
beforeAll(async () => {
  fs = await node('node:fs')
  manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// A PNG, read as strictly as a browser does: every part's checksum, the header's
// fields, the end marker, then its rows of pixels unpacked with zlib (each row
// starts with a filter byte; ours are all 0). Written apart from make-icons.mjs,
// so a mistake in the script's writer can't hide here.
async function readPng(path: string) {
  const { inflateSync, crc32 } = await node('node:zlib')
  const { Buffer } = await node('node:buffer') // (Node's, loaded like the others: the app's types don't include Node)
  const file = Buffer.from(fs.readFileSync(path))
  expect(file.subarray(0, 8).toString('hex'), path).toBe('89504e470d0a1a0a') // a real PNG
  let at = 8
  let width = 0
  let height = 0
  let header: number[] = []
  const types: string[] = []
  const data: Uint8Array[] = []
  while (at < file.length) {
    const length = file.readUInt32BE(at)
    const type = file.toString('latin1', at + 4, at + 8)
    const body = file.subarray(at + 8, at + 8 + length)
    // The checksum covers the part's name and its contents
    expect(file.readUInt32BE(at + 8 + length), `${path}: ${type} checksum`).toBe(crc32(file.subarray(at + 4, at + 8 + length)))
    types.push(type)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      header = [...body.subarray(8, 13)]
    }
    if (type === 'IDAT') data.push(body)
    at += 12 + length
  }
  expect(types[0], path).toBe('IHDR')
  expect(types.at(-1), path).toBe('IEND')
  // 8 bits a colour, red/green/blue/opacity, standard squeeze, standard filters, not interlaced
  expect(header, path).toEqual([8, 6, 0, 0, 0])
  const rows: Uint8Array = inflateSync(Buffer.concat(data))
  expect(rows.length, path).toBe(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) expect(rows[y * (width * 4 + 1)], `${path}: row ${y} filter`).toBe(0)
  const pixel = (x: number, y: number) => {
    const start = y * (width * 4 + 1) + 1 + x * 4
    return [...rows.subarray(start, start + 4)]
  }
  return { width, height, colorType: 6, rows, pixel }
}

// "Open the page": fresh app state, switched on by startApp() as in main.tsx, in a pretend
// browser: a window Chrome sends its install offer to, and the display mode
// (`returning`: someone who has been here before, as the installed app always is)
async function openApp({ standalone = false, storage = undefined as object | undefined, returning = false } = {}) {
  const events = new EventTarget()
  vi.stubGlobal('window', {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    location: { search: '' },
  })
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: standalone && query === '(display-mode: standalone)' }))
  vi.stubGlobal('navigator', { storage })
  const saved = new Map(returning ? [['gym3d.welcomed', '1']] : [])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  })
  vi.resetModules()
  const app = {
    events,
    install: await import('./install'),
    Welcome: (await import('./Welcome')).Welcome,
    Header: (await import('./Header')).Header,
    tabStore: await import('./tabStore'),
  }
  ;(await import('./startup')).startApp()
  return app
}
// (as a person reads it: React marks where pieces of text meet with <!-- -->, and writes ' as &#x27;)
const card = (app: Awaited<ReturnType<typeof openApp>>) =>
  renderToString(createElement(app.Welcome)).replaceAll('<!-- -->', '').replaceAll('&#x27;', "'")
const header = (app: Awaited<ReturnType<typeof openApp>>) => renderToString(createElement(app.Header)).replaceAll('<!-- -->', '')
const MENU_LINE = INSTALL_FROM_MENU

// Chrome's announcement that Amygo can be installed
function chromeOffers(app: Awaited<ReturnType<typeof openApp>>) {
  const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async (): Promise<{ outcome: string } | undefined> => undefined),
  })
  app.events.dispatchEvent(offer)
  return offer
}

describe('Install Amygo', () => {
  it('V8B3-T1: the manifest has what Chrome needs to install, in Amygo\'s name and colours', () => {
    expect(manifest.name).toBe(APP_NAME)
    expect(manifest.short_name).toBe(APP_NAME)
    expect(manifest.description).toBe(APP_DESCRIPTION)
    expect(manifest.id).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    const icon = (sizes: string, purpose: string) => manifest.icons.find((i) => i.sizes === sizes && i.purpose === purpose)
    expect(icon('192x192', 'any')?.type).toBe('image/png')
    expect(icon('512x512', 'any')?.type).toBe('image/png')
    expect(icon('512x512', 'maskable')?.type).toBe('image/png')
    // The splash and the bar match the app: index.html's theme colour and the page's background
    const themeColor = sources['/index.html'].match(/<meta name="theme-color" content="(#[0-9a-f]{6})"/)![1]
    // (the stylesheet read from disk: Vite treats CSS specially, even as raw text)
    const background = fs.readFileSync('src/index.css', 'utf8').match(/:root \{[^}]*background: (#[0-9a-f]{6})/)![1]
    expect(manifest.background_color).toBe(background)
    expect(manifest.theme_color).toBe(themeColor)
    expect(themeColor).toBe(background)
  })

  it('V8B3-T2: each icon is a real PNG of the size the manifest says; the maskable one stays inside Android\'s circle; all are what the script draws', async () => {
    const icons = [...manifest.icons.map((i) => ({ path: `public${i.src}`, size: Number(i.sizes.split('x')[0]) })), { path: 'public/icons/apple-touch-icon-180.png', size: 180 }]
    for (const { path, size } of icons) {
      const png = await readPng(path)
      expect([png.width, png.height, png.colorType], path).toEqual([size, size, 6])
    }
    // Maskable: Android may cut it to a circle (or another shape) inside the middle 80%,
    // so every pixel outside that circle must be plain background, nothing of the mark
    const maskable = await readPng(`public${manifest.icons.find((i) => i.purpose === 'maskable')!.src}`)
    const size = maskable.width
    const background = [0x11, 0x12, 0x14, 255]
    let outside = 0
    let wrong = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) <= 0.4 * size) continue
        outside++
        if (maskable.pixel(x, y).join() !== background.join()) wrong++
      }
    }
    expect(outside).toBeGreaterThan(size * size * 0.4) // (the check really covered the edge)
    expect(wrong).toBe(0)
    // …and the mark does show in the middle
    expect(maskable.pixel(size / 2, Math.round(size * 0.3)).slice(0, 3)).toEqual([0xe4, 0x57, 0x2e])

    // The ordinary icons: a dark square with rounded corners (radius 22% of the side), clear outside
    // them, and the mark on it. Worked out here, not by the script: the clear share is
    // 4 corners × (r² − a quarter circle) = 4 × 0.22² × (1 − π/4) ≈ 4.2% of the pixels
    for (const src of ['/icons/icon-192.png', '/icons/icon-512.png']) {
      const icon = await readPng(`public${src}`)
      const n = icon.width
      expect(icon.pixel(0, 0)[3], `${src} corner`).toBe(0)
      expect(icon.pixel(n - 1, n - 1)[3], `${src} corner`).toBe(0)
      expect(icon.pixel(Math.round(n / 2), 0), `${src} top edge`).toEqual(background)
      expect(icon.pixel(Math.round(n * 0.1), Math.round(n * 0.1)), `${src} inside the rounding`).toEqual(background)
      expect(icon.pixel(Math.round(n / 2), Math.round(n * 0.59)).slice(0, 3), `${src} mark (the dumbbell bar)`).toEqual([0xe4, 0x57, 0x2e])
      let clear = 0
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (icon.pixel(x, y)[3] === 0) clear++
      expect(clear / (n * n), `${src} clear share`).toBeCloseTo(4 * 0.22 ** 2 * (1 - Math.PI / 4), 2)
    }
    // The apple icon is a full square (iPhones round it themselves): opaque corners, mark in the middle
    const apple = await readPng('public/icons/apple-touch-icon-180.png')
    expect(apple.pixel(0, 0)).toEqual(background)
    expect(apple.pixel(179, 179)).toEqual(background)
    expect(apple.pixel(90, Math.round(180 * 0.577)).slice(0, 3)).toEqual([0xe4, 0x57, 0x2e]) // the bar, at the apple icon's scale
    // Every committed icon is exactly what make-icons.mjs draws today
    const { spawnSync } = await node('node:child_process')
    const check = spawnSync('node scripts/make-icons.mjs --check', { shell: true, encoding: 'utf8' })
    expect(check.status, check.stdout + check.stderr).toBe(0)
  }, 60_000)

  it('V8B3-T3: the page links the manifest and the apple icon; a build carries them, and the offline copy keeps them', async () => {
    expect(sources['/index.html']).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(sources['/index.html']).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />')
    const { spawnSync } = await node('node:child_process')
    const { env } = await node('node:process')
    const build = spawnSync(`npx vite build --outDir ${OUT}`, { shell: true, encoding: 'utf8', env: { ...env, NODE_ENV: 'production' } })
    expect(build.status, build.stdout + build.stderr).toBe(0)
    // The page as the browser reads it: the built one, comments left out, the links inside <head>
    const head = fs.readFileSync(`${OUT}/index.html`, 'utf8').replace(/<!--[\s\S]*?-->/g, '').match(/<head>([\s\S]*?)<\/head>/)![1]
    expect(head).toContain('<link rel="manifest" href="/manifest.webmanifest"')
    expect(head).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png"')
    const kept = JSON.parse(fs.readFileSync(`${OUT}/sw.js`, 'utf8').match(/^const PRECACHE = (.*)$/m)![1]) as string[]
    for (const path of ['/manifest.webmanifest', ...manifest.icons.map((i) => i.src), '/icons/apple-touch-icon-180.png']) {
      expect(fs.existsSync(`${OUT}${path}`), path).toBe(true)
      expect(kept, path).toContain(path)
    }
    const check = spawnSync(`node scripts/check-budget.mjs --dist=${OUT}`, { shell: true, encoding: 'utf8' })
    expect(check.status, check.stdout + check.stderr).toBe(0)
  }, 180_000)

  it('V8B3-T4: Install Amygo shows once Chrome offers it, opens Chrome\'s sheet once, and goes after installing; never in the installed app', async () => {
    let app = await openApp()
    expect(card(app)).not.toContain(`>Install ${APP_NAME}<`)
    const offer = chromeOffers(app)
    expect(offer.defaultPrevented).toBe(true) // kept for our button, not Chrome's own mini bar
    expect(card(app)).toContain(`>Install ${APP_NAME}<`)
    expect(card(app)).not.toContain(MENU_LINE)
    await app.install.installApp()
    await app.install.installApp() // an offer works once
    expect(offer.prompt).toHaveBeenCalledTimes(1)
    // Installed: no button, no menu line
    chromeOffers(app)
    app.events.dispatchEvent(new Event('appinstalled'))
    expect(card(app)).not.toContain(`>Install ${APP_NAME}<`)
    expect(card(app)).not.toContain(MENU_LINE)
    // Already the installed app: never, even if an offer came
    app = await openApp({ standalone: true })
    chromeOffers(app)
    expect(card(app)).not.toContain(`>Install ${APP_NAME}<`)
    expect(card(app)).not.toContain(MENU_LINE)
    // The button is wired to installApp (buttons can't be clicked without a browser, so read it)
    expect(sources['/src/shell/Welcome.tsx']).toMatch(/onClick=\{installApp\}>\s*Install \{APP_NAME\}/)

    // The review's case: Chrome offers only after a tap and some time, usually once the card is
    // closed, and on later visits it never opens by itself. The header shows Install then, on any tab.
    app = await openApp({ returning: true })
    expect(app.tabStore.getWelcome()).toBe(false)
    expect(header(app)).not.toContain('>Install<')
    const later = chromeOffers(app)
    expect(header(app)).toContain('>Install<')
    app.tabStore.setTab('today')
    expect(header(app)).toContain('>Install<')
    expect(sources['/src/shell/Header.tsx']).toMatch(/className="install-chip" onClick=\{installApp\}>\s*Install/)
    // Accepting in Chrome's sheet: the Install button and the menu line go at once
    later.prompt.mockResolvedValueOnce({ outcome: 'accepted' })
    await app.install.installApp()
    expect(header(app)).not.toContain('>Install<')
    app.tabStore.setWelcome(true)
    expect(card(app)).not.toContain(MENU_LINE)
    expect(card(app)).not.toContain(`>Install ${APP_NAME}<`)
  })

  it('V8B3-T5: where no offer comes, the card says to use the browser\'s menu, and everything else works the same', async () => {
    const app = await openApp()
    const html = card(app)
    expect(html).toContain(MENU_LINE)
    expect(html).toContain('>Pick an exercise<')
    expect(html).toContain('>Look around<')
    expect(html).toContain(`Welcome to ${APP_NAME}`)
  })

  it('V8B3-T6: the installed app asks the browser to keep its data, once; a browser tab never asks; nothing throws without it', async () => {
    const storage = (kept: boolean) => ({ persisted: vi.fn(async () => kept), persist: vi.fn(async () => true) })
    // Installed, not yet kept: asks (at start-up). The installed app is always a return visit.
    let asked = storage(false)
    let app = await openApp({ standalone: true, storage: asked, returning: true })
    await vi.waitFor(() => expect(asked.persist).toHaveBeenCalledTimes(1))
    // Already kept: doesn't ask again
    asked = storage(true)
    app = await openApp({ standalone: true, storage: asked, returning: true })
    await vi.waitFor(() => expect(asked.persisted).toHaveBeenCalled())
    expect(asked.persist).not.toHaveBeenCalled()
    // A plain browser tab: never asks
    asked = storage(false)
    app = await openApp({ standalone: false, storage: asked })
    expect(await app.install.keepData()).toBe(false)
    expect(asked.persisted).not.toHaveBeenCalled()
    expect(asked.persist).not.toHaveBeenCalled()
    // No storage manager at all (older browsers): nothing throws
    app = await openApp({ standalone: true, storage: undefined })
    await expect(app.install.keepData()).resolves.toBe(false)
  })
})
