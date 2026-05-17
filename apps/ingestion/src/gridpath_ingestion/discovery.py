from __future__ import annotations

import re
from dataclasses import dataclass
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


def discover_latest_ercot_gis_report() -> DiscoveredReport:
    response = httpx.get(
        ERCOT_DOC_LIST_URL,
        params={"reportTypeId": ERCOT_GIS_REPORT_TYPE_ID},
        timeout=60.0,
    )
    response.raise_for_status()
    payload = response.json()
    documents = payload["ListDocsByRptTypeRes"]["DocumentList"]

    candidates = []
    for item in documents:
        document = item["Document"]
        friendly_name = str(document.get("FriendlyName", ""))
        extension = str(document.get("Extension", "")).lower()
        if not friendly_name.startswith("GIS_Report_") or extension != "xlsx":
            continue
        candidates.append(document)

    if not candidates:
        raise RuntimeError("Could not discover latest ERCOT GIS xlsx report.")

    latest = max(candidates, key=lambda document: str(document.get("PublishDate", "")))
    doc_id = latest["DocID"]
    return DiscoveredReport(
        url=f"{ERCOT_DOWNLOAD_URL}?doclookupId={doc_id}",
        name=str(latest.get("FriendlyName", "GIS Report")),
        published_at=latest.get("PublishDate"),
    )


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
