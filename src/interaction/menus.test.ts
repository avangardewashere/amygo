import { describe, expect, it } from 'vitest'
import { menuActions } from './gymStore'
import type { FurnitureType } from '../build/catalog'

const free = { holding: false, activity: null }
const labels = (type: FurnitureType) => menuActions('furniture', free, type).map((action) => action.label)

describe('machine menus', () => {
  it('B0-T6a: each machine offers exactly its own exercises', () => {
    expect(labels('dumbbellRack')).toEqual(['Bicep curls', 'Lateral raises (side fly)'])
    expect(labels('treadmill')).toEqual(['Walk', 'Run'])
    expect(labels('legPress')).toEqual(['Leg press'])
    expect(labels('bench')).toEqual(['Dumbbell bench press', 'Seated shoulder press'])
    expect(labels('chestFly')).toEqual(['Chest fly'])
    expect(labels('bike')).toEqual(['Easy ride', 'Sprint'])
    expect(labels('rower')).toEqual(['Row'])
  })

  it('B0-T6b: carrying the dumbbell, machines offer nothing (the menu asks you to put it down)', () => {
    expect(menuActions('furniture', { holding: true, activity: null }, 'treadmill')).toEqual([])
  })
})
