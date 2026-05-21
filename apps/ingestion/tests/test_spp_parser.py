from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from gridpath_ingestion.spp import assert_expected_columns, parse_workbook


def test_parser_normalizes_required_fields(tmp_path: Path) -> None:
    workbook = tmp_path / "spp.xlsx"
    pd.DataFrame(
        [
            {
                "Request Number": "GEN-2024-001",
                "Customer Name": "Plains Wind",
                "MW": "350",
                "Generation Type": "Wind",
                "County": "Cleveland",
                "State": "OK",
                "Status": "Active",
                "Request Date": "2024-04-08",
                "Interconnection Customer": "Plains Energy",
            }
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    projects = parse_workbook(workbook)

    assert len(projects) == 1
    assert projects[0].iso == "SPP"
    assert projects[0].queue_id == "GEN-2024-001"
    assert projects[0].fuel_type == "wind"
    assert projects[0].current_phase == "Active"
    assert projects[0].state == "OK"
    assert projects[0].mw_requested is not None


def test_parser_maps_spp_phase_taxonomy(tmp_path: Path) -> None:
    workbook = tmp_path / "spp-phases.xlsx"
    pd.DataFrame(
        [
            {
                "Request Number": "S1-001",
                "MW": "100",
                "County": "Cleveland",
                "State": "OK",
                "Status": "DISIS Cluster",
            },
            {
                "Request Number": "S1-002",
                "MW": "50",
                "County": "Cleveland",
                "State": "OK",
                "Status": "Facilities Study",
            },
            {
                "Request Number": "S1-003",
                "MW": "75",
                "County": "Cleveland",
                "State": "OK",
                "Status": "GIA Executed",
            },
            {
                "Request Number": "S1-004",
                "MW": "200",
                "County": "Cleveland",
                "State": "OK",
                "Status": "Withdrawn",
            },
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    by_queue = {project.queue_id: project for project in parse_workbook(workbook)}

    assert by_queue["S1-001"].current_phase == "System Impact"
    assert by_queue["S1-002"].current_phase == "Facilities"
    assert by_queue["S1-003"].current_phase == "IA Executed"
    assert by_queue["S1-004"].current_phase == "Withdrawn"


def test_parser_accepts_alternate_queue_id_column(tmp_path: Path) -> None:
    workbook = tmp_path / "spp-alt.xlsx"
    pd.DataFrame(
        [
            {
                "GI Number": "GI-9001",
                "Capacity MW": "120",
                "County": "Cleveland",
                "State": "OK",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    projects = parse_workbook(workbook)
    assert len(projects) == 1
    assert projects[0].queue_id == "GI-9001"


def test_parser_skips_rows_without_queue_id(tmp_path: Path) -> None:
    workbook = tmp_path / "spp-empty.xlsx"
    pd.DataFrame(
        [
            {
                "Request Number": "",
                "MW": "100",
                "County": "Cleveland",
                "State": "OK",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    assert parse_workbook(workbook) == []


def test_schema_drift_fails_loudly() -> None:
    with pytest.raises(ValueError, match="schema drift"):
        assert_expected_columns(["Request Number", "Fuel"])
