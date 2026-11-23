#!/usr/bin/env python3
"""Download the ELSTAT 2021 census resident-population tables (stdlib only).

Saves the files to data/raw/elstat_census_2021/ (git-ignored) and logs each request in
data/manifest.json. Source page: https://www.statistics.gr/el/2021-census-res-pop-results
(robots.txt allows crawling; checked 2026-11-23).

Usage: python tools/fetch_census.py [--booklet]
  --booklet  also fetch the 31 MB "Aegean islands - Crete" booklet PDF
"""
import argparse
import time
import urllib.request
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "elstat_census_2021"
BASE = "https://www.statistics.gr/documents/20181"
LICENCE = "ELSTAT; re-use approved by ELSTAT (per author, 2026-11-23)"
UA = "weather-commons-research/0.1 (sketch 33, Realtime Weather working group)"

TABLES = [
    ("MON_PLI_DHM_OIKISN_2021.xlsx",
     f"{BASE}/17286366/MON_PLI_DHM_OIKISN_2021.xlsx/2b5a5f24-4083-ede5-7201-3c4fb109fb44",
     "Resident population 2021 by settlement (final, 2024-03-29)"),
    ("MON_PLI_DHM_KOIN_2021.xlsx",
     f"{BASE}/17286366/MON_PLI_DHM_KOIN_2021.xlsx/17bff52d-4fb3-6563-7d67-251116184f56",
     "Resident population 2021 by municipal/local community"),
]
BOOKLET = ("population_NISIA_GR.pdf",
           f"{BASE}/18409455/population_NISIA_GR.pdf/c4a46146-7e33-5a04-b057-c194b87cecee",
           "Census 2021 booklet: Aegean islands - Crete")


def fetch(name, url, note):
    out = OUT / name
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as r:
        out.write_bytes(r.read())
    record(url, out, licence=LICENCE, note=note)
    print(f"{name}: {out.stat().st_size:,} bytes")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--booklet", action="store_true")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for i, item in enumerate(TABLES + ([BOOKLET] if a.booklet else [])):
        if i:
            time.sleep(2)  # be polite
        fetch(*item)


if __name__ == "__main__":
    main()
