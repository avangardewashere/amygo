import { clamp } from '../lib/math'
import { createStore } from '../lib/store'
import { ROOM } from '../scene/dimensions'
import { getBuild, type Furniture } from '../build/buildStore'
import { catalogEntry, type FurnitureType } from '../build/catalogData'
import { EXERCISES, type ExerciseKind } from '../exercises/catalog'
import { nearestMachine } from '../exercises/list'
import { kgFor } from '../exercises/weights'
import { isCardio, targetFor, type Target } from '../exercises/targets'
import { getSettings, repSecondsNow } from '../settings/settings'
import { primeSound } from '../workout/cues'
import { machine } from '../equipment/machineState'
import { crankAngle } from '../equipment/bikeGeometry'
import { REP_SECONDS, repPhase, repsSince } from './reps'
import { onHome } from '../shell/tabStore'

// Game state that both the 3D scene and the on-screen menus need to see.

// The exercises themselves live in exercises/catalog.ts (no 3D code there);
// passed on from here so existing imports keep working
export { EXERCISES }
export type { ExerciseKind }

export type FloorSpot = { x: number; z: number; rotationY: number }
export type MenuId = 'dumbbell' | 'furniture'

type Point = { x: number; z: number }

// An exercise in progress. startedAt drives the animation and the counters,
// so they always agree. After a change of pace (walk → run), `pace` says when
// the current pace began and what had built up before it, so the distance and
// the pedals carry on from there; startedAt still times the whole session.
// On machines you get on, an exercise starts with the person stepping on
// (arrived: false): the machine stays at rest and the clock starts only when
// they reach the spot. session tells one go on a machine from the next. Machines you get on (treadmill) also say where to
// stand while using it, and where to step back to afterwards. kg is the weight
// it was started with (strength exercises that take one); it stays with the set
// even if the picker is changed meanwhile. So do its target (v10: "3 × 12"),
// which set of it this is (from 1), and its tempo (seconds per rep): a set
// ends by itself at its last rep or minute (see workout/ending.ts).
export type Activity = {
  kind: ExerciseKind
  kg?: number
  target?: Target
  set?: number
  repSeconds?: number
  machineId: string
  session: number
  arrived: boolean
  startedAt: number
  faceYaw: number
  stand?: Point & { y: number }
  returnTo?: Point
  pace?: { since: number; meters: number; crank: number; counted?: boolean }
}

// After a set of a round (v10). With sets to come, the rest before the next
// one: "Rest · 1:30 · set 2 of 3 next", with +30 s, Skip and Finish; at `until`
// (exercise clock) the next set starts by itself (see workout/rounds.ts). After
// the last set (until: null): "3 sets done", with Again and Finish. The next set
// keeps the round's target, on the same machine, and steps back afterwards to
// where the person stood before the first one. since: when the set ended.
export type Between = {
  kind: ExerciseKind
  set: number
  target: Target
  machineId?: string
  returnTo?: Point
  since: number
  until: number | null
}

type GymState = {
  holding: boolean // is the person carrying the floor dumbbell?
  near: boolean // close enough to pick up the floor dumbbell?
  nearFurnitureId: string | null // usable furniture within reach, if any
  menu: MenuId | null // which item's menu is open
  dumbbell: FloorSpot // where the floor dumbbell lies when not carried
  activity: Activity | null
  between: Between | null
}

const store = createStore<GymState>({
  holding: false,
  near: false,
  nearFurnitureId: null,
  menu: null,
  dumbbell: { x: 1.5, z: 0.8, rotationY: 0.5 },
  activity: null,
  between: null,
})

// Read one piece of state in a component: const holding = useGym((s) => s.holding)
export const useGym = <S>(select: (s: GymState) => S) => store.useSelect(select)
export const getGym = store.get
// Be told whenever the gym state changes (the workout log uses this to notice a set ending)
export const subscribeGym = store.subscribe

// Where the person stands and faces, written by <Player> every frame.
// A plain object because it changes 60×/second and nothing re-renders from it.
export const playerPose = { x: 0, z: 0, yaw: 0 }

export const PICKUP_RANGE = 1.2 // meters
const DROP_DISTANCE = 0.55 // how far in front of the person it lands
const WALL_GAP = 0.2

// ---------- Exercises ----------


// Exercises done with dumbbells in your hands
export const isArmExercise = (kind: ExerciseKind) => EXERCISES[kind].weights !== undefined

