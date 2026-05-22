const STEPS = [
  {
    title: "Ingest",
    body:
      "Daily pulls of the ERCOT GIS workbook and CAISO public queue report — no scrapers, no copy-paste."
  },
  {
    title: "Normalize",
    body:
      "ISO-specific column names collapse into one schema, with the original raw report URL retained for audit."
  },
  {
    title: "Diff",
    body:
      "Every field on every project is compared against yesterday. Phase advances, MW revisions, withdrawals — all timestamped."
  },
  {
    title: "Surface",
    body:
      "A map, a filterable table, and a change feed. Built for analysts who want answers, not a BI tool."
  }
]

export function Workflow() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Under the hood</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Four steps. Every day. Without you running anything.
          </h2>
        </div>
        <ol className="mt-12 space-y-0">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[auto_1fr] items-baseline gap-8 border-t border-border py-8 first:border-t-0 first:pt-0 md:gap-16"
            >
              <span className="font-mono text-xs tabular-nums text-muted-foreground md:text-sm">
                {(i + 1).toString().padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-xl font-medium tracking-tight md:text-2xl">{step.title}</h3>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
