import Link from "next/link"
import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">GridPath</span>
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
