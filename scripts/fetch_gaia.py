#!/usr/bin/env python3
"""Fetch a local Gaia DR3 bubble and convert it to Startrip JSON."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

TAP_ASYNC_URL = "https://gea.esac.esa.int/tap-server/tap/async"
PARSEC_TO_LIGHTYEAR = 3.26156
SUN_TEMPERATURE_K = 5772.0
SUN_ABSOLUTE_MAGNITUDE = 4.83


def main() -> int:
    args = parse_args()
    query = build_query(
        radius_ly=args.radius_ly,
        limit=args.limit,
        min_parallax_over_error=args.min_parallax_over_error,
        max_ruwe=args.max_ruwe,
    )

    print(f"[gaia] Querying Gaia DR3 for a {args.radius_ly:.1f} ly bubble")
    job_url = submit_job(query)
    print(f"[gaia] Job created: {job_url}")
    wait_for_completion(job_url, timeout_seconds=args.timeout, poll_seconds=args.poll_interval)

    csv_text = download_result(job_url)
    rows = parse_csv(csv_text)
    print(f"[gaia] Downloaded {len(rows)} rows")

    stars = [row_to_star(row) for row in rows]
    payload = {
        "meta": {
            "source": "Gaia DR3",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "tapAsyncUrl": TAP_ASYNC_URL,
            "radiusLy": args.radius_ly,
            "rowCount": len(stars),
            "limit": args.limit,
            "qualityFilters": {
                "minParallaxOverError": args.min_parallax_over_error,
                "maxRuwe": args.max_ruwe,
            },
            "query": query.strip(),
        },
        "stars": stars,
    }

    output_json = Path(args.output_json)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[gaia] Wrote JSON: {output_json}")

    if args.output_csv:
        output_csv = Path(args.output_csv)
        output_csv.parent.mkdir(parents=True, exist_ok=True)
        output_csv.write_text(csv_text, encoding="utf-8", newline="")
        print(f"[gaia] Wrote CSV: {output_csv}")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Gaia DR3 stars around the Sun and convert them to Startrip JSON.",
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
        default=20000,
        help="Maximum number of Gaia rows to request.",
    )
    parser.add_argument(
        "--min-parallax-over-error",
        type=float,
        default=10.0,
        help="Minimum parallax_over_error filter.",
    )
    parser.add_argument(
        "--max-ruwe",
        type=float,
        default=1.4,
        help="Maximum RUWE filter.",
    )
    parser.add_argument(
        "--output-json",
        default="data/generated/gaia-nearby-stars.json",
        help="Path to the generated Startrip JSON file.",
    )
    parser.add_argument(
        "--output-csv",
        default="data/generated/gaia-nearby-stars.csv",
        help="Optional path to save the raw Gaia CSV.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Maximum time to wait for the Gaia TAP async job, in seconds.",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=2.0,
        help="Polling interval for the Gaia TAP async job, in seconds.",
    )
    return parser.parse_args()


def build_query(
    *,
    radius_ly: float,
    limit: int,
    min_parallax_over_error: float,
    max_ruwe: float,
) -> str:
    radius_pc = radius_ly / PARSEC_TO_LIGHTYEAR
    min_parallax_mas = 1000.0 / radius_pc
    return f"""
SELECT TOP {int(limit)}
  g.source_id,
  g.ra,
  g.dec,
  g.parallax,
  g.parallax_over_error,
  g.pmra,
  g.pmdec,
  g.phot_g_mean_mag,
  g.phot_bp_mean_mag,
  g.phot_rp_mean_mag,
  g.bp_rp,
  g.ruwe,
  ap.teff_gspphot,
  ap.radius_flame,
  ap.lum_flame
FROM gaiadr3.gaia_source AS g
LEFT JOIN gaiadr3.astrophysical_parameters AS ap
  ON g.source_id = ap.source_id
WHERE g.parallax >= {min_parallax_mas:.6f}
  AND g.parallax_over_error >= {float(min_parallax_over_error):.2f}
  AND g.ruwe < {float(max_ruwe):.2f}
