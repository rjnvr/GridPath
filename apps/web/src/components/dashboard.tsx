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
  ExternalLink,
  Filter,
  Layers,
  ListChecks,
  Maximize2,
  Minimize2,
  Radio,
  Search,
  Zap,
  X
} from "lucide-react"
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react"
import { toast } from "sonner"

import { createWatchlistClientAction } from "@/app/(app)/watchlists/actions"
import { fuelIconFor, fuelTokenClassFor } from "@/components/icons/fuel"
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
import { NumberTicker } from "@/components/ui/number-ticker"

/* Hex values mirror the CSS HSL tokens in globals.css (`--fuel-*`).
   Kept here because MapLibre paint expressions need static color strings. */
const fuelColors: Record<string, string> = {
  solar: "#f5b942",
  wind: "#5b9bd5",
  storage: "#a78bfa",
  gas: "#e07b6d",
  hydro: "#4cb8c4",
  other: "#8b8e95"
}

const FUEL_LEGEND: Array<{ key: keyof typeof fuelColors; label: string }> = [
  { key: "solar", label: "Solar" },
  { key: "wind", label: "Wind" },
  { key: "storage", label: "Storage" },
  { key: "gas", label: "Gas" },
  { key: "hydro", label: "Hydro" }
]

type ProjectFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    id: string
    queueId: string
    projectName: string
    mwRequested: number | null
    fuelType: string
    fuelKey: string
    offsetX: number
    offsetY: number
    offset: [number, number]
    currentPhase: string
    currentStatus: string
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

type MapLabelFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    name: string
    kind: "city" | "state"
  }
>

type FilterState = {
  iso: string
  fuelType: string
  phase: string
  status: string
  mwBucket: string
  ownerCompany: string
}

type EventFilterState = {
  iso: string
  severity: string
  eventType: string
  timeWindow: string
}

type PanelMode = "projects" | "events"
type MapMode = "normal" | "fullscreen"

const MAP_DEFAULT_HEIGHT = 620
const MARKER_SPREAD_RADIUS = 18
const MAP_VIEW_BOUNDS = {
  all: [
    [-124.8, 25.2],
    [-93.2, 42.2]
  ],
  ERCOT: [
    [-107.0, 25.5],
    [-93.2, 36.8]
  ],
  CAISO: [
    [-124.8, 32.0],
    [-113.8, 42.2]
  ]
} satisfies Record<string, [[number, number], [number, number]]>

const MAP_LABELS: MapLabelFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "TEXAS", kind: "state" },
      geometry: { type: "Point", coordinates: [-99.9, 31.15] }
    },
    {
      type: "Feature",
      properties: { name: "CALIFORNIA", kind: "state" },
      geometry: { type: "Point", coordinates: [-119.7, 36.7] }
    },
    {
      type: "Feature",
      properties: { name: "Houston", kind: "city" },
      geometry: { type: "Point", coordinates: [-95.3698, 29.7604] }
    },
    {
      type: "Feature",
      properties: { name: "Dallas", kind: "city" },
      geometry: { type: "Point", coordinates: [-96.797, 32.7767] }
    },
    {
      type: "Feature",
      properties: { name: "Austin", kind: "city" },
      geometry: { type: "Point", coordinates: [-97.7431, 30.2672] }
    },
    {
      type: "Feature",
      properties: { name: "San Antonio", kind: "city" },
      geometry: { type: "Point", coordinates: [-98.4936, 29.4241] }
    },
    {
      type: "Feature",
      properties: { name: "Los Angeles", kind: "city" },
      geometry: { type: "Point", coordinates: [-118.2437, 34.0522] }
    },
    {
      type: "Feature",
      properties: { name: "San Francisco", kind: "city" },
      geometry: { type: "Point", coordinates: [-122.4194, 37.7749] }
    },
    {
      type: "Feature",
      properties: { name: "San Diego", kind: "city" },
      geometry: { type: "Point", coordinates: [-117.1611, 32.7157] }
    },
    {
      type: "Feature",
      properties: { name: "Sacramento", kind: "city" },
      geometry: { type: "Point", coordinates: [-121.4944, 38.5816] }
    }
  ]
}

type FuelGlyph = {
  rects?: Array<{ x: number; y: number; w: number; h: number; r: number }>
  circles?: Array<{ cx: number; cy: number; r: number }>
  paths: string[]
}

