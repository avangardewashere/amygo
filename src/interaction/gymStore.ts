import { MathUtils } from 'three'
import { createStore } from '../lib/store'
import { ROOM } from '../scene/dimensions'
import { getBuild, type Furniture } from '../build/buildStore'
import type { FurnitureType } from '../build/catalog'
import { catalogEntry, type StandAt } from '../build/catalog'
import { SEATED_HIP, placeHips } from '../equipment/benchGeometry'
import { machine } from '../equipment/machineState'
import { BIKE } from '../equipment/bikeGeometry'
import { ROWER } from '../equipment/rowerGeometry'
import { ADJ, hipsAgainstBackrest } from '../equipment/adjustableBenchGeometry'
import { repPhase, repsSince } from './reps'

// Game state that both the 3D scene and the on-screen menus need to see.

export type FloorSpot = { x: number; z: number; rotationY: number }
export type MenuId = 'dumbbell' | 'furniture'
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

type Point = { x: number; z: number }

// An exercise in progress. startedAt drives the animation and the counters,
// so they always agree. Machines you get on (treadmill) also say where to
// stand while using it, and where to step back to afterwards.
export type Activity = {
  kind: ExerciseKind
  machineId: string
  startedAt: number
  faceYaw: number
  stand?: Point & { y: number }
  returnTo?: Point
}

type GymState = {
  holding: boolean // is the person carrying the floor dumbbell?
  near: boolean // close enough to pick up the floor dumbbell?
  nearFurnitureId: string | null // usable furniture within reach, if any
  menu: MenuId | null // which item's menu is open
  dumbbell: FloorSpot // where the floor dumbbell lies when not carried
  activity: Activity | null
}

const store = createStore<GymState>({
  holding: false,
  near: false,
  nearFurnitureId: null,
  menu: null,
  dumbbell: { x: 1.5, z: 0.8, rotationY: 0.5 },
  activity: null,
})

// Read one piece of state in a component: const holding = useGym((s) => s.holding)
export const useGym = <S>(select: (s: GymState) => S) => store.useSelect(select)
export const getGym = store.get

// Where the person stands and faces, written by <Player> every frame.
// A plain object because it changes 60×/second and nothing re-renders from it.
export const playerPose = { x: 0, z: 0, yaw: 0 }

export const PICKUP_RANGE = 1.2 // meters
const DROP_DISTANCE = 0.55 // how far in front of the person it lands
const WALL_GAP = 0.2

// ---------- Exercises ----------

type Exercise = {
  machine: FurnitureType // which furniture offers it
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
  standAt?: StandAt // overrides where the machine puts you
}

export const EXERCISES: Record<ExerciseKind, Exercise> = {
  curl: { machine: 'dumbbellRack', name: 'Bicep curls', doing: 'Doing bicep curls', weights: 'across' },
  lateral: {
    machine: 'dumbbellRack',
    name: 'Lateral raises (side fly)',
    doing: 'Doing lateral raises',
    weights: 'forward',
  },
  walk: { machine: 'treadmill', name: 'Walk', doing: 'Walking', speed: 1.5, stride: 0.8 },
  run: { machine: 'treadmill', name: 'Run', doing: 'Running', speed: 3, stride: 1.5 },
  legPress: { machine: 'legPress', name: 'Leg press', doing: 'Doing leg presses' },
  benchPress: { machine: 'bench', name: 'Dumbbell bench press', doing: 'Doing bench presses', weights: 'across' },
  shoulderPress: {
    machine: 'bench',
    name: 'Seated shoulder press',
    doing: 'Doing shoulder presses',
    weights: 'across',
    standAt: placeHips(SEATED_HIP), // sitting on the end of the bench instead of lying
  },
  chestFly: { machine: 'chestFly', name: 'Chest fly', doing: 'Doing chest flies' },
  ride: { machine: 'bike', name: 'Easy ride', doing: 'Cycling', speed: 20 / 3.6, cadence: BIKE.cadence.easy },
  sprint: { machine: 'bike', name: 'Sprint', doing: 'Sprinting', speed: 32 / 3.6, cadence: BIKE.cadence.sprint },
  row: { machine: 'rower', name: 'Row', doing: 'Rowing', speed: ROWER.speed, strokes: true },
  inclinePress: {
    machine: 'adjustableBench',
    name: 'Incline dumbbell press',
    doing: 'Doing incline presses',
    weights: 'across',
    backrest: ADJ.angles.incline,
    standAt: placeHips(hipsAgainstBackrest(ADJ.angles.incline)),
  },
  seatedCurl: {
    machine: 'adjustableBench',
    name: 'Seated curls',
    doing: 'Doing seated curls',
    weights: 'across',
    backrest: ADJ.angles.upright,
    standAt: placeHips(hipsAgainstBackrest(ADJ.angles.upright)),
  },
  squat: { machine: 'squatRack', name: 'Back squat', doing: 'Doing back squats' },
}

