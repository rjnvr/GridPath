"""PJM New Services Queue ingestion.

PJM publishes their interconnection queue as an XLSX at
https://www.pjm.com/-/media/etools/oasis/system-information/new-services-queue.ashx
(file extension is `.ashx` but contents are XLSX). The column layout has
historically been stable but is alias-based here so schema drift surfaces as
a loud error rather than silent data loss.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

from gridpath_ingestion.centroids import centroid_for_county, county_centroid_location
from gridpath_ingestion.db import record_source_report_failure, upsert_projects
from gridpath_ingestion.models import QueueProject, SourceReport

DEFAULT_PJM_QUEUE_URL = (
    "https://www.pjm.com/pjmfiles/media/planning/queues-data/PlanningQueues.xml"
)

# PJM publishes one workbook with multiple service-type sheets; the active
# generation queue is the only one we care about today, but the names have
# drifted historically so we accept several variants.
PROJECT_SHEETS = {
    "New Services Queue",
    "Active",
    "Active Queue",
    "Queue",
    "Generation",
}

EXPECTED_COLUMNS = {
    "Queue Number",
    "State",
    "County",
}

COLUMN_ALIASES = {
    "Queue Number": "queue_id",
    "Project ID": "queue_id",
    "Project Name": "project_name",
    "Name": "project_name",
    "MW Capacity": "mw_requested",
    "Capacity (MW)": "mw_requested",
    "MFO": "mw_requested",
    "MFO MW": "mw_requested",
    "MW Energy": "mw_energy",
    "MW In Service": "mw_in_service",
    "Fuel": "fuel_type",
    "Type": "fuel_type",
    "Fuel Type": "fuel_type",
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
    "Submitted Date": "filed_date",
    "Submitted": "filed_date",
    "Initial Study": "filed_date",
    "Application Received Date": "filed_date",
    "System Impact Study Date": "system_impact_date",
    "System Impact Study": "system_impact_date",
    "Facilities Study Date": "facilities_study_date",
    "Facilities Study": "facilities_study_date",
    "IA Executed Date": "ia_signed_date",
    "GIA Executed Date": "ia_signed_date",
    "IA Executed": "ia_signed_date",
    "GIA Executed": "ia_signed_date",
    "Commercial Operation Date": "energized_date",
    "Commercial Operation": "energized_date",
    "Actual In Service Date": "energized_date",
    "Withdrawn Date": "withdrawn_date",
    "Withdrawal Date": "withdrawn_date",
    "Transmission Owner": "owner_company",
    "Developer": "owner_company",
    "Interconnection Customer": "owner_company",
}

XML_FIELD_ALIASES = {
    "ProjectNumber": "queue_id",
    "Name": "project_name",
    "CommercialName": "project_name",
    "MaximumFacilityOutput": "mw_requested",
    "MWO": "mw_requested",
    "MWCapacity": "mw_requested",
    "MWEnergy": "mw_energy",
    "MWInService": "mw_in_service",
    "Fuel": "fuel_type",
    "County": "county",
    "State": "state",
    "POI": "point_of_interconnection",
    "PointOfInterconnection": "point_of_interconnection",
    "InterconnectionPoint": "point_of_interconnection",
    "Substation": "point_of_interconnection",
    "Station": "point_of_interconnection",
    "Bus": "point_of_interconnection",
    "Status": "current_status",
    "SubmittedDate": "filed_date",
    "Interim-InterconnectionService-GenerationInterconnectionAgreement": "ia_signed_date",
    "ActualInServiceDate": "energized_date",
    "WithdrawalDate": "withdrawn_date",
    "WithdrawnDate": "withdrawn_date",
    "TransmissionOwner": "owner_company",
    "Developer": "owner_company",
}

FUEL_MAP = {
    "battery": "storage",
    "bess": "storage",
    "storage": "storage",
    "natural gas": "gas",
    "gas": "gas",
    "solar": "solar",
    "photovoltaic": "solar",
    "pv": "solar",
    "wind": "wind",
    "hydro": "hydro",
    "nuclear": "nuclear",
    "biomass": "biomass",
    "methane": "gas",
    "oil": "oil",
    "diesel": "oil",
    "coal": "coal",
}

# PJM "Status" values map roughly to GridPath's normalized phase taxonomy.
# This is intentionally conservative — anything we can't classify keeps the
# raw status string visible.
PHASE_MAP = {
    "withdrawn": "Withdrawn",
    "suspended": "Withdrawn",
    "terminated": "Withdrawn",
    "in service": "Energized",
    "commercial operation": "Energized",
    "engineering and procurement": "IA Executed",
    "engineering & procurement": "IA Executed",
    "construction": "IA Executed",
    "executed": "IA Executed",
    "gia executed": "IA Executed",
    "ia executed": "IA Executed",
    "confirmed": "IA Executed",
    "facilities study": "Facilities",
    "system impact study": "System Impact",
    "system impact": "System Impact",
    "feasibility study": "Feasibility",
    "feasibility": "Feasibility",
    "active": "Active",
}


def normalize_header(value: Any) -> str:
    return " ".join(str(value).strip().split())


def assert_expected_columns(columns: list[str]) -> None:
    normalized = {normalize_header(column) for column in columns}
    missing = sorted(EXPECTED_COLUMNS - normalized)
    has_capacity = any(
        candidate in normalized
        for candidate in ("MW Capacity", "Capacity (MW)", "MFO", "MFO MW")
    )
    if not has_capacity:
        missing.append("MW Capacity / Capacity (MW) / MFO")
    if missing:
        raise ValueError(f"PJM schema drift detected. Missing expected columns: {missing}")


def find_header_row(path: Path, sheet_name: str) -> int:
    preview = pd.read_excel(path, sheet_name=sheet_name, header=None, nrows=20)
    for index, row in preview.iterrows():
        values = {normalize_header(value) for value in row.tolist() if not pd.isna(value)}
        if {"Queue Number", "State", "County"}.issubset(values):
            return int(index)
    # Most PJM workbooks have headers on row 0 — fall back to that rather
    # than raising, since schema validation will catch a real mismatch.
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
            # Don't let a later alias clobber an earlier non-null value (PJM
            # workbooks occasionally include both "MW Capacity" and "MFO").
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
        iso="PJM",
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


def xml_project_to_row(element: ET.Element) -> dict[str, Any]:
    row: dict[str, Any] = {}
    for child in element:
        text = clean_text(child.text)
        if text == "N/A":
            text = None
        row[child.tag] = text
    return row


def xml_row_to_project(row: dict[str, Any], source_url: str | None = None) -> QueueProject | None:
    mapped: dict[str, Any] = {}
    for source, target in XML_FIELD_ALIASES.items():
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
        iso="PJM",
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
        ia_signed_date=None,
        energized_date=parse_date(mapped.get("energized_date")),
        withdrawn_date=parse_date(mapped.get("withdrawn_date")),
        owner_company=clean_text(mapped.get("owner_company")),
        raw_source_url=source_url,
        raw_data=row,
    )


def parse_xml_report(path: Path, source_url: str | None = None) -> list[QueueProject]:
    root = ET.fromstring(path.read_text(encoding="utf-8-sig"))
    projects: list[QueueProject] = []
    for element in root.findall(".//Project"):
        project = xml_row_to_project(xml_project_to_row(element), source_url)
        if project:
            projects.append(project)
    if not projects:
        raise ValueError("PJM schema drift detected. No project rows in XML export.")
    return projects


def parse_report(path: Path, source_url: str | None = None) -> list[QueueProject]:
    if path.suffix.lower() == ".xml":
        return parse_xml_report(path, source_url)
    with path.open("rb") as handle:
        prefix = handle.read(512).lstrip()
    if prefix.startswith(b"\xef\xbb\xbf"):
        prefix = prefix[3:].lstrip()
    if prefix.startswith(b"<?xml") or prefix.startswith(b"<Projects"):
        return parse_xml_report(path, source_url)
    return parse_workbook(path, source_url)


def parse_workbook(path: Path, source_url: str | None = None) -> list[QueueProject]:
    projects: list[QueueProject] = []
    try:
        workbook = pd.ExcelFile(path)
    except ValueError as exc:
        raise ValueError(
            "PJM report is not a readable Excel workbook or recognized XML export."
        ) from exc
    candidate_sheets = [sheet for sheet in workbook.sheet_names if sheet in PROJECT_SHEETS]
    # Fall back to the first sheet if PJM ships a single unnamed sheet.
    if not candidate_sheets:
        candidate_sheets = workbook.sheet_names[:1]
    if not candidate_sheets:
        raise ValueError("PJM schema drift detected. No usable sheet in workbook.")

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
    lower_url = url.lower()
    suffix = ".xml" if "xml" in content_type or lower_url.endswith(".xml") else ".xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(response.content)
        return Path(handle.name)


def source_report_for_file(path: Path, source_url: str | None = None) -> SourceReport:
    return SourceReport(
        iso="PJM",
        source_url=source_url or path.resolve().as_uri(),
        source_name=path.name,
        report_date=date.today(),
    )


def source_report_for_url(url: str) -> SourceReport:
    return SourceReport(
        iso="PJM",
        source_url=url,
        source_name="PJM New Services Queue",
        report_date=date.today(),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Ingest PJM New Services Queue into Neon Postgres."
    )
    parser.add_argument("--file", type=Path, help="Local PJM queue workbook")
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
    source_url = os.environ.get("PJM_QUEUE_URL") or DEFAULT_PJM_QUEUE_URL

    workbook_path = args.file
    if not workbook_path:
        workbook_path = download_report(source_url)
        report_source_url: str | None = source_url
    else:
        report_source_url = source_url if args.file is None else workbook_path.resolve().as_uri()

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
        print(json.dumps({"iso": "PJM", "projects_seen": len(projects), "dry_run": True}))
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
