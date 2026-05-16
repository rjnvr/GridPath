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


def upsert_projects(projects: list[QueueProject], database_url: str) -> dict[str, int]:
    stats = {
        "projects_seen": len(projects),
        "projects_inserted": 0,
        "projects_updated": 0,
        "snapshots_written": 0,
        "changes_written": 0,
        "errors": 0,
    }
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
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
                    on conflict (iso, queue_id) do update set
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

                if existing_record:
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
                    """
                    insert into project_snapshots (
                      project_id, snapshot_date, raw_data, current_phase,
                      current_status, mw_requested
                    )
                    values (%s, current_date, %s, %s, %s, %s)
                    """,
                    (
                        project_id,
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
