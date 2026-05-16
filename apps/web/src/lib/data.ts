import type { DashboardData, GridProject, ProjectChange, Substation } from "@gridpath/shared"

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
    sql`select * from projects where iso = 'ERCOT' order by queue_id limit 5000`,
    sql`
      select c.*
      from project_status_changes c
      join projects p on p.id = c.project_id
      where p.iso = 'ERCOT'
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
