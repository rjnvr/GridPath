"use client"

import type { DashboardData, GridProject } from "@gridpath/shared"
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
import { ArrowUpDown, Search, X } from "lucide-react"
import { useMemo, useState } from "react"

import { fuelIconFor, fuelTokenClassFor } from "@/components/icons/fuel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SearchFilters = {
  iso: string
  fuelType: string
  phase: string
  status: string
  mwMin: string
  mwMax: string
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
    cell: ({ row }) => row.original.projectName ?? "Unnamed project"
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
  { accessorKey: "currentPhase", header: "Phase", cell: ({ row }) => row.original.currentPhase ?? "—" },
  { accessorKey: "currentStatus", header: "Status", cell: ({ row }) => row.original.currentStatus ?? "—" },
  { accessorKey: "ownerCompany", header: "Owner", cell: ({ row }) => row.original.ownerCompany ?? "—" },
  { accessorKey: "county", header: "County", cell: ({ row }) => row.original.county ?? "—" }
]

function matchesQuery(project: GridProject, query: string): boolean {
  if (!query) return true
  return [
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
    .includes(query)
}

function numericFilter(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ProjectSearch({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({
    iso: "all",
    fuelType: "all",
    phase: "all",
    status: "all",
    mwMin: "",
    mwMax: ""
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const [selectedProject, setSelectedProject] = useState<GridProject | null>(null)

  const options = useMemo(() => {
    const scoped = data.projects.filter((project) => filters.iso === "all" || project.iso === filters.iso)
    return {
      fuels: [...new Set(scoped.map((project) => project.fuelType).filter(Boolean))].sort(),
      phases: [...new Set(scoped.map((project) => project.currentPhase).filter(Boolean))].sort(),
      statuses: [...new Set(scoped.map((project) => project.currentStatus).filter(Boolean))].sort()
    }
  }, [data.projects, filters.iso])

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const min = numericFilter(filters.mwMin)
    const max = numericFilter(filters.mwMax)
    return data.projects.filter((project) => {
      const mw = project.mwRequested
      return (
        matchesQuery(project, normalizedQuery) &&
        (filters.iso === "all" || project.iso === filters.iso) &&
        (filters.fuelType === "all" || project.fuelType === filters.fuelType) &&
        (filters.phase === "all" || project.currentPhase === filters.phase) &&
        (filters.status === "all" || project.currentStatus === filters.status) &&
        (min === null || (mw !== null && mw >= min)) &&
        (max === null || (mw !== null && mw <= max))
      )
    })
  }, [data.projects, filters, query])

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

  function clearFilters() {
    setQuery("")
    setFilters({ iso: "all", fuelType: "all", phase: "all", status: "all", mwMin: "", mwMax: "" })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPagination((current) => ({ ...current, pageIndex: 0 }))
              }}
              placeholder="Search queue ID, project, owner, county, fuel, phase, status"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <select
            value={filters.iso}
            onChange={(event) => setFilters((current) => ({ ...current, iso: event.target.value }))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All ISOs</option>
            <option value="ERCOT">ERCOT</option>
            <option value="CAISO">CAISO</option>
          </select>
          <select
            value={filters.fuelType}
            onChange={(event) => setFilters((current) => ({ ...current, fuelType: event.target.value }))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All fuels</option>
            {options.fuels.map((fuel) => (
              <option key={fuel} value={fuel ?? ""}>{fuel}</option>
            ))}
          </select>
          <select
            value={filters.phase}
            onChange={(event) => setFilters((current) => ({ ...current, phase: event.target.value }))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All phases</option>
            {options.phases.map((phase) => (
              <option key={phase} value={phase ?? ""}>{phase}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {options.statuses.map((status) => (
              <option key={status} value={status ?? ""}>{status}</option>
            ))}
          </select>
          <Input
            inputMode="numeric"
            value={filters.mwMin}
            onChange={(event) => setFilters((current) => ({ ...current, mwMin: event.target.value }))}
            placeholder="Min MW"
          />
          <Input
            inputMode="numeric"
            value={filters.mwMax}
            onChange={(event) => setFilters((current) => ({ ...current, mwMax: event.target.value }))}
            placeholder="Max MW"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-muted-foreground">
          <span>{filteredProjects.length.toLocaleString()} matching projects</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Rows per page"
          >
            {[25, 50, 100, 250].map((pageSize) => (
              <option key={pageSize} value={pageSize}>{pageSize} rows</option>
            ))}
          </select>
        </div>
        <div className="overflow-auto">
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
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                    No projects match this search.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedProject(row.original)}
                    className="cursor-pointer border-b border-border/70 hover:bg-muted/40"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProject ? (
        <ProjectDetail project={selectedProject} onClose={() => setSelectedProject(null)} />
      ) : null}
    </div>
  )
}

function ProjectDetail({ project, onClose }: { project: GridProject; onClose: () => void }) {
  return (
    <aside className="fixed right-0 top-0 z-20 h-screen w-full max-w-[460px] border-l border-border bg-card shadow-2xl">
      <div className="flex items-start justify-between border-b border-border p-5">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{project.iso} · {project.queueId}</p>
          <h2 className="mt-1 text-xl font-semibold">{project.projectName ?? "Unnamed project"}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-border p-2" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-3 overflow-y-auto p-5 text-sm">
        {[
          ["MW requested", project.mwRequested?.toLocaleString()],
          ["Fuel", project.fuelType],
          ["County", project.county],
          ["State", project.state],
          ["Phase", project.currentPhase],
          ["Status", project.currentStatus],
          ["Filed", project.filedDate],
          ["IA signed", project.iaSignedDate],
          ["Energized", project.energizedDate],
          ["Withdrawn", project.withdrawnDate],
          ["Owner", project.ownerCompany],
          ["Source", project.rawSourceUrl]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-background p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
