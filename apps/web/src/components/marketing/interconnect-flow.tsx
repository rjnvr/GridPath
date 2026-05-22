"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { AnimatedBeam } from "@/components/magicui/animated-beam"

import { DataCenterScene } from "./data-center-scene"

const PHASES = [
  { id: "filed", label: "Filed", detail: "Application submitted" },
  { id: "scoping", label: "Scoping", detail: "Cluster study" },
  { id: "facility", label: "Facility study", detail: "Cost allocation" },
  { id: "ia", label: "IA signed", detail: "Construction window opens" },
  { id: "energized", label: "Energized", detail: "On the grid" }
] as const

// Small dataset of pretend new arrivals into the queue.
const ARRIVALS = [
  { id: "ER-2814", iso: "ERCOT", name: "Bluebonnet Storage", mw: 320, fuel: "BESS" },
  { id: "CA-7710", iso: "CAISO", name: "Sierra Solar", mw: 480, fuel: "Solar" },
  { id: "ER-2851", iso: "ERCOT", name: "Lone Star Wind", mw: 612, fuel: "Wind" },
  { id: "CA-7724", iso: "CAISO", name: "Mojave Hyperscale", mw: 250, fuel: "Load" },
  { id: "ER-2863", iso: "ERCOT", name: "Coastal Storage", mw: 410, fuel: "BESS" },
  { id: "CA-7741", iso: "CAISO", name: "Tehachapi Wind II", mw: 285, fuel: "Wind" }
]

function fuelColor(fuel: string) {
  switch (fuel) {
    case "Solar":
      return "bg-fuel-solar/15 text-fuel-solar border-fuel-solar/30"
    case "Wind":
      return "bg-fuel-wind/15 text-fuel-wind border-fuel-wind/30"
    case "BESS":
      return "bg-fuel-storage/15 text-fuel-storage border-fuel-storage/30"
    case "Load":
      return "bg-muted text-muted-foreground border-border"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

export function InterconnectFlow() {
  const [phaseIndex, setPhaseIndex] = useState(2)
  const [feedOffset, setFeedOffset] = useState(0)
  const flowContainerRef = useRef<HTMLDivElement>(null)
  const isoDataCenterRef = useRef<HTMLDivElement>(null)
  const feedPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhaseIndex((p) => (p + 1) % PHASES.length)
    }, 2400)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setFeedOffset((f) => (f + 1) % ARRIVALS.length)
    }, 1900)
    return () => window.clearInterval(id)
  }, [])

  const feed = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => ARRIVALS[(feedOffset + i) % ARRIVALS.length])
  }, [feedOffset])

  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--primary) / 0.04), transparent)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              From filing to first electron
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Watch projects move through every interconnection phase.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Each queue snapshot is diffed against the previous one. When a project moves from
              <span className="text-foreground"> Scoping </span>
              to <span className="text-foreground">IA Signed</span>, you see the field, the
              timestamp, and the prior value, not just a new row.
            </p>

            <ol className="mt-8 space-y-2.5">
              {PHASES.map((phase, i) => {
                const active = i === phaseIndex
                const past = i < phaseIndex
                return (
                  <li key={phase.id} className="rounded-md">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md border border-border bg-card/40 px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        borderColor: active ? "hsl(var(--primary) / 0.6)" : undefined,
                        background: active ? "hsl(var(--primary) / 0.06)" : undefined
                      }}
                      onClick={() => setPhaseIndex(i)}
                      aria-current={active ? "step" : undefined}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium"
                        style={{
                          borderColor: active
                            ? "hsl(var(--primary))"
                            : past
                              ? "hsl(var(--primary) / 0.5)"
                              : "hsl(var(--border))",
                          background: past ? "hsl(var(--primary) / 0.15)" : "transparent",
                          color:
                            active || past ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex flex-1 items-baseline justify-between gap-3">
                        <span className={active ? "font-medium" : "text-muted-foreground"}>
                          {phase.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{phase.detail}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          <div
            ref={flowContainerRef}
            className="relative space-y-4 rounded-md p-1 shadow-[0_24px_90px_hsl(var(--primary)/0.06)]"
          >
            <AnimatedBeam
              containerRef={flowContainerRef}
              fromRef={feedPanelRef}
              toRef={isoDataCenterRef}
              className="z-10"
              curvature={-42}
              duration={2.7}
              gradientStartColor="hsl(var(--primary) / 0.2)"
              gradientStopColor="hsl(var(--fuel-wind))"
            />
            <div ref={isoDataCenterRef} className="relative z-20">
              <IsoDataCenter />
            </div>
            <div ref={feedPanelRef} className="relative z-20">
              <FeedPanel feed={feed} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Isometric data-center campus. */
function IsoDataCenter() {
  return (
    <div className="relative isolate min-h-[420px] overflow-hidden rounded-md border border-border bg-card/60 shadow-[inset_0_0_80px_hsl(var(--primary)/0.04)]">
      <div
        className="relative h-[420px]"
        role="img"
        aria-label="3D data-center campus model with queue input metrics"
      >
        <DataCenterScene />

        <div className="absolute left-5 top-8 w-[150px] rounded-lg border border-border bg-background/85 p-3 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Queue inputs
          </p>
          <div className="mt-3 space-y-2">
            {[
              ["612 MW", "Wind", "bg-fuel-wind"],
              ["480 MW", "Solar", "bg-fuel-solar"],
              ["320 MW", "BESS", "bg-fuel-storage"]
            ].map(([mw, fuel, color]) => (
              <div key={fuel} className="flex items-center justify-between rounded-md border border-border/70 bg-card/70 px-2 py-1.5">
                <span className="flex items-center gap-2 font-mono text-[11px] text-foreground">
                  <span className={`h-2 w-2 rounded-full ${color}`} />
                  {mw}
                </span>
                <span className="text-[10px] text-muted-foreground">{fuel}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 right-5 w-[190px] rounded-lg border border-primary/40 bg-background/90 p-3 shadow-xl backdrop-blur">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
            Active campus
          </p>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
            <span className="font-medium">Houston Hyperscale</span>
            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              1.82 GW
            </span>
          </div>
        </div>

        <div className="absolute bottom-8 left-5 w-[164px] rounded-lg border border-border bg-background/85 p-3 shadow-xl backdrop-blur">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Linked campus
          </p>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
            <span className="font-medium">West Campus</span>
            <span className="font-mono text-[10px] text-muted-foreground">640 MW</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Bottom-right floating "live arrivals" feed. */
function FeedPanel({
  feed
}: {
  feed: { id: string; iso: string; name: string; mw: number; fuel: string }[]
}) {
  return (
    <div className="rounded-lg border border-border bg-background/90 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          New in queue
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">last 24h</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {feed.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-2 rounded border border-border/60 bg-card/60 px-2 py-1.5 text-xs"
          >
            <span className="font-mono text-[10px] text-muted-foreground">{row.id}</span>
            <span className="flex-1 truncate">{row.name}</span>
            <span className={`rounded border px-1.5 py-0 text-[10px] ${fuelColor(row.fuel)}`}>
              {row.fuel}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {row.mw} MW
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
