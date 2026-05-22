import Link from "next/link"

import { GridTopology } from "./grid-topology"

interface HeroProps {
  latestSnapshotAt: string | null
}

function relativeFromNow(value: string | null) {
  if (!value) return null
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function Hero({ latestSnapshotAt }: HeroProps) {
  const freshness = relativeFromNow(latestSnapshotAt)

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "#ffffff" }}
    >
      <div className="mx-auto max-w-[1440px] px-8 py-[80px]">
        <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* Left: text */}
          <div>
            {freshness ? (
              <div className="mb-6 inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ backgroundColor: "#0066cc" }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#0066cc" }}
                  />
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    letterSpacing: "-0.12px",
                    color: "#6e6e73",
                    lineHeight: 1
                  }}
                >
                  Live · updated {freshness}
                </span>
              </div>
            ) : null}

            <h1
              className="text-balance"
              style={{
                fontSize: "clamp(40px, 4vw, 56px)",
                fontWeight: 600,
                lineHeight: 1.07,
                letterSpacing: "-0.28px",
                color: "#1d1d1f",
                maxWidth: "540px"
              }}
            >
              Track every project in America&apos;s interconnection queue.
            </h1>

            <p
              className="mt-6 text-balance"
              style={{
                fontSize: "21px",
                fontWeight: 400,
                lineHeight: "1.19",
                letterSpacing: "0.231px",
                color: "#6e6e73",
                maxWidth: "440px"
              }}
            >
              Daily ingestion of ERCOT and CAISO queues — normalized, diffed,
              and ready. Stop diffing spreadsheets.
            </p>

            {/* CTA pair */}
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center transition-transform active:scale-95"
                style={{
                  backgroundColor: "#0066cc",
                  color: "#ffffff",
                  borderRadius: "9999px",
                  padding: "11px 22px",
                  fontSize: "17px",
                  fontWeight: 400,
                  letterSpacing: "-0.374px",
                  lineHeight: 1.47,
                  textDecoration: "none"
                }}
              >
                Start free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center transition-transform active:scale-95"
                style={{
                  border: "1px solid #0066cc",
                  color: "#0066cc",
                  backgroundColor: "transparent",
                  borderRadius: "9999px",
                  padding: "11px 22px",
                  fontSize: "17px",
                  fontWeight: 400,
                  letterSpacing: "-0.374px",
                  lineHeight: 1.47,
                  textDecoration: "none"
                }}
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Right: product visualization */}
          <div
            className="relative aspect-[6/5] w-full max-w-[640px] justify-self-center overflow-hidden rounded-lg lg:justify-self-end"
            style={{
              border: "1px solid #e0e0e0",
              backgroundColor: "#f5f5f7",
              boxShadow: "rgba(0, 0, 0, 0.22) 3px 5px 30px 0"
            }}
          >
            <GridTopology />
          </div>
        </div>
      </div>
    </section>
  )
}
