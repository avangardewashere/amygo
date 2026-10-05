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
} satisfies Record<string, CatalogEntry>

export type FurnitureType = keyof typeof CATALOG

// Look up any piece's details with the optional fields typed (e.g. standAt)
export const catalogEntry = (type: FurnitureType): CatalogEntry => CATALOG[type]
