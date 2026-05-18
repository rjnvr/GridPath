const STAGES = [
  { label: "Filed", note: "Project enters the queue" },
  { label: "System Impact Study", note: "Grid impact modeled" },
  { label: "Facilities Study", note: "Upgrades scoped and costed" },
  { label: "Interconnection Agreement", note: "Terms executed" },
  { label: "Construction", note: "Steel in the ground" },
  { label: "Energized", note: "Synced to the grid" }
]

export function Manifesto() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-5xl gap-16 px-6 py-24 md:grid-cols-5 md:gap-12 md:py-32">
        <div className="md:col-span-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">The problem</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            The interconnection queue is the longest line in American energy.
          </h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              Across the U.S., more than 2,600 GW of generation and storage is waiting for a
              study slot. Each ISO publishes its queue as a spreadsheet, on its own schedule,
              with its own column names — and the only way most teams know a project moved is
              to diff yesterday&apos;s file against today&apos;s.
            </p>
            <p>
              GridPath replaces that. Every report we ingest, every field we touch, every
              status change we see — it&apos;s logged, timestamped, and queryable. No webhooks
              to write. No spreadsheets to diff. Just the source of truth, with history.
            </p>
          </div>
        </div>
        <aside className="md:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Queue lifecycle</p>
          <ol className="mt-4 space-y-0">
            {STAGES.map((stage, i) => (
              <li key={stage.label} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card font-mono text-[10px] text-muted-foreground">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  {i < STAGES.length - 1 ? (
                    <span aria-hidden className="mt-1 flex-1 w-px bg-border" />
                  ) : null}
                </div>
                <div className="pb-1">
                  <p className="text-sm font-medium text-foreground">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  )
}
