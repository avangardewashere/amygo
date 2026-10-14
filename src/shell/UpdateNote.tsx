import { useGym } from '../interaction/gymStore'
import { applyUpdate, useUpdateReady } from '../offline/register'
import { APP_NAME } from './brand'

// "A new version of Amygo is ready · Reload", above the tabs. Never during an
// exercise or between its sets (a reload loses the set, and the round, in
// progress), and Amygo never reloads by itself.
export function UpdateNote() {
  const ready = useUpdateReady()
  const busy = useGym((s) => s.activity !== null || s.between !== null)
  if (!ready || busy) return null
  return (
    <div className="update-note" role="status">
      <span>A new version of {APP_NAME} is ready</span>
      <button type="button" className="list-button" onClick={applyUpdate}>
        Reload
      </button>
    </div>
  )
}
