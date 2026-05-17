import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __authPool: Pool | undefined
}

function createPool() {
  const connectionString = process.env.DIRECT_DATABASE_URL
  if (!connectionString) {
    throw new Error("DIRECT_DATABASE_URL is not set — required for Auth.js adapter writes")
  }
  return new Pool({ connectionString, max: 5 })
}

export const authPool: Pool = globalThis.__authPool ?? createPool()

if (process.env.NODE_ENV !== "production") {
  globalThis.__authPool = authPool
}
