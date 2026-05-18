from __future__ import annotations

import hashlib
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from gridpath_ingestion.models import QueueProject

QueueEventType = str
QueueEventSeverity = str

PHASE_RANK = {
    "Active": 1,
    "Feasibility": 1,
    "System Impact": 2,
    "Facilities": 3,
    "IA Executed": 4,
    "Energized": 5,
}

MILESTONE_FIELDS = {"filed_date", "ia_signed_date", "energized_date", "withdrawn_date"}


@dataclass(frozen=True)
class QueueEventDraft:
    event_type: QueueEventType
    severity: QueueEventSeverity
    title: str
    description: str
    field_name: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    delta_mw: Decimal | None = None


def _display_project(project: QueueProject) -> str:
    return project.project_name or project.queue_id


def _display_value(value: str | None) -> str:
    return value if value not in (None, "") else "empty"


def _decimal(value: str | None) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except InvalidOperation:
        return None


def _important_mw_delta(
    old_value: str | None,
    new_value: str | None,
) -> tuple[Decimal | None, bool]:
    old = _decimal(old_value)
    new = _decimal(new_value)
    if old is None or new is None:
        return None, False
    delta = new - old
    absolute_important = abs(delta) >= Decimal("100")
    pct_important = old != 0 and abs(delta / old) >= Decimal("0.20")
    return delta, absolute_important or pct_important


def stable_event_key(
    project_id: str,
    event_type: str,
    field_name: str | None,
    old_value: str | None,
    new_value: str | None,
    event_date: str,
) -> str:
    parts = [
        project_id,
        event_type,
        field_name or "",
        old_value or "",
        new_value or "",
        event_date,
    ]
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return f"{project_id}:{digest}"


def classify_new_project(project: QueueProject) -> QueueEventDraft:
    display = _display_project(project)
    return QueueEventDraft(
        event_type="new_project",
        severity="watch",
        title="New queue project",
        description=f"{display} entered the {project.iso} queue.",
        new_value=project.queue_id,
    )


def classify_change(
    project: QueueProject,
    field_name: str,
    old_value: str | None,
    new_value: str | None,
) -> QueueEventDraft:
    display = _display_project(project)

    if field_name == "current_phase":
        if new_value == "Withdrawn":
            return QueueEventDraft(
                "withdrawn",
                "critical",
                "Project withdrawn",
                f"{display} was marked withdrawn.",
                field_name,
                old_value,
                new_value,
            )
        if new_value == "Energized":
            return QueueEventDraft(
                "energized",
                "important",
                "Project energized",
                f"{display} reached energized status.",
                field_name,
                old_value,
                new_value,
            )
        if new_value == "IA Executed":
            return QueueEventDraft(
                "ia_executed",
                "important",
                "Interconnection agreement executed",
                f"{display} reached IA Executed.",
                field_name,
                old_value,
                new_value,
            )
        old_rank = PHASE_RANK.get(old_value or "")
        new_rank = PHASE_RANK.get(new_value or "")
        if old_rank is not None and new_rank is not None and new_rank > old_rank:
            return QueueEventDraft(
                "phase_advanced",
                "important",
                f"Phase advanced to {new_value}",
                (
                    f"{display} advanced from {_display_value(old_value)} "
                    f"to {_display_value(new_value)}."
                ),
                field_name,
                old_value,
                new_value,
            )
        if old_rank is not None and new_rank is not None and new_rank < old_rank:
            return QueueEventDraft(
                "phase_regressed",
                "watch",
                f"Phase regressed to {new_value}",
                (
                    f"{display} moved from {_display_value(old_value)} "
                    f"back to {_display_value(new_value)}."
                ),
                field_name,
                old_value,
                new_value,
            )
        return QueueEventDraft(
            "status_changed",
            "watch",
            "Phase changed",
            (
                f"{display} changed phase from {_display_value(old_value)} "
                f"to {_display_value(new_value)}."
            ),
            field_name,
            old_value,
            new_value,
        )

    if field_name == "current_status":
        normalized = (new_value or "").lower()
        if "withdraw" in normalized:
            event_type, severity, title = "withdrawn", "critical", "Project withdrawn"
        elif "energiz" in normalized:
            event_type, severity, title = "energized", "important", "Project energized"
        elif (
            "ia signed" in normalized
            or "agreement signed" in normalized
            or "executed" in normalized
        ):
            event_type, severity, title = (
                "ia_executed",
                "important",
                "Interconnection agreement executed",
            )
        else:
            event_type, severity, title = "status_changed", "watch", "Status changed"
        return QueueEventDraft(
            event_type,
            severity,
            title,
            (
                f"{display} status changed from {_display_value(old_value)} "
                f"to {_display_value(new_value)}."
            ),
            field_name,
            old_value,
            new_value,
        )

    if field_name == "mw_requested":
        delta, is_important = _important_mw_delta(old_value, new_value)
        if delta is None:
            old_mw = _decimal(old_value) or Decimal(0)
            new_mw = _decimal(new_value) or Decimal(0)
            delta = new_mw - old_mw
        event_type = "mw_increase" if delta > 0 else "mw_decrease"
        direction = "increased" if event_type == "mw_increase" else "decreased"
        return QueueEventDraft(
            event_type,
            "important" if is_important else "watch",
            f"MW requested {direction}",
            (
                f"{display} {direction} from {_display_value(old_value)} MW "
                f"to {_display_value(new_value)} MW."
            ),
            field_name,
            old_value,
            new_value,
            delta,
        )

    if field_name == "owner_company":
        return QueueEventDraft(
            "owner_changed",
            "important",
            "Owner changed",
            (
                f"{display} owner changed from {_display_value(old_value)} "
                f"to {_display_value(new_value)}."
            ),
            field_name,
            old_value,
            new_value,
        )

    if field_name == "withdrawn_date" and new_value:
        return QueueEventDraft(
            "withdrawn",
            "critical",
            "Project withdrawn",
            f"{display} received a withdrawn date of {new_value}.",
            field_name,
            old_value,
            new_value,
        )

    if field_name == "ia_signed_date" and new_value:
        return QueueEventDraft(
            "ia_executed",
            "important",
            "Interconnection agreement executed",
            f"{display} received an IA signed date of {new_value}.",
            field_name,
            old_value,
            new_value,
        )

    if field_name == "energized_date" and new_value:
        return QueueEventDraft(
            "energized",
            "important",
            "Project energized",
            f"{display} received an energized date of {new_value}.",
            field_name,
            old_value,
            new_value,
        )

    if field_name in MILESTONE_FIELDS:
        return QueueEventDraft(
            "milestone_date_changed",
            "watch",
            "Milestone date changed",
            (
                f"{display} changed {field_name} from {_display_value(old_value)} "
                f"to {_display_value(new_value)}."
            ),
            field_name,
            old_value,
            new_value,
        )

    return QueueEventDraft(
        "project_field_changed",
        "info",
        "Project field changed",
        (
            f"{display} changed {field_name} from {_display_value(old_value)} "
            f"to {_display_value(new_value)}."
        ),
        field_name,
        old_value,
        new_value,
    )
