import type { NextAuthConfig } from "next-auth"

// Edge-safe config: no adapter, no Node-only providers. Used by middleware to
// gate routes via the `authorized` callback, and spread into the full config
// in `auth.ts` for the API handler / server components.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/search",
  "/analysis",
  "/health",
  "/account",
  "/watchlists",
  "/projects"
]

export default {
  providers: [],
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/error"
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        nextUrl.pathname === prefix || nextUrl.pathname.startsWith(`${prefix}/`)
      )
      if (isProtected && !isLoggedIn) {
        const url = new URL("/login", nextUrl.origin)
        url.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
        return Response.redirect(url)
      }
      return true
    }
  }
} satisfies NextAuthConfig
