// Where the camera starts: pure maths (no React), so tests can check what it sees
import { MathUtils, Vector3 } from 'three'
import { ROOM } from './dimensions'

// The point the camera looks at: middle of the room, a bit above the floor
export const TARGET = new Vector3(0, ROOM.height / 3, 0)

// Radius of an imaginary ball around TARGET that just wraps the whole room.
// TARGET sits a third of the way up, so the ceiling corners are further from
// it than the floor corners: measure to those (measuring from the room's
// middle height left the ceiling corners ~15 cm outside the ball).
const ROOM_RADIUS = Math.hypot(ROOM.width / 2, ROOM.depth / 2, Math.max(TARGET.y, ROOM.height - TARGET.y))

// Landscape: look from the long side, so the room's length runs across the screen.
// Portrait: look from the front-left corner. Walls between the camera and the
// room hide themselves (the dollhouse view), so the corner matters: from here
// the back wall (AMYGO, STRENGTH, FREE WEIGHTS) and the right wall (CARDIO, the
// TVs) both face the camera at about 50° from head-on. Only the left wall (the
// motto) hides. The old view from the right end hid CARDIO and saw the back
// wall nearly edge-on.
const LANDSCAPE_DIRECTION = new Vector3(14, 11, 16).normalize()
export const PORTRAIT_DIRECTION = new Vector3(-14, 16, 14).normalize()

// How far back the camera must be for that ball to fit the screen.
// The camera's fov is vertical; a narrow (portrait) screen sees less sideways,
// so we work out the horizontal angle too and fit to whichever is tighter.
function fitDistance(fov: number, aspect: number) {
  const vHalf = MathUtils.degToRad(fov / 2)
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  return ROOM_RADIUS / Math.sin(Math.min(vHalf, hHalf))
}

// Where the camera starts for a screen of this shape (width / height) and
// vertical field of view (degrees). Pure, so tests can check what it sees.
export function startPosition(aspect: number, fov: number) {
  const direction = aspect < 1 ? PORTRAIT_DIRECTION : LANDSCAPE_DIRECTION
  return TARGET.clone().addScaledVector(direction, fitDistance(fov, aspect))
}
