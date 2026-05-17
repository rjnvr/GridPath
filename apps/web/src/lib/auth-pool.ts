import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __authPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = process.env.DIRECT_DATABASE_URL
  if (!connectionString) {
    throw new Error("DIRECT_DATABASE_URL is not set — required for Auth.js adapter writes")
  }
  const pool = new Pool({ connectionString, max: 5 })
  if (process.env.NODE_ENV !== "production") {
    globalThis.__authPool = pool
  }
  return pool
}

// Lazy proxy: defers Pool construction until the adapter actually calls a
// method on it. This keeps `next build` from failing during page-data
// collection when env vars aren't yet available.
export const authPool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const real = globalThis.__authPool ?? createPool()
    const value = Reflect.get(real, prop, receiver)
    return typeof value === "function" ? value.bind(real) : value
  }
})
