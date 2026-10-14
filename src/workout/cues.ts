// The end of a rest, told without looking at the screen (v10): a short beep and
// a buzz. Each can be switched off in Workout settings. A browser lets a page
// make sound only after a tap, so the sound is made ready on the tap that starts
// a set (primeSound, from gymStore's start) and that one is reused for every beep.
// Buzzing is Android only on the web; elsewhere it's quietly skipped.
import { getSettings } from '../settings/settings'

const BEEP_HZ = 880 // a clear, high A
const BEEP_SECONDS = 0.15
const BUZZ_MS = 200

type AudioLike = Pick<AudioContext, 'state' | 'currentTime' | 'destination' | 'createOscillator' | 'createGain' | 'resume'>
let sound: AudioLike | null = null

// Has the page been tapped (or typed into) yet? The browser allows sound and
// buzzing only after that, and complains in its console when asked before.
// (A browser that can't tell is trusted to sort it out itself.)
const tapped = () => globalThis.navigator?.userActivation?.hasBeenActive ?? true

// On a tap that starts a set: make the sound ready, once (if beeps are on)
export function primeSound() {
  if (sound || !getSettings().beep || !tapped()) return
  const Context = globalThis.AudioContext as (new () => AudioLike) | undefined
  if (!Context) return
  try {
    sound = new Context()
  } catch {
    sound = null
  }
}

// A short tone that fades in and out (no click). False if it can't play.
export function beep() {
  if (!getSettings().beep || !sound) return false
  try {
    if (sound.state === 'suspended') void sound.resume().catch(() => {})
    const start = sound.currentTime
    const tone = sound.createOscillator()
    const level = sound.createGain()
    tone.type = 'sine'
    tone.frequency.value = BEEP_HZ
    level.gain.setValueAtTime(0.0001, start)
    level.gain.exponentialRampToValueAtTime(0.3, start + 0.01)
    level.gain.exponentialRampToValueAtTime(0.0001, start + BEEP_SECONDS)
    tone.connect(level).connect(sound.destination)
    tone.start(start)
    tone.stop(start + BEEP_SECONDS + 0.02)
    return true
  } catch {
    return false
  }
}

// A short buzz, where the phone can. False if it can't.
export function buzz() {
  if (!getSettings().buzz || !tapped()) return false
  try {
    return globalThis.navigator?.vibrate?.(BUZZ_MS) ?? false
  } catch {
    return false
  }
}

// Both, as a rest ends
export function cue() {
  beep()
  buzz()
}
