// Checks on every build (the size budget since v6 Block 3, the offline list
// since v8 Block 2). Runs at the end of `npm run build`, on the laptop and on Vercel:
//   node scripts/check-budget.mjs [--budget-kb=60] [--dist=dist]
// Fails (exit code 1) if the entry file (the shell: header, tabs, list) is
// over budget when compressed, if three.js would be downloaded before the
// gym is asked for, if three.js isn't a file of its own, or if the offline
// worker's list of files doesn't match the build.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : fallback
}
const dist = arg('dist', 'dist')
const budgetKb = Number(arg('budget-kb', '60'))

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const entry = html.match(/<script type="module"[^>]*src="\/([^"]+)"/)?.[1]
// Everything the page downloads straight away: the entry, and what it preloads
const upFront = [entry, ...[...html.matchAll(/rel="modulepreload"[^>]*href="\/([^"]+)"/g)].map((m) => m[1])]
const kb = (bytes) => (bytes / 1024).toFixed(1)

const problems = []
if (!entry) problems.push('no entry script found in index.html')
const entryGz = entry ? gzipSync(readFileSync(join(dist, entry))).length : 0
if (entryGz > budgetKb * 1024) problems.push(`the shell is ${kb(entryGz)} KB compressed, over the ${budgetKb} KB budget`)
for (const file of upFront.filter(Boolean)) {
  const name = file.split('/').pop()
  const text = readFileSync(join(dist, file), 'utf8')
  if (name.startsWith('three') || text.includes('WebGLRenderer')) problems.push(`three.js would load up front (${name})`)
}
const assets = readdirSync(join(dist, 'assets'))
if (!assets.some((name) => /^three-.*\.js$/.test(name))) problems.push('three.js has no file of its own')

// Offline list (v8 Block 2): the worker (sw.js) must keep every file the build
// wrote, except itself and the unused character model, and only files that exist.
// Otherwise the offline copy would have holes, or its install would fail.
const filesIn = (folder, inside = '') =>
  readdirSync(join(folder, inside), { withFileTypes: true }).flatMap((entry) => {
    const path = inside ? `${inside}/${entry.name}` : entry.name
    return entry.isDirectory() ? filesIn(folder, path) : [path]
  })
let offlineCount = 0
const worker = (() => {
  try {
    return readFileSync(join(dist, 'sw.js'), 'utf8')
  } catch {
    return null
  }
})()
if (worker === null) problems.push('Offline list: there is no offline worker (sw.js) in the build')
else {
  const listed = JSON.parse(worker.match(/^const PRECACHE = (.*)$/m)?.[1] ?? 'null')
  if (!Array.isArray(listed)) problems.push('Offline list: sw.js has no list of files to keep')
  else {
    offlineCount = listed.length
    const shouldKeep = filesIn(dist)
      .filter((path) => path !== 'sw.js' && path !== 'models/fitness-character.glb')
      .map((path) => (path === 'index.html' ? '/' : `/${path}`))
    for (const path of shouldKeep) if (!listed.includes(path)) problems.push(`Offline list: ${path} is in the build but not kept`)
    for (const path of listed) if (!shouldKeep.includes(path)) problems.push(`Offline list: ${path} is kept but isn't in the build (or shouldn't be kept)`)
  }
}

const sizes = assets
  .filter((name) => name.endsWith('.js'))
  .map((name) => `${name.padEnd(36)} ${kb(gzipSync(readFileSync(join(dist, 'assets', name))).length).padStart(7)} KB`)
console.log(`Shell: ${kb(entryGz)} KB compressed (budget ${budgetKb} KB). Downloaded up front: ${upFront.length} files.`)
console.log(sizes.join('\n'))
console.log(`Offline list: ${offlineCount} files kept`)
if (problems.length) {
  console.error('\nBuild check failed:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('Size budget: OK')
