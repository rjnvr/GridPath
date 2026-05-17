import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"

const MESSAGES: Record<string, string> = {
  Configuration: "Authentication is misconfigured. Please contact support.",
  AccessDenied: "You don't have access to this resource.",
  Verification: "The sign-in link has expired or was already used. Request a new one."
}

export default async function AuthErrorPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = (error && MESSAGES[error]) || "Something went wrong signing you in."
  return (
    <AuthCard title="Sign-in error" description={message}>
      <Button asChild>
        <Link href="/login">Back to sign in</Link>
      </Button>
    </AuthCard>
  )
}
