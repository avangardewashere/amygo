// Draws Amygo's icons from the mark in brand-mark.mjs. Run it by hand after
// changing the mark, and commit what it writes:
//   node scripts/make-icons.mjs           writes public/favicon.svg
//   node scripts/make-icons.mjs --check   changes nothing; fails (exit 1) if the
//                                         committed files aren't what it would write
// (The tests run --check, so the icon can't drift from its description.)
import { readFileSync, writeFileSync } from 'node:fs'
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

const FILES = { 'public/favicon.svg': faviconSvg() }

// Git may store these files with Windows line endings on the laptop, so line endings don't count
const same = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n')

if (process.argv.includes('--check')) {
  const stale = Object.entries(FILES).filter(([path, content]) => {
    try {
      return !same(readFileSync(path, 'utf8'), content)
    } catch {
      return true // missing
    }
  })
  if (stale.length) {
    console.error(`Icons out of date (run: node scripts/make-icons.mjs): ${stale.map(([path]) => path).join(', ')}`)
    process.exit(1)
  }
  console.log('Icons: up to date')
} else {
  for (const [path, content] of Object.entries(FILES)) writeFileSync(path, content)
  console.log(`Wrote ${Object.keys(FILES).join(', ')}`)
}
