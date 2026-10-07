// The escape hatch, ready before it's needed. Never deployed unless phones get
// stuck on an old version of Amygo: then one line in vite.config.ts
// (REMOVE_OFFLINE_COPY) sends this out as sw.js for one deploy, with your OK
// for that push. It takes over at once, deletes Amygo's offline copies (and
// nothing else), and removes itself; the next visit loads straight from the site.
// (The build puts the same two lines in front of it as sw.js; it doesn't need them.)

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('amygo-')).map((name) => caches.delete(name)))
      await self.registration.unregister()
    })(),
  )
})
