# GridPath Product Roadmap — From Demo to Defensible SaaS

## Context

GridPath today is a **well-built tracker without an activation loop**. The foundations are strong: daily ERCOT/CAISO ingestion, normalized schema, classified `queue_events` with severity, PostGIS substation overlays, MapLibre dashboard, NextAuth auth, watchlists with `notify_email` flag, a Three.js data-center landing scene, and Resend (`resend@6.12.3`) already wired for magic-link auth.

What's missing is the **reason a user returns tomorrow**. Watchlists save filters but the `notify_email` toggle is a dead end — no cron, no digest composer, no send. Coverage is only 2 of 7 US ISOs (~50% of the market). There is no CSV export, no billing, no public API, and the 3D data-center model on the landing page hints at a site-selection audience that has no actual product surface yet.

This plan defines:
1. **Who** the product is for (and the order of priority).
2. **How** it differentiates from existing tools.
3. **What** to build next, sequenced as 6 phases over ~4 months, each one building on the files that already exist.

---

## Target Users (in priority order)

### Tier 1 — Buyers who will pay first

**1. Data center site-selection teams** (hyperscalers, colos, AI infra builders)
- *Pain*: Need to find sites with available transmission capacity and short interconnect lead times. Today they pay $200K+ consulting engagements for one-off studies.
- *Signal in repo*: The `DataCenterScene` GLB on the landing page (`apps/web/src/components/marketing/data-center-scene.tsx`) is already pointing at this audience.
- *Willingness to pay*: Very high. Single site selection is a $50M–$1B+ decision.

**2. Renewable / storage project developers** (solar, wind, battery IPPs)
- *Pain*: Need to track competing projects in their substation cluster, monitor their own queue position, and react when ISO studies move. Today they manually diff ERCOT/CAISO Excel files.
- *Signal in repo*: The whole dashboard (`apps/web/src/components/dashboard.tsx`) is designed for this user.
- *Willingness to pay*: Medium-high. $200–$2K/seat/mo is normal for this tier.

### Tier 2 — Buyers reachable later

**3. Project finance & energy investors** (infra funds, VCs, M&A teams) — pipeline due diligence, portfolio risk.
**4. Utility planners & transmission engineers** — internal coverage of their own service area.
**5. Energy journalists, advocacy orgs, researchers** — free tier funnel; SEO.

---

## Competitive Differentiation

| Competitor | Their angle | GridPath's edge |
|---|---|---|
| **LBNL queue tracker** (free) | Authoritative but annual | **Daily diffs**, classified events, watchlists |
| **S&P Global / Wood Mackenzie** ($50K+/yr) | Deep but slow, enterprise-only | **1/10 the price**, self-serve, modern UI |
| **Direct ISO websites** (free) | Raw Excel, no history | **Normalized schema, change history, severity-classified events** |
| **Enverus / BloombergNEF** ($$$$) | Broad energy data | **Map-native, site-selection-focused** UX |
| **Manual Excel diffing** | What most teams do today | **Automated, alertable, queryable** |

**Three durable moats to build toward:**
1. **Time-series of changes** — every day GridPath runs, the historical diff dataset deepens. Competitors cloning this start with no history.
2. **Site-selection workflow** — pin-drop → headroom + competition + lead time, in one tool. Nobody else combines queue intelligence with site analysis.
3. **Alert primitives** — if developers receive a daily 7am email from GridPath, switching cost is high.

---

## The Single Next Step

**Activate the watchlist email loop.** Everything else is downstream of this.

Today: user saves a watchlist with `notify_email = true`, and nothing happens. The `last_emailed_at` column on `watchlists` is never written. There is no cron, no digest composer.

After this ships: users get a daily 7am email summarizing the `queue_events` that matched their saved filter in the last 24h, with deep links back to the dashboard. This is the line between "neat demo" and "habit-forming product." Every other phase compounds on this.

---

## Phased Roadmap

### Phase 1 — Activate the value loop (~1.5 weeks)

**Goal**: Users get a useful email every morning.

1. **Daily digest cron** (Vercel Cron at `/api/cron/daily-digest`)
   - New file: `apps/web/src/app/api/cron/daily-digest/route.ts`
   - For each watchlist with `notify_email = true`, run the watchlist's filter against `queue_events` from the last 24h, group by severity, build the email.
   - Reuse `normalizeFilter` and the watchlist row mapping from `apps/web/src/lib/watchlists.ts:50`.
   - Reuse the same SQL filter clauses that `apps/web/src/lib/data.ts` already builds for the dashboard — extract them into a shared `buildWatchlistEventQuery()` so the digest and the dashboard render identical sets.
   - Update `watchlists.last_emailed_at` on success; skip if `last_emailed_at > now() - interval '20 hours'` to make the cron idempotent on retries.

2. **Email template** (React Email or plain HTML via Resend)
   - New file: `apps/web/src/lib/email/digest.tsx`
   - Sections: critical events → important events → new projects → MW changes. Each row links to `/projects/[id]`.
   - Reuse Resend client setup from `apps/web/src/lib/auth.ts` and `apps/web/src/components/auth/actions.ts`.

