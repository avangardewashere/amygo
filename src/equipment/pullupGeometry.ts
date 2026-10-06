// Measurements of the pull-up station and the pull-up, shared by the station
// model, the person's pose and the tests, so the hands stay on the bar while
// the body rises under it. In the station's own coordinates: the tower stands
// at the +z end, the bar reaches out from it, and you hang facing it (+z).
import { ELBOW_DROP, HAND_DROP, HEAD_RADIUS, HEAD_Y, HIP_Y, SHOULDER_X, SHOULDER_Y } from '../player/proportions'

export const PULLUP = {
  bar: { y: 2.35, z: -0.15 },
  barRadius: 0.017,
  towerZ: 0.35, // the two uprights
  towerX: 0.6,
  gripX: 0.4, // each hand, out from the middle (a little wider than the shoulders)
  standZ: -0.33, // where you stand (and hang): the bar is just in front of your face
  leanTop: -0.12, // at the top the body tips back a touch, so the head clears the bar
  // Feet relative to the hips while hanging: legs down, knees slightly bent
  feet: { y: -0.8, z: -0.12 },
  chinClearance: 0.03, // at the top, the chin goes this far above the bar
}

// Hands, measured from the shoulders: out to the grip, up to the bar, forward to it
const reachOut = PULLUP.gripX - SHOULDER_X
const reachForward = PULLUP.bar.z - PULLUP.standZ
// Dead hang: arms straight (1 cm short, so the elbows aren't locked), shoulders right under the bar
const hangDrop = Math.sqrt((ELBOW_DROP + HAND_DROP - 0.01) ** 2 - reachOut ** 2 - reachForward ** 2)
// How far the whole body is lifted off the floor at the bottom and the top of a rep
export const HANG_RISE = PULLUP.bar.y - hangDrop - SHOULDER_Y
// At the top the chin clears the bar (leaning back pivots at the hips and lowers the head a
// little; allow for it)
export const TOP_RISE =
  PULLUP.bar.y + PULLUP.chinClearance - (HEAD_Y - HEAD_RADIUS) + (HEAD_Y - HIP_Y) * (1 - Math.cos(PULLUP.leanTop))

const mix = (a: number, b: number, t: number) => a + (b - a) * t

// The body at t (0 = hanging with straight arms, 1 = chin over the bar)
export const pullupPosition = (t: number) => ({
  rise: mix(HANG_RISE, TOP_RISE, t),
  lean: mix(0, PULLUP.leanTop, t),
})
