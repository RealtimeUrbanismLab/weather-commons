#!/usr/bin/env python3
"""Download Microsoft Global ML Building Footprints tiles for chosen islands (stdlib only).

The dataset is split into zoom-9 quadkey tiles listed in dataset-links.csv. Footprints are
traced by machine learning from aerial imagery (Bing Maps), so coverage is more even than
OpenStreetMap's on the islands. Licence: ODbL. Files are saved unchanged (gzipped GeoJSON
lines) in git-ignored data/raw/ms_buildings/.

Usage: python tools/fetch_ms_buildings.py Sifnos [Serifos ...]    (run from tools/)
"""
import csv
import io
import math
import sys
import urllib.request
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "ms_buildings"
INDEX = "https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv"
UA = {"User-Agent": "weather-commons sketch 33 (research)"}


def quadkey(lat, lon, z=9):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return "".join(str((1 if x & (1 << (i - 1)) else 0) + (2 if y & (1 << (i - 1)) else 0)) for i in range(z, 0, -1))


def main():
    names = sys.argv[1:] or ["Sifnos"]
    with (ROOT / "data" / "derived" / "islands_geo_osm.csv").open(encoding="utf-8") as f:
        boxes = {r["island"]: list(map(float, r["bbox"].split(","))) for r in csv.DictReader(f)}
    with urllib.request.urlopen(urllib.request.Request(INDEX, headers=UA), timeout=120) as r:
        links = {row["QuadKey"]: row for row in csv.DictReader(io.TextIOWrapper(r, encoding="utf-8"))
                 if row["Location"] == "Greece"}
    OUT.mkdir(parents=True, exist_ok=True)
    for name in names:
        s, w, n, e = boxes[name]
        keys = {quadkey(la, lo) for la in (s, n, (s + n) / 2) for lo in (w, e, (w + e) / 2)}
        for k in sorted(keys):
            if k not in links:
                print(f"{name}: tile {k} not in the index")
                continue
            dest = OUT / f"{k}.csv.gz"
            if not dest.exists():
                with urllib.request.urlopen(urllib.request.Request(links[k]["Url"], headers=UA), timeout=300) as r:
                    dest.write_bytes(r.read())
                record(links[k]["Url"], dest, licence="ODbL (Microsoft Global ML Building Footprints)",
                       note=f"Quadkey {k} for {name}; uploaded {links[k]['UploadDate']}")
            print(f"{name}: {k} {links[k]['Size']}")


if __name__ == "__main__":
    main()