3. **CSV export** (the second-most-asked-for thing in this domain)
   - New file: `apps/web/src/app/api/export/projects/route.ts`
   - Stream a CSV of whatever the user's current filter matches. Add an "Export CSV" button in the dashboard toolbar near the existing watchlist save button (`dashboard.tsx` around the watchlist-save UI).
   - Same for `queue_events` view.

4. **Schema add**: `digest_runs` table (cron audit) — useful from day one for "did the digest go out?"

**Files to touch**: `apps/web/src/lib/watchlists.ts`, `apps/web/src/lib/data.ts`, `apps/web/src/components/dashboard.tsx`, new files under `app/api/cron/` and `app/api/export/`. New migration `db/migrations/005_digests.sql`.

**Verification**: trigger `/api/cron/daily-digest` manually with `?force=true&dryRun=true`, render the resulting email payload, send to test address; CSV downloads with expected columns.

---

### Phase 2 — Site-selection module ("Headroom") (~3 weeks)

**Goal**: Convert the landing page's data-center promise into a real product surface. This is the wedge against the Tier-1 buyer.

1. **New route `/headroom`** (or `/site-select`)
   - User drops a pin on the map or enters lat/lng / address.
   - We compute and display:
     - Nearest substations (PostGIS `<->` is already in `data.ts:439`).
     - Sum of active queued MW within 25 mi (competition for capacity).
     - Sum of energized MW within 25 mi (existing draw).
     - Mix by fuel type (color-coded badges).
     - Median queue duration for projects in the area (proxy for lead time).
     - Estimated headroom score (qualitative: high/medium/low/saturated) with the assumptions documented.

2. **Substation detail page** `/substations/[id]` — currently substations are only an overlay; make each one clickable.
   - Adjacent projects, recent events at this node, total MW connected, fuel mix.
   - Reuse the project drawer pattern from `dashboard.tsx`.

3. **Shareable PDF / link** — `/headroom/[shareToken]` public read-only page. Site selectors send these to internal stakeholders; this is also organic distribution.

**Files to touch**: new `apps/web/src/app/(app)/headroom/`, new `apps/web/src/app/(app)/substations/[id]/`, extend `data.ts` with `getHeadroomReport(lat, lng, radiusMi)`. New migration `db/migrations/006_share_tokens.sql`.

**Verification**: Pin Loudoun County VA — should return the well-known data-center cluster with high queued MW.

---

### Phase 3 — ISO expansion (~4 weeks, parallel-able)

**Goal**: Stop leaving 50% of the US market on the table.

Order matters — pick by market activity, not difficulty:

1. **PJM** (week 1–2) — largest queue in the US; biggest single revenue unlock.
   - New file: `apps/ingestion/gridpath_ingestion/pjm.py`, mirror `ercot.py` structure.
   - PJM publishes the queue as CSV on `pjm.com` — easier than ERCOT's GIS workbook.
2. **MISO** (week 3) — second-biggest queue, Excel-based, similar to ERCOT.
3. **SPP / NYISO / ISO-NE** (week 4, parallel) — smaller queues, similar shape.

For each, the ingestion job needs only:
- A parser that emits the same normalized `projects` rows.
- A daily GitHub Action mirror of `.github/workflows/ercot-snapshot.yml`.

Frontend changes are near-zero — the dashboard's ISO filter dropdown will surface them automatically once rows land. Update the `/health` page to list new ISOs.

**Files to touch**: `apps/ingestion/gridpath_ingestion/{pjm,miso,spp,nyiso,isone}.py`, `.github/workflows/*.yml`, `apps/web/src/lib/data.ts` (ISO label map), `apps/web/src/components/analysis/`.

**Verification**: `/health` shows fresh snapshots for all 7 ISOs; map filter returns projects when set to PJM/MISO.

---

### Phase 4 — Monetization (~2 weeks)

**Goal**: Stop being a free tech demo.

1. **Stripe Checkout + Customer Portal** — wire to `users` table.
2. **Plans**:
   - **Free**: 1 watchlist, no email, no export, no API. Single ISO. SEO/funnel.
   - **Pro $99/mo**: unlimited watchlists, daily email, CSV export, all ISOs.
   - **Team $499/mo**: shared watchlists, Slack/Teams webhook delivery, 3 seats.
   - **Enterprise**: SSO, API access, custom regions. Talk-to-sales.
3. **Usage gates** in middleware — `apps/web/src/middleware.ts` or per-route checks.
4. **Pricing page** at `/pricing` — extend marketing surface (reuse `components/marketing/`).

**Files to touch**: new `apps/web/src/app/(app)/billing/`, new `apps/web/src/app/(marketing)/pricing/page.tsx`, extend NextAuth session to include plan tier, new migration `db/migrations/007_billing.sql`.

**Verification**: free user with 1 watchlist sees an upsell when trying to create a second; Stripe test mode end-to-end.

---

