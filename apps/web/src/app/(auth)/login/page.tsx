import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  return (
    <AuthCard
      title="Sign in to GridPath"
      description="Use your Google account to continue."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
          .
        </>
      }
    >
      <GoogleSignInButton callbackUrl={callbackUrl} label="Sign in with Google" />
    </AuthCard>
  )
}
