// The 3D model for each kind of furniture. Everything else about a piece
// (name, size, menu) is plain data in catalogData.ts.
// To add a new piece: make its 3D component, add it here, and add its data there.
import type { ComponentType } from 'react'
import { DumbbellRack } from '../equipment/DumbbellRack'
import { Treadmill } from '../equipment/Treadmill'
import { LegPress } from '../equipment/LegPress'
import { Bench } from '../equipment/Bench'
import { ChestFly } from '../equipment/ChestFly'
import { Bike } from '../equipment/Bike'
import { Rower } from '../equipment/Rower'
import { AdjustableBench } from '../equipment/AdjustableBench'
import { SquatRack } from '../equipment/SquatRack'
import { CableMachine } from '../equipment/CableMachine'
import { PullupStation } from '../equipment/PullupStation'
import type { FurnitureType } from './catalogData'

export type { FurnitureType, StandAt } from './catalogData'

export const MODELS: Record<FurnitureType, ComponentType<{ id: string }>> = {
  dumbbellRack: DumbbellRack,
  treadmill: Treadmill,
  legPress: LegPress,
  bench: Bench,
  chestFly: ChestFly,
  bike: Bike,
  rower: Rower,
  adjustableBench: AdjustableBench,
  squatRack: SquatRack,
  cableMachine: CableMachine,
  pullupBar: PullupStation,
}
