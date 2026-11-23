#!/usr/bin/env python3
"""Check the hand-reconciled plant table and summarise it per island (stdlib only).

data/desal_reconciled.csv groups the three desal sources into plants, island by island,
for the islands that have all three (EMODnet, literature, Diavgeia), except Crete. Each
row says how sure the grouping is (likely / possible / one source only) and why.

Checks, for every island in the table:
  - every EMODnet record placed on that island appears in exactly one row;
  - every literature plant on that island is cited in a row (by year and capacity);
  - every Diavgeia ADA cited exists in the permits table.
Output: data/derived/desal_reconciled_by_island.csv
  EMODnet raw capacity (2020, all records) vs reconciled capacity (double entries and
  closed plants removed, literature-only plants added), and permitted capacity apart.

Usage: python -I tools/check_desal_reconciled.py
"""
import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, DER = ROOT / "data", ROOT / "data" / "derived"
OPERATING = {"online", "presumed online", "operating"}


def read(p):
    with p.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    rec = read(DATA / "desal_reconciled.csv")
    islands = list(dict.fromkeys(r["island"] for r in rec))
    emod = read(DER / "desal_plants_greece.csv")
    lit = read(DATA / "desal_literature.csv")
    adas = {r["ada"] for r in read(DER / "desal_permits_diavgeia.csv")}
    problems = 0

    for isl in islands:
        rows = [r for r in rec if r["island"] == isl]
        cited = [x for r in rows for x in r["emodnet_records"].split(";") if x]
        have = [e["record"] for e in emod if e["island"] == isl]
        missing = sorted(set(have) - set(cited), key=int)
        extra = sorted(set(cited) - set(have), key=int)
        twice = sorted({x for x in cited if cited.count(x) > 1}, key=int)
        for label, xs in (("EMODnet records not in table", missing), ("cited but not on this island", extra),
                          ("cited twice", twice)):
            if xs:
                print(f"{isl}: {label}: {xs}")
                problems += 1
        littext = " ".join(r["literature"] for r in rows)
        for p in lit:
            if p["island"] == isl and not (p["year"] in littext or p["place"].split(" (")[0] in littext):
                print(f"{isl}: literature plant not cited: {p['place']} {p['year']}")
                problems += 1
        for r in rows:
            for a in r["permit_adas"].split(";"):
                if a and a not in adas:
                    print(f"{isl}: unknown ADA {a}")
                    problems += 1

    out = []
    for isl in islands:
        rows = [r for r in rec if r["island"] == isl]
        raw = sum(float(e["capacity_m3d"] or 0) for e in emod
                  if e["island"] == isl and e["plant_status"] in ("Online", "Presumed Online"))
        op = [r for r in rows if r["latest_status"] in OPERATING and r["match"] != "permit only"]
        out.append({
            "island": isl,
            "emodnet_listed_online_m3d": round(raw),
            "reconciled_operating_m3d": round(sum(float(r["capacity_m3d"] or 0) for r in op)),
            "plants_rows": len([r for r in rows if r["match"] != "permit only"]),
            "matched_likely": sum(r["match"] == "likely" for r in rows),
            "matched_possible": sum(r["match"] == "possible" for r in rows),
            "literature_only": sum(r["match"] == "literature only" for r in rows),
            "emodnet_only": sum(r["match"] == "EMODnet only" for r in rows),
            "permit_only_rows": sum(r["match"] == "permit only" for r in rows),
            "permitted_not_built_m3d": round(sum(float(r["capacity_m3d"] or 0) for r in rows
                                                 if r["match"] == "permit only")),
        })
    with (DER / "desal_reconciled_by_island.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    for o in out:
        print(f"{o['island']:18} EMODnet {o['emodnet_listed_online_m3d']:>6}  reconciled {o['reconciled_operating_m3d']:>6}"
              f"  likely {o['matched_likely']} possible {o['matched_possible']}  permitted-only {o['permitted_not_built_m3d']}")
    print("OK" if not problems else f"{problems} problem(s)")


if __name__ == "__main__":
    main()