// Where in the current rep we are: 0 → 1 → 0 (see reps.ts), at the set's own tempo
export const repProgress = (activity: Activity, now = performance.now()) =>
  repPhase(activity.startedAt, now, activity.repSeconds)

export const secondsSince = (activity: Pick<Activity, 'startedAt'>, now = performance.now()) => (now - activity.startedAt) / 1000

// Seconds at the current pace (the whole session, if the pace never changed)
export const paceSeconds = (activity: Pick<Activity, 'startedAt' | 'pace'>, now = performance.now()) =>
  (now - (activity.pace?.since ?? activity.startedAt)) / 1000

// Distance covered this session, in meters: what came before this pace, plus this pace so far
export const metersSoFar = (activity: Pick<Activity, 'kind' | 'startedAt' | 'pace'>, now = performance.now()) =>
  (activity.pace?.meters ?? 0) + (EXERCISES[activity.kind].speed ?? 0) * paceSeconds(activity, now)

// How far the bike's pedals have turned this session (radians), carried on across pace changes
export const crankSoFar = (activity: Pick<Activity, 'kind' | 'startedAt' | 'pace'>, now = performance.now()) =>
  (activity.pace?.crank ?? 0) + crankAngle(EXERCISES[activity.kind].cadence ?? 0, paceSeconds(activity, now))

export const repsDone = (activity: Pick<Activity, 'startedAt' | 'repSeconds'>, now = performance.now()) =>
  repsSince(activity.startedAt, now, activity.repSeconds)

// When a set with a target is over, on the exercise clock: its reps at its
// tempo, or its minutes, from the moment it began (the session's start, so a
// change of pace on the treadmill keeps the same end). null without a target,
// or while still stepping on (the clock starts on arrival).
export function endsAt(activity: Pick<Activity, 'startedAt' | 'target' | 'repSeconds'> & { arrived?: boolean }) {
  const { target } = activity
  if (!target || !activity.arrived) return null
  const seconds = target.minutes !== undefined ? target.minutes * 60 : target.reps * (activity.repSeconds ?? REP_SECONDS)
  return activity.startedAt + seconds * 1000
}

// Shorter than this is a false start, not a set (decision D3)
export const MIN_REPS = 1
export const MIN_CARDIO_SECONDS = 10

// A point given relative to a piece of furniture (its own left/right and
// front/back) → where that is in the room, after the piece's rotation
function fromFurniture(item: Furniture, localX: number, localZ: number): Point {
  const angle = -item.turns * (Math.PI / 2) // same rotation the model is drawn with
  return {
    x: item.x + localX * Math.cos(angle) + localZ * Math.sin(angle),
    z: item.z - localX * Math.sin(angle) + localZ * Math.cos(angle),
  }
}

let sessions = 0

// Wake the machine up: its moving parts start, on the same clock as the person
function runMachine(activity: Activity) {
  const { kind, machineId, startedAt } = activity
  machine.activeId = machineId
  machine.exercise = kind
  machine.speed = EXERCISES[kind].speed ?? 0
  machine.cadence = EXERCISES[kind].cadence ?? 0
  machine.backrest = EXERCISES[kind].backrest ?? 0
  machine.crankOffset = 0
  machine.startedAt = startedAt
  machine.repSeconds = activity.repSeconds ?? REP_SECONDS
}

// How far in front of a machine you use from beside it (the dumbbell rack)
// the person is put when started from the Exercises list
const IN_FRONT = 0.45

// A set's place in a round of sets: which set it is, and the round's target
type Round = { set: number; target: Target }

