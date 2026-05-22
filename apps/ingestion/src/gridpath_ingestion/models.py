from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class QueueProject(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    iso: str
    queue_id: str
    project_name: str | None = None
    mw_requested: Decimal | None = None
    fuel_type: str | None = None
    county: str | None = None
    state: str | None = None
    lat: float | None = None
    lng: float | None = None
    location_source: str | None = None
    location_confidence: str | None = None
    address: str | None = None
    point_of_interconnection: str | None = None
    location_notes: str | None = None
    current_phase: str | None = None
    current_status: str | None = None
    filed_date: date | None = None
    ia_signed_date: date | None = None
    energized_date: date | None = None
    withdrawn_date: date | None = None
    owner_company: str | None = None
    raw_source_url: str | None = None
    raw_data: dict[str, Any] = Field(default_factory=dict)


class SourceReport(BaseModel):
    iso: str
    source_url: str
    source_name: str | None = None
    published_at: str | None = None
    report_date: date | None = None
