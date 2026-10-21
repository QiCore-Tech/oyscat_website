"use client"

// Ported from React Bits FlipCard (JS + CSS variant).
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react"
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react"

import "./flip-card.css"

const SLOP = { fine: 4, coarse: 8 }
const TILT_SPRING = { stiffness: 240, damping: 24, mass: 0.6 }
const LIFT_SPRING = { stiffness: 320, damping: 26 }
const FLING = 0.16
const HISTORY_MS = 90
// About one hover flip (the default spring settles in ~0.35 s); at most one hover flip starts per window.
const HOVER_COOLDOWN_MS = 400

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const snap = (deg: number) => Math.round(deg / 180) * 180
const isBack = (deg: number) => Math.abs(Math.round(deg / 180)) % 2 === 1
const toLength = (v: number | string) => (typeof v === "number" ? `${v}px` : v)

interface Grip {
  id: number
  x: number
  y: number
  base: number
  moved: boolean
  slop: number
  hist: { t: number; v: number }[]
}

export interface FlipCardProps {
  front?: ReactNode
  back?: ReactNode
  flipped?: boolean
  defaultFlipped?: boolean
  onFlipChange?: (flipped: boolean) => void
  axis?: "x" | "y"
  flipOnClick?: boolean
  draggable?: boolean
  dragDistance?: number
  tilt?: boolean
  tiltMax?: number
  glare?: boolean
  glareOpacity?: number
  glareColor?: string
  hoverScale?: number
  perspective?: number
  stiffness?: number
  damping?: number
  width?: number | string
  height?: number | string
  radius?: number | string
  background?: string
  color?: string
  shadow?: boolean
  shadowColor?: string
  shadowOpacity?: number
  disabled?: boolean
  ariaLabel?: string
  className?: string
  /** A mouse or pen flips the card by pointing at it, turning toward the side it enters or leaves by; touch keeps tap and swipe. */
  flipOnHover?: boolean
}

