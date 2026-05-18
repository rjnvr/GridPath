"use client"

import type {
  DashboardData,
  GridProject,
  QueueEvent,
  QueueEventSeverity,
  Substation
} from "@gridpath/shared"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable
} from "@tanstack/react-table"
import {
  Activity,
  ArrowUpDown,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Filter,
  ListChecks,
  Maximize2,
  Minimize2,
  Search,
  X
} from "lucide-react"
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl"
import { useSearchParams } from "next/navigation"
import { type KeyboardEvent, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { createWatchlistClientAction } from "@/app/(app)/watchlists/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const fuelColors: Record<string, string> = {
  solar: "#facc15",
  wind: "#60a5fa",
  storage: "#c084fc",
  gas: "#fb7185"
}

type ProjectFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    id: string
    queueId: string
    projectName: string
    mwRequested: number | null
    fuelType: string
    currentPhase: string
    filedDate: string | null
  }
>

type SubstationFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    id: string
    name: string
  }
>

type FilterState = {
  iso: string
  fuelType: string
  phase: string
  mwBucket: string
  ownerCompany: string
}

type EventFilterState = {
  iso: string
  severity: string
  eventType: string
  timeWindow: string
}

type MapSize = "compact" | "balanced" | "expanded"
type PanelMode = "projects" | "events"

const columns: ColumnDef<GridProject>[] = [
  {
    accessorKey: "iso",
    header: "ISO"
  },
  {
    accessorKey: "queueId",
    header: "Queue ID"
  },
  {
    accessorKey: "projectName",
    header: "Project"
  },
  {
    accessorKey: "mwRequested",
    header: "MW",
    cell: ({ row }) => row.original.mwRequested?.toLocaleString() ?? "—"
  },
  {
    accessorKey: "fuelType",
    header: "Fuel"
  },
  {
    accessorKey: "currentPhase",
    header: "Phase"
  },
  {
    accessorKey: "ownerCompany",
    header: "Owner",
    cell: ({ row }) => row.original.ownerCompany ?? "—"
  },
  {
    accessorKey: "filedDate",
    header: "Filed",
    cell: ({ row }) => row.original.filedDate ?? "—"
  }
]

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

const SEVERITY_STYLES: Record<QueueEventSeverity | string, string> = {
  critical: "border-red-500/50 bg-red-500/15 text-red-200",
  important: "border-amber-500/50 bg-amber-500/15 text-amber-100",
  watch: "border-sky-500/45 bg-sky-500/15 text-sky-100",
  info: "border-border bg-background text-muted-foreground"
}

function eventTypeLabel(value: string): string {
  return EVENT_TYPE_LABELS[value] ?? value.replaceAll("_", " ")
}

function severityClass(value: QueueEventSeverity | string): string {
  return SEVERITY_STYLES[value] ?? SEVERITY_STYLES.info
}

function freshnessText(latestSnapshotAt: string | null): string {
  if (!latestSnapshotAt) {
    return "No snapshots yet"
  }
  const elapsedMs = Date.now() - new Date(latestSnapshotAt).getTime()
  const hours = Math.max(0, Math.round(elapsedMs / 36_000) / 100)
  return `Last updated: ${hours.toLocaleString()} hours ago`
}

function passesMwBucket(project: GridProject, bucket: string): boolean {
  if (bucket === "all") {
    return true
  }
  const mw = project.mwRequested ?? 0
  if (bucket === "lt100") {
    return mw < 100
  }
  if (bucket === "100to500") {
    return mw >= 100 && mw < 500
  }
  return mw >= 500
}

