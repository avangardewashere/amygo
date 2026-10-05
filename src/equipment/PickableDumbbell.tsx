import { Html } from '@react-three/drei'
import { Dumbbell, DumbbellModel } from './Dumbbell'
import { COLORS } from '../scene/dimensions'
import { ItemMenu } from '../interaction/ItemMenu'
import { menuActions, openMenu, useGym } from '../interaction/gymStore'
import { useBuild } from '../build/buildStore'

// <Html> places normal web elements at a 3D point. The .item-anchor wrapper
// shifts the menu so it sits above that point and grows upward, never over the item.
function DumbbellMenu({ height }: { height: number }) {
  const building = useBuild((s) => s.mode === 'build')
  const holding = useGym((s) => s.holding)
  const activity = useGym((s) => s.activity)
  if (building) return null // items can't be used while arranging furniture
  return (
    <Html position={[0, height, 0]} zIndexRange={[20, 0]}>
      <div className="item-anchor">
        <ItemMenu
          id="dumbbell"
          title="Dumbbell"
          subtitle="10 kg"
          actions={menuActions('dumbbell', { holding, activity })}
        />
      </div>
    </Html>
  )
}

// The dumbbell while it's on the floor. Hidden while the person carries it.
export function FloorDumbbell() {
  const holding = useGym((s) => s.holding)
  const near = useGym((s) => s.near)
  const spot = useGym((s) => s.dumbbell)
  const building = useBuild((s) => s.mode === 'build')

  if (holding) return null

  return (
    <group position={[spot.x, 0, spot.z]}>
      <Dumbbell
        rotation-y={spot.rotationY}
        // Tapping the dumbbell itself also opens the menu (only works when close)
        onClick={(e) => {
          e.stopPropagation()
          openMenu('dumbbell')
        }}
      />

      {near && !building && (
        <>
          {/* Glowing ring on the floor: "you can use this" */}
          <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
            <ringGeometry args={[0.3, 0.36, 48]} />
            <meshBasicMaterial color={COLORS.accent} transparent opacity={0.85} />
          </mesh>
          <DumbbellMenu height={0.25} />
        </>
      )}
    </group>
  )
}

// A dumbbell gripped in a hand. <Person> places hand items at the end of the
// forearm. "forward": bar points ahead, like carrying a bag (also used for
// lateral raises). "across": bar runs side to side, palm up, for curls.
export function HandDumbbell({ grip, scale = 1 }: { grip: 'forward' | 'across'; scale?: number }) {
  return (
    <DumbbellModel scale={scale} position-y={-0.02} rotation-y={grip === 'forward' ? Math.PI / 2 : 0} />
  )
}

// While carrying, the menu floats above the person's head instead of at the
// swinging hand, so it stays steady and doesn't cover them.
export function HeldDumbbellMenu() {
  return <DumbbellMenu height={2.05} />
}
