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

from gridpath_ingestion.centroids import centroid_for_county, county_centroid_location
from gridpath_ingestion.db import (
    project_count_for_iso,
    record_source_report_failure,
    successful_source_report_urls,
    upsert_projects,
)
from gridpath_ingestion.discovery import (
    DiscoveredReport,
    discover_latest_ercot_gis_report,
    list_ercot_gis_reports,
)
from gridpath_ingestion.models import QueueProject, SourceReport

EXPECTED_COLUMNS = {
    "INR",
    "Project Name",
    "Fuel",
    "County",
}

PROJECT_DETAIL_SHEETS = {
    "Project Details",
    "Project Details - Large Gen",
    "Project Details - Small Gen",
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
    "GINR Study Phase": "current_status",
    "POI": "point_of_interconnection",
    "Point of Interconnection": "point_of_interconnection",
    "Interconnection Point": "point_of_interconnection",
    "Substation": "point_of_interconnection",
    "Station": "point_of_interconnection",
    "Bus": "point_of_interconnection",
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
    location = county_centroid_location(county, "TX")

    return QueueProject(
        iso="ERCOT",
        queue_id=queue_id,
        project_name=clean_text(mapped.get("project_name")),
        mw_requested=parse_decimal(mapped.get("mw_requested")),
        fuel_type=normalize_fuel(mapped.get("fuel_type")),
        county=county,
        state="TX",
        lat=lat,
        lng=lng,
        point_of_interconnection=clean_text(mapped.get("point_of_interconnection")),
        **location,
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
        if sheet in PROJECT_DETAIL_SHEETS
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


def source_report_from_discovered(
    report: DiscoveredReport,
    source_url: str | None = None,
) -> SourceReport:
    return SourceReport(
        iso="ERCOT",
        source_url=source_url or report.url,
        source_name=report.name,
        published_at=report.published_at,
        report_date=report.report_date or date.today(),
    )


def source_report_from_file(path: Path, source_url: str | None = None) -> SourceReport:
    return SourceReport(
        iso="ERCOT",
        source_url=source_url or path.resolve().as_uri(),
        source_name=path.name,
        report_date=date.today(),
    )


def select_reports_for_backfill(
    reports: list[DiscoveredReport],
    successful_urls: set[str],
    force: bool,
) -> list[DiscoveredReport]:
    if force:
        return reports
    return [report for report in reports if report.url not in successful_urls]


def successful_report_prefix_length(
    reports: list[DiscoveredReport],
    successful_urls: set[str],
) -> int:
    prefix_length = 0
    for report in reports:
        if report.url not in successful_urls:
            break
        prefix_length += 1
    return prefix_length


def ingest_report(
    report: DiscoveredReport,
    database_url: str | None,
    dry_run: bool,
    force: bool,
    skip_successful: bool,
    workbook: Path | None = None,
) -> dict[str, int | bool | str | None]:
    source_report = source_report_from_discovered(report)
    try:
        resolved_workbook = workbook or download_report(report.url)
        projects = parse_workbook(resolved_workbook, report.url)
    except Exception as exc:
        if database_url and not dry_run:
            record_source_report_failure(database_url, source_report, str(exc))
        raise

    if dry_run:
        return {
            "iso": "ERCOT",
            "source_url": report.url,
            "projects_seen": len(projects),
            "dry_run": True,
        }

    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")

    try:
        return upsert_projects(
            projects,
            database_url,
            source_report=source_report,
            snapshot_date=source_report.report_date,
            observed_at=source_report.report_date,
            skip_successful_source_report=skip_successful,
            force_source_report=force,
        )
    except Exception as exc:
        record_source_report_failure(database_url, source_report, str(exc))
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest ERCOT GIS queue data into Neon Postgres.")
    parser.add_argument("--file", type=Path, help="Local ERCOT GIS Excel file")
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Process official ERCOT GIS reports oldest-to-newest, skipping successful reports.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess source reports even if they already succeeded.",
    )
    parser.add_argument("--limit", type=int, help="Limit backfill report count for smoke tests")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log without writing to Postgres",
    )
    args = parser.parse_args(argv)

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")

    if args.backfill:
        reports = list_ercot_gis_reports()
        successful_urls = set()
        if database_url and not args.dry_run:
            successful_urls = successful_source_report_urls(database_url, "ERCOT")
            prefix_length = successful_report_prefix_length(reports, successful_urls)
            has_non_chronological_success = any(
                report.url in successful_urls for report in reports[prefix_length:]
            )
            if not args.force and (
                (project_count_for_iso(database_url, "ERCOT") > 0 and prefix_length == 0)
                or has_non_chronological_success
            ):
                raise SystemExit(
                    "ERCOT backfill must start from an empty ERCOT project set or resume a "
                    "chronological backfill. Use --force only for manual repair."
                )
        reports_to_ingest = select_reports_for_backfill(reports, successful_urls, args.force)
        if args.limit:
            reports_to_ingest = reports_to_ingest[: args.limit]
        aggregate = {
            "event": "ercot_backfill",
            "reports_seen": len(reports),
            "reports_selected": len(reports_to_ingest),
            "reports_processed": 0,
            "projects_seen": 0,
            "events_written": 0,
            "dry_run": args.dry_run,
        }
        for report in reports_to_ingest:
            stats = ingest_report(
                report,
                database_url,
                args.dry_run,
                args.force,
                skip_successful=True,
            )
            aggregate["reports_processed"] += 1
            aggregate["projects_seen"] += int(stats.get("projects_seen", 0))
            aggregate["events_written"] += int(stats.get("events_written", 0))
            print(
                json.dumps(
                    {"event": "processed_report", "report": report.name, **stats},
                    sort_keys=True,
                )
            )
        print(json.dumps(aggregate, sort_keys=True))
        return 0

    source_url = os.environ.get("ERCOT_GIS_URL")
    workbook = args.file
    report: DiscoveredReport | None = None
    if not workbook:
        if not source_url:
            report = discover_latest_ercot_gis_report()
            source_url = report.url
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
        if report is None:
            report = DiscoveredReport(
                url=source_url,
                name="ERCOT GIS Report",
                report_date=date.today(),
            )
        stats = ingest_report(
            report,
            database_url,
            args.dry_run,
            args.force,
            skip_successful=False,
        )
        print(json.dumps(stats, sort_keys=True))
        return 0

    source_report = source_report_from_file(workbook, source_url)
    projects = parse_workbook(workbook, source_url)
    if args.dry_run:
        print(json.dumps({"projects_seen": len(projects), "dry_run": True}))
        return 0

    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")
    try:
        stats = upsert_projects(
            projects,
            database_url,
            source_report=source_report,
            snapshot_date=source_report.report_date,
            observed_at=source_report.report_date,
            force_source_report=args.force,
        )
    except Exception as exc:
        record_source_report_failure(database_url, source_report, str(exc))
        raise
    print(json.dumps(stats, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
