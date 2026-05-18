import type {
  DashboardData,
  GridProject,
  HealthData,
  ProjectChange,
  QueueEvent,
  RecentChange,
  SourceReportHealth,
  Substation
} from "@gridpath/shared"

import { getSql } from "@/lib/db"

type ProjectRow = {
  id: string
  iso: string
  queue_id: string
  project_name: string | null
  mw_requested: string | number | null
  fuel_type: string | null
  county: string | null
  state: string | null
  lat: string | number | null
  lng: string | number | null
  current_phase: string | null
  current_status: string | null
  filed_date: Date | string | null
  ia_signed_date: Date | string | null
  energized_date: Date | string | null
  withdrawn_date: Date | string | null
  owner_company: string | null
  raw_source_url: string | null
  first_seen_at: Date | string
  last_updated_at: Date | string
}

type ChangeRow = {
  id: string
  project_id: string
  changed_at: Date | string
  field_name: string
  old_value: string | null
  new_value: string | null
}

type SubstationRow = {
  id: string
  hifld_id: string
  name: string | null
  owner: string | null
  voltage_kv: string | number | null
  lat: string | number | null
  lng: string | number | null
}

type IsoHealthRow = {
  iso: string
  project_count: string | number
  latest_snapshot_at: Date | string | null
  snapshot_fresh: boolean
}

type BreakdownRow = {
  iso: string
  label: string | null
  count: string | number
}

type RecentChangeRow = {
  id: string
  iso: string
  queue_id: string
  project_name: string | null
  changed_at: Date | string
  field_name: string
  old_value: string | null
  new_value: string | null
}

type QueueEventRow = {
  id: string
  project_id: string
  iso: string
  queue_id: string
  project_name: string | null
  source_url: string | null
  source_name: string | null
  event_type: QueueEvent["eventType"]
  severity: QueueEvent["severity"]
  title: string
  description: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  delta_mw: string | number | null
  event_at: Date | string
  created_at: Date | string
}

type SourceReportRow = {
  id: string
  iso: string
  source_url: string
  source_name: string | null
  published_at: Date | string | null
  report_date: Date | string | null
  status: string
  error_message: string | null
  started_at: Date | string | null
  completed_at: Date | string | null
}

type EventSeverityRow = {
  severity: string
  count: string | number
}

function numberOrNull(value: string | number | null): number | null {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

function toDateString(value: Date | string | null): string | null {
  return toIsoString(value)?.slice(0, 10) ?? null
}

function isUndefinedRelationError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null
  if (!err) return false
  if (err.code === "42P01" || err.code === "42703") return true
  return typeof err.message === "string" && /(relation|column) .* does not exist/i.test(err.message)
}

function mapChange(row: ChangeRow): ProjectChange {
  return {
    id: row.id,
    changedAt: toIsoString(row.changed_at) ?? "",
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value
  }
}

function mapProject(row: ProjectRow, changes: ProjectChange[], events: QueueEvent[]): GridProject {
  return {
    id: row.id,
    iso: row.iso,
    queueId: row.queue_id,
    projectName: row.project_name,
    mwRequested: numberOrNull(row.mw_requested),
    fuelType: row.fuel_type,
    county: row.county,
    state: row.state,
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng),
    currentPhase: row.current_phase,
    currentStatus: row.current_status,
    filedDate: toDateString(row.filed_date),
    iaSignedDate: toDateString(row.ia_signed_date),
    energizedDate: toDateString(row.energized_date),
    withdrawnDate: toDateString(row.withdrawn_date),
    ownerCompany: row.owner_company,
    rawSourceUrl: row.raw_source_url,
    firstSeenAt: toIsoString(row.first_seen_at) ?? "",
    lastUpdatedAt: toIsoString(row.last_updated_at) ?? "",
    changes,
    events
  }
}

function mapSubstation(row: SubstationRow): Substation {
  return {
    id: row.id,
    hifldId: row.hifld_id,
    name: row.name,
    owner: row.owner,
    voltageKv: numberOrNull(row.voltage_kv),
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng)
  }
}

function mapQueueEvent(row: QueueEventRow): QueueEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    iso: row.iso,
    queueId: row.queue_id,
    projectName: row.project_name,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    eventType: row.event_type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    deltaMw: numberOrNull(row.delta_mw),
    eventAt: toIsoString(row.event_at) ?? "",
    createdAt: toIsoString(row.created_at) ?? ""
  }
}

function mapSourceReport(row: SourceReportRow): SourceReportHealth {
  return {
    id: row.id,
    iso: row.iso,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    publishedAt: toIsoString(row.published_at),
    reportDate: toDateString(row.report_date),
    status: row.status,
    errorMessage: row.error_message,
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at)
  }
}

