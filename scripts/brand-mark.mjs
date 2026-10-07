// Amygo's mark: an A whose crossbar is a dumbbell, in Amygo orange on the app's
// dark background. Described as plain shapes on a 100 × 100 grid, only
// straight-edged polygons and circles, so our own script (make-icons.mjs) can
// draw it at any size without design tools.

export const SIZE = 100
export const DARK = '#111214' // the app's background (index.css :root)
export const ORANGE = '#e4572e' // Amygo orange: the wall stripe, the painted name, the open tab

const rect = (x1, y1, x2, y2) => ({ polygon: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] })

// The background: a square with rounded corners (two crossed rectangles, and a circle in each corner)
const R = 22
export const BACKGROUND = [
  rect(R, 0, SIZE - R, SIZE),
  rect(0, R, SIZE, SIZE - R),
  ...[[R, R], [SIZE - R, R], [R, SIZE - R], [SIZE - R, SIZE - R]].map(([x, y]) => ({ circle: [x, y, R] })),
]

export const MARK = [
  // The A's two legs, meeting at the top
  { polygon: [[45, 15], [55, 15], [30, 85], [18, 85]] },
  { polygon: [[45, 15], [55, 15], [82, 85], [70, 85]] },
  // The crossbar is a dumbbell: a bar, a collar and a plate at each end
  rect(26, 56, 74, 62),
  rect(23, 51, 27, 67),
  rect(73, 51, 77, 67),
  rect(13, 46, 23, 72),
  rect(77, 46, 87, 72),
]
