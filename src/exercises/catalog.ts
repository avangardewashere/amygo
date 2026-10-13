// Every machine and exercise in the gym: names, which machine offers each
// exercise, the words shown while doing it, and its settings. No 3D code is
// imported here (only measurements, which are plain numbers), so the
// Exercises list can load before three.js does. The gym store and the
// in-gym menus read from this same table, so they can never disagree.
import { SEATED_HIP, placeHips } from '../equipment/benchGeometry'
import { BIKE } from '../equipment/bikeGeometry'
import { ROWER } from '../equipment/rowerGeometry'
import { ADJ, hipsAgainstBackrest } from '../equipment/adjustableBenchGeometry'
import { CABLE } from '../equipment/cableGeometry'
import { PULLUP } from '../equipment/pullupGeometry'

// Every kind of machine, in the order the Exercises list shows them
export const MACHINE_NAMES = {
  dumbbellRack: 'Dumbbell rack',
  treadmill: 'Treadmill',
  bike: 'Stationary bike',
  rower: 'Rowing machine',
  legPress: 'Leg press',
  bench: 'Bench',
  adjustableBench: 'Adjustable bench',
  chestFly: 'Chest fly machine',
  squatRack: 'Squat rack',
  cableMachine: 'Cable machine',
  pullupBar: 'Pull-up bar',
} as const
export type MachineType = keyof typeof MACHINE_NAMES

// Where the person goes to use a machine they get on (or into), in the
// machine's own coordinates: z along its length, y the height of the
// person's feet-origin
export type StandAt = { z: number; y: number }

export type ExerciseKind =
  | 'curl'
  | 'lateral'
  | 'walk'
  | 'run'
  | 'legPress'
  | 'benchPress'
  | 'shoulderPress'
  | 'chestFly'
  | 'ride'
  | 'sprint'
  | 'row'
  | 'inclinePress'
  | 'seatedCurl'
  | 'squat'
  | 'pushdown'
  | 'cableRow'
  | 'pullup'

// The weight an exercise is done with (decision D6), with the real increments
// of each piece of kit: what the number means, its steps, and its range in kg
export type Load = { of: 'dumbbell' | 'stack' | 'bar'; step: number; min: number; max: number }
const DUMBBELLS: Load = { of: 'dumbbell', step: 1, min: 1, max: 50 } // each dumbbell
const STACK: Load = { of: 'stack', step: 5, min: 5, max: 200 } // the pin in a machine's weight stack
const BAR: Load = { of: 'bar', step: 2.5, min: 20, max: 300 } // the bar with its plates

type Exercise = {
  machine: MachineType // which machine offers it
  name: string // label in the menu
  doing: string // headline in the popup while doing it
  speed?: number // m/s: treadmill belt speed, or how fast you'd be cycling
  stride?: number // treadmill: how hard the legs work (1 = normal walk)
  cadence?: number // bike: pedal turns per second
  strokes?: boolean // rower: count strokes and show a pace per 500 m
  backrest?: number // adjustable bench: backrest angle up from flat (radians)
  // Dumbbells in both hands, and how they're held: bar side to side ('across')
  // or pointing ahead ('forward')
  weights?: 'across' | 'forward'
  // The weight picked before Start. None for cardio, or for pull-ups (bodyweight).
  load?: Load
  standAt?: StandAt // overrides where the machine puts you
}

export const EXERCISES: Record<ExerciseKind, Exercise> = {
  curl: { machine: 'dumbbellRack', name: 'Bicep curls', doing: 'Doing bicep curls', weights: 'across', load: DUMBBELLS },
  lateral: {
    machine: 'dumbbellRack',
    name: 'Lateral raises (side fly)',
    doing: 'Doing lateral raises',
    weights: 'forward',
    load: DUMBBELLS,
  },
  walk: { machine: 'treadmill', name: 'Walk', doing: 'Walking', speed: 1.5, stride: 0.8 },
  run: { machine: 'treadmill', name: 'Run', doing: 'Running', speed: 3, stride: 1.5 },
  legPress: { machine: 'legPress', name: 'Leg press', doing: 'Doing leg presses', load: STACK },
  benchPress: {
    machine: 'bench',
    name: 'Dumbbell bench press',
    doing: 'Doing bench presses',
    weights: 'across',
    load: DUMBBELLS,
  },
  shoulderPress: {
    machine: 'bench',
    name: 'Seated shoulder press',
    doing: 'Doing shoulder presses',
    weights: 'across',
    load: DUMBBELLS,
    standAt: placeHips(SEATED_HIP), // sitting on the end of the bench instead of lying
  },
  chestFly: { machine: 'chestFly', name: 'Chest fly', doing: 'Doing chest flies', load: STACK },
  ride: { machine: 'bike', name: 'Easy ride', doing: 'Cycling', speed: 20 / 3.6, cadence: BIKE.cadence.easy },
  sprint: { machine: 'bike', name: 'Sprint', doing: 'Sprinting', speed: 32 / 3.6, cadence: BIKE.cadence.sprint },
  row: { machine: 'rower', name: 'Row', doing: 'Rowing', speed: ROWER.speed, strokes: true },
  inclinePress: {
    machine: 'adjustableBench',
    name: 'Incline dumbbell press',
    doing: 'Doing incline presses',
    weights: 'across',
    load: DUMBBELLS,
    backrest: ADJ.angles.incline,
    standAt: placeHips(hipsAgainstBackrest(ADJ.angles.incline)),
  },
  seatedCurl: {
    machine: 'adjustableBench',
    name: 'Seated curls',
    doing: 'Doing seated curls',
    weights: 'across',
    load: DUMBBELLS,
    backrest: ADJ.angles.upright,
    standAt: placeHips(hipsAgainstBackrest(ADJ.angles.upright)),
  },
  squat: { machine: 'squatRack', name: 'Back squat', doing: 'Doing back squats', load: BAR },
  pushdown: {
    machine: 'cableMachine',
    name: 'Tricep pushdowns',
    doing: 'Doing tricep pushdowns',
    load: STACK,
    standAt: { z: CABLE.pushdown.standZ, y: 0 }, // standing at the tower
  },
  cableRow: {
    machine: 'cableMachine',
    name: 'Cable rows',
    doing: 'Doing cable rows',
    load: STACK,
    standAt: placeHips({ y: CABLE.row.hipY, z: CABLE.row.hipZ }), // on the low seat
  },
  pullup: {
    machine: 'pullupBar',
    name: 'Pull-ups',
    doing: 'Doing pull-ups',
    standAt: { z: PULLUP.standZ, y: 0 }, // under the bar; the pose lifts you off the floor
  },
}
