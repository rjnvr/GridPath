import { cn } from "@/lib/utils"

interface LogoMarkProps {
  className?: string
  title?: string
}

/**
 * GridPath mark — a stepped path rising through three implied grid rows,
 * ending in a node. Reads at 16px and up. Uses currentColor for the path so it
 * can be themed (defaults to the primary teal when placed in a primary-text
 * container).
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
      {/* faint queue-row guides */}
      <g stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeLinecap="round">
        <line x1="3" y1="18.5" x2="21" y2="18.5" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="5.5" x2="21" y2="5.5" />
      </g>
      {/* stepped path through the rows */}
      <path
        d="M3 18.5 H9 V12 H15 V5.5 H20.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* terminal node */}
      <circle cx="20.5" cy="5.5" r="2" fill="currentColor" />
    </svg>
  )
}
