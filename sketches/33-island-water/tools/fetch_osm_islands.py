#!/usr/bin/env python3
"""Fetch every named island and islet in the Aegean from OpenStreetMap (stdlib only).

One Overpass request: place=island|islet with a name, inside a box covering the Greek
Aegean and Crete (34.7-41.1 N, 22.8-28.4 E), plus a
small box around Kastellorizo. Returns tags, bounding box and the
bounding-box centre of each feature. The box also catches Turkish islands; matching
to the census list (tools/match_islands.py) keeps only ours.

Output: data/raw/osm_islands/islands.json (git-ignored), logged in data/manifest.json.
Data © OpenStreetMap contributors, ODbL.

Usage: python tools/fetch_osm_islands.py
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "osm_islands" / "islands.json"
OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = (34.7, 22.8, 41.1, 28.4)  # south, west, north, east
BBOX_MEGISTI = (36.0, 29.4, 36.3, 29.7)  # Kastellorizo, Ro, Strongyli lie east of the main box
TAG = 'nwr["place"~"^(island|islet)$"]["name"]'
QUERY = f"""[out:json][timeout:180];
({TAG}{BBOX};{TAG}{BBOX_MEGISTI};);
out center bb tags;"""


def main():
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(OVERPASS, data=body,
                                 headers={"User-Agent": "weather-commons sketch 33 (research)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    n = len(json.loads(data)["elements"])
    record(f"{OVERPASS}?data={urllib.parse.quote(QUERY)}", OUT,
           licence="ODbL (© OpenStreetMap contributors)", note=f"Named islands and islets, Aegean box: {n} features")
    print(f"{OUT.relative_to(ROOT)}: {n} features, {len(data):,} bytes")


if __name__ == "__main__":
    main()