function tileStyle() {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY
  if (key) {
    return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`
  }
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors"
      }
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }]
  } satisfies maplibregl.StyleSpecification
}

function projectsToGeoJson(projects: GridProject[]): ProjectFeatureCollection {
  return {
    type: "FeatureCollection",
    features: projects
      .filter((project) => project.lat !== null && project.lng !== null)
      .map((project) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [project.lng as number, project.lat as number]
        },
        properties: {
          id: project.id,
          queueId: project.queueId,
          projectName: project.projectName ?? project.queueId,
          mwRequested: project.mwRequested,
          fuelType: project.fuelType ?? "unknown",
          currentPhase: project.currentPhase ?? "Unknown",
          filedDate: project.filedDate
        }
      }))
  }
}

function substationsToGeoJson(substations: Substation[]): SubstationFeatureCollection {
  return {
    type: "FeatureCollection",
    features: substations
      .filter((substation) => substation.lat !== null && substation.lng !== null)
      .map((substation) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [substation.lng as number, substation.lat as number]
        },
        properties: {
          id: substation.id,
          name: substation.name ?? "Substation"
        }
      }))
  }
}

function projectPopupHtml(project: ProjectFeatureCollection["features"][number]["properties"]) {
  return `<strong>${project.projectName}</strong><br/>${project.mwRequested ?? "—"} MW · ${project.currentPhase}<br/>Filed ${project.filedDate ?? "—"}`
}

const VALID_MW_BUCKETS = new Set(["lt100", "100to500", "gte500"])

function filterFromSearchParams(params: URLSearchParams): FilterState {
  const iso = params.get("iso")
  const mw = params.get("mw")
  return {
    iso: iso === "ERCOT" || iso === "CAISO" ? iso : "all",
    fuelType: params.get("fuel") ?? "all",
    phase: params.get("phase") ?? "all",
    mwBucket: mw && VALID_MW_BUCKETS.has(mw) ? mw : "all",
    ownerCompany: params.get("owner") ?? ""
  }
}

function projectMatchesSearch(project: GridProject, query: string): boolean {
  if (!query) {
    return true
  }
  const haystack = [
    project.iso,
    project.queueId,
    project.projectName,
    project.ownerCompany,
    project.county,
    project.state,
    project.fuelType,
    project.currentPhase,
    project.currentStatus
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

function eventMatchesSearch(event: QueueEvent, query: string): boolean {
  if (!query) {
    return true
  }
  const haystack = [
    event.iso,
    event.queueId,
    event.projectName,
    event.title,
    event.description,
    event.eventType,
    event.severity,
    event.fieldName,
    event.oldValue,
    event.newValue,
    event.sourceName
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

function eventWithinWindow(event: QueueEvent, timeWindow: string): boolean {
  if (timeWindow === "all") {
    return true
  }
  const elapsed = Date.now() - new Date(event.eventAt).getTime()
  if (timeWindow === "24h") {
    return elapsed <= 24 * 60 * 60 * 1000
  }
  if (timeWindow === "7d") {
    return elapsed <= 7 * 24 * 60 * 60 * 1000
  }
  return elapsed <= 30 * 24 * 60 * 60 * 1000
}

function gridRowsForMapSize(size: MapSize): string {
  if (size === "compact") return "minmax(220px, 32%) 1fr"
  if (size === "expanded") return "minmax(460px, 72%) 1fr"
  return "minmax(340px, 54%) 1fr"
}

function hasActiveFilters(filters: FilterState, searchQuery: string): boolean {
  return (
    searchQuery.length > 0 ||
    filters.iso !== "all" ||
    filters.fuelType !== "all" ||
    filters.phase !== "all" ||
    filters.mwBucket !== "all" ||
    filters.ownerCompany.trim().length > 0
  )
}

function hasActiveEventFilters(filters: EventFilterState, searchQuery: string): boolean {
  return (
    searchQuery.length > 0 ||
    filters.iso !== "all" ||
    filters.severity !== "all" ||
    filters.eventType !== "all" ||
    filters.timeWindow !== "30d"
  )
}

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<FilterState>(() =>
    filterFromSearchParams(new URLSearchParams(searchParams?.toString() ?? ""))
  )
  const [panelMode, setPanelMode] = useState<PanelMode>("projects")
  const [eventFilters, setEventFilters] = useState<EventFilterState>({
    iso: "all",
    severity: "all",
    eventType: "all",
    timeWindow: "30d"
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [mapSize, setMapSize] = useState<MapSize>("balanced")
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const [selectedProject, setSelectedProject] = useState<GridProject | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const projectsById = useMemo(
    () => new Map(initialData.projects.map((project) => [project.id, project])),
    [initialData.projects]
  )
  const fuelTypes = useMemo(
    () =>
      [
        ...new Set(
          initialData.projects
            .filter((project) => filters.iso === "all" || project.iso === filters.iso)
            .map((project) => project.fuelType)
            .filter(Boolean)
        )
      ].sort(),
    [filters.iso, initialData.projects]
  )
  const phases = useMemo(
    () =>
      [
        ...new Set(
          initialData.projects
            .filter((project) => filters.iso === "all" || project.iso === filters.iso)
            .map((project) => project.currentPhase)
            .filter(Boolean)
        )
      ].sort(),
    [filters.iso, initialData.projects]
  )
  const ownerCompanies = useMemo(
    () =>
      [
        ...new Set(
          initialData.projects
            .filter((project) => filters.iso === "all" || project.iso === filters.iso)
            .map((project) => project.ownerCompany)
            .filter(Boolean)
        )
      ].sort(),
    [filters.iso, initialData.projects]
  )
  const eventTypes = useMemo(
    () => [...new Set(initialData.recentEvents.map((event) => event.eventType))].sort(),
    [initialData.recentEvents]
  )

  const filteredProjects = useMemo(
    () => {
      const normalizedSearch = searchQuery.trim().toLowerCase()
      const normalizedOwner = filters.ownerCompany.trim().toLowerCase()
      return initialData.projects.filter((project) => {
        const isoMatch = filters.iso === "all" || project.iso === filters.iso
        const fuelMatch = filters.fuelType === "all" || project.fuelType === filters.fuelType
        const phaseMatch = filters.phase === "all" || project.currentPhase === filters.phase
        const ownerMatch =
          !normalizedOwner || project.ownerCompany?.toLowerCase().includes(normalizedOwner)
        return (
          isoMatch &&
          fuelMatch &&
          phaseMatch &&
          ownerMatch &&
          passesMwBucket(project, filters.mwBucket) &&
          projectMatchesSearch(project, normalizedSearch)
        )
      })
    },
    [filters, initialData.projects, searchQuery]
  )
  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    return initialData.recentEvents.filter((event) => {
      const isoMatch = eventFilters.iso === "all" || event.iso === eventFilters.iso
      const severityMatch =
        eventFilters.severity === "all" || event.severity === eventFilters.severity
      const typeMatch =
        eventFilters.eventType === "all" || event.eventType === eventFilters.eventType
      return (
        isoMatch &&
        severityMatch &&
        typeMatch &&
        eventWithinWindow(event, eventFilters.timeWindow) &&
        eventMatchesSearch(event, normalizedSearch)
      )
    })
  }, [eventFilters, initialData.recentEvents, searchQuery])
  const filteredProjectsRef = useRef<GridProject[]>(filteredProjects)

  useEffect(() => {
    filteredProjectsRef.current = filteredProjects
  }, [filteredProjects])

  const table = useReactTable({
    data: filteredProjects,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [filters, eventFilters, panelMode, searchQuery])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }
    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: tileStyle(),
      center: [-99.35, 31.05],
      zoom: 5.25
    })
    const map = mapRef.current
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    map.on("load", () => {
      map.addSource("substations", {
        type: "geojson",
        data: substationsToGeoJson(initialData.substations)
      })
      map.addLayer({
        id: "substations",
        type: "circle",
        source: "substations",
        paint: {
          "circle-radius": 3,
          "circle-color": "#ffffff",
          "circle-opacity": 0.75,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0f172a"
        }
      })

      map.addSource("projects", {
        type: "geojson",
        data: projectsToGeoJson(filteredProjectsRef.current)
      })
      map.addLayer({
        id: "projects",
        type: "circle",
        source: "projects",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "mwRequested"], 0],
            0,
            4,
            500,
            7,
            1000,
            10
          ],
          "circle-color": [
            "match",
            ["get", "fuelType"],
            "solar",
            fuelColors.solar,
            "wind",
            fuelColors.wind,
            "storage",
            fuelColors.storage,
            "gas",
            fuelColors.gas,
            "#2dd4bf"
          ],
          "circle-opacity": 0.88,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#020617"
        }
      })

      map.on("mouseenter", "projects", (event) => {
        map.getCanvas().style.cursor = "pointer"
        const feature = event.features?.[0] as ProjectFeatureCollection["features"][number] | undefined
        const coordinates = feature?.geometry.coordinates
        if (!feature || !coordinates) {
          return
        }
        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({ offset: 12, closeButton: false })
          .setLngLat(coordinates as [number, number])
          .setHTML(projectPopupHtml(feature.properties))
          .addTo(map)
      })

      map.on("mouseleave", "projects", () => {
        map.getCanvas().style.cursor = ""
        popupRef.current?.remove()
        popupRef.current = null
      })

      map.on("click", "projects", (event) => {
        const feature = event.features?.[0] as ProjectFeatureCollection["features"][number] | undefined
        const projectId = feature?.properties.id
        if (projectId) {
          setSelectedProject(projectsById.get(projectId) ?? null)
        }
      })
    })

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [initialData.substations, projectsById])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    if (filters.iso === "ERCOT") {
      map.easeTo({ center: [-99.35, 31.05], zoom: 5.25, duration: 600 })
    } else if (filters.iso === "CAISO") {
      map.easeTo({ center: [-119.5, 36.8], zoom: 5.2, duration: 600 })
    } else {
      map.easeTo({ center: [-109.5, 34.4], zoom: 4.1, duration: 600 })
    }
  }, [filters.iso])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !map.getSource("projects")) {
      return
    }
    ;(map.getSource("projects") as GeoJSONSource).setData(projectsToGeoJson(filteredProjects))
  }, [filteredProjects])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    const resize = window.setTimeout(() => map.resize(), 220)
    return () => window.clearTimeout(resize)
  }, [mapSize])

  function clearFilters() {
    setSearchQuery("")
    setFilters({ iso: "all", fuelType: "all", phase: "all", mwBucket: "all", ownerCompany: "" })
    setEventFilters({ iso: "all", severity: "all", eventType: "all", timeWindow: "30d" })
  }

  function handleProjectRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    project: GridProject
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setSelectedProject(project)
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <section
        className="grid h-[calc(100vh-3.5rem)]"
        style={{ gridTemplateRows: gridRowsForMapSize(mapSize) }}
      >
        <div className="relative border-b border-border">
          <div ref={mapContainerRef} className="absolute inset-0" />
          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
              <Database size={16} />
              {freshnessText(initialData.latestSnapshotAt)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
              <Activity size={16} />
              {filteredProjects.length.toLocaleString()} visible projects
            </span>
          </div>
          <div className="absolute right-4 top-4 flex items-center gap-1 rounded-md border border-border bg-card/95 p-1 shadow-xl backdrop-blur">
            <Button
              type="button"
              variant={mapSize === "compact" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMapSize("compact")}
              aria-label="Make map smaller"
              title="Smaller map"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={mapSize === "balanced" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMapSize("balanced")}
              aria-label="Use balanced map size"
              title="Balanced map"
            >
              <Activity className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={mapSize === "expanded" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMapSize("expanded")}
              aria-label="Expand map"
              title="Expand map"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          {initialData.projects.length === 0 ? (
            <div className="absolute left-6 top-6 rounded border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
              Set `DATABASE_URL`, run migrations, and ingest ERCOT data to populate the map.
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden bg-panel">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border border-border bg-background p-1">
                <Button
                  type="button"
                  variant={panelMode === "projects" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPanelMode("projects")}
                >
                  <Database className="h-4 w-4" />
                  Projects
                </Button>
                <Button
                  type="button"
                  variant={panelMode === "events" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPanelMode("events")}
                >
                  <ListChecks className="h-4 w-4" />
                  Events
                </Button>
              </div>
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={
                    panelMode === "events"
                      ? "Search event, project, queue ID, source"
                      : "Search project, queue ID, owner, county, status"
                  }
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter size={16} />
                <span>
                  {(panelMode === "events" ? filteredEvents.length : filteredProjects.length).toLocaleString()}{" "}
                  results
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {(panelMode === "events"
                  ? hasActiveEventFilters(eventFilters, searchQuery.trim())
                  : hasActiveFilters(filters, searchQuery.trim())) ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                ) : null}
                {panelMode === "projects" ? <SaveViewDialog filters={filters} /> : null}
              </div>
            </div>
            {panelMode === "projects" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <select
                  value={filters.iso}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      iso: event.target.value,
                      fuelType: "all",
                      phase: "all",
                      ownerCompany: ""
                    }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All ISOs</option>
                  <option value="ERCOT">ERCOT</option>
                  <option value="CAISO">CAISO</option>
                </select>
                <select
                  value={filters.fuelType}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, fuelType: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All fuels</option>
                  {fuelTypes.map((fuel) => (
                    <option key={fuel} value={fuel ?? ""}>
                      {fuel}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.mwBucket}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, mwBucket: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All MW</option>
                  <option value="lt100">&lt; 100 MW</option>
                  <option value="100to500">100-499 MW</option>
                  <option value="gte500">500+ MW</option>
                </select>
                <select
                  value={filters.phase}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, phase: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All phases</option>
                  {phases.map((phase) => (
                    <option key={phase} value={phase ?? ""}>
                      {phase}
                    </option>
                  ))}
                </select>
                <input
                  list="owner-companies"
                  value={filters.ownerCompany}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, ownerCompany: event.target.value }))
                  }
                  placeholder="Owner contains"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                />
                <datalist id="owner-companies">
                  {ownerCompanies.slice(0, 200).map((owner) => (
                    <option key={owner} value={owner ?? ""} />
                  ))}
                </datalist>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={eventFilters.iso}
                  onChange={(event) =>
                    setEventFilters((current) => ({ ...current, iso: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All ISOs</option>
                  <option value="ERCOT">ERCOT</option>
                  <option value="CAISO">CAISO</option>
                </select>
                <select
                  value={eventFilters.severity}
                  onChange={(event) =>
                    setEventFilters((current) => ({ ...current, severity: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="important">Important</option>
                  <option value="watch">Watch</option>
                  <option value="info">Info</option>
                </select>
                <select
                  value={eventFilters.eventType}
                  onChange={(event) =>
                    setEventFilters((current) => ({ ...current, eventType: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All event types</option>
                  {eventTypes.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventTypeLabel(eventType)}
                    </option>
                  ))}
                </select>
                <select
                  value={eventFilters.timeWindow}
                  onChange={(event) =>
                    setEventFilters((current) => ({ ...current, timeWindow: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All loaded events</option>
                </select>
              </div>
            )}
          </div>

          {panelMode === "projects" ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-panel text-xs uppercase text-muted-foreground">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="border-b border-border px-4 py-3">
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 text-left"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                          <span className="sr-only">
                            {header.column.getIsSorted() === "asc"
                              ? "sorted ascending"
                              : header.column.getIsSorted() === "desc"
                                ? "sorted descending"
                                : "not sorted"}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedProject(row.original)}
                    onKeyDown={(event) => handleProjectRowKeyDown(event, row.original)}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer border-b border-border/70 hover:bg-white/5"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No projects match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={table.getState().pagination.pageSize}
                onChange={(event) => table.setPageSize(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Rows per page"
              >
                {[25, 50, 100, 250].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize} rows
                  </option>
                ))}
              </select>
              <Button type="button" variant="ghost" size="sm" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
              </div>
            </>
          ) : (
            <EventTable
              events={filteredEvents}
              projectsById={projectsById}
              onSelectProject={setSelectedProject}
            />
          )}
        </div>
      </section>

      {selectedProject ? (
        <ProjectDrawer project={selectedProject} onClose={() => setSelectedProject(null)} />
      ) : null}
    </main>
  )
}

function EventTable({
  events,
  projectsById,
  onSelectProject
}: {
  events: QueueEvent[]
  projectsById: Map<string, GridProject>
  onSelectProject: (project: GridProject | null) => void
}) {
  function selectEventProject(event: QueueEvent) {
    onSelectProject(projectsById.get(event.projectId) ?? null)
  }

  function handleEventRowKeyDown(
    keyboardEvent: KeyboardEvent<HTMLTableRowElement>,
    queueEvent: QueueEvent
  ) {
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault()
      selectEventProject(queueEvent)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-panel text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b border-border px-4 py-3">Time</th>
            <th className="border-b border-border px-4 py-3">Severity</th>
            <th className="border-b border-border px-4 py-3">Event</th>
            <th className="border-b border-border px-4 py-3">Project</th>
            <th className="border-b border-border px-4 py-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No queue events match these filters.
              </td>
            </tr>
          ) : (
            events.map((event) => (
              <tr
                key={event.id}
                onClick={() => selectEventProject(event)}
                onKeyDown={(keyboardEvent) => handleEventRowKeyDown(keyboardEvent, event)}
                role="button"
                tabIndex={0}
                className="cursor-pointer border-b border-border/70 hover:bg-white/5"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                  {new Date(event.eventAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded border px-2 py-1 text-xs capitalize ${severityClass(
                      event.severity
                    )}`}
                  >
                    {event.severity}
                  </span>
                </td>
                <td className="max-w-xl px-4 py-3">
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {event.description}
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">
                    {eventTypeLabel(event.eventType)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-muted-foreground">{event.queueId}</span>
                  <br />
                  {event.projectName ?? "Unnamed project"}
                </td>
                <td className="max-w-[220px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {event.sourceName ?? event.sourceUrl ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function ProjectDrawer({ project, onClose }: { project: GridProject; onClose: () => void }) {
  const fields = [
    ["Queue ID", project.queueId],
    ["Project", project.projectName],
    ["MW requested", project.mwRequested?.toLocaleString()],
    ["Fuel", project.fuelType],
    ["County", project.county],
    ["Phase", project.currentPhase],
    ["Status", project.currentStatus],
    ["Filed", project.filedDate],
    ["IA signed", project.iaSignedDate],
    ["Energized", project.energizedDate],
    ["Withdrawn", project.withdrawnDate],
    ["Owner", project.ownerCompany]
  ]

  return (
    <aside className="fixed right-0 top-0 z-20 h-screen w-[460px] border-l border-border bg-panel shadow-2xl">
      <div className="flex items-start justify-between border-b border-border p-5">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{project.queueId}</p>
          <h2 className="mt-1 text-xl font-semibold">{project.projectName ?? "Unnamed project"}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-border p-2" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-6 overflow-y-auto p-5">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ListChecks size={16} />
            Intelligence timeline
          </h3>
          {project.events.length === 0 ? (
            <p className="rounded border border-border bg-background p-3 text-sm text-muted-foreground">
              No classified queue events yet.
            </p>
          ) : (
            <div className="space-y-2">
              {project.events.map((event) => (
                <div key={event.id} className="rounded border border-border bg-background p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-xs capitalize ${severityClass(
                          event.severity
                        )}`}
                      >
                        {event.severity}
                      </span>
                      <h4 className="mt-2 font-medium">{event.title}</h4>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {new Date(event.eventAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground">{event.description}</p>
                  {event.oldValue !== null || event.newValue !== null ? (
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {event.oldValue ?? "—"} → {event.newValue ?? "—"}
                    </p>
                  ) : null}
                  {event.sourceUrl ? (
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
                    >
                      {event.sourceName ?? "Source report"}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Database size={16} />
            Project fields
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded border border-border bg-background p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Raw field changes</h3>
          {project.changes.length === 0 ? (
            <p className="rounded border border-border bg-background p-3 text-sm text-muted-foreground">
              No tracked changes yet.
            </p>
          ) : (
            <div className="space-y-2">
              {project.changes.map((change) => (
                <div key={change.id} className="rounded border border-border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{change.fieldName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{new Date(change.changedAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {change.oldValue ?? "—"} → {change.newValue ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}

function filterSummary(filters: FilterState): string {
  const parts = [filters.iso === "all" ? "All ISOs" : filters.iso]
  if (filters.fuelType !== "all") parts.push(filters.fuelType)
  if (filters.phase !== "all") parts.push(filters.phase)
  if (filters.mwBucket === "lt100") parts.push("< 100 MW")
  else if (filters.mwBucket === "100to500") parts.push("100–499 MW")
  else if (filters.mwBucket === "gte500") parts.push("500+ MW")
  if (filters.ownerCompany.trim()) parts.push(`owner: ${filters.ownerCompany.trim()}`)
  return parts.join(" · ")
}

function SaveViewDialog({ filters }: { filters: FilterState }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    const submittedName = String(formData.get("name") ?? "").trim()
    if (!submittedName) return
    startTransition(async () => {
      try {
        const result = await createWatchlistClientAction(formData)
        if (!result.ok && result.error === "not_provisioned") {
          toast.error("Apply the watchlists migration in Neon before saving views.")
          return
        }
        toast.success(`Saved "${submittedName}" to your watchlists`)
        setName("")
        setOpen(false)
      } catch {
        toast.error("Could not save watchlist. Try again.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark className="h-4 w-4" />
          Save view
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this view</DialogTitle>
          <DialogDescription>
            Pin the current filters so you can come back to them — and (soon) get emailed when matching
            projects change.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="watchlist-name">Name</Label>
            <Input
              id="watchlist-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="West Texas solar 500MW+"
              required
              autoFocus
            />
          </div>
          <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
            {filterSummary(filters)}
          </div>
          <input type="hidden" name="iso" value={filters.iso === "all" ? "" : filters.iso} />
          <input type="hidden" name="fuelType" value={filters.fuelType === "all" ? "" : filters.fuelType} />
          <input type="hidden" name="phase" value={filters.phase === "all" ? "" : filters.phase} />
          <input type="hidden" name="mwBucket" value={filters.mwBucket === "all" ? "" : filters.mwBucket} />
          <input type="hidden" name="ownerCompany" value={filters.ownerCompany.trim()} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save watchlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
