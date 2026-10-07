// The browser's storage (localStorage), or null where there is none: private
// browsing can block it, and even reading the property can throw. Everything
// the app saves (the layout, the log, the welcome flag) goes through this, and
// each caller also wraps its own reads and writes, so storage never breaks the app.
export function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
