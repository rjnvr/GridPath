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
from gridpath_ingestion.discovery import (
    discover_ercot_gis_reports,
    discover_latest_ercot_gis_report,
    report_date,
)
from gridpath_ingestion.models import QueueProject

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


def row_to_project(row: dict[str, Any], source_url: str | None = None) -> QueueProject | None:
    mapped: dict[str, Any] = {}
    for source, target in COLUMN_ALIASES.items():
        if source in row:
            mapped[target] = row[source]

    queue_id = clean_text(mapped.get("queue_id"))
    if not queue_id:
        return None

    county = clean_text(mapped.get("county"))
    lat, lng = centroid_for_county(county, "TX")
    current_status = clean_text(mapped.get("current_status"))

    return QueueProject(
        iso="ERCOT",
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


def parse_workbook(path: Path, source_url: str | None = None) -> list[QueueProject]:
    projects: list[QueueProject] = []
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest ERCOT GIS queue data into Neon Postgres.")
    parser.add_argument("--file", type=Path, help="Local ERCOT GIS Excel file")
    parser.add_argument(
        "--backfill-months",
        type=int,
        default=0,
        help="Backfill the latest N official ERCOT GIS reports without overwriting current state.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log without writing to Postgres",
    )
    args = parser.parse_args(argv)

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if args.backfill_months:
        reports = discover_ercot_gis_reports(limit=args.backfill_months)
        totals = {
            "reports_seen": len(reports),
            "projects_seen": 0,
            "snapshots_written": 0,
            "dry_run": args.dry_run,
        }
        if not args.dry_run and not database_url:
            raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")

        for report in reversed(reports):
            workbook = download_report(report.url)
            projects = parse_workbook(workbook, report.url)
            snapshot_date = report_date(report).date()
            totals["projects_seen"] += len(projects)
            print(
                json.dumps(
                    {
                        "event": "parsed_report",
                        "iso": "ERCOT",
                        "name": report.name,
                        "published_at": report.published_at,
                        "projects_seen": len(projects),
                    },
                    sort_keys=True,
                )
            )
            if not args.dry_run:
                stats = upsert_projects(
                    projects,
                    database_url or "",
                    snapshot_date=snapshot_date,
                    report_name=report.name,
                    source_url=report.url,
                    update_current=False,
                )
                totals["snapshots_written"] += stats["snapshots_written"]
        print(json.dumps(totals, sort_keys=True))
        return 0

    source_url = os.environ.get("ERCOT_GIS_URL")
    report_name = "ERCOT GIS Report"
    snapshot_date = date.today()
    workbook = args.file
    if not workbook:
        if not source_url:
            report = discover_latest_ercot_gis_report()
            source_url = report.url
            report_name = report.name
            snapshot_date = report_date(report).date()
            print(
                json.dumps(
                    {
                        "event": "discovered_report",
                        "iso": "ERCOT",
                        "name": report.name,
                        "published_at": report.published_at,
                    },
                    sort_keys=True,
                )
            )
        workbook = download_report(source_url)

    projects = parse_workbook(workbook, source_url)
    if args.dry_run:
        print(json.dumps({"projects_seen": len(projects), "dry_run": True}))
        return 0

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
