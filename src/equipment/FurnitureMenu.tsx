import { Html, Line } from '@react-three/drei'
import { COLORS } from '../scene/dimensions'
import { CATALOG } from '../build/catalog'
import { footprint, useBuild } from '../build/buildStore'
import { ItemMenu } from '../interaction/ItemMenu'
import { menuActions, useGym } from '../interaction/gymStore'

// When the person is close to usable furniture (rack, treadmill…): an orange
// outline on the floor around it, and a tag that opens its exercise menu.
export function FurnitureMenu() {
  const nearId = useGym((s) => s.nearFurnitureId)
  const holding = useGym((s) => s.holding)
  const activity = useGym((s) => s.activity)
  const building = useBuild((s) => s.mode === 'build')
  const item = useBuild((s) => s.items.find((piece) => piece.id === nearId))

  // Mid-exercise the bubble over the person has the Stop button; hide this to cut clutter
  if (!item || building || activity) return null

  const info = CATALOG[item.type]
  const { w, d } = footprint(item)
  const x = w / 2 + 0.08
  const z = d / 2 + 0.08

  return (
    <group position={[item.x, 0, item.z]}>
      <Line
        points={[
          [-x, 0.01, -z],
          [x, 0.01, -z],
          [x, 0.01, z],
          [-x, 0.01, z],
          [-x, 0.01, -z],
        ]}
        color={COLORS.accent}
        lineWidth={3}
      />
      <Html position={[0, info.tagHeight, 0]} zIndexRange={[20, 0]}>
        <div className="item-anchor">
          <ItemMenu
            id="furniture"
            title={info.name}
            subtitle={info.menuSubtitle}
            actions={menuActions('furniture', { holding, activity }, item.type)}
            note="Put your dumbbell down first"
          />
        </div>
      </Html>
    </group>
  )
}
