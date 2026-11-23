#!/usr/bin/env python3
"""Build the island base layer from the ELSTAT 2021 settlement table (stdlib only).

Each settlement (geographic level 8) is assigned to an island by the longest matching
code prefix in data/island_rules.csv. Settlements the census tags "(νησίς)" with
residents above zero, but that no full-code rule covers, are reported so a rule can be
added: nothing is assigned silently.

Input:  data/raw/elstat_census_2021/MON_PLI_DHM_OIKISN_2021.xlsx  (tools/fetch_census.py)
Output: data/derived/islands_census_2021.csv (with each island's most populous settlement)

Usage: python -I tools/build_islands.py
"""
import csv
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "data" / "raw" / "elstat_census_2021" / "MON_PLI_DHM_OIKISN_2021.xlsx"
RULES = ROOT / "data" / "island_rules.csv"
OUT = ROOT / "data" / "derived" / "islands_census_2021.csv"
TMP = ROOT / "data" / "raw" / "elstat_census_2021" / "settlements.csv"


def main():
    subprocess.run([sys.executable, "-I", str(ROOT / "tools" / "xlsx_to_csv.py"), str(XLSX), str(TMP)], check=True)
    rules = list(csv.DictReader(RULES.open(encoding="utf-8")))
    by_code = {r["code"]: r for r in rules}
    full_codes = {r["code"] for r in rules if len(r["code"]) == 10}

    islands = defaultdict(lambda: {"residents": 0, "settlements": 0, "inhabited_settlements": 0, "codes": set(),
                                   "main": ("", "", -1)})
    unmatched_islets = []
    rows = list(csv.reader(TMP.open(encoding="utf-8")))[1:]
    for r in rows:
        if r[1] != "8":
            continue
        code, name, pop = r[4].strip(), r[5].strip(), int(float(r[6] or 0))
        rule = next((by_code[code[:n]] for n in range(len(code), 1, -1) if code[:n] in by_code), None)
        if "(νησίς)" in name and pop > 0 and code not in full_codes:
            unmatched_islets.append((code, name, pop, rule["island_en"] if rule else "-"))
        if not rule or rule["scope"] == "exclude":
            continue
        key = (rule["island_en"], rule["island_el"], rule["group"], rule["scope"])
        isl = islands[key]
        isl["residents"] += pop
        isl["settlements"] += 1
        isl["inhabited_settlements"] += pop > 0
        if pop > isl["main"][2]:  # most populous settlement = main village
            isl["main"] = (code, name, pop)
        isl["codes"].add(next(c for c in sorted(by_code, key=len, reverse=True) if code.startswith(c)))

    notes = {(r["island_en"], r["scope"]): r["note"] for r in rules if r["note"]}
    out = sorted(islands.items(), key=lambda kv: ({"base": 0, "context": 1}[kv[0][3]], kv[0][2], -kv[1]["residents"]))
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["island", "island_el", "group", "scope", "residents_2021", "inhabited",
                    "settlements", "inhabited_settlements", "main_settlement", "main_settlement_code",
                    "main_settlement_residents", "census_codes", "notes", "source_ids"])
        for (en, el, grp, scope), v in out:
            w.writerow([en, el, grp, scope, v["residents"], "yes" if v["residents"] > 0 else "no",
                        v["settlements"], v["inhabited_settlements"], v["main"][1], v["main"][0], v["main"][2],
                        ";".join(sorted(v["codes"])),
                        notes.get((en, scope), ""), "ELSTAT21"])
    TMP.unlink()

    base = [k for k, v in islands.items() if k[3] == "base" and v["residents"] > 0]
    ctx = [k for k, v in islands.items() if k[3] == "context" and v["residents"] > 0]
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(base)} inhabited base islands, {len(ctx)} context.")
    for (en, _, _, scope), v in islands.items():
        if v["residents"] == 0:
            print(f"  no residents in 2021: {en} ({scope})")
    if unmatched_islets:
        print("Inhabited islets with no rule (add to data/island_rules.csv):")
        for c in unmatched_islets:
            print("  ", *c)


if __name__ == "__main__":
    main()
