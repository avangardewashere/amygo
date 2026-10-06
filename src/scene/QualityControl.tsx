import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Material, Mesh } from 'three'
import { QUALITY_LEVELS, createFpsWatch, perfStore } from './quality'

const REPORT_SECONDS = 0.5 // how often the readout's numbers update

// Lives inside the 3D scene: times every frame, steps quality down when the
// gym stays slow (see quality.ts), and reports numbers for the ?perf readout.
// Shadows are switched on and off by <GymScene> (the Canvas setting), and their
// detail by <Lighting>, which owns the shadow light.
export function QualityControl() {
  const watch = useMemo(() => createFpsWatch(), [])
  const level = perfStore.useSelect((s) => s.level)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const setDpr = useThree((s) => s.setDpr)
  const sinceReport = useRef(0)

  useFrame((_, delta) => {
    if (watch.frame(delta)) perfStore.set({ level: watch.level })
    sinceReport.current += delta
    if (sinceReport.current >= REPORT_SECONDS) {
      sinceReport.current = 0
      // What the last frame cost the graphics chip: how many separate draws, and triangles
      const { calls, triangles } = gl.info.render
      perfStore.set({ fps: watch.fps, drawCalls: calls, triangles })
    }
  })

  // Apply a quality level's screen sharpness
  const { dpr, shadowMap } = QUALITY_LEVELS[level]
  useEffect(() => setDpr(Math.min(dpr, window.devicePixelRatio)), [dpr, setDpr])

  // Materials are built for shadows on or off, so they're rebuilt when that changes
  const shadows = shadowMap > 0
  useEffect(() => {
    scene.traverse((object) => {
      const material = (object as Mesh).material as Material | Material[] | undefined
      for (const each of Array.isArray(material) ? material : material ? [material] : []) each.needsUpdate = true
    })
  }, [shadows, scene])

  return null
}
