"""MISO Generator Interconnection Queue ingestion.

MISO's current public GI queue is exposed as JSON from the same data source
used by its public queue page. Historical local XLSX exports are still
supported for tests and backfills.
"""

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
from gridpath_ingestion.db import record_source_report_failure, upsert_projects
from gridpath_ingestion.models import QueueProject, SourceReport

# Override via env var `MISO_QUEUE_URL` if MISO rotates the API path.
DEFAULT_MISO_QUEUE_URL = "https://www.misoenergy.org/api/giqueue/getprojects"

PROJECT_SHEETS = {
    "GI Queue",
    "Active",
    "Active Projects",
    "Queue",
    "Generator Interconnection Queue",
}

EXPECTED_COLUMNS = {
    "County",
    "State",
}

# Accept any of these as the queue identifier — MISO has shipped at least
# three forms historically.
QUEUE_ID_COLUMNS = ("Project Number", "Project #", "Queue Number", "Queue #")

COLUMN_ALIASES = {
    "Project Number": "queue_id",
    "Project #": "queue_id",
    "Queue Number": "queue_id",
    "Queue #": "queue_id",
    "Project Name": "project_name",
    "Name": "project_name",
    "Generator Type": "fuel_type",
    "Resource Type": "fuel_type",
    "Fuel": "fuel_type",
    "Fuel Type": "fuel_type",
    "Type": "fuel_type",
    "MW": "mw_requested",
    "Summer MW": "mw_requested",
    "Capacity (MW)": "mw_requested",
    "Net MW Capacity": "mw_requested",
    "Net MW": "mw_requested",
    "County": "county",
    "State": "state",
    "POI": "point_of_interconnection",
    "Point of Interconnection": "point_of_interconnection",
    "Interconnection Point": "point_of_interconnection",
    "Substation": "point_of_interconnection",
    "Station": "point_of_interconnection",
    "Bus": "point_of_interconnection",
    "Status": "current_status",
    "Project Status": "current_status",
    "Current Status": "current_status",
    "Queue Date": "filed_date",
    "Queued Date": "filed_date",
    "Application Date": "filed_date",
    "Initial Application Date": "filed_date",
    "Request Receive Date": "filed_date",
    "GIA Executed Date": "ia_signed_date",
    "GIA Executed": "ia_signed_date",
    "IA Executed Date": "ia_signed_date",
    "IA Executed": "ia_signed_date",
    "In Service Date": "energized_date",
    "Commercial Operation Date": "energized_date",
    "Commercial Operation": "energized_date",
    "Actual COD": "energized_date",
    "Withdrawn Date": "withdrawn_date",
    "Withdrawal Date": "withdrawn_date",
    "Withdraw Date": "withdrawn_date",
    "Transmission Owner": "owner_company",
    "Customer": "owner_company",
    "Interconnection Customer": "owner_company",
    "Developer": "owner_company",
}

FUEL_MAP = {
    "battery": "storage",
    "bess": "storage",
    "storage": "storage",
    "ess": "storage",
    "natural gas": "gas",
    "gas": "gas",
    "solar": "solar",
    "photovoltaic": "solar",
    "pv": "solar",
    "wind": "wind",
    "hydro": "hydro",
    "nuclear": "nuclear",
    "biomass": "biomass",
    "coal": "coal",
    "oil": "oil",
    "diesel": "oil",
    "methane": "gas",
    "hybrid": "hybrid",
}

# MISO uses a 3-phase DPP (Definitive Planning Phase) process plus GIA
# negotiation and in-service stages. Map the most common status strings into
# GridPath's normalized phase taxonomy.
PHASE_MAP = {
    "withdrawn": "Withdrawn",
    "suspended": "Withdrawn",
    "terminated": "Withdrawn",
    "in service": "Energized",
    "done": "Energized",
    "completed": "Energized",
    "commercial operation": "Energized",
    "gia executed": "IA Executed",
    "ia executed": "IA Executed",
    "executed": "IA Executed",
    "gia negotiation": "IA Executed",
    "phase 3": "Facilities",
    "phase iii": "Facilities",
    "facilities study": "Facilities",
    "phase 2": "System Impact",
    "phase ii": "System Impact",
    "system impact": "System Impact",
    "phase 1": "Feasibility",
    "phase i": "Feasibility",
    "feasibility": "Feasibility",
    "pre-dpp": "Feasibility",
    "predpp": "Feasibility",
    "active": "Active",
    "gia": "IA Executed",
}


def normalize_header(value: Any) -> str:
    return " ".join(str(value).strip().split())


def assert_expected_columns(columns: list[str]) -> None:
    normalized = {normalize_header(column) for column in columns}
    missing = sorted(EXPECTED_COLUMNS - normalized)
    has_queue_id = any(candidate in normalized for candidate in QUEUE_ID_COLUMNS)
    if not has_queue_id:
        missing.append(" / ".join(QUEUE_ID_COLUMNS))
    has_capacity = any(
        candidate in normalized
        for candidate in ("MW", "Summer MW", "Capacity (MW)", "Net MW Capacity", "Net MW")
    )
    if not has_capacity:
        missing.append("MW / Net MW / Capacity (MW)")
    if missing:
        raise ValueError(f"MISO schema drift detected. Missing expected columns: {missing}")


