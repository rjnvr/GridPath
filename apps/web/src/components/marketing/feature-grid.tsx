import { GitCompare, Map, RefreshCcw } from "lucide-react"

const FEATURES = [
  {
    icon: RefreshCcw,
    title: "Live ERCOT & CAISO ingestion",
    body: "Daily pulls of the ERCOT GIS workbook and CAISO public queue report — normalized into one schema you can filter, sort, and export."
  },
  {
    icon: GitCompare,
    title: "Field-level change tracking",
    body: "Every phase change, MW revision, and ownership update is recorded with a timestamp. Spot withdrawals and IA signings the day they happen."
  },
  {
    icon: Map,
    title: "Geospatial filtering",
    body: "A real MapLibre map (not a Tableau iframe) with the queue plotted to project coordinates. Filter by ISO, fuel, phase, or MW bucket."
  }
]

export function FeatureGrid() {
  return (
    <section id="features" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Built for the developers and analysts working the queue every day.
          </h2>
          <p className="mt-3 text-muted-foreground">
            GridPath is a thin layer over the official source data. No invented numbers, no
            scraped paywalled feeds — just the public records, normalized.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-6">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-medium">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
