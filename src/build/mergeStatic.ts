// Drawing fewer things. Every box in a machine is its own "draw call" (one
// request to the graphics chip), twice over when it casts a shadow, and a
// treadmill alone is ~23 boxes. Most of a machine never moves, so after it
// appears, its still parts are merged into one shape per material: same look,
// a handful of draws instead of dozens.
//
// Parts that move are marked in the model with userData={{ moving: true }};
// they and everything inside them are left alone. The original parts stay in
// the scene but hidden, so build-mode clicks still find them.
import { Matrix4, Mesh, type BufferGeometry, type Material, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const MERGED_NAME = 'merged-static'

const isMoving = (object: Object3D) => object.userData.moving === true

// Meshes with the same material look (and shadow settings) can become one
function lookKey(mesh: Mesh) {
  const m = mesh.material as Material & Record<string, unknown>
  const hex = (value: unknown) => (value && typeof value === 'object' && 'getHex' in value ? (value as { getHex(): number }).getHex() : null)
  return JSON.stringify([
    m.type,
    hex(m.color),
    hex(m.emissive),
    m.emissiveIntensity,
    m.metalness,
    m.roughness,
    m.opacity,
    m.transparent,
    m.side,
    m.toneMapped,
    mesh.castShadow,
    mesh.receiveShadow,
  ])
}

// The still meshes worth merging: not inside a moving part, a single
// untextured material (merging drops texture coordinates), and not mirrored
// (a mirrored copy would turn inside out)
function stillMeshes(root: Object3D) {
  const found: Mesh[] = []
  const visit = (object: Object3D) => {
    if (isMoving(object) || !object.visible || object.name === MERGED_NAME) return
    const mesh = object as Mesh
    if (mesh.isMesh && !Array.isArray(mesh.material) && !('isInstancedMesh' in mesh) && !('map' in mesh.material && mesh.material.map)) {
      found.push(mesh)
    }
    object.children.forEach(visit)
  }
  root.children.forEach(visit)
  return found
}

// A copy of the part's shape, placed where it sits inside `root`
function placedCopy(mesh: Mesh, toRoot: Matrix4): BufferGeometry {
  const geometry = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(toRoot)
  // Shapes can only be merged if they carry the same kinds of data
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
  }
  geometry.clearGroups()
  return geometry
}

// Merge `root`'s still parts. Returns a function that undoes it.
export function mergeStaticParts(root: Object3D): () => void {
  root.updateWorldMatrix(true, true)
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert()

  const groups = new Map<string, Mesh[]>()
  for (const mesh of stillMeshes(root)) {
    const toRoot = new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld)
    if (toRoot.determinant() < 0 || !mesh.geometry.attributes.normal) continue
    const key = lookKey(mesh)
    groups.set(key, [...(groups.get(key) ?? []), mesh])
  }

  const added: Mesh[] = []
  const hidden: Mesh[] = []
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue // nothing to gain from merging one
    const copies = meshes.map((mesh) => placedCopy(mesh, new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld)))
    const geometry = mergeGeometries(copies)
    copies.forEach((copy) => copy.dispose())
    if (!geometry) continue
    const merged = new Mesh(geometry, meshes[0].material)
    merged.name = MERGED_NAME
    merged.castShadow = meshes[0].castShadow
    merged.receiveShadow = meshes[0].receiveShadow
    // Clicks go to the hidden originals (build mode); the merged copy is only for looks
    merged.raycast = () => {}
    root.add(merged)
    added.push(merged)
    for (const mesh of meshes) {
      mesh.visible = false
      hidden.push(mesh)
    }
  }

  return () => {
    for (const merged of added) {
      root.remove(merged)
      merged.geometry.dispose()
    }
    for (const mesh of hidden) mesh.visible = true
  }
}
