// Switching on the offline copy (the service worker in sw.js), and noticing
// when a new version of Amygo is ready.
import { createStore } from '../lib/store'

// Where the worker may run: only in a built app (not `npm run dev`), only on a
// secure address (https, or localhost on the laptop; never `npm run phone`'s
// plain http), and only where the browser has service workers at all
export type OfflineEnv = { production: boolean; secure: boolean; supported: boolean }
export const shouldRegister = (env: OfflineEnv) => env.production && env.secure && env.supported

const currentEnv = (): OfflineEnv => ({
  production: import.meta.env.PROD,
  secure: globalThis.isSecureContext === true,
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
})

// A new version, installed and waiting for the page's OK (null: none)
const store = createStore({ waiting: null as ServiceWorker | null })
export const useUpdateReady = () => store.useSelect((s) => s.waiting !== null)
export const getUpdateWaiting = () => store.get().waiting

let registered = false
let reloadAsked = false

// Called once the 3D gym has arrived (App's lazy import), so the copy's three.js
// comes from the browser's own cache instead of a second download over mobile data
export function gymArrived(env: OfflineEnv = currentEnv()) {
  if (registered || !shouldRegister(env)) return false
  registered = true
  try {
    const workers = navigator.serviceWorker
    // A new worker took charge. After Reload, show the new version (once). The very
    // first install also takes charge (so offline works on the first visit): no reload then.
    workers.addEventListener('controllerchange', () => {
      if (!reloadAsked) return
      reloadAsked = false
      globalThis.location.reload()
    })
    workers
      .register('/sw.js')
      .then(watchForUpdates)
      .catch(() => {
        // No offline copy (or no update notes) this time; Amygo works as it always did
      })
  } catch {
    // The same
  }
  return true
}

function watchForUpdates(registration: ServiceWorkerRegistration) {
  // A worker that finished installing while another already looks after the
  // page is an update (the very first worker has no one before it)
  const noteWaiting = (worker: ServiceWorker) => {
    if (navigator.serviceWorker.controller) store.set({ waiting: worker })
  }
  if (registration.waiting) noteWaiting(registration.waiting)
  registration.addEventListener('updatefound', () => {
    const incoming = registration.installing
    incoming?.addEventListener('statechange', () => {
      if (incoming.state === 'installed') noteWaiting(incoming)
    })
  })
  // An installed app is rarely fully closed: look for a new version whenever it comes back on screen
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update().catch(() => {})
  })
}

// The update note's Reload: the waiting version takes over, and the page
// reloads once it has (see controllerchange above). If it already took over (Reload
// in another Amygo window, or the escape hatch), there's nothing to wait for: just
// reload. (Asking it again would do nothing, and the reload would come later,
// at the next update, perhaps in the middle of a set.)
export function applyUpdate() {
  const waiting = store.get().waiting
  if (!waiting) return
  if (waiting.state !== 'installed') {
    globalThis.location.reload()
    return
  }
  reloadAsked = true
  waiting.postMessage({ type: 'SKIP_WAITING' })
}
