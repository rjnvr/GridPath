import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface MarqueeProps {
  children: ReactNode
  className?: string
  /** Reverse direction */
  reverse?: boolean
  /** Pause on hover */
  pauseOnHover?: boolean
  /** Vertical scroll instead of horizontal */
  vertical?: boolean
  /** Number of times the content repeats (more = longer continuous loop) */
  repeat?: number
  /** Animation duration in seconds */
  duration?: number
}

export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = false,
  vertical = false,
  repeat = 4,
  duration = 40
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group flex overflow-hidden p-2 [--gap:1rem] [gap:var(--gap)]",
        vertical ? "flex-col" : "flex-row",
        className
      )}
      style={{ ["--gp-marquee-duration" as string]: `${duration}s` }}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex shrink-0 justify-around [gap:var(--gap)]",
            vertical
              ? "animate-[gp-marquee-vertical_var(--gp-marquee-duration)_linear_infinite] flex-col"
              : "animate-[gp-marquee_var(--gp-marquee-duration)_linear_infinite] flex-row",
            reverse && "[animation-direction:reverse]",
            pauseOnHover && "group-hover:[animation-play-state:paused]"
          )}
          aria-hidden={i > 0}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
