// Draws Amygo's icons from the mark in brand-mark.mjs. Run it by hand after
// changing the mark, and commit what it writes:
//   node scripts/make-icons.mjs           writes public/favicon.svg and public/icons/*.png
//   node scripts/make-icons.mjs --check   changes nothing; fails (exit 1) if the
//                                         committed files aren't what it would write
// (The tests run --check, so the icons can't drift from their description.)
//
// The PNGs are drawn here too, with no image tools: a PNG is a short header,
// rows of pixels squeezed with zlib (built into Node), and a checksum per part.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync, inflateSync } from 'node:zlib'
import { BACKGROUND, DARK, MARK, ORANGE, SIZE } from './brand-mark.mjs'

const number = (value) => String(Math.round(value * 100) / 100)

const shape = (item) =>
  item.polygon
    ? `<polygon points="${item.polygon.map(([x, y]) => `${number(x)},${number(y)}`).join(' ')}"/>`
    : `<circle cx="${number(item.circle[0])}" cy="${number(item.circle[1])}" r="${number(item.circle[2])}"/>`

// The browser-tab icon: the mark on its rounded dark square
export function faviconSvg() {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<g fill="${DARK}">${BACKGROUND.map(shape).join('')}</g>` +
    `<g fill="${ORANGE}">${MARK.map(shape).join('')}</g>` +
    `</svg>\n`
  )
}

// ---------- Drawing the mark into pixels ----------

// The box around a shape: points outside it can't be in the shape (a quick first check)
function withBox(item) {
  if (item.circle) {
    const [cx, cy, r] = item.circle
    return { ...item, box: [cx - r, cy - r, cx + r, cy + r] }
  }
  const xs = item.polygon.map(([x]) => x)
  const ys = item.polygon.map(([, y]) => y)
  return { ...item, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
}

// Is the point (x, y) inside the shape? (Polygons: count how many edges a line
// to the right crosses; an odd count is inside.)
function inside(item, x, y) {
  const [left, top, right, bottom] = item.box
  if (x < left || x > right || y < top || y > bottom) return false
  if (item.circle) {
    const [cx, cy, r] = item.circle
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }
  let isIn = false
  const points = item.polygon
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) isIn = !isIn
  }
  return isIn
}

// The mark made smaller (or bigger) around the middle of the square
const scaled = (items, scale) =>
  items.map((item) =>
    item.circle
      ? { circle: [SIZE / 2 + (item.circle[0] - SIZE / 2) * scale, SIZE / 2 + (item.circle[1] - SIZE / 2) * scale, item.circle[2] * scale] }
      : { polygon: item.polygon.map(([x, y]) => [SIZE / 2 + (x - SIZE / 2) * scale, SIZE / 2 + (y - SIZE / 2) * scale]) },
  )

const FULL_SQUARE = [{ polygon: [[0, 0], [SIZE, 0], [SIZE, SIZE], [0, SIZE]] }]
const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))

// Pixels (red, green, blue, opacity per pixel, row by row) of the mark at `pixels`
// × `pixels`. Each pixel is sampled 4 × 4 times, so edges come out smooth.
export function drawIcon(pixels, { background: shapes = BACKGROUND, markScale = 1 } = {}) {
  const mark = scaled(MARK, markScale).map(withBox)
  const background = shapes.map(withBox)
  const [dr, dg, db] = rgb(DARK)
  const [or, og, ob] = rgb(ORANGE)
  const out = new Uint8Array(pixels * pixels * 4)
  const SAMPLES = 4
  for (let py = 0; py < pixels; py++) {
    for (let px = 0; px < pixels; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = ((px + (sx + 0.5) / SAMPLES) / pixels) * SIZE
          const y = ((py + (sy + 0.5) / SAMPLES) / pixels) * SIZE
          if (mark.some((item) => inside(item, x, y))) {
            r += or
            g += og
            b += ob
            a += 1
          } else if (background.some((item) => inside(item, x, y))) {
            r += dr
            g += dg
            b += db
            a += 1
          }
        }
      }
      const at = (py * pixels + px) * 4
      // Colour averaged over the covered samples; opacity = how much was covered
      out[at] = a ? Math.round(r / a) : 0
      out[at + 1] = a ? Math.round(g / a) : 0
      out[at + 2] = a ? Math.round(b / a) : 0
      out[at + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255)
    }
  }
  return out
}

// ---------- The PNG file format ----------

const chunk = (type, data) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, sum])
}

// Rows of pixels, each with a leading 0 ("no filter"), as PNG keeps them before squeezing
const rows = (rgba, pixels) => {
  const raw = Buffer.alloc(pixels * (pixels * 4 + 1))
  for (let y = 0; y < pixels; y++) Buffer.from(rgba.buffer, y * pixels * 4, pixels * 4).copy(raw, y * (pixels * 4 + 1) + 1)
  return raw
}

export function encodePng(rgba, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(pixels, 0)
  header.writeUInt32BE(pixels, 4)
  header[8] = 8 // 8 bits per colour
  header[9] = 6 // red, green, blue and opacity
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // every PNG starts like this
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows(rgba, pixels), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// A PNG's size and unsqueezed rows (what --check compares: the pixels, whatever zlib version squeezed them)
export function readPng(file) {
  let at = 8
  let width = 0
  let height = 0
  const data = []
  while (at < file.length) {
    const length = file.readUInt32BE(at)
    const type = file.toString('latin1', at + 4, at + 8)
    const body = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
    }
    if (type === 'IDAT') data.push(body)
    at += 12 + length
  }
  return { width, height, rows: inflateSync(Buffer.concat(data)) }
}

// ---------- The icons ----------

// Android cuts "maskable" icons into its own shape (a circle, a rounded square…), so on
// those the mark stays inside the middle circle (radius 40% of the icon) on a full square
export const MASKABLE_MARK_SCALE = 0.76

export const ICONS = {
  'public/icons/icon-192.png': { pixels: 192 },
  'public/icons/icon-512.png': { pixels: 512 },
  'public/icons/maskable-512.png': { pixels: 512, background: FULL_SQUARE, markScale: MASKABLE_MARK_SCALE },
  // iPhones round the corners themselves (iOS is never a required check, but it costs nothing)
  'public/icons/apple-touch-icon-180.png': { pixels: 180, background: FULL_SQUARE, markScale: 0.86 },
}

const drawn = (options) => rows(drawIcon(options.pixels, options), options.pixels)

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())
if (isMain) {
  // Git may store the SVG with Windows line endings on the laptop, so line endings don't count
  const sameText = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n')
  if (process.argv.includes('--check')) {
    const stale = []
    try {
      if (!sameText(readFileSync('public/favicon.svg', 'utf8'), faviconSvg())) stale.push('public/favicon.svg')
    } catch {
      stale.push('public/favicon.svg')
    }
    for (const [path, options] of Object.entries(ICONS)) {
      try {
        const committed = readPng(readFileSync(path))
        if (committed.width !== options.pixels || !committed.rows.equals(drawn(options))) stale.push(path)
      } catch {
        stale.push(path) // missing or unreadable
      }
    }
    if (stale.length) {
      console.error(`Icons out of date (run: node scripts/make-icons.mjs): ${stale.join(', ')}`)
      process.exit(1)
    }
    console.log('Icons: up to date')
  } else {
    writeFileSync('public/favicon.svg', faviconSvg())
    mkdirSync('public/icons', { recursive: true })
    for (const [path, options] of Object.entries(ICONS)) writeFileSync(path, encodePng(drawIcon(options.pixels, options), options.pixels))
    console.log(`Wrote public/favicon.svg, ${Object.keys(ICONS).join(', ')}`)
  }
}
