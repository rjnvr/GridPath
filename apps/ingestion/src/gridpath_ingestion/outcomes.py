"""Outcome-label backfill.

Derives terminal-and-signal labels for every project from the existing
snapshot history (projects + queue_events). Foundation for the
withdrawal-probability scoring layer.

Label classes:
  energized          terminal; project reached energized status
  withdrawn          terminal; project was withdrawn
  stalled_long      signal;   IA signed >18 months ago, not energized/withdrawn
  transferred_owner  signal;   owner_changed event observed
  downsized_major    signal;   MW decreased by >=100 MW or >=20%
  in_queue           default;  no terminal label observed

The function is idempotent via a full rebuild inside a single transaction.
"""

from __future__ import annotations

import os

import psycopg
from psycopg.errors import UndefinedTable

STALL_THRESHOLD_MONTHS = 18


def backfill_outcome_labels(database_url: str) -> dict[str, int]:
    """Rebuild outcome_labels from queue_events + projects.

    Returns a stats dict with counts per label_class plus a total.
    """
    stats: dict[str, int] = {
        "energized": 0,
        "withdrawn": 0,
        "stalled_long": 0,
        "transferred_owner": 0,
        "downsized_major": 0,
        "in_queue": 0,
        "total": 0,
    }

    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        try:
            cursor.execute("truncate table outcome_labels")
        except UndefinedTable as exc:
            raise RuntimeError(
                "outcome_labels table is missing. Run `npm run migrate` from the repo "
                "root with DIRECT_DATABASE_URL set before backfilling."
            ) from exc

        stats["energized"] = _insert_energized(cursor)
        stats["withdrawn"] = _insert_withdrawn(cursor)
        stats["transferred_owner"] = _insert_transferred_owner(cursor)
        stats["downsized_major"] = _insert_downsized_major(cursor)
        stats["stalled_long"] = _insert_stalled_long(cursor)
        stats["in_queue"] = _insert_in_queue(cursor)

    stats["total"] = sum(v for k, v in stats.items() if k != "total")
    return stats


def _rowcount(cursor: psycopg.Cursor) -> int:
    return cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else 0


def _insert_energized(cursor: psycopg.Cursor) -> int:
    cursor.execute(
        """
        insert into outcome_labels (project_id, label_class, label_at, evidence, source)
        select
          candidate.project_id,
          'energized',
          candidate.label_at,
          jsonb_build_object(
            'energized_date', p.energized_date,
            'event_id', candidate.event_id,
            'derivation', candidate.derivation
          ),
          'snapshot_history'
        from (
          select distinct on (p.id)
            p.id as project_id,
            coalesce(
              p.energized_date::timestamptz,
              qe.event_at
            ) as label_at,
            qe.id as event_id,
            case
              when p.energized_date is not null then 'project.energized_date'
              else 'queue_event.energized'
            end as derivation
          from projects p
          left join queue_events qe
            on qe.project_id = p.id and qe.event_type = 'energized'
          where p.energized_date is not null or qe.id is not null
          order by p.id, qe.event_at asc nulls last
        ) candidate
        join projects p on p.id = candidate.project_id
        on conflict (project_id, label_class, label_at) do nothing
        """
    )
    return _rowcount(cursor)


def _insert_withdrawn(cursor: psycopg.Cursor) -> int:
    cursor.execute(
        """
        insert into outcome_labels (project_id, label_class, label_at, evidence, source)
        select
          candidate.project_id,
          'withdrawn',
          candidate.label_at,
          jsonb_build_object(
            'withdrawn_date', p.withdrawn_date,
            'event_id', candidate.event_id,
            'derivation', candidate.derivation
          ),
          'snapshot_history'
        from (
          select distinct on (p.id)
            p.id as project_id,
            coalesce(
              p.withdrawn_date::timestamptz,
              qe.event_at
            ) as label_at,
            qe.id as event_id,
            case
              when p.withdrawn_date is not null then 'project.withdrawn_date'
              else 'queue_event.withdrawn'
            end as derivation
          from projects p
          left join queue_events qe
            on qe.project_id = p.id and qe.event_type = 'withdrawn'
          where p.withdrawn_date is not null or qe.id is not null
          order by p.id, qe.event_at asc nulls last
        ) candidate
        join projects p on p.id = candidate.project_id
        on conflict (project_id, label_class, label_at) do nothing
        """
    )
    return _rowcount(cursor)


