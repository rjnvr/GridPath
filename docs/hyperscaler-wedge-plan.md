# GridPath: Differentiation Wedge + 4–6 Week Build Plan

## Context

GridPath is a pre-revenue, zero-users ERCOT/CAISO/PJM/MISO/SPP interconnection queue intelligence app. The data substrate is solid (normalized multi-ISO projects + PostGIS + HIFLD substations + snapshot history + field-level change tracking), and the current UI surfaces it well (dashboard, search, project pages, watchlists, headroom explorer, analysis trends).

But the codebase today is, functionally, **a nicer dashboard over public data**. Every direct competitor — GridStatus.io, Enverus PRISM, S&P Market Intelligence, Hitachi Velocity Suite, Paces, Nira Energy, Pearl Street — can render the same raw queue. None of them are differentiated yet on the dimension that actually matters to the buyer with the most urgency and budget in 2026: **hyperscaler / colocation site-selection teams asking "where can a 50–500 MW load energize within 24–36 months, and what's *really* sitting in front of me in this queue?"**

Differentiation comes from doing one thing no competitor does end-to-end:
- Convert the snapshot history into **outcome-labeled training data** (withdrawn / energized / stalled / transferred).
- Use it to publish **effective headroom** (P(actually-built) × MW), not the raw queued MW everyone else shows.
- Tie it to a **single demo-able artifact** — the "Site Power Brief" — that a stranger at a hyperscaler can receive in a cold email and immediately understand the value of.

The Site Power Brief is both the moat *and* the distribution motion. At zero users, you cannot build a moat in private — you need the artifact to be the thing you send to get your first conversations.

The existing `docs/strategic-feature-roadmap.md` (10-feature, 12-month doc) is sound long-term thinking but is too diffuse for a pre-revenue stage. This plan picks one wedge from it and goes deep.

---

## The Wedge: "Effective Headroom" + Site Power Brief

**Tagline:** *The only queue-intelligence product that tells you which projects in front of your site will actually get built.*

**Buyer:** Hyperscaler site-selection leads, colocation operators (Crusoe, Fermi, Exowatt, Switch, Vantage, QTS), and the consultants who advise them (RagingWire-type advisors, Newmark Power Advisory, Cushman datacenter teams).

**Why we can win this and others can't:**
- We already have multi-ISO snapshot history with field-level diffs — outcome labels are derivable from data we already store.
- We already have substation geometries (HIFLD), project geometries (PostGIS), and the headroom radius query primitive in `data.ts`.
- Competitors anchored in either market-data subscriptions (S&P, Enverus) or real-time grid status (GridStatus) don't have the snapshot-diff substrate to compute outcome probabilities.
- The artifact is share-link-shaped (already supported at `/share/headroom`) which means every brief generated is a viral surface.

---

## What competitors lack that we'll build

| Capability | GridStatus | Enverus | Paces | Nira | S&P | **GridPath after this batch** |
|---|---|---|---|---|---|---|
| Raw queue + map | yes | yes | yes | yes | yes | yes (already) |
| Field-level change history | partial | no | no | no | partial | **yes (already)** |
| Outcome labels on historical queue positions | no | no | no | no | no | **yes (new)** |
| Withdrawal-probability score with evidence | no | no | no | no | no | **yes (new)** |
| Effective headroom (P(built) × MW) | no | no | no | no | no | **yes (new)** |
| Substation-anchored (not radius-of-click) | no | no | no | partial | no | **yes (new)** |
| Orphan-capacity surfacing (dead-project IA reuse) | no | no | no | no | no | **yes (new)** |
| Shareable 1-page site brief | no | no | no | no | no | **yes (new)** |

---

## 4–6 Week Implementation Batch

### Week 1 — Outcome label backfill (foundation)

**Goal:** Every historical project gets a terminal label or "still-in-queue" status, derived from the snapshot history we already have.

- New migration: `outcome_labels` table with columns `(project_id, label_class, label_at, evidence_jsonb, derived_at)` where `label_class ∈ {energized, withdrawn, stalled_long, transferred_owner, downsized_major, in_queue}`.
- New ingestion module: `apps/ingestion/src/gridpath_ingestion/outcomes.py` — derives labels from `project_snapshots` + `project_status_changes` (no new external data needed initially). Reuse the existing event classifier patterns (already implementing phase_advanced/withdrawn/energized).
- Index by `label_class`, `label_at`, and `project_id` for fast feature-table joins later.

