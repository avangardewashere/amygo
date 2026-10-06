import { useLayoutEffect, useRef } from 'react'
import { Plane, Vector3, type Group } from 'three'
import { CATALOG, type FurnitureType } from './catalog'
import { mergeStaticParts } from './mergeStatic'
import { footprint, startDrag, useBuild, type Furniture } from './buildStore'

// The floor as an infinite flat surface, for working out where the pointer is on it
export const FLOOR = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

const OK_COLOR = '#4ade80'
const BLOCKED_COLOR = '#ef4444'

// A piece's 3D model, with its still parts merged once it has appeared (fewer
// draws; see mergeStatic.ts). Its moving parts keep animating as before.
export function MergedModel({ type, id }: { type: FurnitureType; id: string }) {
  const root = useRef<Group>(null)
  useLayoutEffect(() => mergeStaticParts(root.current!), [type])
  const { Model } = CATALOG[type]
  return (
    <group ref={root}>
      <Model id={id} />
    </group>
  )
}

function FurniturePiece({ item }: { item: Furniture }) {
  const building = useBuild((s) => s.mode === 'build')
  const selected = useBuild((s) => s.selectedId === item.id)
  // null = not being dragged; true/false = dragged onto a free/taken spot
  const dragValid = useBuild((s) => (s.drag?.id === item.id ? s.drag.valid : null))

  const { w, d } = footprint(item)

  return (
    <group position={[item.x, 0, item.z]}>
      <group
        rotation-y={-item.turns * (Math.PI / 2)}
        // Pointer handlers only exist in build mode, so during play taps go
        // straight through to the camera controls
        onPointerDown={
          building
            ? (e) => {
                e.stopPropagation()
                if (e.ray.intersectPlane(FLOOR, hit)) startDrag(item.id, hit.x, hit.z)
              }
            : undefined
        }
        onPointerOver={building ? () => (document.body.style.cursor = 'grab') : undefined}
        onPointerOut={building ? () => (document.body.style.cursor = '') : undefined}
      >
        <MergedModel type={item.type} id={item.id} />
      </group>

      {/* Footprint on the floor: green = free spot, red = overlaps something */}
      {building && (selected || dragValid !== null) && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
          <planeGeometry args={[w + 0.1, d + 0.1]} />
          <meshBasicMaterial
            color={dragValid === false ? BLOCKED_COLOR : OK_COLOR}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}

export function FurnitureLayer() {
  const items = useBuild((s) => s.items)
  return items.map((item) => <FurniturePiece key={item.id} item={item} />)
}
