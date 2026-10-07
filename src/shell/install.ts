// Installing Amygo as an app (Android's home screen, or a desktop window), and
// asking the browser to keep its data once installed.
import { createStore } from '../lib/store'

// Chrome's "this can be installed" announcement, kept so a button can use it later
// (Chrome sends it only after a tap and some time on the page, often after the
// welcome card has closed: so the header shows an Install button too, see Header.tsx)
type InstallOffer = Event & { prompt: () => Promise<unknown> }

const store = createStore({ offer: null as InstallOffer | null, installed: false, standalone: false })

// What the welcome card shows: 'button' (Install Amygo), 'menu' (install from the
// browser's menu: no offer came, as in Firefox or before Chrome is ready), or
// 'none' (already the installed app, or just installed)
export const useInstallChoice = () =>
  store.useSelect((s): 'button' | 'menu' | 'none' => (s.standalone || s.installed ? 'none' : s.offer ? 'button' : 'menu'))

// Running as the installed app (its own window, no address bar)?
export function isStandalone() {
  try {
    return globalThis.matchMedia?.('(display-mode: standalone)').matches === true
  } catch {
    return false
  }
}

// The Install button: opens Android's (or Chrome's) own install sheet. An
// announcement can be used once, so it's spent either way. Accepted, the install
// lines go at once (Chrome's "installed" can take a moment to follow).
export async function installApp() {
  const offer = store.get().offer
  if (!offer) return
  store.set({ offer: null })
  try {
    const choice = (await offer.prompt()) as { outcome?: string } | undefined
    if (choice?.outcome === 'accepted') store.set({ installed: true })
  } catch {
    // The browser said no; its menu still works
  }
}

// Installed, Amygo asks the browser to keep its data, so Android doesn't clear the
// log when the phone runs low on space. Chrome says yes to installed apps without
// asking you. Never asked in a plain tab, never twice once kept, and harmless where missing.
export async function keepData() {
  if (!isStandalone()) return false
  try {
    const storage = globalThis.navigator?.storage
    if (!storage?.persisted || !storage.persist) return false
    if (await storage.persisted()) return true
    return await storage.persist()
  } catch {
    return false
  }
}

// Started with the app (startApp), because Chrome can announce before React has drawn anything
export function listenForInstall() {
  store.set({ standalone: isStandalone() })
  const onOffer = (event: Event) => {
    event.preventDefault() // keep it for our button, instead of Chrome's own mini bar
    store.set({ offer: event as InstallOffer })
  }
  const onInstalled = () => store.set({ offer: null, installed: true })
  window.addEventListener('beforeinstallprompt', onOffer)
  window.addEventListener('appinstalled', onInstalled)
  void keepData()
  return () => {
    window.removeEventListener('beforeinstallprompt', onOffer)
    window.removeEventListener('appinstalled', onInstalled)
  }
}
