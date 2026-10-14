// The words in the exercise popup, e.g. "Cycling · 20.0 km/h" over
// "0.15 km · 0:27". Kept apart from the popup component so they can be tested.
import { EXERCISES, endsAt, metersSoFar, repsDone, secondsSince, type Activity, type Between } from './gymStore'
import { strokesSince } from '../equipment/rowerGeometry'
import { kgText } from '../exercises/load'

// m/s → km/h, the unit treadmill and bike consoles show
const toKmh = (metersPerSecond: number) => (metersPerSecond * 3.6).toFixed(1)

// 75 seconds → "1:15"
export function clock(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Top line: what you're doing, with the speed for treadmill and bike, the time
// per 500 m for the rower (that's how rowing machines show pace), or the weight
// it was started with: "Doing bicep curls · 10 kg"
export function headline(activity: Pick<Activity, 'kind' | 'kg'>) {
  const { doing, speed, strokes } = EXERCISES[activity.kind]
  // Rounded: 500 ÷ (500 ÷ 120) is 119.999… in computer arithmetic, and the clock
  // rounds down (right for elapsed time, wrong for a pace)
  if (speed && strokes) return `${doing} · ${clock(Math.round(500 / speed))} /500m`
  if (speed) return `${doing} · ${toKmh(speed)} km/h`
  return activity.kg === undefined ? doing : `${doing} · ${kgText(activity.kg)}`
}

type Counted = Pick<Activity, 'kind' | 'startedAt' | 'pace'> & Partial<Pick<Activity, 'arrived' | 'target' | 'set' | 'repSeconds'>>

// Bottom line: distance and time when there's a speed, otherwise the rep count;
// with a target, counted against it ("7 of 12 reps", "0:27 of 10:00"), and with
// more than one set, which set this is ("Set 2 of 3 · 7 of 12 reps")
export function progressText(activity: Counted, nowRead: number) {
  // A clock read before the exercise began (a display that last updated earlier,
  // or a clock restarted on stepping onto a machine) counts as the very start.
  // A set never shows more than its target, even if its end is a moment late.
  const now = Math.max(nowRead, activity.startedAt)
  const capped = Math.min(now, endsAt(activity) ?? now)
  const { target, set = 1 } = activity
  const ofSets = target && target.sets > 1 ? `Set ${set} of ${target.sets} · ` : ''
  const { speed, strokes } = EXERCISES[activity.kind]
  if (speed) {
    // Distance = speed × time, added up across pace changes; the clock times the whole session
    const seconds = secondsSince(activity, capped)
    const km = metersSoFar(activity, capped) / 1000
    const time = target?.minutes !== undefined ? `${clock(seconds)} of ${clock(target.minutes * 60)}` : clock(seconds)
    if (strokes) {
      const count = strokesSince(seconds)
      const strokesDone = `${count} ${count === 1 ? 'stroke' : 'strokes'}`
      // With a target, the time to go matters more than the distance (the log keeps that)
      return `${ofSets}${strokesDone} · ${target?.minutes !== undefined ? time : `${km.toFixed(2)} km`}`
    }
    return `${ofSets}${km.toFixed(2)} km · ${time}`
  }
  const reps = repsDone(activity, now)
  if (target?.reps !== undefined) return `${ofSets}${Math.min(reps, target.reps)} of ${target.reps} reps`
  return reps === 0 ? 'First rep…' : `${reps} ${reps === 1 ? 'rep' : 'reps'} done`
}

// After a set of a round: the rest before the next ("Rest · 1:30 · set 2 of 3
// next", counted down from its end, so it's right whenever it's read), or after
// the last set, "3 sets done"
// (A clock read before the rest began, by a display that last ticked earlier, counts as its start.)
export function betweenText(between: Pick<Between, 'set' | 'target' | 'since' | 'until'>, now: number) {
  if (between.until === null) return `${between.set} ${between.set === 1 ? 'set' : 'sets'} done`
  const left = Math.max(0, Math.ceil((between.until - Math.max(now, between.since)) / 1000))
  return `Rest · ${clock(left)} · set ${between.set + 1} of ${between.target.sets} next`
}

// The same for a screen reader, without the seconds ticking by (a status line
// that changed every second would be read out every second): the rest's length
// instead, which changes, and is read out, when +30 s makes it longer
export const betweenWords = (between: Pick<Between, 'set' | 'target' | 'since' | 'until'>) =>
  between.until === null
    ? betweenText(between, 0)
    : `Resting ${clock(Math.round((between.until - between.since) / 1000))} before set ${between.set + 1} of ${between.target.sets}`
