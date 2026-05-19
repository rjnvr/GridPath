export type FuelType = "solar" | "wind" | "storage" | "gas" | string

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

export type AnalysisData = {
  generatedAt: string
  coverage: IsoCoverage[]
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
