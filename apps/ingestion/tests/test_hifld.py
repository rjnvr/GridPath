from __future__ import annotations

from gridpath_ingestion.hifld import first_value


def test_hifld_id_can_use_stable_id_field() -> None:
    assert first_value({"ID": "abc", "OBJECTID": "1"}, ["ID", "OBJECTID"]) == "abc"