def _insert_transferred_owner(cursor: psycopg.Cursor) -> int:
    cursor.execute(
        """
        insert into outcome_labels (project_id, label_class, label_at, evidence, source)
        select
          qe.project_id,
          'transferred_owner',
          qe.event_at,
          jsonb_build_object(
            'event_id', qe.id,
            'old_owner', qe.old_value,
            'new_owner', qe.new_value
          ),
          'snapshot_history'
        from queue_events qe
        where qe.event_type = 'owner_changed'
        on conflict (project_id, label_class, label_at) do nothing
        """
    )
    return _rowcount(cursor)


def _insert_downsized_major(cursor: psycopg.Cursor) -> int:
    cursor.execute(
        """
        insert into outcome_labels (project_id, label_class, label_at, evidence, source)
        select
          qe.project_id,
          'downsized_major',
          qe.event_at,
          jsonb_build_object(
            'event_id', qe.id,
            'old_mw', qe.old_value,
            'new_mw', qe.new_value,
            'delta_mw', qe.delta_mw,
            'severity', qe.severity
          ),
          'snapshot_history'
        from queue_events qe
        where qe.event_type = 'mw_decrease' and qe.severity = 'important'
        on conflict (project_id, label_class, label_at) do nothing
        """
    )
    return _rowcount(cursor)


def _insert_stalled_long(cursor: psycopg.Cursor) -> int:
    cursor.execute(
        """
        insert into outcome_labels (project_id, label_class, label_at, evidence, source)
        select
          p.id,
          'stalled_long',
          (p.ia_signed_date + make_interval(months => %s))::timestamptz,
          jsonb_build_object(
            'ia_signed_date', p.ia_signed_date,
            'threshold_months', %s,
            'derivation', 'ia_signed_date + threshold without energization or withdrawal'
          ),
          'snapshot_history'
        from projects p
        where p.ia_signed_date is not null
          and p.ia_signed_date < (current_date - make_interval(months => %s))
          and p.energized_date is null
          and p.withdrawn_date is null
          and not exists (
            select 1 from outcome_labels ol
            where ol.project_id = p.id
              and ol.label_class in ('energized', 'withdrawn')
          )
        on conflict (project_id, label_class, label_at) do nothing
        """,
        (STALL_THRESHOLD_MONTHS, STALL_THRESHOLD_MONTHS, STALL_THRESHOLD_MONTHS),
    )
    return _rowcount(cursor)


def _insert_in_queue(cursor: psycopg.Cursor) -> int:
    cursor.execute(
        """
        insert into outcome_labels (project_id, label_class, label_at, evidence, source)
        select
          p.id,
          'in_queue',
          coalesce(p.first_seen_at, now()),
          jsonb_build_object(
            'current_phase', p.current_phase,
            'current_status', p.current_status,
            'derivation', 'no terminal label observed'
          ),
          'snapshot_history'
        from projects p
        where not exists (
          select 1 from outcome_labels ol
          where ol.project_id = p.id
            and ol.label_class in ('energized', 'withdrawn')
        )
        on conflict (project_id, label_class, label_at) do nothing
        """
    )
    return _rowcount(cursor)


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_DATABASE_URL")
    if not url:
        raise SystemExit(
            "Set DATABASE_URL or DIRECT_DATABASE_URL before running the outcomes backfill."
        )
    return url


def main() -> None:
    stats = backfill_outcome_labels(_database_url())
    print("outcome_labels backfill complete")
    for key in (
        "energized",
        "withdrawn",
        "stalled_long",
        "transferred_owner",
        "downsized_major",
        "in_queue",
        "total",
    ):
        print(f"  {key}: {stats.get(key, 0)}")


if __name__ == "__main__":
    main()
