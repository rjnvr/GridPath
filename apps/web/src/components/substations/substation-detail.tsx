import type { QueueEventSeverity, SubstationDetailData } from "@gridpath/shared"
import { ArrowLeft, MapPin, Zap } from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const severityStyles: Record<QueueEventSeverity, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  important: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  watch: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  info: "border-border bg-card text-muted-foreground"
}

function formatMw(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} GW`
  return `${Math.round(value).toLocaleString()} MW`
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

export function SubstationDetail({ data }: { data: SubstationDetailData }) {
  const { substation } = data
  const headroomLink =
    substation.lat !== null && substation.lng !== null
      ? `/headroom?lat=${substation.lat}&lng=${substation.lng}&radius=${data.radiusMiles}`
      : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
      <div>
        <Link
          href="/headroom"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Headroom
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4" /> Substation
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {substation.name ?? substation.hifldId}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {substation.owner ? <span>{substation.owner}</span> : null}
            {substation.voltageKv ? <span>{substation.voltageKv} kV</span> : null}
            {substation.lat !== null && substation.lng !== null ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {substation.lat.toFixed(3)}, {substation.lng.toFixed(3)}
              </span>
            ) : null}
            <span>HIFLD ID: {substation.hifldId}</span>
          </div>
        </div>
        {headroomLink ? (
          <Link
            href={headroomLink}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Open in Headroom →
          </Link>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Projects within radius" value={data.projectCount.toLocaleString()} />
        <Kpi label="Queued MW" value={formatMw(data.mwQueued)} />
        <Kpi label="Energized MW" value={formatMw(data.mwEnergized)} />
        <Kpi label="Radius" value={`${data.radiusMiles} mi`} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fuel mix nearby</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.fuelBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects within radius.</p>
            ) : (
              data.fuelBreakdown.slice(0, 8).map((row) => (
                <div key={row.fuelType} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{row.fuelType}</span>
                  <span className="font-medium tabular-nums">
                    {formatMw(row.mwQueued)}{" "}
                    <span className="text-xs text-muted-foreground">· {row.projectCount}</span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nearby projects</CardTitle>
          </CardHeader>
          <CardContent>
            {data.nearbyProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects within radius.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.nearbyProjects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2 text-sm hover:bg-card/60"
                    >
                      <span className="truncate">
                        {project.projectName ?? project.queueId}
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {project.iso}
                        </span>
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {project.fuelType ?? "—"}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {project.mwRequested ? `${Math.round(project.mwRequested)} MW` : "—"}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {project.distanceMiles?.toFixed(1) ?? "?"} mi
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent events nearby (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked events in the last 30 days.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.recentEvents.slice(0, 20).map((event) => (
                <li
                  key={event.id}
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm",
                    severityStyles[event.severity as QueueEventSeverity] ?? severityStyles.info
                  )}
                >
                  <span>
                    <Link
                      href={`/projects/${event.projectId}`}
                      className="font-medium hover:underline"
                    >
                      {event.title}
                    </Link>
                    <span className="ml-2 text-xs opacity-70">
                      {event.projectName ?? event.queueId} · {event.iso}
                    </span>
                  </span>
                  <span className="text-xs opacity-70">{formatDateTime(event.eventAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
