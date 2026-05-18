"use server"

import { AuthError } from "next-auth"

import { signIn } from "@/lib/auth"

export async function sendMagicLink(formData: FormData): Promise<{ error?: string } | void> {
  const email = formData.get("email")
  const callbackUrl = (formData.get("callbackUrl") as string | null) || "/dashboard"
  if (typeof email !== "string" || !email) {
    return { error: "Please enter a valid email address." }
  }
  try {
    await signIn("resend", {
      email,
      redirectTo: `/verify-request?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "We couldn't send the sign-in link. Check the email and try again." }
    }
    throw err
  }
}
