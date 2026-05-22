import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { AuroraText } from "@/components/magicui/aurora-text"
import { BorderBeam } from "@/components/magicui/border-beam"
import { TypingAnimation } from "@/components/magicui/typing-animation"
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
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, hsl(var(--primary) / 0.08), transparent 70%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            {freshness ? (
              <AnimatedGradientText>
                <span className="relative mr-1 inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <span className="font-mono uppercase tracking-wide">
                  Live · last snapshot {freshness}
                </span>
              </AnimatedGradientText>
            ) : null}
            <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold tracking-tight md:text-7xl">
              Track every project in{" "}
              <AuroraText>America&apos;s interconnection queue</AuroraText>.
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
              GridPath ingests the ERCOT and CAISO queue reports daily, normalizes them into one
              schema, and records every field that changes, so you can stop diffing spreadsheets.
            </p>
            <div className="mt-6 flex max-w-2xl items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2 font-mono text-xs text-muted-foreground shadow-[0_14px_40px_hsl(var(--primary)/0.04)] backdrop-blur">
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)]" />
              <TypingAnimation
                phrases={[
                  "diffing ERCOT queue changes...",
                  "normalizing CAISO interconnection fields...",
                  "flagging MW revisions and status moves..."
                ]}
              />
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <div className="relative isolate overflow-hidden rounded-md">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <BorderBeam size={120} duration={5} />
              </div>
              <Button asChild size="lg" variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
          <div className="relative aspect-[6/5] w-full max-w-[640px] justify-self-center rounded-lg border border-border bg-card p-1 shadow-[0_24px_80px_hsl(var(--primary)/0.08)] lg:justify-self-end">
            <GridTopology />
          </div>
        </div>
      </div>
    </section>
  )
}
