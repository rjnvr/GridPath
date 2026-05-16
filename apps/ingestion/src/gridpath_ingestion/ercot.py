from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import httpx
import pandas as pd
import psycopg
from pydantic import BaseModel, ConfigDict, Field

from gridpath_ingestion.county_centroids import centroid_for_county

EXPECTED_COLUMNS = {
    "INR",
    "Project Name",
    "Fuel",
    "County",
}

COLUMN_ALIASES = {
    "INR": "queue_id",
    "Project Name": "project_name",
    "Fuel": "fuel_type",
    "County": "county",
    "MW": "mw_requested",
    "MW **": "mw_requested",
    "Capacity (MW)": "mw_requested",
    "Status": "current_status",
    "GIM Study Phase": "current_status",
    "Model Ready Date": "filed_date",
    "Interconnection Agreement Signed Date": "ia_signed_date",
    "IA Signed Date": "ia_signed_date",
    "IA Signed": "ia_signed_date",
    "Energization Date": "energized_date",
    "Energized Date": "energized_date",
    "Approved for Energization": "energized_date",
    "Withdrawn Date": "withdrawn_date",
    "Inactive Date": "withdrawn_date",
    "Screening Study Started": "filed_date",
    "Application Received Date": "filed_date",
    "Owner": "owner_company",
    "Developer": "owner_company",
    "Interconnecting Entity": "owner_company",
}

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

FUEL_MAP = {
    "battery": "storage",
    "bess": "storage",
    "energy storage": "storage",
    "gas": "gas",
    "natural gas": "gas",
    "solar": "solar",
    "pv": "solar",
    "wind": "wind",
}

PHASE_MAP = {
    "planning": "Feasibility",
    "screening": "Feasibility",
    "fis": "System Impact",
    "full interconnection study": "System Impact",
    "ss": "Facilities",
    "stability study": "Facilities",
    "ia signed": "IA Executed",
    "interconnection agreement signed": "IA Executed",
    "energized": "Energized",
    "withdrawn": "Withdrawn",
}


