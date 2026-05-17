import { getHealthData } from "@/lib/data"

function formatRelative(value: string | null) {
  if (!value) return "no snapshots yet"
  const ms = Date.now() - new Date(value).getTime()
  const hours = Math.round(ms / 3_600_000)
  if (hours < 1) return "just now"
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export async function DataFreshnessBand() {
  let health: Awaited<ReturnType<typeof getHealthData>> | null = null
  try {
    health = await getHealthData()
  } catch {
    return null
  }

  if (!health.isoHealth.length) return null

  return (
    <section id="data" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Live data, right now</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Snapshot freshness, straight from the production database.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Generated {new Date(health.generatedAt).toLocaleString()}
          </p>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {health.isoHealth.map((iso) => (
            <div
              key={iso.iso}
              className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3"
            >
              <div>
                <dt className="text-sm font-medium">{iso.iso}</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">
                  {iso.projectCount.toLocaleString()} projects · {formatRelative(iso.latestSnapshotAt)}
                </dd>
              </div>
              <span
                className={
                  iso.snapshotFresh
                    ? "rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300"
                    : "rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-300"
                }
              >
                {iso.snapshotFresh ? "Fresh" : "Stale"}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
