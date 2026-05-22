from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from gridpath_ingestion.ercot import assert_expected_columns, parse_workbook


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
                    "Point of Interconnection": "Harris 345 kV",
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
    assert projects[0].state == "TX"
    assert projects[0].location_source == "county_centroid"
    assert projects[0].location_confidence == "low"
    assert projects[0].point_of_interconnection == "Harris 345 kV"


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


def test_parser_accepts_legacy_project_details_sheet(tmp_path: Path) -> None:
    workbook = tmp_path / "ercot-legacy.xlsx"
    with pd.ExcelWriter(workbook) as writer:
        pd.DataFrame({"Notes": ["ignore"] * 23}).to_excel(
            writer,
            sheet_name="Project Details",
            index=False,
            header=False,
        )
        pd.DataFrame(
            [
                {
                    "INR": "19INR001",
                    "Project Name": "Legacy Wind",
                    "Fuel": "Wind",
                    "County": "Nueces",
                    "Capacity (MW)": "226",
                    "GINR Study Phase": "FIS",
                    "IA Signed": "2019-04-01",
                    "Interconnecting Entity": "Legacy Energy",
                }
            ],
        ).to_excel(writer, sheet_name="Project Details", index=False, startrow=23)

    projects = parse_workbook(workbook)

    assert len(projects) == 1
    assert projects[0].queue_id == "19INR001"
    assert projects[0].current_phase == "System Impact"
    assert projects[0].ia_signed_date is not None
