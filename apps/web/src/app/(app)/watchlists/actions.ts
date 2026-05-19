"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import {
  WatchlistsNotProvisionedError,
  createWatchlist,
  deleteWatchlist,
  setWatchlistEmailNotifications
} from "@/lib/watchlists"

type WatchlistActionResult = { ok: true } | { ok: false; error: "not_provisioned" }

async function requireUserId(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    redirect("/login")
  }
  return userId
}

async function createWatchlistForUser(formData: FormData): Promise<WatchlistActionResult> {
  const userId = await requireUserId()
  const name = String(formData.get("name") ?? "")
  const notifyEmail = formData.get("notifyEmail") === "on"
  try {
    await createWatchlist(
      userId,
      name,
      {
        iso: String(formData.get("iso") ?? "") || null,
        fuelType: String(formData.get("fuelType") ?? "") || null,
        phase: String(formData.get("phase") ?? "") || null,
        mwBucket: String(formData.get("mwBucket") ?? "") || null,
        ownerCompany: String(formData.get("ownerCompany") ?? "") || null
      },
      notifyEmail
    )
  } catch (error) {
    if (error instanceof WatchlistsNotProvisionedError) {
      return { ok: false, error: "not_provisioned" }
    }
    throw error
  }
  revalidatePath("/watchlists")
  return { ok: true }
}

export async function createWatchlistAction(formData: FormData): Promise<void> {
  const result = await createWatchlistForUser(formData)
  if (!result.ok) {
    throw new Error("Watchlists are not provisioned")
  }
}

export async function createWatchlistClientAction(formData: FormData): Promise<WatchlistActionResult> {
  return createWatchlistForUser(formData)
}

export async function deleteWatchlistAction(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const id = String(formData.get("id") ?? "")
  if (!id) return
  try {
    await deleteWatchlist(userId, id)
  } catch (error) {
    if (error instanceof WatchlistsNotProvisionedError) {
      throw new Error("Watchlists are not provisioned")
    }
    throw error
  }
  revalidatePath("/watchlists")
}

export async function updateWatchlistEmailAction(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const id = String(formData.get("id") ?? "")
  if (!id) return
  const notifyEmail = formData.get("notifyEmail") === "true"
  try {
    await setWatchlistEmailNotifications(userId, id, notifyEmail)
  } catch (error) {
    if (error instanceof WatchlistsNotProvisionedError) {
      throw new Error("Watchlists are not provisioned")
    }
    throw error
  }
  revalidatePath("/watchlists")
}
