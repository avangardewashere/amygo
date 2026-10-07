import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { setTab } from './tabStore'

// Node's own modules, loaded by name (this project's app code doesn't use Node's types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const node = (name: string): Promise<any> => import(/* @vite-ignore */ name)

// Every source file's text, to follow imports without running them (as in V6B2-T6)
const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const resolve = (from: string, spec: string) => {
  const base = new URL(spec, 'file://' + from).pathname
  return [base, base + '.ts', base + '.tsx'].find((candidate) => candidate in sources) ?? base
}

// Run the budget check on a fresh build (the same one `npm run build` ends with)
let run: (args: string) => { status: number; output: string }
beforeAll(async () => {
  const { spawnSync } = await node('node:child_process')
  run = (args) => {
    const result = spawnSync(`node scripts/check-budget.mjs ${args}`, { shell: true, encoding: 'utf8' })
    return { status: result.status, output: result.stdout + result.stderr }
  }
  // NODE_ENV=production, as on Vercel: Vitest sets it to 'test', which would give a development build
  const { env } = await node('node:process')
  const build = spawnSync('npx vite build', { shell: true, encoding: 'utf8', env: { ...env, NODE_ENV: 'production' } })
  if (build.status !== 0) throw new Error('build failed:\n' + build.stdout + build.stderr)
}, 180_000)

afterAll(() => {
  setTab('home')
  vi.unstubAllGlobals()
})

describe('load order and size budget', () => {
  it('V6B3-T1: three.js is a file of its own, and the shell never imports it', () => {
    // In the code: from the entry point, only real (not type-only) imports, and
    // not the gym, which App asks for later with import()
    const seen = new Set<string>()
    const toVisit = ['/src/main.tsx']
    const problems: string[] = []
    while (toVisit.length) {
      const file = toVisit.pop()!
      if (seen.has(file) || !(file in sources)) continue // (stylesheets aren't code)
      seen.add(file)
      for (const match of sources[file].matchAll(/^(?:import|export)\s+(?!type\b)[^'"]*?from\s+'([^']+)'|^import\s+'([^']+)'/gm)) {
        const spec = match[1] ?? match[2]
        if (spec.startsWith('.')) toVisit.push(resolve(file, spec))
        else if (spec === 'three' || spec.startsWith('three/') || spec.startsWith('@react-three/')) problems.push(`${file} imports ${spec}`)
      }
    }
    expect(problems).toEqual([])
    expect(seen.has('/src/scene/GymScene.tsx')).toBe(false) // the gym comes later…
    expect(sources['/src/App.tsx']).toMatch(/import\('\.\/scene\/GymScene'\)/) // …asked for with import()
    // In the build: a three.js file exists, and nothing downloaded up front contains it
    const result = run('')
    expect(result.output).not.toContain('three.js has no file of its own')
    expect(result.output).not.toContain('three.js would load up front')
  })

  it('V6B3-T2: the shell is under its budget, and the check fails when the budget is set below its size', () => {
    const ok = run('--budget-kb=60')
    expect(ok.status, ok.output).toBe(0)
    const tooSmall = run('--budget-kb=5')
    expect(tooSmall.status).toBe(1)
    expect(tooSmall.output).toContain('over the 5 KB budget')
  })

  it('V6B3-T3: while the gym downloads, Home shows the loading text and the Exercises tab works', async () => {
    vi.stubGlobal('window', { location: { search: '' } })
    const { default: App, LOADING_TEXT } = await import('../App')
    // Rendered without waiting: the gym hasn't arrived, so its stand-in shows
    setTab('home')
    const home = renderToString(createElement(App))
    expect(home).toContain(LOADING_TEXT)
    expect(home).toContain('Exercises') // the tab bar is there
    // Meanwhile the Exercises tab is complete: every Start button is there
    setTab('exercises')
    const list = renderToString(createElement(App))
    expect(list.match(/>Start</g)).toHaveLength(17)
    expect(list).toContain(LOADING_TEXT) // (the gym is still on its way underneath)
  })
})
