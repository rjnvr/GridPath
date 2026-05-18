# GridPath Runbook

## Failed Queue Snapshot

1. Open the failed GitHub Actions run and inspect the structured JSON log.
2. If the parser reports missing columns, the ISO likely changed the report schema. Update `EXPECTED_COLUMNS` and parser mappings intentionally, then add or update tests.
3. Rerun the workflow manually after fixing the issue.
4. Check `db/queries/freshness_check.sql` after the rerun.

## ERCOT Backfill

1. Run `python -m gridpath_ingestion.ercot --backfill` from `apps/ingestion`.
2. The command processes official ERCOT GIS reports oldest-to-newest and skips reports already marked successful in `source_reports`.
3. Use `--limit` for a smoke test and `--force` only when repairing a bad source report ingestion.
4. Review `/health` for latest successful source reports and recent failures.

## Snapshot Diff Review

During the first month, run `db/queries/todays_changes.sql` daily to validate that classified queue events are plausible.

## Backups

Verify Neon backup and point-in-time restore retention for the active plan before depending on production snapshots as the system of record. Document the selected plan, retention window, and restore procedure here once the Neon project exists.