export function FlipCard({
  front = null,
  back = null,
  flipped,
  defaultFlipped = false,
  onFlipChange,
  axis = "y",
  flipOnClick = true,
  draggable = true,
  dragDistance = 0,
  tilt = true,
  tiltMax = 12,
  glare = true,
  glareOpacity = 0.22,
  glareColor = "#ffffff",
  hoverScale = 1.03,
  perspective = 1100,
  stiffness = 170,
  damping = 20,
  width = 300,
  height = 400,
  radius = 22,
  background = "#27272a",
  color = "#f5f5f5",
  shadow = true,
  shadowColor = "#000000",
  shadowOpacity = 0.45,
  disabled = false,
  ariaLabel = "Flip card",
  className = "",
  flipOnHover = false,
}: FlipCardProps) {
  const reduce = useReducedMotion()
  const controlled = flipped !== undefined
  const [inner, setInner] = useState(defaultFlipped)
  const [dragging, setDragging] = useState(false)
  const shown = controlled ? flipped : inner
  const shownRef = useRef(shown)
  shownRef.current = shown
  const rootRef = useRef<HTMLDivElement>(null)
  const grip = useRef<Grip | null>(null)
  const hovered = useRef(false)
  const hoverSide = useRef<-1 | 1>(1)
  const hoverCooldown = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spin = useRef<AnimationPlaybackControls | null>(null)
  const target = useRef(shown ? 180 : 0)

  const turn = useMotionValue(shown ? 180 : 0)
  const tiltX = useSpring(0, TILT_SPRING)
  const tiltY = useSpring(0, TILT_SPRING)
  const lift = useSpring(1, LIFT_SPRING)
  const sheen = useSpring(0, LIFT_SPRING)
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)

  const sumX = useTransform([turn, tiltX], ([t, x]: number[]) => t + x)
  const sumY = useTransform([turn, tiltY], ([t, y]: number[]) => t + y)
  const turnY = useMotionTemplate`perspective(${perspective}px) scale(${lift}) rotateX(${tiltX}deg) rotateY(${sumY}deg)`
  const turnX = useMotionTemplate`perspective(${perspective}px) scale(${lift}) rotateY(${tiltY}deg) rotateX(${sumX}deg)`
  const facing = useTransform(turn, (t) => Math.abs(Math.cos((t * Math.PI) / 180)))
  const spread = useTransform(facing, (f) => 0.08 + 0.92 * f)
  const shade = useTransform(facing, (f) => 0.1 + 0.9 * f * f)
  const gxPct = useMotionTemplate`${gx}%`
  const gyPct = useMotionTemplate`${gy}%`

  const settle = (to: number, velocity: number, instant: boolean) => {
    spin.current?.stop()
    target.current = to
    if (instant || reduce) turn.jump(to)
    else spin.current = animate(turn, to, { type: "spring", stiffness, damping, velocity, restDelta: 0.05 })
    const next = isBack(to)
    if (next === shownRef.current) return
    shownRef.current = next
    if (!controlled) setInner(next)
    onFlipChange?.(next)
  }
  const flip = (instant: boolean) => {
    const base = snap(turn.get())
    settle(isBack(base) ? base - 180 : base + 180, 0, instant)
  }
  const rest = () => {
    tiltX.set(0)
    tiltY.set(0)
    sheen.set(0)
    lift.set(1)
  }
  // Hover is judged against the card's own box, not the 3D faces that overhang it mid-turn, so the edge cannot flicker.
  const hover = (e: PointerEvent<HTMLDivElement>, leaving: boolean) => {
    if (!flipOnHover || disabled || e.pointerType === "touch") return
    const r = e.currentTarget.getBoundingClientRect()
    const over = !leaving && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (over === hovered.current) return
    hovered.current = over
    // Pointer on the right half turns the card right (rotateY increases, like a rightward drag); the left half turns it left.
    hoverSide.current = e.clientX < r.left + r.width / 2 ? -1 : 1
    // Rapid in/out is debounced: the first change flips at once, and the changes inside the cooldown collapse into
    // a single catch-up flip toward wherever the pointer ended up, so the card never stays turned after the pointer left.
    if (!hoverCooldown.current) flipToHover()
  }
  const flipToHover = () => {
    if (isBack(target.current) === hovered.current) return
    settle(target.current + hoverSide.current * 180, 0, false)
    hoverCooldown.current = setTimeout(() => {
      hoverCooldown.current = null
      flipToHover()
    }, HOVER_COOLDOWN_MS)
  }

  useEffect(() => {
    if (!controlled || isBack(target.current) === flipped) return
    const base = target.current
    spin.current?.stop()
    target.current = isBack(base) ? base - 180 : base + 180
    if (reduce) turn.jump(target.current)
    else spin.current = animate(turn, target.current, { type: "spring", stiffness, damping, restDelta: 0.05 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped])
  useEffect(() => () => {
    spin.current?.stop()
    if (hoverCooldown.current) clearTimeout(hoverCooldown.current)
  }, [])
  useEffect(() => {
    if (disabled) rest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0 || grip.current || (flipOnHover && e.pointerType !== "touch")) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
    spin.current?.stop()
    grip.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      base: turn.get(),
      moved: false,
      slop: e.pointerType === "touch" ? SLOP.coarse : SLOP.fine,
      hist: [],
    }
    if (!reduce) lift.set(hoverScale)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = grip.current
    if (g && g.id === e.pointerId) {
      const d = axis === "x" ? e.clientY - g.y : e.clientX - g.x
      if (!g.moved) {
        if (Math.abs(d) < g.slop || !draggable || reduce) return
        g.moved = true
        setDragging(true)
        tiltX.set(0)
        tiltY.set(0)
        sheen.set(0)
      }
      const span = dragDistance > 0 ? dragDistance : axis === "x" ? e.currentTarget.offsetHeight : e.currentTarget.offsetWidth
      const deg = g.base + (axis === "x" ? -1 : 1) * (d / span) * 180
      turn.set(deg)
      const now = performance.now()
      g.hist.push({ t: now, v: deg })
      while (g.hist.length > 2 && now - g.hist[0].t > HISTORY_MS) g.hist.shift()
      return
    }
    hover(e, false)
    if (!tilt || reduce || disabled || e.pointerType === "touch") return
    const r = e.currentTarget.getBoundingClientRect()
    const px = clamp((e.clientX - r.left) / r.width, 0, 1)
    const py = clamp((e.clientY - r.top) / r.height, 0, 1)
    tiltX.set((0.5 - py) * 2 * tiltMax)
    tiltY.set((px - 0.5) * 2 * tiltMax)
    gx.set(px * 100)
    gy.set(py * 100)
    sheen.set(1)
  }
  const release = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = grip.current
    if (!g || g.id !== e.pointerId) return
    grip.current = null
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
    setDragging(false)
    if (e.pointerType === "touch" || !rootRef.current?.matches(":hover")) rest()
    if (!g.moved) {
      if (!cancelled && flipOnClick) flip(false)
      else settle(target.current, 0, false)
      return
    }
    const here = turn.get()
    let velocity = 0
    const a = g.hist[0]
    const b = g.hist[g.hist.length - 1]
    if (!cancelled && a && b && b.t > a.t && performance.now() - b.t < 60)
      velocity = ((b.v - a.v) / (b.t - a.t)) * 1000
    const to = cancelled ? snap(g.base) : clamp(snap(here + velocity * FLING), snap(here) - 180, snap(here) + 180)
    settle(to, velocity, false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (e.key !== "Enter" && e.key !== " ")) return
    e.preventDefault()
    if (!e.repeat) flip(true)
  }
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!disabled && e.detail === 0) flip(true)
  }

  const rotorStyle = {
    transform: axis === "x" ? turnX : turnY,
    "--fc-gx": gxPct,
    "--fc-gy": gyPct,
    "--fc-sheen": sheen,
  }

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={shown}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={`flip-card${className ? ` ${className}` : ""}`}
      data-axis={axis}
      data-draggable={draggable && !disabled && !reduce ? "" : undefined}
      data-hover-flip={flipOnHover ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-fade={reduce ? (shown ? "back" : "front") : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => release(e, false)}
      onPointerCancel={(e) => release(e, true)}
      onLostPointerCapture={(e) => release(e, true)}
      onPointerEnter={(e) => {
        if (!reduce && !disabled && e.pointerType !== "touch") lift.set(hoverScale)
        hover(e, false)
      }}
      onPointerLeave={(e) => {
        hover(e, true)
        if (!grip.current) rest()
      }}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onDragStart={(e) => e.preventDefault()}
      style={
        {
          "--fc-w": toLength(width),
          "--fc-h": toLength(height),
          "--fc-radius": toLength(radius),
          "--fc-bg": background,
          "--fc-ink": color,
          "--fc-shadow": shadowColor,
          "--fc-shadow-o": shadowOpacity,
          "--fc-glare": glareOpacity,
          "--fc-glare-color": glareColor,
        } as CSSProperties
      }
    >
      {shadow ? (
        <motion.span
          className="flip-card__shadow"
          aria-hidden="true"
          style={axis === "x" ? { scaleY: spread, opacity: shade } : { scaleX: spread, opacity: shade }}
        />
      ) : null}
      <motion.div className="flip-card__rotor" style={reduce ? undefined : rotorStyle}>
        <div className="flip-card__face flip-card__face--front" aria-hidden={shown} inert={shown}>
          {front}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
        <div className="flip-card__face flip-card__face--back" aria-hidden={!shown} inert={!shown}>
          {back}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
      </motion.div>
    </div>
  )
}
