// Measurements of the adjustable bench, shared by the bench model, the
// person's poses and the tests, so the person's back always lies on the
// backrest. In the bench's own coordinates: you sit facing +z, and the
// backrest hinges up from the back edge of the seat.
import { SEAT_TO_HIP, TORSO_RADIUS } from '../player/proportions'
import { machine } from './machineState'

export const ADJ = {
  seatTop: 0.45, // height of the padded top (seat and flat backrest)
  hingeZ: 0.2, // the seat runs forward from here; the backrest runs back (when flat)
  seatLength: 0.42,
  backLength: 0.8,
  padWidth: 0.3,
  // Backrest angle, measured up from flat (radians)
  angles: { incline: Math.PI / 4, upright: (85 * Math.PI) / 180 },
}


// A point on the backrest's padded surface, `along` meters from the hinge
export const backrestPoint = (angle: number, along: number) => ({
  y: ADJ.seatTop + along * Math.sin(angle),
  z: ADJ.hingeZ - along * Math.cos(angle),
})

// The direction the backrest's surface faces (toward the person sitting on it)
export const backrestFacing = (angle: number) => ({ y: Math.cos(angle), z: Math.sin(angle) })

// The body's lean that matches a backrest angle: upright (π/2) is no lean,
// flat (0) is lying on your back (−π/2)
export const leanFor = (angle: number) => angle - Math.PI / 2

// Where the hips go so the back rests on the backrest: the spine runs parallel
// to the backrest, one torso-thickness in front of it, with the hips just above the seat
export function hipsAgainstBackrest(angle: number) {
  const facing = backrestFacing(angle)
  // A 45 cm seat is high for the person's legs: sit a little higher so the
  // sloping thighs don't tip the seat of the shorts into the pad (see benchGeometry.ts)
  const y = ADJ.seatTop + SEAT_TO_HIP + 0.015
  // The backrest point level with the hips, once pushed out by the torso's thickness
  const along = (y - TORSO_RADIUS * facing.y - ADJ.seatTop) / Math.sin(angle)
  const surface = backrestPoint(angle, along)
  return { y, z: surface.z + TORSO_RADIUS * facing.z }
}

// The angle bench `id`'s backrest should be at right now: the running
// exercise's angle while someone uses it, otherwise flat
export const backrestTarget = (id: string) => (machine.activeId === id ? machine.backrest : 0)
