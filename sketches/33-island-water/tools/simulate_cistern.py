#!/usr/bin/env python3
"""Simulate a rooftop rainwater cistern with real daily rain (stdlib only).

storage(t) = min(tank, storage(t-1) + roof * runoff * rain(t) / 1000) - use(t)
(yield after spillage; --rule ybs gives yield before spillage, the rule in KAKOULAS22.)
Water-saving efficiency (WSE) = water supplied / water demanded, over the whole run.
Check against the paper: python tools/check_cistern_reference.py
Rain: data/raw/rain_daily/rain_daily_<island-slug>.csv (git-ignored) (run fetch_rain.py first).
Use: litres per day, constant or with a summer multiplier (Jun-Sep).

Every parameter is an assumption (evidence kind: synthetic); the rain is reanalysed;
the result is calculated. Say so on the page.

Usage: python tools/simulate_cistern.py --island Sifnos --roof 80 --tank 30 --use 150
       [--runoff 0.8] [--summer-factor 1.0] [--start-full]
"""
import argparse
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def slug(name):
    """File-safe island name: "Santorini (Thira)" -> "santorini-thira"."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def simulate(rain, roof, tank, use_l, runoff=0.8, summer_factor=1.0, start_full=False,
             rule="yas", first_flush_mm=0.0, start_m3=None):
    """rule "yas" (yield after spillage, default, conservative): the tank overflows first,
    then the day's use is drawn. rule "ybs" (yield before spillage, as in KAKOULAS22): the
    day's use is drawn from stock plus inflow, then the tank overflows.
    first_flush_mm: rain depth diverted at the start of each rainy day (KAKOULAS22: 0.33 mm)."""
    s = start_m3 if start_m3 is not None else (tank if start_full else 0.0)
    out = []
    for date, mm in rain:
        inflow = roof * runoff * max((mm or 0.0) - first_flush_mm, 0.0) / 1000.0
        demand = use_l / 1000.0 * (summer_factor if date[5:7] in ("06", "07", "08", "09") else 1.0)
        if rule == "ybs":
            supplied = min(demand, s + inflow)
            s = min(tank, s + inflow - supplied)
        else:
            s = min(tank, s + inflow)
            supplied = min(s, demand)
            s -= supplied
        out.append({"date": date, "rain_mm": mm, "inflow_m3": round(inflow, 3),
                    "demand_m3": round(demand, 3), "supplied_m3": round(supplied, 3),
                    "storage_m3": round(s, 3), "dry": int(supplied < demand)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--island", default="Sifnos")
    ap.add_argument("--roof", type=float, default=80, help="roof area, m2 (synthetic)")
    ap.add_argument("--tank", type=float, default=30, help="cistern volume, m3 (synthetic)")
    ap.add_argument("--use", type=float, default=150, help="litres per day (synthetic)")
    ap.add_argument("--runoff", type=float, default=0.8)
    ap.add_argument("--summer-factor", type=float, default=1.0)
    ap.add_argument("--start-full", action="store_true")
    ap.add_argument("--rule", choices=("yas", "ybs"), default="yas",
                    help="yas: overflow before use (conservative); ybs: use before overflow")
    ap.add_argument("--first-flush", type=float, default=0.0, help="mm diverted per rainy day")
    ap.add_argument("--no-write", action="store_true", help="print the summary only")
    a = ap.parse_args()
    src = ROOT / "data" / "raw" / "rain_daily" / f"rain_daily_{slug(a.island)}.csv"
    if not src.exists():
        raise SystemExit(f"Run tools/fetch_rain.py --island {a.island} first.")
    rain = [(r["date"], float(r["precip_mm"] or 0)) for r in csv.DictReader(src.open(encoding="utf-8"))]
    rows = simulate(rain, a.roof, a.tank, a.use, a.runoff, a.summer_factor, a.start_full,
                    a.rule, a.first_flush)
    tag = f"{a.island}_roof{a.roof:g}_tank{a.tank:g}_use{a.use:g}" + ("_ybs" if a.rule == "ybs" else "")
    if not a.no_write:
        out = ROOT / "data" / "derived" / f"cistern_{tag}.csv"
        with out.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        print(f"Wrote {len(rows)} days to {out.relative_to(ROOT)}")
    dry = sum(r["dry"] for r in rows)
    caught = sum(r["inflow_m3"] for r in rows)
    wse = 100 * sum(r["supplied_m3"] for r in rows) / max(sum(r["demand_m3"] for r in rows), 1e-9)
    print(f"Rain caught: {caught:.1f} m3; days short of water: {dry} of {len(rows)}; WSE {wse:.1f}%")
    print("Parameters are synthetic; rain is reanalysed (ERA5); results are calculated.")


if __name__ == "__main__":
    main()
