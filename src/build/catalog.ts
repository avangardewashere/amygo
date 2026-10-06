import type { ComponentType } from 'react'
import { DumbbellRack, RACK_DEPTH, RACK_WIDTH } from '../equipment/DumbbellRack'
import { DECK_HEIGHT, TREADMILL_DEPTH, TREADMILL_WIDTH, Treadmill } from '../equipment/Treadmill'
import { LEG_PRESS_DEPTH, LEG_PRESS_WIDTH, LegPress } from '../equipment/LegPress'
import { PRESS } from '../equipment/legPressGeometry'
import { HIP_Y } from '../player/proportions'
import { BENCH_DEPTH, BENCH_WIDTH, Bench } from '../equipment/Bench'
import { LYING_HIP, placeHips } from '../equipment/benchGeometry'
import { CHEST_FLY_DEPTH, CHEST_FLY_WIDTH, ChestFly } from '../equipment/ChestFly'
import { FLY } from '../equipment/chestFlyGeometry'
import { BIKE_DEPTH, BIKE_WIDTH, Bike } from '../equipment/Bike'
import { BIKE } from '../equipment/bikeGeometry'
import { ROWER_DEPTH, ROWER_WIDTH, Rower } from '../equipment/Rower'
import { ROWER } from '../equipment/rowerGeometry'
import { ADJ_BENCH_DEPTH, ADJ_BENCH_WIDTH, AdjustableBench } from '../equipment/AdjustableBench'
import { SQUAT_RACK_DEPTH, SQUAT_RACK_WIDTH, SquatRack } from '../equipment/SquatRack'
import { SQUAT } from '../equipment/squatGeometry'
import { CABLE_DEPTH, CABLE_WIDTH, CableMachine } from '../equipment/CableMachine'
import { PULLUP_DEPTH, PULLUP_WIDTH, PullupStation } from '../equipment/PullupStation'

// Where the person goes to use a machine they get on (or into), in the
// machine's own coordinates: z along its length, y the height of the
// person's feet-origin. Machines without one are used from beside them.
// (An exercise can override this, e.g. sitting on the end of the bench.)
export type StandAt = { z: number; y: number }

type CatalogEntry = {
  name: string
  width: number // meters along x, before rotating
  depth: number // meters along z, before rotating
  Model: ComponentType<{ id: string }>
  menuSubtitle: string
  tagHeight: number // where its menu floats, in meters
  standAt?: StandAt
}

// Every kind of furniture that can be placed in build mode.
// To add a new piece: make its 3D component, then add an entry here.
// (Which exercises a piece offers lives in EXERCISES in gymStore.ts.)
export const CATALOG = {
  dumbbellRack: {
    name: 'Dumbbell rack',
    width: RACK_WIDTH,
    depth: RACK_DEPTH,
    Model: DumbbellRack,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.15,
  },
  treadmill: {
    name: 'Treadmill',
    width: TREADMILL_WIDTH,
    depth: TREADMILL_DEPTH,
    Model: Treadmill,
    menuSubtitle: 'Pick a pace',
    tagHeight: 1.75,
    // On the belt, a little behind its middle
    standAt: { z: -0.15, y: DECK_HEIGHT },
  },
  legPress: {
    name: 'Leg press',
    width: LEG_PRESS_WIDTH,
    depth: LEG_PRESS_DEPTH,
    Model: LegPress,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.6,
    // Seated: lower the whole body until the hips land on the seat
    standAt: { z: PRESS.hipZ, y: PRESS.hipY - HIP_Y },
  },
  bench: {
    name: 'Bench',
    width: BENCH_WIDTH,
    depth: BENCH_DEPTH,
    Model: Bench,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.0,
    // Lying on your back, head toward the -z end
    standAt: placeHips(LYING_HIP),
  },
  chestFly: {
    name: 'Chest fly machine',
    width: CHEST_FLY_WIDTH,
    depth: CHEST_FLY_DEPTH,
    Model: ChestFly,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.1,
    standAt: placeHips({ y: FLY.hipY, z: FLY.hipZ }),
  },
  bike: {
    name: 'Stationary bike',
    width: BIKE_WIDTH,
    depth: BIKE_DEPTH,
    Model: Bike,
    menuSubtitle: 'Pick a pace',
    tagHeight: 1.6,
    // On the saddle
    standAt: placeHips({ y: BIKE.hipY, z: BIKE.hipZ }),
  },
  rower: {
    name: 'Rowing machine',
    width: ROWER_WIDTH,
    depth: ROWER_DEPTH,
    Model: Rower,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.3,
    // On the seat, hips at z = 0; the pose slides the body along the rail from there
    standAt: placeHips({ y: ROWER.hipY, z: 0 }),
  },
  adjustableBench: {
    name: 'Adjustable bench',
    width: ADJ_BENCH_WIDTH,
    depth: ADJ_BENCH_DEPTH,
    Model: AdjustableBench,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.0,
    // No standAt here: each exercise sets the backrest, and where you sit against it
  },
  squatRack: {
    name: 'Squat rack',
    width: SQUAT_RACK_WIDTH,
    depth: SQUAT_RACK_DEPTH,
    Model: SquatRack,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.4,
    // Standing on the floor a step back from the hooks, facing the rack
    standAt: { z: SQUAT.standZ, y: 0 },
  },
  cableMachine: {
    name: 'Cable machine',
    width: CABLE_WIDTH,
    depth: CABLE_DEPTH,
    Model: CableMachine,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.6,
    // No standAt here: pushdowns stand at the tower, rows sit on the seat
  },
  pullupBar: {
    name: 'Pull-up bar',
    width: PULLUP_WIDTH,
    depth: PULLUP_DEPTH,
    Model: PullupStation,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.75,
  },
} satisfies Record<string, CatalogEntry>

export type FurnitureType = keyof typeof CATALOG

// Look up any piece's details with the optional fields typed (e.g. standAt)
export const catalogEntry = (type: FurnitureType): CatalogEntry => CATALOG[type]
