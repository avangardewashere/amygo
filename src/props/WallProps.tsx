// The props on the walls: TVs over the treadmills, a clock showing the real
// time, speakers. Like everything on a wall they're flat and face into the
// room, so they disappear with their wall in the dollhouse view.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { Merged } from '../build/Merged'
import { ROOM } from '../scene/dimensions'
import { WALLS } from '../scene/wallDesign'
import { WALL_PROPS, clockAngles, type WallProp } from './propLayout'

const H = ROOM.height
const OFF_WALL = 0.03 // in front of every painted layer
const STEP = 0.006 // each part in front of the one behind it

// A flat rectangle facing into the room, `layer` steps off the prop's back
function Flat({ w, h, at, color, layer, glow = false }: { w: number; h: number; at: [number, number]; color: string; layer: number; glow?: boolean }) {
  return (
    <mesh position={[at[0], at[1], layer * STEP]}>
      <planeGeometry args={[w, h]} />
      {glow ? <meshBasicMaterial color={color} toneMapped={false} /> : <meshStandardMaterial color={color} roughness={0.5} />}
    </mesh>
  )
}

function Disc({ r, at, color, layer }: { r: number; at: [number, number]; color: string; layer: number }) {
  return (
    <mesh position={[at[0], at[1], layer * STEP]}>
      <circleGeometry args={[r, 32]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  )
}

const LOOP_SECONDS = 20 // the TV's workout timer bar fills over this long, then starts again

// A wall TV showing a workout screen: a few stat bars and a timer bar that fills up
function Tv({ w, h }: { w: number; h: number }) {
  const bar = useRef<Mesh>(null)
  const screenW = w - 0.06
  const screenH = h - 0.06
  const barW = screenW - 0.12
  useFrame(({ clock }) => {
    const share = ((clock.elapsedTime % LOOP_SECONDS) / LOOP_SECONDS) * 0.999 + 0.001
    bar.current!.scale.x = share
    bar.current!.position.x = -barW / 2 + (barW * share) / 2 // grows from the left
  })
  return (
    <group>
      <Flat w={w} h={h} at={[0, 0]} color="#0c0d0f" layer={0} />
      <Flat w={screenW} h={screenH} at={[0, 0]} color="#0f2c4a" layer={1} glow />
      {[0.35, 0.6, 0.45, 0.8, 0.55].map((height, i) => (
        <Flat key={i} w={0.12} h={height * screenH * 0.55} at={[-screenW / 2 + 0.2 + i * 0.18, -screenH / 2 + 0.16 + (height * screenH * 0.55) / 2]} color="#38bdf8" layer={2} glow />
      ))}
      <Flat w={barW} h={0.035} at={[0, screenH / 2 - 0.08]} color="#1e4a73" layer={2} glow />
      <mesh ref={bar} userData={{ moving: true }} position={[0, screenH / 2 - 0.08, 3 * STEP]}>
        <planeGeometry args={[barW, 0.035]} />
        <meshBasicMaterial color="#e4572e" toneMapped={false} />
      </mesh>
    </group>
  )
}

// A hand pointing up from the clock's middle, turned to `angle` each frame
function Hand({ length, width, color, layer, handRef }: { length: number; width: number; color: string; layer: number; handRef: React.RefObject<Group | null> }) {
  return (
    <group ref={handRef} userData={{ moving: true }}>
      <Flat w={width} h={length} at={[0, length / 2 - 0.02]} color={color} layer={layer} />
    </group>
  )
}

function Clock({ w }: { w: number }) {
  const r = w / 2
  const hour = useRef<Group>(null)
  const minute = useRef<Group>(null)
  const second = useRef<Group>(null)
  useFrame(() => {
    const angles = clockAngles(new Date())
    // Clockwise from 12, as seen from the room: a negative turn about z
    hour.current!.rotation.z = -angles.hour
    minute.current!.rotation.z = -angles.minute
    second.current!.rotation.z = -angles.second
  })
  return (
    <group>
      <Disc r={r} at={[0, 0]} color="#1b1c1f" layer={0} />
      <Disc r={r - 0.02} at={[0, 0]} color="#f2efe8" layer={1} />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const long = i % 3 === 0
        const at = r - 0.05
        return (
          <group key={i} rotation-z={-angle}>
            <Flat w={long ? 0.02 : 0.01} h={long ? 0.05 : 0.03} at={[0, at]} color="#1b1c1f" layer={2} />
          </group>
        )
      })}
      <Hand handRef={hour} length={r * 0.5} width={0.022} color="#1b1c1f" layer={3} />
      <Hand handRef={minute} length={r * 0.78} width={0.015} color="#1b1c1f" layer={4} />
      <Hand handRef={second} length={r * 0.85} width={0.006} color="#e4572e" layer={5} />
    </group>
  )
}

function Speaker({ w, h }: { w: number; h: number }) {
  return (
    <group>
      <Flat w={w} h={h} at={[0, 0]} color="#18191c" layer={0} />
      <Disc r={w * 0.32} at={[0, -h * 0.18]} color="#2c2e33" layer={1} />
      <Disc r={w * 0.14} at={[0, h * 0.27]} color="#2c2e33" layer={1} />
    </group>
  )
}

function WallPropView({ prop }: { prop: WallProp }) {
  const w = prop.to - prop.from
  const h = prop.top - prop.bottom
  if (prop.kind === 'tv') return <Tv w={w} h={h} />
  if (prop.kind === 'clock') return <Clock w={w} />
  return <Speaker w={w} h={h} />
}

export function WallProps() {
  return (
    <Merged>
      {WALL_PROPS.map((prop) => {
        const wall = WALLS[prop.wall]
        return (
          <group key={prop.id} position={wall.position} rotation-y={wall.rotationY}>
            <group position={[(prop.from + prop.to) / 2, (prop.bottom + prop.top) / 2 - H / 2, OFF_WALL]}>
              <WallPropView prop={prop} />
            </group>
          </group>
        )
      })}
    </Merged>
  )
}
