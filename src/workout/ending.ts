// A set with a target ends by itself (v10): after its last rep, or when its
// minutes are up, as if Done were tapped. One timer, set for that moment when
// the set begins (on arriving at the machine, or at once from the list), and
// put away if the set ends some other way first: Done, Stop, Finish, walking
// away, another exercise. A timer, not the frame loop, so the set ends on time
// on any tab, with the gym not being drawn.
import { endsAt, getGym, stopExercise, subscribeGym } from '../interaction/gymStore'

// A moment past the last rep, so the count has surely reached it
// (12 × 2.4 s is 28.799999… s in computer arithmetic, a hair short of 12 reps)
export const END_MARGIN_MS = 50

let stopWatching: (() => void) | null = null

export function startEnding() {
  if (stopWatching) return stopWatching
  let timer: ReturnType<typeof setTimeout> | undefined
  let armed: { session: number; end: number | null } = { session: -1, end: null }

  // Called on every change to the gym: the timer follows the set in progress
  const follow = () => {
    const { activity } = getGym()
    const session = activity?.session ?? -1
    const end = activity ? endsAt(activity) : null
    if (session === armed.session && end === armed.end) return // the same set, carrying on
    clearTimeout(timer)
    timer = undefined
    armed = { session, end }
    if (end === null) return // nothing in progress, no target, or still stepping on
    timer = setTimeout(
      () => {
        timer = undefined
        if (getGym().activity?.session === session) stopExercise()
      },
      Math.max(0, end + END_MARGIN_MS - performance.now()),
    )
  }

  follow()
  const unsubscribe = subscribeGym(follow)
  stopWatching = () => {
    unsubscribe()
    clearTimeout(timer)
    stopWatching = null
  }
  return stopWatching
}