### Phase 5 — Public API & integrations (~2.5 weeks)

**Goal**: Convert top-tier customers from "logs into the dashboard" to "wired into our Salesforce / data warehouse." This is where switching cost gets real.

1. **REST API** at `/api/v1/*` — `projects`, `events`, `substations`, `watchlists`. Cursor pagination, ETags.
2. **API key model** — generate per-user keys; middleware checks key → user → plan.
3. **Webhooks** — POST to user-registered URL when a watchlist match fires. Same payload schema as the email.
4. **Slack / Teams delivery** — alternate digest channel for Team plan.
5. **Docs page** at `/docs/api` — generate from the route handlers.

**Files to touch**: new `apps/web/src/app/api/v1/`, new `apps/web/src/lib/api-auth.ts`, new migration `db/migrations/008_api_keys.sql`.

**Verification**: `curl -H "Authorization: Bearer ..." /api/v1/projects?iso=ERCOT&fuel=solar` returns expected rows; webhook test endpoint receives a POST when a matching event fires.

---

### Phase 6 — Forecasting & advanced analytics (ongoing, ~ Q2+)

**Goal**: Move from "what changed yesterday" to "what's likely to happen next."

This is the long-term moat that pure data vendors can't replicate without our event history. Start simple:

1. **Phase-progression estimates** — based on observed median time-in-phase per ISO, fuel, MW bucket. Show on project detail page: "Median time from Feasibility → IA Executed in ERCOT for solar 100–500MW is X months; this project entered phase Y months ago."
2. **Withdrawal-risk score** — projects that have stalled past the historical median, downgraded MW, or had owner changes. Surface on dashboard with a sortable column.
3. **Capacity-by-substation forecast** — used in Phase 2's Headroom module; project which substations clear up over the next 12 months.

**Files to touch**: new `apps/web/src/lib/analytics/` modules, extend `/projects/[id]` and `/headroom` pages.

---

## Cross-cutting work (interleaved, not a phase)

- **Mobile-responsive dashboard** — the dashboard is desktop-first. Phase 2's `/headroom` and the project detail page should ship mobile-first since site selectors check phone-side.
- **Status page / health on the marketing site** — convert `/health` into a public-facing trust signal.
- **SEO: public project pages** — `/projects/[id]` for prominent projects should be crawlable; long tail = free acquisition.
- **Telemetry** — add a basic analytics layer (PostHog or self-hosted) to know what filters/events users actually use.

---

## Critical existing files to build on

| File | Why it matters |
|---|---|
| `apps/web/src/lib/watchlists.ts` | Watchlist CRUD, `normalizeFilter` — reuse in digest cron |
| `apps/web/src/lib/data.ts` (930 lines) | All filtered queries — extract `buildWatchlistEventQuery()` for cron + dashboard parity |
| `apps/web/src/components/dashboard.tsx` (1666 lines) | Existing filter UI — add Export CSV button alongside watchlist save |
| `apps/web/src/lib/auth.ts`, `components/auth/actions.ts` | Existing Resend integration — reuse client for digest emails |
| `db/migrations/004_queue_change_intelligence.sql` | `queue_events` with `severity` already classified — digest groups by this |
| `apps/ingestion/gridpath_ingestion/ercot.py`, `caiso.py` | Pattern to clone for PJM/MISO/SPP/NYISO/ISO-NE |
| `apps/web/src/components/marketing/data-center-scene.tsx` | The landing-page promise to deliver on in Phase 2 |
| `.github/workflows/ercot-snapshot.yml` | Cron pattern to replicate per ISO |

---

## End-to-end verification per phase

- **Phase 1**: trigger cron dry-run, inspect rendered HTML, send to seed user, click through to dashboard with filter pre-applied. CSV opens cleanly in Excel.
- **Phase 2**: pin Loudoun County VA — high queued MW, low headroom score; pin rural West Texas — high headroom, low competition.
- **Phase 3**: `/health` shows all 7 ISOs green; PJM filter shows expected solar/storage projects in NJ/VA/PA.
- **Phase 4**: free user blocked from 2nd watchlist; Stripe test webhook upgrades them to Pro and access opens.
- **Phase 5**: `curl` API returns same rows as dashboard; webhook POST hits a request-bin within minutes of an ingestion that triggers a matching event.
- **Phase 6**: project detail page shows a phase-progression band; sort dashboard by withdrawal-risk and the top rows are projects with known stalls.

---

## Recommended sequence summary

```
Week 1-2:    Phase 1  (digest + CSV)              ← unlocks daily user habit
Week 3-5:    Phase 2  (headroom / site select)    ← unlocks Tier-1 buyer
Week 4-7:    Phase 3  (PJM/MISO/SPP/NYISO/ISO-NE) ← parallel; unlocks 50% more market
Week 8-9:    Phase 4  (billing + plans)           ← unlocks revenue
Week 10-12:  Phase 5  (API + webhooks)            ← unlocks Tier-1 retention
Week 13+:    Phase 6  (forecasting)               ← unlocks the long-term moat
```
