#!/usr/bin/env python3
"""Fetch nearby confirmed exoplanets and convert them to Startrip JSON."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TAP_SYNC_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
PARSEC_TO_LIGHTYEAR = 3.26156


def main() -> int:
    args = parse_args()
    query = build_query(radius_ly=args.radius_ly, limit=args.limit)

    print(f"[exoplanets] Querying NASA Exoplanet Archive for a {args.radius_ly:.1f} ly bubble")
    csv_text = run_query(query)
    rows = parse_csv(csv_text)
    print(f"[exoplanets] Downloaded {len(rows)} rows")

    planets = [row_to_planet(row) for row in rows]
    payload = {
        "meta": {
            "source": "NASA Exoplanet Archive",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "tapSyncUrl": TAP_SYNC_URL,
            "radiusLy": args.radius_ly,
            "rowCount": len(planets),
            "limit": args.limit,
            "query": query.strip(),
        },
        "planets": planets,
    }

    output_json = Path(args.output_json)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[exoplanets] Wrote JSON: {output_json}")

    if args.output_csv:
        output_csv = Path(args.output_csv)
        output_csv.parent.mkdir(parents=True, exist_ok=True)
        output_csv.write_text(csv_text, encoding="utf-8", newline="")
        print(f"[exoplanets] Wrote CSV: {output_csv}")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch nearby confirmed exoplanets and convert them to Startrip JSON.",
    )
    parser.add_argument(
        "--radius-ly",
        type=float,
        default=100.0,
        help="Radius of the local bubble in light-years.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5000,
        help="Maximum number of rows to request from the archive.",
    )
    parser.add_argument(
        "--output-json",
        default="data/generated/exoplanets-nearby.json",
        help="Path to the generated Startrip exoplanet JSON file.",
    )
    parser.add_argument(
        "--output-csv",
        default="data/generated/exoplanets-nearby.csv",
        help="Optional path to save the raw archive CSV.",
    )
    return parser.parse_args()


def build_query(*, radius_ly: float, limit: int) -> str:
    radius_pc = radius_ly / PARSEC_TO_LIGHTYEAR
    return f"""
SELECT TOP {int(limit)}
  pl_name,
  hostname,
  sy_dist,
  ra,
  dec,
  pl_orbsmax,
  pl_orbeccen,
  pl_rade,
  pl_bmasse,
  pl_orbper,
  disc_year,
  discoverymethod,
  gaia_dr3_id,
  hip_name,
  sy_snum,
  sy_pnum,
  pl_eqt,
  st_teff
FROM pscomppars
WHERE sy_dist <= {radius_pc:.6f}
ORDER BY sy_dist ASC, hostname ASC, pl_name ASC
"""


def run_query(query: str) -> str:
    url = (
        f"{TAP_SYNC_URL}?query={urllib.parse.quote(query)}&format=csv"
    )
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_csv(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    return list(reader)


def row_to_planet(row: dict[str, str]) -> dict[str, object]:
    distance_pc = parse_float(row.get("sy_dist"))
    distance_ly = distance_pc * PARSEC_TO_LIGHTYEAR
    ra_deg = parse_float(row.get("ra"))
    dec_deg = parse_float(row.get("dec"))
    x, y, z = spherical_to_cartesian(distance_ly, ra_deg, dec_deg)

    gaia_dr3_id = row.get("gaia_dr3_id") or None
    hip_name = row.get("hip_name") or None

    return {
        "name": row["pl_name"],
        "hostName": row["hostname"],
        "systemDistanceLy": round(distance_ly, 6),
        "systemDistancePc": round(distance_pc, 6),
        "raDeg": round(ra_deg, 9),
        "decDeg": round(dec_deg, 9),
        "x": round(x, 6),
        "y": round(y, 6),
        "z": round(z, 6),
        "orbitSemiMajorAxisAu": parse_float(row.get("pl_orbsmax")),
        "orbitEccentricity": parse_float(row.get("pl_orbeccen")),
        "orbitPeriodDays": parse_float(row.get("pl_orbper")),
        "radiusEarth": parse_float(row.get("pl_rade")),
        "massEarth": parse_float(row.get("pl_bmasse")),
        "equilibriumTempK": parse_float(row.get("pl_eqt")),
        "hostTemperatureK": parse_float(row.get("st_teff")),
        "discoveryMethod": row.get("discoverymethod") or None,
        "discoveryYear": parse_int(row.get("disc_year")),
        "gaiaDr3Id": gaia_dr3_id,
        "gaiaSourceId": extract_numeric_id(gaia_dr3_id),
        "hipName": hip_name,
        "hipId": extract_numeric_id(hip_name),
        "starCount": parse_int(row.get("sy_snum")),
        "planetCount": parse_int(row.get("sy_pnum")),
    }


def spherical_to_cartesian(distance_ly: float, ra_deg: float, dec_deg: float) -> tuple[float, float, float]:
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    cos_dec = math.cos(dec)
    return (
        distance_ly * cos_dec * math.cos(ra),
        distance_ly * math.sin(dec),
        distance_ly * cos_dec * math.sin(ra),
    )


def extract_numeric_id(value: str | None) -> str | None:
    if not value:
        return None

    matches = re.findall(r"(\d[\d-]*)", value)
    if not matches:
        return None

    return max(matches, key=len)


def parse_float(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def parse_int(value: str | None) -> int | None:
    if value in (None, ""):
        return None
    return int(float(value))


if __name__ == "__main__":
    sys.exit(main())
