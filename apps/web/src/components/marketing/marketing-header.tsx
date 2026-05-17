import Link from "next/link"

import { Button } from "@/components/ui/button"

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">GridPath</span>
        </Link>
        <nav className="hidden gap-6 text-sm text-muted-foreground md:flex" aria-label="Marketing">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#data" className="hover:text-foreground">Data</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
