import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard"
import { getAnalysisData } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function AnalysisPage() {
  const data = await getAnalysisData()

  return <AnalysisDashboard data={data} />
}
