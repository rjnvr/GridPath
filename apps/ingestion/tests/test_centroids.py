from __future__ import annotations

from gridpath_ingestion.centroids import centroid_for_county


def test_known_county_returns_precise_centroid() -> None:
    lat, lng = centroid_for_county("Loudoun", "VA")
    assert lat is not None and lng is not None
    # Loudoun is around 39.08N, -77.65W
    assert 38.5 < lat < 39.5
    assert -78.5 < lng < -77.0


def test_unknown_county_falls_back_to_state_center() -> None:
    lat, lng = centroid_for_county("MadeUpCounty", "VA")
    assert lat is not None and lng is not None
    # Should be Virginia state center (~37.77, -78.17), not (None, None).
    assert 36.5 < lat < 39.5
    assert -83.0 < lng < -75.0


def test_missing_county_falls_back_to_state_center() -> None:
    lat, lng = centroid_for_county(None, "IL")
    assert lat is not None and lng is not None
    # Illinois state center is around 40.35N, -88.99W
    assert 38.0 < lat < 42.5


def test_unknown_state_returns_none() -> None:
    assert centroid_for_county("Acme", "ZZ") == (None, None)


def test_parish_suffix_is_stripped_for_louisiana() -> None:
    lat, lng = centroid_for_county("Orleans Parish", "LA")
    assert lat is not None and lng is not None
    # Orleans Parish is around 29.97N, -90.07W
    assert 29.5 < lat < 30.5
    assert -90.5 < lng < -89.5


def test_existing_texas_lookup_unchanged() -> None:
    # Regression: pre-existing ERCOT behavior must still hit county-level precision.
    lat, lng = centroid_for_county("Harris", "TX")
    assert lat is not None and lng is not None
    assert 29.5 < lat < 30.5
    assert -96.0 < lng < -94.5
