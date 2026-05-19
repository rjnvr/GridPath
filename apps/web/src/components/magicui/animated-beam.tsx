"use client"

import { motion } from "motion/react"
import { useEffect, useId, useState, type RefObject } from "react"

import { cn } from "@/lib/utils"

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
          initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
          animate={
            reverse
              ? { x1: ["110%", "-10%"], x2: ["100%", "-20%"], y1: ["0%", "0%"], y2: ["0%", "0%"] }
              : { x1: ["-10%", "110%"], x2: ["-20%", "100%"], y1: ["0%", "0%"], y2: ["0%", "0%"] }
          }
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
