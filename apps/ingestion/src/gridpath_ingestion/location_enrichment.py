from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg

LOW_PRECISION_SOURCES = {None, "", "county", "county_centroid", "state_centroid"}
HIGH_PRECISION_SOURCES = {"project_site", "source_lat_lng", "eia_860_plant", "eia_860m_plant"}
POI_PRECISION_SOURCES = {"poi_substation_match", "hifld_poi_substation"}

CORPORATE_STOPWORDS = {
    "co",
    "company",
    "corp",
    "corporation",
    "energy",
    "holdings",
    "inc",
    "llc",
    "lp",
    "ltd",
    "power",
    "renewable",
    "renewables",
}

GENERIC_LOCATION_WORDS = {
    "bus",
    "interconnection",
    "kv",
    "line",
    "poi",
    "point",
    "station",
    "sub",
    "substation",
    "switch",
    "switching",
    "tap",
}


@dataclass(frozen=True)
class ProjectRecord:
    id: str
    iso: str
    queue_id: str
    project_name: str | None
    mw_requested: Decimal | None
    fuel_type: str | None
    county: str | None
    state: str | None
    lat: Decimal | None
    lng: Decimal | None
    location_source: str | None
    location_confidence: str | None
    location_notes: str | None
    point_of_interconnection: str | None
    current_phase: str | None
    current_status: str | None
    energized_date: date | None
    owner_company: str | None


@dataclass(frozen=True)
class SubstationRecord:
    id: str
    hifld_id: str
    name: str | None
    owner: str | None
    voltage_kv: Decimal | None
    lat: Decimal
    lng: Decimal


@dataclass(frozen=True)
class EiaPlantRecord:
    plant_id: str | None
    plant_name: str
    utility_name: str | None
    state: str | None
    county: str | None
    lat: Decimal
    lng: Decimal
    source_name: str


@dataclass(frozen=True)
class LocationCandidate:
    lat: Decimal
    lng: Decimal
    source: str
    confidence: str
    notes: str
    score: float
    match_id: str | None = None


def normalize_text(value: str | None, *, drop_location_words: bool = False) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", " ", value.lower())
    tokens = []
    for token in normalized.split():
        if token in CORPORATE_STOPWORDS:
            continue
        if drop_location_words and token in GENERIC_LOCATION_WORDS:
            continue
        tokens.append(token)
    return " ".join(tokens)


def text_similarity(
    left: str | None,
    right: str | None,
    *,
    drop_location_words: bool = False,
) -> float:
    normalized_left = normalize_text(left, drop_location_words=drop_location_words)
    normalized_right = normalize_text(right, drop_location_words=drop_location_words)
    if not normalized_left or not normalized_right:
        return 0.0

    sequence_score = SequenceMatcher(None, normalized_left, normalized_right).ratio()
    left_tokens = set(normalized_left.split())
    right_tokens = set(normalized_right.split())
    token_score = len(left_tokens & right_tokens) / len(left_tokens | right_tokens)
    return max(sequence_score, token_score)


def decimal_or_none(value: Any) -> Decimal | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).replace(",", "").strip()
    if not text:
        return None
    try:
        return Decimal(text)
    except Exception:
        return None


def decimal_in_range(value: Any, low: float, high: float) -> Decimal | None:
    parsed = decimal_or_none(value)
    if parsed is None:
        return None
    numeric = float(parsed)
    return parsed if low <= numeric <= high else None


