import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  return (
    <AuthCard
      title="Create your GridPath account"
      description="Sign in with Google. Your account is created automatically the first time."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
          .
        </>
      }
    >
      <GoogleSignInButton callbackUrl={callbackUrl} label="Continue with Google" />
    </AuthCard>
  )
}