/* Path data mirrors the SVGs in `components/icons/fuel.tsx`, so the
   markers on the map match the legend icons exactly. */
const FUEL_GLYPHS: Record<keyof typeof fuelColors, FuelGlyph> = {
  solar: {
    circles: [{ cx: 12, cy: 12, r: 4 }],
    paths: [
      "M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
    ]
  },
  wind: {
    paths: [
      "M3 8h11a3 3 0 1 0-3-3",
      "M3 14h15a3 3 0 1 1-3 3",
      "M3 11h7"
    ]
  },
  storage: {
    rects: [{ x: 3, y: 7, w: 15, h: 10, r: 1.5 }],
    paths: ["M18 10h2v4h-2", "M7 12h2M11 10v4M14 10v4"]
  },
  gas: {
    paths: [
      "M12 3c2 3 4 5 4 8a4 4 0 1 1-8 0c0-2 1.5-3.5 2.5-5 .5-.7.8-1.3 1.5-3z",
      "M12 16a2 2 0 0 0 2-2"
    ]
  },
  hydro: {
    paths: ["M12 3c3 4 6 7 6 11a6 6 0 1 1-12 0c0-4 3-7 6-11z"]
  },
  other: {
    circles: [{ cx: 12, cy: 12, r: 9 }],
    paths: ["M12 8v4M12 16h0.01"]
  }
}

const columns: ColumnDef<GridProject>[] = [
  {
    accessorKey: "iso",
    header: "ISO",
    cell: ({ row }) => (
      <span className="inline-flex items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {row.original.iso}
      </span>
    )
  },
  {
    accessorKey: "queueId",
    header: "Queue ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.queueId}</span>
    )
  },
  {
    accessorKey: "projectName",
    header: "Project",
    cell: ({ row }) => (
      <Link
        href={`/projects/${row.original.id}`}
        onClick={(event) => event.stopPropagation()}
        className="font-medium underline-offset-4 hover:underline"
      >
        {row.original.projectName ?? "Unnamed project"}
      </Link>
    )
  },
  {
    accessorKey: "mwRequested",
    header: "MW",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {row.original.mwRequested?.toLocaleString() ?? "—"}
      </span>
    )
  },
  {
    accessorKey: "fuelType",
    header: "Fuel",
    cell: ({ row }) => {
      const fuel = (row.original.fuelType ?? "other").toLowerCase()
      const Icon = fuelIconFor(fuel)
      const tone = fuelTokenClassFor(fuel)
      return (
        <span className="inline-flex items-center gap-1.5 text-xs">
          <Icon size={14} className={tone} />
          <span className="capitalize">{row.original.fuelType ?? "—"}</span>
        </span>
      )
    }
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
  critical: "border-status-error/40 bg-status-error/10 text-status-error-foreground",
  important: "border-status-warning/40 bg-status-warning/10 text-status-warning-foreground",
  watch: "border-status-info/40 bg-status-info/10 text-status-info-foreground",
  info: "border-border bg-muted text-muted-foreground"
}

const MAP_LABEL_FONT = ["Open Sans Regular", "Arial Unicode MS Regular"]

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
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      darkMatter: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO"
      }
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#151515"
        }
      },
      {
        id: "dark-matter",
        type: "raster",
        source: "darkMatter",
        paint: {
          "raster-brightness-min": 0.08,
          "raster-brightness-max": 0.82,
          "raster-contrast": 0,
          "raster-saturation": -0.12
        }
      }
    ]
  } satisfies maplibregl.StyleSpecification
}

function normalizeFuelKey(value: string | null | undefined): keyof typeof fuelColors {
  const normalized = value?.toLowerCase() ?? ""
  if (normalized.includes("solar")) return "solar"
  if (normalized.includes("wind")) return "wind"
  if (normalized.includes("storage") || normalized.includes("battery") || normalized.includes("bess")) {
    return "storage"
  }
  if (normalized.includes("gas")) return "gas"
  if (normalized.includes("hydro")) return "hydro"
  return "other"
}

