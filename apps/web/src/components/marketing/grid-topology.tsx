"use client"

import { useEffect, useState } from "react"
import type { SupportedIso } from "@gridpath/shared"

type TopologyNode = {
  id: string
  x: number
  y: number
  label: string
  iso: SupportedIso
  mw: number
  phase: "Queued" | "Studied" | "Energized"
}

type Link = {
  from: string
  to: string
  delay: number
}

type Region = {
  iso: SupportedIso
  x: number
  y: number
  rx: number
  ry: number
  fill: string
  labelX: number
  labelY: number
}

const REGIONS: Region[] = [
  {
    iso: "CAISO",
    x: 125,
    y: 205,
    rx: 120,
    ry: 126,
    fill: "hsl(var(--primary) / 0.08)",
    labelX: 48,
    labelY: 58
  },
  {
    iso: "ERCOT",
    x: 285,
    y: 244,
    rx: 104,
    ry: 110,
    fill: "hsl(var(--fuel-solar) / 0.08)",
    labelX: 244,
    labelY: 365
  },
  {
    iso: "SPP",
    x: 328,
    y: 126,
    rx: 82,
    ry: 80,
    fill: "hsl(var(--fuel-storage) / 0.08)",
    labelX: 308,
    labelY: 44
  },
  {
    iso: "MISO",
    x: 445,
    y: 250,
    rx: 94,
    ry: 114,
    fill: "hsl(var(--fuel-wind) / 0.08)",
    labelX: 420,
    labelY: 365
  },
  {
    iso: "PJM",
    x: 515,
    y: 155,
    rx: 86,
    ry: 92,
    fill: "hsl(var(--fuel-gas) / 0.08)",
    labelX: 502,
    labelY: 58
  }
]

// Coordinates are tuned for a 600x420 viewBox.
const NODES: TopologyNode[] = [
  { id: "ca-1", x: 70, y: 132, label: "Tesla Megapack", iso: "CAISO", mw: 730, phase: "Studied" },
  { id: "ca-2", x: 118, y: 205, label: "Vasco Winds", iso: "CAISO", mw: 412, phase: "Queued" },
  { id: "ca-3", x: 180, y: 166, label: "Mojave BESS", iso: "CAISO", mw: 580, phase: "Studied" },
  { id: "hub-ca", x: 132, y: 270, label: "CAISO Hub", iso: "CAISO", mw: 0, phase: "Energized" },
  { id: "er-1", x: 246, y: 272, label: "Bluebonnet Storage", iso: "ERCOT", mw: 640, phase: "Queued" },
  { id: "er-2", x: 336, y: 242, label: "Permian Solar", iso: "ERCOT", mw: 1450, phase: "Studied" },
  { id: "er-3", x: 318, y: 315, label: "Houston Hyperscale", iso: "ERCOT", mw: 1820, phase: "Energized" },
  { id: "hub-er", x: 288, y: 210, label: "ERCOT Hub", iso: "ERCOT", mw: 0, phase: "Energized" },
  { id: "spp-1", x: 270, y: 116, label: "Panhandle Wind", iso: "SPP", mw: 890, phase: "Queued" },
  { id: "spp-2", x: 360, y: 92, label: "Prairie BESS", iso: "SPP", mw: 310, phase: "Studied" },
  { id: "hub-spp", x: 336, y: 156, label: "SPP Hub", iso: "SPP", mw: 0, phase: "Energized" },
  { id: "miso-1", x: 402, y: 262, label: "Great Lakes Solar", iso: "MISO", mw: 515, phase: "Studied" },
  { id: "miso-2", x: 466, y: 316, label: "Riverbend Wind", iso: "MISO", mw: 720, phase: "Queued" },
  { id: "hub-miso", x: 444, y: 206, label: "MISO Hub", iso: "MISO", mw: 0, phase: "Energized" },
  { id: "pjm-1", x: 500, y: 118, label: "Keystone Solar", iso: "PJM", mw: 430, phase: "Studied" },
  { id: "pjm-2", x: 548, y: 190, label: "Dominion Data Campus", iso: "PJM", mw: 960, phase: "Queued" },
  { id: "hub-pjm", x: 508, y: 246, label: "PJM Hub", iso: "PJM", mw: 0, phase: "Energized" }
]

