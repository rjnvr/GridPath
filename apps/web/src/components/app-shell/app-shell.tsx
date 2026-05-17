import type { ReactNode } from "react"

import { MobileNav } from "./mobile-nav"
import { Sidebar } from "./sidebar"
import { UserMenu } from "./user-menu"

interface AppShellProps {
  children: ReactNode
  user: { email: string; name?: string | null }
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border md:block">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <MobileNav />
              <span className="text-sm font-medium md:hidden">GridPath</span>
            </div>
            <UserMenu email={user.email} name={user.name} />
          </header>
          <main id="main-content" className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
