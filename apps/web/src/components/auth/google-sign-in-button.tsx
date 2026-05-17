"use client"

import { useTransition } from "react"
import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"

interface GoogleSignInButtonProps {
  callbackUrl?: string
  label?: string
}

export function GoogleSignInButton({ callbackUrl, label = "Continue with Google" }: GoogleSignInButtonProps) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signIn("google", { callbackUrl: callbackUrl ?? "/dashboard" })
        })
      }
    >
      <GoogleMark className="h-4 w-4" />
      {pending ? "Redirecting…" : label}
    </Button>
  )
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M12 10.2v3.93h5.51c-.24 1.42-1.7 4.18-5.51 4.18-3.32 0-6.02-2.75-6.02-6.13S8.68 6.05 12 6.05c1.89 0 3.16.81 3.88 1.5l2.64-2.55C16.94 3.5 14.69 2.55 12 2.55 6.76 2.55 2.55 6.76 2.55 12s4.21 9.45 9.45 9.45c5.45 0 9.07-3.83 9.07-9.22 0-.62-.07-1.09-.16-1.56H12z"
      />
    </svg>
  )
}
