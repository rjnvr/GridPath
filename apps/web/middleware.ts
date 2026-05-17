import NextAuth from "next-auth"

import authConfig from "@/lib/auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  // Run on all paths except API auth, static assets, and files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
}