**Critical files:**
- New: `db/migrations/0XX_outcome_labels.sql`
- New: `apps/ingestion/src/gridpath_ingestion/outcomes.py`
- Reuse: snapshot + change-event queries already in `apps/ingestion/src/gridpath_ingestion/db.py`

### Week 2 — Withdrawal-probability score v0 (explainable heuristic)

**Goal:** Every active project gets a score `p_built ∈ [0,1]` plus an evidence list. Transparent heuristic only — no ML yet. The "evidence" must be UI-visible because the strategic roadmap rule "every score explainable with source-backed evidence" is the actual moat (not the score itself).

- New SQL view or materialized view `project_velocity_features`: age_in_queue_days, phase, mw_bucket, fuel_type, days_since_last_movement, sponsor_completion_rate, county_withdrawal_rate, similar_project_outcomes.
- New module: `apps/web/src/lib/scoring.ts` — pure function `scoreProject(features) → { p_built, p_withdrawn, p_stall, evidence: Evidence[] }`. Each evidence item has `{ factor, impact, source_query }` — readers can drill down.
- Surface on `/projects/[id]` and as a column in the dashboard table.

**Critical files:**
- New: `apps/web/src/lib/scoring.ts`
- New: `db/migrations/0XX_project_velocity_features.sql` (materialized view)
- Modify: `apps/web/src/components/dashboard.tsx` (add score column)
- Modify: `apps/web/src/app/(app)/projects/[id]/page.tsx` (add score card + evidence)

### Week 3 — Effective headroom + substation-anchored queries

**Goal:** Replace `computeHeadroomScore()`'s raw-queued-MW thresholds with `effective_queued_mw = Σ mw_requested × p_built`. Add a substation-anchored mode (you pick a substation, not a clicked point).

- Modify `computeHeadroomScore()` and `getHeadroomReport()` in `apps/web/src/lib/data.ts` (lines 973–1191): replace `mw_queued` aggregation with `mw_queued_effective` using the `p_built` join from Week 2. Keep `mw_queued_raw` as a secondary metric so the comparison is visible (critical for the demo — "here's what others would tell you vs what's actually real").
- Add `getHeadroomBySubstation(substationId, radiusMi)` — joins `substations` (HIFLD) with the effective-headroom query.
- Update `headroom-explorer.tsx` to show both raw and effective side-by-side, plus a substation picker.

**Critical files:**
- Modify: `apps/web/src/lib/data.ts` (`computeHeadroomScore` ll. 973–1001, `getHeadroomReport` ll. 1003–1191, `getHeadroomHeatmapProjects` ll. 1193–1222)
- Modify: `apps/web/src/components/headroom/headroom-explorer.tsx`
- Modify: `apps/web/src/app/(app)/substations/[id]/page.tsx` (add headroom panel)

### Week 4 — Orphan capacity layer

**Goal:** Surface "withdrawn or stalled-long projects within X miles of a substation ≥138kV" as **dormant IA-capacity opportunities** — i.e., interconnection studies have been done, capacity was planned, the project died. This is gold for hyperscaler siting and *no competitor surfaces it*.

- New query `getOrphanCapacityNearPoint(lat, lng, radiusMi)` in `apps/web/src/lib/data.ts`: joins `outcome_labels` (withdrawn/stalled_long, label_at within last 36 months) with nearest substation (≥138 kV from HIFLD `voltage_kv`).
- Add to headroom explorer sidebar as a "Orphan IA capacity" section.

**Critical files:**
- Modify: `apps/web/src/lib/data.ts`
- Modify: `apps/web/src/components/headroom/headroom-explorer.tsx`

### Week 5 — Site Power Brief (the artifact)

**Goal:** A shareable 1-page brief at `/brief/[token]` that any prospect can receive, no login required. This is the cold-email artifact.

- New route `apps/web/src/app/brief/[token]/page.tsx` (public, read-only).
- Brief contents (single scroll-page):
  1. Site location + radius (header map)
  2. Effective headroom score + raw vs effective comparison
  3. Top 5 projects ahead with `p_built` and 2-line "why this score" evidence
  4. Orphan IA capacity nearby (withdrawn/stalled list with `last_seen_phase` and HIFLD substation)
  5. Sponsor concentration of the queue ahead (top 3 sponsors by MW)
  6. Three nearest ≥138 kV substations with voltage + saturation %
  7. Confidence band + data sources / "last updated"