// Start an exercise on the machine in reach. From the Exercises list
// (placed), the gym isn't on screen, so the person is put straight onto the
// machine and the exercise begins at once, instead of stepping on.
//   returnTo: where to step back to afterwards (default: where they are)
//   round: the next set of a round (default: set 1 of the target picked for it)
function startExercise(
  kind: ExerciseKind,
  { placed = false, returnTo, round }: { placed?: boolean; returnTo?: Point; round?: Round } = {},
) {
  const { nearFurnitureId, holding } = store.get()
  const piece = getBuild().items.find((item) => item.id === nearFurnitureId)
  if (!piece || holding) return
  primeSound() // (a tap starts most sets: the one chance to make the rest's beep possible)
  // The weight last picked for it (from the list or here: both read the same store)
  const kg = kgFor(kind)
  const base = {
    kind,
    ...(kg !== undefined && { kg }),
    target: round?.target ?? targetFor(kind),
    set: round?.set ?? 1,
    repSeconds: repSecondsNow(), // the tempo now; the set keeps it
    machineId: piece.id,
    session: ++sessions,
    startedAt: performance.now(),
  }
  const back = returnTo ?? { x: playerPose.x, z: playerPose.z }

  let activity: Activity
  const standAt = EXERCISES[kind].standAt ?? catalogEntry(piece.type).standAt
  if (standAt) {
    // Get on (or into) the machine, facing the way it faces (+z in its own coordinates)
    const spot = fromFurniture(piece, 0, standAt.z)
    activity = {
      ...base,
      arrived: placed, // step on first; the exercise begins on arrival (see stepOnto)
      faceYaw: -piece.turns * (Math.PI / 2),
      stand: { ...spot, y: standAt.y },
      returnTo: back,
    }
    if (placed) runMachine(activity)
  } else if (placed) {
    // Put just in front of the machine, back to it, the way people step away from a rack to lift
    const spot = fromFurniture(piece, 0, catalogEntry(piece.type).depth / 2 + IN_FRONT)
    activity = { ...base, arrived: true, faceYaw: -piece.turns * (Math.PI / 2), stand: { ...spot, y: 0 }, returnTo: back }
    runMachine(activity)
  } else {
    // Turn your back to the rack, the way people step away from it to lift
    activity = { ...base, arrived: true, faceYaw: Math.atan2(playerPose.x - piece.x, playerPose.z - piece.z) }
    runMachine(activity) // nothing to step onto: start straight away
  }
  store.set({ activity, menu: null, between: null })
}

// Start an exercise from the Exercises list: on the nearest machine of its
// kind, with the person put straight onto it. Switching from another
// exercise keeps where they first came from. Returns false if it can't start
// (no such machine in the gym, or hands full). The next set of a round goes
// on the machine the round is on, while it's there.
export function startFromList(kind: ExerciseKind, round?: Round & { returnTo?: Point; machineId?: string }) {
  const { holding, activity } = store.get()
  if (holding) return false
  const { machine: type } = EXERCISES[kind]
  const items = getBuild().items
  const same = round?.machineId ? items.find((item) => item.id === round.machineId && item.type === type) : undefined
  const piece = same ?? nearestMachine(type, items, playerPose)
  if (!piece) return false
  const back = round?.returnTo ?? activity?.returnTo
  stopExercise()
  store.set({ nearFurnitureId: piece.id })
  startExercise(kind, { placed: true, returnTo: back, round })
  return true
}

// The rest is over (Skip, or its end): the round's next set, on its machine
export function nextSet() {
  const { between } = store.get()
  if (!between || between.until === null) return false
  return startFromList(between.kind, { ...between, set: between.set + 1 })
}

// After the round's last set: one more, with the same target ("Set 4 of 4")
export function again() {
  const { between } = store.get()
  if (!between || between.until !== null) return false
  const set = between.set + 1
  return startFromList(between.kind, { ...between, set, target: { ...between.target, sets: set } as Target })
}

// +30 s: the rest goes on 30 s longer (counted from now if its end has passed),
// up to 10 minutes from now
export const MORE_REST_SECONDS = 30
export const MAX_REST_SECONDS = 600
export function moreRest(now = performance.now()) {
  const { between } = store.get()
  if (!between || between.until === null) return false
  const until = Math.min(Math.max(between.until, now) + MORE_REST_SECONDS * 1000, now + MAX_REST_SECONDS * 1000)
  store.set({ between: { ...between, until } })
  return true
}

// How long the rest after a set of `kind` is, in seconds (Workout settings)
export const restSeconds = (kind: ExerciseKind) => getSettings().rest[isCardio(kind) ? 'cardio' : 'strength']

// The buttons on the card and the popup change under the finger: a set ends
// and the rest begins (Done gives way to +30 s, Skip and Finish), a set begins
// (Skip and Again give way to Done and Finish), a pace changes (Run gives way to
// Walk). A tap that lands within this long of a change was meant for the button
// that was there, so it's ignored: a double tap on Skip doesn't end set 2 at
// once, and a Done just as the set ends by itself doesn't skip the rest.
// (Remove and Undo do the same. Esc, a key, isn't a tap: it always works.)
export const SWAP_PAUSE_MS = 600

// When the buttons last changed: the set began (or changed pace), or the rest
// (or "3 sets done") began
function lastChange() {
  const { activity, between } = store.get()
  if (activity) return Math.max(activity.startedAt, activity.pace?.since ?? -Infinity)
  return between?.since ?? -Infinity
}
export const swapSettled = (now = performance.now()) => now - lastChange() >= SWAP_PAUSE_MS

