"use client"

import { motion, useInView, useMotionValue, useSpring } from "motion/react"
import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

type NumberTickerProps = {
  value: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
  className?: string
}

export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  className
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === "down" ? value : 0)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100
  })
  const isInView = useInView(ref, { once: true, margin: "0px" })

  useEffect(() => {
    if (!isInView) return
    const timer = window.setTimeout(() => {
      motionValue.set(direction === "down" ? 0 : value)
    }, delay * 1000)
    return () => window.clearTimeout(timer)
  }, [delay, direction, isInView, motionValue, value])

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (!ref.current) return
      ref.current.textContent = Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces
      }).format(Number(latest.toFixed(decimalPlaces)))
    })
  }, [decimalPlaces, springValue])

  return (
    <motion.span
      ref={ref}
      data-numeric
      className={cn("inline-block font-mono tabular-nums", className)}
    >
      0
    </motion.span>
  )
}
