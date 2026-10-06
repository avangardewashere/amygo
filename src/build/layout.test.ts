import { afterEach, describe, expect, it, vi } from 'vitest'
import { LAYOUT_KEY } from './layoutStorage'

// A stand-in for the browser's localStorage. \`broken\` makes every access throw,
// like a browser that blocks storage (private browsing, or storage full).
function fakeStorage({ broken = false, saved = null as string | null } = {}) {
  const data = new Map<string, string>()
  if (saved !== null) data.set(LAYOUT_KEY, saved)
  const fail = () => {
    throw new Error('storage blocked')
  }
  return {
    data,
    getItem: (key: string) => (broken ? fail() : (data.get(key) ?? null)),
    setItem: (key: string, value: string) => (broken ? fail() : data.set(key, value)),
    removeItem: (key: string) => data.delete(key),
  }
}

// "Open the page": load a fresh copy of the build state, which reads the saved layout
async function openGym(storage: ReturnType<typeof fakeStorage>) {
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  return import('./buildStore')
}

afterEach(() => vi.unstubAllGlobals())

type Build = Awaited<ReturnType<typeof openGym>>
const piece = (build: Build, id: string) => build.getBuild().items.find((item) => item.id === id)!

// Drag a piece by its middle and drop it over (x, z)
function move(build: Build, id: string, x: number, z: number) {
  const start = piece(build, id)
  build.startDrag(id, start.x, start.z)
  build.dragTo(x, z)
  build.endDrag()
}

describe('remembering the layout', () => {
  it('V5B1-T1: moved and rotated furniture is where you left it after a reload', async () => {
    const storage = fakeStorage()
    // Dropping a piece is remembered…
    let build = await openGym(storage)
    move(build, 'rack-1', 0, 0)
    build = await openGym(storage) // reload
    expect(piece(build, 'rack-1')).toMatchObject({ x: 0, z: 0 })

    // …and so is turning one
    const startTurns = piece(build, 'bench-1').turns
    build.select('bench-1')
    build.rotateSelected()
    const before = build.getBuild().items
    build = await openGym(storage) // reload
    expect(piece(build, 'bench-1').turns).toBe((startTurns + 1) % 4)
    expect(build.getBuild().items).toEqual(before)
  })

  it('V5B1-T2: damaged or wrong saved data falls back to the starting layout', async () => {
    const { DEFAULT_ITEMS } = await openGym(fakeStorage())
    const bad = [
      '{not json',
      '"just a string"',
      JSON.stringify({ version: 99, items: [{ id: 'rack-1', type: 'dumbbellRack', x: 0, z: 0, turns: 0 }] }),
      JSON.stringify({ version: 2, items: [{ id: 'rack-1', type: 'treadmill', x: 0, z: 0, turns: 0 }] }), // wrong type
      JSON.stringify({ version: 2, items: [{ id: 'rack-1', type: 'dumbbellRack', x: 'left', z: 0, turns: 0 }] }),
      JSON.stringify({ version: 2, items: [{ id: 'rack-1', type: 'dumbbellRack', x: 0, z: 0, turns: 7 }] }),
      JSON.stringify({ version: 2, items: [null, 5, { id: 'ghost-9', type: 'spaceship', x: 1, z: 1, turns: 0 }] }),
    ]
    for (const saved of bad) {
      const build = await openGym(fakeStorage({ saved }))
      expect(build.getBuild().items, saved).toEqual(DEFAULT_ITEMS)
    }
  })

  it('V5B1-T3: a machine missing from an old save still appears at its starting spot', async () => {
    const storage = fakeStorage()
    let build = await openGym(storage)
    move(build, 'rack-1', 0, 0)
    // An old save, from before the pull-up bar existed
    const old = JSON.parse(storage.data.get(LAYOUT_KEY)!)
    old.items = old.items.filter((item: { id: string }) => item.id !== 'pullup-1')
    storage.data.set(LAYOUT_KEY, JSON.stringify(old))

    build = await openGym(storage)
    expect(piece(build, 'rack-1')).toMatchObject({ x: 0, z: 0 }) // the save still counts…
    const start = build.DEFAULT_ITEMS.find((item) => item.id === 'pullup-1')!
    expect(piece(build, 'pullup-1')).toEqual(start) // …and the new machine is at its starting spot
  })

  it('V5B1-T4: Reset layout restores the starting arrangement and remembers it', async () => {
    const storage = fakeStorage()
    let build = await openGym(storage)
    move(build, 'rack-1', 0, 0)
    build.resetLayout()
    expect(build.getBuild().items).toEqual(build.DEFAULT_ITEMS)

    build = await openGym(storage) // reload: still reset
    expect(build.getBuild().items).toEqual(build.DEFAULT_ITEMS)
  })

  it('V5B1-T5: with storage blocked, the gym still loads and furniture still moves', async () => {
    const build = await openGym(fakeStorage({ broken: true }))
    expect(build.getBuild().items).toEqual(build.DEFAULT_ITEMS)
    expect(() => move(build, 'rack-1', 0, 0)).not.toThrow()
    expect(piece(build, 'rack-1')).toMatchObject({ x: 0, z: 0 })
    expect(() => build.resetLayout()).not.toThrow()
  })
})
