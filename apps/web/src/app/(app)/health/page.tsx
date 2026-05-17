import { getHealthData } from "@/lib/data"

export const dynamic = "force-dynamic"

function formatDateTime(value: string | null) {
  if (!value) {
    return "No snapshots"
  }
  return new Date(value).toLocaleString()
}

export default async function HealthPage() {
  const health = await getHealthData()

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold">Data Health</h1>
        <p className="text-sm text-muted-foreground">Generated {formatDateTime(health.generatedAt)}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {health.isoHealth.map((iso) => (
          <div key={iso.iso} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-medium">{iso.iso}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {iso.projectCount.toLocaleString()} projects
                </p>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs ${
                  iso.snapshotFresh ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                }`}
              >
                {iso.snapshotFresh ? "Fresh" : "Stale"}
              </span>
            </div>
            <p className="mt-4 font-mono text-sm text-muted-foreground">
              Latest snapshot: {formatDateTime(iso.latestSnapshotAt)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable title="Phase Counts" rows={health.phaseCounts} />
        <BreakdownTable title="Fuel Counts" rows={health.fuelCounts} />
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-medium">Recent Changes</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="border-b border-border px-4 py-3">Time</th>
                <th className="border-b border-border px-4 py-3">ISO</th>
                <th className="border-b border-border px-4 py-3">Project</th>
                <th className="border-b border-border px-4 py-3">Field</th>
                <th className="border-b border-border px-4 py-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {health.recentChanges.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                    No changes recorded yet.
                  </td>
                </tr>
              ) : (
                health.recentChanges.map((change) => (
                  <tr key={change.id} className="border-b border-border/70">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {formatDateTime(change.changedAt)}
                    </td>
                    <td className="px-4 py-3">{change.iso}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{change.queueId}</span>
                      <br />
                      {change.projectName ?? "Unnamed project"}
                    </td>
                    <td className="px-4 py-3">{change.fieldName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {change.oldValue ?? "—"} → {change.newValue ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function BreakdownTable({
  title,
  rows
}: {
  title: string
  rows: { iso: string; label: string; count: number }[]
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-medium">{title}</h2>
      </div>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b border-border px-4 py-3">ISO</th>
            <th className="border-b border-border px-4 py-3">Label</th>
            <th className="border-b border-border px-4 py-3">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.iso}-${row.label}`} className="border-b border-border/70">
              <td className="px-4 py-3">{row.iso}</td>
              <td className="px-4 py-3">{row.label}</td>
              <td className="px-4 py-3">{row.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
