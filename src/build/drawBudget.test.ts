import { afterEach, describe, expect, it, vi } from 'vitest'
import { Matrix4, type Mesh, type Object3D } from 'three'
import { drawCount, renderScene, shown } from '../test/renderScene'
import { FurnitureLayer, MergedModel } from './Furniture'
import { MODELS, type FurnitureType } from './catalog'
import { MERGED_NAME, mergeStaticParts } from './mergeStatic'
import { machine } from '../equipment/machineState'
import { EXERCISES, type ExerciseKind } from '../interaction/gymStore'

// Building the scene takes ~1 s; give it room when the laptop is busy (it timed out at the 5 s default)
const SCENE_TIMEOUT = 20_000

// D4: the measured furniture cost after this block, plus 30 % headroom for L2
export const FURNITURE_DRAW_BUDGET = 684 // 526 measured 2026-10-07 (1,295 before merging)

afterEach(() => {
  vi.restoreAllMocks()
  machine.activeId = null
})

const meshes = (root: Object3D) => {
  const found: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh)
  })
  return found
}
const triangles = (list: Mesh[]) =>
  list.reduce((sum, mesh) => sum + (mesh.geometry.index ?? mesh.geometry.attributes.position).count / 3, 0)

describe('drawing fewer things', () => {
  it('L1B3-T1: the default gym furniture stays under the draw budget', async () => {
    const { scene, unmount } = await renderScene(FurnitureLayer, {})
    const draws = drawCount(scene)
    expect(draws).toBeLessThanOrEqual(FURNITURE_DRAW_BUDGET)
    await unmount()
  }, SCENE_TIMEOUT)
  it('L1B3-T2: merging keeps every still part: same triangles, fewer draws', async () => {
    for (const type of Object.keys(MODELS) as FurnitureType[]) {
      const Model = MODELS[type]
      const { scene, unmount } = await renderScene(Model, { id: 'm' })
      const before = drawCount(scene)
      const undo = mergeStaticParts(scene)
      const all = meshes(scene)
      const merged = all.filter((mesh) => mesh.name === MERGED_NAME)
      const hidden = all.filter((mesh) => !mesh.visible)
      expect(triangles(merged), type).toBe(triangles(hidden)) // nothing lost, nothing doubled
      expect(drawCount(scene), type).toBeLessThan(before)
      undo()
      expect(drawCount(scene), `${type} after undo`).toBe(before)
      await unmount()
    }
  }, SCENE_TIMEOUT)
  it('L1B3-T3: no merged part ever moves, on any machine, during any exercise', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    for (const kind of Object.keys(EXERCISES) as ExerciseKind[]) {
      const exercise = EXERCISES[kind]
      const { scene, frame, unmount } = await renderScene(MergedModel, { type: exercise.machine, id: 'm' })
      Object.assign(machine, {
        activeId: 'm',
        exercise: kind,
        speed: exercise.speed ?? 0,
        cadence: exercise.cadence ?? 0,
        backrest: exercise.backrest ?? 0,
        crankOffset: 0,
        startedAt: 0,
      })
      // Hidden originals stand for merged parts: record where each one is…
      const hidden = meshes(scene).filter((mesh) => !shown(mesh) && mesh.name !== MERGED_NAME)
      const start = new Map(hidden.map((mesh) => [mesh, mesh.matrixWorld.clone()]))
      // …run the exercise for 4 s…
      for (let t = 0; t <= 4; t += 0.05) {
        now = t * 1000
        frame(t)
        scene.updateMatrixWorld(true)
      }
      // …and none of them may have moved (its merged copy can't follow)
      const moved = hidden.filter((mesh) => !mesh.matrixWorld.equals(start.get(mesh) as Matrix4))
      expect(moved.map((mesh) => mesh.parent?.type), `${kind}: merged parts that moved`).toEqual([])
      await unmount()
      machine.activeId = null
    }
  }, SCENE_TIMEOUT)
})
