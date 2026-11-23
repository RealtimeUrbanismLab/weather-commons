#!/usr/bin/env python3
"""Write the small data files the page loads (stdlib only).

Inputs:  data/raw/rain_daily/rain_daily_sifnos.csv     (git-ignored; tools/fetch_rain.py)
         data/derived/rain_cells.csv, data/islands.csv, data/derived/desal_reconciled_by_island.csv
         data/rwh_reference_kakoulas22.csv, data/derived/cistern_reference_check.csv
Output:  data/page/sifnos_rain_daily.json   daily rain, 1 decimal, ~60 KB
         data/page/simulate_context.json    every other number the Simulate section cites,
                                            each with its source and evidence kind

The page computes everything else in the browser, so a reader can see the same numbers
the Python tools give (tools/simulate_cistern.py; checked by tools/check_page_sim.mjs).

Usage: python -I tools/build_page_data.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "page"


def read(p):
    with p.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    OUT.mkdir(exist_ok=True)
    rain = read(DATA / "raw" / "rain_daily" / "rain_daily_sifnos.csv")
    cell = next(r for r in read(DATA / "derived" / "rain_cells.csv") if r["island"] == "Sifnos")
    mm = [round(float(r["precip_mm"]), 1) if r["precip_mm"] != "" else None for r in rain]
    (OUT / "sifnos_rain_daily.json").write_text(json.dumps({
        "island": "Sifnos", "start": rain[0]["date"], "end": rain[-1]["date"], "unit": "mm/day",
        "kind": "reanalysed", "source": "ERA5 (Copernicus C3S, ECMWF) via Open-Meteo, models=era5; CC BY 4.0",
        "cell": {"lat": float(cell["cell_lat"]), "lon": float(cell["cell_lon"]),
                 "km_from_point": float(cell["km_point_to_cell"])},
        "retrieved": "2026-11-23", "mm": mm,
    }, separators=(",", ":")), encoding="utf-8")

    sif = next(r for r in read(DATA / "islands.csv") if r["island"] == "Sifnos")
    desal = next(r for r in read(DATA / "derived" / "desal_reconciled_by_island.csv") if r["island"] == "Sifnos")
    chk = read(DATA / "derived" / "cistern_reference_check.csv")
    diffs = [float(r["diff_ybs_pts"]) for r in chk]
    costs = {}
    for r in read(DATA / "rwh_reference_kakoulas22.csv"):
        if r["case"] == "house":
            costs[int(float(r["tank_m3"]))] = int(float(r["cost_eur"]))
    ctx = {
        "residents_2021": {"value": int(sif["residents"]), "kind": "observed (census)", "source": "ELSTAT21"},
        "desal_capacity_m3d": {"value": int(desal["reconciled_operating_m3d"]), "kind": "documented (capacity, not output)",
                               "source": "EMODNET;HELLEXP14;ETHNOS24;DIAVGEIA_SIF (reconciled, data/desal_reconciled.csv)"},
        "house_cost_eur_by_tank_m3": {"value": costs, "kind": "reported (Chios prices, 2022)", "source": "KAKOULAS22 Table 2"},
        "era5_vs_station_factor": {"value": round(581.7 / 664.0, 3), "kind": "calculated",
                                   "source": "KAKOULAS22 station mean 581.7 mm/yr vs ERA5 664 mm/yr, Chios 2013-2019",
                                   "note": "Measured on Chios only; not checked on Sifnos"},
        "model_check": {"cases": len(chk), "mean_abs_diff_pts": round(sum(map(abs, diffs)) / len(diffs), 1),
                        "max_abs_diff_pts": round(max(map(abs, diffs)), 1), "source": "KAKOULAS22 Table 5",
                        "note": "Our model with ERA5 rain vs the paper's 54 household cases (tools/check_cistern_reference.py)"},
        "school": {"roof_m2": 600, "people": 100, "litres_per_person_day": 20, "tank_m3": 24,
                   "source": "KAKOULAS22 (Chios school case)", "kind": "reported parameters"},
        "runoff": {"value": 0.8, "kind": "synthetic (assumed)", "note": "KAKOULAS22 used 0.9 x 0.95 = 0.855"},
    }
    (OUT / "simulate_context.json").write_text(json.dumps(ctx, ensure_ascii=False, indent=1), encoding="utf-8")

    # Event: October-March rain on Sifnos, each complete winter, against the 1991-2020 average
    wint = [r for r in read(DATA / "derived" / "rain_winters.csv") if r["island"] == "Sifnos" and r["complete"] == "yes"]
    base = [float(r["oct_mar_mm"]) for r in wint if "1991-92" <= r["winter"] <= "2019-20"]
    (OUT / "event_winters.json").write_text(json.dumps({
        "island": "Sifnos", "months": "October-March", "kind": "reanalysed", "source": "ERA5 via Open-Meteo",
        "normal_mm": round(sum(base) / len(base), 1), "normal_period": "winters 1991-92 to 2019-20",
        "winters": [{"winter": r["winter"], "mm": float(r["oct_mar_mm"])} for r in wint],
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    situate()
    kb = (OUT / "sifnos_rain_daily.json").stat().st_size / 1024
    print(f"Wrote data/page/sifnos_rain_daily.json ({len(mm)} days, {kb:.0f} KB), simulate_context.json, "
          "event_winters.json, situate_islands.json, situate_desal.json, situate_costs.json")


def situate():
    """Situate: every island on one map, desalination over time, one EUR/m3 scale."""
    geo = read(DATA / "islands_geo.csv")
    rec = {r["island"]: r for r in read(DATA / "derived" / "desal_reconciled_by_island.csv")}
    emod = {r["island"]: r for r in read(DATA / "derived" / "desal_by_island.csv")}
    hist = {r["island"]: r for r in read(DATA / "derived" / "desal_history_by_island.csv")}
    cost = {r["island"]: r["desal_cost_eur_m3"] for r in read(DATA / "islands.csv")}
    # water emergencies only: the Sifnos erosion emergency is listed in the file so it is not mistaken for one
    # documented: every Civil Protection water emergency (data/civil_protection_water.csv, one row per
    # municipality chain); reported: the other rows of emergencies.csv (ministerial or press only)
    emerg = {}
    for r in read(DATA / "civil_protection_water.csv"):
        if r["island"] and not r["island"].startswith("outside"):
            emerg.setdefault(r["island"], []).append(
                {"start": r["declared"], "end": r["end"], "by": "Civil Protection", "place": r["municipality"],
                 "trigger": "water shortage", "kind": "documented", "source": r["source_ids"]})
    for r in read(DATA / "emergencies.csv"):
        if "NOT a water emergency" in r["notes"] or "DIAVGEIA" in r["source_ids"]:
            continue
        emerg.setdefault(r["island_or_area"], []).append(
            {"start": r["start"], "end": r["end"], "by": r["declared_by"], "trigger": r["trigger"],
             "kind": "reported", "source": r["source_ids"]})
    for v in emerg.values():
        v.sort(key=lambda e: e["start"])
    winters = sorted({r["winter"] for r in read(DATA / "derived" / "rain_winters.csv") if r["complete"] == "yes"})
    rain = {}
    for r in read(DATA / "derived" / "rain_winters.csv"):
        if r["complete"] == "yes":
            rain.setdefault(r["island"], {})[r["winter"]] = float(r["oct_mar_mm"])
    islands = []
    for g in geo:
        n = g["island"]
        w = rain.get(n, {})
        base = [w[x] for x in winters if "1991-92" <= x <= "2019-20" and x in w]
        normal = sum(base) / len(base) if base else None
        if n in rec:
            cap, basis = int(rec[n]["reconciled_operating_m3d"]), "reconciled"
        elif n in emod and emod[n]["capacity_online_m3d"]:
            cap, basis = int(float(emod[n]["capacity_online_m3d"])), "EMODnet"
        else:
            cap, basis = None, None
        h = hist.get(n, {})
        islands.append({
            "name": n, "group": g["group"], "scope": g["scope"], "lat": float(g["lat"]), "lon": float(g["lon"]),
            "residents": int(g["residents_2021"]) if g["residents_2021"] else None,
            "normal_mm": round(normal, 1) if normal else None,
            "rain_pct": [round(100 * w[x] / normal) if normal and x in w else None for x in winters],
            "desal_m3d": cap, "desal_basis": basis,
            "temp_permits": int(h["temp_permits_2024_26"]) if h.get("temp_permits_2024_26") else 0,
            "temp_permit_m3d": int(float(h["temp_permit_capacity_m3d"])) if h.get("temp_permit_capacity_m3d") else None,
            "desal_cost_2025": float(cost[n]) if cost.get(n) else None,
            "emergencies": emerg.get(n, []),
        })
    (OUT / "situate_islands.json").write_text(json.dumps({
        "winters": winters, "normal_period": "winters 1991-92 to 2019-20",
        "kinds": {"position": "cartographic (OSM place node of the main village)", "residents": "observed (ELSTAT 2021)",
                  "rain": "reanalysed (ERA5)", "desal": "documented (capacity, not output)",
                  "desal_cost_2025": "reported (PROTO25)"},
        "islands": islands,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # desalination over time: every record per island (base scope), plus the yearly totals
    ev = {}
    for r in read(DATA / "derived" / "desal_timeline.csv"):
        n = r["island"].split(";")[0].strip()
        if not n or r["island_scope"] != "base" or not r["year"]:
            continue
        ev.setdefault(n, []).append({
            "y": int(r["year"]), "t": r["track"], "e": r["event"],
            "m3d": int(float(r["capacity_m3d"])) if r["capacity_m3d"] else None,
            "place": r["place"], "k": r["evidence_kind"], "s": r["source_ids"]})
    rows = sorted(ev.items(), key=lambda kv: (min(e["y"] for e in kv[1]), kv[0]))
    years = [r for r in read(DATA / "derived" / "desal_by_year.csv") if r["scope"] == "base"]
    (OUT / "situate_desal.json").write_text(json.dumps({
        "scope": "islands in the sketch's base list (Crete, Evia and other context islands left out)",
        "islands": [{"name": n, "events": sorted(e, key=lambda x: x["y"])} for n, e in rows],
        "by_year": [{"year": int(r["year"]), "listed_m3d": int(float(r["emod_cumulative_listed_2020_m3d"])),
                     "temp_permits": int(r["temp_permits"]),
                     "temp_permit_m3d": int(float(r["temp_permit_capacity_m3d"]))} for r in years],
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Poulati, from the chapter (ZEPOU24) and DECA: springs in altitude order and the counts the diagrams use
    springs = [{"n": int(r["spring"]), "name": r["name"], "communal": r["communal_cistern"], "facts": r["facts"],
                "pages": r["pages"]} for r in read(DATA / "poulati_springs.csv")]
    (OUT / "poulati.json").write_text(json.dumps({
        "springs": springs, "spring_top_m": 140, "communal_near": [1, 3, 5, 6, 7],
        "cisterns": {"open_air": 21, "open_air_m3": [15, 20], "communal": 5, "troughs": 10, "trough_m3": 3},
        "open_storage_m3": [21 * 15 + 10 * 3, 21 * 20 + 10 * 3],
        "spring5_waters_per_week": 14, "spring5_families": 5,
        "contracts": [{"waters": 4, "days": ["Tue", "Wed", "Sat", "Sun"], "from": "a spring outside the plot"},
                      {"waters": 2, "days": [], "from": "the communal cistern of spring 1"},
                      {"waters": 1, "days": [], "from": "the cisterns of spring 6, by pipe two terraces down"},
                      {"waters": 1, "days": [], "from": "the seller's spring"}],
        "properties": {"total": 34, "farmed": 5, "summer_houses": 6, "abandoned": 23, "over_0_4_ha": 14},
        "farmers": {"1980s": 25, "2022": 6, "2022_over_75": 4, "deca_recent_past": 100},
        "irrigated_ha": 15.5, "cultivated_ha": 1, "stone_m3": 21000,
        "kind": "reported", "source": "ZEPOU24 (Zepou & Matsaganis 2024, CC BY-NC-ND; facts only); DECA",
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    costs = []
    for r in read(DATA / "water_costs.csv"):
        costs.append({k: (float(r[k]) if r[k] else None) if k.endswith("_eur_m3") else r[k] for k in r})
    (OUT / "situate_costs.json").write_text(json.dumps(costs, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
