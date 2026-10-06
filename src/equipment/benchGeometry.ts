// Measurements of the bench, shared by the bench model and the person's
// poses. In the bench's own coordinates: it runs along z, and you face +z.
import { HIP_Y, TORSO_RADIUS } from '../player/proportions'

export const BENCH = {
  topY: 0.45, // height of the padded top
  length: 1.2,
  padWidth: 0.3,
}

// Lying on your back (bench press): the hips rest on top of the pad, raised by
// half the body's thickness, toward the foot end so the head stays on the bench
export const LYING_HIP = { y: BENCH.topY + TORSO_RADIUS, z: 0.3 }

// Lying on the bench, the legs straddle it like a real lifter's: each foot is
// planted this far out from its hip (sideways) and forward, on the floor
// beside the bench, so no leg rests on the pad
export const STRADDLE = { out: 0.25, forward: 0.15 }

// Sitting upright on the foot end (shoulder press)
export const SEATED_HIP = { y: BENCH.topY + 0.05, z: 0.42 }

// Where the person's feet-origin goes so their hips land on a given spot
export const placeHips = (hip: { y: number; z: number }) => ({ z: hip.z, y: hip.y - HIP_Y })
