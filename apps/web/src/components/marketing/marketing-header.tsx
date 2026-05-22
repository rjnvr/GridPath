import Link from "next/link"

import { LogoMark } from "@/components/brand/logo-mark"

export function MarketingHeader() {
  return (
    <header
      className="sticky top-0 z-50"
      style={{ backgroundColor: "#000000", height: "44px" }}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-8">
        {/* Brand */}
        <Link href="/" aria-label="GridPath home" className="inline-flex items-center gap-2">
          <LogoMark className="h-5 w-5" style={{ color: "#ffffff" }} />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "-0.12px",
              color: "rgba(255,255,255,0.85)"
            }}
          >
            GridPath
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          <Link
            href="/login"
            style={{
              fontSize: "12px",
              letterSpacing: "-0.12px",
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1,
              textDecoration: "none"
            }}
          >
            Sign in
          </Link>
        </nav>

        {/* Primary CTA */}
        <Link
          href="/signup"
          className="inline-flex items-center transition-transform active:scale-95"
          style={{
            backgroundColor: "#0066cc",
            color: "#ffffff",
            borderRadius: "9999px",
            padding: "8px 18px",
            fontSize: "12px",
            letterSpacing: "-0.12px",
            lineHeight: 1,
            fontWeight: 400,
            textDecoration: "none"
          }}
        >
          Get started
        </Link>
      </div>
    </header>
  )
}
