export type FuelType = "solar" | "wind" | "storage" | "gas" | string

export type ProjectChange = {
  id: string
  changedAt: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
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

export type DashboardData = {
  projects: GridProject[]
  substations: Substation[]
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
