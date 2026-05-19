"use client"

import { useMemo, useState } from "react"
import type {
  AnalysisData,
  FuelMixTrend,
  MonthlyChangeTrend,
  MonthlyProjectTrend,
  RecentChange
} from "@gridpath/shared"

import { MetricBar } from "@/components/analysis/metric-bar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const DEFAULT_ISOS = ["ERCOT", "CAISO"]

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not captured yet"
}

function maxValue(values: number[]) {
  return Math.max(1, ...values)
}

export function AnalysisDashboard({ data }: { data: AnalysisData }) {
  const availableIsos = useMemo(
    () =>
      Array.from(
        new Set([
          ...data.coverage.map((row) => row.iso),
          ...data.projectTrends.map((row) => row.iso),
          ...data.changeTrends.map((row) => row.iso),
          ...data.fuelMix.map((row) => row.iso),
          ...data.recentChanges.map((row) => row.iso)
        ])
      ).sort(),
    [data]
  )
  const [selectedIsos, setSelectedIsos] = useState(() =>
    DEFAULT_ISOS.filter((iso) => availableIsos.includes(iso)).slice(0, 2)
  )
  const selectedIsoSet = useMemo(() => new Set(selectedIsos), [selectedIsos])
  const filteredData = useMemo(
    () => ({
      coverage: data.coverage.filter((row) => selectedIsoSet.has(row.iso)),
      projectTrends: data.projectTrends.filter((row) => selectedIsoSet.has(row.iso)),
      changeTrends: data.changeTrends.filter((row) => selectedIsoSet.has(row.iso)),
      fuelMix: data.fuelMix.filter((row) => selectedIsoSet.has(row.iso)),
      recentChanges: data.recentChanges.filter((row) => selectedIsoSet.has(row.iso))
    }),
    [data, selectedIsoSet]
  )

  function toggleIso(iso: string) {
    setSelectedIsos((current) => {
      if (current.includes(iso)) {
        return current.filter((value) => value !== iso)
      }
      if (current.length >= 2) {
        return [current[1], iso]
      }
      return [...current, iso]
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trends, changes, and data coverage for selected interconnection queues.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card p-1">
          {availableIsos.map((iso) => (
            <Button
              key={iso}
              type="button"
              variant={selectedIsos.includes(iso) ? "secondary" : "ghost"}
              size="sm"
              onClick={() => toggleIso(iso)}
              aria-pressed={selectedIsos.includes(iso)}
            >
              {iso}
            </Button>
          ))}
        </div>
      </header>

      {selectedIsos.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          Choose up to two ISOs to populate the analysis views.
        </p>
      ) : (
        <>
          <CoverageCards data={data} selectedIsos={selectedIsos} />

          <section className="grid gap-4 xl:grid-cols-2">
            <ProjectTrendCard rows={filteredData.projectTrends} />
            <ChangeTrendCard rows={filteredData.changeTrends} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <FuelMixCard rows={filteredData.fuelMix} />
            <RecentChangesCard rows={filteredData.recentChanges} />
          </section>
        </>
      )}
    </div>
  )
}

function CoverageCards({ data, selectedIsos }: { data: AnalysisData; selectedIsos: string[] }) {
  const coverageByIso = new Map(data.coverage.map((coverage) => [coverage.iso, coverage]))
  const cards = selectedIsos.map((iso) => coverageByIso.get(iso) ?? {
    iso,
    label: iso === "ERCOT"
      ? "12+ months official ERCOT GIS reports"
      : "Official CAISO snapshots from first capture date",
    firstReportDate: null,
    latestReportDate: null,
    reportCount: 0,
    source: iso === "ERCOT" ? "official_archive" : "captured_snapshots"
  })

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {cards.map((coverage) => (
        <Card key={coverage.iso} className="rounded-md">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{coverage.iso}</CardTitle>
                <CardDescription>{coverage.label}</CardDescription>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[11px] tabular-nums text-primary">
                {coverage.reportCount.toLocaleString()} reports
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">First report</p>
              <p className="mt-1 font-mono">{formatDate(coverage.firstReportDate)}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Latest report</p>
              <p className="mt-1 font-mono">{formatDate(coverage.latestReportDate)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

function ProjectTrendCard({ rows }: { rows: MonthlyProjectTrend[] }) {
  const max = maxValue(rows.map((row) => row.projectCount))
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>12-month project count trend</CardTitle>
        <CardDescription>Distinct projects observed in each monthly snapshot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? <EmptyState /> : rows.map((row) => (
          <MetricBar
            key={`${row.iso}-${row.month}`}
            label={`${row.month} · ${row.iso}`}
            value={row.projectCount}
            max={max}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function ChangeTrendCard({ rows }: { rows: MonthlyChangeTrend[] }) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Monthly queue movement</CardTitle>
        <CardDescription>Added, withdrawn, and energized/completed projects inferred from snapshots.</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="border-b border-border px-3 py-2">Month</th>
              <th className="border-b border-border px-3 py-2">ISO</th>
              <th className="border-b border-border px-3 py-2">Added</th>
              <th className="border-b border-border px-3 py-2">Withdrawn</th>
              <th className="border-b border-border px-3 py-2">Energized</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-muted-foreground">No monthly movement yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={`${row.iso}-${row.month}`} className="border-b border-border/70">
                <td className="px-3 py-2 font-mono text-xs">{row.month}</td>
                <td className="px-3 py-2">{row.iso}</td>
                <td className="px-3 py-2">{row.addedCount.toLocaleString()}</td>
                <td className="px-3 py-2">{row.withdrawnCount.toLocaleString()}</td>
                <td className="px-3 py-2">{row.energizedCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function FuelMixCard({ rows }: { rows: FuelMixTrend[] }) {
  const recent = rows.slice(-18)
  const max = maxValue(recent.map((row) => row.projectCount))
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Fuel mix over time</CardTitle>
        <CardDescription>Latest monthly fuel/technology distribution by ISO.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.length === 0 ? <EmptyState /> : recent.map((row) => (
          <MetricBar
            key={`${row.iso}-${row.month}-${row.fuelType}`}
            label={`${row.month} · ${row.iso} · ${row.fuelType}`}
            value={row.projectCount}
            max={max}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function RecentChangesCard({ rows }: { rows: RecentChange[] }) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Recent high-impact changes</CardTitle>
        <CardDescription>Latest tracked queue field changes.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="border-b border-border px-3 py-2">Time</th>
                <th className="border-b border-border px-3 py-2">Project</th>
                <th className="border-b border-border px-3 py-2">Field</th>
                <th className="border-b border-border px-3 py-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-muted-foreground">No changes recorded yet.</td></tr>
              ) : rows.map((change) => (
                <tr key={change.id} className="border-b border-border/70">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {new Date(change.changedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground">{change.iso} · {change.queueId}</span>
                    <br />
                    {change.projectName ?? "Unnamed project"}
                  </td>
                  <td className="px-3 py-2">{change.fieldName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{change.oldValue ?? "—"} → {change.newValue ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No historical snapshots yet.</p>
}