async function getQueueEventRows(limit = 2000): Promise<QueueEventRow[]> {
  const sql = getSql()
  try {
    const rows = await sql`
      select
        e.id,
        e.project_id,
        p.iso,
        p.queue_id,
        p.project_name,
        r.source_url,
        r.source_name,
        e.event_type,
        e.severity,
        e.title,
        e.description,
        e.field_name,
        e.old_value,
        e.new_value,
        e.delta_mw,
        e.event_at,
        e.created_at
      from queue_events e
      join projects p on p.id = e.project_id
      left join source_reports r on r.id = e.source_report_id
      where p.iso in ('ERCOT', 'CAISO')
      order by e.event_at desc, e.created_at desc
      limit ${limit}
    `
    return rows as QueueEventRow[]
  } catch (error) {
    if (isUndefinedRelationError(error)) return []
    throw error
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.DATABASE_URL) {
    return { projects: [], substations: [], recentEvents: [], latestSnapshotAt: null }
  }

  const sql = getSql()
  const [projectRows, changeRows, eventRows, substationRows, freshnessRows] = await Promise.all([
    sql`select * from projects where iso in ('ERCOT', 'CAISO') order by iso, queue_id limit 10000`,
    sql`
      select c.*
      from project_status_changes c
      join projects p on p.id = c.project_id
      where p.iso in ('ERCOT', 'CAISO')
      order by c.changed_at desc
      limit 2000
    `,
    getQueueEventRows(2000),
    sql`select * from substations order by name nulls last limit 5000`,
    sql`select max(captured_at) as latest_snapshot_at from project_snapshots`
  ])

  const changesByProject = new Map<string, ProjectChange[]>()
  for (const row of changeRows as ChangeRow[]) {
    const bucket = changesByProject.get(row.project_id) ?? []
    bucket.push(mapChange(row))
    changesByProject.set(row.project_id, bucket)
  }
  const events = (eventRows as QueueEventRow[]).map(mapQueueEvent)
  const eventsByProject = new Map<string, QueueEvent[]>()
  for (const event of events) {
    const bucket = eventsByProject.get(event.projectId) ?? []
    bucket.push(event)
    eventsByProject.set(event.projectId, bucket)
  }

  return {
    projects: (projectRows as ProjectRow[]).map((row) =>
      mapProject(row, changesByProject.get(row.id) ?? [], eventsByProject.get(row.id) ?? [])
    ),
    substations: (substationRows as SubstationRow[]).map(mapSubstation),
    recentEvents: events,
    latestSnapshotAt:
      toIsoString(
        (freshnessRows as Array<{ latest_snapshot_at: Date | string | null }>)[0]
          ?.latest_snapshot_at ?? null
      ) ?? null
  }
}

function countValue(value: string | number): number {
  return Number(value)
}

function mapRecentChange(row: RecentChangeRow): RecentChange {
  return {
    id: row.id,
    iso: row.iso,
    queueId: row.queue_id,
    projectName: row.project_name,
    changedAt: toIsoString(row.changed_at) ?? "",
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value
  }
}

async function getHealthEventRows(): Promise<{
  latestSourceReports: SourceReportHealth[]
  failedSourceReports: SourceReportHealth[]
  eventSeverityCounts: HealthData["eventSeverityCounts"]
}> {
  const sql = getSql()
  try {
    const [latestRows, failedRows, severityRows] = await Promise.all([
      sql`
        select distinct on (iso)
          id, iso, source_url, source_name, published_at, report_date, status,
          error_message, started_at, completed_at
        from source_reports
        where iso in ('ERCOT', 'CAISO') and status = 'success'
        order by iso, completed_at desc nulls last, created_at desc
      `,
      sql`
        select id, iso, source_url, source_name, published_at, report_date, status,
               error_message, started_at, completed_at
        from source_reports
        where iso in ('ERCOT', 'CAISO') and status = 'failed'
        order by completed_at desc nulls last, updated_at desc
        limit 20
      `,
      sql`
        select severity, count(*)::bigint as count
        from queue_events
        where event_at >= now() - interval '7 days'
        group by severity
        order by count desc
      `
    ])
    return {
      latestSourceReports: (latestRows as SourceReportRow[]).map(mapSourceReport),
      failedSourceReports: (failedRows as SourceReportRow[]).map(mapSourceReport),
      eventSeverityCounts: (severityRows as EventSeverityRow[]).map((row) => ({
        severity: row.severity,
        count: countValue(row.count)
      }))
    }
  } catch (error) {
    if (isUndefinedRelationError(error)) {
      return { latestSourceReports: [], failedSourceReports: [], eventSeverityCounts: [] }
    }
    throw error
  }
}

