"use client"

import { useCountUp } from "./use-count-up"

interface LiveStatsProps {
  totalProjects: number
  totalMwRequested: number | null
  changesLast7d: number
  isoCount: number
}

function formatGw(mw: number | null) {
  if (mw == null) return "—"
  const gw = mw / 1000
  if (gw >= 100) return `${Math.round(gw)} GW`
  return `${gw.toFixed(1)} GW`
}

export function LiveStats({ totalProjects, totalMwRequested, changesLast7d, isoCount }: LiveStatsProps) {
  return (
    <section aria-label="GridPath live stats" className="border-y border-border">
      <div className="mx-auto grid max-w-5xl grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
        <Stat label="Projects tracked" value={totalProjects} format="integer" />
        <Stat label="MW in queue" value={totalMwRequested ?? 0} format="gw" suffixHint={formatGw(totalMwRequested)} />
        <Stat label="Changes this week" value={changesLast7d} format="integer" />
        <Stat label="ISOs covered" value={isoCount} format="integer" />
      </div>
    </section>
  )
}

interface StatProps {
  label: string
  value: number
  format: "integer" | "gw"
  suffixHint?: string
}

function Stat({ label, value, format, suffixHint }: StatProps) {
  const { value: counted, ref } = useCountUp<HTMLParagraphElement>(value)
  const display =
    format === "gw"
      ? formatGw(counted)
      : counted.toLocaleString()
  return (
    <div className="px-6 py-8 md:py-10">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        ref={ref}
        className="mt-2 font-mono text-3xl tabular-nums tracking-tight text-foreground md:text-4xl"
        aria-label={suffixHint ?? `${value.toLocaleString()} ${label}`}
      >
        {display}
      </p>
    </div>
  )
}
