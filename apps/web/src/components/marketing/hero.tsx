import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

import { GridTopology } from "./grid-topology"

export function Hero() {
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
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              ERCOT &amp; CAISO live · updated daily
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
              Know every project in the interconnection queue.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground md:text-xl">
              GridPath turns ERCOT and CAISO queue reports into a queryable map and a field-level
              change history. See what&apos;s moving, what&apos;s stalled, and what&apos;s new,
              without copying another spreadsheet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Projects tracked
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tracking-tight">
                  12,400+
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  ISOs covered
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tracking-tight">2</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Tracked changes
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tracking-tight">
                  every field
                </dd>
              </div>
            </dl>
          </div>
          <div className="relative aspect-[6/5] w-full max-w-[640px] justify-self-center rounded-xl bg-primary/5 p-1 shadow-[0_24px_80px_rgba(45,212,191,0.10)] lg:justify-self-end">
            <GridTopology />
          </div>
        </div>
      </div>
    </section>
  )
}
