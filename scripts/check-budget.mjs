// Size budget for the app's own code (v6 Block 3). Runs after every build:
//   node scripts/check-budget.mjs [--budget-kb=60] [--dist=dist]
// Fails (exit code 1) if the entry file (the shell: header, tabs, list) is
// over budget when compressed, if three.js would be downloaded before the
// gym is asked for, or if three.js isn't a file of its own.
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

const sizes = assets
  .filter((name) => name.endsWith('.js'))
  .map((name) => `${name.padEnd(36)} ${kb(gzipSync(readFileSync(join(dist, 'assets', name))).length).padStart(7)} KB`)
console.log(`Shell: ${kb(entryGz)} KB compressed (budget ${budgetKb} KB). Downloaded up front: ${upFront.length} files.`)
console.log(sizes.join('\n'))
if (problems.length) {
  console.error('\nSize budget failed:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('Size budget: OK')
