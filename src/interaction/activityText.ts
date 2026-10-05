// The words in the exercise popup, e.g. "Cycling · 20.0 km/h" over
// "0.15 km · 0:27". Kept apart from the popup component so they can be tested.
import { EXERCISES, repsDone, secondsSince, type Activity } from './gymStore'

// m/s → km/h, the unit treadmill and bike consoles show
const toKmh = (metersPerSecond: number) => (metersPerSecond * 3.6).toFixed(1)

// 75 seconds → "1:15"
function clock(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Top line: what you're doing, with the speed for treadmill and bike
export function headline(activity: Pick<Activity, 'kind'>) {
  const { doing, speed } = EXERCISES[activity.kind]
  return speed ? `${doing} · ${toKmh(speed)} km/h` : doing
}

// Bottom line: distance and time when there's a speed, otherwise the rep count
export function progressText(activity: Pick<Activity, 'kind' | 'startedAt'>, now: number) {
  const { speed } = EXERCISES[activity.kind]
  if (speed) {
    // Distance = speed × time
    const seconds = secondsSince(activity, now)
    const km = (speed * seconds) / 1000
    return `${km.toFixed(2)} km · ${clock(seconds)}`
  }
  const reps = repsDone(activity, now)
  return reps === 0 ? 'First rep…' : `${reps} ${reps === 1 ? 'rep' : 'reps'} done`
}
