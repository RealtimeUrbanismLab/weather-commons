#!/usr/bin/env python3
"""Build one desalination timeline for the islands in scope (stdlib only).

Inputs (all already in the repo; nothing is fetched):
  data/desal_literature.csv                  hand-entered plants from papers (HELLEXP14, BERTSIOU23)
  data/derived/desal_plants_greece.csv       EMODnet records to 2020 (tools/match_desal.py)
  data/derived/desal_permits_diavgeia.csv    Diavgeia permit decisions 2010-2026 (tools/parse_diavgeia_permits.py)
  data/islands_geo.csv                       island list, group and scope

Outputs:
  data/derived/desal_timeline.csv            one row per dated event
  data/derived/desal_history_by_island.csv   per island: first known plant, capacity by source, permits
  data/derived/desal_by_year.csv             per year and scope: plants online, capacity, permits

Three tracks are kept apart and never summed together:
  operating   a plant reported as installed or online (literature, EMODnet)
  permitted   a permit or approval (Diavgeia); not proof that a plant was built
  historic    a plant reported out of operation or presumed offline
Rows that would double-count are kept but marked count_in_totals=no:
  - EMODnet records flagged possible_duplicate_of
  - Diavgeia amendments/corrections, payments, and "other" decisions are not loaded at all.
Survivorship: EMODnet is a 2020 snapshot, so plants closed before then are mostly missing.
The cumulative EMODnet curve is "capacity still listed in 2020, by year online", not the
capacity that existed in each year.

Usage: python -I tools/build_desal_timeline.py
"""
import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DER = DATA / "derived"
PERMIT_KINDS = {"environmental terms", "water-use / works permit", "temporary install/operate permit",
                "installation / operating permit", "building permit"}
COLS = ["island", "group", "island_scope", "year", "date", "track", "event", "status", "status_as_of",
        "capacity_m3d", "units", "technology", "feedwater", "energy", "customer", "place", "opex_eur_m3",
        "count_in_totals", "evidence_kind", "source_ids", "ref", "note"]


def read(path):
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def fmt(x):
    return "" if x is None else (int(x) if float(x).is_integer() else round(x, 2))


