from __future__ import annotations

COUNTY_CENTROIDS: dict[str, dict[str, tuple[float, float]]] = {
    "TX": {
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
    },
    "CA": {
        "ALAMEDA": (37.6466, -121.8929),
        "BUTTE": (39.6659, -121.6019),
        "COLUSA": (39.1777, -122.2370),
        "CONTRA COSTA": (37.9195, -121.9515),
        "FRESNO": (36.7582, -119.6493),
        "HUMBOLDT": (40.7067, -123.9258),
        "IMPERIAL": (33.0396, -115.3654),
        "KERN": (35.3428, -118.7299),
        "KINGS": (36.0754, -119.8155),
        "LAKE": (39.0948, -122.7468),
        "LOS ANGELES": (34.1964, -118.2619),
        "MADERA": (37.2151, -119.7666),
        "MERCED": (37.1948, -120.7228),
        "MONTEREY": (36.2401, -121.3156),
        "RIVERSIDE": (33.7437, -115.9938),
        "SACRAMENTO": (38.4493, -121.3443),
        "SAN BERNARDINO": (34.8414, -116.1785),
        "SAN DIEGO": (33.0236, -116.7761),
        "SAN FRANCISCO": (37.7749, -122.4194),
        "SAN JOAQUIN": (37.9348, -121.2722),
        "SAN LUIS OBISPO": (35.3852, -120.4475),
        "SANTA BARBARA": (34.5371, -120.0396),
        "SANTA CLARA": (37.2207, -121.6906),
        "SOLANO": (38.2672, -121.9396),
        "STANISLAUS": (37.5623, -121.0028),
        "TULARE": (36.2288, -118.7811),
    },
}


def centroid_for_county(county: str | None, state: str) -> tuple[float | None, float | None]:
    if not county:
        return None, None
    normalized = county.upper().replace(" COUNTY", "").strip()
    if "/" in normalized:
        normalized = normalized.split("/", maxsplit=1)[0].strip()
    return COUNTY_CENTROIDS.get(state.upper(), {}).get(normalized, (None, None))
