from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

from gridpath_ingestion.location_enrichment import (
    EiaPlantRecord,
    ProjectRecord,
    SubstationRecord,
    best_location_candidate,
    load_eia_plants,
    match_eia_plant,
    match_poi_substation,
    should_update_location,
)


def project_record(**overrides: object) -> ProjectRecord:
    values = {
        "id": "project-1",
        "iso": "ERCOT",
        "queue_id": "24INR001",
        "project_name": "Big Solar",
        "mw_requested": Decimal("250"),
        "fuel_type": "solar",
        "county": "Harris",
        "state": "TX",
        "lat": Decimal("29.8578"),
        "lng": Decimal("-95.3936"),
        "location_source": "county_centroid",
        "location_confidence": "low",
        "location_notes": "Derived from county centroid; not a project address.",
        "point_of_interconnection": "Harris 345 kV",
        "current_phase": "System Impact",
        "current_status": "FIS",
        "energized_date": None,
        "owner_company": "Acme Energy LLC",
    }
    values.update(overrides)
    return ProjectRecord(**values)


def test_load_eia_plants_accepts_common_lat_lng_headers(tmp_path: Path) -> None:
    path = tmp_path / "eia.csv"
    path.write_text(
        "Plant Code,Plant Name,Utility Name,State,County,Latitude,Longitude\n"
        "12345,Big Solar,Acme Energy,TX,Harris,29.123,-95.456\n",
        encoding="utf-8",
    )

    plants = load_eia_plants(path)

    assert len(plants) == 1
    assert plants[0].plant_id == "12345"
    assert plants[0].lat == Decimal("29.123")
    assert plants[0].lng == Decimal("-95.456")


def test_completed_project_matches_eia_plant_coordinates() -> None:
    project = project_record(current_phase="Energized", energized_date=date(2025, 5, 1))
    plants = [
        EiaPlantRecord(
            plant_id="12345",
            plant_name="Big Solar Project",
            utility_name="Acme Energy",
            state="TX",
            county="Harris",
            lat=Decimal("29.123"),
            lng=Decimal("-95.456"),
            source_name="eia860m.csv",
        )
    ]

    candidate = match_eia_plant(project, plants)

    assert candidate is not None
    assert candidate.source == "eia_860m_plant"
    assert candidate.confidence == "high"
    assert candidate.lat == Decimal("29.123")
    assert candidate.lng == Decimal("-95.456")


def test_active_project_matches_poi_substation_as_medium_confidence() -> None:
    project = project_record()
    substations = [
        SubstationRecord(
            id="sub-1",
            hifld_id="hifld-1",
            name="Harris",
            owner="Acme Power",
            voltage_kv=Decimal("345"),
            lat=Decimal("29.75"),
            lng=Decimal("-95.37"),
        )
    ]

    candidate = match_poi_substation(project, substations)

    assert candidate is not None
    assert candidate.source == "poi_substation_match"
    assert candidate.confidence == "medium"
    assert "not necessarily the project parcel" in candidate.notes
    assert candidate.lat == Decimal("29.75")
    assert candidate.lng == Decimal("-95.37")


def test_weak_poi_match_is_not_used() -> None:
    project = project_record(point_of_interconnection="Harris 345 kV")
    substations = [
        SubstationRecord(
            id="sub-1",
            hifld_id="hifld-1",
            name="Completely Different",
            owner=None,
            voltage_kv=Decimal("345"),
            lat=Decimal("29.75"),
            lng=Decimal("-95.37"),
        )
    ]

    assert match_poi_substation(project, substations) is None


def test_eia_candidate_beats_poi_candidate_for_completed_project() -> None:
    project = project_record(current_phase="Energized", energized_date=date(2025, 5, 1))
    plants = [
        EiaPlantRecord(
            plant_id="12345",
            plant_name="Big Solar",
            utility_name="Acme Energy",
            state="TX",
            county="Harris",
            lat=Decimal("29.123"),
            lng=Decimal("-95.456"),
            source_name="eia860m.csv",
        )
    ]
    substations = [
        SubstationRecord(
            id="sub-1",
            hifld_id="hifld-1",
            name="Harris",
            owner="Acme Power",
            voltage_kv=Decimal("345"),
            lat=Decimal("29.75"),
            lng=Decimal("-95.37"),
        )
    ]

    candidate = best_location_candidate(project, plants, substations)

    assert candidate is not None
    assert candidate.source == "eia_860m_plant"


def test_does_not_replace_existing_high_precision_coordinates() -> None:
    project = project_record(location_source="eia_860m_plant")
    candidate = match_poi_substation(
        project,
        [
            SubstationRecord(
                id="sub-1",
                hifld_id="hifld-1",
                name="Harris",
                owner="Acme Power",
                voltage_kv=Decimal("345"),
                lat=Decimal("29.75"),
                lng=Decimal("-95.37"),
            )
        ],
    )

    assert should_update_location(project, candidate) is False
