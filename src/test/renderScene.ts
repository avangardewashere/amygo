// Tests only: build a piece of the 3D scene in Node, without a browser or a
// graphics chip, so tests can count and inspect what would be drawn.
// R3F does all its usual work (creating meshes, running useFrame); only the
// final "draw it on screen" step goes to a stand-in that does nothing.
import { createElement, type ComponentType } from 'react'
import { act, createRoot, extend } from '@react-three/fiber'
import * as THREE from 'three'
import type { Object3D } from 'three'

extend(THREE as never) // outside <Canvas>, R3F has to be told about three's classes

const noop = () => {}
const canvas = { style: {}, width: 100, height: 100, addEventListener: noop, removeEventListener: noop, getContext: () => null }
const renderer = {
  domElement: canvas,
  xr: { enabled: false, addEventListener: noop, removeEventListener: noop, setAnimationLoop: noop },
  shadowMap: {},
  info: {},
  setPixelRatio: noop,
  setSize: noop,
  setAnimationLoop: noop,
  render: noop,
  dispose: noop,
}

export async function renderScene<P extends object>(component: ComponentType<P>, props: P) {
  const root = createRoot(canvas as unknown as HTMLCanvasElement)
  await root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 } })
  let store!: ReturnType<typeof root.render>
  await act(async () => {
    store = root.render(createElement(component, props))
  })
  const scene = store.getState().scene
  return {
    scene,
    // Run one frame at `seconds` (every useFrame runs, with the right delta)
    frame: (seconds: number) => store.getState().advance(seconds),
    unmount: () => act(async () => root.unmount()),
  }
}

// Is this object actually drawn (it and all its parents visible)?
export function shown(object: Object3D) {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

// What the scene costs to draw: one draw per shown mesh, plus one more for
// each that casts a shadow (the shadow pass draws it again)
export function drawCount(scene: Object3D) {
  let draws = 0
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !shown(mesh)) return
    draws += mesh.castShadow ? 2 : 1
  })
  return draws
}
