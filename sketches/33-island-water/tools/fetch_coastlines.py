#!/usr/bin/env python3
"""Download Natural Earth 1:10m land and minor islands (public domain) for the Situate map.

Two zipped shapefiles, about 5 MB together, saved unchanged in git-ignored
data/raw/natural_earth/. tools/build_coastline.py clips and simplifies them to the Aegean.

Usage: python tools/fetch_coastlines.py    (run from tools/, so manifest.py imports)
"""
import urllib.request
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "natural_earth"
BASE = "https://naciscdn.org/naturalearth/10m/physical/"
FILES = ["ne_10m_land.zip", "ne_10m_minor_islands.zip"]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        url, dest = BASE + f, OUT / f
        req = urllib.request.Request(url, headers={"User-Agent": "weather-commons sketch 33 (research)"})
        with urllib.request.urlopen(req, timeout=300) as r:
            dest.write_bytes(r.read())
        record(url, dest, licence="Public domain (Natural Earth)", note="1:10m physical, version as served")
        print(f"{f}: {dest.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