// The buttons' Done, Skip, Again, +30 s and Finish (pace buttons: swapSettled() first)
export function tapDone(now = performance.now()) {
  if (!store.get().activity || !swapSettled(now)) return false
  stopExercise()
  return true
}
export const tapNextSet = (now = performance.now()) => swapSettled(now) && nextSet()
export const tapAgain = (now = performance.now()) => swapSettled(now) && again()
export const tapMoreRest = (now = performance.now()) => swapSettled(now) && moreRest(now)
export function tapFinish(now = performance.now()) {
  if (!swapSettled(now)) return false
  finishExercise()
  return true
}

// Finish: the set ends and is saved, and so does the round (no next set).
// The in-gym Stop, Esc and the lists' Finish all mean this.
export function finishExercise() {
  stopExercise()
  if (store.get().between) store.set({ between: null })
}
export const finishFromList = finishExercise

// How close (meters) the person must be to a machine's spot to count as on it
export const ARRIVE_DISTANCE = 0.02

// Called every frame with where the person is. Once they've stepped onto the
// machine's spot, the exercise begins: the clock starts from now, so the first
// rep starts from the machine's resting position, and the machine wakes up.
export function stepOnto(position: { x: number; y: number; z: number }, now = performance.now()) {
  const { activity } = store.get()
  if (!activity || activity.arrived || !activity.stand) return
  const { x, y, z } = activity.stand
  if (Math.hypot(position.x - x, position.y - y, position.z - z) > ARRIVE_DISTANCE) return
  const begun = { ...activity, arrived: true, startedAt: now }
  runMachine(begun)
  store.set({ activity: begun })
}

// The same session at a new pace, from `now`: same machine, same spot, same
// start time; the distance and pedal angle so far are kept. counted: a part
// before this pace was long enough to be saved as a set of its own (the log
// saves each pace's part), so the session is one of its round's sets already.
export function withNewPace(activity: Activity, kind: ExerciseKind, now: number): Activity {
  const counted = activity.pace?.counted === true || paceSeconds(activity, now) >= MIN_CARDIO_SECONDS
  return {
    ...activity,
    kind,
    pace: { since: now, meters: metersSoFar(activity, now), crank: crankSoFar(activity, now), counted },
  }
}

// Exercises you can switch to without getting off: other paces of the same
// movement on the same machine (walk ↔ run, easy ride ↔ sprint)
export const otherPaces = (kind: ExerciseKind) =>
  (Object.keys(EXERCISES) as ExerciseKind[]).filter(
    (other) =>
      other !== kind &&
      EXERCISES[other].machine === EXERCISES[kind].machine &&
      EXERCISES[other].speed !== undefined &&
      EXERCISES[kind].speed !== undefined,
  )

function switchPace(kind: ExerciseKind) {
  const { activity } = store.get()
  if (!activity) return
  const now = performance.now()
  const next = withNewPace(activity, kind, now)
  // The machine's moving parts change speed; the pedals carry on from their current angle
  machine.exercise = kind
  machine.speed = EXERCISES[kind].speed ?? 0
  machine.cadence = EXERCISES[kind].cadence ?? 0
  machine.startedAt = now
  machine.crankOffset = next.pace!.crank
  store.set({ activity: next, menu: null })
}

// The set ends here and is saved (see log/logStore.ts): Done, the set's own end,
// walking away (decision V10-D4). If it was one of a round and it counts as a
// set, the rest before the next set begins, or after the last, "3 sets done".
export function stopExercise() {
  const { activity } = store.get()
  if (!activity) return
  machine.activeId = null
  machine.exercise = null
  machine.speed = 0
  machine.cadence = 0
  machine.backrest = 0
  store.set({ activity: null, menu: null, between: roundGoesOn(activity) })
}

// What a round looks like after `activity` ends now: resting before its next
// set, done (its last set), or over (null). A set that didn't count (never
// begun, or under a rep or 10 s of cardio, so nothing of it saved) isn't one of
// its sets. Counted up to its end, as it's saved (see log/sets.ts), even if it
// ends late; the rest is counted from now.
function roundGoesOn(activity: Activity, now = performance.now()): Between | null {
  const { kind, target, set = 1, returnTo, machineId } = activity
  if (!target || !activity.arrived) return null
  const at = Math.min(now, endsAt(activity) ?? now)
  const counted = EXERCISES[kind].speed
    ? activity.pace?.counted === true || paceSeconds(activity, at) >= MIN_CARDIO_SECONDS
    : repsDone(activity, now) >= MIN_REPS
  if (!counted) return null
  const until = set < target.sets ? now + restSeconds(kind) * 1000 : null
  return { kind, set, target, machineId, ...(returnTo && { returnTo }), since: now, until }
}

