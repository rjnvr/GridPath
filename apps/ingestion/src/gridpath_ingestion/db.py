from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg

from gridpath_ingestion.models import QueueProject

TRACKED_FIELDS = [
    "project_name",
    "mw_requested",
    "fuel_type",
    "county",
    "lat",
    "lng",
    "current_phase",
    "current_status",
    "filed_date",
    "ia_signed_date",
    "energized_date",
    "withdrawn_date",
    "owner_company",
]


def value_for_sql(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def comparable(value: Any) -> str | None:
    sql_value = value_for_sql(value)
    return None if sql_value is None else str(sql_value)


def table_exists(cursor: psycopg.Cursor, table_name: str) -> bool:
    return bool(
        cursor.execute("select to_regclass(%s)", (f"public.{table_name}",)).fetchone()[0]
    )


def record_ingestion_report(
    cursor: psycopg.Cursor,
    *,
    iso: str,
    report_name: str,
    source_url: str,
    report_date: date,
    projects_seen: int,
) -> None:
    cursor.execute(
        """
        insert into ingestion_reports (iso, report_name, source_url, report_date, projects_seen)
        values (%s, %s, %s, %s, %s)
        on conflict (iso, source_url) do update set
          report_name = excluded.report_name,
          report_date = excluded.report_date,
          projects_seen = excluded.projects_seen,
          captured_at = now()
        """,
        (iso, report_name, source_url, report_date, projects_seen),
    )


def upsert_projects(
    projects: list[QueueProject],
    database_url: str,
    *,
    snapshot_date: date | None = None,
    report_name: str | None = None,
    source_url: str | None = None,
    update_current: bool = True,
) -> dict[str, int]:
    effective_snapshot_date = snapshot_date or date.today()
    stats = {
        "projects_seen": len(projects),
        "projects_inserted": 0,
        "projects_updated": 0,
        "snapshots_written": 0,
        "changes_written": 0,
        "errors": 0,
    }
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        if projects and report_name and source_url and table_exists(cursor, "ingestion_reports"):
            record_ingestion_report(
                cursor,
                iso=projects[0].iso,
                report_name=report_name,
                source_url=source_url,
                report_date=effective_snapshot_date,
                projects_seen=len(projects),
            )

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
                payload = {
                    "iso": project.iso,
                    "queue_id": project.queue_id,
                    "state": project.state,
                    "raw_source_url": project.raw_source_url,
                    **values,
                }

                if update_current or existing_record is None:
                    conflict_update = (
                        """
                        project_name = excluded.project_name,
                        mw_requested = excluded.mw_requested,
                        fuel_type = excluded.fuel_type,
                        county = excluded.county,
                        state = excluded.state,
                        lat = excluded.lat,
                        lng = excluded.lng,
                        geom = excluded.geom,
                        current_phase = excluded.current_phase,
                        current_status = excluded.current_status,
                        filed_date = excluded.filed_date,
                        ia_signed_date = excluded.ia_signed_date,
                        energized_date = excluded.energized_date,
                        withdrawn_date = excluded.withdrawn_date,
                        owner_company = excluded.owner_company,
                        raw_source_url = excluded.raw_source_url,
                        last_updated_at = now()
                        """
                        if update_current
                        else "last_updated_at = projects.last_updated_at"
                    )
                    cursor.execute(
                        f"""
                        insert into projects (
                          iso, queue_id, project_name, mw_requested, fuel_type, county, state,
                          lat, lng, geom, current_phase, current_status, filed_date,
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
                          %(current_phase)s, %(current_status)s, %(filed_date)s,
                          %(ia_signed_date)s, %(energized_date)s, %(withdrawn_date)s,
                          %(owner_company)s, %(raw_source_url)s, now(), now()
                        )
                        on conflict (iso, queue_id) do update set {conflict_update}
                        returning id
                        """,
                        payload,
                    )
                    project_id = cursor.fetchone()[0]
                    stat_key = (
                        "projects_inserted" if existing_record is None else "projects_updated"
                    )
                    stats[stat_key] += 1
                else:
                    project_id = existing_record["id"]

                if existing_record and update_current:
                    for field, new_value in values.items():
                        old_value = comparable(existing_record.get(field))
                        new_comparable = comparable(new_value)
                        if old_value != new_comparable:
                            cursor.execute(
                                """
                                insert into project_status_changes
                                  (project_id, field_name, old_value, new_value)
                                values (%s, %s, %s, %s)
                                """,
                                (project_id, field, old_value, new_comparable),
                            )
                            stats["changes_written"] += 1

                cursor.execute(
                    "delete from project_snapshots where project_id = %s and snapshot_date = %s",
                    (project_id, effective_snapshot_date),
                )
                cursor.execute(
                    """
                    insert into project_snapshots (
                      project_id, snapshot_date, raw_data, current_phase,
                      current_status, mw_requested
                    )
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        project_id,
                        effective_snapshot_date,
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
    return stats