const LINKS: Link[] = [
  { from: "ca-1", to: "hub-ca", delay: 0 },
  { from: "ca-2", to: "hub-ca", delay: 0.4 },
  { from: "ca-3", to: "hub-ca", delay: 0.8 },
  { from: "er-1", to: "hub-er", delay: 0.2 },
  { from: "er-2", to: "hub-er", delay: 0.6 },
  { from: "er-3", to: "hub-er", delay: 1.0 },
  { from: "spp-1", to: "hub-spp", delay: 0.3 },
  { from: "spp-2", to: "hub-spp", delay: 0.7 },
  { from: "miso-1", to: "hub-miso", delay: 0.5 },
  { from: "miso-2", to: "hub-miso", delay: 0.9 },
  { from: "pjm-1", to: "hub-pjm", delay: 0.4 },
  { from: "pjm-2", to: "hub-pjm", delay: 0.8 },
  { from: "hub-ca", to: "hub-er", delay: 0.5 },
  { from: "hub-er", to: "hub-spp", delay: 0.7 },
  { from: "hub-spp", to: "hub-miso", delay: 0.9 },
  { from: "hub-miso", to: "hub-pjm", delay: 1.1 }
]

const TICKER_EVENTS = [
  { time: "08:42", iso: "PJM", text: "Dominion Data Campus entered queue", tone: "neutral" as const },
  { time: "08:31", iso: "MISO", text: "Great Lakes Solar +115 MW", tone: "neutral" as const },
  { time: "08:14", iso: "ERCOT", text: "Houston Hyperscale energized", tone: "positive" as const },
  { time: "07:58", iso: "CAISO", text: "Vasco Winds withdrew", tone: "negative" as const },
  { time: "07:46", iso: "SPP", text: "Prairie BESS advanced to study", tone: "positive" as const }
]

const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]))

function curvePath(a: TopologyNode, b: TopologyNode) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  // Bow the line slightly above the midpoint for a transmission-line feel.
  const lift = Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.18)
  return `M ${a.x},${a.y} Q ${mx},${my - lift} ${b.x},${b.y}`
}

