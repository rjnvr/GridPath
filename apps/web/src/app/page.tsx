import { DataFreshnessBand } from "@/components/marketing/data-freshness-band"
import { FeatureGrid } from "@/components/marketing/feature-grid"
import { Hero } from "@/components/marketing/hero"
import { InterconnectFlow } from "@/components/marketing/interconnect-flow"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { MarketingHeader } from "@/components/marketing/marketing-header"

export const dynamic = "force-dynamic"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <Hero />
      <FeatureGrid />
      <InterconnectFlow />
      <DataFreshnessBand />
      <MarketingFooter />
    </div>
  )
}
