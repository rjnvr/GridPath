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
    # --- PJM states (top counties prioritized by data-center / interconnect activity) ---
    "VA": {
        "LOUDOUN": (39.0840, -77.6553),
        "PRINCE WILLIAM": (38.7026, -77.4793),
        "FAIRFAX": (38.8333, -77.2761),
        "HENRICO": (37.5610, -77.4006),
        "CHESTERFIELD": (37.3789, -77.5872),
        "SPOTSYLVANIA": (38.1846, -77.6605),
        "PRINCE GEORGE": (37.1869, -77.2891),
        "STAFFORD": (38.4221, -77.4569),
        "CULPEPER": (38.4844, -77.9905),
    },
    "PA": {
        "ALLEGHENY": (40.4683, -79.9836),
        "PHILADELPHIA": (40.0094, -75.1333),
        "LANCASTER": (40.0421, -76.2466),
        "YORK": (39.9201, -76.7274),
        "BERKS": (40.4150, -75.9266),
        "CHESTER": (40.0028, -75.7790),
        "WESTMORELAND": (40.3104, -79.4683),
        "LUZERNE": (41.1809, -75.9745),
    },
    "NJ": {
        "BERGEN": (40.9594, -74.0743),
        "MIDDLESEX": (40.4400, -74.4106),
        "MONMOUTH": (40.2870, -74.3559),
        "BURLINGTON": (39.8761, -74.6679),
        "OCEAN": (39.8666, -74.2630),
        "ATLANTIC": (39.4731, -74.6611),
    },
    "MD": {
        "MONTGOMERY": (39.1547, -77.2405),
        "PRINCE GEORGE'S": (38.8290, -76.8483),
        "PRINCE GEORGES": (38.8290, -76.8483),
        "BALTIMORE": (39.4477, -76.6113),
        "ANNE ARUNDEL": (38.9533, -76.5613),
        "FREDERICK": (39.4720, -77.3963),
        "HOWARD": (39.2517, -76.9314),
    },
    "DE": {
        "NEW CASTLE": (39.5853, -75.6537),
        "KENT": (39.0918, -75.5077),
        "SUSSEX": (38.6814, -75.3833),
    },
    "OH": {
        "FRANKLIN": (39.9694, -83.0080),
        "CUYAHOGA": (41.4783, -81.6789),
        "HAMILTON": (39.1818, -84.5333),
        "SUMMIT": (41.1431, -81.5121),
        "MONTGOMERY": (39.7589, -84.1916),
        "LICKING": (40.0902, -82.4847),
    },
    "WV": {
        "KANAWHA": (38.3498, -81.6326),
        "BERKELEY": (39.4584, -78.0017),
        "MONONGALIA": (39.6295, -80.0512),
    },
    "IL": {
        "COOK": (41.8401, -87.8168),
        "DUPAGE": (41.8520, -88.0857),
        "LAKE": (42.3257, -87.8400),
        "WILL": (41.4485, -87.9805),
        "KANE": (41.9389, -88.4264),
        "MCLEAN": (40.4944, -88.8459),
        "MCHENRY": (42.3294, -88.4515),
    },
    "IN": {
        "MARION": (39.7818, -86.1410),
        "LAKE": (41.4709, -87.3737),
        "ALLEN": (41.0904, -85.0628),
        "TIPPECANOE": (40.3884, -86.8945),
        "HAMILTON": (40.0741, -86.0540),
        "ELKHART": (41.5972, -85.8580),
    },
    "MI": {
        "WAYNE": (42.2843, -83.2733),
        "OAKLAND": (42.6602, -83.3863),
        "MACOMB": (42.6712, -82.8736),
        "KENT": (43.0386, -85.5491),
        "WASHTENAW": (42.2543, -83.8478),
        "GENESEE": (43.0223, -83.7050),
    },
    "NC": {
        "MECKLENBURG": (35.2271, -80.8431),
        "WAKE": (35.7990, -78.6403),
        "GUILFORD": (36.0822, -79.7898),
        "FORSYTH": (36.0903, -80.2522),
        "DURHAM": (36.0306, -78.9051),
        "CUMBERLAND": (35.0524, -78.8284),
        "BUNCOMBE": (35.5947, -82.5515),
    },
    "KY": {
        "JEFFERSON": (38.2008, -85.7298),
        "FAYETTE": (38.0406, -84.5037),
        "KENTON": (38.9436, -84.5414),
        "BOONE": (38.9711, -84.7269),
        "WARREN": (36.9970, -86.4436),
    },
    "DC": {
        "DISTRICT OF COLUMBIA": (38.9072, -77.0369),
        "WASHINGTON": (38.9072, -77.0369),
    },
    # --- MISO states (top counties by population / interconnect activity) ---
    "ND": {
        "CASS": (46.9335, -97.2557),
        "BURLEIGH": (46.9758, -100.4677),
        "GRAND FORKS": (47.9253, -97.4730),
    },
    "SD": {
        "MINNEHAHA": (43.6759, -96.7916),
        "PENNINGTON": (44.0011, -102.8233),
        "LINCOLN": (43.2783, -96.7177),
    },
    "MN": {
        "HENNEPIN": (45.0030, -93.4760),
        "RAMSEY": (45.0152, -93.0996),
        "OLMSTED": (44.0019, -92.4670),
        "ST. LOUIS": (47.6017, -92.4540),
        "ST LOUIS": (47.6017, -92.4540),
        "DAKOTA": (44.6716, -93.0653),
        "ANOKA": (45.2728, -93.2469),
    },
    "WI": {
        "MILWAUKEE": (43.0181, -87.9176),
        "DANE": (43.0666, -89.4126),
        "BROWN": (44.4734, -88.0042),
        "WAUKESHA": (43.0179, -88.3076),
        "RACINE": (42.7488, -87.8197),
    },
    "IA": {
        "POLK": (41.6850, -93.5778),
        "LINN": (42.0782, -91.5973),
        "SCOTT": (41.6376, -90.6210),
        "JOHNSON": (41.6713, -91.5887),
        "STORY": (42.0367, -93.4655),
    },
    "MO": {
        "ST. LOUIS": (38.6477, -90.4421),
        "ST LOUIS": (38.6477, -90.4421),
        "JACKSON": (39.0089, -94.3460),
        "ST. CHARLES": (38.7881, -90.6849),
        "ST CHARLES": (38.7881, -90.6849),
        "GREENE": (37.2807, -93.3033),
        "CLAY": (39.3098, -94.4221),
    },
    "MS": {
        "HINDS": (32.2667, -90.4451),
        "DESOTO": (34.8783, -89.9911),
        "HARRISON": (30.4317, -89.0921),
        "RANKIN": (32.2638, -89.9420),
        "JACKSON": (30.4290, -88.6240),
    },
    "AR": {
        "PULASKI": (34.7711, -92.3127),
        "BENTON": (36.3370, -94.2557),
        "WASHINGTON": (35.9794, -94.2092),
        "SEBASTIAN": (35.1986, -94.2769),
    },
    "LA": {
        "ORLEANS": (29.9762, -90.0780),
        "EAST BATON ROUGE": (30.5388, -91.0383),
        "JEFFERSON": (29.7340, -90.1100),
        "CADDO": (32.5793, -93.8754),
        "LAFAYETTE": (30.2056, -92.0344),
    },
    "MT": {
        "YELLOWSTONE": (45.9416, -108.2742),
        "CASCADE": (47.3055, -111.3450),
        "MISSOULA": (47.0353, -113.9269),
        "GALLATIN": (45.5524, -111.1689),
    },
}

