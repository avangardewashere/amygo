// Which machine is in use right now, so its moving parts can animate
// (the treadmill belt, the leg press sled, the bike's pedals, the
// adjustable bench's backrest). Written when an
// exercise starts or stops, read by the machine models every frame. Kept in
// its own tiny file so models don't import the game state (that would make
// the imports go round in a circle).
import type { ExerciseKind } from '../exercises/catalog'

export const machine = {
  activeId: null as string | null,
  exercise: null as ExerciseKind | null, // which exercise (the cable machine has two pulleys)
  speed: 0, // treadmill belt speed, m/s
  cadence: 0, // bike pedal turns per second
  startedAt: 0, // when the exercise (or its current pace) started (for rep and pedal timing)
  crankOffset: 0, // bike: how far the pedals had turned before the current pace (radians)
  backrest: 0, // adjustable bench: backrest angle up from flat, radians
}