def first_column_value(row: dict[str, Any], aliases: Iterable[str]) -> Any:
    normalized = {normalize_header(key): value for key, value in row.items()}
    for alias in aliases:
        value = normalized.get(normalize_header(alias))
        if value is not None and not pd.isna(value) and str(value).strip():
            return value
    return None


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def load_eia_plants(path: Path, source_name: str | None = None) -> list[EiaPlantRecord]:
    frame = (
        pd.read_excel(path) if path.suffix.lower() in {".xlsx", ".xls"} else pd.read_csv(path)
    )

    plants: list[EiaPlantRecord] = []
    for row in frame.to_dict(orient="records"):
        lat = decimal_in_range(
            first_column_value(row, ["Latitude", "Plant Latitude", "lat", "Y"]), -90, 90
        )
        lng = decimal_in_range(
            first_column_value(row, ["Longitude", "Plant Longitude", "lon", "lng", "X"]),
            -180,
            180,
        )
        name = clean_text(
            first_column_value(row, ["Plant Name", "Plant", "plant_name", "plantName"])
        )
        if lat is None or lng is None or not name:
            continue
        plants.append(
            EiaPlantRecord(
                plant_id=clean_text(
                    first_column_value(row, ["Plant Code", "Plant ID", "plant_id", "plantCode"])
                ),
                plant_name=name,
                utility_name=clean_text(
                    first_column_value(
                        row,
                        ["Utility Name", "Operator Name", "Owner Name", "utility_name"],
                    )
                ),
                state=clean_text(first_column_value(row, ["State", "Plant State"])),
                county=clean_text(first_column_value(row, ["County", "Plant County"])),
                lat=lat,
                lng=lng,
                source_name=source_name or path.name,
            )
        )
    return plants


def clean_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def is_completed_project(project: ProjectRecord) -> bool:
    phase = normalize_text(project.current_phase)
    status = normalize_text(project.current_status)
    return bool(
        project.energized_date
        or phase in {"energized", "completed", "commercial operation"}
        or any(marker in status for marker in ("energized", "in service", "commercial operation"))
    )


def mw_score(project_mw: Decimal | None, plant_mw: Decimal | None = None) -> float:
    if project_mw is None or plant_mw is None:
        return 0.5
    project_value = float(project_mw)
    plant_value = float(plant_mw)
    if project_value <= 0 or plant_value <= 0:
        return 0.5
    ratio = min(project_value, plant_value) / max(project_value, plant_value)
    return max(0.0, min(1.0, ratio))


def match_eia_plant(
    project: ProjectRecord,
    plants: list[EiaPlantRecord],
) -> LocationCandidate | None:
    if not is_completed_project(project):
        return None

    best: tuple[float, EiaPlantRecord] | None = None
    for plant in plants:
        if project.state and plant.state and project.state.upper() != plant.state.upper():
            continue

        name = text_similarity(project.project_name, plant.plant_name)
        owner = text_similarity(project.owner_company, plant.utility_name)
        county = 1.0 if same_text(project.county, plant.county) else 0.0

        score = (
            (name * 0.72)
            + (owner * 0.12)
            + (county * 0.12)
            + (mw_score(project.mw_requested) * 0.04)
        )
        if name < 0.64 and (owner < 0.72 or county < 1.0):
            continue
        if best is None or score > best[0]:
            best = (score, plant)

    if best is None or best[0] < 0.74:
        return None

    score, plant = best
    return LocationCandidate(
        lat=plant.lat,
        lng=plant.lng,
        source="eia_860m_plant",
        confidence="high",
        notes=(
            "Matched completed project to EIA plant coordinates"
            f" from {plant.source_name}"
            f"{f' (plant {plant.plant_id})' if plant.plant_id else ''}."
        ),
        score=score,
        match_id=plant.plant_id,
    )


def same_text(left: str | None, right: str | None) -> bool:
    return bool(left and right and normalize_text(left) == normalize_text(right))


def extract_voltage_kv(value: str | None) -> Decimal | None:
    if not value:
        return None
    match = re.search(r"\b(\d{2,4})(?:\.\d+)?\s*k\s*v\b", value.lower())
    if not match:
        match = re.search(r"\b(\d{2,4})(?:\.\d+)?\b", value)
    if not match:
        return None
    return Decimal(match.group(1))


def voltage_score(project_voltage: Decimal | None, substation_voltage: Decimal | None) -> float:
    if project_voltage is None or substation_voltage is None:
        return 0.5
    difference = abs(float(project_voltage - substation_voltage))
    if difference <= 1:
        return 1.0
    if difference <= 15:
        return 0.85
    if difference <= 40:
        return 0.55
    return 0.0


