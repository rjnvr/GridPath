import { Hero } from "@/components/marketing/hero"
import { InterconnectFlow } from "@/components/marketing/interconnect-flow"
import { LandingCTA } from "@/components/marketing/landing-cta"
import { LiveStats } from "@/components/marketing/live-stats"
import { Manifesto } from "@/components/marketing/manifesto"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { MarketingHeader } from "@/components/marketing/marketing-header"
import { RecentActivity } from "@/components/marketing/recent-activity"
import { Workflow } from "@/components/marketing/workflow"
import { getLandingStats } from "@/lib/data"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function HomePage() {
  const stats = await getLandingStats()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main>
        <Hero latestSnapshotAt={stats.latestSnapshotAt} />
        <LiveStats
          totalProjects={stats.totalProjects}
          totalMwRequested={stats.totalMwRequested}
          changesLast7d={stats.changesLast7d}
          isoCount={stats.isoBreakdown.length}
        />
        <InterconnectFlow />
        <Manifesto />
        <RecentActivity changes={stats.recentChanges} />
        <Workflow />
        <LandingCTA />
      </main>
      <MarketingFooter />
    </div>
  )
}
