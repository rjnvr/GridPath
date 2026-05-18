"use client"

import { useEffect, useState } from "react"

type Node = {
  id: string
  x: number
  y: number
  label: string
  iso: "ERCOT" | "CAISO"
  mw: number
  phase: "Queued" | "Studied" | "Energized"
}

type Link = {
  from: string
  to: string
  delay: number
}

// Stylized positions for ERCOT (right cluster) and CAISO (left cluster) projects.
// Coordinates are tuned for a 600x420 viewBox.
const NODES: Node[] = [
  { id: "ca-1", x: 90, y: 130, label: "Tesla Megapack", iso: "CAISO", mw: 730, phase: "Studied" },
  { id: "ca-2", x: 60, y: 210, label: "Vasco Winds", iso: "CAISO", mw: 412, phase: "Queued" },
  { id: "ca-3", x: 130, y: 280, label: "Topaz Solar", iso: "CAISO", mw: 1100, phase: "Energized" },
  { id: "ca-4", x: 180, y: 170, label: "Mojave BESS", iso: "CAISO", mw: 580, phase: "Studied" },
  { id: "hub-w", x: 230, y: 230, label: "CAISO Hub", iso: "CAISO", mw: 0, phase: "Energized" },
  { id: "tx-1", x: 380, y: 130, label: "Panhandle Wind", iso: "ERCOT", mw: 890, phase: "Queued" },
  { id: "tx-2", x: 450, y: 210, label: "Permian Solar", iso: "ERCOT", mw: 1450, phase: "Studied" },
  { id: "tx-3", x: 530, y: 170, label: "Gulf Coast BESS", iso: "ERCOT", mw: 620, phase: "Queued" },
  { id: "tx-4", x: 500, y: 290, label: "Houston Hyperscale", iso: "ERCOT", mw: 1820, phase: "Energized" },
  { id: "hub-e", x: 400, y: 240, label: "ERCOT Hub", iso: "ERCOT", mw: 0, phase: "Energized" }
]

const LINKS: Link[] = [
  { from: "ca-1", to: "hub-w", delay: 0 },
  { from: "ca-2", to: "hub-w", delay: 0.4 },
  { from: "ca-3", to: "hub-w", delay: 0.8 },
  { from: "ca-4", to: "hub-w", delay: 1.2 },
  { from: "tx-1", to: "hub-e", delay: 0.2 },
  { from: "tx-2", to: "hub-e", delay: 0.6 },
  { from: "tx-3", to: "hub-e", delay: 1.0 },
  { from: "tx-4", to: "hub-e", delay: 1.4 },
  { from: "hub-w", to: "hub-e", delay: 0.5 }
]

const TICKER_EVENTS = [
  { time: "08:42", iso: "ERCOT", text: "Permian Solar -> Studied", tone: "positive" as const },
  { time: "08:31", iso: "CAISO", text: "Tesla Megapack +120 MW", tone: "neutral" as const },
  { time: "08:14", iso: "ERCOT", text: "Houston Hyperscale energized", tone: "positive" as const },
  { time: "07:58", iso: "CAISO", text: "Vasco Winds withdrew", tone: "negative" as const },
  { time: "07:46", iso: "ERCOT", text: "Gulf Coast BESS IA signed", tone: "positive" as const }
]

const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]))

function curvePath(a: Node, b: Node) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  // Bow the line slightly above the midpoint for a transmission-line feel.
  const lift = Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.18)
  return `M ${a.x},${a.y} Q ${mx},${my - lift} ${b.x},${b.y}`
}

export function GridTopology() {
  const [tickerIndex, setTickerIndex] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState("tx-4")

  useEffect(() => {
    const id = window.setInterval(() => {
      setTickerIndex((i) => (i + 1) % TICKER_EVENTS.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  const selectedNode = NODE_BY_ID.get(selectedNodeId) ?? NODES[0]

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-border bg-card/40 shadow-[inset_0_0_60px_rgba(45,212,191,0.06)]">
      {/* Subtle dot grid background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px)",
          backgroundSize: "22px 22px"
        }}
      />
      <svg
        viewBox="0 0 600 420"
        className="relative h-full w-full"
        role="img"
        aria-label="Animated map of ERCOT and CAISO interconnection projects flowing into regional hubs"
      >
        <defs>
          <radialGradient id="caisoBlob" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(173 80% 50% / 0.18)" />
            <stop offset="100%" stopColor="hsl(173 80% 50% / 0)" />
          </radialGradient>
          <radialGradient id="ercotBlob" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(38 92% 60% / 0.16)" />
            <stop offset="100%" stopColor="hsl(38 92% 60% / 0)" />
          </radialGradient>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--border))" />
            <stop offset="50%" stopColor="hsl(173 80% 50% / 0.65)" />
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

        {/* Region blobs (stylized, not real geography) */}
        <ellipse cx="130" cy="210" rx="135" ry="120" fill="url(#caisoBlob)" />
        <ellipse cx="455" cy="220" rx="155" ry="130" fill="url(#ercotBlob)" />

        {/* Region labels */}
        <text
          x="50"
          y="60"
          className="fill-muted-foreground"
          style={{ fontSize: 11, letterSpacing: 2 }}
        >
          CAISO
        </text>
        <text
          x="510"
          y="60"
          className="fill-muted-foreground"
          style={{ fontSize: 11, letterSpacing: 2 }}
        >
          ERCOT
        </text>

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
              <circle r={2.5} fill="hsl(173 80% 60%)" filter="url(#glow)">
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
              ? "hsl(173 80% 55%)"
              : node.phase === "Studied"
                ? "hsl(38 92% 60%)"
                : "hsl(213 27% 75%)"
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
                  ? "hsl(173 80% 55%)"
                  : selectedNode.phase === "Studied"
                    ? "hsl(38 92% 60%)"
                    : "hsl(213 27% 75%)"
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
                      ? "text-emerald-300"
                      : event.tone === "negative"
                        ? "text-rose-300"
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
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Studied
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" /> Queued
        </div>
      </div>
    </div>
  )
}
