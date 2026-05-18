import type {
  GridProject,
  NearbySubstation,
  ProjectChange,
  ProjectSnapshot,
  QueueEvent
} from "@gridpath/shared"
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Database,
  ExternalLink,
  History,
  ListChecks,
  MapPin,
  RadioTower
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getProjectDetailData } from "@/lib/data"

export const dynamic = "force-dynamic"

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/50 bg-red-500/15 text-red-200",
  important: "border-amber-500/50 bg-amber-500/15 text-amber-100",
  watch: "border-sky-500/45 bg-sky-500/15 text-sky-100",
  info: "border-border bg-background text-muted-foreground"
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  new_project: "New project",
  phase_advanced: "Phase advanced",
  phase_regressed: "Phase regressed",
  ia_executed: "IA executed",
  energized: "Energized",
  withdrawn: "Withdrawn",
  mw_increase: "MW increase",
  mw_decrease: "MW decrease",
  owner_changed: "Owner changed",
  milestone_date_changed: "Milestone date",
  status_changed: "Status changed",
  project_field_changed: "Field changed"
}

type ProjectPageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const data = await getProjectDetailData(id)

  if (!data) {
    notFound()
  }

  const { project, snapshots, nearbySubstations } = data
  const latestSnapshot = snapshots[0]
  const milestoneFields: Array<[string, string | null]> = [
    ["Filed", project.filedDate],
    ["IA signed", project.iaSignedDate],
    ["Energized", project.energizedDate],
    ["Withdrawn", project.withdrawnDate]
  ]

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/search">
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </Button>
        {project.rawSourceUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={project.rawSourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Source
            </a>
          </Button>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  {project.iso} / {project.queueId}
                </p>
                <CardTitle className="mt-2 text-3xl leading-tight">
                  {project.projectName ?? "Unnamed project"}
                </CardTitle>
                <CardDescription className="mt-3">
                  {compactList([project.ownerCompany, project.county, project.state]).join(" / ") ||
                    "No owner or location captured yet."}
                </CardDescription>
              </div>
              <span className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                {project.currentPhase ?? project.currentStatus ?? "Unclassified"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Fact label="MW requested" value={formatNumber(project.mwRequested)} />
              <Fact label="Fuel" value={project.fuelType} />
              <Fact label="Status" value={project.currentStatus} />
              <Fact label="Latest snapshot" value={latestSnapshot?.snapshotDate} />
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {milestoneFields.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-mono">{value ?? "Not captured"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <EventFeed events={project.events} />
        <ProjectProfile project={project} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <FieldChangeTimeline changes={project.changes} />
        <SnapshotHistory snapshots={snapshots} />
      </section>

      <NearbySubstations substations={nearbySubstations} />
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value ?? "Not captured"}</dd>
    </div>
  )
}

function ProjectProfile({ project }: { project: GridProject }) {
  const fields: Array<[string, string | number | null | undefined]> = [
    ["Queue ID", project.queueId],
    ["ISO", project.iso],
    ["Owner", project.ownerCompany],
    ["County", project.county],
    ["State", project.state],
    ["Latitude", project.lat?.toFixed(5)],
    ["Longitude", project.lng?.toFixed(5)],
    ["First seen", formatDateTime(project.firstSeenAt)],
    ["Last updated", formatDateTime(project.lastUpdatedAt)]
  ]

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-4 w-4" />
          Project Profile
        </CardTitle>
        <CardDescription>Current normalized fields for this queue record.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <Fact key={label} label={label} value={value} />
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function EventFeed({ events }: { events: QueueEvent[] }) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListChecks className="h-4 w-4" />
          Queue Events
        </CardTitle>
        <CardDescription>Classified movement and business-impact signals.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState>No classified queue events yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <article key={event.id} className="rounded-md border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded border px-2 py-1 text-xs capitalize ${
                        SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.info
                      }`}
                    >
                      {event.severity}
                    </span>
                    <h3 className="mt-2 font-medium">{event.title}</h3>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(event.eventAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
                <p className="mt-2 font-mono text-[11px] uppercase text-muted-foreground">
                  {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType.replaceAll("_", " ")}
                </p>
                {event.oldValue !== null || event.newValue !== null ? (
                  <p className="mt-2 break-words font-mono text-xs text-muted-foreground">
                    {event.oldValue ?? "No value"} -&gt; {event.newValue ?? "No value"}
                  </p>
                ) : null}
                {event.sourceUrl ? (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {event.sourceName ?? "Source report"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FieldChangeTimeline({ changes }: { changes: ProjectChange[] }) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-4 w-4" />
          Field Changes
        </CardTitle>
        <CardDescription>Raw field-level changes observed across queue snapshots.</CardDescription>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <EmptyState>No tracked field changes yet.</EmptyState>
        ) : (
          <div className="space-y-2">
            {changes.map((change) => (
              <div key={change.id} className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{change.fieldName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(change.changedAt)}
                  </span>
                </div>
                <p className="mt-2 break-words font-mono text-xs text-muted-foreground">
                  {change.oldValue ?? "No value"} -&gt; {change.newValue ?? "No value"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SnapshotHistory({
  snapshots
}: {
  snapshots: ProjectSnapshot[]
}) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-4 w-4" />
          Snapshot History
        </CardTitle>
        <CardDescription>Recent captured state for this project.</CardDescription>
      </CardHeader>
      <CardContent>
        {snapshots.length === 0 ? (
          <EmptyState>No snapshots captured yet.</EmptyState>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="border-b border-border px-3 py-2">Date</th>
                  <th className="border-b border-border px-3 py-2">MW</th>
                  <th className="border-b border-border px-3 py-2">Phase</th>
                  <th className="border-b border-border px-3 py-2">Status</th>
                  <th className="border-b border-border px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-border/70">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {snapshot.snapshotDate}
                    </td>
                    <td className="px-3 py-2">{formatNumber(snapshot.mwRequested)}</td>
                    <td className="px-3 py-2">{snapshot.currentPhase ?? "Not captured"}</td>
                    <td className="px-3 py-2">{snapshot.currentStatus ?? "Not captured"}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted-foreground">
                      {snapshot.sourceUrl ? (
                        <a
                          href={snapshot.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-4 hover:underline"
                        >
                          {snapshot.sourceName ?? snapshot.sourceUrl}
                        </a>
                      ) : (
                        "Not captured"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NearbySubstations({
  substations
}: {
  substations: NearbySubstation[]
}) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RadioTower className="h-4 w-4" />
          Nearby Substations
        </CardTitle>
        <CardDescription>Nearest HIFLD substations by project coordinate.</CardDescription>
      </CardHeader>
      <CardContent>
        {substations.length === 0 ? (
          <EmptyState>No nearby substations available for this project.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {substations.map((substation) => (
              <div key={substation.id} className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{substation.name ?? "Unnamed substation"}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{substation.owner ?? "Owner unknown"}</p>
                  </div>
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Distance</dt>
                    <dd className="mt-1 font-mono">
                      {substation.distanceMiles === null ? "Unknown" : `${substation.distanceMiles} mi`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Voltage</dt>
                    <dd className="mt-1 font-mono">
                      {substation.voltageKv === null ? "Unknown" : `${substation.voltageKv} kV`}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function compactList(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value))
}

function formatNumber(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toLocaleString()
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not captured"
  }
  return new Date(value).toLocaleString()
}
