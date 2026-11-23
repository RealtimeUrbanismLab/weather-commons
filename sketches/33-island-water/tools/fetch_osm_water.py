#!/usr/bin/env python3
"""Water features on an island from OpenStreetMap via the Overpass API (stdlib only).

Fetches springs, wells, water tanks, reservoirs, water works, watermills, fountains and
drinking water points inside the island's mapped outline (place=island), falling back
to a box around the centroid in data/islands_geo.csv.

Writes data/derived/osm_water_<island>.geojson and a tag summary, logs the request.
Data © OpenStreetMap contributors, ODbL.

Usage: python tools/fetch_osm_water.py --island Sifnos [--box 0.15]
Ask the user before running for every island; Overpass is a shared public service.
Tags to confirm against the OSM wiki before relying on counts.
"""
import argparse
import csv
import json
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OVERPASS = "https://overpass-api.de/api/interpreter"

FILTERS = [
    '["natural"="spring"]',
    '["man_made"="water_well"]',
    '["man_made"="water_tank"]',
    '["man_made"="storage_tank"]["content"="water"]',
    '["man_made"="reservoir_covered"]',
    '["man_made"="water_works"]',
    '["man_made"="watermill"]',
    '["historic"="watermill"]',
    '["landuse"="reservoir"]',
    '["water"="reservoir"]',
    '["amenity"="fountain"]',
    '["amenity"="drinking_water"]',
    '["man_made"="cistern"]',
]


def query(island, box, lat, lon):
    parts = "\n".join(f"  nwr{f}(area.a);" for f in FILTERS)
    by_name = (f'[out:json][timeout:90];\n'
               f'area["place"="island"]["name:en"="{island}"]->.a;\n'
               f'(\n{parts}\n);\nout center tags;')
    s, w, n, e = lat - box, lon - box, lat + box, lon + box
    bparts = "\n".join(f"  nwr{f}({s},{w},{n},{e});" for f in FILTERS)
    by_box = f'[out:json][timeout:90];\n(\n{bparts}\n);\nout center tags;'
    return by_name, by_box


def run(q):
    body = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(OVERPASS, data=body,
                                 headers={"User-Agent": "weather-commons sketch 33 (research)"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def to_geojson(elements):
    feats = []
    for el in elements:
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None:
            continue
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [lon, lat]},
                      "properties": {"osm_id": f"{el['type']}/{el['id']}", **el.get("tags", {})}})
    return {"type": "FeatureCollection", "features": feats,
            "attribution": "© OpenStreetMap contributors, ODbL"}


def kind(props):
    for k in ("natural", "man_made", "historic", "amenity", "water", "landuse"):
        if k in props:
            return f"{k}={props[k]}"
    return "other"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--island", required=True)
    ap.add_argument("--box", type=float, default=0.15)
    a = ap.parse_args()
    rows = {r["island"].lower(): r for r in csv.DictReader(
        (ROOT / "data" / "islands_geo.csv").open(encoding="utf-8"))}
    isl = rows.get(a.island.lower())
    if not isl:
        raise SystemExit(f"{a.island} not in data/islands_geo.csv")
    by_name, by_box = query(isl["osm_name_en"], a.box, float(isl["lat"]), float(isl["lon"]))
    data, used = run(by_name), "island outline"
    if not data.get("elements"):
        data, used = run(by_box), f"box ±{a.box}°"
    gj = to_geojson(data.get("elements", []))
    out = ROOT / "data" / "derived" / f"osm_water_{isl['island']}.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(gj, ensure_ascii=False), encoding="utf-8")
    record(OVERPASS, out, licence="ODbL", note=f"{isl['island']} water features via {used}")
    counts = Counter(kind(f["properties"]) for f in gj["features"])
    print(f"{isl['island']}: {len(gj['features'])} features ({used})")
    for k, v in counts.most_common():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