function fuelMarkerImage(fuel: keyof typeof fuelColors): ImageData {
  const canvas = document.createElement("canvas")
  const pixelRatio = 2
  const size = 30
  canvas.width = size * pixelRatio
  canvas.height = size * pixelRatio
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Could not create fuel marker canvas")
  }

  ctx.scale(pixelRatio, pixelRatio)
  ctx.clearRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const bgRadius = 13
  const color = fuelColors[fuel]

  ctx.shadowColor = "rgba(15, 23, 42, 0.32)"
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 1
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)"
  ctx.beginPath()
  ctx.arc(cx, cy, bgRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.lineWidth = 1.25
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, bgRadius, 0, Math.PI * 2)
  ctx.stroke()

  drawFuelMarkerGlyph(ctx, fuel, color, cx, cy)

  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function drawFuelMarkerGlyph(
  ctx: CanvasRenderingContext2D,
  fuel: keyof typeof fuelColors,
  color: string,
  cx: number,
  cy: number
) {
  const glyph = FUEL_GLYPHS[fuel]
  const scale = 0.85
  ctx.save()
  ctx.translate(cx - 12 * scale, cy - 12 * scale)
  ctx.scale(scale, scale)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  try {
    if (glyph.circles) {
      for (const c of glyph.circles) {
        ctx.beginPath()
        ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    if (glyph.rects) {
      for (const r of glyph.rects) {
        ctx.beginPath()
        ctx.roundRect(r.x, r.y, r.w, r.h, r.r)
        ctx.stroke()
      }
    }
    for (const pathString of glyph.paths) {
      ctx.stroke(new Path2D(pathString))
    }
  } catch {
    ctx.restore()
    drawFallbackFuelMarkerGlyph(ctx, fuel, color, cx, cy)
    return
  }

  ctx.restore()
}

function drawFallbackFuelMarkerGlyph(
  ctx: CanvasRenderingContext2D,
  fuel: keyof typeof fuelColors,
  color: string,
  cx: number,
  cy: number,
  bgRadius = 13
) {
  const labels: Record<keyof typeof fuelColors, string> = {
    solar: "S",
    wind: "W",
    storage: "B",
    gas: "G",
    hydro: "H",
    other: "+"
  }

  ctx.save()
  ctx.shadowColor = "rgba(15, 23, 42, 0.32)"
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 1
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)"
  ctx.beginPath()
  ctx.arc(cx, cy, bgRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.lineWidth = 1.25
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, bgRadius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = "700 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(labels[fuel], cx, cy + 0.5)
  ctx.restore()
}

function ensureFuelMarkerIcons(map: MapLibreMap) {
  ;(Object.keys(fuelColors) as Array<keyof typeof fuelColors>).forEach((fuel) => {
    const id = `marker-${fuel}`
    if (!map.hasImage(id)) {
      try {
        map.addImage(id, fuelMarkerImage(fuel), { pixelRatio: 2 })
      } catch {
        map.addImage(id, fallbackFuelMarkerImage(fuel), { pixelRatio: 2 })
      }
    }
  })
}

function fallbackFuelMarkerImage(fuel: keyof typeof fuelColors): ImageData {
  const canvas = document.createElement("canvas")
  const pixelRatio = 2
  const size = 30
  canvas.width = size * pixelRatio
  canvas.height = size * pixelRatio
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Could not create fallback fuel marker canvas")
  }

  ctx.scale(pixelRatio, pixelRatio)
  drawFallbackFuelMarkerGlyph(ctx, fuel, fuelColors[fuel], size / 2, size / 2)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function mapBoundsForIso(iso: string): [[number, number], [number, number]] {
  if (iso === "ERCOT" || iso === "CAISO") {
    return MAP_VIEW_BOUNDS[iso]
  }
  return MAP_VIEW_BOUNDS.all
}

function fitMapToIso(map: MapLibreMap, iso: string, duration = 600) {
  map.fitBounds(mapBoundsForIso(iso), {
    padding: { top: 36, right: 28, bottom: 28, left: 28 },
    duration,
    maxZoom: 5.5
  })
}

function projectsToGeoJson(projects: GridProject[]): ProjectFeatureCollection {
  const visibleProjects = projects.filter((project) => {
    if (project.lat === null || project.lng === null) {
      return false
    }
    return Number.isFinite(project.lat) && Number.isFinite(project.lng)
  })
  const coordinateCounts = new Map<string, number>()

  for (const project of visibleProjects) {
    const key = `${(project.lng as number).toFixed(5)},${(project.lat as number).toFixed(5)}`
    coordinateCounts.set(key, (coordinateCounts.get(key) ?? 0) + 1)
  }

  const coordinateIndexes = new Map<string, number>()

  return {
    type: "FeatureCollection",
    features: visibleProjects.map((project) => {
      const coordinateKey = `${(project.lng as number).toFixed(5)},${(project.lat as number).toFixed(5)}`
      const coordinateTotal = coordinateCounts.get(coordinateKey) ?? 1
      const coordinateIndex = coordinateIndexes.get(coordinateKey) ?? 0
      coordinateIndexes.set(coordinateKey, coordinateIndex + 1)

      const spread =
        coordinateTotal > 1
          ? {
              offsetX:
                Math.cos((Math.PI * 2 * coordinateIndex) / coordinateTotal) *
                MARKER_SPREAD_RADIUS,
              offsetY:
                Math.sin((Math.PI * 2 * coordinateIndex) / coordinateTotal) *
                MARKER_SPREAD_RADIUS
            }
          : { offsetX: 0, offsetY: 0 }

      return {
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
          fuelKey: normalizeFuelKey(project.fuelType),
          offsetX: spread.offsetX,
          offsetY: spread.offsetY,
          offset: [spread.offsetX, spread.offsetY],
          currentPhase: project.currentPhase ?? "Unknown",
          currentStatus: project.currentStatus ?? "Unknown",
          filedDate: project.filedDate
        }
      }
    })
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
  const mw = project.mwRequested !== null ? project.mwRequested.toLocaleString() : "—"
  return `
    <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
      <span style="font-family:var(--font-geist-mono),monospace;font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:hsl(var(--muted-foreground))">${project.fuelType}</span>
      <strong style="font-size:13px;line-height:1.3">${project.projectName}</strong>
      <div style="display:flex;align-items:baseline;gap:6px;font-family:var(--font-geist-mono),monospace;font-size:12px;font-variant-numeric:tabular-nums">
        <span style="color:hsl(var(--foreground));font-weight:500">${mw}</span>
        <span style="color:hsl(var(--muted-foreground))">MW · ${project.currentPhase}</span>
      </div>
      <span style="font-size:11px;color:hsl(var(--muted-foreground))">Filed ${project.filedDate ?? "—"}</span>
    </div>`
}

const VALID_MW_BUCKETS = new Set(["lt100", "100to500", "gte500"])

function filterFromSearchParams(params: URLSearchParams): FilterState {
  const iso = params.get("iso")
  const mw = params.get("mw")
  return {
    iso: iso === "ERCOT" || iso === "CAISO" ? iso : "all",
    fuelType: params.get("fuel") ?? "all",
    phase: params.get("phase") ?? "all",
    status: params.get("status") ?? "all",
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

function isActiveProject(project: GridProject): boolean {
  const statusText = [project.currentStatus, project.currentPhase].filter(Boolean).join(" ").toLowerCase()
  return !/(withdrawn|cancelled|canceled|energized|completed|retired|inactive)/.test(statusText)
}

function passesStatus(project: GridProject, status: string): boolean {
  if (status === "all") return true
  if (status === "active") return isActiveProject(project)
  return project.currentStatus === status
}

function hasActiveFilters(filters: FilterState, searchQuery: string): boolean {
  return (
    searchQuery.length > 0 ||
    filters.iso !== "all" ||
    filters.fuelType !== "all" ||
    filters.phase !== "all" ||
    filters.status !== "all" ||
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
  const [mapMode, setMapMode] = useState<MapMode>("normal")
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const [selectedProject, setSelectedProject] = useState<GridProject | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const initialMapIsoRef = useRef(filters.iso)
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
  const statuses = useMemo(
    () =>
      [
        ...new Set(
          initialData.projects
            .filter((project) => filters.iso === "all" || project.iso === filters.iso)
            .map((project) => project.currentStatus)
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
        const statusMatch = passesStatus(project, filters.status)
        const ownerMatch =
          !normalizedOwner || project.ownerCompany?.toLowerCase().includes(normalizedOwner)
        return (
          isoMatch &&
          fuelMatch &&
          phaseMatch &&
          statusMatch &&
          ownerMatch &&
          passesMwBucket(project, filters.mwBucket) &&
          projectMatchesSearch(project, normalizedSearch)
        )
      })
    },
    [filters, initialData.projects, searchQuery]
  )
  const kpis = useMemo(() => {
    const totalMw = filteredProjects.reduce((sum, project) => sum + (project.mwRequested ?? 0), 0)
    const isos = new Set(filteredProjects.map((project) => project.iso).filter(Boolean))
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const eventsLast7d = initialData.recentEvents.filter(
      (event) => new Date(event.eventAt).getTime() >= sevenDaysAgo
    ).length
    return {
      visibleProjects: filteredProjects.length,
      totalGw: totalMw / 1000,
      isos: isos.size,
      eventsLast7d
    }
  }, [filteredProjects, initialData.recentEvents])

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
      center: [-109.5, 34.4],
      zoom: 3.6
    })
    const map = mapRef.current
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    map.on("load", () => {
      fitMapToIso(map, initialMapIsoRef.current, 0)

      map.addSource("map-labels", {
        type: "geojson",
        data: MAP_LABELS
      })
      map.addLayer({
        id: "state-labels",
        type: "symbol",
        source: "map-labels",
        filter: ["==", ["get", "kind"], "state"],
        minzoom: 3,
        layout: {
          "text-field": ["get", "name"],
          "text-font": MAP_LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 12, 6, 18],
          "text-letter-spacing": 0.04,
          "text-allow-overlap": false,
          "text-ignore-placement": false
        },
        paint: {
          "text-color": "#c8d0d8",
          "text-halo-color": "rgba(8, 8, 8, 0.95)",
          "text-halo-width": 1.4,
          "text-halo-blur": 0,
          "text-opacity": 0.92
        }
      })
      map.addLayer({
        id: "city-labels",
        type: "symbol",
        source: "map-labels",
        filter: ["==", ["get", "kind"], "city"],
        minzoom: 4.4,
        layout: {
          "text-field": ["get", "name"],
          "text-font": MAP_LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 7, 15],
          "text-offset": [0, 0.65],
          "text-variable-anchor": ["top", "bottom", "left", "right"],
          "text-radial-offset": 0.35,
          "text-allow-overlap": false,
          "text-ignore-placement": false
        },
        paint: {
          "text-color": [
            "match",
            ["get", "name"],
            "Houston",
            "#4cb8c4",
            "Dallas",
            "#5b9bd5",
            "Austin",
            "#a78bfa",
            "San Antonio",
            "#e07b6d",
            "Los Angeles",
            "#f5b942",
            "San Francisco",
            "#4cb8c4",
            "San Diego",
            "#5b9bd5",
            "Sacramento",
            "#a78bfa",
            "#8fb6ff"
          ],
          "text-halo-color": "rgba(8, 8, 8, 0.95)",
          "text-halo-width": 1.3,
          "text-halo-blur": 0,
          "text-opacity": 0.96
        }
      })

      map.addSource("substations", {
        type: "geojson",
        data: substationsToGeoJson(initialData.substations)
      })
      map.addLayer({
        id: "substations",
        type: "circle",
        source: "substations",
        paint: {
          "circle-radius": 2.5,
          "circle-color": "#64748b",
          "circle-opacity": 0.55,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "#ffffff"
        }
      })

      map.addSource("projects", {
        type: "geojson",
        data: projectsToGeoJson(filteredProjectsRef.current),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 8
      })
      ensureFuelMarkerIcons(map)
      map.addLayer({
        id: "project-clusters",
        type: "circle",
        source: "projects",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "rgba(245, 185, 66, 0.88)",
            10,
            "rgba(245, 158, 11, 0.9)",
            50,
            "rgba(234, 88, 12, 0.92)",
            200,
            "rgba(220, 38, 38, 0.94)"
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            14,
            10,
            18,
            50,
            24,
            200,
            30
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(255, 255, 255, 0.92)"
        }
      })
      map.addLayer({
        id: "project-cluster-count",
        type: "symbol",
        source: "projects",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": MAP_LABEL_FONT,
          "text-size": 13,
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "rgba(255, 255, 255, 0.86)",
          "text-halo-width": 0.8,
          "text-halo-blur": 0
        }
      })
      map.addLayer({
        id: "project-points",
        type: "circle",
        source: "projects",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "fuelKey"],
            "solar",
            fuelColors.solar,
            "wind",
            fuelColors.wind,
            "storage",
            fuelColors.storage,
            "gas",
            fuelColors.gas,
            "hydro",
            fuelColors.hydro,
            fuelColors.other
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "mwRequested"], 0],
            0,
            5,
            500,
            7,
            1000,
            9
          ],
          "circle-opacity": 0.72,
          "circle-stroke-color": "rgba(255, 255, 255, 0.9)",
          "circle-stroke-width": 1
        }
      })
      map.addLayer({
        id: "projects",
        type: "symbol",
        source: "projects",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": [
            "match",
            ["get", "fuelKey"],
            "solar",
            "marker-solar",
            "wind",
            "marker-wind",
            "storage",
            "marker-storage",
            "gas",
            "marker-gas",
            "hydro",
            "marker-hydro",
            "marker-other"
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "mwRequested"], 0],
            0,
            0.55,
            500,
            0.78,
            1000,
            1
          ],
          "icon-offset": [
            "array",
            "number",
            2,
            ["get", "offset"]
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true
        },
        paint: {
          "icon-opacity": 0.96
        }
      })

      map.on("mouseenter", "project-clusters", () => {
        map.getCanvas().style.cursor = "pointer"
      })
      map.on("mouseleave", "project-clusters", () => {
        map.getCanvas().style.cursor = ""
      })
      map.on("click", "project-clusters", (event) => {
        const feature = event.features?.[0]
        const clusterId = feature?.properties?.cluster_id
        if (clusterId === undefined || clusterId === null) {
          return
        }
        const source = map.getSource("projects") as GeoJSONSource
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coordinates = (feature?.geometry as GeoJSON.Point).coordinates as [number, number]
          map.easeTo({
            center: coordinates,
            zoom: Math.min(zoom + 0.25, 12)
          })
        })
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
    fitMapToIso(map, filters.iso)
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
  }, [mapMode])

  useEffect(() => {
    if (mapMode !== "fullscreen") {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMapMode("normal")
      }
    }
    window.addEventListener("keydown", handleKeydown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [mapMode])

  function handleProjectRowKeyDown(
    event: React.KeyboardEvent<HTMLTableRowElement>,
    project: GridProject
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setSelectedProject(project)
    }
  }

  function clearFilters() {
    setSearchQuery("")
    setFilters({
      iso: "all",
      fuelType: "all",
      phase: "all",
      status: "all",
      mwBucket: "all",
      ownerCompany: ""
    })
    setEventFilters({ iso: "all", severity: "all", eventType: "all", timeWindow: "30d" })
  }

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <section className="flex flex-col">
        <KpiStrip
          visibleProjects={kpis.visibleProjects}
          totalGw={kpis.totalGw}
          isos={kpis.isos}
          eventsLast7d={kpis.eventsLast7d}
          freshnessLabel={freshnessText(initialData.latestSnapshotAt)}
        />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: "easeOut", delay: 0.1 }}
          className="flex justify-center px-6 py-6"
          aria-label="Project map"
        >
          <div
            className={
              mapMode === "fullscreen"
                ? "fixed inset-6 z-30 overflow-hidden rounded-md border border-border bg-card shadow-2xl"
                : "relative w-full overflow-hidden rounded-md border border-border bg-card shadow-md"
            }
            style={mapMode === "fullscreen" ? undefined : { height: MAP_DEFAULT_HEIGHT }}
          >
            <div className="flex h-11 items-center justify-between gap-3 border-b border-border bg-card/95 px-3 backdrop-blur">
              <div className="flex min-w-0 items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="truncate font-mono text-xs tabular-nums text-muted-foreground">
                  <NumberTicker value={kpis.visibleProjects} className="text-foreground" /> projects visible
                </span>
              </div>
              <Button
                type="button"
                variant={mapMode === "fullscreen" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMapMode(mapMode === "fullscreen" ? "normal" : "fullscreen")}
                aria-label={mapMode === "fullscreen" ? "Exit fullscreen map" : "Fullscreen map"}
                title={mapMode === "fullscreen" ? "Exit fullscreen map" : "Fullscreen map"}
              >
                {mapMode === "fullscreen" ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="relative h-[calc(100%-2.75rem)]">
              <div ref={mapContainerRef} className="absolute inset-0" />
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
                className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2"
              >
                <FuelLegend />
              </motion.div>
              {initialData.projects.length === 0 ? (
                <div className="absolute left-6 bottom-6 rounded-md border border-border bg-card/90 px-4 py-3 text-sm text-muted-foreground shadow-md backdrop-blur">
                  Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">DATABASE_URL</code>, run migrations, and ingest ERCOT data to populate the map.
                </div>
              ) : null}
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
          className="flex flex-col overflow-hidden bg-card"
        >
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <select
                  value={filters.iso}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      iso: event.target.value,
                      fuelType: "all",
                      phase: "all",
                      status: "all",
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
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, status: event.target.value }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active projects</option>
                  {statuses.map((status) => (
                    <option key={status} value={status ?? ""}>
                      {status}
                    </option>
                  ))}
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
              <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
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
                    className="cursor-pointer border-b border-border/70 hover:bg-muted/40"
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
        </motion.div>
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
  function handleEventRowKeyDown(
    keyboardEvent: React.KeyboardEvent<HTMLTableRowElement>,
    queueEvent: QueueEvent
  ) {
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault()
      onSelectProject(projectsById.get(queueEvent.projectId) ?? null)
    }
  }

  function selectEventProject(event: QueueEvent) {
    onSelectProject(projectsById.get(event.projectId) ?? null)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
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
                className="cursor-pointer border-b border-border/70 hover:bg-muted/40"
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
                  <Link
                    href={`/projects/${event.projectId}`}
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {event.projectName ?? "Unnamed project"}
                  </Link>
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
  const FuelIcon = fuelIconFor(project.fuelType)
  const fuelTone = fuelTokenClassFor(project.fuelType)

  return (
    <motion.aside
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed right-0 top-0 z-20 h-screen w-[460px] border-l border-border bg-card shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {project.iso}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{project.queueId}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {project.projectName ?? "Unnamed project"}
          </h2>
          <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FuelIcon size={14} className={fuelTone} />
              <span className="capitalize">{project.fuelType ?? "—"}</span>
            </span>
            <span>·</span>
            <span className="font-mono tabular-nums text-foreground">
              {project.mwRequested?.toLocaleString() ?? "—"}
            </span>
            <span>MW</span>
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            Open full detail
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
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
    </motion.aside>
  )
}

