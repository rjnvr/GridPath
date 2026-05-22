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
                "Project Name": "Sunflower Solar",
                "Nameplate MW": "250",
                "Generation Type": "Solar",
                "County": "Sedgwick",
                "State": "KS",
                "Status": "DISIS",
                "Queue Date": "2024-02-10",
                "Interconnection Customer": "Sunflower Energy",
            }
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    projects = parse_workbook(workbook)

    assert len(projects) == 1
    assert projects[0].iso == "SPP"
    assert projects[0].queue_id == "GEN-2024-001"
    assert projects[0].fuel_type == "solar"
    assert projects[0].current_phase == "System Impact"
    assert projects[0].state == "KS"
    assert projects[0].mw_requested is not None


def test_parser_maps_spp_phase_taxonomy(tmp_path: Path) -> None:
    workbook = tmp_path / "spp-phases.xlsx"
    pd.DataFrame(
        [
            {
                "Request Number": "S-001",
                "Nameplate MW": "100",
                "County": "X",
                "State": "KS",
                "Status": "Feasibility",
            },
            {
                "Request Number": "S-002",
                "Nameplate MW": "50",
                "County": "X",
                "State": "KS",
                "Status": "DISIS",
            },
            {
                "Request Number": "S-003",
                "Nameplate MW": "200",
                "County": "X",
                "State": "KS",
                "Status": "AFS",
            },
            {
                "Request Number": "S-004",
                "Nameplate MW": "150",
                "County": "X",
                "State": "KS",
                "Status": "IA Executed",
            },
            {
                "Request Number": "S-005",
                "Nameplate MW": "75",
                "County": "X",
                "State": "KS",
                "Status": "Withdrawn",
            },
            {
                "Request Number": "S-006",
                "Nameplate MW": "60",
                "County": "X",
                "State": "KS",
                "Status": "In Service",
            },
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    by_queue = {p.queue_id: p for p in parse_workbook(workbook)}

    assert by_queue["S-001"].current_phase == "Feasibility"
    assert by_queue["S-002"].current_phase == "System Impact"
    assert by_queue["S-003"].current_phase == "Facilities"
    assert by_queue["S-004"].current_phase == "IA Executed"
    assert by_queue["S-005"].current_phase == "Withdrawn"
    assert by_queue["S-006"].current_phase == "Energized"


def test_parser_accepts_alternate_queue_id_column(tmp_path: Path) -> None:
    workbook = tmp_path / "spp-alt.xlsx"
    pd.DataFrame(
        [
            {
                "GI Number": "GI-2024-099",
                "Net MW": "120",
                "County": "Sedgwick",
                "State": "KS",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    projects = parse_workbook(workbook)
    assert len(projects) == 1
    assert projects[0].queue_id == "GI-2024-099"


def test_parser_skips_rows_without_queue_id(tmp_path: Path) -> None:
    workbook = tmp_path / "spp-empty.xlsx"
    pd.DataFrame(
        [
            {
                "Request Number": "",
                "Nameplate MW": "100",
                "County": "Sedgwick",
                "State": "KS",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="Active", index=False)

    assert parse_workbook(workbook) == []


def test_parser_reads_csv(tmp_path: Path) -> None:
    csv_path = tmp_path / "spp.csv"
    pd.DataFrame(
        [
            {
                "Request Number": "GEN-2024-777",
                "Nameplate MW": "180",
                "Generation Type": "Wind",
                "County": "Ford",
                "State": "KS",
                "Status": "AFS",
            }
        ]
    ).to_csv(csv_path, index=False)

    projects = parse_workbook(csv_path)
    assert len(projects) == 1
    assert projects[0].queue_id == "GEN-2024-777"
    assert projects[0].fuel_type == "wind"
    assert projects[0].current_phase == "Facilities"


def test_schema_drift_fails_loudly() -> None:
    with pytest.raises(ValueError, match="schema drift"):
        assert_expected_columns(["Request Number", "Fuel"])
