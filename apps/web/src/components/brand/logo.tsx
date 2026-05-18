import Link from "next/link"

import { cn } from "@/lib/utils"

import { LogoMark } from "./logo-mark"

interface LogoProps {
  href?: string
  showWordmark?: boolean
  className?: string
  markClassName?: string
}

export function Logo({ href = "/", showWordmark = true, className, markClassName }: LogoProps) {
  const inner = (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className={cn("h-6 w-6", markClassName)} title="GridPath" />
      {showWordmark ? (
        <span className="text-sm font-semibold tracking-tight text-foreground">GridPath</span>
      ) : null}
    </span>
  )
  if (!href) return inner
  return (
    <Link href={href} aria-label="GridPath home" className="inline-flex">
      {inner}
    </Link>
  )
}
