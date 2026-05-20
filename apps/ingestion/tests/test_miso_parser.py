from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from gridpath_ingestion.miso import assert_expected_columns, parse_workbook


def test_parser_normalizes_required_fields(tmp_path: Path) -> None:
    workbook = tmp_path / "miso.xlsx"
    pd.DataFrame(
        [
            {
                "Project Number": "J2024-001",
                "Project Name": "Lakeshore Solar",
                "Summer MW": "300",
                "Generator Type": "Solar",
                "County": "Cook",
                "State": "IL",
                "Status": "Phase 2",
                "Queue Date": "2024-03-12",
                "Interconnection Customer": "Lakeshore Energy",
            }
        ]
    ).to_excel(workbook, sheet_name="GI Queue", index=False)

    projects = parse_workbook(workbook)

    assert len(projects) == 1
    assert projects[0].iso == "MISO"
    assert projects[0].queue_id == "J2024-001"
    assert projects[0].fuel_type == "solar"
    assert projects[0].current_phase == "System Impact"
    assert projects[0].state == "IL"
    assert projects[0].mw_requested is not None


def test_parser_maps_miso_phase_taxonomy(tmp_path: Path) -> None:
    workbook = tmp_path / "miso-phases.xlsx"
    pd.DataFrame(
        [
            {
                "Project Number": "M1-001",
                "Summer MW": "100",
                "County": "Cook",
                "State": "IL",
                "Status": "Phase 1",
            },
            {
                "Project Number": "M1-002",
                "Summer MW": "50",
                "County": "Cook",
                "State": "IL",
                "Status": "Phase III",
            },
            {
                "Project Number": "M1-003",
                "Summer MW": "200",
                "County": "Cook",
                "State": "IL",
                "Status": "GIA Executed",
            },
            {
                "Project Number": "M1-004",
                "Summer MW": "150",
                "County": "Cook",
                "State": "IL",
                "Status": "Withdrawn",
            },
            {
                "Project Number": "M1-005",
                "Summer MW": "75",
                "County": "Cook",
                "State": "IL",
                "Status": "In Service",
            },
        ]
    ).to_excel(workbook, sheet_name="GI Queue", index=False)

    projects = parse_workbook(workbook)
    by_queue = {project.queue_id: project for project in projects}

    assert by_queue["M1-001"].current_phase == "Feasibility"
    assert by_queue["M1-002"].current_phase == "Facilities"
    assert by_queue["M1-003"].current_phase == "IA Executed"
    assert by_queue["M1-004"].current_phase == "Withdrawn"
    assert by_queue["M1-005"].current_phase == "Energized"


def test_parser_accepts_alternate_queue_id_column(tmp_path: Path) -> None:
    workbook = tmp_path / "miso-alt.xlsx"
    pd.DataFrame(
        [
            {
                "Project #": "J2024-099",
                "Net MW": "120",
                "County": "Cook",
                "State": "IL",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="GI Queue", index=False)

    projects = parse_workbook(workbook)
    assert len(projects) == 1
    assert projects[0].queue_id == "J2024-099"


def test_parser_skips_rows_without_queue_id(tmp_path: Path) -> None:
    workbook = tmp_path / "miso-empty.xlsx"
    pd.DataFrame(
        [
            {
                "Project Number": "",
                "Summer MW": "100",
                "County": "Cook",
                "State": "IL",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="GI Queue", index=False)

    assert parse_workbook(workbook) == []


def test_schema_drift_fails_loudly() -> None:
    with pytest.raises(ValueError, match="schema drift"):
        assert_expected_columns(["Project Number", "Fuel"])
