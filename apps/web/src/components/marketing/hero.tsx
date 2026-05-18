import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

import { GridTopology } from "./grid-topology"

interface HeroProps {
  latestSnapshotAt: string | null
}

function relativeFromNow(value: string | null) {
  if (!value) return null
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function Hero({ latestSnapshotAt }: HeroProps) {
  const freshness = relativeFromNow(latestSnapshotAt)
  return (
    <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(180deg,hsl(var(--background)),hsl(214_32%_7%))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--muted-foreground)) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "linear-gradient(to bottom, black 20%, transparent 88%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-70"
        style={{
          background:
            "linear-gradient(115deg, transparent 0%, hsl(173 80% 50% / 0.10) 34%, transparent 35%, transparent 52%, hsl(38 92% 60% / 0.08) 53%, transparent 70%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            {freshness ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-mono uppercase tracking-wide">
                  Live · last snapshot {freshness}
                </span>
              </div>
            ) : null}
            <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold tracking-tight md:text-7xl">
              Track every project in America&apos;s interconnection queue.
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
              GridPath ingests the ERCOT and CAISO queue reports daily, normalizes them into one
              schema, and records every field that changes, so you can stop diffing spreadsheets.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
          <div className="relative aspect-[6/5] w-full max-w-[640px] justify-self-center rounded-xl bg-primary/5 p-1 shadow-[0_24px_80px_rgba(45,212,191,0.10)] lg:justify-self-end">
            <GridTopology />
          </div>
        </div>
      </div>
    </section>
  )
}
