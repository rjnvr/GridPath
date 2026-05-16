"use client"

import type { DashboardData, GridProject } from "@gridpath/shared"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table"
import { Activity, Database, Filter, MapPin, X } from "lucide-react"
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl"
import { useEffect, useMemo, useRef, useState } from "react"

const fuelColors: Record<string, string> = {
  solar: "#facc15",
  wind: "#60a5fa",
  storage: "#c084fc",
  gas: "#fb7185"
}

type FilterState = {
  fuelType: string
  phase: string
  mwBucket: string
}

const columns: ColumnDef<GridProject>[] = [
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
    accessorKey: "filedDate",
    header: "Filed"
  }
]

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

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [filters, setFilters] = useState<FilterState>({
    fuelType: "all",
    phase: "all",
    mwBucket: "all"
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedProject, setSelectedProject] = useState<GridProject | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const fuelTypes = useMemo(
    () => [...new Set(initialData.projects.map((project) => project.fuelType).filter(Boolean))].sort(),
    [initialData.projects]
  )
  const phases = useMemo(
    () =>
      [...new Set(initialData.projects.map((project) => project.currentPhase).filter(Boolean))].sort(),
    [initialData.projects]
  )

  const filteredProjects = useMemo(
    () =>
      initialData.projects.filter((project) => {
        const fuelMatch = filters.fuelType === "all" || project.fuelType === filters.fuelType
        const phaseMatch = filters.phase === "all" || project.currentPhase === filters.phase
        return fuelMatch && phaseMatch && passesMwBucket(project, filters.mwBucket)
      }),
    [filters, initialData.projects]
  )

  const table = useReactTable({
    data: filteredProjects,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

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
    mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    for (const marker of markersRef.current) {
      marker.remove()
    }
    markersRef.current = []

    for (const substation of initialData.substations) {
      if (substation.lat === null || substation.lng === null) {
        continue
      }
      const node = document.createElement("button")
      node.type = "button"
      node.title = substation.name ?? "Substation"
      node.className = "h-2 w-2 rounded-full border border-white/80 bg-white/80 shadow"
      markersRef.current.push(new maplibregl.Marker({ element: node }).setLngLat([substation.lng, substation.lat]).addTo(map))
    }

    for (const project of filteredProjects) {
      if (project.lat === null || project.lng === null) {
        continue
      }
      const node = document.createElement("button")
      node.type = "button"
      node.className = "h-3.5 w-3.5 rounded-full border-2 border-slate-950 shadow-lg"
      node.style.background = fuelColors[project.fuelType ?? ""] ?? "#2dd4bf"
      node.addEventListener("click", () => setSelectedProject(project))
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<strong>${project.projectName ?? project.queueId}</strong><br/>${project.mwRequested ?? "—"} MW · ${project.currentPhase ?? "Unknown"}<br/>Filed ${project.filedDate ?? "—"}`
      )
      markersRef.current.push(
        new maplibregl.Marker({ element: node }).setLngLat([project.lng, project.lat]).setPopup(popup).addTo(map)
      )
    }
  }, [filteredProjects, initialData.substations])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">GridPath</h1>
            <p className="text-sm text-muted">ERCOT interconnection queue intelligence</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="inline-flex items-center gap-2 rounded border border-border px-3 py-2">
              <Database size={16} />
              {freshnessText(initialData.latestSnapshotAt)}
            </span>
            <span className="inline-flex items-center gap-2 rounded border border-border px-3 py-2">
              <Activity size={16} />
              {filteredProjects.length.toLocaleString()} visible projects
            </span>
          </div>
        </div>
      </header>

      <section className="grid h-[calc(100vh-73px)] grid-rows-[minmax(360px,55%)_1fr]">
        <div className="relative border-b border-border">
          <div ref={mapContainerRef} className="absolute inset-0" />
          {initialData.projects.length === 0 ? (
            <div className="absolute left-6 top-6 rounded border border-border bg-panel px-4 py-3 text-sm text-muted">
              Set `DATABASE_URL`, run migrations, and ingest ERCOT data to populate the map.
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden bg-panel">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Filter size={16} className="text-muted" />
            <select
              value={filters.fuelType}
              onChange={(event) => setFilters((current) => ({ ...current, fuelType: event.target.value }))}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
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
              onChange={(event) => setFilters((current) => ({ ...current, mwBucket: event.target.value }))}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All MW</option>
              <option value="lt100">&lt; 100 MW</option>
              <option value="100to500">100-499 MW</option>
              <option value="gte500">500+ MW</option>
            </select>
            <select
              value={filters.phase}
              onChange={(event) => setFilters((current) => ({ ...current, phase: event.target.value }))}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All phases</option>
              {phases.map((phase) => (
                <option key={phase} value={phase ?? ""}>
                  {phase}
                </option>
              ))}
            </select>
          </div>

          <div className="h-full overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-panel text-xs uppercase text-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="border-b border-border px-4 py-3">
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="text-left"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
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
                    className="cursor-pointer border-b border-border/70 hover:bg-white/5"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedProject ? (
        <ProjectDrawer project={selectedProject} onClose={() => setSelectedProject(null)} />
      ) : null}
    </main>
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
    <aside className="fixed right-0 top-0 z-20 h-screen w-[420px] border-l border-border bg-panel shadow-2xl">
      <div className="flex items-start justify-between border-b border-border p-5">
        <div>
          <p className="font-mono text-xs text-muted">{project.queueId}</p>
          <h2 className="mt-1 text-xl font-semibold">{project.projectName ?? "Unnamed project"}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-border p-2" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-6 overflow-y-auto p-5">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
            <MapPin size={16} />
            Project fields
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded border border-border bg-background p-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted">Change history</h3>
          {project.changes.length === 0 ? (
            <p className="rounded border border-border bg-background p-3 text-sm text-muted">
              No tracked changes yet.
            </p>
          ) : (
            <div className="space-y-2">
              {project.changes.map((change) => (
                <div key={change.id} className="rounded border border-border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{change.fieldName}</span>
                    <span className="font-mono text-xs text-muted">{new Date(change.changedAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-muted">
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