function KpiStrip({
  visibleProjects,
  totalGw,
  isos,
  eventsLast7d,
  freshnessLabel
}: {
  visibleProjects: number
  totalGw: number
  isos: number
  eventsLast7d: number
  freshnessLabel: string
}) {
  const items: Array<{
    label: string
    value: number
    decimals?: number
    suffix?: string
    icon: typeof Activity
  }> = [
    { label: "Projects in view", value: visibleProjects, icon: Layers },
    { label: "Capacity requested", value: totalGw, decimals: 1, suffix: "GW", icon: Zap },
    { label: "ISOs covered", value: isos, icon: Radio },
    { label: "Events · last 7d", value: eventsLast7d, icon: Activity }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4"
    >
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 * index, ease: "easeOut" }}
            className="flex items-center justify-between gap-3 bg-card px-5 py-3.5"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 flex items-baseline gap-1.5 text-2xl font-semibold tracking-tight">
                <NumberTicker
                  value={item.value}
                  decimalPlaces={item.decimals ?? 0}
                  className="text-foreground"
                />
                {item.suffix ? (
                  <span className="text-sm font-medium text-muted-foreground">{item.suffix}</span>
                ) : null}
              </p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
          </motion.div>
        )
      })}
      <div className="col-span-2 flex items-center justify-end gap-2 bg-card px-5 py-2 text-[11px] uppercase tracking-wider text-muted-foreground lg:col-span-4 lg:py-1.5">
        <Database className="h-3 w-3" />
        <span>{freshnessLabel}</span>
      </div>
    </motion.div>
  )
}

function FuelLegend() {
  return (
    <div className="pointer-events-auto inline-flex flex-col gap-1 rounded-md border border-border bg-card/90 p-2 shadow-md backdrop-blur">
      {FUEL_LEGEND.map(({ key, label }) => {
        const Icon = fuelIconFor(key)
        return (
          <div key={key} className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <Icon size={12} className={fuelTokenClassFor(key)} />
            <span>{label}</span>
          </div>
        )
      })}
    </div>
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
            Pin the current filters so you can come back to them and get emailed when matching
            projects move.
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
          <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm">
            <input
              type="checkbox"
              name="notifyEmail"
              className="mt-0.5 h-4 w-4 rounded border-border bg-background"
            />
            <span>
              <span className="block font-medium text-foreground">Notify me by email</span>
              <span className="mt-1 block text-muted-foreground">
                Send a digest when critical, important, or new-project events match this view.
              </span>
            </span>
          </label>
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