export async function getHealthData(): Promise<HealthData> {
  const generatedAt = new Date().toISOString()
  if (!process.env.DATABASE_URL) {
    return {
      generatedAt,
      isoHealth: [],
      phaseCounts: [],
      fuelCounts: [],
      recentChanges: [],
      latestSourceReports: [],
      failedSourceReports: [],
      eventSeverityCounts: []
    }
  }

  const sql = getSql()
  const [isoRows, phaseRows, fuelRows, changeRows, eventHealth] = await Promise.all([
    sql`
      select
        p.iso,
        count(distinct p.id) as project_count,
        max(s.captured_at) as latest_snapshot_at,
        coalesce(max(s.captured_at) >= now() - interval '25 hours', false) as snapshot_fresh
      from projects p
      left join project_snapshots s on s.project_id = p.id
      where p.iso in ('ERCOT', 'CAISO')
      group by p.iso
      order by p.iso
    `,
    sql`
      select iso, coalesce(current_phase, 'Unknown') as label, count(*) as count
      from projects
      where iso in ('ERCOT', 'CAISO')
      group by iso, coalesce(current_phase, 'Unknown')
      order by iso, count desc
    `,
    sql`
      select iso, coalesce(fuel_type, 'unknown') as label, count(*) as count
      from projects
      where iso in ('ERCOT', 'CAISO')
      group by iso, coalesce(fuel_type, 'unknown')
      order by iso, count desc
    `,
    sql`
      select
        c.id,
        p.iso,
        p.queue_id,
        p.project_name,
        c.changed_at,
        c.field_name,
        c.old_value,
        c.new_value
      from project_status_changes c
      join projects p on p.id = c.project_id
      where p.iso in ('ERCOT', 'CAISO')
      order by c.changed_at desc
      limit 50
    `,
    getHealthEventRows()
  ])

  return {
    generatedAt,
    isoHealth: (isoRows as IsoHealthRow[]).map((row) => ({
      iso: row.iso,
      projectCount: countValue(row.project_count),
      latestSnapshotAt: toIsoString(row.latest_snapshot_at),
      snapshotFresh: row.snapshot_fresh
    })),
    phaseCounts: (phaseRows as BreakdownRow[]).map((row) => ({
      iso: row.iso,
      label: row.label ?? "Unknown",
      count: countValue(row.count)
    })),
    fuelCounts: (fuelRows as BreakdownRow[]).map((row) => ({
      iso: row.iso,
      label: row.label ?? "unknown",
      count: countValue(row.count)
    })),
    recentChanges: (changeRows as RecentChangeRow[]).map(mapRecentChange),
    latestSourceReports: eventHealth.latestSourceReports,
    failedSourceReports: eventHealth.failedSourceReports,
    eventSeverityCounts: eventHealth.eventSeverityCounts
  }
}

export type LandingStats = {
  totalProjects: number
  totalMwRequested: number | null
  changesLast7d: number
  latestSnapshotAt: string | null
  isoBreakdown: { iso: string; projectCount: number }[]
  recentChanges: RecentChange[]
}

export async function getLandingStats(): Promise<LandingStats> {
  if (!process.env.DATABASE_URL) {
    return {
      totalProjects: 0,
      totalMwRequested: null,
      changesLast7d: 0,
      latestSnapshotAt: null,
      isoBreakdown: [],
      recentChanges: []
    }
  }
  const sql = getSql()
  const [summaryRows, isoRows, freshnessRows, changeRows] = await Promise.all([
    sql`
      select
        count(*)::bigint as total_projects,
        coalesce(sum(mw_requested), 0)::numeric as total_mw,
        (
          select count(*) from project_status_changes c
          join projects p on p.id = c.project_id
          where p.iso in ('ERCOT', 'CAISO')
            and c.changed_at >= now() - interval '7 days'
        )::bigint as changes_7d
      from projects
      where iso in ('ERCOT', 'CAISO')
    `,
    sql`
      select iso, count(*)::bigint as project_count
      from projects
      where iso in ('ERCOT', 'CAISO')
      group by iso
      order by iso
    `,
    sql`select max(captured_at) as latest_snapshot_at from project_snapshots`,
    sql`
      select
        c.id, p.iso, p.queue_id, p.project_name,
        c.changed_at, c.field_name, c.old_value, c.new_value
      from project_status_changes c
      join projects p on p.id = c.project_id
      where p.iso in ('ERCOT', 'CAISO')
      order by c.changed_at desc
      limit 10
    `
  ])

  const summary = (summaryRows as Array<{
    total_projects: string | number
    total_mw: string | number
    changes_7d: string | number
  }>)[0] ?? { total_projects: 0, total_mw: 0, changes_7d: 0 }

  return {
    totalProjects: countValue(summary.total_projects),
    totalMwRequested: numberOrNull(summary.total_mw),
    changesLast7d: countValue(summary.changes_7d),
    latestSnapshotAt:
      toIsoString(
        (freshnessRows as Array<{ latest_snapshot_at: Date | string | null }>)[0]
          ?.latest_snapshot_at ?? null
      ) ?? null,
    isoBreakdown: (isoRows as Array<{ iso: string; project_count: string | number }>).map((row) => ({
      iso: row.iso,
      projectCount: countValue(row.project_count)
    })),
    recentChanges: (changeRows as RecentChangeRow[]).map(mapRecentChange)
  }
}
