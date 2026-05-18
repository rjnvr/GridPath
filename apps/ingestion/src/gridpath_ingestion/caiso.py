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

from gridpath_ingestion.centroids import centroid_for_county
from gridpath_ingestion.db import upsert_projects
from gridpath_ingestion.discovery import discover_latest_caiso_public_queue_report
from gridpath_ingestion.models import QueueProject

PROJECT_SHEETS = {
    "Grid GenerationQueue",
    "Completed Generation Projects",
    "Withdrawn Generation Projects",
}

EXPECTED_COLUMNS = {
    "Queue Position",
    "Application Status",
    "County",
    "State",
    "Net MWs to Grid",
}

FUEL_MAP = {
    "battery": "storage",
    "storage": "storage",
    "natural gas": "gas",
    "gas": "gas",
    "photovoltaic": "solar",
    "solar": "solar",
    "wind": "wind",
    "geothermal": "geothermal",
    "hydro": "hydro",
    "nuclear": "nuclear",
}

PHASE_MAP = {
    "complete": "Facilities",
    "re-study": "System Impact",
    "in progress": "System Impact",
    "executed": "IA Executed",
    "withdrawn": "Withdrawn",
    "completed": "Energized",
    "active": "Active",
}


def normalize_header(value: Any) -> str:
    return " ".join(str(value).strip().split())


def find_header_row(path: Path, sheet_name: str) -> int:
    preview = pd.read_excel(path, sheet_name=sheet_name, header=None, nrows=20)
    for index, row in preview.iterrows():
        values = {normalize_header(value) for value in row.tolist() if not pd.isna(value)}
        if {"Queue Position", "Application Status", "County", "State"}.issubset(values):
            return int(index)
    raise ValueError(f"CAISO schema drift detected. Could not find header row in {sheet_name}.")


def assert_expected_columns(columns: list[str]) -> None:
    normalized = {normalize_header(column) for column in columns}
    has_project_name = "Project Name" in normalized or "Project Name - Confidential" in normalized
    missing = sorted(EXPECTED_COLUMNS - normalized)
    if not has_project_name:
        missing.append("Project Name")
    if missing:
        raise ValueError(f"CAISO schema drift detected. Missing expected columns: {missing}")


def clean_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


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


def normalize_fuel(row: dict[str, Any]) -> str | None:
    candidates = [
        clean_text(row.get("Fuel-1")),
        clean_text(row.get("Fuel-2")),
        clean_text(row.get("Type-1")),
        clean_text(row.get("Type-2")),
    ]
    text = " ".join(candidate for candidate in candidates if candidate).lower()
    for needle, normalized in FUEL_MAP.items():
        if needle in text:
            return normalized
    return clean_text(row.get("Fuel-1")) or clean_text(row.get("Type-1"))


def normalize_phase(row: dict[str, Any]) -> str | None:
    status_candidates = [
        clean_text(row.get("Interconnection Agreement Status")),
        clean_text(row.get("Facilities Study (FAS) or Phase II Cluster Study")),
        clean_text(row.get("System Impact Study or Phase I Cluster Study")),
        clean_text(row.get("Feasibility Study or Supplemental Review")),
        clean_text(row.get("Application Status")),
    ]
    for status in status_candidates:
        if not status:
            continue
        text = status.lower()
        for needle, normalized in PHASE_MAP.items():
            if needle in text:
                return normalized
    return clean_text(row.get("Application Status"))


def project_name_from_row(row: dict[str, Any]) -> str | None:
    return clean_text(row.get("Project Name")) or clean_text(row.get("Project Name - Confidential"))


def row_to_project(row: dict[str, Any], source_url: str | None = None) -> QueueProject | None:
    queue_position = clean_text(row.get("Queue Position"))
    if not queue_position:
        return None

    state = clean_text(row.get("State")) or "CA"
    county = clean_text(row.get("County"))
    lat, lng = centroid_for_county(county, state)
    application_status = clean_text(row.get("Application Status"))

    return QueueProject(
        iso="CAISO",
        queue_id=queue_position,
        project_name=project_name_from_row(row),
        mw_requested=parse_decimal(row.get("Net MWs to Grid")),
        fuel_type=normalize_fuel(row),
        county=county,
        state=state,
        lat=lat,
        lng=lng,
        current_phase=normalize_phase(row),
        current_status=application_status,
        filed_date=parse_date(row.get("Interconnection Request Receive Date")),
        ia_signed_date=parse_date(row.get("Interconnection Agreement Status"))
        if application_status == "COMPLETED"
        else None,
        energized_date=parse_date(row.get("Current On-line Date"))
        if application_status == "COMPLETED"
        else None,
        withdrawn_date=parse_date(row.get("Withdrawn Date")),
        owner_company=clean_text(row.get("Utility")),
        raw_source_url=source_url,
        raw_data={str(key): None if pd.isna(value) else value for key, value in row.items()},
    )


def parse_workbook(path: Path, source_url: str | None = None) -> list[QueueProject]:
    workbook = pd.ExcelFile(path)
    sheets = [sheet for sheet in workbook.sheet_names if sheet in PROJECT_SHEETS]
    if not sheets:
        raise ValueError("CAISO schema drift detected. Missing public queue project sheets.")

    projects: list[QueueProject] = []
    for sheet_name in sheets:
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Ingest CAISO public queue data into Neon Postgres."
    )
    parser.add_argument("--file", type=Path, help="Local CAISO public queue Excel file")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log without writing to Postgres",
    )
    args = parser.parse_args(argv)

    source_url = os.environ.get("CAISO_QUEUE_URL")
    report_name = "CAISO Public Queue Report"
    snapshot_date = date.today()
    workbook = args.file
    if not workbook:
        if not source_url:
            report = discover_latest_caiso_public_queue_report()
            source_url = report.url
            report_name = report.name
            print(
                json.dumps(
                    {
                        "event": "discovered_report",
                        "iso": "CAISO",
                        "name": report.name,
                    },
                    sort_keys=True,
                )
            )
        workbook = download_report(source_url)

    projects = parse_workbook(workbook, source_url)
    if args.dry_run:
        print(json.dumps({"projects_seen": len(projects), "dry_run": True}))
        return 0

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")
    stats = upsert_projects(
        projects,
        database_url,
        snapshot_date=snapshot_date,
        report_name=report_name,
        source_url=source_url,
        update_current=True,
    )
    print(json.dumps(stats, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
