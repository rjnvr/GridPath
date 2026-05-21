import type {
  AnalysisHeatmapProject,
  AnalysisData,
  DashboardData,
  FuelMixTrend,
  GridProject,
  HeadroomFuelBreakdown,
  HeadroomNearbyProject,
  HeadroomReport,
  HeadroomScore,
  HealthData,
  SubstationDetailData,
  IsoCoverage,
  MonthlyChangeTrend,
  MonthlyProjectTrend,
  NearbySubstation,
  ProjectChange,
  ProjectDetailData,
  ProjectSnapshot,
  QueueEvent,
  RecentChange,
  SourceReportHealth,
  Substation
} from "@gridpath/shared"
import { SUPPORTED_ISOS } from "@gridpath/shared"

import { getSql } from "@/lib/db"

// Mutable copy so the Neon serverless driver can bind it as a Postgres array
// parameter (it doesn't accept readonly arrays from `as const`).
const SUPPORTED_ISO_LIST = [...SUPPORTED_ISOS] as string[]

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

type NearbySubstationRow = SubstationRow & {
  distance_miles: string | number | null
}

type ProjectSnapshotRow = {
  id: string
  snapshot_date: Date | string
  captured_at: Date | string
  current_phase: string | null
  current_status: string | null
  mw_requested: string | number | null
  source_url: string | null
  source_name: string | null
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

type CoverageRow = {
  iso: string
  first_report_date: Date | string | null
  latest_report_date: Date | string | null
  report_count: string | number
}

type MonthlyProjectTrendRow = {
  month: Date | string
  iso: string
  project_count: string | number
}

type MonthlyChangeTrendRow = {
  month: Date | string
  iso: string
  added_count: string | number
  withdrawn_count: string | number
  energized_count: string | number
}

type FuelMixTrendRow = {
  month: Date | string
  iso: string
  fuel_type: string | null
  project_count: string | number
}

type AnalysisHeatmapProjectRow = {
  id: string
  iso: string
  lat: string | number
  lng: string | number
  mw_requested: string | number
}

function mapHeatmapProjectRows(rows: AnalysisHeatmapProjectRow[]): AnalysisHeatmapProject[] {
  return rows
    .map((row): AnalysisHeatmapProject | null => {
      const lat = numberOrNull(row.lat)
      const lng = numberOrNull(row.lng)
      const mwRequested = numberOrNull(row.mw_requested)
      if (lat === null || lng === null || mwRequested === null) {
        return null
      }
      return {
        id: row.id,
        iso: row.iso,
        lat,
        lng,
        mwRequested
      }
    })
    .filter((project): project is AnalysisHeatmapProject => project !== null)
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

function mapNearbySubstation(row: NearbySubstationRow): NearbySubstation {
  return {
    ...mapSubstation(row),
    distanceMiles: numberOrNull(row.distance_miles)
  }
}

function mapProjectSnapshot(row: ProjectSnapshotRow): ProjectSnapshot {
  return {
    id: row.id,
    snapshotDate: toDateString(row.snapshot_date) ?? "",
    capturedAt: toIsoString(row.captured_at) ?? "",
    currentPhase: row.current_phase,
    currentStatus: row.current_status,
    mwRequested: numberOrNull(row.mw_requested),
    sourceUrl: row.source_url,
    sourceName: row.source_name
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
      where p.iso = ANY(${SUPPORTED_ISO_LIST})
      order by e.event_at desc, e.created_at desc
      limit ${limit}
    `
    return rows as QueueEventRow[]
  } catch (error) {
    if (isUndefinedRelationError(error)) return []
    throw error
  }
}

async function getProjectEventRows(projectId: string): Promise<QueueEventRow[]> {
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
      where e.project_id = ${projectId}
      order by e.event_at desc, e.created_at desc
    `
    return rows as QueueEventRow[]
  } catch (error) {
    if (isUndefinedRelationError(error)) return []
    throw error
  }
}

async function getProjectSnapshotRows(projectId: string): Promise<ProjectSnapshotRow[]> {
  const sql = getSql()
  try {
    const rows = await sql`
      select
        s.id,
        s.snapshot_date,
        s.captured_at,
        s.current_phase,
        s.current_status,
        s.mw_requested,
        r.source_url,
        r.source_name
      from project_snapshots s
      left join source_reports r on r.id = s.source_report_id
      where s.project_id = ${projectId}
      order by s.snapshot_date desc, s.captured_at desc
      limit 48
    `
    return rows as ProjectSnapshotRow[]
  } catch (error) {
    if (!isUndefinedRelationError(error)) throw error
  }

  try {
    const fallbackRows = await sql`
      select
        s.id,
        s.snapshot_date,
        s.captured_at,
        s.current_phase,
        s.current_status,
        s.mw_requested,
        null::text as source_url,
        null::text as source_name
      from project_snapshots s
      where s.project_id = ${projectId}
      order by s.snapshot_date desc, s.captured_at desc
      limit 48
    `
    return fallbackRows as ProjectSnapshotRow[]
  } catch (error) {
    if (isUndefinedRelationError(error)) return []
    throw error
  }
}

async function getNearbySubstationRows(projectId: string): Promise<NearbySubstationRow[]> {
  const sql = getSql()
  try {
    const rows = await sql`
      select
        s.id,
        s.hifld_id,
        s.name,
        s.owner,
        s.voltage_kv,
        s.lat,
        s.lng,
        round((st_distancesphere(s.geom, p.geom) / 1609.344)::numeric, 1) as distance_miles
      from substations s
      join projects p on p.id = ${projectId}
      where s.geom is not null
        and p.geom is not null
      order by s.geom <-> p.geom
      limit 8
    `
    return rows as NearbySubstationRow[]
  } catch (error) {
    if (isUndefinedRelationError(error)) return []
    throw error
  }
}

export async function getProjectDetailData(projectId: string): Promise<ProjectDetailData | null> {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const sql = getSql()
  const projectRows = await sql`
    select *
    from projects
    where id = ${projectId}
      and iso = ANY(${SUPPORTED_ISO_LIST})
    limit 1
  `
  const projectRow = (projectRows as ProjectRow[])[0]
  if (!projectRow) {
    return null
  }

  const [changeRows, eventRows, snapshotRows, nearbyRows] = await Promise.all([
    sql`
      select *
      from project_status_changes
      where project_id = ${projectId}
      order by changed_at desc
      limit 200
    `,
    getProjectEventRows(projectId),
    getProjectSnapshotRows(projectId),
    getNearbySubstationRows(projectId)
  ])

  const changes = (changeRows as ChangeRow[]).map(mapChange)
  const events = (eventRows as QueueEventRow[]).map(mapQueueEvent)

  return {
    project: mapProject(projectRow, changes, events),
    snapshots: (snapshotRows as ProjectSnapshotRow[]).map(mapProjectSnapshot),
    nearbySubstations: (nearbyRows as NearbySubstationRow[]).map(mapNearbySubstation)
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.DATABASE_URL) {
    return { projects: [], substations: [], recentEvents: [], latestSnapshotAt: null }
  }

  const sql = getSql()
  const [projectRows, changeRows, eventRows, substationRows, freshnessRows] = await Promise.all([
    sql`select * from projects where iso = ANY(${SUPPORTED_ISO_LIST}) order by iso, queue_id limit 10000`,
    sql`
      select c.*
      from project_status_changes c
      join projects p on p.id = c.project_id
      where p.iso = ANY(${SUPPORTED_ISO_LIST})
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

function toMonthString(value: Date | string): string {
  return toIsoString(value)?.slice(0, 7) ?? String(value).slice(0, 7)
}

function coverageLabel(iso: string): string {
  if (iso === "ERCOT") {
    return "12+ months official ERCOT GIS reports"
  }
  if (iso === "CAISO") {
    return "Official CAISO snapshots from first capture date"
  }
  if (iso === "PJM") {
    return "Official PJM New Services Queue snapshots"
  }
  if (iso === "MISO") {
    return "Official MISO Generator Interconnection Queue snapshots"
  }
  if (iso === "SPP") {
    return "Official SPP Generation Interconnection Queue snapshots"
  }
  return "Official queue snapshots"
}

function coverageSource(iso: string): IsoCoverage["source"] {
  return iso === "ERCOT" ? "official_archive" : "captured_snapshots"
}

export async function getAnalysisData(): Promise<AnalysisData> {
  const generatedAt = new Date().toISOString()
  if (!process.env.DATABASE_URL) {
    return {
      generatedAt,
      coverage: [],
      heatmapProjects: [],
      projectTrends: [],
      changeTrends: [],
      fuelMix: [],
      recentChanges: []
    }
  }

  const sql = getSql()

  try {
    const [
      coverageRows,
      heatmapRows,
      projectTrendRows,
      changeTrendRows,
      fuelMixRows,
      recentRows
    ] =
      await Promise.all([
        sql`
          select
            iso,
            min(report_date) as first_report_date,
            max(report_date) as latest_report_date,
            count(*)::bigint as report_count
          from source_reports
          where iso = ANY(${SUPPORTED_ISO_LIST})
            and status = 'success'
            and report_date is not null
          group by iso
          order by iso
        `,
        sql`
          select
            id,
            iso,
            lat,
            lng,
            mw_requested
          from projects
          where iso = ANY(${SUPPORTED_ISO_LIST})
            and lat is not null
            and lng is not null
            and mw_requested is not null
            and mw_requested > 0
            and lng between -125 and -66
            and lat between 24 and 50
            and not (
              lower(
                coalesce(current_status, '') || ' ' || coalesce(current_phase, '')
              ) ~ '(withdrawn|cancelled|canceled|energized|completed|retired|inactive)'
            )
          order by mw_requested desc nulls last
          limit 15000
        `,
        sql`
          select
            date_trunc('month', s.snapshot_date)::date as month,
            p.iso,
            count(distinct p.id)::bigint as project_count
          from project_snapshots s
          join projects p on p.id = s.project_id
          where p.iso = ANY(${SUPPORTED_ISO_LIST})
            and s.snapshot_date >= current_date - interval '12 months'
          group by month, p.iso
          order by month, p.iso
        `,
        sql`
          select
            date_trunc('month', c.changed_at)::date as month,
            p.iso,
            count(*) filter (where c.field_name = 'project_name' and c.old_value is null)::bigint
              as added_count,
            count(*) filter (
              where c.field_name in ('current_status', 'current_phase', 'withdrawn_date')
                and lower(coalesce(c.new_value, '')) like '%withdraw%'
            )::bigint as withdrawn_count,
            count(*) filter (
              where c.field_name in ('current_status', 'current_phase', 'energized_date')
                and lower(coalesce(c.new_value, '')) like '%energ%'
            )::bigint as energized_count
          from project_status_changes c
          join projects p on p.id = c.project_id
          where p.iso = ANY(${SUPPORTED_ISO_LIST})
            and c.changed_at >= current_date - interval '12 months'
          group by month, p.iso
          order by month desc, p.iso
        `,
        sql`
          select
            date_trunc('month', s.snapshot_date)::date as month,
            p.iso,
            coalesce(p.fuel_type, 'unknown') as fuel_type,
            count(distinct p.id)::bigint as project_count
          from project_snapshots s
          join projects p on p.id = s.project_id
          where p.iso = ANY(${SUPPORTED_ISO_LIST})
            and s.snapshot_date >= current_date - interval '12 months'
          group by month, p.iso, coalesce(p.fuel_type, 'unknown')
          order by month, p.iso, project_count desc
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
          where p.iso = ANY(${SUPPORTED_ISO_LIST})
          order by c.changed_at desc
          limit 25
        `
      ])

    return {
      generatedAt,
      coverage: (coverageRows as CoverageRow[]).map((row): IsoCoverage => ({
        iso: row.iso,
        label: coverageLabel(row.iso),
        firstReportDate: toDateString(row.first_report_date),
        latestReportDate: toDateString(row.latest_report_date),
        reportCount: countValue(row.report_count),
        source: coverageSource(row.iso)
      })),
      heatmapProjects: mapHeatmapProjectRows(heatmapRows as AnalysisHeatmapProjectRow[]),
      projectTrends: (projectTrendRows as MonthlyProjectTrendRow[]).map(
        (row): MonthlyProjectTrend => ({
          month: toMonthString(row.month),
          iso: row.iso,
          projectCount: countValue(row.project_count)
        })
      ),
      changeTrends: (changeTrendRows as MonthlyChangeTrendRow[]).map(
        (row): MonthlyChangeTrend => ({
          month: toMonthString(row.month),
          iso: row.iso,
          addedCount: countValue(row.added_count),
          withdrawnCount: countValue(row.withdrawn_count),
          energizedCount: countValue(row.energized_count)
        })
      ),
      fuelMix: (fuelMixRows as FuelMixTrendRow[]).map((row): FuelMixTrend => ({
        month: toMonthString(row.month),
        iso: row.iso,
        fuelType: row.fuel_type ?? "unknown",
        projectCount: countValue(row.project_count)
      })),
      recentChanges: (recentRows as RecentChangeRow[]).map(mapRecentChange)
    }
  } catch (error) {
    if (isUndefinedRelationError(error)) {
      return {
        generatedAt,
        coverage: [],
        heatmapProjects: [],
        projectTrends: [],
        changeTrends: [],
        fuelMix: [],
        recentChanges: []
      }
    }
    throw error
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
        where iso = ANY(${SUPPORTED_ISO_LIST}) and status = 'success'
        order by iso, completed_at desc nulls last, created_at desc
      `,
      sql`
        select id, iso, source_url, source_name, published_at, report_date, status,
               error_message, started_at, completed_at
        from source_reports
        where iso = ANY(${SUPPORTED_ISO_LIST}) and status = 'failed'
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
      where p.iso = ANY(${SUPPORTED_ISO_LIST})
      group by p.iso
      order by p.iso
    `,
    sql`
      select iso, coalesce(current_phase, 'Unknown') as label, count(*) as count
      from projects
      where iso = ANY(${SUPPORTED_ISO_LIST})
      group by iso, coalesce(current_phase, 'Unknown')
      order by iso, count desc
    `,
    sql`
      select iso, coalesce(fuel_type, 'unknown') as label, count(*) as count
      from projects
      where iso = ANY(${SUPPORTED_ISO_LIST})
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
      where p.iso = ANY(${SUPPORTED_ISO_LIST})
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

type HeadroomAggregateRow = {
  projects_in_area: string | number
  mw_queued: string | number | null
  mw_energized: string | number | null
  mw_withdrawn: string | number | null
  median_queue_months: string | number | null
  iso_list: string[] | null
}

type HeadroomFuelRow = {
  fuel_type: string | null
  project_count: string | number
  mw_queued: string | number | null
  mw_energized: string | number | null
}

type HeadroomNearbyProjectRow = {
  id: string
  iso: string
  queue_id: string
  project_name: string | null
  fuel_type: string | null
  mw_requested: string | number | null
  current_phase: string | null
  current_status: string | null
  lat: string | number | null
  lng: string | number | null
  distance_miles: string | number | null
}

function computeHeadroomScore(mwQueued: number, mwEnergized: number): {
  score: HeadroomScore
  rationale: string
} {
  // Heuristic, not authoritative. Bands are tuned for a 25-mile radius and can be
  // adjusted later when we have better ground truth from transmission constraints.
  if (mwQueued >= 5000) {
    return {
      score: "saturated",
      rationale: `${mwQueued.toLocaleString()} MW already queued in this area — competition for capacity is intense and lead times are likely longest in the ISO.`
    }
  }
  if (mwQueued >= 2000) {
    return {
      score: "low",
      rationale: `${mwQueued.toLocaleString()} MW queued plus ${mwEnergized.toLocaleString()} MW already energized. Expect multi-year queue progression and meaningful capacity competition.`
    }
  }
  if (mwQueued >= 500) {
    return {
      score: "medium",
      rationale: `${mwQueued.toLocaleString()} MW queued. Some competing demand exists; substations may still have headroom but require a study to confirm.`
    }
  }
  return {
    score: "high",
    rationale: `Only ${mwQueued.toLocaleString()} MW currently queued nearby — relatively quiet corridor with likely faster interconnect timelines.`
  }
}

export async function getHeadroomReport(
  lat: number,
  lng: number,
  radiusMiles = 25
): Promise<HeadroomReport | null> {
  if (!process.env.DATABASE_URL) {
    return null
  }
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null
  }
  const normalizedRadius = Number.isFinite(radiusMiles) ? radiusMiles : 25
  const clampedRadius = Math.max(5, Math.min(150, normalizedRadius))
  const radiusMeters = clampedRadius * 1609.344
  const sql = getSql()

  try {
    const [aggregateRows, fuelRows, substationRows, nearbyProjectRows] = await Promise.all([
      sql`
        with nearby as (
          select
            p.id,
            p.iso,
            p.mw_requested,
            p.fuel_type,
            p.current_status,
            p.current_phase,
            p.filed_date,
            p.energized_date,
            p.withdrawn_date
          from projects p
          where p.geom is not null
            and st_dwithin(
              p.geom::geography,
              st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography,
              ${radiusMeters}
            )
        ),
        durations as (
          select (coalesce(energized_date, current_date) - filed_date)::numeric / 30.4375 as months
          from nearby
          where filed_date is not null
            and withdrawn_date is null
        )
        select
          (select count(*) from nearby)::bigint as projects_in_area,
          coalesce((
            select sum(mw_requested)
            from nearby
            where withdrawn_date is null
              and energized_date is null
          ), 0)::numeric as mw_queued,
          coalesce((
            select sum(mw_requested) from nearby where energized_date is not null
          ), 0)::numeric as mw_energized,
          coalesce((
            select sum(mw_requested) from nearby where withdrawn_date is not null
          ), 0)::numeric as mw_withdrawn,
          (select percentile_cont(0.5) within group (order by months) from durations)::numeric as median_queue_months,
          (select array_agg(distinct iso order by iso) from nearby) as iso_list
      `,
      sql`
        select
          coalesce(p.fuel_type, 'unknown') as fuel_type,
          count(*)::bigint as project_count,
          coalesce(sum(p.mw_requested) filter (
            where p.withdrawn_date is null and p.energized_date is null
          ), 0)::numeric as mw_queued,
          coalesce(sum(p.mw_requested) filter (where p.energized_date is not null), 0)::numeric as mw_energized
        from projects p
        where p.geom is not null
          and st_dwithin(
            p.geom::geography,
            st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )
        group by coalesce(p.fuel_type, 'unknown')
        order by mw_queued desc nulls last, project_count desc
      `,
      sql`
        select
          s.id,
          s.hifld_id,
          s.name,
          s.owner,
          s.voltage_kv,
          s.lat,
          s.lng,
          round((
            st_distancesphere(s.geom, st_setsrid(st_makepoint(${lng}, ${lat}), 4326)) / 1609.344
          )::numeric, 1) as distance_miles
        from substations s
        where s.geom is not null
          and st_dwithin(
            s.geom::geography,
            st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )
        order by s.geom <-> st_setsrid(st_makepoint(${lng}, ${lat}), 4326)
        limit 8
      `,
      sql`
        select
          p.id,
          p.iso,
          p.queue_id,
          p.project_name,
          p.fuel_type,
          p.mw_requested,
          p.current_phase,
          p.current_status,
          p.lat,
          p.lng,
          round((
            st_distancesphere(p.geom, st_setsrid(st_makepoint(${lng}, ${lat}), 4326)) / 1609.344
          )::numeric, 1) as distance_miles
        from projects p
        where p.geom is not null
          and st_dwithin(
            p.geom::geography,
            st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )
        order by p.mw_requested desc nulls last, p.geom <-> st_setsrid(st_makepoint(${lng}, ${lat}), 4326)
        limit 25
      `
    ])

    const aggregate = (aggregateRows as HeadroomAggregateRow[])[0]
    const mwQueued = numberOrNull(aggregate?.mw_queued ?? 0) ?? 0
    const mwEnergized = numberOrNull(aggregate?.mw_energized ?? 0) ?? 0
    const mwWithdrawn = numberOrNull(aggregate?.mw_withdrawn ?? 0) ?? 0
    const medianQueueMonths = numberOrNull(aggregate?.median_queue_months ?? null)
    const projectsInArea = countValue(aggregate?.projects_in_area ?? 0)
    const { score, rationale } = computeHeadroomScore(mwQueued, mwEnergized)

    const fuelBreakdown: HeadroomFuelBreakdown[] = (fuelRows as HeadroomFuelRow[]).map((row) => ({
      fuelType: row.fuel_type ?? "unknown",
      projectCount: countValue(row.project_count),
      mwQueued: numberOrNull(row.mw_queued) ?? 0,
      mwEnergized: numberOrNull(row.mw_energized) ?? 0
    }))

    const nearbySubstations = (substationRows as NearbySubstationRow[]).map(mapNearbySubstation)

    const nearbyProjects: HeadroomNearbyProject[] = (nearbyProjectRows as HeadroomNearbyProjectRow[]).map(
      (row) => ({
        id: row.id,
        iso: row.iso,
        queueId: row.queue_id,
        projectName: row.project_name,
        fuelType: row.fuel_type,
        mwRequested: numberOrNull(row.mw_requested),
        currentPhase: row.current_phase,
        currentStatus: row.current_status,
        distanceMiles: numberOrNull(row.distance_miles),
        lat: numberOrNull(row.lat),
        lng: numberOrNull(row.lng)
      })
    )

    return {
      generatedAt: new Date().toISOString(),
      center: { lat, lng },
      radiusMiles: clampedRadius,
      projectsInArea,
      mwQueued,
      mwEnergized,
      mwWithdrawn,
      medianQueueMonths,
      score,
      scoreRationale: rationale,
      isoCoverage: aggregate?.iso_list ?? [],
      fuelBreakdown,
      nearbySubstations,
      nearbyProjects
    }
  } catch (error) {
    if (isUndefinedRelationError(error)) return null
    throw error
  }
}

export async function getHeadroomHeatmapProjects(): Promise<AnalysisHeatmapProject[]> {
  if (!process.env.DATABASE_URL) {
    return []
  }

  const sql = getSql()

  try {
    const rows = await sql`
      select
        id,
        iso,
        lat,
        lng,
        mw_requested
      from projects
      where iso = ANY(${SUPPORTED_ISO_LIST})
        and lat is not null
        and lng is not null
        and mw_requested is not null
        and mw_requested > 0
        and lng between -125 and -66
        and lat between 24 and 50
        and not (
          lower(
            coalesce(current_status, '') || ' ' || coalesce(current_phase, '')
          ) ~ '(withdrawn|cancelled|canceled|retired|inactive)'
        )
      order by mw_requested desc nulls last
      limit 25000
    `
    return mapHeatmapProjectRows(rows as AnalysisHeatmapProjectRow[])
  } catch (error) {
    if (isUndefinedRelationError(error)) return []
    throw error
  }
}

export async function getSubstationDetail(
  substationId: string,
  radiusMiles = 10
): Promise<SubstationDetailData | null> {
  if (!process.env.DATABASE_URL) return null
  const clampedRadius = Math.max(2, Math.min(50, radiusMiles))
  const radiusMeters = clampedRadius * 1609.344
  const sql = getSql()

  try {
    const substationRows = await sql`
      select id, hifld_id, name, owner, voltage_kv, lat, lng
      from substations
      where id = ${substationId}
      limit 1
    `
    const substationRow = (substationRows as SubstationRow[])[0]
    if (!substationRow) return null
    const substation = mapSubstation(substationRow)
    if (substation.lat === null || substation.lng === null) {
      return {
        substation,
        radiusMiles: clampedRadius,
        projectCount: 0,
        mwQueued: 0,
        mwEnergized: 0,
        fuelBreakdown: [],
        nearbyProjects: [],
        recentEvents: []
      }
    }

    const [aggregateRows, fuelRows, nearbyProjectRows, recentEventRows] = await Promise.all([
      sql`
        select
          count(*)::bigint as project_count,
          coalesce(sum(mw_requested) filter (
            where withdrawn_date is null and energized_date is null
          ), 0)::numeric as mw_queued,
          coalesce(sum(mw_requested) filter (where energized_date is not null), 0)::numeric as mw_energized
        from projects p
        where p.geom is not null
          and st_dwithin(
            p.geom::geography,
            (select geom::geography from substations where id = ${substationId}),
            ${radiusMeters}
          )
      `,
      sql`
        select
          coalesce(fuel_type, 'unknown') as fuel_type,
          count(*)::bigint as project_count,
          coalesce(sum(mw_requested) filter (
            where withdrawn_date is null and energized_date is null
          ), 0)::numeric as mw_queued,
          coalesce(sum(mw_requested) filter (where energized_date is not null), 0)::numeric as mw_energized
        from projects p
        where p.geom is not null
          and st_dwithin(
            p.geom::geography,
            (select geom::geography from substations where id = ${substationId}),
            ${radiusMeters}
          )
        group by coalesce(fuel_type, 'unknown')
        order by mw_queued desc nulls last, project_count desc
      `,
      sql`
        with sub as (select geom from substations where id = ${substationId})
        select
          p.id, p.iso, p.queue_id, p.project_name, p.fuel_type, p.mw_requested,
          p.current_phase, p.current_status,
          round((st_distancesphere(p.geom, (select geom from sub)) / 1609.344)::numeric, 1) as distance_miles
        from projects p
        where p.geom is not null
          and st_dwithin(
            p.geom::geography,
            (select geom::geography from sub),
            ${radiusMeters}
          )
        order by p.mw_requested desc nulls last, p.geom <-> (select geom from sub)
        limit 25
      `,
      sql`
        with sub as (select geom from substations where id = ${substationId})
        select
          e.id, e.project_id, p.iso, p.queue_id, p.project_name,
          r.source_url, r.source_name,
          e.event_type, e.severity, e.title, e.description,
          e.field_name, e.old_value, e.new_value, e.delta_mw,
          e.event_at, e.created_at
        from queue_events e
        join projects p on p.id = e.project_id
        left join source_reports r on r.id = e.source_report_id
        where p.geom is not null
          and st_dwithin(
            p.geom::geography,
            (select geom::geography from sub),
            ${radiusMeters}
          )
          and e.event_at >= now() - interval '30 days'
        order by e.event_at desc
        limit 50
      `
    ])

    const aggregate = (aggregateRows as Array<{
      project_count: string | number
      mw_queued: string | number | null
      mw_energized: string | number | null
    }>)[0]

    const fuelBreakdown = (fuelRows as Array<{
      fuel_type: string | null
      project_count: string | number
      mw_queued: string | number | null
      mw_energized: string | number | null
    }>).map((row) => ({
      fuelType: row.fuel_type ?? "unknown",
      projectCount: countValue(row.project_count),
      mwQueued: numberOrNull(row.mw_queued) ?? 0,
      mwEnergized: numberOrNull(row.mw_energized) ?? 0
    }))

    const nearbyProjects = (nearbyProjectRows as Array<{
      id: string
      iso: string
      queue_id: string
      project_name: string | null
      fuel_type: string | null
      mw_requested: string | number | null
      current_phase: string | null
      current_status: string | null
      distance_miles: string | number | null
    }>).map((row) => ({
      id: row.id,
      iso: row.iso,
      queueId: row.queue_id,
      projectName: row.project_name,
      fuelType: row.fuel_type,
      mwRequested: numberOrNull(row.mw_requested),
      currentPhase: row.current_phase,
      currentStatus: row.current_status,
      distanceMiles: numberOrNull(row.distance_miles)
    }))

    const recentEvents = (recentEventRows as QueueEventRow[]).map(mapQueueEvent)

    return {
      substation,
      radiusMiles: clampedRadius,
      projectCount: countValue(aggregate?.project_count ?? 0),
      mwQueued: numberOrNull(aggregate?.mw_queued ?? 0) ?? 0,
      mwEnergized: numberOrNull(aggregate?.mw_energized ?? 0) ?? 0,
      fuelBreakdown,
      nearbyProjects,
      recentEvents
    }
  } catch (error) {
    if (isUndefinedRelationError(error)) return null
    throw error
  }
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
          where p.iso = ANY(${SUPPORTED_ISO_LIST})
            and c.changed_at >= now() - interval '7 days'
        )::bigint as changes_7d
      from projects
      where iso = ANY(${SUPPORTED_ISO_LIST})
    `,
    sql`
      select iso, count(*)::bigint as project_count
      from projects
      where iso = ANY(${SUPPORTED_ISO_LIST})
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
      where p.iso = ANY(${SUPPORTED_ISO_LIST})
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
