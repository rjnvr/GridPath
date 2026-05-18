import { Mail } from "lucide-react"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"

export default async function VerifyRequestPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return (
    <AuthCard
      title="Check your email"
      description={
        email
          ? `We sent a sign-in link to ${email}. Open it on this device to continue.`
          : "We sent you a sign-in link. Open it on this device to continue."
      }
      footer={
        <>
          Wrong email?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Try again
          </Link>
          .
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm">
        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">The link expires in 24 hours.</span>
      </div>
    </AuthCard>
  )
}
