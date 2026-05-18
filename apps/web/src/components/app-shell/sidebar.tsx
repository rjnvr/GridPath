"use client"

import { Activity, LayoutDashboard, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { LogoMark } from "@/components/brand/logo-mark"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/health", label: "Data Health", icon: Activity },
  { href: "/account", label: "Account", icon: Settings }
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="flex h-full flex-col gap-1 p-3">
      <Link
        href="/dashboard"
        className="mb-4 flex items-center gap-2 px-2 py-1"
        aria-label="GridPath home"
      >
        <LogoMark className="h-6 w-6" />
        <span className="text-sm font-semibold tracking-tight">GridPath</span>
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