# State geographic centers for fallback when county is missing or unknown.
# Projects still pin on the map — clustered at state center — rather than
# disappearing. Refined county precision can be added later.
STATE_CENTROIDS: dict[str, tuple[float, float]] = {
    "TX": (31.0545, -97.5635),
    "CA": (36.7783, -119.4179),
    # PJM territory
    "VA": (37.7693, -78.1700),
    "PA": (40.5908, -77.2098),
    "NJ": (40.2989, -74.5210),
    "MD": (39.0639, -76.8021),
    "DE": (39.3185, -75.5071),
    "OH": (40.3888, -82.7649),
    "WV": (38.4912, -80.9545),
    "IL": (40.3495, -88.9861),
    "IN": (39.8494, -86.2583),
    "MI": (43.3266, -84.5361),
    "NC": (35.6301, -79.8064),
    "KY": (37.6681, -84.6701),
    "DC": (38.8974, -77.0268),
    # MISO territory
    "ND": (47.5289, -99.7840),
    "SD": (44.2998, -99.4388),
    "MN": (45.6945, -93.9002),
    "WI": (44.2685, -89.6165),
    "IA": (42.0115, -93.2105),
    "MO": (38.4561, -92.2884),
    "MS": (32.7416, -89.6787),
    "AR": (34.9697, -92.3731),
    "LA": (31.1695, -91.8678),
    "MT": (46.9219, -110.4544),
}


def centroid_for_county(county: str | None, state: str) -> tuple[float | None, float | None]:
    state_key = state.upper() if state else ""
    state_table = COUNTY_CENTROIDS.get(state_key, {})

    if county:
        normalized = county.upper().replace(" COUNTY", "").strip()
        # Drop trailing "PARISH" (Louisiana) and "BOROUGH" (rare).
        for suffix in (" PARISH", " BOROUGH"):
            if normalized.endswith(suffix):
                normalized = normalized[: -len(suffix)].strip()
        if "/" in normalized:
            normalized = normalized.split("/", maxsplit=1)[0].strip()
        match = state_table.get(normalized)
        if match is not None:
            return match

    # Fall back to state center so PJM/MISO/etc. projects still pin somewhere
    # reasonable when we haven't yet added their specific county.
    state_match = STATE_CENTROIDS.get(state_key)
    if state_match is not None:
        return state_match

    return None, None
