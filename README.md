# GridPath

GridPath is an ERCOT/CAISO-first interconnection queue intelligence app. It stores normalized queue records in Neon Postgres with PostGIS, tracks source reports and snapshots, classifies queue-change events, and renders the latest data in a desktop-focused Next.js dashboard.

## Structure

- `apps/web` - Next.js App Router dashboard.
- `apps/ingestion` - Python ERCOT and HIFLD ingestion tooling.
- `packages/shared` - shared TypeScript types.
- `db/migrations` - SQL migrations for Neon/Postgres.
- `db/queries` - operational SQL checks.

## Setup

1. Copy `.env.example` to `.env.local` for the web app and to your shell environment for ingestion.
2. Create a Neon database and enable PostGIS by running the initial migration:

   ```bash
   npm run migrate
   ```

3. Install dependencies:

   ```bash
   npm install
   cd apps/ingestion && python -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
   ```

## Manual ERCOT Ingestion

Run against a local Excel file:

```bash
cd apps/ingestion
python -m gridpath_ingestion.ercot --file path/to/ercot.xlsx
```

Run by downloading from `ERCOT_GIS_URL`:

```bash
cd apps/ingestion
ERCOT_GIS_URL="https://example.com/report.xlsx" python -m gridpath_ingestion.ercot
```

If `ERCOT_GIS_URL` is omitted, the script discovers the latest public GIS workbook from ERCOT's GIS Report data product.

The ingestion job is idempotent for `projects`, writes snapshots for every parsed project, and records field-level changes in `project_status_changes`.

Backfill official ERCOT GIS reports oldest-to-newest:

```bash
cd apps/ingestion
python -m gridpath_ingestion.ercot --backfill
```

Backfill skips source reports already marked successful. Use `--force` only for manual repair.

## Manual CAISO Ingestion

Download the CAISO Public Queue Report, then run:

```bash
cd apps/ingestion
python -m gridpath_ingestion.caiso --file ~/Downloads/publicqueuereport.xlsx
```

CAISO rows are stored with `iso = 'CAISO'` in the same Neon database and appear in the dashboard through the ISO filter.

If no file or `CAISO_QUEUE_URL` is provided, the script discovers `publicqueuereport.xlsx` from the CAISO Public Queue Report library page.

## Outcome Labels Backfill

Derive terminal/signal labels (energized, withdrawn, stalled_long, transferred_owner, downsized_major, in_queue) for every project from snapshot history. Foundation for the withdrawal-probability scoring layer.

```bash
cd apps/ingestion
python -m gridpath_ingestion.outcomes
```

The backfill is idempotent — it truncates and rebuilds `outcome_labels` from `projects` + `queue_events` inside a single transaction.

## Data Health

Visit `/health` in the web app to inspect latest snapshot time by ISO, source report status, event volume, project counts, phase/fuel breakdowns, and recent tracked changes.

## Web App

```bash
npm run dev
```

The app queries Neon only from server-side Next.js code. Database credentials are never sent to the browser.

## Operations

- Daily ERCOT and CAISO ingestion is configured in `.github/workflows/ercot-snapshot.yml`.
- Freshness check SQL lives in `db/queries/freshness_check.sql`.
- First-month change review SQL lives in `db/queries/todays_changes.sql`.
- Verify Neon backup/PITR retention for the selected plan before relying on production snapshots as the long-term asset.

## Known Limitations

- Project locations default to county centroids with low-confidence provenance; exact addresses require permit, parcel, or other external enrichment.
- Desktop-first UI.
- No billing, forecasting, user-facing alert emails, or transmission lines yet.