export function GridTopology() {
  const [tickerIndex, setTickerIndex] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState("pjm-2")

  useEffect(() => {
    const id = window.setInterval(() => {
      setTickerIndex((i) => (i + 1) % TICKER_EVENTS.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  const selectedNode = NODE_BY_ID.get(selectedNodeId) ?? NODES[0]

  return (
    <div className="relative isolate overflow-hidden rounded-md border border-border bg-card/60 shadow-[inset_0_0_60px_hsl(var(--primary)/0.04)]">
      <svg
        viewBox="0 0 600 420"
        className="relative h-full w-full"
        role="img"
        aria-label="Animated map of covered ISO interconnection projects flowing into regional hubs"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--border))" />
            <stop offset="50%" stopColor="hsl(var(--primary) / 0.65)" />
            <stop offset="100%" stopColor="hsl(var(--border))" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Stylized ISO regions, not real geography. */}
        {REGIONS.map((region) => (
          <g key={region.iso}>
            <ellipse
              cx={region.x}
              cy={region.y}
              rx={region.rx}
              ry={region.ry}
              fill={region.fill}
              stroke="hsl(var(--border) / 0.5)"
              strokeWidth={1}
            />
            <text
              x={region.labelX}
              y={region.labelY}
              className="fill-muted-foreground"
              style={{ fontSize: 10, letterSpacing: 2 }}
            >
              {region.iso}
            </text>
          </g>
        ))}

        {/* Transmission lines */}
        {LINKS.map((link) => {
          const a = NODE_BY_ID.get(link.from)!
          const b = NODE_BY_ID.get(link.to)!
          const d = curvePath(a, b)
          return (
            <g key={`${link.from}-${link.to}`}>
              <path
                d={d}
                fill="none"
                stroke="url(#lineGrad)"
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.55}
              />
              {/* Animated packet */}
              <circle r={2.5} fill="hsl(var(--primary))" filter="url(#glow)">
                <animateMotion dur="3.4s" repeatCount="indefinite" begin={`${link.delay}s`} path={d} />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  dur="3.4s"
                  repeatCount="indefinite"
                  begin={`${link.delay}s`}
                />
              </circle>
            </g>
          )
        })}

        {/* Nodes */}
        {NODES.map((node) => {
          const isHub = node.id.startsWith("hub")
          const isSelected = node.id === selectedNode.id
          const color =
            node.phase === "Energized"
              ? "hsl(var(--primary))"
              : node.phase === "Studied"
                ? "hsl(var(--fuel-solar))"
                : "hsl(var(--muted-foreground))"
          return (
            <g
              key={node.id}
              role={isHub ? undefined : "button"}
              tabIndex={isHub ? undefined : 0}
              aria-label={
                isHub
                  ? undefined
                  : `Inspect ${node.label}, ${node.mw} megawatts, ${node.phase} in ${node.iso}`
              }
              className={isHub ? undefined : "cursor-pointer outline-none"}
              onClick={isHub ? undefined : () => setSelectedNodeId(node.id)}
              onFocus={isHub ? undefined : () => setSelectedNodeId(node.id)}
              onKeyDown={
                isHub
                  ? undefined
                  : (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedNodeId(node.id)
                      }
                    }
              }
              onMouseEnter={isHub ? undefined : () => setSelectedNodeId(node.id)}
            >
              {/* Outer pulsing ring */}
              <circle cx={node.x} cy={node.y} r={isHub ? 14 : 8} fill={color} opacity={0.12}>
                <animate
                  attributeName="r"
                  values={isHub ? "14;22;14" : "8;14;8"}
                  dur="2.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.2;0;0.2"
                  dur="2.8s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Core dot */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHub ? 6 : 3.5}
                fill={color}
                stroke={isSelected ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                strokeWidth={isSelected ? 2.5 : isHub ? 2 : 1.5}
                filter="url(#glow)"
              />
              {isHub && (
                <text
                  x={node.x}
                  y={node.y - 18}
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1 }}
                >
                  {node.iso}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Selected project detail */}
      <div
        className="pointer-events-none absolute left-3 top-3 w-[210px] rounded-lg border border-border/70 bg-background/85 p-3 backdrop-blur"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {selectedNode.iso}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {selectedNode.mw.toLocaleString()} MW
          </span>
        </div>
        <p className="mt-2 truncate text-sm font-medium">{selectedNode.label}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background:
                selectedNode.phase === "Energized"
                  ? "hsl(var(--primary))"
                  : selectedNode.phase === "Studied"
                    ? "hsl(var(--fuel-solar))"
                    : "hsl(var(--muted-foreground))"
            }}
          />
          {selectedNode.phase}
        </div>
      </div>

      {/* Live ticker overlay */}
      <div
        className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg border border-border/70 bg-background/85 px-3 py-2 backdrop-blur"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Queue activity
        </div>
        <ul className="mt-1.5 h-5 overflow-hidden">
          {(() => {
            const event = TICKER_EVENTS[tickerIndex]
            return (
              <li key={event.text} className="flex h-5 items-center gap-2 text-xs">
                <span className="font-mono text-[10px] text-muted-foreground">{event.time}</span>
                <span className="rounded border border-border bg-card px-1.5 py-0 text-[10px] text-muted-foreground">
                  {event.iso}
                </span>
                <span
                  className={
                    event.tone === "positive"
                      ? "text-status-success-foreground"
                      : event.tone === "negative"
                        ? "text-status-error-foreground"
                        : "text-foreground"
                  }
                >
                  {event.text}
                </span>
              </li>
            )
          })()}
        </ul>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" /> Energized
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-fuel-solar" /> Studied
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Queued
        </div>
      </div>
    </div>
  )
}
