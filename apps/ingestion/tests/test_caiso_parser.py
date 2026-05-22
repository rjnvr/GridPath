from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from gridpath_ingestion.caiso import assert_expected_columns, parse_workbook


def test_caiso_parser_normalizes_public_queue(tmp_path: Path) -> None:
    workbook = tmp_path / "publicqueuereport.xlsx"
    with pd.ExcelWriter(workbook) as writer:
        pd.DataFrame({"Notes": ["ignore", "ignore", "ignore"]}).to_excel(
            writer,
            sheet_name="Grid GenerationQueue",
            index=False,
            header=False,
        )
        pd.DataFrame(
            [
                {
                    "Project Name": "California Solar",
                    "Queue Position": "C15-001",
                    "Interconnection Request Receive Date": "2026-01-15",
                    "Application Status": "ACTIVE",
                    "Study Process": "Cluster",
                    "Type-1": "Photovoltaic",
                    "Fuel-1": "Solar",
                    "Net MWs to Grid": "150",
                    "County": "KERN",
                    "State": "CA",
                    "Substation": "Kern 230 kV",
                    "Utility": "SCE",
                    "Current On-line Date": "2029-01-01",
                    "System Impact Study or Phase I Cluster Study": "Complete",
                    "Facilities Study (FAS) or Phase II Cluster Study": "In Progress",
                    "Interconnection Agreement Status": "Not Started",
                }
            ]
        ).to_excel(writer, sheet_name="Grid GenerationQueue", index=False, startrow=3)

    projects = parse_workbook(workbook)

    assert len(projects) == 1
    assert projects[0].iso == "CAISO"
    assert projects[0].queue_id == "C15-001"
    assert projects[0].fuel_type == "solar"
    assert projects[0].current_phase == "System Impact"
    assert projects[0].lat is not None
    assert projects[0].lng is not None
    assert projects[0].location_source == "county_centroid"
    assert projects[0].location_confidence == "low"
    assert projects[0].point_of_interconnection == "Kern 230 kV"


def test_caiso_schema_drift_fails_loudly() -> None:
    with pytest.raises(ValueError, match="schema drift"):
        assert_expected_columns(["Queue Position", "County"])