// Where the person goes when `previous` gives way to `current`: if the session
// ended, back to the spot they came from, feet on the floor. null = stay put
// (the same session carrying on, e.g. at a new pace, or they never moved).
export function stepOffSpot(previous: Activity | null, current: Activity | null = null) {
  if (!previous?.returnTo) return null
  const sameSession = current?.session === previous.session
  if (sameSession) return null
  return { x: previous.returnTo.x, y: 0, z: previous.returnTo.z }
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
  if (store.get().activity) return finishExercise() // mid-exercise, E means "stop"
  const focus = menuInFocus()
  if (focus) openMenu(focus)
}

// ---------- Floor dumbbell ----------

// (Between two sets, picking it up is doing something else: the round is over)
function pickUp() {
  const state = store.get()
  if (state.near && !state.holding && !state.activity) store.set({ holding: true, near: false, menu: null, between: null })
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
      x: clamp(x + Math.sin(yaw) * DROP_DISTANCE, -limitX, limitX),
      z: clamp(z + Math.cos(yaw) * DROP_DISTANCE, -limitZ, limitZ),
      // The model's bar runs along x, which is already sideways to someone facing +z,
      // so turning it by the person's own yaw lays it across their path
      rotationY: yaw,
    },
  })
}

// ---------- What each menu offers ----------

export type MenuAction = { label: string; run: () => void }

// Mid-exercise: the other paces you can switch to (shown in the exercise popup)
export const paceActions = (activity: Pick<Activity, 'kind'> & Partial<Pick<Activity, 'arrived'>>): MenuAction[] =>
  activity.arrived === false
    ? [] // still stepping on
    : otherPaces(activity.kind).map((kind) => ({ label: EXERCISES[kind].name, run: () => switchPace(kind) }))

// Pass the state the actions depend on (components get it from useGym/useBuild)
export function menuActions(
  menu: MenuId,
  s: Pick<GymState, 'holding' | 'activity'>,
  furnitureType?: FurnitureType,
): MenuAction[] {
  if (menu === 'dumbbell') {
    return s.holding ? [{ label: 'Drop', run: drop }] : [{ label: 'Pick up', run: pickUp }]
  }
  // Mid-exercise: stop, or switch to another pace without getting off
  if (s.activity) return [{ label: 'Stop', run: finishExercise }, ...paceActions(s.activity)]
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

// Keyboard: E opens/closes a menu, 1–9 picks an action, Esc closes or stops
// (Stop: the set and its round, as Finish), Space moves on (decision V10-D3):
// Done during a set, Skip during the rest. Space's meaning changes with the card,
// so a press just after it changed waits, as a tap does (Esc always works).
// Space in a field, or on a button or link the keyboard took you to, is theirs;
// on a button a mouse click merely left the cursor on (the Gym tab, +30 s), it's
// the gym's, and that button lets go of the cursor.
export function listenToInteractionKeys() {
  const onDown = (e: KeyboardEvent) => {
    if (e.repeat || getBuild().mode === 'build') return // items can't be used while building
    if (!onHome()) return // the gym isn't in front
    const state = store.get()
    if (e.code === 'KeyE') {
      toggleMenu()
    } else if (e.code === 'Escape') {
      if (state.menu) closeMenu()
      else finishExercise()
    } else if (e.code === 'Space') {
      const target = e.target as Element | null
      if (target?.closest?.('input, select, textarea, [contenteditable]')) return
      const control = target?.closest?.('button, a') as HTMLElement | null | undefined
      if (control?.matches?.(':focus-visible')) return
      e.preventDefault() // (not a scroll, and not the button's press)
      control?.blur?.()
      if (state.activity) tapDone()
      else if (state.between?.until != null) tapNextSet()
    } else if (/^Digit[1-9]$/.test(e.code)) {
      const pick = Number(e.code.slice(5)) - 1
      // With a menu open, numbers pick from it; mid-exercise, they pick a new pace
      if (state.menu) menuActions(state.menu, state, nearFurnitureType())[pick]?.run()
      else if (state.activity) paceActions(state.activity)[pick]?.run()
    }
  }
  window.addEventListener('keydown', onDown)
  return () => window.removeEventListener('keydown', onDown)
}
