import { cn } from "@/lib/utils"

interface BorderBeamProps {
  className?: string
  /** Beam length (% of border perimeter) */
  size?: number
  /** Animation duration in seconds */
  duration?: number
  /** Delay before start, seconds */
  delay?: number
  /** Beam color (CSS) */
  colorFrom?: string
  colorTo?: string
  /** Corner radius (px) — should match parent's radius */
  borderRadius?: number
}

export function BorderBeam({
  className,
  size = 200,
  duration = 6,
  delay = 0,
  colorFrom = "hsl(var(--primary))",
  colorTo = "hsl(var(--primary) / 0)",
  borderRadius = 6
}: BorderBeamProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent]",
        "[mask-clip:padding-box,border-box] [mask-composite:intersect]",
        "[mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        className
      )}
      style={{
        // CSS custom properties consumed by the animation below
        ["--gp-beam-size" as string]: `${size}px`,
        ["--gp-beam-duration" as string]: `${duration}s`,
        ["--gp-beam-delay" as string]: `${delay}s`,
        ["--gp-beam-from" as string]: colorFrom,
        ["--gp-beam-to" as string]: colorTo,
        ["--gp-beam-radius" as string]: `${borderRadius}px`
      }}
    >
      <span
        className="absolute aspect-square animate-[gp-border-beam_var(--gp-beam-duration)_linear_infinite]"
        style={{
          width: "var(--gp-beam-size)",
          background:
            "conic-gradient(from 0deg, transparent 0deg, var(--gp-beam-from) 30deg, var(--gp-beam-to) 60deg, transparent 90deg)",
          animationDelay: "var(--gp-beam-delay)",
          offsetPath: `rect(0 100% 100% 0 round var(--gp-beam-radius))`
        }}
      />
    </span>
  )
}
