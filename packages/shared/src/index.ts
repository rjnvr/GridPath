// Single source of truth for which ISOs have data flowing into GridPath.
// Add a new ISO here once its ingestion is wired up — the dashboard, headroom,
// analysis, and health pages all read from this list.
export const SUPPORTED_ISOS = ["ERCOT", "CAISO", "PJM", "MISO", "SPP"] as const
export type SupportedIso = (typeof SUPPORTED_ISOS)[number]

export const CANONICAL_FUEL_TYPES = ["solar", "wind", "storage", "gas", "hydro", "other"] as const
export type CanonicalFuelType = (typeof CANONICAL_FUEL_TYPES)[number]

export const CANONICAL_PROJECT_STATUSES = [
  "Active",
  "Withdrawn",
  "Energized",
  "Completed",
  "Cancelled",
  "Suspended",
  "Inactive"
] as const
export type CanonicalProjectStatus = (typeof CANONICAL_PROJECT_STATUSES)[number]

export type FuelType = CanonicalFuelType | string

function normalizedToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function normalizeFuelType(value: string | null | undefined): CanonicalFuelType | null {
  if (!value) return null
  const token = normalizedToken(value)
  if (!token) return null

  if (/\b(sol|solar|pv|photovoltaic|photovoltaics)\b/.test(token)) return "solar"
  if (/\b(win|wind)\b/.test(token)) return "wind"
  if (/\b(bess|battery|batteries|storage|stor|ess|esr)\b/.test(token)) return "storage"
  if (/\b(gas|natural gas|nat gas|ng|ccgt|cc|ct|combustion turbine|simple cycle|combined cycle)\b/.test(token)) {
    return "gas"
  }
  if (/\b(hydro|hydroelectric|water)\b/.test(token)) return "hydro"

  return "other"
}

export function formatFuelType(value: string | null | undefined): string | null {
  const normalized = normalizeFuelType(value)
  if (!normalized) return null
  return normalized
}

export function normalizeProjectStatus(
  value: string | null | undefined
): CanonicalProjectStatus | null {
  if (!value) return null
  const token = normalizedToken(value)
  if (!token) return null

  if (/^(w|wd)$/.test(token) || /\b(withdrawn|withdraw|withdrew)\b/.test(token)) return "Withdrawn"
  if (/\b(cancelled|canceled|cancel|terminated|termination)\b/.test(token)) return "Cancelled"
  if (/\b(suspended|suspension|on hold|paused)\b/.test(token)) return "Suspended"
  if (/\b(inactive|retired|deactivated|abandoned|expired)\b/.test(token)) return "Inactive"
  if (/\b(energized|in service|commercial operation|operational|online|cod|is done)\b/.test(token)) {
    return "Energized"
  }
  if (/\b(completed|complete|closed|done)\b/.test(token)) return "Completed"

  return "Active"
}