def main():
    geo = {r["island"]: r for r in read(DATA / "islands_geo.csv")}
    order = list(geo)
    rows = []

    def add(island, **kw):
        g = geo.get(island.split(";")[0])  # a decision naming several islands takes the first one's scope
        scope = g["scope"] if g else ("outside" if island == "(outside)" else "not known")
        r = {c: "" for c in COLS}
        r.update(island="" if island == "(outside)" else island, group=g["group"] if g else "", island_scope=scope)
        r.update(kw)
        rows.append(r)

    # 1. literature
    for p in read(DATA / "desal_literature.csv"):
        track = "historic" if p["status"] == "out of operation" else "operating"
        add(p["island"], year=p["year"], date=p["year"], track=track, event=p["event"], status=p["status"],
            status_as_of=p["status_as_of"], capacity_m3d=p["capacity_m3d"], units=p["units"],
            technology=p["technology"], feedwater=p["feedwater"], energy=p["energy"], place=p["place"],
            opex_eur_m3=p["opex_eur_m3"], count_in_totals="yes", evidence_kind=p["evidence_kind"],
            source_ids=p["source_ids"], ref=p["ref"], note=p["note"])

    # 2. EMODnet (records in scope only)
    for e in read(DER / "desal_plants_greece.csv"):
        if e["island_scope"] not in ("base", "context"):
            continue
        offline = e["plant_status"] == "Presumed Offline"
        dup = bool(e["possible_duplicate_of"])
        note = "; ".join(x for x in (
            f"possible duplicate of EMODnet record {e['possible_duplicate_of']}" if dup else "",
            "no online year" if not e["online_year"] else "",
            e["match_note"]) if x)
        add(e["island"], year=e["online_year"], date=e["online_year"],
            track="historic" if offline else "operating",
            event="online" if e["online_year"] else "listed (no online year)",
            status=e["plant_status"], status_as_of="2020 (last EMODnet update)",
            capacity_m3d=e["capacity_m3d"], units=e["units"], technology=e["technology"],
            feedwater=e["feedwater"], customer=e["customer_type"].split(" (")[0],
            place=e["project"] or e["locationname"], count_in_totals="no" if dup else "yes",
            evidence_kind="documented", source_ids="EMODNET", ref=f"EMODnet record {e['record']}", note=note)

    # 3. Diavgeia permits (in scope, permit kinds, not amendments)
    for d in read(DER / "desal_permits_diavgeia.csv"):
        if d["island_scope"] not in ("base", "context") or d["kind"] not in PERMIT_KINDS or d["amends_or_corrects"]:
            continue
        add(d["island"], year=d["issue_date"][:4], date=d["issue_date"], track="permitted", event=d["kind"],
            status="permitted", status_as_of=d["issue_date"], capacity_m3d=d["capacity_m3d"], units=d["units"],
            technology="portable unit" if d["portable"] else "", count_in_totals="yes",
            evidence_kind="documented", source_ids="DIAVGEIA", ref=f"Diavgeia ADA {d['ada']}",
            note="permitted or approved; not proof of a built or operating plant"
                 + ("; one decision for several islands" if ";" in d["island"] else ""))

    track_order = {"operating": 0, "historic": 1, "permitted": 2}
    rows.sort(key=lambda r: (order.index(r["island"]) if r["island"] in order else 999, r["island"],
                             r["date"] or "9999", track_order[r["track"]]))
    with (DER / "desal_timeline.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    # per island
    isl = defaultdict(lambda: defaultdict(float))
    first = {}
    for r in rows:
        if r["island_scope"] not in ("base", "context"):
            continue
        a, y, cap = isl[r["island"]], num(r["year"]), num(r["capacity_m3d"])
        src = r["source_ids"]
        if r["track"] in ("operating", "historic") and y:
            if r["island"] not in first or y < first[r["island"]][0]:
                first[r["island"]] = (y, src, r["place"])
        if src in ("HELLEXP14", "BERTSIOU23"):
            a["lit_plants"] += 1
            if r["status"] in ("operating", "under construction") and cap:
                a["lit_capacity_m3d"] += cap
        elif src == "EMODNET" and r["count_in_totals"] == "yes":
            a["emod_records"] += 1
            if r["track"] == "operating" and cap:
                a["emod_capacity_2020_m3d"] += cap
            if r["track"] == "operating" and y:
                a["emod_first"] = min(a.get("emod_first", 9999), y)
                a["emod_last"] = max(a.get("emod_last", 0), y)
        elif src == "DIAVGEIA":
            names = r["island"].split(";")
            for name in names:  # a shared decision counts for each island; its capacity only when single
                a = isl[name]
                a["permits"] += 1
                a["permits_with_capacity"] += cap is not None and len(names) == 1
                a["first_permit"] = min(a.get("first_permit", 9999), y)
                a["last_permit_date"] = max(a.get("last_permit_date", 0), int(r["date"].replace("-", "")))
                if r["event"] == "temporary install/operate permit" and y and y >= 2024:
                    a["temp_permits_2024_26"] += 1
                    a["temp_permit_capacity_m3d"] += (cap or 0) if len(names) == 1 else 0
    cols = ["island", "group", "scope", "first_known_year", "first_known_source", "first_known_place",
            "lit_plants", "lit_capacity_m3d", "emod_records", "emod_capacity_2020_m3d", "emod_first_online",
            "emod_last_online", "permits", "permits_with_capacity", "first_permit_year", "last_permit_date",
            "temp_permits_2024_26", "temp_permit_capacity_m3d"]
    with (DER / "desal_history_by_island.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(cols)
        for name in order:
            if name not in isl:
                continue
            a, fk = isl[name], first.get(name, ("", "", ""))
            lpd = int(a["last_permit_date"]) if a.get("last_permit_date") else 0
            w.writerow([name, geo[name]["group"], geo[name]["scope"], fmt(fk[0] or None), fk[1], fk[2],
                        fmt(a["lit_plants"]), fmt(a["lit_capacity_m3d"] or None), fmt(a["emod_records"]),
                        fmt(a["emod_capacity_2020_m3d"] or None), fmt(a.get("emod_first")), fmt(a.get("emod_last")),
                        fmt(a["permits"]), fmt(a["permits_with_capacity"]), fmt(a.get("first_permit")),
                        f"{lpd // 10000}-{lpd // 100 % 100:02d}-{lpd % 100:02d}" if lpd else "",
                        fmt(a["temp_permits_2024_26"]), fmt(a["temp_permit_capacity_m3d"] or None)])

    # per year and scope
    yr = defaultdict(lambda: defaultdict(float))
    for r in rows:
        y = num(r["year"])
        if r["island_scope"] not in ("base", "context") or not y or r["count_in_totals"] != "yes":
            continue
        a, cap = yr[(int(y), r["island_scope"])], num(r["capacity_m3d"]) or 0
        if r["source_ids"] == "EMODNET" and r["track"] == "operating":
            a["emod_plants_online"] += 1
            a["emod_capacity_online_m3d"] += cap
        elif r["source_ids"] in ("HELLEXP14", "BERTSIOU23"):
            a["lit_plants_installed"] += 1
            a["lit_capacity_m3d"] += cap
        elif r["source_ids"] == "DIAVGEIA":
            a["permit_decisions"] += 1
            if r["event"] == "temporary install/operate permit":
                a["temp_permits"] += 1
                a["temp_permit_capacity_m3d"] += cap
    cols = ["year", "scope", "emod_plants_online", "emod_capacity_online_m3d", "emod_cumulative_listed_2020_m3d",
            "lit_plants_installed", "lit_capacity_m3d", "permit_decisions", "temp_permits", "temp_permit_capacity_m3d"]
    with (DER / "desal_by_year.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(cols)
        for scope in ("base", "context"):
            years = sorted(y for y, s in yr if s == scope)
            cum = 0.0
            for y in range(years[0], max(years) + 1):
                a = yr.get((y, scope), {})
                cum += a.get("emod_capacity_online_m3d", 0)
                w.writerow([y, scope] + [fmt(a.get(c, 0)) for c in cols[2:4]] + [fmt(cum)]
                           + [fmt(a.get(c, 0)) for c in cols[5:]])

    n = defaultdict(int)
    for r in rows:
        n[(r["source_ids"], r["track"])] += 1
    print(f"Wrote desal_timeline.csv: {len(rows)} events; " + ", ".join(f"{k[0]} {k[1]} {v}" for k, v in sorted(n.items())))
    print(f"Wrote desal_history_by_island.csv: {len(isl)} islands; desal_by_year.csv")
    missing = sorted({r["island"] for r in rows if r["island_scope"] == "not known" and r["island"]})
    if missing:
        print("  island names not in islands_geo.csv:", missing)


if __name__ == "__main__":
    main()
