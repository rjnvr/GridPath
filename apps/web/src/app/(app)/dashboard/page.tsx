import { Dashboard } from "@/components/dashboard"
import { getDashboardData } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const data = await getDashboardData()
  return <Dashboard initialData={data} />
}