// Exercises done with dumbbells in your hands
export const isArmExercise = (kind: ExerciseKind) => EXERCISES[kind].weights !== undefined

// Where in the current rep we are: 0 → 1 → 0 (see reps.ts)
export const repProgress = (activity: Activity, now = performance.now()) => repPhase(activity.startedAt, now)

export const secondsSince = (activity: Pick<Activity, 'startedAt'>, now = performance.now()) => (now - activity.startedAt) / 1000

export const repsDone = (activity: Pick<Activity, 'startedAt'>, now = performance.now()) => repsSince(activity.startedAt, now)

// A point given relative to a piece of furniture (its own left/right and
// front/back) → where that is in the room, after the piece's rotation
function fromFurniture(item: Furniture, localX: number, localZ: number): Point {
  const angle = -item.turns * (Math.PI / 2) // same rotation the model is drawn with
  return {
    x: item.x + localX * Math.cos(angle) + localZ * Math.sin(angle),
    z: item.z - localX * Math.sin(angle) + localZ * Math.cos(angle),
  }
}

function startExercise(kind: ExerciseKind) {
  const { nearFurnitureId, holding } = store.get()
  const piece = getBuild().items.find((item) => item.id === nearFurnitureId)
  if (!piece || holding) return
  const base = { kind, machineId: piece.id, startedAt: performance.now() }

  let activity: Activity
  const standAt = EXERCISES[kind].standAt ?? catalogEntry(piece.type).standAt
  if (standAt) {
    // Get on (or into) the machine, facing the way it faces (+z in its own coordinates)
    const spot = fromFurniture(piece, 0, standAt.z)
    activity = {
      ...base,
      faceYaw: -piece.turns * (Math.PI / 2),
      stand: { ...spot, y: standAt.y },
      returnTo: { x: playerPose.x, z: playerPose.z },
    }
  } else {
    // Turn your back to the rack, the way people step away from it to lift
    activity = { ...base, faceYaw: Math.atan2(playerPose.x - piece.x, playerPose.z - piece.z) }
  }
  // Tell the machine it's running, so its moving parts (belt, sled) animate
  machine.activeId = piece.id
  machine.speed = EXERCISES[kind].speed ?? 0
  machine.cadence = EXERCISES[kind].cadence ?? 0
  machine.backrest = EXERCISES[kind].backrest ?? 0
  machine.startedAt = base.startedAt
  store.set({ activity, menu: null })
}

export function stopExercise() {
  if (!store.get().activity) return
  machine.activeId = null
  machine.speed = 0
  machine.cadence = 0
  machine.backrest = 0
  store.set({ activity: null, menu: null })
}

// ---------- Nearness (written by <Player> every frame) ----------

export function setNear(near: boolean) {
  const state = store.get()
  if (near === state.near) return
  // Walking away closes that menu, so it never offers an action you can't do
  store.set({ near, menu: !near && state.menu === 'dumbbell' ? null : state.menu })
}

