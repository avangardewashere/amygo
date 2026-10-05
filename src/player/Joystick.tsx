import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { input } from './input'

const RADIUS = 50 // how far (px) the knob can travel from the center

// On-screen thumbstick for touch screens. Hidden on desktop by CSS.
export function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const moveTo = (e: PointerEvent) => {
    const rect = base.current!.getBoundingClientRect()
    let dx = e.clientX - (rect.left + rect.width / 2)
    let dy = e.clientY - (rect.top + rect.height / 2)
    const distance = Math.hypot(dx, dy)
    if (distance > RADIUS) {
      dx = (dx / distance) * RADIUS
      dy = (dy / distance) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    // Screen y grows downward, but "up" on the stick should mean forward
    input.joystick.x = dx / RADIUS
    input.joystick.y = -dy / RADIUS
  }

  // If the joystick disappears mid-press (e.g. switching to build mode), let go
  useEffect(
    () => () => {
      input.joystick.x = 0
      input.joystick.y = 0
    },
    [],
  )

  const release = () => {
    setKnob({ x: 0, y: 0 })
    input.joystick.x = 0
    input.joystick.y = 0
  }

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        // Keep receiving moves even if the finger slides off the circle
        e.currentTarget.setPointerCapture(e.pointerId)
        moveTo(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      aria-label="Movement joystick"
    >
      <div
        className="joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}
