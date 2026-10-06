import { QUALITY_LEVELS, perfStore } from './quality'

// The ?perf readout: speed, what the scene costs to draw, and the quality level
export function PerfReadout() {
  const { fps, drawCalls, triangles, level } = perfStore.useSelect((s) => s)
  return (
    <div className="perf-readout" aria-live="off">
      <strong>{fps.toFixed(0)} fps</strong>
      <span>{drawCalls} draws</span>
      <span>{(triangles / 1000).toFixed(1)}k triangles</span>
      <span>Quality: {QUALITY_LEVELS[level].name}</span>
    </div>
  )
}
