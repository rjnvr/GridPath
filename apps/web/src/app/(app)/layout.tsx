import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { AppShell } from "@/components/app-shell/app-shell"
import { auth } from "@/lib/auth"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) {
    redirect("/login")
  }
  return (
    <AppShell user={{ email: session.user.email, name: session.user.name }}>
      {children}
    </AppShell>
  )
}
