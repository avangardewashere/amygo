// Every kind of furniture that can be placed in build mode, as plain data:
// its name, floor size, menu details and where you stand to use it. No 3D
// code here (the models are in catalog.ts), so the stores and the app shell
// can use it without loading three.js.
import { MACHINE_NAMES, type MachineType, type StandAt } from '../exercises/catalog'
import {
  ADJ_BENCH_DEPTH,
  ADJ_BENCH_WIDTH,
  BENCH_DEPTH,
  BENCH_WIDTH,
  BIKE_DEPTH,
  BIKE_WIDTH,
  CABLE_DEPTH,
  CABLE_WIDTH,
  CHEST_FLY_DEPTH,
  CHEST_FLY_WIDTH,
  DECK_HEIGHT,
  LEG_PRESS_DEPTH,
  LEG_PRESS_WIDTH,
  PULLUP_DEPTH,
  PULLUP_WIDTH,
  RACK_DEPTH,
  RACK_WIDTH,
  ROWER_DEPTH,
  ROWER_WIDTH,
  SQUAT_RACK_DEPTH,
  SQUAT_RACK_WIDTH,
  TREADMILL_DEPTH,
  TREADMILL_WIDTH,
} from '../equipment/sizes'
import { PRESS } from '../equipment/legPressGeometry'
import { HIP_Y } from '../player/proportions'
import { LYING_HIP, placeHips } from '../equipment/benchGeometry'
import { FLY } from '../equipment/chestFlyGeometry'
import { BIKE } from '../equipment/bikeGeometry'
import { ROWER } from '../equipment/rowerGeometry'
import { SQUAT } from '../equipment/squatGeometry'

// Where the person goes to use a machine they get on (see exercises/catalog.ts).
// Machines without one are used from beside them. (An exercise can override
// this, e.g. sitting on the end of the bench.)
export type { StandAt }
export type FurnitureType = MachineType

type CatalogData = {
  name: string
  width: number // meters along x, before rotating
  depth: number // meters along z, before rotating
  menuSubtitle: string
  tagHeight: number // where its menu floats, in meters
  standAt?: StandAt
}

export const CATALOG_DATA = {
  dumbbellRack: {
    name: MACHINE_NAMES.dumbbellRack,
    width: RACK_WIDTH,
    depth: RACK_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.15,
  },
  treadmill: {
    name: MACHINE_NAMES.treadmill,
    width: TREADMILL_WIDTH,
    depth: TREADMILL_DEPTH,
    menuSubtitle: 'Pick a pace',
    tagHeight: 1.75,
    // On the belt, a little behind its middle
    standAt: { z: -0.15, y: DECK_HEIGHT },
  },
  legPress: {
    name: MACHINE_NAMES.legPress,
    width: LEG_PRESS_WIDTH,
    depth: LEG_PRESS_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.6,
    // Seated: lower the whole body until the hips land on the seat
    standAt: { z: PRESS.hipZ, y: PRESS.hipY - HIP_Y },
  },
  bench: {
    name: MACHINE_NAMES.bench,
    width: BENCH_WIDTH,
    depth: BENCH_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.0,
    // Lying on your back, head toward the -z end
    standAt: placeHips(LYING_HIP),
  },
  chestFly: {
    name: MACHINE_NAMES.chestFly,
    width: CHEST_FLY_WIDTH,
    depth: CHEST_FLY_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.1,
    standAt: placeHips({ y: FLY.hipY, z: FLY.hipZ }),
  },
  bike: {
    name: MACHINE_NAMES.bike,
    width: BIKE_WIDTH,
    depth: BIKE_DEPTH,
    menuSubtitle: 'Pick a pace',
    tagHeight: 1.6,
    // On the saddle
    standAt: placeHips({ y: BIKE.hipY, z: BIKE.hipZ }),
  },
  rower: {
    name: MACHINE_NAMES.rower,
    width: ROWER_WIDTH,
    depth: ROWER_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.3,
    // On the seat, hips at z = 0; the pose slides the body along the rail from there
    standAt: placeHips({ y: ROWER.hipY, z: 0 }),
  },
  adjustableBench: {
    name: MACHINE_NAMES.adjustableBench,
    width: ADJ_BENCH_WIDTH,
    depth: ADJ_BENCH_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 1.0,
    // No standAt here: each exercise sets the backrest, and where you sit against it
  },
  squatRack: {
    name: MACHINE_NAMES.squatRack,
    width: SQUAT_RACK_WIDTH,
    depth: SQUAT_RACK_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.4,
    // Standing on the floor a step back from the hooks, facing the rack
    standAt: { z: SQUAT.standZ, y: 0 },
  },
  cableMachine: {
    name: MACHINE_NAMES.cableMachine,
    width: CABLE_WIDTH,
    depth: CABLE_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.6,
    // No standAt here: pushdowns stand at the tower, rows sit on the seat
  },
  pullupBar: {
    name: MACHINE_NAMES.pullupBar,
    width: PULLUP_WIDTH,
    depth: PULLUP_DEPTH,
    menuSubtitle: 'Pick an exercise',
    tagHeight: 2.75,
  },
} satisfies Record<MachineType, CatalogData>

// Look up any piece's details with the optional fields typed (e.g. standAt)
export const catalogEntry = (type: FurnitureType): CatalogData => CATALOG_DATA[type]
