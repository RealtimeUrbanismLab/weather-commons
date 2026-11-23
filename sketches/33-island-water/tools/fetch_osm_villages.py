#!/usr/bin/env python3
"""Fetch settlement points (place=*) inside each matched island from OpenStreetMap.

One Overpass request. For every island outline in data/derived/islands_geo_osm.csv it
returns the island (ids only) followed by the place nodes inside it, so nodes can be
assigned to islands in order.

Output: data/raw/osm_islands/villages.json (git-ignored), logged in data/manifest.json.
Data © OpenStreetMap contributors, ODbL.

Usage: python tools/fetch_osm_villages.py
"""
import csv
import json
import urllib.parse
import urllib.request
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "data" / "derived" / "islands_geo_osm.csv"
OUT = ROOT / "data" / "raw" / "osm_islands" / "villages.json"
OVERPASS = "https://overpass-api.de/api/interpreter"
PLACES = "city|town|village|hamlet|suburb|quarter|neighbourhood|isolated_dwelling|locality"


def main():
    ids = {"relation": [], "way": [], "node": []}
    for r in csv.DictReader(GEO.open(encoding="utf-8")):
        if r["osm_id"]:
            t, i = r["osm_id"].split("/")
            ids[t].append(i)
    sel = "".join(f"{t[:3] if t != 'relation' else 'rel'}(id:{','.join(v)});" for t, v in ids.items()
                  if v and t != "node")
    query = f"""[out:json][timeout:300];
({sel})->.islands;
foreach.islands->.i(
  .i out ids;
  .i map_to_area->.a;
  node(area.a)["place"~"^({PLACES})$"];
  out;
);"""
    body = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(OVERPASS, data=body,
                                 headers={"User-Agent": "weather-commons sketch 33 (research)"})
    with urllib.request.urlopen(req, timeout=400) as r:
        data = r.read()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    el = json.loads(data)["elements"]
    record(f"{OVERPASS} (POST; query in tools/fetch_osm_villages.py)", OUT,
           licence="ODbL (© OpenStreetMap contributors)",
           note=f"Place nodes inside {sum(len(v) for v in ids.values())} island outlines: {len(el)} elements")
    print(f"{OUT.relative_to(ROOT)}: {len(el)} elements, {len(data):,} bytes")
    if ids["node"]:
        print("Islands mapped only as nodes (no outline, skipped):", ids["node"])


if __name__ == "__main__":
    main()
