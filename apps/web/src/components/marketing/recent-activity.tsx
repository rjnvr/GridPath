import type { RecentChange } from "@gridpath/shared"

import { Marquee } from "@/components/magicui/marquee"

interface RecentActivityProps {
  changes: RecentChange[]
}

function relative(value: string) {
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

function truncate(value: string | null, max = 28) {
  if (!value) return "—"
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function RecentActivity({ changes }: RecentActivityProps) {
  if (changes.length === 0) return null
  const tickerItems = changes.slice(0, 12)
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Live activity</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              What changed today.
            </h2>
            <p className="mt-3 max-w-xl text-base text-muted-foreground">
              Every field we&apos;ve seen change in the last 24 hours, straight from the ingestion
              pipeline. No login required.
            </p>
          </div>
        </div>

        {/* Marquee ticker — gives the section a live, animated pulse without a login. */}
        <div className="relative mt-8 overflow-hidden rounded-md border border-border bg-card/50">
          <Marquee pauseOnHover duration={50} className="py-3">
            {tickerItems.map((change) => (
              <div
                key={`m-${change.id}`}
                className="flex items-center gap-3 whitespace-nowrap rounded-sm border border-border bg-background/70 px-3 py-1.5 text-xs"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {change.iso}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{change.queueId}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="font-medium">{change.projectName ?? "Unnamed project"}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">{change.fieldName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {truncate(change.oldValue)} → <span className="text-foreground">{truncate(change.newValue)}</span>
                </span>
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
        </div>

        <ol role="list" className="mt-10 divide-y divide-border border-y border-border">
          {changes.map((change) => (
            <li key={change.id} className="grid grid-cols-[auto_auto_1fr_auto] items-baseline gap-4 px-1 py-4 md:gap-6">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {relative(change.changedAt)}
              </span>
              <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                {change.iso}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{change.queueId}</span>
                  <span className="mx-2 text-muted-foreground/60">·</span>
                  <span className="text-foreground">{change.projectName ?? "Unnamed project"}</span>
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  <span className="text-muted-foreground/80">{change.fieldName}</span>
                  <span className="mx-1.5">:</span>
                  <span className="line-through decoration-muted-foreground/40">
                    {truncate(change.oldValue)}
                  </span>
                  <span className="mx-1.5 text-muted-foreground/60">→</span>
                  <span className="text-foreground">{truncate(change.newValue)}</span>
                </p>
              </div>
              <span className="hidden text-xs text-muted-foreground md:inline">
                {new Date(change.changedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric"
                })}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
