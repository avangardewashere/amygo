// The workout card's height, kept on the app as a CSS variable while the card
// is shown, so the joystick sits above it (see .joystick in index.css). Plain
// code with no React, so it can be tested with stand-ins for the page.
export const CARD_HEIGHT = '--workout-card'

// Follow `card`'s height (now, and whenever it changes); returns the way to stop,
// which takes the variable away (no card, no lift)
export function followCardHeight(card: HTMLElement) {
  const app = card.closest<HTMLElement>('.app')
  if (!app) return () => {}
  const fit = () => app.style.setProperty(CARD_HEIGHT, `${card.offsetHeight}px`)
  fit()
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
  observer?.observe(card)
  return () => {
    observer?.disconnect()
    app.style.removeProperty(CARD_HEIGHT)
  }
}
