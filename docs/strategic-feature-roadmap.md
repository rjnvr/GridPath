# GridPath Strategic Feature Roadmap

Last updated: 2026-05-18

## Context

GridPath is currently an ERCOT/CAISO-first interconnection queue intelligence app with normalized project records, daily snapshots, field-level change tracking, map/table exploration, auth, and watchlists.

GridCARE appears to be moving upmarket around "power acceleration" for AI/data-center loads. Based on its public site and recent funding coverage, its Energize platform emphasizes site opportunity discovery, flexible interconnection, utility validation, and real-time operations for large loads. GridPath should not try to copy that full-stack utility/data-center operating model first. The stronger wedge is to become the best independent intelligence layer for interconnection queues, project movement, constraints, counterparties, and site risk.

## Strategic Positioning

GridPath should become the system of record for "what is actually happening in the queue" across ISOs, utilities, developers, land teams, financiers, and large-load buyers.

The product should answer questions that are painful, frequent, and expensive:

- Which projects are likely to move, stall, downsize, withdraw, or become acquisition targets?
- Which developers, counties, substations, and queue clusters are gaining or losing momentum?
- Where is queue congestion creating opportunity for buyers, sellers, landowners, or large-load customers?
- What changed this week that affects my portfolio, site search, or counterparty strategy?
- What evidence supports a siting, acquisition, financing, or development decision?

## Differentiation From GridCARE

GridCARE's public story is centered on accelerating power delivery for AI infrastructure by identifying and operating latent grid capacity with utilities and data centers. GridPath can be differentiated by focusing on the market intelligence layer around generation, storage, load growth, queues, and asset-level development signals.

The distinction:

- GridCARE: "Where can large AI/data-center loads get power faster, and how can flexibility unlock it?"
- GridPath: "What is happening across the interconnection market, who is moving, where is risk building, and which projects/sites are mispriced?"

This makes GridPath complementary rather than purely competitive. If executed well, GridPath could become valuable to GridCARE as a proprietary data feed, market map, diligence product, lead source, or acquisition target.

## Highest-Leverage Feature Bets

### 1. Queue Change Intelligence

Turn raw field-level changes into ranked, human-readable market events.

Examples:

- "Project advanced from screening to study."
- "MW reduced by 42%, likely indicating scope change or constraint pressure."
- "Owner changed from developer LLC to strategic buyer."
- "Withdrawn project frees apparent queue position near constrained node."
- "Cluster of storage projects delayed in same county."

Implementation:

- Add an `events` table derived from `project_status_changes`.
- Create event classifiers for phase movement, withdrawal, MW change, owner change, date change, and new project entry.
- Add severity and business-impact scores.
- Display an event feed in the dashboard and project detail pages.
- Send watchlist email alerts for high-impact events.

Why it matters:

Queue data is public, but interpretation is not. This is a fast path from "database" to "workflow product."

### 2. Project Detail Pages With Timeline History

Every queue project should have a durable page that shows the full story of that project.

Core elements:

- Current project profile.
- Timeline of all observed changes.
- Original vs current MW, fuel, owner, milestone dates, and phase.
- Nearby substations and neighboring projects.
- Similar historical projects.
- Exportable diligence summary.

Implementation:

- Add `/projects/[id]`.
- Query snapshots and changes by project.
- Add simple timeline visualization.
- Add stable shareable URLs.
- Later, support notes, attachments, and team comments.

Why it matters:

Enterprise users do not want only filters. They need durable records they can reference in internal memos, investment committee notes, diligence calls, and weekly reviews.

### 3. Owner, Sponsor, and Counterparty Graph

Normalize owner names and expose who is building what.

Examples:

- Parent company grouping across LLC names.
- Developer activity by ISO, county, fuel, and phase.
- Ownership transfers and project sale signals.
- Developer completion/withdrawal history.
- "Show me every project connected to this sponsor."

Implementation:

- Add `companies`, `project_companies`, and `company_aliases`.
- Start with deterministic normalization rules, then add manual curation.
- Track owner changes as first-class events.
- Add company profile pages.
- Add CSV/API export for enterprise users.

Why it matters:

Sponsor intelligence is useful to developers, investors, offtakers, data-center teams, brokers, and companies like GridCARE looking for demand and partnership signals.

### 4. Queue Velocity And Probability Scores

Predict the likelihood that a project reaches signed interconnection agreement, energization, withdrawal, or major delay.

Initial scores can be explainable heuristics:

