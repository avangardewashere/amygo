import { Fragment, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { EXERCISES } from '../exercises/catalog'
import { createStore } from '../lib/store'
import { checkEdit, hasErrors, type EditField } from '../log/edit'
import { cancelEdit, SAVE_FIRST, saveEdit, startEdit, typeEdit, useEditing, useEditingId } from '../log/editing'
import { tapRemove, tapUndo, UNDO_SECONDS } from '../log/logStore'
import { setNumbers } from '../log/logText'
import type { LoggedSet } from '../log/sets'

// A row's line of text in its " · "-separated parts. Each part stays together
// when it fits ("at 14:05", "0.50 km"), so a narrow phone breaks the line
// between parts, not inside one. (See .part in index.css.)
const parts = (text: string) =>
  text.split(' · ').map((part, index) => (
    <Fragment key={index}>
      {index > 0 && ' · '}
      <span className="part">{part}</span>
    </Fragment>
  ))

// What just happened to a set, for screen readers: "Removed Bicep curls, 12 reps. Undo for 6 seconds."
const said = createStore({ text: '' })

// Emptied first and set a moment later, so the same words twice (two sets with
// the same numbers removed in a row) are still read out as new
function announce(text: string) {
  said.set({ text: '' })
  setTimeout(() => said.set({ text }), 100)
}

// The one line that reads it out, once per page (it starts empty, and is
// emptied again on leaving, so nothing old is read out next time)
export function SetAnnouncer() {
  const text = said.useSelect((s) => s.text)
  useEffect(() => () => said.set({ text: '' }), [])
  return (
    <p className="visually-hidden" role="status">
      {text}
    </p>
  )
}

// A set being fixed: its numbers as fields (reps and kg, or minutes and
// seconds), with Save and Cancel. Save is off while a number is wrong; why is
// said under the fields once typing has paused, not at every key. The same line
// says "Save or cancel this set first" when Edit was tapped on another row
// while this form held a change.
// (Only this row follows the typing; the lists around it don't redraw.)
function EditRow({ set, heading }: { set: LoggedSet; heading: string }) {
  const editing = useEditing()
  if (!editing || editing.id !== set.id) return null
  const { typed, settled, blocked } = editing
  const { errors } = checkEdit(set, typed)
  const shown = settled ? errors : {}
  const why = Object.values(shown).join(' ') || (blocked ? SAVE_FIRST : '')
  const { name, speed, load } = EXERCISES[set.kind]
  const wrong = (field: EditField) => (field === 'reps' ? shown.reps : field === 'kg' ? shown.kg : shown.time) !== undefined

  const field = (id: EditField, label: string, mode: 'numeric' | 'decimal', place: { first?: boolean; last?: boolean }) => (
    <label className="edit-field">
      <input
        type="text"
        inputMode={mode} // phones show their number pad
        autoComplete="off"
        enterKeyHint={place.last ? 'done' : 'next'} // the keyboard's own key: on to the next field, Save from the last
        autoFocus={place.first} // Edit puts you in the first field
        value={typed[id] ?? ''}
        aria-invalid={wrong(id)}
        aria-describedby={`edit-why-${set.id}`}
        onChange={(event) => typeEdit(id, event.target.value)}
        onFocus={(event) => event.target.select()}
      />
      {label}
    </label>
  )
  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveEdit()
  }
  // Escape closes the form, and only the form (not the page under it)
  const keys = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    cancelEdit()
  }

  return (
    <li className="is-editing">
      <form onSubmit={submit} onKeyDown={keys} aria-label={`Edit ${name}`}>
        <strong>{parts(heading)}</strong>
        <div className="edit-fields">
          {speed ? (
            <>
              {field('minutes', 'min', 'numeric', { first: true })}
              {field('seconds', 'sec', 'numeric', { last: true })}
            </>
          ) : (
            <>
              {field('reps', 'reps', 'numeric', { first: true, last: !load })}
              {load && field('kg', 'kg', 'decimal', { last: true })}
            </>
          )}
        </div>
        <p id={`edit-why-${set.id}`} className="edit-why" role="status">
          {why}
        </p>
        <div className="edit-actions">
          <button type="submit" className="list-button is-primary" disabled={hasErrors(errors)}>
            Save
          </button>
          <button type="button" className="list-button" onClick={cancelEdit}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  )
}

