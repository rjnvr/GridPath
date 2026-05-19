"use client"

import { motion } from "motion/react"
import { useEffect, useId, useState, type RefObject } from "react"

import { cn } from "@/lib/utils"

type Point = {
  x: number
  y: number
}

interface AnimatedBeamProps {
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  className?: string
  /** Curve depth — positive bows up, negative bows down */
  curvature?: number
  /** Beam stroke color (gradient start) */
  gradientStartColor?: string
  /** Beam stroke color (gradient end) */
  gradientStopColor?: string
  /** Animation duration in seconds */
  duration?: number
  /** Delay before first run */
  delay?: number
  /** Reverse direction */
  reverse?: boolean
}

/**
 * Renders an animated SVG beam between two DOM refs, both relative to a containing ref.
 * The beam re-measures on resize so it tracks layout changes.
 */
export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  className,
  curvature = -20,
  gradientStartColor = "hsl(var(--primary) / 0)",
  gradientStopColor = "hsl(var(--primary))",
  duration = 3,
  delay = 0,
  reverse = false
}: AnimatedBeamProps) {
  const id = useId()
  const [path, setPath] = useState("")
  const [svgDims, setSvgDims] = useState({ width: 0, height: 0 })
  const [points, setPoints] = useState<{ start: Point; end: Point } | null>(null)

  useEffect(() => {
    function measure() {
      const container = containerRef.current
      const from = fromRef.current
      const to = toRef.current
      if (!container || !from || !to) return

      const cRect = container.getBoundingClientRect()
      const fRect = from.getBoundingClientRect()
      const tRect = to.getBoundingClientRect()

      const startX = fRect.left - cRect.left + fRect.width / 2
      const startY = fRect.top - cRect.top + fRect.height / 2
      const endX = tRect.left - cRect.left + tRect.width / 2
      const endY = tRect.top - cRect.top + tRect.height / 2

      const midX = (startX + endX) / 2
      const midY = (startY + endY) / 2 + curvature

      setSvgDims({ width: cRect.width, height: cRect.height })
      setPoints({ start: { x: startX, y: startY }, end: { x: endX, y: endY } })
      setPath(`M ${startX},${startY} Q ${midX},${midY} ${endX},${endY}`)
    }

    measure()
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [containerRef, fromRef, toRef, curvature])

  const gradientAnimation = getGradientAnimation(points, reverse)

  return (
    <svg
      aria-hidden
      width={svgDims.width}
      height={svgDims.height}
      className={cn("pointer-events-none absolute left-0 top-0", className)}
      viewBox={`0 0 ${svgDims.width || 1} ${svgDims.height || 1}`}
    >
      <defs>
        <motion.linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={gradientAnimation.initial}
          animate={gradientAnimation.animate}
          transition={{ duration, delay, ease: "linear", repeat: Infinity }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop offset="32.5%" stopColor={gradientStartColor} />
          <stop offset="50%" stopColor={gradientStopColor} />
          <stop offset="67.5%" stopColor={gradientStartColor} />
          <stop offset="100%" stopColor={gradientStartColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
      {/* Static base path */}
      <path d={path} stroke="hsl(var(--border))" strokeWidth={2} strokeOpacity={0.5} fill="none" />
      {/* Animated beam */}
      <path d={path} strokeWidth={2} stroke={`url(#${id})`} fill="none" strokeLinecap="round" />
    </svg>
  )
}

function getGradientAnimation(points: { start: Point; end: Point } | null, reverse: boolean) {
  if (!points) {
    return {
      initial: { x1: "0%", x2: "0%", y1: "0%", y2: "0%" },
      animate: { x1: "0%", x2: "0%", y1: "0%", y2: "0%" }
    }
  }

  const dx = points.end.x - points.start.x
  const dy = points.end.y - points.start.y
  const length = Math.hypot(dx, dy) || 1
  const unit = { x: dx / length, y: dy / length }
  const beamLength = Math.max(length * 0.35, 80)

  const from = reverse ? points.end : points.start
  const to = reverse ? points.start : points.end
  const direction = reverse ? { x: -unit.x, y: -unit.y } : unit

  const initialTail = {
    x: from.x - direction.x * beamLength,
    y: from.y - direction.y * beamLength
  }
  const finalTail = {
    x: to.x - direction.x * beamLength,
    y: to.y - direction.y * beamLength
  }

  return {
    initial: {
      x1: initialTail.x,
      y1: initialTail.y,
      x2: from.x,
      y2: from.y
    },
    animate: {
      x1: finalTail.x,
      y1: finalTail.y,
      x2: to.x,
      y2: to.y
    }
  }
}
