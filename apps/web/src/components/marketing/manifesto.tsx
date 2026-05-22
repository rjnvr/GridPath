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
    <section style={{ backgroundColor: "#272729" }}>
      <div
        className="mx-auto grid max-w-[1440px] gap-16 px-8 py-[80px] md:grid-cols-5 md:gap-12"
      >
        {/* Main copy */}
        <div className="md:col-span-3">
          <p
            style={{
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#cccccc",
              lineHeight: 1
            }}
          >
            The problem
          </p>
          <h2
            className="mt-4 text-balance"
            style={{
              fontSize: "clamp(28px, 3vw, 40px)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: 0,
              color: "#ffffff"
            }}
          >
            The interconnection queue is the longest line in American energy.
          </h2>
          <div
            className="mt-6 space-y-5"
            style={{
              fontSize: "17px",
              fontWeight: 400,
              lineHeight: 1.47,
              letterSpacing: "-0.374px",
              color: "#cccccc"
            }}
          >
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

        {/* Lifecycle sidebar */}
        <aside className="md:col-span-2">
          <p
            style={{
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#cccccc",
              lineHeight: 1
            }}
          >
            Queue lifecycle
          </p>
          <ol className="mt-6 space-y-0">
            {STAGES.map((stage, i) => (
              <li key={stage.label} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className="z-10 flex h-6 w-6 items-center justify-center rounded-full font-mono"
                    style={{
                      fontSize: "10px",
                      border: "1px solid rgba(41,151,255,0.4)",
                      color: "#2997ff",
                      backgroundColor: "rgba(41,151,255,0.08)",
                      flexShrink: 0
                    }}
                  >
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  {i < STAGES.length - 1 ? (
                    <span
                      aria-hidden
                      className="mt-1 flex-1 w-px"
                      style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                    />
                  ) : null}
                </div>
                <div className="pb-1">
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      letterSpacing: "-0.224px",
                      color: "#ffffff",
                      lineHeight: 1.29
                    }}
                  >
                    {stage.label}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#cccccc",
                      letterSpacing: "-0.12px",
                      lineHeight: 1.43,
                      marginTop: "2px"
                    }}
                  >
                    {stage.note}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  )
}
