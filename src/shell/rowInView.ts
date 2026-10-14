// The workout card's Change opens the Exercises list on the exercise's row:
// the row comes to the middle of the list, and the cursor goes to its History
// button (without scrolling again). Plain code, testable with a stand-in page.
import type { ExerciseKind } from '../exercises/catalog'

// The History button's id for an exercise (focus also comes back to it from its page)
export const historyButtonId = (kind: ExerciseKind) => `history-${kind}`

type Page = Pick<Document, 'getElementById'>

export function bringRowIntoView(kind: ExerciseKind, page: Page = document) {
  const button = page.getElementById(historyButtonId(kind))
  if (!button) return false
  button.closest('li')?.scrollIntoView({ block: 'center' })
  button.focus({ preventScroll: true })
  return true
}
