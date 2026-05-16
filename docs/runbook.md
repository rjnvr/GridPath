# GridPath Runbook

## Failed ERCOT Snapshot

1. Open the failed GitHub Actions run and inspect the structured JSON log.
2. If the parser reports missing columns, ERCOT likely changed the report schema. Update `EXPECTED_COLUMNS` and parser mappings intentionally, then add or update tests.
3. Rerun the workflow manually after fixing the issue.
4. Check `db/queries/freshness_check.sql` after the rerun.

## Snapshot Diff Review

During the first month, run `db/queries/todays_changes.sql` daily to validate that change tracking is producing plausible diffs.

## Backups

Verify Neon backup and point-in-time restore retention for the active plan before depending on production snapshots as the system of record. Document the selected plan, retention window, and restore procedure here once the Neon project exists.
