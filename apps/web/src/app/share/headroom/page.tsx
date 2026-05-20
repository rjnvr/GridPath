import { Database } from "lucide-react"
import Link from "next/link"

import { HeadroomExplorer } from "@/components/headroom/headroom-explorer"
import { getHeadroomHeatmapProjects, getHeadroomReport } from "@/lib/data"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Headroom report — GridPath",
  description: "Interconnect headroom analysis shared from GridPath."
}

type PageProps = {
  searchParams?: Promise<{ lat?: string; lng?: string; radius?: string }>
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default async function PublicHeadroomSharePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const lat = parseNumber(params.lat)
  const lng = parseNumber(params.lng)
  const radius = parseNumber(params.radius) ?? 25

  const [report, heatmapProjects] = await Promise.all([
    lat !== null && lng !== null ? getHeadroomReport(lat, lng, radius) : null,
    getHeadroomHeatmapProjects()
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Database className="h-4 w-4 text-primary" />
          GridPath
        </Link>
        <div className="text-xs text-muted-foreground">
          Shared headroom report ·{" "}
          <Link href="/" className="underline-offset-2 hover:underline">
            Open GridPath
          </Link>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {report ? (
          <HeadroomExplorer
            initialReport={report}
            initialRadius={radius}
            heatmapProjects={heatmapProjects}
            readOnly
          />
        ) : (
          <div className="mx-auto max-w-md p-8 text-sm text-muted-foreground">
            This share link is missing a valid location. Ask the sender to regenerate the
            link from the Headroom page.
          </div>
        )}
      </main>
    </div>
  )
}
