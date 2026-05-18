import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

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
    <section className="relative isolate overflow-hidden">
      {/* single soft ambient glow — replaces any background pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, hsl(173 80% 50% / 0.35), hsl(173 80% 50% / 0) 65%)"
        }}
      />
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-24 md:pb-32 md:pt-32">
        {freshness ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-mono uppercase tracking-wide">Live · last snapshot {freshness}</span>
          </div>
        ) : null}
        <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold tracking-tight md:text-7xl">
          Track every project in America&apos;s interconnection queue.
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
          GridPath ingests the ERCOT and CAISO queue reports daily, normalizes them into one
          schema, and records every field that changes — so you can stop diffing spreadsheets.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/login">Sign in →</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
