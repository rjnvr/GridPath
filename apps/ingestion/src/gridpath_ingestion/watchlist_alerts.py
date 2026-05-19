from __future__ import annotations

import argparse
import html
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

import httpx
import psycopg

ELIGIBLE_SEVERITIES = {"critical", "important"}
ELIGIBLE_EVENT_TYPES = {"new_project"}
RESEND_EMAIL_URL = "https://api.resend.com/emails"


@dataclass(frozen=True)
class WatchlistAlert:
    id: str
    user_id: str
    user_email: str
    name: str
    iso: str | None
    fuel_type: str | None
    phase: str | None
    mw_bucket: str | None
    owner_company: str | None
    last_emailed_at: datetime | None
    created_at: datetime


@dataclass(frozen=True)
class QueueEventAlert:
    id: str
    project_id: str
    iso: str
    queue_id: str
    project_name: str | None
    source_url: str | None
    source_name: str | None
    event_type: str
    severity: str
    title: str
    description: str
    event_at: datetime


@dataclass(frozen=True)
class WatchlistDigest:
    watchlist: WatchlistAlert
    events: list[QueueEventAlert]


@dataclass(frozen=True)
class UserDigest:
    user_id: str
    user_email: str
    watchlists: list[WatchlistDigest]


def event_is_eligible(event_type: str, severity: str) -> bool:
    return severity in ELIGIBLE_SEVERITIES or event_type in ELIGIBLE_EVENT_TYPES


def matches_mw_bucket(mw_requested: Decimal | int | float | None, mw_bucket: str | None) -> bool:
    if not mw_bucket:
        return True
    if mw_requested is None:
        return False
    mw = Decimal(str(mw_requested))
    if mw_bucket == "lt100":
        return mw < Decimal("100")
    if mw_bucket == "100to500":
        return Decimal("100") <= mw < Decimal("500")
    if mw_bucket == "gte500":
        return mw >= Decimal("500")
    return True


def group_watchlist_digests(
    items: list[tuple[WatchlistAlert, list[QueueEventAlert]]],
) -> list[UserDigest]:
    grouped: dict[str, UserDigest] = {}
    for watchlist, events in items:
        if not events:
            continue
        existing = grouped.get(watchlist.user_id)
        digest = WatchlistDigest(watchlist=watchlist, events=events)
        if existing is None:
            grouped[watchlist.user_id] = UserDigest(
                user_id=watchlist.user_id,
                user_email=watchlist.user_email,
                watchlists=[digest],
            )
        else:
            existing.watchlists.append(digest)
    return list(grouped.values())


