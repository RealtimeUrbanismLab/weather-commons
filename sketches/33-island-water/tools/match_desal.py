#!/usr/bin/env python3
"""Assign EMODnet desalination plants to islands (stdlib only).

Inputs:  data/raw/emodnet_desal/desal_greece.json  (tools/fetch_emodnet_desal.py)
         data/desal_place_rules.csv                (every place decision, reviewable)
         data/islands_geo.csv                      (island scope)
Outputs: data/derived/desal_plants_greece.csv      (all 415 records, one row each)
         data/derived/desal_by_island.csv          (per island in scope)

Order: a real municipality (comm_name) decides the island. Records at the Athens
placeholder or with no municipality are placed by their project / location text.
The first matching rule wins. Unmatched or vague text stays "not known".
Records identical to an earlier one are flagged (possible_duplicate_of), not removed:
they may be twin units or double entries.
Coordinates: the municipality centroid where EMODnet has a real municipality; blank
otherwise (the island is then known from text only). Never invented.

Usage: python -I tools/match_desal.py
"""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "emodnet_desal" / "desal_greece.json"
RULES = ROOT / "data" / "desal_place_rules.csv"
GEO = ROOT / "data" / "islands_geo.csv"
OUT = ROOT / "data" / "derived" / "desal_plants_greece.csv"
BY_ISLAND = ROOT / "data" / "derived" / "desal_by_island.csv"
TEXT_FIELDS = ("project", "locationname", "stateregion", "subregion")


def first(rules, field, value):
    for r in rules:
        if r["field"] == field and re.search(r["pattern"], value or "", re.I):
            return r
    return None


def year(s):
    m = re.search(r"(19|20)\d\d", s or "")
    return m.group(0) if m else ""


def main():
    rules = list(csv.DictReader(RULES.open(encoding="utf-8")))
    scope = {r["island"]: r["scope"] for r in csv.DictReader(GEO.open(encoding="utf-8"))}
    feats = json.loads(RAW.read_text(encoding="utf-8"))["features"]
    rows = []
    for i, f in enumerate(feats, 1):
        p = f["properties"]
        comm = (p.get("comm_name") or "").strip()
        text = " | ".join((p.get(k) or "") for k in TEXT_FIELDS)
        r = first(rules, "comm_name", comm)
        placeholder = r is not None and r["island"] == "" and r["note"].startswith("Placeholder")
        how, note = "", ""
        if r and not placeholder:
            island, how, note = r["island"], f"municipality ({comm})", r["note"]
            t = first(rules, "text", text)
            if t and t["island"] not in ("", island):
                note = (note + "; " if note else "") + f"text suggests {t['island']}"
        else:
            t = first(rules, "text", text)
            if t:
                island, how, note = t["island"], f"text: {t['pattern']}", t["note"]
            else:
                island, how = "", "no usable location"
        real_point = bool(r and not placeholder and p.get("lat"))
        sc = "outside" if island == "(outside)" else scope.get(island, "not known" if not island else "?")
        rows.append({
            "record": i, "emodnet_location_id": p.get("id"),
            "project": p.get("project") or "", "locationname": p.get("locationname") or "",
            "comm_name": comm, "nuts3": p.get("nuts3id") or "",
            "island": "" if island == "(outside)" else island, "island_scope": sc,
            "match_how": how, "match_note": note,
            "lat": round(float(p["lat"]), 5) if real_point else "",
            "lon": round(float(p["lon"]), 5) if real_point else "",
            "point_precision": "municipality centroid" if real_point else "not known",
            "capacity_m3d": p.get("capacity_m3d") or "", "units": p.get("units") or "",
            "technology": p.get("technology") or "", "feedwater": p.get("feedwater") or "",
            "plant_type": p.get("plant_type") or "", "plant_status": p.get("plant_status") or "",
            "award_year": year(p.get("award_date")), "online_year": year(p.get("online_date")),
            "customer_type": p.get("customer_type") or "", "customer": p.get("customer") or "",
            "plant_owner": p.get("plant_owner") or "", "accuracy": p.get("accuracy") or "",
            "last_update": p.get("last_update") or "",
            "evidence_kind": "documented", "source_ids": "EMODNET",
        })
    # flag records identical to an earlier one (twin units or double entries: not removed)
    seen = {}
    for r in rows:
        k = (r["island"], r["comm_name"], r["project"], r["locationname"], r["capacity_m3d"],
             r["online_year"], r["technology"], r["feedwater"], r["customer_type"])
        r["possible_duplicate_of"] = seen.get(k, "")
        seen.setdefault(k, r["record"])
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    # per-island summary (islands in scope only)
    agg = defaultdict(lambda: defaultdict(float))
    for r in rows:
        if r["island_scope"] not in ("base", "context"):
            continue
        a = agg[r["island"]]
        cap = float(r["capacity_m3d"] or 0)
        on = r["plant_status"] in ("Online", "Presumed Online")
        muni = r["customer_type"].startswith("Municipalities")
        a["records"] += 1
        a["online_records"] += on
        a["capacity_online_m3d"] += cap if on else 0
        a["municipal_records"] += muni
        a["municipal_capacity_online_m3d"] += cap if on and muni else 0
        a["seawater_records"] += r["feedwater"].startswith("Seawater")
        a["no_capacity_records"] += not r["capacity_m3d"]
        a["possible_duplicates"] += bool(r["possible_duplicate_of"])
        ys = [int(r["online_year"])] if r["online_year"] else []
        if ys:
            a["first_online_year"] = min(a.get("first_online_year", 9999), ys[0])
            a["last_online_year"] = max(a.get("last_online_year", 0), ys[0])
    cols = ["island", "scope", "records", "online_records", "capacity_online_m3d", "municipal_records",
            "municipal_capacity_online_m3d", "seawater_records", "no_capacity_records", "possible_duplicates",
            "first_online_year", "last_online_year", "data_to", "source_ids"]
    order = [r["island"] for r in csv.DictReader(GEO.open(encoding="utf-8"))]
    with BY_ISLAND.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(cols)
        for isl in order:
            if isl in agg:
                a = agg[isl]
                w.writerow([isl, scope[isl]] + [int(a[c]) if c in a else "" for c in cols[2:-2]]
                           + ["2020", "EMODNET"])

    c = defaultdict(int)
    for r in rows:
        c[r["island_scope"]] += 1
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(rows)} records -> " + ", ".join(f"{k} {v}" for k, v in sorted(c.items())))
    print(f"Wrote {BY_ISLAND.relative_to(ROOT)}: {len(agg)} islands with at least one record")
    if c.get("?"):
        print("  island names in rules not found in islands_geo.csv:",
              sorted({r['island'] for r in rows if r['island_scope'] == '?'}))


if __name__ == "__main__":
    main()
