// The set being fixed right now, and what's typed in its form. Kept here, not
// inside the form, so there is only ever one form open, and so what Save and
// Cancel do can be tested without a browser.
import { createStore } from '../lib/store'
import { changesNothing, checkEdit, hasErrors, typedFor, type EditField, type Typed } from './edit'
import { editSet, getLog, subscribeLog } from './logStore'
import type { LoggedSet } from './sets'

// How long after the last key a wrong number is pointed out. Not sooner: "6" on
// the way to "62.5" isn't a mistake, and a reason flashing at every key is noise.
export const TYPING_PAUSE_MS = 700

// Shown in an open form that kept another row's Edit from opening
export const SAVE_FIRST = 'Save or cancel this set first.'

// id and typed: the row and its form's text. settled: typing has paused (or Save
// was refused), so reasons may show. blocked: Edit was tapped on another row
// while this form held a change, so it says SAVE_FIRST (until the next key).
// of: the set as it was when Edit was tapped.
type Editing = { id: string; typed: Typed; settled: boolean; blocked: boolean; of: LoggedSet }
const store = createStore({ editing: null as Editing | null })
let pause: ReturnType<typeof setTimeout> | undefined

export const useEditing = () => store.useSelect((s) => s.editing)
// Just which row has the form (a list redraws when that changes, not at every key typed in it)
export const useEditingId = () => store.useSelect((s) => s.editing?.id ?? null)
export const getEditing = () => store.get().editing

const setWith = (id: string) => getLog().sets.find((set) => set.id === id)

function close() {
  clearTimeout(pause)
  if (store.get().editing) store.set({ editing: null })
}

// The set under an open form went, or its numbers changed (another window, a
// Clear history): the form closes, so it can't put its old numbers back over
// newer ones. (The same numbers in a freshly read copy of the log don't count.)
subscribeLog(() => {
  const { editing } = store.get()
  if (!editing) return
  const now = setWith(editing.id)
  const { of } = editing
  if (!now || now.reps !== of.reps || now.kg !== of.kg || now.seconds !== of.seconds) close()
})

// Typing has paused: any reasons may show now
function settle() {
  const { editing } = store.get()
  if (editing && !editing.settled) store.set({ editing: { ...editing, settled: true } })
}

// Edit: the row turns into a form holding the set's numbers as they are. Only
// one form is open at a time. If another row's form holds a change (or a wrong
// number), it stays open and this one doesn't: closing it would either throw
// the change away or save numbers still being typed, and neither is ours to
// choose. That form then says why (its wrong number, or SAVE_FIRST), and the
// page brings it into view. A form nothing was changed in just closes. Returns
// whether this row's form opened.
export function startEdit(id: string) {
  const open = store.get().editing
  if (open && open.id !== id) {
    const other = setWith(open.id)
    if (other) {
      const { edit, errors } = checkEdit(other, open.typed)
      if (hasErrors(errors) || !changesNothing(edit)) {
        clearTimeout(pause)
        store.set({ editing: { ...open, settled: true, blocked: true } })
        return false
      }
    }
    close()
  }
  const set = setWith(id)
  if (!set) return false
  clearTimeout(pause)
  store.set({ editing: { id, typed: typedFor(set), settled: true, blocked: false, of: set } })
  return true
}

// A key pressed in one of the form's fields
export function typeEdit(field: EditField, text: string) {
  const { editing } = store.get()
  if (!editing) return
  clearTimeout(pause)
  store.set({ editing: { ...editing, typed: { ...editing.typed, [field]: text }, settled: false, blocked: false } })
  pause = setTimeout(settle, TYPING_PAUSE_MS)
}

// Cancel (or Escape): the form closes and the set is as it was
export const cancelEdit = close

// Save: only if every field checks out (the button is off otherwise). The set
// keeps its id, exercise and time of day. Returns whether the form closed.
export function saveEdit() {
  const { editing } = store.get()
  if (!editing) return false
  const set = setWith(editing.id)
  if (!set) {
    close() // the set has gone meanwhile
    return false
  }
  const { edit, errors } = checkEdit(set, editing.typed)
  if (hasErrors(errors)) {
    clearTimeout(pause)
    settle() // refused: say why at once
    return false
  }
  editSet(editing.id, edit) // (a real change closes the form through the log; this covers "nothing changed")
  close()
  return true
}
