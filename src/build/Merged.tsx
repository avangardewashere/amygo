import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import { mergeStaticParts } from './mergeStatic'

// Everything inside, with its still parts merged once it has appeared (fewer
// draws; see mergeStatic.ts). Parts marked userData={{ moving: true }} keep
// moving. The children must not change after they first appear.
export function Merged({ children }: { children: ReactNode }) {
  const root = useRef<Group>(null)
  useLayoutEffect(() => mergeStaticParts(root.current!), [])
  return <group ref={root}>{children}</group>
}
