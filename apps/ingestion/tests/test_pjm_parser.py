from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from gridpath_ingestion.pjm import assert_expected_columns, parse_workbook, parse_xml_report


def test_parser_normalizes_required_fields(tmp_path: Path) -> None:
    workbook = tmp_path / "pjm.xlsx"
    pd.DataFrame(
        [
            {
                "Queue Number": "AC1-001",
                "Project Name": "Acme Solar",
                "MW Capacity": "200",
                "Fuel": "Solar PV",
                "County": "Loudoun",
                "State": "VA",
                "Status": "Active",
                "Submitted Date": "2024-02-15",
                "Interconnection Customer": "Acme Energy",
            }
        ]
    ).to_excel(workbook, sheet_name="New Services Queue", index=False)

    projects = parse_workbook(workbook)

    assert len(projects) == 1
    assert projects[0].iso == "PJM"
    assert projects[0].queue_id == "AC1-001"
    assert projects[0].fuel_type == "solar"
    assert projects[0].current_phase == "Active"
    assert projects[0].state == "VA"
    assert projects[0].mw_requested is not None


def test_parser_maps_pjm_statuses_to_phases(tmp_path: Path) -> None:
    workbook = tmp_path / "pjm-statuses.xlsx"
    pd.DataFrame(
        [
            {
                "Queue Number": "X1-001",
                "MW Capacity": "100",
                "County": "Allegheny",
                "State": "PA",
                "Status": "Engineering & Procurement",
            },
            {
                "Queue Number": "X1-002",
                "MW Capacity": "50",
                "County": "Cook",
                "State": "IL",
                "Status": "Withdrawn",
            },
            {
                "Queue Number": "X1-003",
                "MW Capacity": "150",
                "County": "Loudoun",
                "State": "VA",
                "Status": "In Service",
            },
        ]
    ).to_excel(workbook, sheet_name="New Services Queue", index=False)

    projects = parse_workbook(workbook)
    by_queue = {project.queue_id: project for project in projects}

    assert by_queue["X1-001"].current_phase == "IA Executed"
    assert by_queue["X1-002"].current_phase == "Withdrawn"
    assert by_queue["X1-003"].current_phase == "Energized"


def test_parser_skips_rows_without_queue_id(tmp_path: Path) -> None:
    workbook = tmp_path / "pjm-empty.xlsx"
    pd.DataFrame(
        [
            {
                "Queue Number": "",
                "MW Capacity": "100",
                "County": "Loudoun",
                "State": "VA",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="New Services Queue", index=False)

    assert parse_workbook(workbook) == []


def test_parser_falls_back_to_first_sheet_when_unnamed(tmp_path: Path) -> None:
    workbook = tmp_path / "pjm-unnamed.xlsx"
    pd.DataFrame(
        [
            {
                "Queue Number": "Z1-001",
                "MW Capacity": "75",
                "County": "Loudoun",
                "State": "VA",
                "Status": "Active",
            }
        ]
    ).to_excel(workbook, sheet_name="Sheet1", index=False)

    projects = parse_workbook(workbook)
    assert len(projects) == 1
    assert projects[0].queue_id == "Z1-001"


def test_xml_parser_reads_current_public_export_shape(tmp_path: Path) -> None:
    report = tmp_path / "pjm.xml"
    report.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
        <Projects>
          <Project>
            <ProjectNumber>AE1-070</ProjectNumber>
            <Name>Elwood 345 kV</Name>
            <State>IL</State>
            <County>Will</County>
            <Status>Active</Status>
            <TransmissionOwner>ComEd</TransmissionOwner>
            <MaximumFacilityOutput>1610.0</MaximumFacilityOutput>
            <MWCapacity>135.0</MWCapacity>
            <ProjectType>Generation Interconnection</ProjectType>
            <Fuel>Natural Gas</Fuel>
            <SubmittedDate>7/31/2018</SubmittedDate>
          </Project>
        </Projects>
        """
    )

    projects = parse_xml_report(report)

    assert len(projects) == 1
    assert projects[0].iso == "PJM"
    assert projects[0].queue_id == "AE1-070"
    assert projects[0].fuel_type == "gas"
    assert projects[0].current_phase == "Active"
    assert projects[0].state == "IL"
    assert projects[0].mw_requested is not None


def test_schema_drift_fails_loudly() -> None:
    with pytest.raises(ValueError, match="schema drift"):
        assert_expected_columns(["Queue Number", "Fuel"])  # Missing State, County, capacity
