#!/usr/bin/env python3
"""Place each island at its main village: the most populous settlement in the 2021 census.

Inputs:  data/derived/islands_census_2021.csv  (main_settlement, tools/build_islands.py)
         data/derived/islands_geo_osm.csv      (island outline ids and box centres)
         data/raw/osm_islands/villages.json    (tools/fetch_osm_villages.py)
         data/island_rules.csv                 (village_osm_id column, optional: forces a node)
Output:  data/derived/island_points.csv and data/islands_geo.csv (map-facing)

Census names are formal (katharevousa: Λιβάδιον, Σπέτσαι); OSM uses everyday forms
(Λιβάδι, Σπέτσες). Names are compared after simple ending rewrites and accent removal,
then by similarity. A capital named after its island ("Νάξος,η") may be "Χώρα" in OSM.
Islands with no match (mostly islets with no village point in OSM) keep the OSM box
centre, flagged in `point_how`.

Usage: python -I tools/locate_villages.py
"""
import csv
import difflib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CENSUS = ROOT / "data" / "derived" / "islands_census_2021.csv"
GEO = ROOT / "data" / "derived" / "islands_geo_osm.csv"
VILLAGES = ROOT / "data" / "raw" / "osm_islands" / "villages.json"
RULES = ROOT / "data" / "island_rules.csv"
OUT = ROOT / "data" / "derived" / "island_points.csv"
GEO_OUT = ROOT / "data" / "islands_geo.csv"
CISTERN_MIN_RESIDENTS = 10  # base islands below this are drawn as dots (decided 2026-11-23)
NAME_KEYS = ("name", "name:el", "alt_name", "alt_name:el", "old_name", "official_name", "loc_name")
RANK = {"city": 0, "town": 1, "village": 2, "suburb": 3, "quarter": 3, "hamlet": 4,
        "neighbourhood": 5, "isolated_dwelling": 6, "locality": 7}
MIN_RATIO = 0.8


def base(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").replace("ς", "σ")
    return re.sub(r"[^\w ]+", " ", s).strip()


def demotic(word):
    # formal -> everyday endings, enough for village names
    for a, b in (("ιον", "ι"), ("ειον", "ειο"), ("ον", "ο"), ("αι", "εσ"), ("ισ", "η")):
        if word.endswith(a) and len(word) > len(a) + 2:
            return word[: -len(a)] + b
    return word


def forms(census_name):
    name = re.sub(r"\(νησίς\)", "", census_name)
    parts = [p for p in re.split(r"[()]", name) if p.strip()]
    out = set()
    for p in parts:
        p = p.split(",")[0]  # drop the article: "Απολλωνία,η"
        b = base(p)
        if b:
            out.add(b)
            out.add(" ".join(demotic(w) for w in b.split()))
    return out


def node_names(tags):
    out = set()
    for k in NAME_KEYS:
        for v in tags.get(k, "").split(";"):
            if v.strip():
                out.add(base(v))
    return out


def main():
    census = {r["island"]: r for r in csv.DictReader(CENSUS.open(encoding="utf-8"))}
    geo = list(csv.DictReader(GEO.open(encoding="utf-8")))
    rules = list(csv.DictReader(RULES.open(encoding="utf-8")))
    forced = {r["island_en"]: r.get("village_osm_id", "") for r in rules}

    nodes_by_island, cur = {}, None
    for e in json.loads(VILLAGES.read_text(encoding="utf-8"))["elements"]:
        if e["type"] != "node":
            cur = f"{e['type']}/{e['id']}"
            nodes_by_island.setdefault(cur, [])
        else:
            nodes_by_island[cur].append(e)

    rows = []
    for g in geo:
        c = census[g["island"]]
        nodes = nodes_by_island.get(g["osm_id"], [])
        want = forms(c["main_settlement"])
        island_forms = forms(c["island_el"]) | {base(g["island"])}
        best, how, score = None, "", 0.0
        if forced.get(g["island"]):
            best = next((n for n in nodes if f"node/{n['id']}" == forced[g["island"]]), None)
            how = "forced (island_rules.csv village_osm_id)" if best else "forced id not found"
        else:
            for n in nodes:
                for nm in node_names(n["tags"]):
                    s = max(difflib.SequenceMatcher(None, w, nm).ratio() for w in want)
                    key = (s, -RANK.get(n["tags"].get("place"), 9))
                    if key > (score, -RANK.get((best or {}).get("tags", {}).get("place"), 9)):
                        best, score = n, s
            if best and score >= MIN_RATIO:
                how = f"name match {score:.2f}"
            else:
                best = None
                islet = "(νησίς)" in c["main_settlement"]
                if want & island_forms or islet:  # capital named after the island: try "Χώρα"
                    choras = [n for n in nodes if node_names(n["tags"]) & {"χωρα"}]
                    if choras:
                        best = min(choras, key=lambda n: RANK.get(n["tags"].get("place"), 9))
                        how = "capital named after island; OSM 'Χώρα'"
                if not best:
                    how = "islet: no village point in OSM" if islet else "no village match"
        if best:
            lat, lon = best["lat"], best["lon"]
            precision = "approximate: OSM place node of main village"
            vname, vid, vplace = best["tags"].get("name", ""), f"node/{best['id']}", best["tags"].get("place", "")
        else:
            lat, lon = g["lat"], g["lon"]
            precision = g["precision"]
            vname, vid, vplace = "", "", ""
        rows.append({"island": g["island"], "group": g["group"], "scope": g["scope"],
                     "residents_2021": c["residents_2021"],
                     "lat": round(float(lat), 5), "lon": round(float(lon), 5), "precision": precision,
                     "main_settlement_census": c["main_settlement"],
                     "main_settlement_residents": c["main_settlement_residents"],
                     "village_osm_name": vname, "village_osm_id": vid, "village_place": vplace,
                     "point_how": how, "island_osm_id": g["osm_id"],
                     "source_ids": "ELSTAT21;OSM"})
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    placed = sum(1 for r in rows if r["village_osm_id"])
    print(f"Wrote {OUT.relative_to(ROOT)}: {placed} at a village, {len(rows) - placed} at the box centre.")

    # The map-facing file the other tools read (island, lat, lon, osm_name_en).
    en = {g["island"]: g["osm_name_en"] for g in geo}
    with GEO_OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["island", "group", "scope", "map_symbol", "residents_2021", "lat", "lon", "precision",
                    "point_name", "osm_name_en", "island_osm_id", "village_osm_id", "notes", "source_ids"])
        for r in rows:
            res = int(r["residents_2021"])
            symbol = ("context" if r["scope"] == "context"
                      else "cistern" if res >= CISTERN_MIN_RESIDENTS else "dot")
            note = "" if r["village_osm_id"] else f"box centre: {r['point_how']}"
            w.writerow([r["island"], r["group"], r["scope"], symbol, res, r["lat"], r["lon"], r["precision"],
                        r["village_osm_name"], en[r["island"]], r["island_osm_id"], r["village_osm_id"],
                        note, r["source_ids"]])
    print(f"Wrote {GEO_OUT.relative_to(ROOT)}")
    for r in rows:
        if not r["village_osm_id"] and not r["point_how"].startswith("islet"):
            print(f"  check: {r['island']:24} {r['main_settlement_census']:32} {r['point_how']}")


if __name__ == "__main__":
    main()
