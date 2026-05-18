from __future__ import annotations

from decimal import Decimal

from gridpath_ingestion.events import classify_change, classify_new_project, stable_event_key
from gridpath_ingestion.models import QueueProject


def project(**overrides) -> QueueProject:
    return QueueProject(
        iso="ERCOT",
        queue_id="24INR001",
        project_name="Big Solar",
        **overrides,
    )


def test_new_project_event() -> None:
    event = classify_new_project(project())

    assert event.event_type == "new_project"
    assert event.severity == "watch"
    assert "Big Solar" in event.description


def test_phase_advance_and_regression_events() -> None:
    advanced = classify_change(project(), "current_phase", "Feasibility", "System Impact")
    regressed = classify_change(project(), "current_phase", "Facilities", "System Impact")

    assert advanced.event_type == "phase_advanced"
    assert advanced.severity == "important"
    assert regressed.event_type == "phase_regressed"
    assert regressed.severity == "watch"


def test_withdrawal_is_critical() -> None:
    phase_event = classify_change(project(), "current_phase", "System Impact", "Withdrawn")
    date_event = classify_change(project(), "withdrawn_date", None, "2026-05-01")

    assert phase_event.event_type == "withdrawn"
    assert phase_event.severity == "critical"
    assert date_event.event_type == "withdrawn"
    assert date_event.severity == "critical"


def test_owner_and_milestone_events() -> None:
    owner = classify_change(project(), "owner_company", "OldCo", "NewCo")
    filed = classify_change(project(), "filed_date", "2026-01-01", "2026-02-01")

    assert owner.event_type == "owner_changed"
    assert owner.severity == "important"
    assert filed.event_type == "milestone_date_changed"
    assert filed.severity == "watch"


def test_mw_thresholds() -> None:
    large_delta = classify_change(project(), "mw_requested", "100", "130")
    small_delta = classify_change(project(), "mw_requested", "100", "110")

    assert large_delta.event_type == "mw_increase"
    assert large_delta.delta_mw == Decimal("30")
    assert large_delta.severity == "important"
    assert small_delta.severity == "watch"


def test_stable_event_key_is_idempotent() -> None:
    first = stable_event_key(
        "project-id",
        "owner_changed",
        "owner_company",
        "A",
        "B",
        "2026-05-18",
    )
    second = stable_event_key(
        "project-id",
        "owner_changed",
        "owner_company",
        "A",
        "B",
        "2026-05-18",
    )
    changed = stable_event_key(
        "project-id",
        "owner_changed",
        "owner_company",
        "A",
        "C",
        "2026-05-18",
    )

    assert first == second
    assert first != changed
