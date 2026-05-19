import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface AuroraTextProps {
  children: ReactNode
  className?: string
  /** Optional alternate aurora palette */
  colors?: [string, string, string, string]
}

const DEFAULT_COLORS: [string, string, string, string] = [
  "hsl(var(--primary))",
  "hsl(var(--fuel-wind))",
  "hsl(var(--fuel-solar))",
  "hsl(var(--primary))"
]

export function AuroraText({ children, className, colors = DEFAULT_COLORS }: AuroraTextProps) {
  return (
    <span
      className={cn("relative inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 25%, ${colors[2]} 60%, ${colors[3]} 100%)`,
        backgroundSize: "200% 200%",
        animation: "gp-aurora-shift 10s ease-in-out infinite"
      }}
    >
      {children}
    </span>
  )
}