def haversine_miles(
    lat1: Decimal | None,
    lng1: Decimal | None,
    lat2: Decimal | None,
    lng2: Decimal | None,
) -> float | None:
    if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
        return None
    radius_miles = 3958.7613
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2 - lat1))
    delta_lambda = math.radians(float(lng2 - lng1))
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return radius_miles * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distance_score(distance_miles: float | None) -> float:
    if distance_miles is None:
        return 0.5
    if distance_miles <= 10:
        return 1.0
    if distance_miles <= 30:
        return 0.85
    if distance_miles <= 60:
        return 0.65
    if distance_miles <= 100:
        return 0.35
    return 0.0


def match_poi_substation(
    project: ProjectRecord,
    substations: list[SubstationRecord],
) -> LocationCandidate | None:
    if not project.point_of_interconnection:
        return None

    project_voltage = extract_voltage_kv(project.point_of_interconnection)
    best: tuple[float, float | None, SubstationRecord] | None = None
    for substation in substations:
        name = text_similarity(
            project.point_of_interconnection,
            substation.name,
            drop_location_words=True,
        )
        if name < 0.72:
            continue

        owner = text_similarity(project.owner_company, substation.owner)
        voltage = voltage_score(project_voltage, substation.voltage_kv)
        distance = haversine_miles(project.lat, project.lng, substation.lat, substation.lng)
        distance_component = distance_score(distance)
        score = (name * 0.68) + (voltage * 0.14) + (owner * 0.08) + (distance_component * 0.10)

        if distance is not None and distance > 125:
            score -= 0.25
        if voltage == 0.0:
            score -= 0.10
        if best is None or score > best[0]:
            best = (score, distance, substation)

    if best is None or best[0] < 0.78:
        return None

    score, distance, substation = best
    distance_note = (
        f" approximately {distance:.1f} miles from the prior centroid" if distance else ""
    )
    return LocationCandidate(
        lat=substation.lat,
        lng=substation.lng,
        source="poi_substation_match",
        confidence="medium",
        notes=(
            "Matched point of interconnection to HIFLD substation coordinates"
            f"{distance_note}; this is the interconnection point, "
            "not necessarily the project parcel."
        ),
        score=score,
        match_id=substation.id,
    )


def should_update_location(project: ProjectRecord, candidate: LocationCandidate | None) -> bool:
    if candidate is None:
        return False
    current_source = project.location_source
    if current_source in HIGH_PRECISION_SOURCES:
        return False
    if candidate.source in HIGH_PRECISION_SOURCES:
        return True
    if current_source in POI_PRECISION_SOURCES:
        return candidate.score >= 0.9
    return current_source in LOW_PRECISION_SOURCES


def best_location_candidate(
    project: ProjectRecord,
    eia_plants: list[EiaPlantRecord],
    substations: list[SubstationRecord],
) -> LocationCandidate | None:
    eia_candidate = match_eia_plant(project, eia_plants)
    if eia_candidate is not None:
        return eia_candidate
    return match_poi_substation(project, substations)


def fetch_projects(
    cursor: psycopg.Cursor,
    iso: str | None,
    limit: int | None,
) -> list[ProjectRecord]:
    query = """
        select
          id, iso, queue_id, project_name, mw_requested, fuel_type, county, state,
          lat, lng, location_source, location_confidence, location_notes,
          point_of_interconnection, current_phase, current_status, energized_date,
          owner_company
        from projects
        where (%s is null or iso = %s)
          and (
            location_source is null
            or location_source in (
              'county',
              'county_centroid',
              'state_centroid',
              'poi_substation_match'
            )
          )
        order by iso, queue_id
    """
    params: list[Any] = [iso, iso]
    if limit is not None:
        query += " limit %s"
        params.append(limit)
    rows = cursor.execute(query, params).fetchall()
    columns = [desc.name for desc in cursor.description] if cursor.description else []
    projects: list[ProjectRecord] = []
    for row in rows:
        record = dict(zip(columns, row, strict=False))
        record["id"] = str(record["id"])
        projects.append(ProjectRecord(**record))
    return projects


def fetch_substations(cursor: psycopg.Cursor) -> list[SubstationRecord]:
    rows = cursor.execute(
        """
        select id, hifld_id, name, owner, voltage_kv, lat, lng
        from substations
        where lat is not null and lng is not null
        """
    ).fetchall()
    columns = [desc.name for desc in cursor.description] if cursor.description else []
    substations: list[SubstationRecord] = []
    for row in rows:
        record = dict(zip(columns, row, strict=False))
        record["id"] = str(record["id"])
        record["hifld_id"] = str(record["hifld_id"])
        substations.append(SubstationRecord(**record))
    return substations


