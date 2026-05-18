from __future__ import annotations

import httpx

from gridpath_ingestion.discovery import (
    ERCOT_DOC_LIST_URL,
    discover_latest_caiso_public_queue_report,
    discover_latest_ercot_gis_report,
    list_ercot_gis_reports,
)
from gridpath_ingestion.ercot import select_reports_for_backfill, successful_report_prefix_length


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
    assert report.report_date is not None


def test_lists_ercot_gis_reports_oldest_to_newest(monkeypatch) -> None:
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
                                "FriendlyName": "GIS_Report_April2026",
                                "Extension": "xlsx",
                                "DocID": "april",
                                "PublishDate": "2026-05-01T13:53:52-05:00",
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
                    ]
                }
            },
        )

    monkeypatch.setattr("gridpath_ingestion.discovery.httpx.get", fake_get)

    reports = list_ercot_gis_reports()

    assert [report.name for report in reports] == ["GIS_Report_March2026", "GIS_Report_April2026"]
    assert select_reports_for_backfill(reports, {reports[0].url}, force=False) == [reports[1]]
    assert select_reports_for_backfill(reports, {reports[0].url}, force=True) == reports
    assert successful_report_prefix_length(reports, {reports[0].url}) == 1
    assert successful_report_prefix_length(reports, {reports[1].url}) == 0


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
