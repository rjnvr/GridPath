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
    <section aria-label="GridPath live stats" className="border-y border-border bg-background">
      <div className="mx-auto grid max-w-5xl grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
        <Stat label="Projects tracked" value={totalProjects} />
        <Stat label="GW in queue" value={gw} decimals={gw >= 100 ? 0 : 1} suffix=" GW" />
        <Stat label="Changes this week" value={changesLast7d} />
        <Stat label="ISOs covered" value={isoCount} />
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  decimals = 0,
  suffix
}: {
  label: string
  value: number
  decimals?: number
  suffix?: string
}) {
  return (
    <div className="px-6 py-8 md:py-10">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-0.5 text-3xl tracking-tight text-foreground md:text-4xl">
        <NumberTicker value={value} decimalPlaces={decimals} />
        {suffix ? (
          <span className="text-base font-medium text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
    </div>
  )
}