class ErcotProject(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    iso: str = "ERCOT"
    queue_id: str
    project_name: str | None = None
    mw_requested: Decimal | None = None
    fuel_type: str | None = None
    county: str | None = None
    state: str = "TX"
    lat: float | None = None
    lng: float | None = None
    current_phase: str | None = None
    current_status: str | None = None
    filed_date: date | None = None
    ia_signed_date: date | None = None
    energized_date: date | None = None
    withdrawn_date: date | None = None
    owner_company: str | None = None
    raw_source_url: str | None = None
    raw_data: dict[str, Any] = Field(default_factory=dict)


def normalize_header(value: Any) -> str:
    return " ".join(str(value).strip().split())


def assert_expected_columns(columns: list[str]) -> None:
    normalized = {normalize_header(column) for column in columns}
    missing = sorted(EXPECTED_COLUMNS - normalized)
    has_capacity = "Capacity (MW)" in normalized or "MW" in normalized or "MW **" in normalized
    if not has_capacity:
        missing.append("Capacity (MW) or MW")
    if missing:
        raise ValueError(f"ERCOT schema drift detected. Missing expected columns: {missing}")


def find_header_row(path: Path, sheet_name: str) -> int:
    preview = pd.read_excel(path, sheet_name=sheet_name, header=None, nrows=80)
    for index, row in preview.iterrows():
        values = {normalize_header(value) for value in row.tolist() if not pd.isna(value)}
        if {"INR", "Project Name", "Fuel", "County"}.issubset(values):
            return int(index)
    raise ValueError(f"ERCOT schema drift detected. Could not find header row in {sheet_name}.")


def normalize_fuel(value: Any) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip().lower()
    for needle, normalized in FUEL_MAP.items():
        if needle in text:
            return normalized
    return text or None


def normalize_phase(status: str | None) -> str | None:
    if not status:
        return None
    text = status.strip().lower()
    for needle, normalized in PHASE_MAP.items():
        if needle in text:
            return normalized
    return status.strip()


def parse_decimal(value: Any) -> Decimal | None:
    if value is None or pd.isna(value) or str(value).strip() == "":
        return None
    try:
        return Decimal(str(value).replace(",", "").strip())
    except InvalidOperation:
        return None


def parse_date(value: Any) -> date | None:
    if value is None or pd.isna(value) or str(value).strip() == "":
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def clean_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def row_to_project(row: dict[str, Any], source_url: str | None = None) -> ErcotProject | None:
    mapped: dict[str, Any] = {}
    for source, target in COLUMN_ALIASES.items():
        if source in row:
            mapped[target] = row[source]

    queue_id = clean_text(mapped.get("queue_id"))
    if not queue_id:
        return None

    county = clean_text(mapped.get("county"))
    lat, lng = centroid_for_county(county)
    current_status = clean_text(mapped.get("current_status"))

    return ErcotProject(
        queue_id=queue_id,
        project_name=clean_text(mapped.get("project_name")),
        mw_requested=parse_decimal(mapped.get("mw_requested")),
        fuel_type=normalize_fuel(mapped.get("fuel_type")),
        county=county,
        lat=lat,
        lng=lng,
        current_phase=normalize_phase(current_status),
        current_status=current_status,
        filed_date=parse_date(mapped.get("filed_date")),
        ia_signed_date=parse_date(mapped.get("ia_signed_date")),
        energized_date=parse_date(mapped.get("energized_date")),
        withdrawn_date=parse_date(mapped.get("withdrawn_date")),
        owner_company=clean_text(mapped.get("owner_company")),
        raw_source_url=source_url,
        raw_data={str(key): None if pd.isna(value) else value for key, value in row.items()},
    )


def parse_workbook(path: Path, source_url: str | None = None) -> list[ErcotProject]:
    projects: list[ErcotProject] = []
    workbook = pd.ExcelFile(path)
    detail_sheets = [
        sheet
        for sheet in workbook.sheet_names
        if sheet in {"Project Details - Large Gen", "Project Details - Small Gen"}
    ]
    if not detail_sheets:
        raise ValueError("ERCOT schema drift detected. Missing project detail sheets.")

    for sheet_name in detail_sheets:
        header_row = find_header_row(path, sheet_name)
        frame = pd.read_excel(path, sheet_name=sheet_name, header=header_row)
        frame.columns = [normalize_header(column) for column in frame.columns]
        assert_expected_columns(list(frame.columns))
        for row in frame.to_dict(orient="records"):
            project = row_to_project(row, source_url)
            if project:
                projects.append(project)
    return projects


def download_report(url: str) -> Path:
    response = httpx.get(url, timeout=60.0, follow_redirects=True)
    response.raise_for_status()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as handle:
        handle.write(response.content)
        return Path(handle.name)


def value_for_sql(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def comparable(value: Any) -> str | None:
    sql_value = value_for_sql(value)
    return None if sql_value is None else str(sql_value)


def upsert_projects(projects: list[ErcotProject], database_url: str) -> dict[str, int]:
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
                    columns = (
                        [desc.name for desc in cursor.description] if cursor.description else []
                    )
                    existing_record = (
                        dict(zip(columns, existing, strict=False)) if existing else None
                    )

                    values = {
                        field: value_for_sql(getattr(project, field))
                        for field in TRACKED_FIELDS
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
                          %(county)s, %(state)s, %(lat)s, %(lng)s,
                          case when %(lat)s is null or %(lng)s is null then null
                               else st_setsrid(st_makepoint(%(lng)s, %(lat)s), 4326) end,
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
                    stats[
                        "projects_inserted" if existing_record is None else "projects_updated"
                    ] += 1

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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest ERCOT GIS queue data into Neon Postgres.")
    parser.add_argument("--file", type=Path, help="Local ERCOT GIS Excel file")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log without writing to Postgres",
    )
    args = parser.parse_args(argv)

    source_url = os.environ.get("ERCOT_GIS_URL")
    workbook = args.file
    if not workbook:
        if not source_url:
            raise SystemExit("Provide --file or ERCOT_GIS_URL.")
        workbook = download_report(source_url)

    projects = parse_workbook(workbook, source_url)
    if args.dry_run:
        print(json.dumps({"projects_seen": len(projects), "dry_run": True}))
        return 0

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")
    stats = upsert_projects(projects, database_url)
    print(json.dumps(stats, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
