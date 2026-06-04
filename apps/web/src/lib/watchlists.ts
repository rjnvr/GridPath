import type { Watchlist, WatchlistFilter } from "@gridpath/shared"
import { normalizeFuelType, SUPPORTED_ISOS } from "@gridpath/shared"

import { getSql } from "@/lib/db"

type WatchlistRow = {
  id: string
  name: string
  iso: string | null
  fuel_type: string | null
  phase: string | null
  mw_bucket: string | null
  owner_company: string | null
  notify_email: boolean
  last_emailed_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function mapWatchlist(row: WatchlistRow): Watchlist {
  return {
    id: row.id,
    name: row.name,
    filter: {
      iso: row.iso,
      fuelType: normalizeFuelType(row.fuel_type),
      phase: row.phase,
      mwBucket: row.mw_bucket,
      ownerCompany: row.owner_company
    },
    notifyEmail: row.notify_email,
    lastEmailedAt: toIsoString(row.last_emailed_at),
    createdAt: toIsoString(row.created_at) ?? "",
    updatedAt: toIsoString(row.updated_at) ?? ""
  }
}

function normalizeFilterValue(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === "all") return null
  return trimmed
}

export function normalizeFilter(input: Partial<WatchlistFilter>): WatchlistFilter {
  const normalizedIso = normalizeFilterValue(input.iso)
  return {
    iso: normalizedIso && SUPPORTED_ISOS.includes(normalizedIso as (typeof SUPPORTED_ISOS)[number])
      ? normalizedIso
      : null,
    fuelType: normalizeFuelType(input.fuelType),
    phase: normalizeFilterValue(input.phase),
    mwBucket: normalizeFilterValue(input.mwBucket),
    ownerCompany: normalizeFilterValue(input.ownerCompany)
  }
}

export class WatchlistsNotProvisionedError extends Error {
  constructor() {
    super("watchlists table is not provisioned")
    this.name = "WatchlistsNotProvisionedError"
  }
}

function isUndefinedTableError(error: unknown): boolean {
  // Postgres SQLSTATE 42P01 = undefined_table. The Neon driver surfaces it on
  // `error.code`, but fall back to message sniffing for older driver versions.
  const err = error as { code?: string; message?: string } | null
  if (!err) return false
  if (err.code === "42P01") return true
  return typeof err.message === "string" && /relation .* does not exist/i.test(err.message)
}

function throwIfNotProvisioned(error: unknown): never {
  if (isUndefinedTableError(error)) {
    throw new WatchlistsNotProvisionedError()
  }
  throw error
}

export async function listWatchlists(userId: string): Promise<Watchlist[]> {
  if (!process.env.DATABASE_URL) return []
  const sql = getSql()
  try {
    const rows = await sql`
      select id, name, iso, fuel_type, phase, mw_bucket, owner_company,
             notify_email, last_emailed_at, created_at, updated_at
      from watchlists
      where user_id = ${userId}
      order by created_at desc
    `
    return (rows as WatchlistRow[]).map(mapWatchlist)
  } catch (error) {
    throwIfNotProvisioned(error)
  }
}

export async function createWatchlist(
  userId: string,
  name: string,
  filter: Partial<WatchlistFilter>,
  notifyEmail = false
): Promise<Watchlist> {
  const sql = getSql()
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("Watchlist name is required")
  }
  if (trimmedName.length > 120) {
    throw new Error("Watchlist name must be 120 characters or fewer")
  }
  const normalized = normalizeFilter(filter)
  try {
    const rows = await sql`
      insert into watchlists (user_id, name, iso, fuel_type, phase, mw_bucket, owner_company, notify_email)
      values (
        ${userId},
        ${trimmedName},
        ${normalized.iso},
        ${normalized.fuelType},
        ${normalized.phase},
        ${normalized.mwBucket},
        ${normalized.ownerCompany},
        ${notifyEmail}
      )
      returning id, name, iso, fuel_type, phase, mw_bucket, owner_company,
                notify_email, last_emailed_at, created_at, updated_at
    `
    return mapWatchlist((rows as WatchlistRow[])[0])
  } catch (error) {
    throwIfNotProvisioned(error)
  }
}

export async function setWatchlistEmailNotifications(
  userId: string,
  watchlistId: string,
  notifyEmail: boolean
): Promise<void> {
  const sql = getSql()
  try {
    await sql`
      update watchlists
      set notify_email = ${notifyEmail},
          updated_at = now()
      where id = ${watchlistId} and user_id = ${userId}
    `
  } catch (error) {
    throwIfNotProvisioned(error)
  }
}

export async function deleteWatchlist(userId: string, watchlistId: string): Promise<void> {
  const sql = getSql()
  try {
    await sql`delete from watchlists where id = ${watchlistId} and user_id = ${userId}`
  } catch (error) {
    throwIfNotProvisioned(error)
  }
}

export async function getWatchlist(userId: string, watchlistId: string): Promise<Watchlist | null> {
  if (!process.env.DATABASE_URL) return null
  const sql = getSql()
  try {
    const rows = await sql`
      select id, name, iso, fuel_type, phase, mw_bucket, owner_company,
             notify_email, last_emailed_at, created_at, updated_at
      from watchlists
      where id = ${watchlistId} and user_id = ${userId}
      limit 1
    `
    const row = (rows as WatchlistRow[])[0]
    return row ? mapWatchlist(row) : null
  } catch (error) {
    throwIfNotProvisioned(error)
  }
}
