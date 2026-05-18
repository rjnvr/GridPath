from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from urllib.parse import urljoin

import httpx

ERCOT_GIS_REPORT_TYPE_ID = "15933"
ERCOT_DOC_LIST_URL = "https://www.ercot.com/misapp/servlets/IceDocListJsonWS"
ERCOT_DOWNLOAD_URL = "https://www.ercot.com/misdownload/servlets/mirDownload"
CAISO_PUBLIC_QUEUE_PAGE_URL = "https://www.caiso.com/library/public-queue-report"


@dataclass(frozen=True)
class DiscoveredReport:
    url: str
    name: str
    published_at: str | None = None
    report_date: date | None = None


def _report_date_from_publish_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _ercot_gis_reports_from_payload(payload: dict) -> list[DiscoveredReport]:
    documents = payload["ListDocsByRptTypeRes"]["DocumentList"]

    reports: list[DiscoveredReport] = []
    for item in documents:
        document = item["Document"]
        friendly_name = str(document.get("FriendlyName", ""))
        extension = str(document.get("Extension", "")).lower()
        if not friendly_name.startswith("GIS_Report_") or extension != "xlsx":
            continue
        doc_id = document["DocID"]
        published_at = document.get("PublishDate")
        reports.append(
            DiscoveredReport(
                url=f"{ERCOT_DOWNLOAD_URL}?doclookupId={doc_id}",
                name=friendly_name,
                published_at=published_at,
                report_date=_report_date_from_publish_date(published_at),
            )
        )
    return sorted(reports, key=lambda report: (report.published_at or "", report.name))


def list_ercot_gis_reports() -> list[DiscoveredReport]:
    response = httpx.get(
        ERCOT_DOC_LIST_URL,
        params={"reportTypeId": ERCOT_GIS_REPORT_TYPE_ID},
        timeout=60.0,
    )
    response.raise_for_status()
    reports = _ercot_gis_reports_from_payload(response.json())

    if not reports:
        raise RuntimeError("Could not discover latest ERCOT GIS xlsx report.")

    return reports


def discover_latest_ercot_gis_report() -> DiscoveredReport:
    return list_ercot_gis_reports()[-1]


def discover_ercot_gis_reports(limit: int | None = None) -> list[DiscoveredReport]:
    reports = list(reversed(list_ercot_gis_reports()))
    return reports[:limit] if limit else reports


def discover_latest_caiso_public_queue_report(
    page_url: str = CAISO_PUBLIC_QUEUE_PAGE_URL,
) -> DiscoveredReport:
    response = httpx.get(page_url, timeout=60.0, follow_redirects=True)
    response.raise_for_status()

    matches = re.findall(r'href=["\']([^"\']+publicqueuereport\.xlsx)["\']', response.text, re.I)
    if not matches:
        raise RuntimeError("Could not discover CAISO publicqueuereport.xlsx link.")

    report_url = urljoin(page_url, matches[0])
    return DiscoveredReport(url=report_url, name="Public Queue Report")
