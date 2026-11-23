#!/usr/bin/env python3
"""Fetch OpenStreetMap outlines for the sketch's islands that Natural Earth 1:10m leaves out.

An island counts as covered by Natural Earth when a Natural Earth ring has its centre
inside the island's OSM bounding box and is no more than twice as wide or tall. The
others (small islands such as Agistri, Telendos, Therasia, the Koufonisia) are fetched in
one Overpass request with full geometry. Run tools/fetch_coastlines.py first.

Output: data/raw/osm_islands/outlines.json (git-ignored), logged in data/manifest.json.
Data © OpenStreetMap contributors, ODbL.

Usage: python tools/fetch_osm_outlines.py    (run from tools/)
"""
import csv
import json
import urllib.parse
import urllib.request
from pathlib import Path

import build_coastline as bc
from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "osm_islands" / "outlines.json"
OVERPASS = "https://overpass-api.de/api/interpreter"


def missing():
    """Islands in islands_geo_osm.csv with no matching Natural Earth ring: [(name, 'way'|'relation', id)]."""
    boxes = []
    for f in ("ne_10m_land.zip", "ne_10m_minor_islands.zip"):
        for r in bc.polygons(bc.RAW / f):
            xs, ys = [p[0] for p in r], [p[1] for p in r]
            boxes.append((min(xs), min(ys), max(xs), max(ys)))
    out = []
    with (ROOT / "data" / "derived" / "islands_geo_osm.csv").open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            s, w, n, e = map(float, row["bbox"].split(","))
            ok = any(w <= (b[0] + b[2]) / 2 <= e and s <= (b[1] + b[3]) / 2 <= n
                     and b[2] - b[0] <= 2 * (e - w) + 0.01 and b[3] - b[1] <= 2 * (n - s) + 0.01 for b in boxes)
            if not ok:
                kind, oid = row["osm_id"].split("/")
                out.append((row["island"], kind, oid))
    return out


def main():
    todo = missing()
    print(f"{len(todo)} islands not in Natural Earth: " + ", ".join(t[0] for t in todo))
    sel = "".join(f"{k}({i});" for _, k, i in todo)
    query = f"[out:json][timeout:180];({sel});out geom;"
    body = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": "weather-commons sketch 33 (research)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read())
    data["islands"] = [{"island": n, "osm_id": f"{k}/{i}"} for n, k, i in todo]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    record(f"{OVERPASS}?data={urllib.parse.quote(query)}", OUT, licence="ODbL (© OpenStreetMap contributors)",
           note=f"Outlines (out geom) of {len(todo)} islands missing from Natural Earth 1:10m")
    print(f"{len(data['elements'])} elements, {OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
