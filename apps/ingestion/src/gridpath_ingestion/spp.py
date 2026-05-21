"""SPP Generator Interconnection Queue ingestion.

SPP publishes their Generator Interconnection Queue as an XLSX from
https://opsportal.spp.org (the link is bounced through a portal so the
default URL points at SPP's public queue download endpoint). Override
via `SPP_QUEUE_URL` if the path rotates.
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

from gridpath_ingestion.centroids import centroid_for_county
from gridpath_ingestion.db import record_source_report_failure, upsert_projects
from gridpath_ingestion.models import QueueProject, SourceReport

DEFAULT_SPP_QUEUE_URL = (
    "https://opsportal.spp.org/Studies/GenerateActiveCSV"
)

PROJECT_SHEETS = {
    "Active",
    "Generation Interconnection",
    "GI Queue",
    "Queue",
}

EXPECTED_COLUMNS = {
    "County",
    "State",
}

QUEUE_ID_COLUMNS = ("Request Number", "Queue Number", "GEN", "GI Number")

COLUMN_ALIASES = {
    "Request Number": "queue_id",
    "Queue Number": "queue_id",
    "GEN": "queue_id",
    "GI Number": "queue_id",
    "Customer Name": "project_name",
    "Project Name": "project_name",
    "Generation Type": "fuel_type",
    "Generator Type": "fuel_type",
    "Fuel": "fuel_type",
    "Fuel Type": "fuel_type",
    "Type": "fuel_type",
    "MW": "mw_requested",
    "Capacity MW": "mw_requested",
    "Capacity (MW)": "mw_requested",
    "Net MW": "mw_requested",
    "County": "county",
    "State": "state",
    "Status": "current_status",
    "Project Status": "current_status",
    "Date of IR": "filed_date",
    "Date of IR (Interconnection Request)": "filed_date",
    "Request Date": "filed_date",
    "Submission Date": "filed_date",
    "Application Date": "filed_date",
    "GIA Date": "ia_signed_date",
    "GIA Executed": "ia_signed_date",
    "GIA Executed Date": "ia_signed_date",
    "IA Executed": "ia_signed_date",
    "Commercial Operation Date": "energized_date",
    "Commercial Operation": "energized_date",
    "In Service Date": "energized_date",
    "Withdrawn Date": "withdrawn_date",
    "Withdraw Date": "withdrawn_date",
    "Withdrawal Date": "withdrawn_date",
    "Transmission Owner": "owner_company",
    "TO": "owner_company",
    "Interconnection Customer": "owner_company",
    "Customer": "owner_company",
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
    "coal": "coal",
    "oil": "oil",
    "diesel": "oil",
    "geothermal": "geothermal",
    "methane": "gas",
    "hybrid": "hybrid",
}

# SPP uses a DISIS (Definitive Interconnection System Impact Study) cluster
# process. Map their common status strings into GridPath's normalized phases.
PHASE_MAP = {
    "withdrawn": "Withdrawn",
    "suspended": "Withdrawn",
    "terminated": "Withdrawn",
    "in service": "Energized",
    "commercial operation": "Energized",
    "complete": "Energized",
    "gia executed": "IA Executed",
    "gia signed": "IA Executed",
    "ia executed": "IA Executed",
    "executed": "IA Executed",
    "facilities study": "Facilities",
    "fac study": "Facilities",
    "definitive": "System Impact",
    "disis": "System Impact",
    "system impact": "System Impact",
    "feasibility": "Feasibility",
    "fs": "Feasibility",
    "preliminary": "Feasibility",
    "active": "Active",
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
        for candidate in ("MW", "Capacity MW", "Capacity (MW)", "Net MW")
    )
    if not has_capacity:
        missing.append("MW / Capacity (MW) / Net MW")
    if missing:
        raise ValueError(f"SPP schema drift detected. Missing expected columns: {missing}")


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

    return QueueProject(
        iso="SPP",
        queue_id=queue_id,
        project_name=clean_text(mapped.get("project_name")),
        mw_requested=parse_decimal(mapped.get("mw_requested")),
        fuel_type=normalize_fuel(mapped.get("fuel_type")),
        county=county,
        state=state,
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
    candidate_sheets = [sheet for sheet in workbook.sheet_names if sheet in PROJECT_SHEETS]
    if not candidate_sheets:
        candidate_sheets = workbook.sheet_names[:1]
    if not candidate_sheets:
        raise ValueError("SPP schema drift detected. No usable sheet in workbook.")

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
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as handle:
        handle.write(response.content)
        return Path(handle.name)


def source_report_for_file(path: Path, source_url: str | None = None) -> SourceReport:
    return SourceReport(
        iso="SPP",
        source_url=source_url or path.resolve().as_uri(),
        source_name=path.name,
        report_date=date.today(),
    )


def source_report_for_url(url: str) -> SourceReport:
    return SourceReport(
        iso="SPP",
        source_url=url,
        source_name="SPP Generation Interconnection Queue",
        report_date=date.today(),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Ingest SPP Generator Interconnection Queue into Neon Postgres."
    )
    parser.add_argument("--file", type=Path, help="Local SPP queue workbook")
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
    source_url = os.environ.get("SPP_QUEUE_URL") or DEFAULT_SPP_QUEUE_URL

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
        projects = parse_workbook(workbook_path, report_source_url)
    except Exception as exc:
        if database_url and not args.dry_run:
            record_source_report_failure(database_url, source_report, str(exc))
        raise

    if args.dry_run:
        print(json.dumps({"iso": "SPP", "projects_seen": len(projects), "dry_run": True}))
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