- Generator UI inside `/headroom`: "Generate shareable brief" button → creates a token-keyed snapshot row → produces shareable URL.
- New migration: `site_briefs` table `(id, token, params_jsonb, snapshot_jsonb, created_at, created_by_user_id)` — the brief content is immutable once generated (so the link doesn't change when the queue changes).
- Add an OG-image at `/brief/[token]/opengraph-image.tsx` so the link previews well in email/Slack.

**Critical files:**
- New: `db/migrations/0XX_site_briefs.sql`
- New: `apps/web/src/app/brief/[token]/page.tsx`
- New: `apps/web/src/app/brief/[token]/opengraph-image.tsx`
- New: `apps/web/src/lib/brief.ts` (snapshot generator)
- Modify: `apps/web/src/components/headroom/headroom-explorer.tsx` (add "Generate brief" CTA)

### Week 6 — Calibration + distribution motion

**Goal:** Make sure the scores aren't embarrassing on inspection, and make the artifact easy to send.

- **Calibration check:** Holdout `outcome_labels` from 2024–2025, re-score retroactively, plot calibration curve. Iterate the heuristic weights once. Document the calibration in a `/docs/scoring-methodology.md` page that the brief links to (this is what enterprise buyers will scrutinize).
- **Public lead-capture surface:** A `/lookup` page where anyone can drop a lat/lng or address and get a free, capability-limited brief preview (no orphan layer, no top-5 evidence). Email gate to unlock the full brief. This is the lead-gen funnel that lets you fill the first 20 hyperscaler conversations.
- **Cold-outbound script + targeting:** Outside the codebase — list of 30 datacenter site-selection leads (Crusoe, Fermi, Vantage, QTS, Switch, Aligned, Compass, Stack, Equinix, EdgeConneX, Lambda, CoreWeave, Nebius, hyperscaler real-estate leads) — and send them a custom-generated brief for a site they're rumored to be evaluating.

**Critical files:**
- New: `docs/scoring-methodology.md`
- New: `apps/web/src/app/lookup/page.tsx`
- Modify: scoring weights in `apps/web/src/lib/scoring.ts` after calibration

---

## Things to *not* build during this batch

Explicitly defer (good ideas, wrong moment):

- Owner/company normalization graph — useful but the v0 score can use raw owner string + a small alias map. Full graph is Phase 2.
- Weekly market briefs — these create retention for *existing* users; we don't have users yet.
- Enterprise API — premature; you cannot sell an API to people who don't already trust the data.
- Diligence workspaces — multi-user features for a zero-user product.
- More ISOs (NYISO, ISO-NE) — coverage is fine for the hyperscaler buyer who mostly cares about ERCOT, PJM, MISO right now. SPP just landed.
- Transmission line layer — visually appealing but the actual analytical lift comes from outcome labels, not from drawing 230 kV lines on a map.
- Calibrated ML model for `p_built` — premature; explainable heuristic with evidence beats a black-box model at this stage and is more defensible against expert critique.

---

## Verification

End-to-end test the wedge by Week 6:

1. **Outcome labels backfill correctness:** Spot-check 20 known-withdrawn ERCOT projects and 20 known-energized ones — confirm they get the right `label_class`. SQL: `SELECT label_class, COUNT(*) FROM outcome_labels GROUP BY label_class;` should show a sane distribution (energized + withdrawn each in the hundreds across ERCOT history).
2. **Score sanity:** Pick 10 projects across the phase spectrum — confirm `p_built` is monotonically higher for later-phase / older-IA-signed projects.
3. **Effective vs raw headroom delta:** For ERCOT Travis County (saturated), confirm `mw_queued_effective` is substantially lower than `mw_queued_raw` (the demo punchline).
4. **Orphan layer:** Confirm there are dozens of withdrawn ≥100 MW projects near ≥138 kV substations in ERCOT — that's the supply for the orphan opportunity feature.
5. **Brief artifact:** Generate a brief for a real rumored hyperscaler site (e.g., Abilene TX area), share the URL, open in an incognito window, share it in Slack and check OG preview.
6. **End-to-end funnel:** Anonymous user lands on `/lookup`, enters address, gets preview, drops email, receives full brief link, brief loads without auth.
7. **Calibration document:** `/docs/scoring-methodology.md` exists, is linked from every brief, and would survive a critical read from a power-industry expert.

---

## Strategic positioning summary (for cold outreach)

> "GridPath is the only interconnection-queue product that tells you, for any potential datacenter site, which projects ahead of you in the queue will *actually* get built — based on outcome-labeled historical queue movement across ERCOT, CAISO, PJM, MISO, and SPP. Every score is explainable, sourced, and ties to a 1-page shareable site brief."

The above is the elevator pitch this batch is designed to make defensibly true.
