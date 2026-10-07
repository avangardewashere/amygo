/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { offlineVersion, precacheList } from './src/offline/precache.ts'

// The escape hatch (v8 Block 2): true sends out a worker that deletes Amygo's
// offline copy and removes itself, in place of the real one. Only if phones get
// stuck on an old version, for one deploy, with its own OK to push.
const REMOVE_OFFLINE_COPY = false

// Every file in a folder, as paths inside it with "/" between folders
function filesIn(folder: string, inside = ''): string[] {
  return readdirSync(join(folder, inside), { withFileTypes: true }).flatMap((entry) => {
    const path = inside ? `${inside}/${entry.name}` : entry.name
    return entry.isDirectory() ? filesIn(folder, path) : [path]
  })
}

// Writes the offline worker (sw.js) into the build, with the list of files to
// keep and their version in front of it. It runs once the bundle is written
// (writeBundle; Vite copies public/ at the start of writing, so it's all there),
// and only after a build that worked: a failed build shows its own error, not ours.
function offline(): Plugin {
  let root = '.'
  let outDir = 'dist'
  return {
    name: 'amygo-offline',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      const list = precacheList(filesIn(outDir))
      const kept = list.map((path) => ({ path, content: readFileSync(join(outDir, path === '/' ? 'index.html' : path.slice(1))) }))
      const version = offlineVersion(kept, (parts) => {
        const hash = createHash('sha256')
        for (const part of parts) hash.update(part)
        return hash.digest('hex')
      })
      const worker = readFileSync(resolve(root, REMOVE_OFFLINE_COPY ? 'src/offline/sw-remove.js' : 'src/offline/sw.js'), 'utf8')
      writeFileSync(join(outDir, 'sw.js'), `const PRECACHE = ${JSON.stringify(list)}\nconst VERSION = '${version}'\n\n${worker}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offline()],
  // 3D model files are assets (so a test can load one with ?inline)
  assetsInclude: ['**/*.glb'],
  build: {
    rollupOptions: {
      output: {
        // Libraries get files of their own, so the app's own code (the entry
        // file) can be measured by itself, and three.js only arrives with the gym
        manualChunks(id) {
          if (/node_modules[\\/](three|@react-three)[\\/]/.test(id)) return 'three'
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
        },
      },
    },
  },
  test: {
    // The tests check maths (poses, machine positions, build rules), so they
    // run in plain Node: no browser or screen needed
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
