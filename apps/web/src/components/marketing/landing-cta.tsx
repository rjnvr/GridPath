import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { AuroraText } from "@/components/magicui/aurora-text"
import { BorderBeam } from "@/components/magicui/border-beam"
import { Button } from "@/components/ui/button"

export function LandingCTA() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
        <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          Start <AuroraText>tracking the queue</AuroraText>.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          Free while we&apos;re in beta. Sign in with Google, or use your work email — no
          password to set up.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <div className="relative isolate overflow-hidden rounded-md">
            <Button asChild size="lg">
              <Link href="/signup">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <BorderBeam size={140} duration={6} />
          </div>
          <Button asChild size="lg" variant="ghost">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
