import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface AnimatedGradientTextProps {
  children: ReactNode
  className?: string
}

export function AnimatedGradientText({ children, className }: AnimatedGradientTextProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs backdrop-blur",
        className
      )}
    >
      <span
        className="inline-block bg-clip-text text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(110deg, hsl(var(--primary)) 0%, hsl(var(--foreground)) 40%, hsl(var(--primary)) 80%)",
          backgroundSize: "300% 100%",
          animation: "gp-gradient-shift 6s ease-in-out infinite"
        }}
      >
        {children}
      </span>
    </span>
  )
}
