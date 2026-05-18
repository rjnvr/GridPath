"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { createWatchlist, deleteWatchlist } from "@/lib/watchlists"

async function requireUserId(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    redirect("/login")
  }
  return userId
}

export async function createWatchlistAction(formData: FormData) {
  const userId = await requireUserId()
  const name = String(formData.get("name") ?? "")
  await createWatchlist(userId, name, {
    iso: String(formData.get("iso") ?? "") || null,
    fuelType: String(formData.get("fuelType") ?? "") || null,
    phase: String(formData.get("phase") ?? "") || null,
    mwBucket: String(formData.get("mwBucket") ?? "") || null,
    ownerCompany: String(formData.get("ownerCompany") ?? "") || null
  })
  revalidatePath("/watchlists")
}

export async function deleteWatchlistAction(formData: FormData) {
  const userId = await requireUserId()
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await deleteWatchlist(userId, id)
  revalidatePath("/watchlists")
}
