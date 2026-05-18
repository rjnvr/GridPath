import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/lib/auth"
import { WatchlistsNotProvisionedError, listWatchlists } from "@/lib/watchlists"
import type { Watchlist } from "@gridpath/shared"

import { createWatchlistAction, deleteWatchlistAction } from "./actions"

export const dynamic = "force-dynamic"

const MW_BUCKET_LABELS: Record<string, string> = {
  lt100: "< 100 MW",
  "100to500": "100–499 MW",
  gte500: "500+ MW"
}

function buildFilterQuery(filter: {
  iso: string | null
  fuelType: string | null
  phase: string | null
  mwBucket: string | null
  ownerCompany: string | null
}): string {
  const params = new URLSearchParams()
  if (filter.iso) params.set("iso", filter.iso)
  if (filter.fuelType) params.set("fuel", filter.fuelType)
  if (filter.phase) params.set("phase", filter.phase)
  if (filter.mwBucket) params.set("mw", filter.mwBucket)
  if (filter.ownerCompany) params.set("owner", filter.ownerCompany)
  const qs = params.toString()
  return qs ? `/dashboard?${qs}` : "/dashboard"
}

function summarizeFilter(filter: {
  iso: string | null
  fuelType: string | null
  phase: string | null
  mwBucket: string | null
  ownerCompany: string | null
}): string {
  const parts: string[] = []
  parts.push(filter.iso ?? "All ISOs")
  if (filter.fuelType) parts.push(filter.fuelType)
  if (filter.phase) parts.push(filter.phase)
  if (filter.mwBucket) parts.push(MW_BUCKET_LABELS[filter.mwBucket] ?? filter.mwBucket)
  if (filter.ownerCompany) parts.push(`owner: ${filter.ownerCompany}`)
  return parts.join(" · ")
}

export default async function WatchlistsPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    redirect("/login")
  }
  let watchlists: Watchlist[] = []
  let notProvisioned = false
  try {
    watchlists = await listWatchlists(userId)
  } catch (error) {
    if (error instanceof WatchlistsNotProvisionedError) {
      notProvisioned = true
    } else {
      throw error
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Watchlists</h1>
        <p className="text-sm text-muted-foreground">
          Save a filtered view of the queue. Daily email digests of matching changes are coming next.
        </p>
      </header>

      {notProvisioned ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-200">Watchlists are not yet provisioned in this database.</p>
          <p className="mt-1 text-amber-100/80">
            Apply <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">db/migrations/003_watchlists.sql</code>
            {" "}to your Neon database, then refresh.
          </p>
        </div>
      ) : null}

      {!notProvisioned ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>New watchlist</CardTitle>
              <CardDescription>
                Or open <Link href="/dashboard" className="underline">the dashboard</Link>, set filters, and click
                &ldquo;Save view&rdquo; — that&rsquo;s usually faster.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createWatchlistAction} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required placeholder="West Texas solar 500MW+" />
                </div>
                <div>
                  <Label htmlFor="iso">ISO</Label>
                  <select
                    id="iso"
                    name="iso"
                    className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="ERCOT">ERCOT</option>
                    <option value="CAISO">CAISO</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="fuelType">Fuel</Label>
                  <Input id="fuelType" name="fuelType" placeholder="solar / wind / storage / gas" />
                </div>
                <div>
                  <Label htmlFor="phase">Phase</Label>
                  <Input id="phase" name="phase" placeholder="e.g. FIS Approved" />
                </div>
                <div>
                  <Label htmlFor="mwBucket">MW bucket</Label>
                  <select
                    id="mwBucket"
                    name="mwBucket"
                    className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Any</option>
                    <option value="lt100">&lt; 100 MW</option>
                    <option value="100to500">100–499 MW</option>
                    <option value="gte500">500+ MW</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="ownerCompany">Owner company contains</Label>
                  <Input id="ownerCompany" name="ownerCompany" placeholder="e.g. NextEra" />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">Create watchlist</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Your watchlists</h2>
            {watchlists.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                No watchlists yet. Create one above, or set filters on the dashboard and save them from there.
              </p>
            ) : (
              <ul className="space-y-2">
                {watchlists.map((wl) => (
                  <li
                    key={wl.id}
                    className="flex items-start justify-between gap-4 rounded-md border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <Link
                        href={buildFilterQuery(wl.filter)}
                        className="text-base font-medium hover:underline"
                      >
                        {wl.name}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{summarizeFilter(wl.filter)}</p>
                    </div>
                    <form action={deleteWatchlistAction}>
                      <input type="hidden" name="id" value={wl.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Delete
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
