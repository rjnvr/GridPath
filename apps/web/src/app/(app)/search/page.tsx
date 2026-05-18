import { ProjectSearch } from "@/components/project-search"
import { getDashboardData } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function SearchPage() {
  const data = await getDashboardData()

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Find projects by queue ID, owner, county, ISO, fuel, phase, status, and size.
        </p>
      </header>
      <ProjectSearch data={data} />
    </div>
  )
}