def comparable(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value)
    return str(value)


def insert_location_change_rows(
    cursor: psycopg.Cursor,
    project: ProjectRecord,
    candidate: LocationCandidate,
) -> None:
    changed_fields = {
        "lat": (project.lat, candidate.lat),
        "lng": (project.lng, candidate.lng),
        "location_source": (project.location_source, candidate.source),
        "location_confidence": (project.location_confidence, candidate.confidence),
        "location_notes": (project.location_notes, candidate.notes),
    }
    for field_name, (old_value, new_value) in changed_fields.items():
        old_comparable = comparable(old_value)
        new_comparable = comparable(new_value)
        if old_comparable == new_comparable:
            continue
        cursor.execute(
            """
            insert into project_status_changes (
              project_id, source_report_id, changed_at, field_name, old_value, new_value
            )
            values (%s, null, now(), %s, %s, %s)
            """,
            (project.id, field_name, old_comparable, new_comparable),
        )


def update_project_location(
    cursor: psycopg.Cursor,
    project: ProjectRecord,
    candidate: LocationCandidate,
) -> None:
    insert_location_change_rows(cursor, project, candidate)
    cursor.execute(
        """
        update projects
        set lat = %(lat)s,
            lng = %(lng)s,
            geom = st_setsrid(
              st_makepoint(%(lng)s::double precision, %(lat)s::double precision),
              4326
            ),
            location_source = %(source)s,
            location_confidence = %(confidence)s,
            location_notes = %(notes)s,
            last_updated_at = now()
        where id = %(project_id)s
        """,
        {
            "project_id": project.id,
            "lat": str(candidate.lat),
            "lng": str(candidate.lng),
            "source": candidate.source,
            "confidence": candidate.confidence,
            "notes": candidate.notes,
        },
    )


def enrich_project_locations(
    database_url: str,
    eia_plant_files: list[Path] | None = None,
    iso: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    eia_plants = [
        plant
        for path in eia_plant_files or []
        for plant in load_eia_plants(path, source_name=path.name)
    ]
    stats: dict[str, Any] = {
        "projects_seen": 0,
        "projects_matched": 0,
        "projects_updated": 0,
        "eia_plants_loaded": len(eia_plants),
        "dry_run": dry_run,
        "matches": [],
    }

    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        projects = fetch_projects(cursor, iso, limit)
        substations = fetch_substations(cursor)
        stats["projects_seen"] = len(projects)
        stats["substations_loaded"] = len(substations)

        for project in projects:
            candidate = best_location_candidate(project, eia_plants, substations)
            if not should_update_location(project, candidate):
                continue

            assert candidate is not None
            stats["projects_matched"] += 1
            stats["matches"].append(
                {
                    "iso": project.iso,
                    "queue_id": project.queue_id,
                    "source": candidate.source,
                    "confidence": candidate.confidence,
                    "score": round(candidate.score, 3),
                    "match_id": candidate.match_id,
                }
            )
            if not dry_run:
                update_project_location(cursor, project, candidate)
                stats["projects_updated"] += 1

    return stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Enrich project coordinates from EIA plant data and HIFLD POI matches."
    )
    parser.add_argument(
        "--eia-plant-file",
        action="append",
        type=Path,
        default=[],
        help="EIA-860/860M plant CSV or XLSX with plant latitude/longitude. Repeatable.",
    )
    parser.add_argument("--iso", help="Limit enrichment to one ISO.")
    parser.add_argument("--limit", type=int, help="Limit projects processed.")
    parser.add_argument("--dry-run", action="store_true", help="Report matches without updating.")
    args = parser.parse_args(argv)

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")

    stats = enrich_project_locations(
        database_url=database_url,
        eia_plant_files=args.eia_plant_file,
        iso=args.iso,
        limit=args.limit,
        dry_run=args.dry_run,
    )
    print(json.dumps(stats, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
