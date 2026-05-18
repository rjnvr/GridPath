from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from gridpath_ingestion.discovery import DiscoveredReport
from gridpath_ingestion.ercot import assert_expected_columns, main, parse_workbook


def write_workbook(path: Path, rows: list[dict[str, object]]) -> None:
    pd.DataFrame(rows).to_excel(path, index=False)


def test_parser_normalizes_required_fields(tmp_path: Path) -> None:
    workbook = tmp_path / "ercot.xlsx"
    with pd.ExcelWriter(workbook) as writer:
        pd.DataFrame({"Notes": ["ignore", "ignore"]}).to_excel(
            writer,
            sheet_name="Project Details - Large Gen",
            index=False,
            header=False,
        )
        pd.DataFrame(
            [
                {
                    "INR": "24INR001",
                    "Project Name": "Big Solar",
                    "Fuel": "Solar PV",
                    "County": "Harris",
                    "Capacity (MW)": "250",
                    "GIM Study Phase": "FIS",
                    "Screening Study Started": "2024-01-05",
                    "Interconnecting Entity": "Acme Energy",
                }
            ],
        ).to_excel(
            writer,
            sheet_name="Project Details - Large Gen",
            index=False,
            startrow=2,
        )

    projects = parse_workbook(workbook)

    assert len(projects) == 1
    assert projects[0].queue_id == "24INR001"
    assert projects[0].fuel_type == "solar"
    assert projects[0].current_phase == "System Impact"
    assert projects[0].lat is not None
    assert projects[0].lng is not None


def test_schema_drift_fails_loudly() -> None:
    with pytest.raises(ValueError, match="schema drift"):
        assert_expected_columns(["INR", "Project Name"])


def test_parser_skips_rows_without_queue_id(tmp_path: Path) -> None:
    workbook = tmp_path / "ercot.xlsx"
    with pd.ExcelWriter(workbook) as writer:
        pd.DataFrame(
            [
                {
                    "INR": "",
                    "Project Name": "No Queue ID",
                    "Fuel": "Wind",
                    "County": "Dallas",
                    "Capacity (MW)": "100",
                    "GIM Study Phase": "Planning",
                }
            ],
        ).to_excel(writer, sheet_name="Project Details - Large Gen", index=False)

    assert parse_workbook(workbook) == []


def test_backfill_uses_historical_snapshots_without_updating_current(monkeypatch) -> None:
    calls = []

    monkeypatch.setattr(
        "gridpath_ingestion.ercot.discover_ercot_gis_reports",
        lambda limit: [
            DiscoveredReport(
                url="https://example.test/april.xlsx",
                name="GIS_Report_April2026",
                published_at="2026-05-01T13:53:52-05:00",
            ),
            DiscoveredReport(
                url="https://example.test/march.xlsx",
                name="GIS_Report_March2026",
                published_at="2026-04-02T15:47:02-05:00",
            ),
        ][:limit],
    )
    monkeypatch.setattr(
        "gridpath_ingestion.ercot.download_report",
        lambda url: Path("/tmp/report.xlsx"),
    )
    monkeypatch.setattr("gridpath_ingestion.ercot.parse_workbook", lambda path, source_url=None: [])

    def fake_upsert(projects, database_url, **kwargs):
        calls.append(kwargs)
        return {"snapshots_written": 0}

    monkeypatch.setattr("gridpath_ingestion.ercot.upsert_projects", fake_upsert)
    monkeypatch.setenv("DIRECT_DATABASE_URL", "postgresql://example")

    assert main(["--backfill-months", "2"]) == 0

    assert [call["report_name"] for call in calls] == [
        "GIS_Report_March2026",
        "GIS_Report_April2026",
    ]
    assert all(call["update_current"] is False for call in calls)
