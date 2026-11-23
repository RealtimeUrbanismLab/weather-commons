#!/usr/bin/env python3
"""Match the census island list to OpenStreetMap islands (stdlib only).

Inputs:  data/derived/islands_census_2021.csv  (tools/build_islands.py)
         data/raw/osm_islands/islands.json      (tools/fetch_osm_islands.py)
         data/island_rules.csv                  (osm_id column, optional: forces a match)
Output:  data/derived/islands_geo_osm.csv

Names are compared without accents, in Greek and English, including alt/old/official
names. Main islands (no parent in the same municipality) take the largest matching
feature. Islets take the matching feature nearest their parent island's bounding box (the most
populous island sharing their municipality code). Every row
records how it was matched, so it can be checked.

The point is the centre of the OSM bounding box: approximate, and for curved islands
(Santorini) it can fall in the sea.

Usage: python -I tools/match_islands.py
"""
import csv
import json
import math
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CENSUS = ROOT / "data" / "derived" / "islands_census_2021.csv"
OSM = ROOT / "data" / "raw" / "osm_islands" / "islands.json"
RULES = ROOT / "data" / "island_rules.csv"
OUT = ROOT / "data" / "derived" / "islands_geo_osm.csv"
NAME_KEYS = ("name", "name:el", "name:en", "int_name", "alt_name", "alt_name:el", "alt_name:en",
             "old_name", "official_name", "official_name:el", "official_name:en", "loc_name")
MAX_ISLET_KM = 60


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").replace("ς", "σ")
    s = re.sub(r"\b(nisos|nisi|island|islet|νησοσ|νησι|νησιδα)\b", " ", s)
    return re.sub(r"[^\w]+", " ", s).strip()


def variants(*names):
    out = set()
    for n in names:
        for part in re.split(r"[()/;]", n or ""):
            if part.strip():
                out.add(norm(part))
    return out - {""}


def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    x = math.radians(lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2))
    return 6371 * math.hypot(x, math.radians(la2 - la1))


def feature(el):
    b = el.get("bounds")
    c = el.get("center") or {"lat": el.get("lat"), "lon": el.get("lon")}
    if c["lat"] is None and b:  # Overpass gave bounds only: use the box centre
        c = {"lat": (b["minlat"] + b["maxlat"]) / 2, "lon": (b["minlon"] + b["maxlon"]) / 2}
    area = (b["maxlat"] - b["minlat"]) * (b["maxlon"] - b["minlon"]) if b else 0
    names = set()
    for k in NAME_KEYS:
        names |= variants(*(el["tags"].get(k, "").split(";")))
    return {"id": f"{el['type']}/{el['id']}", "tags": el["tags"], "pt": (c["lat"], c["lon"]),
            "bounds": b, "area": area, "names": names}


def main():
    feats = [feature(e) for e in json.loads(OSM.read_text(encoding="utf-8"))["elements"]]
    feats = [f for f in feats if f["pt"][0] is not None]
    by_id = {f["id"]: f for f in feats}
    forced = {}
    rules = list(csv.DictReader(RULES.open(encoding="utf-8")))
    for r in rules:
        if r.get("osm_id"):
            forced[r["island_en"]] = r["osm_id"]
    islands = [r for r in csv.DictReader(CENSUS.open(encoding="utf-8")) if int(r["residents_2021"]) > 0]

    def codes(r):
        return r["census_codes"].split(";")

    alias = {r["island_en"]: r.get("osm_alias", "") for r in rules}

    def parent(r):
        # An island that is a whole municipality (4-digit code) or bigger has no parent.
        # Smaller units take the most populous island in the same municipality, or the
        # island whose code contains theirs (e.g. a Cretan islet inside "72").
        if any(len(c) <= 4 for c in codes(r)):
            return None
        cands = [o for o in islands if o["island"] != r["island"]
                 and int(o["residents_2021"]) > int(r["residents_2021"])
                 and any(c[:4] == oc[:4] or c.startswith(oc) for c in codes(r) for oc in codes(o))]
        return max(cands, key=lambda o: int(o["residents_2021"])) if cands else None

    def km_to_box(pt, f):
        b = f["bounds"]
        if not b:
            return km(pt, f["pt"])
        lat = min(max(pt[0], b["minlat"]), b["maxlat"])
        lon = min(max(pt[1], b["minlon"]), b["maxlon"])
        return km(pt, (lat, lon))

    placed = {}
    # main islands first, so islets can use their parent's point
    order = sorted(islands, key=lambda r: parent(r) is not None)
    rows = []
    for r in order:
        par = parent(r)
        want = variants(r["island"], r["island_el"], alias.get(r["island"], ""))
        cands = [f for f in feats if f["names"] & want]
        how, dist, chosen = "", "", None
        if r["island"] in forced:
            chosen, how = by_id.get(forced[r["island"]]), "forced (island_rules.csv osm_id)"
        elif cands and par is None:
            chosen = max(cands, key=lambda f: f["area"])
            how = f"largest of {len(cands)} name matches" if len(cands) > 1 else "unique name match"
        elif cands and par["island"] in placed:
            pf = placed[par["island"]]
            cands = [f for f in cands if f["id"] != pf["id"]] or cands  # never the parent itself
            near = sorted(cands, key=lambda f: km_to_box(f["pt"], pf))
            if km_to_box(near[0]["pt"], pf) <= MAX_ISLET_KM:
                chosen = near[0]
                how = f"nearest of {len(cands)} name matches to {par['island']}"
            else:
                how = f"no match within {MAX_ISLET_KM} km of {par['island']}"
        elif cands:
            chosen = max(cands, key=lambda f: f["area"])
            how = f"largest of {len(cands)} (parent {par['island']} not placed)"
        else:
            how = "no name match"
        if chosen:
            placed[r["island"]] = chosen
            if par and par["island"] in placed:
                dist = round(km_to_box(chosen["pt"], placed[par["island"]]), 1)
        b = chosen["bounds"] if chosen else None
        rows.append({
            "island": r["island"], "group": r["group"], "scope": r["scope"],
            "lat": round(chosen["pt"][0], 5) if chosen else "",
            "lon": round(chosen["pt"][1], 5) if chosen else "",
            "precision": "approximate: OSM bounding-box centre" if chosen else "",
            "osm_id": chosen["id"] if chosen else "",
            "osm_name": chosen["tags"].get("name", "") if chosen else "",
            "osm_name_en": chosen["tags"].get("name:en", "") if chosen else "",
            "osm_place": chosen["tags"].get("place", "") if chosen else "",
            "wikidata": chosen["tags"].get("wikidata", "") if chosen else "",
            "bbox": f"{b['minlat']:.4f},{b['minlon']:.4f},{b['maxlat']:.4f},{b['maxlon']:.4f}" if b else "",
            "parent": par["island"] if par else "", "km_to_parent": dist, "match": how,
            "source_ids": "OSM",
        })
    key = {r["island"]: i for i, r in enumerate(islands)}
    rows.sort(key=lambda x: key[x["island"]])
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {OUT.relative_to(ROOT)}: {sum(1 for r in rows if r['lat'] != '')} of {len(rows)} placed.")
    for r in rows:
        if r["lat"] == "" or not r["match"].startswith(("unique", "nearest", "forced")):
            print(f"  check: {r['island']:24} {r['match']}  -> {r['osm_name']} {r['osm_id']}")


if __name__ == "__main__":
    main()