export function setNearFurniture(id: string | null) {
  const state = store.get()
  if (id === state.nearFurnitureId) return
  store.set({ nearFurnitureId: id, menu: !id && state.menu === 'furniture' ? null : state.menu })
}

// ---------- Menus ----------

function canOpen(menu: MenuId) {
  const s = store.get()
  return menu === 'dumbbell' ? s.holding || s.near : s.nearFurnitureId !== null
}

export function openMenu(menu: MenuId) {
  if (canOpen(menu) && store.get().menu !== menu) store.set({ menu })
}

export function closeMenu() {
  if (store.get().menu) store.set({ menu: null })
}

// Which menu E should open: what you're holding first, then what's nearby
function menuInFocus(): MenuId | null {
  const s = store.get()
  if (s.holding || s.near) return 'dumbbell'
  if (s.nearFurnitureId) return 'furniture'
  return null
}

export function toggleMenu() {
  if (store.get().menu) return closeMenu()
  if (store.get().activity) return stopExercise() // mid-exercise, E means "stop"
  const focus = menuInFocus()
  if (focus) openMenu(focus)
}

// ---------- Floor dumbbell ----------

function pickUp() {
  const state = store.get()
  if (state.near && !state.holding && !state.activity) store.set({ holding: true, near: false, menu: null })
}

function drop() {
  if (!store.get().holding) return
  const { x, z, yaw } = playerPose
  // "Forward" for a facing angle: sin for x, cos for z (the person faces +z at yaw 0)
  const limitX = ROOM.width / 2 - WALL_GAP
  const limitZ = ROOM.depth / 2 - WALL_GAP
  store.set({
    holding: false,
    menu: null,
    dumbbell: {
      x: MathUtils.clamp(x + Math.sin(yaw) * DROP_DISTANCE, -limitX, limitX),
      z: MathUtils.clamp(z + Math.cos(yaw) * DROP_DISTANCE, -limitZ, limitZ),
      // The model's bar runs along x, which is already sideways to someone facing +z,
      // so turning it by the person's own yaw lays it across their path
      rotationY: yaw,
    },
  })
}

// ---------- What each menu offers ----------

export type MenuAction = { label: string; run: () => void }

// Pass the state the actions depend on (components get it from useGym/useBuild)
export function menuActions(
  menu: MenuId,
  s: Pick<GymState, 'holding' | 'activity'>,
  furnitureType?: FurnitureType,
): MenuAction[] {
  if (menu === 'dumbbell') {
    return s.holding ? [{ label: 'Drop', run: drop }] : [{ label: 'Pick up', run: pickUp }]
  }
  if (s.activity) return [{ label: 'Stop', run: stopExercise }]
  if (s.holding) return [] // hands are full; the menu shows a note instead
  return (Object.keys(EXERCISES) as ExerciseKind[])
    .filter((kind) => EXERCISES[kind].machine === furnitureType)
    .map((kind) => ({ label: EXERCISES[kind].name, run: () => startExercise(kind) }))
}

// The type of the furniture currently in reach (for keyboard shortcuts)
function nearFurnitureType() {
  const id = store.get().nearFurnitureId
  return getBuild().items.find((item) => item.id === id)?.type
}

// Keyboard: E opens/closes a menu, 1–9 picks an action, Esc closes or stops.
export function listenToInteractionKeys() {
  const onDown = (e: KeyboardEvent) => {
    if (e.repeat || getBuild().mode === 'build') return // items can't be used while building
    const state = store.get()
    if (e.code === 'KeyE') {
      toggleMenu()
    } else if (e.code === 'Escape') {
      if (state.menu) closeMenu()
      else stopExercise()
    } else if (state.menu && /^Digit[1-9]$/.test(e.code)) {
      const action = menuActions(state.menu, state, nearFurnitureType())[Number(e.code.slice(5)) - 1]
      action?.run()
    }
  }
  window.addEventListener('keydown', onDown)
  return () => window.removeEventListener('keydown', onDown)
}
