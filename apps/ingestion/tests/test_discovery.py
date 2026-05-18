from __future__ import annotations

import httpx

from gridpath_ingestion.discovery import (
    ERCOT_DOC_LIST_URL,
    discover_ercot_gis_reports,
    discover_latest_caiso_public_queue_report,
    discover_latest_ercot_gis_report,
    ercot_gis_reports_from_payload,
)


def test_discovers_latest_ercot_gis_report(monkeypatch) -> None:
    def fake_get(url: str, **kwargs):
        assert url == ERCOT_DOC_LIST_URL
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "ListDocsByRptTypeRes": {
                    "DocumentList": [
                        {
                            "Document": {
                                "FriendlyName": (
                                    "Co-located_Battery_Identification_Report_April_2026"
                                ),
                                "Extension": "xlsx",
                                "DocID": "battery",
                                "PublishDate": "2026-05-05T14:31:25-05:00",
                            }
                        },
                        {
                            "Document": {
                                "FriendlyName": "GIS_Report_March2026",
                                "Extension": "xlsx",
                                "DocID": "march",
                                "PublishDate": "2026-04-02T15:47:02-05:00",
                            }
                        },
                        {
                            "Document": {
                                "FriendlyName": "GIS_Report_April2026",
                                "Extension": "xlsx",
                                "DocID": "april",
                                "PublishDate": "2026-05-01T13:53:52-05:00",
                            }
                        },
                    ]
                }
            },
        )

    monkeypatch.setattr("gridpath_ingestion.discovery.httpx.get", fake_get)

    report = discover_latest_ercot_gis_report()

    assert report.name == "GIS_Report_April2026"
    assert report.url.endswith("doclookupId=april")


def test_discovers_multiple_ercot_gis_reports_in_newest_order() -> None:
    reports = ercot_gis_reports_from_payload(
        {
            "ListDocsByRptTypeRes": {
                "DocumentList": [
                    {
                        "Document": {
                            "FriendlyName": "GIS_Report_March2026",
                            "Extension": "xlsx",
                            "DocID": "march",
                            "PublishDate": "2026-04-02T15:47:02-05:00",
                        }
                    },
                    {
                        "Document": {
                            "FriendlyName": "Not_A_GIS_Report",
                            "Extension": "xlsx",
                            "DocID": "skip",
                            "PublishDate": "2026-05-03T13:53:52-05:00",
                        }
                    },
                    {
                        "Document": {
                            "FriendlyName": "GIS_Report_April2026",
                            "Extension": "xlsx",
                            "DocID": "april",
                            "PublishDate": "2026-05-01T13:53:52-05:00",
                        }
                    },
                ]
            }
        }
    )

    assert [report.name for report in reports] == ["GIS_Report_April2026", "GIS_Report_March2026"]


def test_discover_ercot_gis_reports_honors_limit(monkeypatch) -> None:
    def fake_get(url: str, **kwargs):
        assert url == ERCOT_DOC_LIST_URL
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "ListDocsByRptTypeRes": {
                    "DocumentList": [
                        {
                            "Document": {
                                "FriendlyName": "GIS_Report_March2026",
                                "Extension": "xlsx",
                                "DocID": "march",
                                "PublishDate": "2026-04-02T15:47:02-05:00",
                            }
                        },
                        {
                            "Document": {
                                "FriendlyName": "GIS_Report_April2026",
                                "Extension": "xlsx",
                                "DocID": "april",
                                "PublishDate": "2026-05-01T13:53:52-05:00",
                            }
                        },
                    ]
                }
            },
        )

    monkeypatch.setattr("gridpath_ingestion.discovery.httpx.get", fake_get)

    reports = discover_ercot_gis_reports(limit=1)

    assert len(reports) == 1
    assert reports[0].name == "GIS_Report_April2026"


def test_discovers_caiso_xlsx_link(monkeypatch) -> None:
    def fake_get(url: str, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            text='<a href="/documents/publicqueuereport.pdf">pdf</a>'
            '<a href="/documents/publicqueuereport.xlsx">xlsx</a>',
        )

    monkeypatch.setattr("gridpath_ingestion.discovery.httpx.get", fake_get)

    report = discover_latest_caiso_public_queue_report("https://www.caiso.com/library/test")

    assert report.url == "https://www.caiso.com/documents/publicqueuereport.xlsx"
