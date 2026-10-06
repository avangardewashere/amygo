// The words in the exercise popup, e.g. "Cycling · 20.0 km/h" over
// "0.15 km · 0:27". Kept apart from the popup component so they can be tested.
import { EXERCISES, metersSoFar, repsDone, secondsSince, type Activity } from './gymStore'
import { strokesSince } from '../equipment/rowerGeometry'

// m/s → km/h, the unit treadmill and bike consoles show
const toKmh = (metersPerSecond: number) => (metersPerSecond * 3.6).toFixed(1)

// 75 seconds → "1:15"
export function clock(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Top line: what you're doing, with the speed for treadmill and bike, or the
// time per 500 m for the rower (that's how rowing machines show pace)
export function headline(activity: Pick<Activity, 'kind'>) {
  const { doing, speed, strokes } = EXERCISES[activity.kind]
  // Rounded: 500 ÷ (500 ÷ 120) is 119.999… in computer arithmetic, and the clock
  // rounds down (right for elapsed time, wrong for a pace)
  if (speed && strokes) return `${doing} · ${clock(Math.round(500 / speed))} /500m`
  return speed ? `${doing} · ${toKmh(speed)} km/h` : doing
}

// Bottom line: distance and time when there's a speed, otherwise the rep count
export function progressText(activity: Pick<Activity, 'kind' | 'startedAt' | 'pace'>, nowRead: number) {
  // A clock read before the exercise began (a display that last updated earlier,
  // or a clock restarted on stepping onto a machine) counts as the very start
  const now = Math.max(nowRead, activity.startedAt)
  const { speed, strokes } = EXERCISES[activity.kind]
  if (speed) {
    // Distance = speed × time, added up across pace changes; the clock times the whole session
    const seconds = secondsSince(activity, now)
    const km = metersSoFar(activity, now) / 1000
    if (strokes) {
      const count = strokesSince(seconds)
      return `${count} ${count === 1 ? 'stroke' : 'strokes'} · ${km.toFixed(2)} km`
    }
    return `${km.toFixed(2)} km · ${clock(seconds)}`
  }
  const reps = repsDone(activity, now)
  return reps === 0 ? 'First rep…' : `${reps} ${reps === 1 ? 'rep' : 'reps'} done`
}
