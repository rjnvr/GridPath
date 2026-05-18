import type {
  DashboardData,
  GridProject,
  HealthData,
  AnalysisData,
  FuelMixTrend,
  IsoCoverage,
  MonthlyChangeTrend,
  MonthlyProjectTrend,
  ProjectChange,
  RecentChange,
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

function mapChange(row: ChangeRow): ProjectChange {
  return {
    id: row.id,
    changedAt: toIsoString(row.changed_at) ?? "",
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value
  }
}

function mapProject(row: ProjectRow, changes: ProjectChange[]): GridProject {
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
    changes
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

export async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.DATABASE_URL) {
    return { projects: [], substations: [], latestSnapshotAt: null }
  }

  const sql = getSql()
  const [projectRows, changeRows, substationRows, freshnessRows] = await Promise.all([
    sql`select * from projects where iso in ('ERCOT', 'CAISO') order by iso, queue_id limit 10000`,
    sql`
      select c.*
      from project_status_changes c
      join projects p on p.id = c.project_id
      where p.iso in ('ERCOT', 'CAISO')
      order by c.changed_at desc
      limit 2000
    `,
    sql`select * from substations order by name nulls last limit 5000`,
    sql`select max(captured_at) as latest_snapshot_at from project_snapshots`
  ])

  const changesByProject = new Map<string, ProjectChange[]>()
  for (const row of changeRows as ChangeRow[]) {
    const bucket = changesByProject.get(row.project_id) ?? []
    bucket.push(mapChange(row))
    changesByProject.set(row.project_id, bucket)
  }

  return {
    projects: (projectRows as ProjectRow[]).map((row) =>
      mapProject(row, changesByProject.get(row.id) ?? [])
    ),
    substations: (substationRows as SubstationRow[]).map(mapSubstation),
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

function toDateOnlyString(value: Date | string | null): string | null {
  return toIsoString(value)?.slice(0, 10) ?? null
}

function coverageLabel(iso: string): string {
  if (iso === "ERCOT") {
    return "12+ months official ERCOT GIS reports"
  }
  if (iso === "CAISO") {
    return "Official CAISO snapshots from first capture date"
  }
  return "Official queue snapshots"
}

function coverageSource(iso: string): IsoCoverage["source"] {
  return iso === "ERCOT" ? "official_archive" : "captured_snapshots"
}

export async function getHealthData(): Promise<HealthData> {
  const generatedAt = new Date().toISOString()
  if (!process.env.DATABASE_URL) {
    return {
      generatedAt,
      isoHealth: [],
      phaseCounts: [],
      fuelCounts: [],
      recentChanges: []
    }
  }

  const sql = getSql()
  const [isoRows, phaseRows, fuelRows, changeRows] = await Promise.all([
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
    `
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
    recentChanges: (changeRows as RecentChangeRow[]).map(mapRecentChange)
  }
}

async function hasIngestionReportsTable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false
  const sql = getSql()
  const rows = await sql`select to_regclass('public.ingestion_reports') as table_name`
  return Boolean((rows as Array<{ table_name: string | null }>)[0]?.table_name)
}

export async function getAnalysisData(): Promise<AnalysisData> {
  const generatedAt = new Date().toISOString()
  if (!process.env.DATABASE_URL) {
    return {
      generatedAt,
      coverage: [],
      projectTrends: [],
      changeTrends: [],
      fuelMix: [],
      recentChanges: []
    }
  }

  const sql = getSql()
  const hasReportMetadata = await hasIngestionReportsTable()
  const coverageQuery = hasReportMetadata
    ? sql`
        select
          iso,
          min(report_date) as first_report_date,
          max(report_date) as latest_report_date,
          count(*) as report_count
        from ingestion_reports
        where iso in ('ERCOT', 'CAISO')
        group by iso
        order by iso
      `
    : sql`
        select
          p.iso,
          min(s.snapshot_date) as first_report_date,
          max(s.snapshot_date) as latest_report_date,
          count(distinct s.snapshot_date) as report_count
        from project_snapshots s
        join projects p on p.id = s.project_id
        where p.iso in ('ERCOT', 'CAISO')
        group by p.iso
        order by p.iso
      `

  const [coverageRows, projectTrendRows, changeTrendRows, fuelMixRows, changeRows] =
    await Promise.all([
      coverageQuery,
      sql`
        select
          date_trunc('month', s.snapshot_date)::date as month,
          p.iso,
          count(distinct p.id) as project_count
        from project_snapshots s
        join projects p on p.id = s.project_id
        where p.iso in ('ERCOT', 'CAISO')
          and s.snapshot_date >= date_trunc('month', current_date) - interval '11 months'
        group by date_trunc('month', s.snapshot_date)::date, p.iso
        order by month, p.iso
      `,
      sql`
        with first_seen as (
          select project_id, min(snapshot_date) as first_snapshot_date
          from project_snapshots
          group by project_id
        )
        select
          date_trunc('month', s.snapshot_date)::date as month,
          p.iso,
          count(distinct p.id) filter (where fs.first_snapshot_date = s.snapshot_date) as added_count,
          count(distinct p.id) filter (
            where lower(coalesce(s.current_phase, s.current_status, '')) like '%withdraw%'
          ) as withdrawn_count,
          count(distinct p.id) filter (
            where lower(coalesce(s.current_phase, s.current_status, '')) like '%energ%'
               or lower(coalesce(s.current_phase, s.current_status, '')) like '%complete%'
          ) as energized_count
        from project_snapshots s
        join projects p on p.id = s.project_id
        join first_seen fs on fs.project_id = p.id
        where p.iso in ('ERCOT', 'CAISO')
          and s.snapshot_date >= date_trunc('month', current_date) - interval '11 months'
        group by date_trunc('month', s.snapshot_date)::date, p.iso
        order by month, p.iso
      `,
      sql`
        select
          date_trunc('month', s.snapshot_date)::date as month,
          p.iso,
          coalesce(p.fuel_type, 'unknown') as fuel_type,
          count(distinct p.id) as project_count
        from project_snapshots s
        join projects p on p.id = s.project_id
        where p.iso in ('ERCOT', 'CAISO')
          and s.snapshot_date >= date_trunc('month', current_date) - interval '11 months'
        group by date_trunc('month', s.snapshot_date)::date, p.iso, coalesce(p.fuel_type, 'unknown')
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
        where p.iso in ('ERCOT', 'CAISO')
        order by c.changed_at desc
        limit 25
      `
    ])

  return {
    generatedAt,
    coverage: (coverageRows as CoverageRow[]).map((row): IsoCoverage => ({
      iso: row.iso,
      label: coverageLabel(row.iso),
      firstReportDate: toDateOnlyString(row.first_report_date),
      latestReportDate: toDateOnlyString(row.latest_report_date),
      reportCount: countValue(row.report_count),
      source: coverageSource(row.iso)
    })),
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
    fuelMix: (fuelMixRows as FuelMixTrendRow[]).map(
      (row): FuelMixTrend => ({
        month: toMonthString(row.month),
        iso: row.iso,
        fuelType: row.fuel_type ?? "unknown",
        projectCount: countValue(row.project_count)
      })
    ),
    recentChanges: (changeRows as RecentChangeRow[]).map(mapRecentChange)
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
