from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from gridpath_ingestion.watchlist_alerts import (
    QueueEventAlert,
    WatchlistAlert,
    event_is_eligible,
    group_watchlist_digests,
    matches_mw_bucket,
    render_email_payload,
)


def watchlist(**overrides) -> WatchlistAlert:
    values = {
        "id": "11111111-1111-1111-1111-111111111111",
        "user_id": "user-1",
        "user_email": "analyst@example.com",
        "name": "ERCOT storage movers",
        "iso": "ERCOT",
        "fuel_type": "storage",
        "phase": None,
        "mw_bucket": "gte500",
        "owner_company": None,
        "last_emailed_at": None,
        "created_at": datetime(2026, 5, 18, tzinfo=UTC),
    }
    values.update(overrides)
    return WatchlistAlert(**values)


def event(**overrides) -> QueueEventAlert:
    values = {
        "id": "event-1",
        "project_id": "22222222-2222-2222-2222-222222222222",
        "iso": "ERCOT",
        "queue_id": "24INR001",
        "project_name": "Big Battery",
        "source_url": "https://example.com/report.xlsx",
        "source_name": "GIS Report",
        "event_type": "mw_increase",
        "severity": "important",
        "title": "MW requested increased",
        "description": "Big Battery increased from 400 MW to 600 MW.",
        "event_at": datetime(2026, 5, 19, 12, 30, tzinfo=UTC),
    }
    values.update(overrides)
    return QueueEventAlert(**values)


def test_event_eligibility_defaults() -> None:
    assert event_is_eligible("mw_decrease", "critical")
    assert event_is_eligible("owner_changed", "important")
    assert event_is_eligible("new_project", "watch")
    assert not event_is_eligible("status_changed", "watch")


def test_matches_mw_bucket() -> None:
    assert matches_mw_bucket(Decimal("99.9"), "lt100")
    assert not matches_mw_bucket(Decimal("100"), "lt100")
    assert matches_mw_bucket(Decimal("100"), "100to500")
    assert matches_mw_bucket(Decimal("499.9"), "100to500")
    assert not matches_mw_bucket(Decimal("500"), "100to500")
    assert matches_mw_bucket(Decimal("500"), "gte500")
    assert not matches_mw_bucket(None, "gte500")
    assert matches_mw_bucket(None, None)


def test_group_watchlist_digests_sends_one_digest_per_user() -> None:
    first = watchlist(id="11111111-1111-1111-1111-111111111111")
    second = watchlist(id="33333333-3333-3333-3333-333333333333", name="CAISO movers")
    ignored = watchlist(id="44444444-4444-4444-4444-444444444444", user_id="user-2")

    digests = group_watchlist_digests(
        [
            (first, [event(id="event-1")]),
            (second, [event(id="event-2")]),
            (ignored, []),
        ]
    )

    assert len(digests) == 1
    assert digests[0].user_email == "analyst@example.com"
    assert [digest.watchlist.name for digest in digests[0].watchlists] == [
        "ERCOT storage movers",
        "CAISO movers",
    ]


def test_render_email_payload_includes_required_event_context() -> None:
    digest = group_watchlist_digests([(watchlist(), [event()])])[0]

    payload = render_email_payload(
        digest,
        app_url="https://gridpath.example",
        from_email="GridPath <alerts@example.com>",
    )

    assert payload["from"] == "GridPath <alerts@example.com>"
    assert payload["to"] == ["analyst@example.com"]
    assert "1 queue event" in payload["subject"]
    assert "ERCOT storage movers" in payload["text"]
    assert "MW requested increased" in payload["text"]
    assert "Big Battery (ERCOT 24INR001)" in payload["text"]
    assert "https://gridpath.example/projects/22222222-2222-2222-2222-222222222222" in payload[
        "text"
    ]
    assert "GIS Report" in payload["text"]
    assert "https://example.com/report.xlsx" in payload["html"]
