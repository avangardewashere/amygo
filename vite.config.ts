/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 3D model files are assets (so a test can load one with ?inline)
  assetsInclude: ['**/*.glb'],
  test: {
    // The tests check maths (poses, machine positions, build rules), so they
    // run in plain Node: no browser or screen needed
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
