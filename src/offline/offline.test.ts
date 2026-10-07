import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import workerSource from './sw.js?raw'
import removerSource from './sw-remove.js?raw'
import { CACHE_PREFIX, LEFT_OUT, offlineVersion, precacheList } from './precache'
import { shouldRegister, type OfflineEnv } from './register'

// Node's own modules, loaded by name (this project's app code doesn't use Node's types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)

const OUT = 'dist-offline' // its own build folder, so it never collides with loading.test.ts building dist
const SITE = 'https://amygo.vercel.app'
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '/vercel.json'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

// A real build, as Vercel makes it
let built = { list: [] as string[], worker: '', files: [] as string[] }
beforeAll(async () => {
  const { spawnSync } = await node('node:child_process')
  const fs = await node('node:fs')
  // NODE_ENV=production, as on Vercel: Vitest sets it to 'test', which would give a development
  // build, where the worker (rightly) never registers
  const { env } = await node('node:process')
  const result = spawnSync(`npx vite build --outDir ${OUT}`, { shell: true, encoding: 'utf8', env: { ...env, NODE_ENV: 'production' } })
  if (result.status !== 0) throw new Error('build failed:\n' + result.stdout + result.stderr)
  const worker = fs.readFileSync(`${OUT}/sw.js`, 'utf8')
  const files = (fs.readdirSync(OUT, { recursive: true, withFileTypes: true }) as { isFile(): boolean; name: string; parentPath: string }[])
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath.replace(/\\/g, '/')}/${entry.name}`.replace(`${OUT}/`, ''))
  built = { list: JSON.parse(worker.match(/^const PRECACHE = (.*)$/m)![1]), worker, files }
}, 180_000)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------- The worker in a sealed box, with a pretend cache, network and site ----------

type Reply = { ok: boolean; status: number; body: string }
type Listener = (event: Record<string, unknown>) => void

async function startWorker(source: string, network: (path: string) => Promise<Reply>) {
  const vm = await node('node:vm')
  const listeners: Record<string, Listener> = {}
  const stores = new Map<string, Map<string, Reply>>()
  const calls = { claimed: 0, skipped: 0, unregistered: 0, fetched: [] as { path: string; cache?: string }[] }
  // Like the browser's: a copy opened before it was deleted still takes files,
  // but they land somewhere no one can find by name (`hooks.beforePut` can delete it meanwhile)
  const hooks = { beforePut: (() => {}) as (name: string) => void }
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return {
        put: async (key: string, reply: Reply) => {
          hooks.beforePut(name)
          store.set(key, reply)
        },
        match: async (key: string) => store.get(key),
      }
    },
    has: async (name: string) => stores.has(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  }
  const fetch = (input: string | { url: string }, options: { cache?: string } = {}) => {
    const path = typeof input === 'string' ? input : new URL(input.url).pathname + new URL(input.url).search
    calls.fetched.push({ path, cache: options.cache })
    return network(path)
  }
  const self = {
    addEventListener: (type: string, listener: Listener) => void (listeners[type] = listener),
    location: { origin: SITE },
    clients: { claim: async () => void calls.claimed++ },
    skipWaiting: () => void calls.skipped++,
    registration: { unregister: async () => void calls.unregistered++ },
  }
  vm.runInContext(source, vm.createContext({ self, caches, fetch, URL, Promise, Error }))
  // An install or activate event, waited for as the browser waits
  const fire = async (type: string, extra: Record<string, unknown> = {}) => {
    let waited: unknown
    listeners[type]({ ...extra, waitUntil: (promise: unknown) => void (waited = promise) })
    return waited
  }
  // A request from the page: the worker's answer, or 'network' if it lets it through
  const request = async (url: string, method = 'GET') => {
    let answer: Promise<Reply> | undefined
    listeners.fetch({ request: { url: new URL(url, SITE).href, method }, respondWith: (reply: Promise<Reply>) => void (answer = reply) })
    return answer === undefined ? 'network' : (await answer).body
  }
  return { stores, calls, hooks, fire, request }
}
const withList = (list: string[], version: string, source: string) =>
  `const PRECACHE = ${JSON.stringify(list)}\nconst VERSION = '${version}'\n\n${source}`
const online = async (path: string): Promise<Reply> => ({ ok: true, status: 200, body: `file ${path}` })
const offline = async (): Promise<Reply> => {
  throw new TypeError('Failed to fetch')
}

describe('Works with no signal', () => {
  it('V8B2-T1: the built worker keeps every file the app can ask for, and only files that exist', () => {
    const { list, files } = built
    expect(list).toContain('/')
    expect(list).toContain('/favicon.svg')
    expect(list).toContain('/models/man.glb')
    for (const file of files.filter((path) => path.startsWith('assets/'))) expect(list, file).toContain(`/${file}`)
    expect(list).not.toContain('/sw.js')
    expect(list).not.toContain('/models/fitness-character.glb')
    // Every kept address is a real file in the build ("/" is index.html)
    for (const path of list) expect(files, path).toContain(path === '/' ? 'index.html' : path.slice(1))
    // …and the same rule as the build's own, for any list of files
    expect(precacheList(['index.html', 'assets/a-1.js', 'sw.js', ...LEFT_OUT, 'icons\\icon-192.png'])).toEqual([
      '/',
      '/assets/a-1.js',
      '/icons/icon-192.png',
    ])
  })

  it('V8B2-T2: installing keeps every listed file under amygo-<version>; if one fails, nothing is kept', async () => {
    const list = ['/', '/assets/app-1.js', '/models/man.glb']
    const worker = await startWorker(withList(list, 'v1', workerSource), online)
    await worker.fire('install')
    expect([...worker.stores.keys()]).toEqual([`${CACHE_PREFIX}v1`])
    expect([...worker.stores.get(`${CACHE_PREFIX}v1`)!.keys()].sort()).toEqual([...list].sort())

    // One file missing on the network: the install fails as a whole, and no half-filled copy is left
    const flaky = await startWorker(withList(list, 'v2', workerSource), async (path) =>
      path === '/models/man.glb' ? { ok: false, status: 404, body: '' } : online(path),
    )
    await expect(flaky.fire('install')).rejects.toThrow('/models/man.glb')
    expect(flaky.stores.size).toBe(0)

    // The review's race (reproduced in Chromium): an older version takes over while this one
    // is still storing files, and deletes this one's copy. The install must fail rather than
    // go live with nothing kept (the browser then drops it and installs it again later).
    const raced = await startWorker(withList(list, 'v3', workerSource), online)
    raced.hooks.beforePut = (name) => void raced.stores.delete(name)
    await expect(raced.fire('install')).rejects.toThrow('removed while installing')

    // The app's own fingerprinted files come from the browser's cache when it has them (no
    // second download over mobile data); the page, model and icon are checked with the site
    expect(worker.calls.fetched).toEqual(
      expect.arrayContaining([
        { path: '/assets/app-1.js', cache: 'default' },
        { path: '/', cache: 'no-cache' },
        { path: '/models/man.glb', cache: 'no-cache' },
      ]),
    )
    expect(worker.calls.fetched).toHaveLength(list.length)
  })

  it('V8B2-T3: with no network, the page (with or without ?perf), the app\'s files and the model come from the copy', async () => {
    // The real built worker, with its real list
    let network = online
    const worker = await startWorker(built.worker, (path) => network(path))
    await worker.fire('install')
    network = offline
    expect(await worker.request('/')).toBe('file /')
    expect(await worker.request('/?perf')).toBe('file /')
    const three = built.list.find((path) => path.startsWith('/assets/three-'))!
    expect(await worker.request(three)).toBe(`file ${three}`)
    expect(await worker.request('/models/man.glb')).toBe('file /models/man.glb')
    // Not the worker's business: other sites (even at a path it keeps), anything but GET, files it doesn't keep
    expect(await worker.request('https://example.com/x.js')).toBe('network')
    expect(await worker.request('https://example.com/models/man.glb')).toBe('network')
    expect(await worker.request('/', 'POST')).toBe('network')
    expect(await worker.request('/sw.js')).toBe('network')
    expect(await worker.request('/models/fitness-character.glb')).toBe('network')
    // A kept file missing from the copy (the browser can evict) is fetched from the site, if there is one
    const version = built.worker.match(/^const VERSION = '(.*)'$/m)![1]
    worker.stores.get(`${CACHE_PREFIX}${version}`)!.delete('/models/man.glb')
    network = online
    expect(await worker.request('/models/man.glb')).toBe('file /models/man.glb')
  })

  it('V8B2-T4: the version follows the files\' contents; activating clears older Amygo copies only; the escape hatch removes them all', async () => {
    const { createHash } = await node('node:crypto')
    const hash = (parts: (string | Uint8Array)[]) => {
      const sha = createHash('sha256')
      for (const part of parts) sha.update(part)
      return sha.digest('hex')
    }
    const bytes = (text: string) => new TextEncoder().encode(text)
    const files = [
      { path: '/', content: bytes('<html>') },
      { path: '/models/man.glb', content: bytes('model') },
    ]
    const v1 = offlineVersion(files, hash)
    expect(offlineVersion([...files].reverse(), hash)).toBe(v1) // same files: same version
    expect(offlineVersion([files[0], { path: '/models/man.glb', content: bytes('model!') }], hash)).not.toBe(v1) // a new model
    expect(offlineVersion([files[0], { path: '/models/men.glb', content: bytes('model') }], hash)).not.toBe(v1)

    // Activating v2: v1's copy goes; v2's, and caches that aren't Amygo's, stay. It looks after the open page.
    const worker = await startWorker(withList(['/'], 'v2', workerSource), online)
    for (const name of [`${CACHE_PREFIX}v1`, `${CACHE_PREFIX}v2`, 'someone-elses']) worker.stores.set(name, new Map())
    await worker.fire('activate')
    expect([...worker.stores.keys()].sort()).toEqual([`${CACHE_PREFIX}v2`, 'someone-elses'])
    expect(worker.calls.claimed).toBe(1)
    // A waiting version takes over only when the page asks (its Reload button)
    expect(worker.calls.skipped).toBe(0)
    await worker.fire('message', { data: { type: 'HELLO' } })
    expect(worker.calls.skipped).toBe(0)
    await worker.fire('message', { data: { type: 'SKIP_WAITING' } })
    expect(worker.calls.skipped).toBe(1)

    // The escape hatch: takes over at once, deletes every Amygo copy (only those), and removes itself
    const remover = await startWorker(withList(['/'], 'v3', removerSource), online)
    for (const name of [`${CACHE_PREFIX}v1`, `${CACHE_PREFIX}v2`, 'someone-elses']) remover.stores.set(name, new Map())
    await remover.fire('install')
    expect(remover.calls.skipped).toBe(1)
    await remover.fire('activate')
    expect([...remover.stores.keys()]).toEqual(['someone-elses'])
    expect(remover.calls.unregistered).toBe(1)
  })

  it('V8B2-T5: the worker is registered only in a built app, on https or localhost, where supported, once the gym has arrived', async () => {
    // Every combination: only all three together
    for (const production of [true, false])
      for (const secure of [true, false])
        for (const supported of [true, false])
          expect(shouldRegister({ production, secure, supported }), JSON.stringify({ production, secure, supported })).toBe(
            production && secure && supported,
          )

    const ok: OfflineEnv = { production: true, secure: true, supported: true }
    const fresh = async (register: () => Promise<unknown>) => {
      const container = Object.assign(new EventTarget(), { controller: null, register: vi.fn(register) })
      vi.stubGlobal('navigator', { serviceWorker: container })
      vi.resetModules()
      return { container, offline: await import('./register') }
    }
    // npm run dev, and npm run phone's plain http: never
    let app = await fresh(async () => Object.assign(new EventTarget(), { waiting: null, update: async () => {} }))
    expect(app.offline.gymArrived({ ...ok, production: false })).toBe(false)
    expect(app.offline.gymArrived({ ...ok, secure: false })).toBe(false)
    expect(app.container.register).not.toHaveBeenCalled()
    // A built app on https: once, however often the gym arrives
    expect(app.offline.gymArrived(ok)).toBe(true)
    expect(app.offline.gymArrived(ok)).toBe(false)
    expect(app.container.register).toHaveBeenCalledTimes(1)
    expect(app.container.register).toHaveBeenCalledWith('/sw.js')
    // A browser that refuses: nothing throws, and Amygo works as before
    app = await fresh(() => {
      throw new Error('refused')
    })
    expect(() => app.offline.gymArrived(ok)).not.toThrow()
    app = await fresh(() => Promise.reject(new Error('refused')))
    expect(() => app.offline.gymArrived(ok)).not.toThrow()
    // …and a registration that misbehaves afterwards doesn't escape as an error either
    const unhandled = vi.fn()
    const processEvents = (globalThis as unknown as { process: { on(e: string, f: () => void): void; off(e: string, f: () => void): void } }).process
    processEvents.on('unhandledRejection', unhandled)
    app = await fresh(async () => ({}))
    app.offline.gymArrived(ok)
    await new Promise((resolve) => setTimeout(resolve, 10))
    processEvents.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
    // It starts when the gym has arrived (App's lazy import), not at start-up
    expect(sources['/src/App.tsx']).toMatch(/import\('\.\/scene\/GymScene'\)\.then\(\(module\) => \{\s*gymArrived\(\)/)
    expect(sources['/src/shell/startup.ts']).not.toContain('register')
    expect(sources['/src/main.tsx']).not.toContain('register')
    // The built app is a production build (as on Vercel), where the worker does register
    const fs = await node('node:fs')
    const entry = built.files.find((file) => /^assets\/index-.*\.js$/.test(file))!
    const code = fs.readFileSync(`${OUT}/${entry}`, 'utf8')
    expect(code).not.toContain('jsxDEV') // React's development build
    expect(code).toMatch(/production:!0/) // import.meta.env.PROD became true
  })

  it('V8B2-T6: the update note shows when a new version waits (never mid-exercise); Reload switches over and reloads once; data stays', async () => {
    const V7_LOG = JSON.stringify({ version: 1, sets: [{ id: 'a1', kind: 'curl', endedAt: 1791300000000, seconds: 28.9, reps: 12 }] })
    const V7_LAYOUT = JSON.stringify({ version: 2, items: [{ id: 'rack-1', type: 'dumbbellRack', x: 0.5, z: 0.5, turns: 1 }] })
    const saved = new Map([
      ['gym3d.log', V7_LOG],
      ['gym3d.layout', V7_LAYOUT],
    ])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
      removeItem: (key: string) => saved.delete(key),
    })
    const reload = vi.fn()
    vi.stubGlobal('location', { reload, search: '' })
    const screen = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('document', screen)

    // A pretend browser: the worker container, a registration, and workers that install
    const worker = () => Object.assign(new EventTarget(), { state: 'installing', postMessage: vi.fn() })
    const registration = Object.assign(new EventTarget(), {
      installing: null as ReturnType<typeof worker> | null,
      waiting: null,
      update: vi.fn(async () => {}),
    })
    const container = Object.assign(new EventTarget(), {
      controller: null as object | null,
      register: vi.fn(async () => registration),
    })
    vi.stubGlobal('navigator', { serviceWorker: container })
    vi.resetModules()
    const offline = await import('./register')
    const gym = await import('../interaction/gymStore')
    const { UpdateNote } = await import('../shell/UpdateNote')
    const note = () => renderToString(createElement(UpdateNote)).replaceAll('<!-- -->', '')
    const install = async (incoming: ReturnType<typeof worker>) => {
      registration.installing = incoming
      registration.dispatchEvent(new Event('updatefound'))
      incoming.state = 'installed'
      incoming.dispatchEvent(new Event('statechange'))
    }

    offline.gymArrived({ production: true, secure: true, supported: true })
    await Promise.resolve() // (the registration arrives)
    await Promise.resolve()
    // The very first install: no note, and taking charge doesn't reload the page
    await install(worker())
    expect(offline.useUpdateReady).toBeTypeOf('function')
    expect(offline.getUpdateWaiting()).toBeNull()
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).not.toHaveBeenCalled()

    // A deploy later: a new version installs while the first looks after the page
    container.controller = {}
    const next = worker()
    await install(next)
    expect(note()).toContain('A new version of Amygo is ready')
    expect(note()).toContain('>Reload<')
    // …but not while exercising (a reload would lose the set)
    gym.startFromList('curl')
    expect(note()).toBe('')
    gym.stopExercise()
    expect(note()).toContain('>Reload<')

    // Reload: the new version is asked to take over, and the page reloads once it has
    offline.applyUpdate()
    expect(next.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)

    // Two Amygo windows (the review's case): another version arrives, and the OTHER window's
    // Reload makes it take over. Here, Reload just reloads (asking again would do nothing),
    // and no reload comes by itself later
    const third = worker()
    await install(third)
    third.state = 'activated' // taken over, from the other window
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1) // not by itself
    offline.applyUpdate()
    expect(reload).toHaveBeenCalledTimes(2)
    expect(third.postMessage).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(2)

    // Coming back on screen looks for a new version (an installed app is rarely closed)
    screen.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalled()

    // The worker always gets checked for a new version (never cached)
    expect(JSON.parse(sources['/vercel.json']).headers).toContainEqual({
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    })
    // …and none of this touched what people saved
    expect(saved.get('gym3d.log')).toBe(V7_LOG)
    expect(saved.get('gym3d.layout')).toBe(V7_LAYOUT)
    expect([...saved.keys()].sort()).toEqual(['gym3d.layout', 'gym3d.log'])
  })

  it('V8B2-T7: the build check fails when the offline list has holes or extras; no model needs a decoder from another site', async () => {
    const fs = await node('node:fs')
    const { spawnSync } = await node('node:child_process')
    const check = (dist: string) => spawnSync(`node scripts/check-budget.mjs --dist=${dist}`, { shell: true, encoding: 'utf8' })
    const good = check(OUT)
    expect(good.status, good.stdout + good.stderr).toBe(0) // (this also keeps the shell under its 60 KB budget)
    expect(good.stdout).toContain(`Offline list: ${built.list.length} files kept`)

    const copy = (name: string) => {
      const to = `${OUT}-${name}`
      fs.rmSync(to, { recursive: true, force: true })
      fs.cpSync(OUT, to, { recursive: true })
      return to
    }
    try {
      // A kept file missing from the build
      const missing = copy('missing')
      fs.rmSync(`${missing}/models/man.glb`)
      let result = check(missing)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Offline list: /models/man.glb is kept but')
      // A file in the build the worker doesn't keep
      const extra = copy('extra')
      fs.writeFileSync(`${extra}/assets/extra-1.js`, 'x')
      result = check(extra)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Offline list: /assets/extra-1.js is in the build but not kept')
      // No worker at all
      const none = copy('none')
      fs.rmSync(`${none}/sw.js`)
      expect(check(none).status).toBe(1)
    } finally {
      for (const name of ['missing', 'extra', 'none']) fs.rmSync(`${OUT}-${name}`, { recursive: true, force: true })
    }

    // man.glb asks for no Draco decoder, and every model loader says "no Draco"
    const glb = fs.readFileSync('public/models/man.glb')
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString())
    expect(json.extensionsUsed ?? []).not.toContain('KHR_draco_mesh_compression')
    const loaders = Object.entries(sources).flatMap(([file, source]) =>
      file.endsWith('.test.ts') ? [] : [...source.matchAll(/useGLTF(?:\.preload)?\(([^)]*)\)/g)].map((match) => `${file}: ${match[1]}`),
    )
    expect(loaders.length).toBeGreaterThanOrEqual(3)
    for (const loader of loaders) expect(loader).toMatch(/, false$/)
  }, 180_000) // (the build check runs four times, each gzipping three.js)
})
