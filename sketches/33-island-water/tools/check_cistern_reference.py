#!/usr/bin/env python3
"""Check simulate_cistern.py against the published Chios results (KAKOULAS22, Table 5).

The paper ran a daily tank balance with station rain for central Chios, 2013-2019
(two stations; mean 581.7 mm/yr), runoff c = 0.9 times 0.95 for the first flush,
demand = people x 200 L/day x 33% (toilets and garden), start volume 1 m3, and the
yield-before-spillage rule. We repeat the 54 household cases with ERA5 rain for the
Chios grid cell (reanalysed, not station rain) under both rules. The school cases are
skipped: their term calendar is not published in enough detail.

Input:  data/rwh_reference_kakoulas22.csv, data/raw/rain_daily/rain_daily_chios.csv
Output: data/derived/cistern_reference_check.csv
Usage:  python tools/check_cistern_reference.py
"""
import csv
from pathlib import Path

from simulate_cistern import simulate

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "rwh_reference_kakoulas22.csv"
RAIN = ROOT / "data" / "raw" / "rain_daily" / "rain_daily_chios.csv"
OUT = ROOT / "data" / "derived" / "cistern_reference_check.csv"
RUNOFF = 0.9 * 0.95
START, END = "2013-01-01", "2019-12-31"


def wse(rows):
    return 100 * sum(r["supplied_m3"] for r in rows) / sum(r["demand_m3"] for r in rows)


def main():
    if not RAIN.exists():
        raise SystemExit("Run tools/fetch_rain.py --island Chios first.")
    rain = [(r["date"], float(r["precip_mm"] or 0)) for r in csv.DictReader(RAIN.open(encoding="utf-8"))
            if START <= r["date"] <= END]
    years = len({d[:4] for d, _ in rain})
    annual = sum(mm for _, mm in rain) / years
    out = []
    for ref in csv.DictReader(REF.open(encoding="utf-8")):
        if not ref["case"].startswith("house"):
            continue
        n, roof, tank = int(ref["n_people"]), float(ref["roof_m2"]), float(ref["tank_m3"])
        use_l = n * float(ref["litres_per_person_day"]) * float(ref["share_nonpotable"])
        row = {"n_people": n, "roof_m2": ref["roof_m2"], "tank_m3": ref["tank_m3"], "use_l_day": round(use_l, 1),
               "paper_wse_pct": ref["wse_pct"]}
        for rule in ("ybs", "yas"):
            sim = simulate(rain, roof, tank, use_l, runoff=RUNOFF, rule=rule, start_m3=1.0)
            row[f"era5_{rule}_wse_pct"] = round(wse(sim), 2)
        row["diff_ybs_pts"] = round(row["era5_ybs_wse_pct"] - float(ref["wse_pct"]), 2)
        out.append(row)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    d = [abs(r["diff_ybs_pts"]) for r in out]
    print(f"ERA5 rain, Chios cell, {START[:4]}-{END[:4]}: {annual:.0f} mm/yr (paper's stations: 581.7)")
    print(f"{len(out)} cases. Same rule (ybs): mean |difference| {sum(d) / len(d):.1f} points, max {max(d):.1f}")
    gap = [r["era5_ybs_wse_pct"] - r["era5_yas_wse_pct"] for r in out]
    print(f"ybs minus yas on the same rain: {min(gap):.1f} to {max(gap):.1f} points")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
