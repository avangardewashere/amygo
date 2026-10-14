// Walking away from a set means Done (decision V10-D4). But only a push begun
// while the set is going on: if the stick (or a key) was already held when the
// set began (say, wandering about while a rest ran out and the next set started
// by itself), it doesn't count until it has been let go once. Plain logic, no
// 3D, so it can be tested; <Player> asks it every frame.
import type { Activity } from '../interaction/gymStore'

export const WALK_AWAY = 0.1 // how far the stick must be pushed to count as walking

// A fresh watcher: call it every frame with how hard the stick is pushed (0…1)
// and the set going on; true means "this is walking away: end the set"
export function watchWalkingAway() {
  let session: number | null = null
  let heldFromStart = false
  return (strength: number, activity: Pick<Activity, 'session'> | null) => {
    const pushing = strength > WALK_AWAY
    if (!activity) {
      session = null
      return false
    }
    if (activity.session !== session) {
      session = activity.session
      heldFromStart = pushing
    } else if (!pushing) {
      heldFromStart = false
    }
    return pushing && !heldFromStart
  }
}
