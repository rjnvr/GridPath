from __future__ import annotations

COUNTY_CENTROIDS: dict[str, tuple[float, float]] = {
    "ANDERSON": (31.8153, -95.6535),
    "ANDREWS": (32.3047, -102.6377),
    "BEXAR": (29.4489, -98.5200),
    "BRAZORIA": (29.1678, -95.4347),
    "CAMERON": (26.1291, -97.5247),
    "DALLAS": (32.7666, -96.7778),
    "ECTOR": (31.8692, -102.5425),
    "EL PASO": (31.7668, -106.2414),
    "FORT BEND": (29.5266, -95.7710),
    "HARRIS": (29.8578, -95.3936),
    "HIDALGO": (26.3964, -98.1800),
    "HOUSTON": (31.3189, -95.4222),
    "JEFFERSON": (29.8849, -94.1492),
    "LUBBOCK": (33.6115, -101.8199),
    "MIDLAND": (31.8693, -102.0316),
    "NUECES": (27.7336, -97.5169),
    "PECOS": (30.7712, -102.7236),
    "TARRANT": (32.7714, -97.2915),
    "TRAVIS": (30.3342, -97.7819),
    "WILLIAMSON": (30.6490, -97.6008),
}


def centroid_for_county(county: str | None) -> tuple[float | None, float | None]:
    if not county:
        return None, None
    normalized = county.upper().replace(" COUNTY", "").strip()
    return COUNTY_CENTROIDS.get(normalized, (None, None))
