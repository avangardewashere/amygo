// The rest between two sets of a round (v10): one timer, set for the rest's
// end, that gives the cues (a beep and a buzz) and starts the next set on the
// same machine, with the same weight picker and target. +30 s moves the end and
// the timer follows it; Skip, Finish or starting something else put it away. A
// timer, not the frame loop, so the rest ends on time on any tab. (The rest
// itself is the gym store's `between`, which stopExercise() starts.)
import { finishExercise, getGym, nextSet, subscribeGym } from '../interaction/gymStore'
import { cue } from './cues'

let stopWatching: (() => void) | null = null

export function startRounds() {
  if (stopWatching) return stopWatching
  let timer: ReturnType<typeof setTimeout> | undefined
  let armed: { since: number; until: number } | null = null

  // Called on every change to the gym: the timer follows the rest going on
  const follow = () => {
    const { between } = getGym()
    const rest = between && between.until !== null ? { since: between.since, until: between.until } : null
    if (rest?.since === armed?.since && rest?.until === armed?.until) return // the same rest, carrying on
    clearTimeout(timer)
    timer = undefined
    armed = rest
    if (!rest) return // no rest going on
    timer = setTimeout(
      () => {
        timer = undefined
        const now = getGym().between
        if (now?.since !== rest.since || now.until !== rest.until) return
        cue()
        // The next set; if its machine is gone, the round can't go on
        if (!nextSet()) finishExercise()
      },
      Math.max(0, rest.until - performance.now()),
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
