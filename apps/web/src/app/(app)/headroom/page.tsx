import { HeadroomExplorer } from "@/components/headroom/headroom-explorer"
import { getHeadroomHeatmapProjects, getHeadroomReport } from "@/lib/data"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<{ lat?: string; lng?: string; radius?: string }>
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default async function HeadroomPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const lat = parseNumber(params.lat)
  const lng = parseNumber(params.lng)
  const radius = parseNumber(params.radius) ?? 25

  const [report, heatmapProjects] = await Promise.all([
    lat !== null && lng !== null ? getHeadroomReport(lat, lng, radius) : null,
    getHeadroomHeatmapProjects()
  ])

  return (
    <HeadroomExplorer
      initialReport={report}
      initialRadius={radius}
      heatmapProjects={heatmapProjects}
    />
  )
}
