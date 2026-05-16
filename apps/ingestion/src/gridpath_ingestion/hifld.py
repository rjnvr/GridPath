from __future__ import annotations

import argparse
import csv
import os
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import psycopg


def parse_decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        return Decimal(value.strip())
    except InvalidOperation:
        return None


def first_value(row: dict[str, str], keys: list[str]) -> str | None:
    for key in keys:
        value = row.get(key)
        if value:
            return value.strip()
    return None


def load_substations(path: Path, database_url: str) -> dict[str, int]:
    stats = {"rows_seen": 0, "rows_upserted": 0, "rows_skipped": 0}
    with path.open(newline="") as handle, psycopg.connect(database_url) as connection:
        reader = csv.DictReader(handle)
        with connection.cursor() as cursor:
            for row in reader:
                stats["rows_seen"] += 1
                hifld_id = first_value(row, ["ID", "OBJECTID", "FID"])
                lat = parse_decimal(first_value(row, ["LATITUDE", "LAT", "Y"]))
                lng = parse_decimal(first_value(row, ["LONGITUDE", "LON", "X"]))
                if not hifld_id or lat is None or lng is None:
                    stats["rows_skipped"] += 1
                    continue
                payload: dict[str, Any] = {
                    "hifld_id": hifld_id,
                    "name": first_value(row, ["NAME", "SUBSTATION", "SUB_NAME"]),
                    "owner": first_value(row, ["OWNER", "OWNER_NAME"]),
                    "voltage_kv": parse_decimal(first_value(row, ["VOLTAGE", "MAX_VOLT", "KV"])),
                    "lat": str(lat),
                    "lng": str(lng),
                }
                cursor.execute(
                    """
                    insert into substations (
                      hifld_id, name, owner, voltage_kv, lat, lng, geom, source, last_updated_at
                    )
                    values (
                      %(hifld_id)s, %(name)s, %(owner)s, %(voltage_kv)s, %(lat)s, %(lng)s,
                      st_setsrid(st_makepoint(%(lng)s, %(lat)s), 4326), 'HIFLD_NEXT', now()
                    )
                    on conflict (hifld_id) do update set
                      name = excluded.name,
                      owner = excluded.owner,
                      voltage_kv = excluded.voltage_kv,
                      lat = excluded.lat,
                      lng = excluded.lng,
                      geom = excluded.geom,
                      last_updated_at = now()
                    """,
                    payload,
                )
                stats["rows_upserted"] += 1
    return stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load HIFLD Texas substations into Postgres.")
    parser.add_argument("csv_file", type=Path)
    args = parser.parse_args(argv)
    database_url = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DIRECT_DATABASE_URL or DATABASE_URL.")
    print(load_substations(args.csv_file, database_url))
    return 0


if __name__ == "__main__":
    sys.exit(main())
