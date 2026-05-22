import { NumberTicker } from "@/components/ui/number-ticker"

interface LiveStatsProps {
  totalProjects: number
  totalMwRequested: number | null
  changesLast7d: number
  isoCount: number
}

export function LiveStats({ totalProjects, totalMwRequested, changesLast7d, isoCount }: LiveStatsProps) {
  const gw = totalMwRequested != null ? totalMwRequested / 1000 : 0
  return (
    <section
      aria-label="GridPath live stats"
      style={{
        backgroundColor: "#f5f5f7",
        borderTop: "1px solid #e0e0e0",
        borderBottom: "1px solid #e0e0e0"
      }}
    >
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 md:grid-cols-4">
        <Stat label="Projects tracked" value={totalProjects} last={false} />
        <Stat label="GW in queue" value={gw} decimals={gw >= 100 ? 0 : 1} suffix=" GW" last={false} />
        <Stat label="Changes this week" value={changesLast7d} last={false} />
        <Stat label="ISOs covered" value={isoCount} last />
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  decimals = 0,
  suffix,
  last
}: {
  label: string
  value: number
  decimals?: number
  suffix?: string
  last: boolean
}) {
  return (
    <div
      className="px-8 py-10"
      style={{
        borderRight: last ? "none" : "1px solid #e0e0e0"
      }}
    >
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
        {label}
      </p>
      <p
        className="mt-3 flex items-baseline gap-1"
        style={{
          fontSize: "40px",
          fontWeight: 600,
          letterSpacing: "-0.374px",
          lineHeight: 1.1,
          color: "#1d1d1f"
        }}
      >
        <NumberTicker value={value} decimalPlaces={decimals} />
        {suffix ? (
          <span
            style={{
              fontSize: "17px",
              fontWeight: 400,
              color: "#6e6e73"
            }}
          >
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  )
}