def _format_time(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M UTC")


def _project_label(event: QueueEventAlert) -> str:
    return event.project_name or event.queue_id


def _project_url(app_url: str, project_id: str) -> str:
    return f"{app_url.rstrip('/')}/projects/{project_id}"


def render_email_payload(digest: UserDigest, app_url: str, from_email: str) -> dict[str, Any]:
    event_count = sum(len(watchlist.events) for watchlist in digest.watchlists)
    watchlist_count = len(digest.watchlists)
    subject = (
        f"GridPath: {event_count} queue event"
        f"{'' if event_count == 1 else 's'} across {watchlist_count} watchlist"
        f"{'' if watchlist_count == 1 else 's'}"
    )

    text_lines = [
        subject,
        "",
        "Watchlist impact brief",
        "",
    ]
    html_sections = [
        "<h1>Watchlist impact brief</h1>",
        f"<p>{event_count} matching queue event{'s' if event_count != 1 else ''}.</p>",
    ]

    for watchlist_digest in digest.watchlists:
        watchlist = watchlist_digest.watchlist
        text_lines.extend([f"Watchlist: {watchlist.name}", ""])
        html_sections.append(f"<h2>{html.escape(watchlist.name)}</h2>")
        html_sections.append("<ul>")
        for event in watchlist_digest.events:
            project_url = _project_url(app_url, event.project_id)
            source_text = event.source_name or event.source_url or "No source report"
            text_lines.extend(
                [
                    f"- {event.title} [{event.severity}]",
                    f"  Project: {_project_label(event)} ({event.iso} {event.queue_id})",
                    f"  Event time: {_format_time(event.event_at)}",
                    f"  Detail: {project_url}",
                    f"  Source: {source_text}",
                    f"  {event.description}",
                    "",
                ]
            )
            source_html = (
                f'<a href="{html.escape(event.source_url)}">{html.escape(source_text)}</a>'
                if event.source_url
                else html.escape(source_text)
            )
            html_sections.append(
                "<li>"
                f"<strong>{html.escape(event.title)}</strong> "
                f"({html.escape(event.severity)})<br>"
                f"{html.escape(_project_label(event))} "
                f"({html.escape(event.iso)} {html.escape(event.queue_id)})<br>"
                f"{html.escape(_format_time(event.event_at))}<br>"
                f'<a href="{html.escape(project_url)}">Open project</a><br>'
                f"Source: {source_html}<br>"
                f"{html.escape(event.description)}"
                "</li>"
            )
        html_sections.append("</ul>")

    text_lines.append("You can disable these alerts from Watchlists in GridPath.")
    html_sections.append("<p>You can disable these alerts from Watchlists in GridPath.</p>")

    return {
        "from": from_email,
        "to": [digest.user_email],
        "subject": subject,
        "text": "\n".join(text_lines),
        "html": "\n".join(html_sections),
    }


def _watchlist_from_row(row: tuple[Any, ...]) -> WatchlistAlert:
    return WatchlistAlert(
        id=str(row[0]),
        user_id=str(row[1]),
        user_email=str(row[2]),
        name=str(row[3]),
        iso=row[4],
        fuel_type=row[5],
        phase=row[6],
        mw_bucket=row[7],
        owner_company=row[8],
        last_emailed_at=row[9],
        created_at=row[10],
    )


def _event_from_row(row: tuple[Any, ...]) -> QueueEventAlert:
    return QueueEventAlert(
        id=str(row[0]),
        project_id=str(row[1]),
        iso=str(row[2]),
        queue_id=str(row[3]),
        project_name=row[4],
        source_url=row[5],
        source_name=row[6],
        event_type=str(row[7]),
        severity=str(row[8]),
        title=str(row[9]),
        description=str(row[10]),
        event_at=row[11],
    )


def load_email_watchlists(cursor: psycopg.Cursor) -> list[WatchlistAlert]:
    rows = cursor.execute(
        """
        select
          w.id,
          w.user_id,
          u.email,
          w.name,
          w.iso,
          w.fuel_type,
          w.phase,
          w.mw_bucket,
          w.owner_company,
          w.last_emailed_at,
          w.created_at
        from watchlists w
        join users u on u.id = w.user_id
        where w.notify_email = true
          and u.email is not null
        order by u.email, w.created_at
        """
    ).fetchall()
    return [_watchlist_from_row(row) for row in rows]


def load_matching_events(
    cursor: psycopg.Cursor,
    watchlist: WatchlistAlert,
    limit: int,
) -> list[QueueEventAlert]:
    threshold = watchlist.last_emailed_at or watchlist.created_at
    clauses = [
        "e.event_at > %s",
        "(e.severity in ('critical', 'important') or e.event_type = 'new_project')",
    ]
    params: list[Any] = [threshold]

    if watchlist.iso:
        clauses.append("p.iso = %s")
        params.append(watchlist.iso)
    if watchlist.fuel_type:
        clauses.append("p.fuel_type = %s")
        params.append(watchlist.fuel_type)
    if watchlist.phase:
        clauses.append("p.current_phase = %s")
        params.append(watchlist.phase)
    if watchlist.owner_company:
        clauses.append("p.owner_company ilike %s")
        params.append(f"%{watchlist.owner_company}%")
    if watchlist.mw_bucket == "lt100":
        clauses.append("p.mw_requested is not null and p.mw_requested < 100")
    elif watchlist.mw_bucket == "100to500":
        clauses.append("p.mw_requested is not null and p.mw_requested >= 100")
        clauses.append("p.mw_requested < 500")
    elif watchlist.mw_bucket == "gte500":
        clauses.append("p.mw_requested is not null and p.mw_requested >= 500")

    params.append(limit)
    rows = cursor.execute(
        f"""
        select
          e.id,
          e.project_id,
          p.iso,
          p.queue_id,
          p.project_name,
          r.source_url,
          r.source_name,
          e.event_type,
          e.severity,
          e.title,
          e.description,
          e.event_at
        from queue_events e
        join projects p on p.id = e.project_id
        left join source_reports r on r.id = e.source_report_id
        where {" and ".join(clauses)}
        order by e.event_at desc, e.created_at desc
        limit %s
        """,
        params,
    ).fetchall()
    return [_event_from_row(row) for row in rows]


def collect_user_digests(database_url: str, limit_per_watchlist: int) -> list[UserDigest]:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        watchlists = load_email_watchlists(cursor)
        watchlist_events = [
            (watchlist, load_matching_events(cursor, watchlist, limit_per_watchlist))
            for watchlist in watchlists
        ]
    return group_watchlist_digests(watchlist_events)


def send_email(payload: dict[str, Any], api_key: str) -> None:
    response = httpx.post(
        RESEND_EMAIL_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=20,
    )
    response.raise_for_status()


def mark_watchlists_emailed(database_url: str, watchlist_ids: list[str]) -> None:
    if not watchlist_ids:
        return
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            update watchlists
            set last_emailed_at = now(),
                updated_at = now()
            where id = any(%s::uuid[])
            """,
            (watchlist_ids,),
        )


def send_watchlist_alerts(
    database_url: str,
    app_url: str,
    from_email: str,
    api_key: str | None,
    *,
    dry_run: bool = False,
    limit_per_watchlist: int = 50,
) -> dict[str, int]:
    digests = collect_user_digests(database_url, limit_per_watchlist)
    summary = {
        "users_with_alerts": len(digests),
        "watchlists_with_alerts": sum(len(digest.watchlists) for digest in digests),
        "events": sum(
            len(watchlist_digest.events)
            for digest in digests
            for watchlist_digest in digest.watchlists
        ),
        "emails_sent": 0,
    }
    if dry_run:
        return summary
    if digests and not api_key:
        raise RuntimeError("Set AUTH_RESEND_KEY to send watchlist impact briefs.")

    for digest in digests:
        payload = render_email_payload(digest, app_url, from_email)
        send_email(payload, api_key or "")
        mark_watchlists_emailed(
            database_url,
            [watchlist_digest.watchlist.id for watchlist_digest in digest.watchlists],
        )
        summary["emails_sent"] += 1
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Send GridPath watchlist impact briefs.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit-per-watchlist", type=int, default=50)
    args = parser.parse_args(argv)

    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")

    app_url = os.environ.get("AUTH_URL") or "http://localhost:3000"
    from_email = os.environ.get("AUTH_EMAIL_FROM") or "GridPath <onboarding@resend.dev>"
    api_key = os.environ.get("AUTH_RESEND_KEY") or None

    summary = send_watchlist_alerts(
        database_url,
        app_url,
        from_email,
        api_key,
        dry_run=args.dry_run,
        limit_per_watchlist=args.limit_per_watchlist,
    )
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
