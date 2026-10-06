import { onHome } from '../shell/tabStore'

// Shared movement input. Keyboard and the on-screen joystick both write here,
// and the player reads it every frame. It's a plain object (not React state)
// because it changes many times a second and nothing needs to re-render.
//
// x: -1 (left) … 1 (right)    y: -1 (back/toward camera) … 1 (forward/away)
export const input = {
  keyboard: { x: 0, y: 0 },
  joystick: { x: 0, y: 0 },
}

// Combined direction, capped so diagonals aren't faster than straight lines
export function readMove() {
  let x = input.keyboard.x + input.joystick.x
  let y = input.keyboard.y + input.joystick.y
  const length = Math.hypot(x, y)
  if (length > 1) {
    x /= length
    y /= length
  }
  return { x, y }
}

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

// Starts listening to WASD / arrow keys. Returns a function that stops listening.
export function listenToKeyboard() {
  const held = new Set<string>()

  const update = () => {
    let x = 0
    let y = 0
    for (const code of held) {
      x += KEYS[code][0]
      y += KEYS[code][1]
    }
    input.keyboard.x = Math.sign(x)
    input.keyboard.y = Math.sign(y)
  }

  const onDown = (e: KeyboardEvent) => {
    if (!(e.code in KEYS)) return
    if (!onHome()) return // the gym isn't in front: don't walk (key-ups still count, below)
    e.preventDefault() // stop arrow keys from scrolling the page
    held.add(e.code)
    update()
  }
  const onUp = (e: KeyboardEvent) => {
    held.delete(e.code)
    update()
  }
  // If the window loses focus mid-press, the key-up never arrives: stop walking
  const onBlur = () => {
    held.clear()
    update()
  }

  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', onBlur)
  return () => {
    window.removeEventListener('keydown', onDown)
    window.removeEventListener('keyup', onUp)
    window.removeEventListener('blur', onBlur)
  }
}