// A list of saved sets, each with Edit (for a wrong number) and Remove (for a
// set you didn't mean to save). A removed set's row stays where it was for a few
// seconds as "Removed · Undo" (`removed`: the ones removed from this list).
// `heading` and `detail` word a row's two lines; the pages word them differently.
export function SetRows({
  sets,
  removed,
  heading,
  detail,
}: {
  sets: LoggedSet[]
  removed: LoggedSet[]
  heading: (set: LoggedSet) => string
  detail: (set: LoggedSet) => string
}) {
  const editingId = useEditingId()
  const list = useRef<HTMLUListElement>(null)

  const gone = new Set(removed.map((set) => set.id))
  // Newest first; a removed set keeps its place among the others
  const rows = [...sets.filter((set) => !gone.has(set.id)), ...removed].sort((a, b) => b.endedAt - a.endedAt)
  const shownIds = rows.map((set) => set.id)

  // When a form closes (Save, Cancel, Escape), focus goes back to that row's Edit button
  const wasEditing = useRef<string | null>(null)
  useEffect(() => {
    if (wasEditing.current && !editingId) document.getElementById(`edit-${wasEditing.current}`)?.focus()
    wasEditing.current = editingId
  }, [editingId])

  // When an Undo row runs out while focus is on its button, the focus would be
  // lost with it: it goes to the row that took its place (or the one before),
  // without moving the page
  const wasShown = useRef<string[]>([])
  useEffect(() => {
    const leftAt = wasShown.current.findIndex((id) => !shownIds.includes(id))
    if (leftAt >= 0 && document.activeElement === document.body) {
      const neighbour = list.current?.children[Math.min(leftAt, shownIds.length - 1)]
      neighbour?.querySelector('button')?.focus({ preventScroll: true })
    }
    wasShown.current = shownIds
  })

  const what = (set: LoggedSet) => `${EXERCISES[set.kind].name}, ${setNumbers(set)}`
  // Edit. If another row's form is open with something changed in it, that one
  // stays (see startEdit), says why in its own line, and is brought into view
  // (its day reopened if it was closed), with the cursor in its wrong field if
  // it has one. (A moment later, once the form has been redrawn with its reason.)
  const edit = (set: LoggedSet) => {
    if (startEdit(set.id)) return
    setTimeout(() => {
      const form = document.querySelector<HTMLFormElement>('.set-list form')
      const day = form?.closest('details')
      if (day) day.open = true
      const wrong = form?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ;(wrong ?? form?.querySelector<HTMLInputElement>('input'))?.focus()
    }, 0)
  }
  const remove = (set: LoggedSet) => {
    if (tapRemove(set.id)) announce(`Removed ${what(set)}. Undo for ${UNDO_SECONDS} seconds.`)
  }
  // After Undo the row is back: focus goes to its Remove button, where it was
  const undo = (set: LoggedSet) => {
    if (!tapUndo(set.id)) return
    announce(`Put back ${what(set)}.`)
    setTimeout(() => document.getElementById(`remove-${set.id}`)?.focus(), 0)
  }

  return (
    <ul className="set-list" ref={list}>
      {rows.map((set) => {
        if (gone.has(set.id)) {
          return (
            <li key={set.id} className="is-removed">
              <div>
                <strong>Removed</strong>
                <span>{parts(`${EXERCISES[set.kind].name} · ${setNumbers(set)}`)}</span>
              </div>
              <button type="button" className="list-button" autoFocus onClick={() => undo(set)}>
                Undo
              </button>
            </li>
          )
        }
        if (editingId === set.id) return <EditRow key={set.id} set={set} heading={heading(set)} />
        // (named in full for screen readers: two sets with the same numbers differ by their time)
        const named = `${heading(set)}, ${detail(set)}`
        return (
          <li key={set.id}>
            <div>
              <strong>{parts(heading(set))}</strong>
              <span>{parts(detail(set))}</span>
            </div>
            <div className="row-actions">
              <button
                type="button"
                id={`edit-${set.id}`}
                className="list-button is-quiet"
                aria-label={`Edit: ${named}`}
                onClick={() => edit(set)}
              >
                Edit
              </button>
              <button
                type="button"
                id={`remove-${set.id}`}
                className="list-button"
                aria-label={`Remove: ${named}`}
                onClick={() => remove(set)}
              >
                Remove
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