- Age in queue.
- Phase.
- MW size.
- Fuel type.
- County/substation congestion.
- Sponsor history.
- Similar project outcomes.
- Recent date movement.
- Repeated milestone slippage.

Implementation:

- Build a feature table from snapshots.
- Define baseline labels from historical statuses.
- Start with transparent scoring, then graduate to calibrated models when enough history exists.
- Show "why this score" evidence, not just a black-box number.

Why it matters:

Users will pay for predictions if the product also shows the evidence. This is a clear monetization path and a defensible data moat.

### 5. Site-To-Queue Risk Explorer

Let users evaluate a site or county against nearby queue activity and grid-adjacent signals.

Examples:

- Upload or click a parcel/location.
- Show nearby substations, active queued MW, withdrawn MW, fuel mix, project velocity, and saturation.
- Compare counties or substation areas.
- Generate a "site risk brief."

Implementation:

- Add a location search and point-radius query using PostGIS.
- Ingest more grid layers: substations already exist; add transmission lines, balancing authority boundaries, load zones, and county/parcel metadata where licensing allows.
- Add scoring by radius and voltage band.
- Later, support parcel imports and team site lists.

Why it matters:

This bridges queue intelligence into siting and land workflows. It is also strategically adjacent to GridCARE's "Power Finder" type of product without requiring GridPath to operate flexible load.

### 6. Constraint And Upgrade Atlas

Create a map of where queue pressure appears to be creating network upgrade risk.

Possible signals:

- High queued MW near limited substations.
- Repeated withdrawals or MW reductions in a geographic cluster.
- Known transmission constraints from ISO planning documents.
- Upgrade mentions extracted from public studies, meeting notes, or filings.
- Congestion and curtailment indicators where available.

Implementation:

- Ingest ISO planning reports, public interconnection studies where available, transmission planning docs, and congestion datasets.
- Store extracted references in `grid_constraints`.
- Link constraints to counties, substations, lines, and projects.
- Add confidence levels and source links.

Why it matters:

The valuable question is not only "what is in the queue?" It is "what does the queue imply about physical and procedural bottlenecks?"

### 7. Weekly Market Briefs

Generate concise, trusted weekly summaries by ISO, region, fuel type, and customer watchlist.

Examples:

- "Top 20 ERCOT queue movements this week."
- "Storage projects advanced faster than solar in CAISO."
- "Three large withdrawals near the same county."
- "New large-load or data-center-relevant project activity."

Implementation:

- Build SQL materialized views for weekly deltas.
- Use deterministic templates first.
- Add analyst-written or AI-assisted commentary later.
- Email briefs and archive them as shareable pages.

Why it matters:

Briefs create retention. They also become a lightweight sales motion: users forward them internally.

### 8. Enterprise API And Data Feed

Expose GridPath's normalized queue, event, company, and score layers as an enterprise data product.

Implementation:

- Add API keys and scoped endpoints.
- Provide project, event, company, and snapshot endpoints.
- Include webhooks for watchlist events.
- Offer S3/CSV deliveries for enterprise accounts.
- Track data lineage and source timestamps.

Why it matters:

Acquirers value data infrastructure they can plug into existing workflows. API revenue also validates that GridPath is more than a UI.

### 9. Diligence Workspaces

Let teams create shared workspaces for a portfolio, acquisition screen, or market thesis.

Core features:

- Saved project sets.
- Notes and tags.
- Internal status fields.
- Exportable investment memo.
- Watchlist alerts scoped to the workspace.
- Project comparison tables.

Implementation:

- Extend watchlists into `workspaces`, `workspace_projects`, `workspace_notes`, and `workspace_tags`.
- Add role-based access controls.
- Add export to PDF/CSV.

Why it matters:

This makes GridPath sticky for teams, not just individual analysts.

### 10. Large-Load And Data-Center Lens

Add a dedicated mode for users looking for power availability and interconnection risk for large loads.

Features:

- Site search by county/load zone/substation radius.
- Nearby generation/storage queue activity.
- Withdrawn or stalled project opportunities.
- Available-power proxy score.
- Flexible-load opportunity indicators.
- Utility territory and economic development overlays.

Implementation:

- Add `load_opportunity_scores` derived from queue pressure, nearby infrastructure, transmission data, congestion data, and public economic-development/site datasets.
- Separate confidence-backed public-data scores from any private utility-validated claims.
- Add data-center-specific report exports.

Why it matters:

