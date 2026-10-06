import { FloorProps } from './FloorProps'
import { WallProps } from './WallProps'

// Everything that makes the gym feel used: decoration only (D7), no menus,
// not movable. Floor props are solid (see propObstacles in propLayout.ts).
export function Props() {
  return (
    <>
      <FloorProps />
      <WallProps />
    </>
  )
}
