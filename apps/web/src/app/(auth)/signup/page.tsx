import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { EmailAuthForm } from "@/components/auth/email-auth-form"
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
      description="Continue with Google or your work email. Your account is created automatically the first time."
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
      <div className="space-y-4">
        <GoogleSignInButton callbackUrl={callbackUrl} label="Continue with Google" />
        <OrDivider />
        <EmailAuthForm callbackUrl={callbackUrl} submitLabel="Email me a sign-in link" />
      </div>
    </AuthCard>
  )
}

function OrDivider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">or</span>
      </div>
    </div>
  )
}
