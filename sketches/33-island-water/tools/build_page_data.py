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
                               "source": "EMODNET;HELLEXP14;ETHNOS24 (reconciled, data/desal_reconciled.csv)"},
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
    kb = (OUT / "sifnos_rain_daily.json").stat().st_size / 1024
    print(f"Wrote data/page/sifnos_rain_daily.json ({len(mm)} days, {kb:.0f} KB) and simulate_context.json")


if __name__ == "__main__":
    main()
