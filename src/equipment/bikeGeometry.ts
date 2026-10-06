// Measurements of the stationary bike, shared by the bike model, the person's
// pose and the tests, so feet stay on the pedals and hands on the handlebars.
// In the bike's own coordinates: you sit facing +z.
import { HIP_X } from '../player/proportions'
import { machine } from './machineState'

export const BIKE = {
  hipY: 0.9, // where the hips sit on the saddle
  hipZ: -0.25,
  crankY: 0.32, // middle of the pedal circle
  crankZ: 0,
  crankLength: 0.17, // pedal circle radius
  pedalX: HIP_X, // each pedal, out from the middle: in line with the hips
  crankArmX: 0.065, // each crank arm, just outside the crank housing
  footAbovePedal: 0.05, // middle of the shoe sits this far above the pedal
  bar: { y: 1.1, z: 0.38, halfWidth: 0.25 }, // handlebar grips
  // How far the rider leans forward (radians) and pedals (turns per second)
  lean: { easy: 0.35, sprint: 0.55 },
  cadence: { easy: 1.2, sprint: 1.7 }, // 72 and 102 rpm
}

// The crank's angle after pedalling for `seconds` at `cadence` turns per second.
// 0 = left pedal at the bottom.
export const crankAngle = (cadence: number, seconds: number) => 2 * Math.PI * cadence * seconds

// The pedals' angle on the bike in use right now, carried on across pace changes
// (the same angle the rider's crankSoFar() gives)
export const machineCrank = (now = performance.now()) =>
  machine.crankOffset + crankAngle(machine.cadence, (now - machine.startedAt) / 1000)

// A point on the pedal circle, `angle` round from the bottom. Pedalling forward
// goes bottom → back → top → front, which (from the side, z forward, y up) is
// (−sin, −cos). This matches turning the crank arm by +angle around x.
function onCircle(angle: number) {
  return {
    y: BIKE.crankY - Math.cos(angle) * BIKE.crankLength,
    z: BIKE.crankZ - Math.sin(angle) * BIKE.crankLength,
  }
}

// Where each pedal is. side: +1 left, −1 right; the right pedal is always
// half a turn round from the left.
export function pedalPosition(side: number, angle: number) {
  return onCircle(angle + (side === 1 ? 0 : Math.PI))
}

// Where the middle of each shoe goes: just above its pedal
export function footOnPedal(side: number, angle: number) {
  const pedal = pedalPosition(side, angle)
  return { y: pedal.y + BIKE.footAbovePedal, z: pedal.z }
}
