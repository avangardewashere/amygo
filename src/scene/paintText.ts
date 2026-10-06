// Fitting a painted word into its box on the wall. Pure maths (the actual
// text measuring is passed in), so tests can check words are never squashed.
//
// The idea: the canvas the word is painted on has exactly the box's
// proportions, so pixels map to the wall evenly in both directions. The font
// is then sized to fill the box's height, and shrunk only if the word would
// be wider than the box.

export const PIXELS_PER_METER = 256 // sharp enough to read up close
export const MAX_TEXTURE = 2048 // the largest canvas side; phones may refuse bigger
export const SIDE_MARGIN = 0.04 // share of the width kept clear at each end

// Capitals fill about this share of the font size (Impact-like fonts run tall)
const CAP_SHARE = 0.78

export const PAINT_FONT = '"Impact", "Arial Black", "Helvetica Neue", Arial, sans-serif'
export const fontFor = (px: number) => `900 ${px}px ${PAINT_FONT}`

// Canvas size (pixels) for a box of `width` × `height` meters: same proportions, capped
export function canvasSize(width: number, height: number) {
  const scale = Math.min(PIXELS_PER_METER, MAX_TEXTURE / width, MAX_TEXTURE / height)
  // Round the height to whole pixels, then take the width from it, so the
  // proportions stay true (rounding both separately can skew them)
  const px = Math.round(height * scale)
  return { width: Math.min(Math.round((px * width) / height), MAX_TEXTURE), height: px }
}

// The font size (pixels) that fills the canvas height without spilling past the sides.
// `measure` says how wide `text` is at a given font size.
export function fitFont(text: string, canvas: { width: number; height: number }, measure: (text: string, px: number) => number) {
  const byHeight = canvas.height / CAP_SHARE * 0.92 // leave a little room top and bottom
  const room = canvas.width * (1 - 2 * SIDE_MARGIN)
  const wide = measure(text, byHeight)
  return wide > room ? byHeight * (room / wide) : byHeight
}
