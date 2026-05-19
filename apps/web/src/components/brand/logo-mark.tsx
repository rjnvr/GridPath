import { cn } from "@/lib/utils"

interface LogoMarkProps {
  className?: string
  title?: string
}

/**
 * GridPath mark — an abstract "path through a grid" glyph:
 * a diagonal stroke (the path) flanked by three stacked phase nodes,
 * with the middle node filled (the tracked project).
 *
 * Reads at 16px and up. Uses currentColor so it inherits the surrounding text color.
 */
export function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title}
      className={cn("text-primary", className)}
      fill="none"
    >
      {/* The path — diagonal stroke bottom-left → top-right */}
      <path
        d="M 4.5 19.5 L 16.5 5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Phase nodes, vertical column on the right */}
      <circle cx="20" cy="5.5" r="1.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="12" r="2" fill="currentColor" />
      <circle cx="20" cy="18.5" r="1.4" stroke="currentColor" strokeWidth="1.5" />
      {/* Pulse halo around the tracked node */}
      <circle cx="20" cy="12" r="4.5" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  )
}
