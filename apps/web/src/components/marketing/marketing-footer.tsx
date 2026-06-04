import Link from "next/link"

import { LogoMark } from "@/components/brand/logo-mark"
import { SUPPORTED_ISO_LABEL } from "@/lib/iso-format"

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="text-foreground">GridPath</span>
          <span className="text-xs">· data sourced from {SUPPORTED_ISO_LABEL} public reports</span>
        </div>
        <nav className="flex gap-6" aria-label="Footer">
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
          <Link href="/signup" className="hover:text-foreground">Create account</Link>
        </nav>
      </div>
    </footer>
  )
}
