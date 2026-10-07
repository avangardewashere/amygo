// What the offline copy keeps, and how its version is named. Plain rules with
// no browser or Node code, so the build (vite.config.ts) and the tests share them.

// Everything the build writes goes into the copy, except these: the worker
// itself (it is the copier, and the browser checks it for updates on its own)
// and the old character model nothing loads any more
export const LEFT_OUT = ['sw.js', 'models/fitness-character.glb']

// The cache names start with this (one cache per version: amygo-<version>)
export const CACHE_PREFIX = 'amygo-'

// The addresses to keep, from the build's files (paths inside the build folder,
// with "/" between folders). The page itself is kept as "/", the address people open.
export function precacheList(files: string[]) {
  return files
    .map((file) => file.replace(/\\/g, '/'))
    .filter((file) => !LEFT_OUT.includes(file))
    .map((file) => (file === 'index.html' ? '/' : `/${file}`))
    .sort()
}

// The version: a short fingerprint of every kept file's name and contents. Any
// change (a new man.glb included) gives a new version, and so a new worker.
// (`hash` is given by the caller: Node's crypto in the build and the tests.)
export function offlineVersion(files: { path: string; content: Uint8Array }[], hash: (parts: (string | Uint8Array)[]) => string) {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : 1))
  return hash(sorted.flatMap((file) => [file.path, '\0', file.content, '\0'])).slice(0, 12)
}
