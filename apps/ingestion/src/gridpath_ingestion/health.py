from __future__ import annotations

import argparse
import json
import os
import sys

import psycopg


def check_ingestion_health(database_url: str, max_age_hours: int = 25) -> dict:
    isos = ["ERCOT", "CAISO"]
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        snapshot_rows = cursor.execute(
            """
            select
              p.iso,
              max(s.captured_at) as latest_snapshot_at,
              count(*) filter (
                where s.captured_at >= now() - make_interval(hours => %s)
              ) as fresh_rows
            from projects p
            left join project_snapshots s on s.project_id = p.id
            where p.iso = any(%s)
            group by p.iso
            """,
            (max_age_hours, isos),
        ).fetchall()
        report_rows = cursor.execute(
            """
            select
              iso,
              max(completed_at) filter (where status = 'success') as latest_success_at,
              count(*) filter (
                where status = 'success'
                  and completed_at >= now() - make_interval(hours => %s)
              ) as fresh_successes
            from source_reports
            where iso = any(%s)
            group by iso
            """,
            (max_age_hours, isos),
        ).fetchall()

    snapshots = {
        row[0]: {
            "latest_snapshot_at": row[1].isoformat() if row[1] else None,
            "fresh_rows": int(row[2] or 0),
        }
        for row in snapshot_rows
    }
    reports = {
        row[0]: {
            "latest_success_at": row[1].isoformat() if row[1] else None,
            "fresh_successes": int(row[2] or 0),
        }
        for row in report_rows
    }
    missing = [
        iso
        for iso in isos
        if snapshots.get(iso, {}).get("fresh_rows", 0) == 0
        or reports.get(iso, {}).get("fresh_successes", 0) == 0
    ]
    return {
        "ok": not missing,
        "max_age_hours": max_age_hours,
        "missing_fresh_isos": missing,
        "snapshots": snapshots,
        "source_reports": reports,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check GridPath ingestion freshness.")
    parser.add_argument("--max-age-hours", type=int, default=25)
    args = parser.parse_args(argv)

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")

    result = check_ingestion_health(database_url, args.max_age_hours)
    print(json.dumps(result, sort_keys=True))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
