import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            ERCOT &amp; CAISO live · updated daily
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
            Know every project in the interconnection queue.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground md:text-xl">
            GridPath turns ERCOT and CAISO queue reports into a queryable map and a field-level
            change history. See what's moving, what's stalled, and what's new — without copying
            another spreadsheet.
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
        </div>
      </div>
    </section>
  )
}
