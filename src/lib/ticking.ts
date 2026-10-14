import { useEffect, useState } from 'react'

// The exercise clock (performance.now) for something on screen that counts
// (reps, a rest's countdown): read again every `ms` while `on`. What's shown is
// worked out from the clock, so it's right after any pause, however long.
export function useTicking(on: boolean, ms: number) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!on) return
    const timer = setInterval(() => setNow(performance.now()), ms)
    return () => clearInterval(timer)
  }, [on, ms])
  return now
}
