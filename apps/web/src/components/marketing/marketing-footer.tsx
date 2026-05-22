import Link from "next/link"

import { LogoMark } from "@/components/brand/logo-mark"

const currentYear = new Date().getFullYear()

const FOOTER_LINKS = {
  Account: [
    { href: "/login", label: "Sign in" },
    { href: "/signup", label: "Create account" }
  ],
  Data: [
    { href: "#", label: "ERCOT" },
    { href: "#", label: "CAISO" },
    { href: "#", label: "Updated daily" }
  ]
}

export function MarketingFooter() {
  return (
    <footer
      style={{
        backgroundColor: "#f5f5f7",
        borderTop: "1px solid #e0e0e0",
        padding: "64px 0 48px"
      }}
    >
      <div className="mx-auto max-w-[1440px] px-8">
        {/* Top row: brand + link columns */}
        <div className="grid gap-10 md:grid-cols-[1fr_auto_auto]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <LogoMark
                className="h-5 w-5"
                style={{ color: "#1d1d1f" }}
              />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#1d1d1f",
                  letterSpacing: "-0.224px"
                }}
              >
                GridPath
              </span>
            </div>
            <p
              className="mt-3"
              style={{
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: 1.43,
                letterSpacing: "-0.12px",
                color: "#6e6e73",
                maxWidth: "260px"
              }}
            >
              Queue data sourced from ERCOT and CAISO public reports. Updated
              daily.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "-0.224px",
                  color: "#1d1d1f",
                  lineHeight: 1.29,
                  marginBottom: "12px"
                }}
              >
                {heading}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{
                        fontSize: "12px",
                        fontWeight: 400,
                        lineHeight: 1,
                        letterSpacing: "-0.12px",
                        color: "#6e6e73",
                        textDecoration: "none"
                      }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal row */}
        <div
          className="mt-12 pt-6 flex items-center justify-between gap-4"
          style={{ borderTop: "1px solid #e0e0e0" }}
        >
          <p
            style={{
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "-0.12px",
              color: "#6e6e73",
              lineHeight: 1
            }}
          >
            © {currentYear} GridPath. All rights reserved.
          </p>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "-0.12px",
              color: "#6e6e73",
              lineHeight: 1
            }}
          >
            Data from public ISO reports
          </p>
        </div>
      </div>
    </footer>
  )
}
