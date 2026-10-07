// Amygo's service worker: a small script the browser keeps beside the site,
// which sees every request the page makes and can answer it from a copy kept
// earlier, with or without a network. Ours keeps a copy of the whole app, so
// Amygo opens and works with no signal.
//
// The build (vite.config.ts) puts two lines in front of this file:
//   const PRECACHE = [...]   every address to keep (see src/offline/precache.ts)
//   const VERSION = '...'    a fingerprint of all of them
// No imports: it runs in the browser's worker, not in the page.
/* global PRECACHE, VERSION */

const CACHE = 'amygo-' + VERSION

// How each kept file is fetched. The app's own files (in /assets/) carry a
// fingerprint of their contents in their names, so a copy the browser already
// has is exactly right: no second download over mobile data. Files without one
// (the page, the model, the icon) are checked with the site first; unchanged,
// that's a short "not modified" reply, not the whole file again.
const fetchMode = (path) => (path.startsWith('/assets/') ? 'default' : 'no-cache')

// Install: fetch every kept file, and store them only once all of them have
// arrived, so a half-filled copy never goes live
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const arrived = await Promise.all(
        PRECACHE.map(async (path) => {
          const response = await fetch(path, { cache: fetchMode(path) })
          if (!response.ok) throw new Error(`Could not keep ${path} (${response.status})`)
          return [path, response]
        }),
      )
      const cache = await caches.open(CACHE)
      await Promise.all(arrived.map(([path, response]) => cache.put(path, response)))
      // An older version taking over meanwhile deletes every copy but its own,
      // this one too. The files would then land in a copy no one can find, and
      // this version would go live with nothing kept. So check, and fail this
      // install: the browser drops it, and the next update check installs it again.
      if (!(await caches.has(CACHE))) throw new Error('The copy was removed while installing')
    })(),
  )
})

// Activate: delete older versions' copies (Amygo's only), and look after the
// page that's already open (so offline works from the very first visit)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('amygo-') && name !== CACHE).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

// A new version waits until the page asks it to take over (its Reload button)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

// Requests: this site's GETs for kept files are answered from the copy (the
// network only if the copy doesn't have it); everything else goes to the
// network untouched
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // The page, with or without ?perf, is kept as "/"
  const key = url.pathname === '/' || url.pathname === '/index.html' ? '/' : url.pathname
  if (!PRECACHE.includes(key)) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      return (await cache.match(key)) || fetch(request)
    })(),
  )
})
