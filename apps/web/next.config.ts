import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@gridpath/shared"],
  typescript: {
    // Type errors are caught in CI (npm run typecheck) — don't block the build.
    ignoreBuildErrors: true
  }
}

export default nextConfig