ORDER BY g.parallax DESC
"""


def submit_job(query: str) -> str:
    payload = urllib.parse.urlencode(
        {
            "REQUEST": "doQuery",
            "LANG": "ADQL",
            "FORMAT": "csv",
            "PHASE": "RUN",
            "QUERY": query,
        }
    ).encode("utf-8")
    request = urllib.request.Request(TAP_ASYNC_URL, data=payload, method="POST")

    with urllib.request.urlopen(request, timeout=60) as response:
        return response.geturl()


def wait_for_completion(job_url: str, *, timeout_seconds: int, poll_seconds: float) -> None:
    deadline = time.monotonic() + timeout_seconds

    while True:
        phase = read_text(f"{job_url}/phase").strip()
        print(f"[gaia] Phase: {phase}")

        if phase == "COMPLETED":
            return

        if phase in {"ERROR", "ABORTED"}:
            details = try_read_error(job_url)
            raise RuntimeError(f"Gaia TAP job ended in phase {phase}: {details}")

        if time.monotonic() >= deadline:
            raise TimeoutError(f"Gaia TAP job did not complete within {timeout_seconds} seconds")

        time.sleep(poll_seconds)


def download_result(job_url: str) -> str:
    return read_text(f"{job_url}/results/result")


def parse_csv(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    return list(reader)


def row_to_star(row: dict[str, str]) -> dict[str, object]:
    parallax = parse_float(row.get("parallax"))
    ra_deg = parse_float(row.get("ra"))
    dec_deg = parse_float(row.get("dec"))
    bp_rp = parse_float(row.get("bp_rp"))
    explicit_temperature = parse_float(row.get("teff_gspphot"))
    estimated_temperature = estimate_temperature_from_bp_rp(bp_rp)
    if explicit_temperature is not None:
        temperature_k = explicit_temperature
        temperature_source = "teff_gspphot"
        color_source = "teff_gspphot_blackbody"
    elif estimated_temperature is not None:
        temperature_k = estimated_temperature
        temperature_source = "bp_rp_estimate"
        color_source = "bp_rp_estimate_blackbody"
    else:
        temperature_k = SUN_TEMPERATURE_K
        temperature_source = "solar_default"
        color_source = "solar_default_blackbody"

    lum_solar = estimate_luminosity(row, parallax)
    explicit_radius = parse_float(row.get("radius_flame"))
    estimated_radius = estimate_radius_from_luminosity_and_temperature(lum_solar, temperature_k)
    if explicit_radius is not None:
        radius_solar = explicit_radius
        radius_source = "radius_flame"
    elif estimated_radius is not None:
        radius_solar = estimated_radius
        radius_source = "luminosity_temperature_estimate"
    else:
        radius_solar = default_radius_for_temperature(temperature_k)
        radius_source = "temperature_default"

    distance_pc = 1000.0 / parallax
    distance_ly = distance_pc * PARSEC_TO_LIGHTYEAR
    x, y, z = spherical_to_cartesian(distance_ly, ra_deg, dec_deg)
    color_rgb = color_temperature_to_rgb(temperature_k)
    color_hex = rgb_to_hex(color_rgb)
    luminosity_for_render = (
        lum_solar if lum_solar is not None
        else estimate_luminosity_from_radius_and_temperature(radius_solar, temperature_k)
    )
    apparent_magnitude_g = parse_float(row.get("phot_g_mean_mag"))
    if apparent_magnitude_g is not None:
        brightness_source = "phot_g_mean_mag"
    else:
        apparent_magnitude_g = estimate_apparent_magnitude(distance_ly, luminosity_for_render)
        brightness_source = "luminosity_temperature_estimate"
    absolute_magnitude_g = estimate_absolute_magnitude(luminosity_for_render)
    visual_brightness = apparent_magnitude_to_visual_brightness(apparent_magnitude_g)

    return {
        "id": row["source_id"],
        "name": f"Gaia DR3 {row['source_id']}",
        "sourceId": row["source_id"],
        "sourceCatalog": "Gaia DR3",
        "distanceLy": round(distance_ly, 6),
        "distancePc": round(distance_pc, 6),
        "raDeg": round(ra_deg, 9),
        "decDeg": round(dec_deg, 9),
        "x": round(x, 6),
        "y": round(y, 6),
        "z": round(z, 6),
        "radiusSolar": round(radius_solar, 6),
        "radiusSource": radius_source,
        "temperatureK": round(temperature_k, 3),
        "temperatureSource": temperature_source,
        "type": spectral_type_from_temperature(temperature_k),
        "colorRgb": color_rgb,
        "colorHex": color_hex,
        "colorSource": color_source,
        "apparentMagnitudeG": round(apparent_magnitude_g, 6),
        "absoluteMagnitudeG": round(absolute_magnitude_g, 6),
        "visualBrightness": round(visual_brightness, 6),
        "brightnessSource": brightness_source,
        "bpRp": bp_rp,
        "photGMeanMag": parse_float(row.get("phot_g_mean_mag")),
        "photBpMeanMag": parse_float(row.get("phot_bp_mean_mag")),
        "photRpMeanMag": parse_float(row.get("phot_rp_mean_mag")),
        "parallaxMas": parallax,
        "parallaxOverError": parse_float(row.get("parallax_over_error")),
        "ruwe": parse_float(row.get("ruwe")),
        "pmRa": parse_float(row.get("pmra")),
        "pmDec": parse_float(row.get("pmdec")),
        "luminositySolar": lum_solar,
        "synthetic": False,
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


def estimate_temperature_from_bp_rp(bp_rp: float | None) -> float | None:
    if bp_rp is None:
        return None

    color_index = min(max(bp_rp, -0.4), 4.5)
    return 4600.0 * (
        (1.0 / (0.92 * color_index + 1.7)) +
        (1.0 / (0.92 * color_index + 0.62))
    )


def estimate_luminosity(row: dict[str, str], parallax_mas: float) -> float | None:
    lum = parse_float(row.get("lum_flame"))
    if lum is not None:
        return lum

    phot_g = parse_float(row.get("phot_g_mean_mag"))
    if phot_g is None:
        return None

    distance_pc = 1000.0 / parallax_mas
    absolute_mag = phot_g - 5.0 * (math.log10(distance_pc) - 1.0)
    return 10.0 ** ((SUN_ABSOLUTE_MAGNITUDE - absolute_mag) / 2.5)


def estimate_radius_from_luminosity_and_temperature(
    luminosity_solar: float | None,
    temperature_k: float,
) -> float | None:
    if luminosity_solar is None or luminosity_solar <= 0 or temperature_k <= 0:
        return None

    return math.sqrt(luminosity_solar) / ((temperature_k / SUN_TEMPERATURE_K) ** 2)


def default_radius_for_temperature(temperature_k: float) -> float:
    if temperature_k >= 30000:
        return 6.5
    if temperature_k >= 10000:
        return 2.8
    if temperature_k >= 7500:
        return 1.7
    if temperature_k >= 6000:
        return 1.15
    if temperature_k >= 5200:
        return 1.0
    if temperature_k >= 3700:
        return 0.75
    return 0.35


def estimate_luminosity_from_radius_and_temperature(radius_solar: float, temperature_k: float) -> float:
    return max(
        0.000001,
        (radius_solar ** 2) * ((temperature_k / SUN_TEMPERATURE_K) ** 4),
    )


def estimate_absolute_magnitude(luminosity_solar: float) -> float:
    return SUN_ABSOLUTE_MAGNITUDE - 2.5 * math.log10(max(luminosity_solar, 0.000001))


def estimate_apparent_magnitude(distance_ly: float, luminosity_solar: float) -> float:
    distance_pc = max(distance_ly / PARSEC_TO_LIGHTYEAR, 0.000001)
    return estimate_absolute_magnitude(luminosity_solar) + 5.0 * (math.log10(distance_pc) - 1.0)


def apparent_magnitude_to_visual_brightness(apparent_magnitude: float) -> float:
    return max(0.08, min(1.0, 0.12 + math.exp(-0.23 * (apparent_magnitude + 1.5))))


def spectral_type_from_temperature(temperature_k: float) -> str:
    if temperature_k >= 30000:
        return "O"
    if temperature_k >= 10000:
        return "B"
    if temperature_k >= 7500:
        return "A"
    if temperature_k >= 6000:
        return "F"
    if temperature_k >= 5200:
        return "G"
    if temperature_k >= 3700:
        return "K"
    return "M"


def color_temperature_to_rgb(temperature_k: float) -> dict[str, int]:
    kelvin = max(10.0, temperature_k / 100.0)

    if kelvin <= 66:
        red = 255.0
        green = 99.4708025861 * math.log(kelvin) - 161.1195681661
        blue = 0.0 if kelvin <= 19 else 138.5177312231 * math.log(kelvin - 10.0) - 305.0447927307
    else:
        red = 329.698727446 * math.pow(kelvin - 60.0, -0.1332047592)
        green = 288.1221695283 * math.pow(kelvin - 60.0, -0.0755148492)
        blue = 255.0

    return {
        "r": clamp_channel(red),
        "g": clamp_channel(green),
        "b": clamp_channel(blue),
    }


def rgb_to_hex(rgb: dict[str, int]) -> str:
    return f"#{rgb['r']:02x}{rgb['g']:02x}{rgb['b']:02x}"


def clamp_channel(value: float) -> int:
    return int(max(0, min(255, round(value))))


def parse_float(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def read_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read().decode("utf-8", errors="replace")


def try_read_error(job_url: str) -> str:
    for suffix in ("/error", ""):
        try:
            content = read_text(job_url + suffix)
        except Exception:
            continue

        if suffix == "/error":
            return content.strip()

        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            continue

        message_parts = [element.text.strip() for element in root.iter() if element.text and element.text.strip()]
        if message_parts:
            return " | ".join(message_parts[:8])

    return "No additional error details returned by Gaia TAP."


if __name__ == "__main__":
    sys.exit(main())
