from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import psycopg
from psycopg.errors import UndefinedTable

from gridpath_ingestion.events import classify_change, classify_new_project, stable_event_key
from gridpath_ingestion.models import QueueProject, SourceReport

TRACKED_FIELDS = [
    "project_name",
    "mw_requested",
    "fuel_type",
    "county",
    "lat",
    "lng",
    "location_source",
    "location_confidence",
    "address",
    "point_of_interconnection",
    "location_notes",
    "current_phase",
    "current_status",
    "filed_date",
    "ia_signed_date",
    "energized_date",
    "withdrawn_date",
    "owner_company",
]

LOCATION_PROVENANCE_COLUMNS = {
    "location_source": "text",
    "location_confidence": "text",
    "address": "text",
    "point_of_interconnection": "text",
    "location_notes": "text",
}


def value_for_sql(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def comparable(value: Any) -> str | None:
    sql_value = value_for_sql(value)
    return None if sql_value is None else str(sql_value)


def _event_date_key(value: date | datetime) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()


def _source_report_values(source_report: SourceReport) -> dict[str, Any]:
    return {
        "iso": source_report.iso,
        "source_url": source_report.source_url,
        "source_name": source_report.source_name,
        "published_at": source_report.published_at,
        "report_date": source_report.report_date,
    }


def source_report_succeeded(database_url: str, iso: str, source_url: str) -> bool:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        row = cursor.execute(
            """
            select status
            from source_reports
            where iso = %s and source_url = %s
            limit 1
            """,
            (iso, source_url),
        ).fetchone()
    return bool(row and row[0] == "success")


def successful_source_report_urls(database_url: str, iso: str) -> set[str]:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        try:
            rows = cursor.execute(
                """
                select source_url
                from source_reports
                where iso = %s and status = 'success'
                """,
                (iso,),
            ).fetchall()
        except UndefinedTable as exc:
            raise RuntimeError(
                "Queue Change Intelligence tables are missing. Run `npm run migrate` "
                "from the repo root with DIRECT_DATABASE_URL set before backfilling."
            ) from exc
    return {str(row[0]) for row in rows}


def project_count_for_iso(database_url: str, iso: str) -> int:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        try:
            row = cursor.execute(
                "select count(*) from projects where iso = %s",
                (iso,),
            ).fetchone()
        except UndefinedTable as exc:
            raise RuntimeError(
                "Project tables are missing. Run `npm run migrate` from the repo root "
                "with DIRECT_DATABASE_URL set before ingesting."
            ) from exc
    return int(row[0] if row else 0)


def record_source_report_failure(
    database_url: str,
    source_report: SourceReport,
    error_message: str,
) -> None:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            insert into source_reports (
              iso, source_url, source_name, published_at, report_date, status,
              error_message, started_at, completed_at, updated_at
            )
            values (
              %(iso)s, %(source_url)s, %(source_name)s, %(published_at)s,
              %(report_date)s, 'failed', %(error_message)s, now(), now(), now()
            )
            on conflict (iso, source_url) do update set
              source_name = excluded.source_name,
              published_at = excluded.published_at,
              report_date = excluded.report_date,
              status = 'failed',
              error_message = excluded.error_message,
              completed_at = now(),
              updated_at = now()
            """,
            {**_source_report_values(source_report), "error_message": error_message[:4000]},
        )


def _begin_source_report(
    cursor: psycopg.Cursor,
    source_report: SourceReport,
    skip_successful: bool,
    force: bool,
) -> tuple[str | None, bool]:
    if skip_successful and not force:
        existing = cursor.execute(
            """
            select id
            from source_reports
            where iso = %s and source_url = %s and status = 'success'
            limit 1
            """,
            (source_report.iso, source_report.source_url),
        ).fetchone()
        if existing:
            return str(existing[0]), True

    cursor.execute(
        """
        insert into source_reports (
          iso, source_url, source_name, published_at, report_date, status,
          error_message, started_at, completed_at, updated_at
        )
        values (
          %(iso)s, %(source_url)s, %(source_name)s, %(published_at)s,
          %(report_date)s, 'running', null, now(), null, now()
        )
        on conflict (iso, source_url) do update set
          source_name = excluded.source_name,
          published_at = excluded.published_at,
          report_date = excluded.report_date,
          status = 'running',
          error_message = null,
          started_at = now(),
          completed_at = null,
          updated_at = now()
        returning id
        """,
        _source_report_values(source_report),
    )
    return str(cursor.fetchone()[0]), False


def _complete_source_report(
    cursor: psycopg.Cursor,
    source_report_id: str,
    stats: dict[str, int],
) -> None:
    cursor.execute(
        """
        update source_reports
        set status = 'success',
            stats = %s,
            error_message = null,
            completed_at = now(),
            updated_at = now()
        where id = %s
        """,
        (json.dumps(stats, default=str), source_report_id),
    )


def _ensure_project_location_columns(cursor: psycopg.Cursor) -> None:
    """Keep ingestion compatible with databases created before provenance columns."""
    for column, column_type in LOCATION_PROVENANCE_COLUMNS.items():
        cursor.execute(f"alter table projects add column if not exists {column} {column_type}")


def _insert_event(
    cursor: psycopg.Cursor,
    project_id: str,
    source_report_id: str | None,
    project: QueueProject,
    event_at: date | datetime,
    draft: Any,
) -> bool:
    event_key = stable_event_key(
        project_id,
        draft.event_type,
        draft.field_name,
        draft.old_value,
        draft.new_value,
        _event_date_key(event_at),
    )
    cursor.execute(
        """
        insert into queue_events (
          project_id, source_report_id, event_key, event_type, severity,
          title, description, field_name, old_value, new_value, delta_mw, event_at
        )
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (event_key) do nothing
        returning id
        """,
        (
            project_id,
            source_report_id,
            event_key,
            draft.event_type,
            draft.severity,
            draft.title,
            draft.description,
            draft.field_name,
            draft.old_value,
            draft.new_value,
            value_for_sql(draft.delta_mw),
            event_at,
        ),
    )
    return cursor.fetchone() is not None


def upsert_projects(
    projects: list[QueueProject],
    database_url: str,
    source_report: SourceReport | None = None,
    snapshot_date: date | None = None,
    observed_at: date | datetime | None = None,
    skip_successful_source_report: bool = False,
    force_source_report: bool = False,
) -> dict[str, int]:
    resolved_snapshot_date = snapshot_date or date.today()
    resolved_observed_at = observed_at or resolved_snapshot_date
    stats = {
        "projects_seen": len(projects),
        "projects_inserted": 0,
        "projects_updated": 0,
        "source_reports_started": 0,
        "source_reports_skipped": 0,
        "source_reports_succeeded": 0,
        "snapshots_written": 0,
        "changes_written": 0,
        "events_written": 0,
        "errors": 0,
    }
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        _ensure_project_location_columns(cursor)
        source_report_id = None
        if source_report is not None:
            source_report_id, skipped = _begin_source_report(
                cursor,
                source_report,
                skip_successful_source_report,
                force_source_report,
            )
            if skipped:
                stats["source_reports_skipped"] += 1
                return stats
            stats["source_reports_started"] += 1

        for project in projects:
            try:
                existing = cursor.execute(
                    "select * from projects where iso = %s and queue_id = %s",
                    (project.iso, project.queue_id),
                ).fetchone()
                columns = [desc.name for desc in cursor.description] if cursor.description else []
                existing_record = dict(zip(columns, existing, strict=False)) if existing else None

                values = {
                    field: value_for_sql(getattr(project, field)) for field in TRACKED_FIELDS
                }
                cursor.execute(
                    """
                    insert into projects (
                      iso, queue_id, project_name, mw_requested, fuel_type, county, state,
                      lat, lng, geom, location_source, location_confidence, address,
                      point_of_interconnection, location_notes, current_phase,
                      current_status, filed_date,
                      ia_signed_date, energized_date, withdrawn_date, owner_company,
                      raw_source_url, first_seen_at, last_updated_at
                    )
                    values (
                      %(iso)s, %(queue_id)s, %(project_name)s, %(mw_requested)s, %(fuel_type)s,
                      %(county)s, %(state)s, %(lat)s::numeric, %(lng)s::numeric,
                      case when %(lat)s::numeric is null or %(lng)s::numeric is null then null
                           else st_setsrid(
                             st_makepoint(%(lng)s::double precision, %(lat)s::double precision),
                             4326
                           ) end,
                      %(location_source)s, %(location_confidence)s, %(address)s,
                      %(point_of_interconnection)s, %(location_notes)s,
                      %(current_phase)s, %(current_status)s, %(filed_date)s,
                      %(ia_signed_date)s, %(energized_date)s, %(withdrawn_date)s,
                      %(owner_company)s, %(raw_source_url)s, now(), now()
                    )
                    on conflict (iso, queue_id) do update set
                      project_name = excluded.project_name,
                      mw_requested = excluded.mw_requested,
                      fuel_type = excluded.fuel_type,
                      county = excluded.county,
                      state = excluded.state,
                      lat = excluded.lat,
                      lng = excluded.lng,
                      geom = excluded.geom,
                      location_source = excluded.location_source,
                      location_confidence = excluded.location_confidence,
                      address = excluded.address,
                      point_of_interconnection = excluded.point_of_interconnection,
                      location_notes = excluded.location_notes,
                      current_phase = excluded.current_phase,
                      current_status = excluded.current_status,
                      filed_date = excluded.filed_date,
                      ia_signed_date = excluded.ia_signed_date,
                      energized_date = excluded.energized_date,
                      withdrawn_date = excluded.withdrawn_date,
                      owner_company = excluded.owner_company,
                      raw_source_url = excluded.raw_source_url,
                      last_updated_at = now()
                    returning id
                    """,
                    {
                        "iso": project.iso,
                        "queue_id": project.queue_id,
                        "state": project.state,
                        "raw_source_url": project.raw_source_url,
                        **values,
                    },
                )
                project_id = cursor.fetchone()[0]
                stats["projects_inserted" if existing_record is None else "projects_updated"] += 1

                if existing_record is None:
                    draft = classify_new_project(project)
                    if _insert_event(
                        cursor,
                        str(project_id),
                        source_report_id,
                        project,
                        resolved_observed_at,
                        draft,
                    ):
                        stats["events_written"] += 1

                if existing_record:
                    for field, new_value in values.items():
                        old_value = comparable(existing_record.get(field))
                        new_comparable = comparable(new_value)
                        if old_value != new_comparable:
                            cursor.execute(
                                """
                                insert into project_status_changes
                                  (
                                    project_id, source_report_id, changed_at,
                                    field_name, old_value, new_value
                                  )
                                values (%s, %s, %s, %s, %s, %s)
                                """,
                                (
                                    project_id,
                                    source_report_id,
                                    resolved_observed_at,
                                    field,
                                    old_value,
                                    new_comparable,
                                ),
                            )
                            stats["changes_written"] += 1
                            draft = classify_change(project, field, old_value, new_comparable)
                            if _insert_event(
                                cursor,
                                str(project_id),
                                source_report_id,
                                project,
                                resolved_observed_at,
                                draft,
                            ):
                                stats["events_written"] += 1

                cursor.execute(
                    """
                    insert into project_snapshots (
                      project_id, source_report_id, snapshot_date, raw_data, current_phase,
                      current_status, mw_requested
                    )
                    values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict (project_id, snapshot_date, source_report_id)
                      where source_report_id is not null
                    do update set
                      raw_data = excluded.raw_data,
                      current_phase = excluded.current_phase,
                      current_status = excluded.current_status,
                      mw_requested = excluded.mw_requested,
                      captured_at = now()
                    """,
                    (
                        project_id,
                        source_report_id,
                        resolved_snapshot_date,
                        json.dumps(project.raw_data, default=str),
                        project.current_phase,
                        project.current_status,
                        value_for_sql(project.mw_requested),
                    ),
                )
                stats["snapshots_written"] += 1
            except Exception:
                stats["errors"] += 1
                raise
        if source_report_id is not None:
            stats["source_reports_succeeded"] += 1
            _complete_source_report(cursor, source_report_id, stats)
    return stats
