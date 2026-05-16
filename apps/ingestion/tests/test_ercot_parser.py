from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from gridpath_ingestion.ercot import assert_expected_columns, parse_workbook


def write_workbook(path: Path, rows: list[dict[str, object]]) -> None:
    pd.DataFrame(rows).to_excel(path, index=False)


def test_parser_normalizes_required_fields(tmp_path: Path) -> None:
    workbook = tmp_path / "ercot.xlsx"
    write_workbook(
        workbook,
        [
            {
                "INR": "24INR001",
                "Project Name": "Big Solar",
                "Fuel": "Solar PV",
                "County": "Harris",
                "MW": "250",
                "Status": "FIS",
                "Application Received Date": "2024-01-05",
                "Owner": "Acme Energy",
            }
        ],
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
    write_workbook(
        workbook,
        [
            {
                "INR": "",
                "Project Name": "No Queue ID",
                "Fuel": "Wind",
                "County": "Dallas",
                "MW": "100",
                "Status": "Planning",
            }
        ],
    )

    assert parse_workbook(workbook) == []
