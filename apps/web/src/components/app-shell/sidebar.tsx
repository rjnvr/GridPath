"use client"

import { Activity, BarChart3, Bookmark, LayoutDashboard, Search, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { LogoMark } from "@/components/brand/logo-mark"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/watchlists", label: "Watchlists", icon: Bookmark },
  { href: "/health", label: "Data Health", icon: Activity },
  { href: "/account", label: "Account", icon: Settings }
]

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const sidebarRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handleMouseEnter = () => setCollapsed(false)
    const handleMouseLeave = () => setCollapsed(true)
    const element = sidebarRef.current
    if (element) {
      element.addEventListener("mouseenter", handleMouseEnter)
      element.addEventListener("mouseleave", handleMouseLeave)
      return () => {
        element.removeEventListener("mouseenter", handleMouseEnter)
        element.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [])

  return (
    <nav
      ref={sidebarRef}
      aria-label="Primary"
      className={cn(
        "flex h-full flex-col gap-1 p-3 transition-all duration-200",
        collapsed ? "w-[80px]" : "w-[240px]",
        className
      )}
    >
      <Link
        href="/dashboard"
        className="mb-4 flex items-center gap-2 px-2 py-1"
        aria-label="GridPath home"
      >
        <LogoMark className="h-6 w-6" />
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight">GridPath</span>
        )}
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
            {!collapsed && <span>{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
