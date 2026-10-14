// The words in the exercise popup, e.g. "Cycling · 20.0 km/h" over
// "0.15 km · 0:27", and on the workout card and the strip (v10 Block 3), all
// from one measure of the set (measure() below), so they can't disagree. Kept
// apart from the components so they can be tested.
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

// The speed for treadmill and bike, the time per 500 m for the rower (that's
// how rowing machines show pace), or the weight it was started with; or nothing
function speedOrWeight(activity: Pick<Activity, 'kind' | 'kg'>) {
  const { speed, strokes } = EXERCISES[activity.kind]
  // Rounded: 500 ÷ (500 ÷ 120) is 119.999… in computer arithmetic, and the clock
  // rounds down (right for elapsed time, wrong for a pace)
  if (speed && strokes) return `${clock(Math.round(500 / speed))} /500m`
  if (speed) return `${toKmh(speed)} km/h`
  return activity.kg === undefined ? undefined : kgText(activity.kg)
}

// Top line: what you're doing, with its speed or weight: "Doing bicep curls · 10 kg"
export function headline(activity: Pick<Activity, 'kind' | 'kg'>) {
  const { doing } = EXERCISES[activity.kind]
  const extra = speedOrWeight(activity)
  return extra === undefined ? doing : `${doing} · ${extra}`
}

type Counted = Pick<Activity, 'kind' | 'startedAt' | 'pace'> & Partial<Pick<Activity, 'arrived' | 'target' | 'set' | 'repSeconds'>>

// How far a set has got: the reps done (never past its target), or for cardio
// the time, distance and strokes (never past its minutes). A clock read before
// the exercise began (a display that last updated earlier, or a clock restarted
// on stepping onto a machine) counts as the very start.
function measure(activity: Counted, nowRead: number) {
  const now = Math.max(nowRead, activity.startedAt)
  const capped = Math.min(now, endsAt(activity) ?? now)
  const { target } = activity
  const { speed, strokes } = EXERCISES[activity.kind]
  if (speed) {
    // Distance = speed × time, added up across pace changes; the clock times the whole session
    const seconds = secondsSince(activity, capped)
    return {
      reps: undefined,
      seconds,
      km: metersSoFar(activity, capped) / 1000,
      strokes: strokes ? strokesSince(seconds) : undefined,
    }
  }
  const reps = repsDone(activity, now)
  return { reps: target?.reps !== undefined ? Math.min(reps, target.reps) : reps, seconds: 0, km: 0, strokes: undefined }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// A cardio set's line: "0.15 km · 0:27", with a target "0.15 km · 0:27<of>10:00"
// (`of`: " of " in the popup, " / " on the card); the rower counts strokes, and
// with a target its time rather than its distance (the log keeps that)
function cardioLine(activity: Counted, m: ReturnType<typeof measure>, of: string) {
  const { target } = activity
  const time = target?.minutes !== undefined ? `${clock(m.seconds)}${of}${clock(target.minutes * 60)}` : clock(m.seconds)
  if (m.strokes !== undefined) return `${plural(m.strokes, 'stroke', 'strokes')} · ${target?.minutes !== undefined ? time : `${m.km.toFixed(2)} km`}`
  return `${m.km.toFixed(2)} km · ${time}`
}

// Bottom line: distance and time when there's a speed, otherwise the rep count;
// with a target, counted against it ("7 of 12 reps", "0:27 of 10:00"), and with
// more than one set, which set this is ("Set 2 of 3 · 7 of 12 reps")
export function progressText(activity: Counted, nowRead: number) {
  const m = measure(activity, nowRead)
  const { target, set = 1 } = activity
  const ofSets = target && target.sets > 1 ? `Set ${set} of ${target.sets} · ` : ''
  if (m.reps === undefined) return `${ofSets}${cardioLine(activity, m, ' of ')}`
  if (target?.reps !== undefined) return `${ofSets}${m.reps} of ${target.reps} reps`
  return m.reps === 0 ? 'First rep…' : `${plural(m.reps, 'rep', 'reps')} done`
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

// The workout card (v10 Block 3), from the same measure as the popup:
//   what:  "Bicep curls · set 2 of 3", resting "Bicep curls · set 2 of 3 next"
//   count: "7 / 12 reps", "0.45 km · 2:30 / 10:00", "Rest 1:12", "3 sets done"
//   extra: the weight ("10 kg"), or the speed ("5.4 km/h"); resting, the weight
//          the next set will use (nextKg, the picker's)
//   words: the same for a screen reader, without anything that ticks (the card is
//          a status line: it would be read out at every rep and every second)
export type CardWords = { what: string; count: string; extra?: string; words: string }
type Now = { activity: Activity | null; between: Between | null }

export function cardWords({ activity, between }: Now, now: number, nextKg?: number): CardWords | null {
  if (activity) {
    const { name } = EXERCISES[activity.kind]
    const { target, set = 1 } = activity
    const ofSets = target && target.sets > 1 ? ` · set ${set} of ${target.sets}` : ''
    const m = measure(activity, now)
    const count =
      m.reps === undefined
        ? cardioLine(activity, m, ' / ')
        : target?.reps !== undefined
          ? `${m.reps} / ${target.reps} reps`
          : plural(m.reps, 'rep', 'reps')
    const extra = speedOrWeight(activity)
    const aim =
      target?.reps !== undefined ? `, ${plural(target.reps, 'rep', 'reps')}` : target ? `, ${plural(target.minutes, 'minute', 'minutes')}` : ''
    return { what: `${name}${ofSets}`, count, extra, words: `${name}${ofSets.replace(' ·', ',')}${aim}${extra ? `, ${extra}` : ''}` }
  }
  if (!between) return null
  const { name } = EXERCISES[between.kind]
  if (between.until === null) return { what: name, count: betweenText(between, now), words: `${name}, ${betweenWords(between)}` }
  const left = Math.max(0, Math.ceil((between.until - Math.max(now, between.since)) / 1000))
  return {
    what: `${name} · set ${between.set + 1} of ${between.target.sets} next`,
    count: `Rest ${clock(left)}`,
    extra: nextKg === undefined ? undefined : kgText(nextKg),
    words: `${name}, ${betweenWords(between)}`,
  }
}

// The strip on the other tabs: the card in one line ("Bicep curls · set 2 of 3 · 7 / 12 reps")
export const stripText = (card: CardWords) => `${card.what} · ${card.count}`

// Which card is showing: each set its own, the rest after a set, the end of a
// round, or none. (A change of pace or +30 s is the same card.) The card moves
// the cursor on when this changes under it.
export const cardKey = ({ activity, between }: Now) =>
  activity
    ? `set ${activity.session}`
    : between
      ? `${between.until === null ? 'done' : 'rest'} after ${between.kind} ${between.set}`
      : null