This is the most direct path toward GridCARE relevance. It gives GridPath an AI/data-center story while staying anchored in public intelligence and diligence.

## Acquisition-Relevant Moats

GridPath becomes more attractive to a company like GridCARE if it owns assets that are slow to recreate:

- Multi-ISO historical queue snapshots with field-level diffs.
- Normalized project/company identity graph.
- Outcome labels for completed, withdrawn, delayed, and transferred projects.
- Proprietary event taxonomy and scored movement intelligence.
- Watchlist/user behavior showing which projects and regions sophisticated users monitor.
- Site-to-grid risk scoring and explainable evidence trails.
- Enterprise data contracts and API integrations.
- Analyst trust from consistently accurate, sourced briefings.

The acquisition story should be:

"GridPath is the interconnection market intelligence layer that helps energy, data-center, and infrastructure teams understand project movement, grid-adjacent opportunity, and queue risk. GridCARE could use it as a proprietary data layer for siting, validation, business development, and market expansion."

## Recommended Build Sequence

### Phase 1: Turn Data Into Workflow

Time horizon: 0-8 weeks.

Build:

- Project detail pages.
- Event feed derived from change tracking.
- Watchlist alert emails.
- Better owner search and filters.
- CSV export.
- Weekly ERCOT/CAISO market brief.

Goal:

Move from "dashboard" to "daily workflow."

### Phase 2: Build Proprietary Intelligence

Time horizon: 2-4 months.

Build:

- Owner/company normalization.
- Company profile pages.
- Queue velocity scoring.
- Similar project comps.
- County/substation area pages.
- Historical outcome datasets.
- First API endpoints.

Goal:

Create data products competitors cannot copy quickly from a public Excel download.

### Phase 3: Expand Coverage And Siting Use Cases

Time horizon: 4-8 months.

Build:

- More ISOs: PJM, MISO, SPP, NYISO, ISO-NE, WECC utility queues where practical.
- Transmission line layers.
- Utility territory overlays.
- Site-to-queue risk explorer.
- Constraint/upgrade atlas.
- Diligence workspaces.

Goal:

Become useful for national developers, investors, land teams, and large-load siting teams.

### Phase 4: Enterprise And Strategic Buyer Readiness

Time horizon: 8-12 months.

Build:

- Enterprise API.
- Webhooks.
- Data lineage and quality dashboard.
- SOC2-ready audit patterns.
- Admin tools for curation.
- Customer-specific briefings.
- Data export packages for strategic partners.

Goal:

Make GridPath easy to buy, integrate, or acquire.

## Pricing Implications

Potential packaging:

- Free: delayed public dashboard, limited filters, no history depth.
- Pro: live dashboard, project pages, saved watchlists, weekly briefs.
- Team: shared workspaces, alerts, exports, owner/company profiles, advanced filters.
- Enterprise: API, webhooks, bulk data, custom coverage, diligence exports, account support.
- Strategic data license: full historical snapshots, normalized entities, event feed, scoring layer.

## Near-Term Product Requirements

The next concrete implementation batch should be:

1. Add `events` derived from `project_status_changes`.
2. Add project detail pages.
3. Add watchlist email alerts for events.
4. Add company alias normalization.
5. Add weekly brief generation.
6. Add CSV export.

These are close to the existing codebase and create immediate user value without needing complex power-flow modeling.

## Risks And Guardrails

- Do not overclaim physical grid capacity from public data alone.
- Separate observed facts, inferred signals, and predictions in the UI.
- Keep every score explainable with source-backed evidence.
- Avoid becoming a generic map product; the core asset is time-series interconnection intelligence.
- Prioritize data quality, lineage, and freshness before adding opaque AI features.
- Build with enterprise diligence workflows in mind from the start.

## Sources Reviewed

- GridCARE public site: https://www.gridcare.ai/
- GridCARE and National Grid collaboration announcement: https://www.gridcare.ai/post/gridcare-and-national-grid-collaborate-to-unlock-grid-capacity-for-infrastructure
- PGE and GridCARE announcement: https://www.gridcare.ai/post/pge-and-gridcare-accelerate-hundreds-of-megawatts
- Latitude Media coverage of GridCARE Series A: https://www.latitudemedia.com/news/gridcare-raises-oversubscribed-64-million-series-a/
- Morningstar / Business Wire Series A release: https://www.morningstar.com/news/business-wire/20260514546216/gridcare-raises-64-million-series-a-from-leading-ai-and-energy-investors-to-create-a-new-category-power-acceleration-for-ai
