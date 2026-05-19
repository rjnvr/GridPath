"use client"

import { motion, useInView } from "motion/react"
import { useRef } from "react"

export function MetricBar({
  label,
  value,
  max,
  delay = 0
}: {
  label: string
  value: number
  max: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px" })
  const target = Math.max(4, Math.round((value / Math.max(1, max)) * 100))

  return (
    <div ref={ref} className="grid gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: inView ? `${target}%` : 0 }}
          transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-sm bg-primary"
        />
      </div>
    </div>
  )
}
