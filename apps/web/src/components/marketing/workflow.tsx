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
    <section style={{ backgroundColor: "#f5f5f7" }}>
      <div className="mx-auto max-w-[1440px] px-8 py-[80px]">
        <div>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6e6e73",
              lineHeight: 1
            }}
          >
            Under the hood
          </p>
          <h2
            className="mt-3 text-balance"
            style={{
              fontSize: "clamp(28px, 3vw, 40px)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: 0,
              color: "#1d1d1f",
              maxWidth: "480px"
            }}
          >
            Four steps. Every day. Without you running anything.
          </h2>
        </div>

        <ol className="mt-12">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="grid items-baseline gap-8 py-8 md:gap-16"
              style={{
                gridTemplateColumns: "auto 1fr",
                borderTop: i === 0 ? "none" : "1px solid #e0e0e0",
                paddingTop: i === 0 ? 0 : "32px"
              }}
            >
              <span
                className="font-mono tabular-nums"
                style={{ fontSize: "12px", color: "#6e6e73", minWidth: "24px" }}
              >
                {(i + 1).toString().padStart(2, "0")}
              </span>
              <div>
                <h3
                  style={{
                    fontSize: "21px",
                    fontWeight: 600,
                    lineHeight: 1.19,
                    letterSpacing: "0.231px",
                    color: "#1d1d1f"
                  }}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-2"
                  style={{
                    fontSize: "17px",
                    fontWeight: 400,
                    lineHeight: 1.47,
                    letterSpacing: "-0.374px",
                    color: "#6e6e73",
                    maxWidth: "560px"
                  }}
                >
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
