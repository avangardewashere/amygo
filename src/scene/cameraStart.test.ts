import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { ROOM } from './dimensions'
import { TARGET, startPosition } from './cameraStart'
import { WALLS, WALL_ART } from './wallDesign'

const FOV = 50 // the app's camera (GymScene.tsx)
const PHONES = [375 / 812, 390 / 844, 360 / 780] // common portrait phone shapes
const LAPTOP = 1280 / 800

// How head-on a painted word is seen from the camera: 1 = straight on,
// 0 = edge-on, below 0 = its wall faces away (and hides in the dollhouse view)
function facing(id: string, camera: Vector3) {
  const art = WALL_ART.find((a) => a.id === id)!
  const wall = WALLS[art.wall]
  const turn = wall.rotationY
  const along = (art.from + art.to) / 2
  const word = new Vector3(wall.position[0] + along * Math.cos(turn), (art.bottom + art.top) / 2, wall.position[2] - along * Math.sin(turn))
  const normal = new Vector3(Math.sin(turn), 0, Math.cos(turn)) // the way the wall faces, into the room
  return normal.dot(camera.clone().sub(word).normalize())
}

// Does every corner of the room land on screen?
function roomFits(aspect: number) {
  const camera = new PerspectiveCamera(FOV, aspect, 0.1, 200)
  camera.position.copy(startPosition(aspect, FOV))
  camera.lookAt(TARGET)
  camera.updateMatrixWorld()
  const { width: W, depth: D, height: H } = ROOM
  return [-1, 1].flatMap((x) => [-1, 1].flatMap((z) => [0, H].map((y) => new Vector3((x * W) / 2, y, (z * D) / 2))))
    .map((corner) => corner.project(camera))
    .every((p) => Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1)
}

describe('the starting camera', () => {
  it('in portrait, the gym name and every zone name face the camera, none worse than 60° off head-on', () => {
    for (const aspect of PHONES) {
      const camera = startPosition(aspect, FOV)
      for (const id of ['gym-name', 'strength', 'free-weights', 'cardio']) {
        expect(facing(id, camera), `${id} at aspect ${aspect.toFixed(2)}`).toBeGreaterThanOrEqual(Math.cos(Math.PI / 3))
      }
    }
  })

  it('in landscape, the back wall words stay readable (unchanged by the portrait fix)', () => {
    const camera = startPosition(LAPTOP, FOV)
    for (const id of ['gym-name', 'strength', 'free-weights']) expect(facing(id, camera), id).toBeGreaterThanOrEqual(0.5)
  })

  it('the whole room still fits the screen, on phones and on a laptop', () => {
    for (const aspect of [...PHONES, LAPTOP]) expect(roomFits(aspect), `aspect ${aspect.toFixed(2)}`).toBe(true)
  })
})