export type ProjectChange = {
  id: string
  changedAt: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

export type QueueEventType =
  | "new_project"
  | "phase_advanced"
  | "phase_regressed"
  | "ia_executed"
  | "energized"
  | "withdrawn"
  | "mw_increase"
  | "mw_decrease"
  | "owner_changed"
  | "milestone_date_changed"
  | "status_changed"
  | "project_field_changed"

export type QueueEventSeverity = "info" | "watch" | "important" | "critical"

export type QueueEvent = {
  id: string
  projectId: string
  iso: string
  queueId: string
  projectName: string | null
  sourceUrl: string | null
  sourceName: string | null
  eventType: QueueEventType
  severity: QueueEventSeverity
  title: string
  description: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  deltaMw: number | null
  eventAt: string
  createdAt: string
}

export type GridProject = {
  id: string
  iso: "ERCOT" | string
  queueId: string
  projectName: string | null
  mwRequested: number | null
  fuelType: FuelType | null
  county: string | null
  state: string | null
  lat: number | null
  lng: number | null
  locationSource: string | null
  locationConfidence: string | null
  address: string | null
  pointOfInterconnection: string | null
  locationNotes: string | null
  currentPhase: string | null
  currentStatus: string | null
  filedDate: string | null
  iaSignedDate: string | null
  energizedDate: string | null
  withdrawnDate: string | null
  ownerCompany: string | null
  rawSourceUrl: string | null
  firstSeenAt: string
  lastUpdatedAt: string
  changes: ProjectChange[]
  events: QueueEvent[]
}

export type Substation = {
  id: string
  hifldId: string
  name: string | null
  owner: string | null
  voltageKv: number | null
  lat: number | null
  lng: number | null
}

export type NearbySubstation = Substation & {
  distanceMiles: number | null
}

export type ProjectSnapshot = {
  id: string
  snapshotDate: string
  capturedAt: string
  currentPhase: string | null
  currentStatus: string | null
  mwRequested: number | null
  sourceUrl: string | null
  sourceName: string | null
}

export type ProjectDetailData = {
  project: GridProject
  snapshots: ProjectSnapshot[]
  nearbySubstations: NearbySubstation[]
}

export type DashboardData = {
  projects: GridProject[]
  substations: Substation[]
  recentEvents: QueueEvent[]
  latestSnapshotAt: string | null
}

export type IsoCoverage = {
  iso: string
  label: string
  firstReportDate: string | null
  latestReportDate: string | null
  reportCount: number
  source: "official_archive" | "captured_snapshots"
}

export type MonthlyProjectTrend = {
  month: string
  iso: string
  projectCount: number
}

export type MonthlyChangeTrend = {
  month: string
  iso: string
  addedCount: number
  withdrawnCount: number
  energizedCount: number
}

export type FuelMixTrend = {
  month: string
  iso: string
  fuelType: string
  projectCount: number
}

export type AnalysisHeatmapProject = {
  id: string
  iso: string
  lat: number
  lng: number
  mwRequested: number
}

export type AnalysisData = {
  generatedAt: string
  coverage: IsoCoverage[]
  heatmapProjects: AnalysisHeatmapProject[]
  projectTrends: MonthlyProjectTrend[]
  changeTrends: MonthlyChangeTrend[]
  fuelMix: FuelMixTrend[]
  recentChanges: RecentChange[]
}

export type IsoHealth = {
  iso: string
  projectCount: number
  latestSnapshotAt: string | null
  snapshotFresh: boolean
}

export type HealthBreakdown = {
  iso: string
  label: string
  count: number
}

export type SourceReportHealth = {
  id: string
  iso: string
  sourceUrl: string
  sourceName: string | null
  publishedAt: string | null
  reportDate: string | null
  status: "running" | "success" | "failed" | string
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
}

export type EventSeverityCount = {
  severity: QueueEventSeverity | string
  count: number
}

export type RecentChange = {
  id: string
  iso: string
  queueId: string
  projectName: string | null
  changedAt: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

export type HealthData = {
  generatedAt: string
  isoHealth: IsoHealth[]
  phaseCounts: HealthBreakdown[]
  fuelCounts: HealthBreakdown[]
  recentChanges: RecentChange[]
  latestSourceReports: SourceReportHealth[]
  failedSourceReports: SourceReportHealth[]
  eventSeverityCounts: EventSeverityCount[]
}

export type SubstationDetailData = {
  substation: Substation
  radiusMiles: number
  projectCount: number
  mwQueued: number
  mwEnergized: number
  fuelBreakdown: { fuelType: string; projectCount: number; mwQueued: number; mwEnergized: number }[]
  nearbyProjects: {
    id: string
    iso: string
    queueId: string
    projectName: string | null
    fuelType: string | null
    mwRequested: number | null
    currentPhase: string | null
    currentStatus: string | null
    distanceMiles: number | null
  }[]
  recentEvents: QueueEvent[]
}

export type HeadroomScore = "high" | "medium" | "low" | "saturated"

export type HeadroomFuelBreakdown = {
  fuelType: string
  projectCount: number
  mwQueued: number
  mwEnergized: number
}

export type HeadroomNearbyProject = {
  id: string
  iso: string
  queueId: string
  projectName: string | null
  fuelType: string | null
  mwRequested: number | null
  currentPhase: string | null
  currentStatus: string | null
  distanceMiles: number | null
  lat: number | null
  lng: number | null
}

export type HeadroomReport = {
  generatedAt: string
  center: { lat: number; lng: number }
  radiusMiles: number
  projectsInArea: number
  mwQueued: number
  mwEnergized: number
  mwWithdrawn: number
  medianQueueMonths: number | null
  score: HeadroomScore
  scoreRationale: string
  isoCoverage: string[]
  fuelBreakdown: HeadroomFuelBreakdown[]
  nearbySubstations: NearbySubstation[]
  nearbyProjects: HeadroomNearbyProject[]
}

export type WatchlistFilter = {
  iso: string | null
  fuelType: string | null
  phase: string | null
  mwBucket: string | null
  ownerCompany: string | null
}

export type Watchlist = {
  id: string
  name: string
  filter: WatchlistFilter
  notifyEmail: boolean
  lastEmailedAt: string | null
  createdAt: string
  updatedAt: string
}
