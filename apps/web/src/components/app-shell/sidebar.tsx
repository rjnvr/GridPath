"use client"

import {
  Activity,
  BarChart3,
  Bookmark,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { LogoMark } from "@/components/brand/logo-mark"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/watchlists", label: "Watchlists", icon: Bookmark },
  { href: "/health", label: "Data Health", icon: Activity },
  { href: "/account", label: "Account", icon: Settings }
]

export function Sidebar({
  className,
  collapsible = true
}: {
  className?: string
  collapsible?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(collapsible)
  const isCollapsed = collapsible && collapsed

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full flex-col gap-1 p-3 transition-all duration-200",
        isCollapsed ? "w-[80px]" : "w-[240px]",
        className
      )}
    >
      <div className="mb-4 flex items-center gap-2 px-2 py-1">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-2"
          aria-label="GridPath home"
        >
          <LogoMark className="h-6 w-6 shrink-0" />
          {!isCollapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">GridPath</span>
          )}
        </Link>
        {collapsible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="h-8 w-8 shrink-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>
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
            title={isCollapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