def find_header_row(path: Path, sheet_name: str) -> int:
    preview = pd.read_excel(path, sheet_name=sheet_name, header=None, nrows=20)
    for index, row in preview.iterrows():
        values = {normalize_header(value) for value in row.tolist() if not pd.isna(value)}
        has_queue_id = any(candidate in values for candidate in QUEUE_ID_COLUMNS)
        if has_queue_id and {"County", "State"}.issubset(values):
            return int(index)
    return 0


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
            value = row[source]
            if target not in mapped or mapped[target] in (None, "") or pd.isna(mapped[target]):
                mapped[target] = value

    queue_id = clean_text(mapped.get("queue_id"))
    if not queue_id:
        return None

    county = clean_text(mapped.get("county"))
    state = clean_text(mapped.get("state"))
    lat, lng = centroid_for_county(county, state) if state else (None, None)
    current_status = clean_text(mapped.get("current_status"))
    location = county_centroid_location(county, state)

    return QueueProject(
        iso="MISO",
        queue_id=queue_id,
        project_name=clean_text(mapped.get("project_name")),
        mw_requested=parse_decimal(mapped.get("mw_requested")),
        fuel_type=normalize_fuel(mapped.get("fuel_type")),
        county=county,
        state=state,
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


def json_row_to_project(row: dict[str, Any], source_url: str | None = None) -> QueueProject | None:
    queue_id = clean_text(row.get("projectNumber"))
    if not queue_id:
        return None

    county = clean_text(row.get("county"))
    state = clean_text(row.get("state"))
    lat, lng = centroid_for_county(county, state) if state else (None, None)
    location = county_centroid_location(county, state)
    point_of_interconnection = clean_text(
        row.get("pointOfInterconnection")
        or row.get("point_of_interconnection")
        or row.get("poi")
        or row.get("substation")
        or row.get("bus")
    )

    current_status = clean_text(row.get("applicationStatus"))
    study_phase = clean_text(row.get("studyPhase"))
    post_gia_status = clean_text(row.get("postGIAStatus"))
    phase_source = post_gia_status or study_phase or current_status
    normalized_phase = normalize_phase(phase_source)

    status_text = " ".join(
        value
        for value in (current_status, study_phase, post_gia_status)
        if value is not None
    ).lower()
    is_energized = any(
        marker in status_text
        for marker in ("in service", "done", "completed", "commercial operation")
    )
    if is_energized:
        normalized_phase = "Energized"

    mw_requested = (
        parse_decimal(row.get("summerNetMW"))
        or parse_decimal(row.get("winterNetMW"))
        or parse_decimal(row.get("dp1NrisMw"))
        or parse_decimal(row.get("dp1ErisMw"))
        or parse_decimal(row.get("dp2NrisMw"))
        or parse_decimal(row.get("dp2ErisMw"))
    )

    return QueueProject(
        iso="MISO",
        queue_id=queue_id,
        project_name=clean_text(row.get("poiName")),
        mw_requested=mw_requested,
        fuel_type=normalize_fuel(row.get("fuelType") or row.get("facilityType")),
        county=county,
        state=state,
        lat=lat,
        lng=lng,
        point_of_interconnection=point_of_interconnection,
        **location,
        current_phase=normalized_phase,
        current_status=current_status,
        filed_date=parse_date(row.get("queueDate")),
        ia_signed_date=None,
        energized_date=parse_date(row.get("inService")) if is_energized else None,
        withdrawn_date=parse_date(row.get("withdrawnDate")),
        owner_company=clean_text(row.get("transmissionOwner")),
        raw_source_url=source_url,
        raw_data=row,
    )


def parse_json_report(path: Path, source_url: str | None = None) -> list[QueueProject]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, list):
        raise ValueError("MISO schema drift detected. Expected JSON list payload.")

    projects: list[QueueProject] = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        project = json_row_to_project(row, source_url)
        if project:
            projects.append(project)
    return projects


def parse_report(path: Path, source_url: str | None = None) -> list[QueueProject]:
    if path.suffix.lower() == ".json":
        return parse_json_report(path, source_url)
    return parse_workbook(path, source_url)


def parse_workbook(path: Path, source_url: str | None = None) -> list[QueueProject]:
    projects: list[QueueProject] = []
    workbook = pd.ExcelFile(path)
    candidate_sheets = [sheet for sheet in workbook.sheet_names if sheet in PROJECT_SHEETS]
    if not candidate_sheets:
        candidate_sheets = workbook.sheet_names[:1]
    if not candidate_sheets:
        raise ValueError("MISO schema drift detected. No usable sheet in workbook.")

    for sheet_name in candidate_sheets:
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
    content_type = response.headers.get("content-type", "").lower()
    suffix = ".json" if "json" in content_type or url.lower().endswith(".json") else ".xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(response.content)
        return Path(handle.name)


def source_report_for_file(path: Path, source_url: str | None = None) -> SourceReport:
    return SourceReport(
        iso="MISO",
        source_url=source_url or path.resolve().as_uri(),
        source_name=path.name,
        report_date=date.today(),
    )


def source_report_for_url(url: str) -> SourceReport:
    return SourceReport(
        iso="MISO",
        source_url=url,
        source_name="MISO GI Queue",
        report_date=date.today(),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Ingest MISO Generator Interconnection Queue into Neon Postgres."
    )
    parser.add_argument("--file", type=Path, help="Local MISO queue workbook")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess source report even if it already succeeded.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log without writing to Postgres",
    )
    args = parser.parse_args(argv)

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    source_url = os.environ.get("MISO_QUEUE_URL") or DEFAULT_MISO_QUEUE_URL

    workbook_path = args.file
    if not workbook_path:
        workbook_path = download_report(source_url)
        report_source_url: str | None = source_url
    else:
        report_source_url = workbook_path.resolve().as_uri()

    source_report = (
        source_report_for_url(source_url)
        if args.file is None
        else source_report_for_file(workbook_path, report_source_url)
    )

    try:
        projects = parse_report(workbook_path, report_source_url)
    except Exception as exc:
        if database_url and not args.dry_run:
            record_source_report_failure(database_url, source_report, str(exc))
        raise

    if args.dry_run:
        print(json.dumps({"iso": "MISO", "projects_seen": len(projects), "dry_run": True}))
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
