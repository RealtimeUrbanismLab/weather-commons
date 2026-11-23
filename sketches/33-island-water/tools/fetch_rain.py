#!/usr/bin/env python3
"""Daily and monthly rainfall per island from ERA5 via the Open-Meteo archive (stdlib only).

Writes data/raw/rain_daily/rain_daily_<island-slug>.csv (git-ignored), and updates (per island) rain_monthly.csv,
rain_winters.csv (Oct-Mar totals) and rain_cells.csv (the ERA5 grid cell used). Logs
each request in the manifest.

ERA5 is ~25 km (0.25°): a small island may sit in a cell that is mostly sea, which
usually means too little rain. rain_cells.csv records the cell centre and its distance
from the island point. Treat as "reanalysed"; compare with NOA stations where possible.

Missing days are counted, never taken as 0 mm: months and winters with gaps are flagged.

Usage: python tools/fetch_rain.py [--start 1991-01-01] [--end YYYY-MM-DD] [--island Sifnos]
                                  [--missing-only] [--pause 5]
  Open-Meteo's free tier counts a 35-year daily request as many calls; the first full run
  (2026-11-23) hit HTTP 429 after 53 islands. Resume with --missing-only.
  --end defaults to the last day of the latest full month.
API docs: https://open-meteo.com/en/docs/historical-weather-api
"""
import argparse
import calendar
import csv
import re
import datetime as dt
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "derived"
RAW = ROOT / "data" / "raw" / "rain_daily"  # git-ignored; refetchable
URL = "https://archive-api.open-meteo.com/v1/archive"
MODEL = "era5"
UA = "weather-commons sketch 33 (research)"


def slug(name):
    """File-safe island name: "Santorini (Thira)" -> "santorini-thira"."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def get(params, tries=4):
    url = f"{URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return url, json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
            wait = 30 * (attempt + 1) if e.code == 429 else 10 * (attempt + 1)
            print(f"  HTTP {e.code}; waiting {wait} s and retrying")
            time.sleep(wait)


def islands(only=None):
    rows = list(csv.DictReader((ROOT / "data" / "islands_geo.csv").open(encoding="utf-8")))
    return [r for r in rows if not only or r["island"].lower() == only.lower()]


def last_full_month_end(today=None):
    today = today or dt.date.today()
    first = today.replace(day=1)
    return (first - dt.timedelta(days=1)).isoformat()


def season_of(date):
    y, m = int(date[:4]), int(date[5:7])
    if m >= 10:
        return f"{y}-{str(y + 1)[-2:]}"
    if m <= 3:
        return f"{y - 1}-{str(y)[-2:]}"
    return None


def km(a, b):
    x = math.radians(b[1] - a[1]) * math.cos(math.radians((a[0] + b[0]) / 2))
    return round(6371 * math.hypot(x, math.radians(b[0] - a[0])), 1)


def update(name, rows, islands_done, quiet=False):
    """Replace these islands' rows in a shared CSV, keep the others."""
    path = OUT / name
    keep = []
    if path.exists():
        keep = [r for r in csv.DictReader(path.open(encoding="utf-8")) if r["island"] not in islands_done]
    allrows = keep + rows
    if not allrows:
        return
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(allrows)
    if not quiet:
        print(f"Updated data/derived/{name}: {len(rows)} rows")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="1991-01-01")
    ap.add_argument("--end", default=last_full_month_end())
    ap.add_argument("--island")
    ap.add_argument("--missing-only", action="store_true",
                    help="skip islands already in rain_cells.csv (resume after a stop)")
    ap.add_argument("--pause", type=float, default=5, help="seconds between requests")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    targets = islands(a.island)
    if not targets:
        raise SystemExit(f"{a.island} not in data/islands_geo.csv")
    if a.missing_only and (OUT / "rain_cells.csv").exists():
        have = {r["island"] for r in csv.DictReader((OUT / "rain_cells.csv").open(encoding="utf-8"))}
        targets = [t for t in targets if t["island"] not in have]
        print(f"{len(targets)} island(s) still to fetch")
    for i, isl in enumerate(targets):
        monthly, winters, cells, done = [], [], [], set()
        if i:
            time.sleep(a.pause)  # be polite: long requests count as many calls on Open-Meteo
        url, data = get({"latitude": isl["lat"], "longitude": isl["lon"],
                         "start_date": a.start, "end_date": a.end, "models": MODEL,
                         "daily": "precipitation_sum", "timezone": "Europe/Athens"})
        days = list(zip(data["daily"]["time"], data["daily"]["precipitation_sum"]))
        name = isl["island"]
        RAW.mkdir(parents=True, exist_ok=True)
        daily_path = RAW / f"rain_daily_{slug(name)}.csv"
        with daily_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["date", "precip_mm"])
            w.writerows([t, "" if p is None else p] for t, p in days)
        record(url, daily_path, licence="ERA5 (Copernicus C3S) via Open-Meteo, CC BY 4.0",
               note=f"rain {name}, {a.start} to {a.end}, model {MODEL}")

        cell = (data["latitude"], data["longitude"])
        cells.append({"island": name, "point_lat": isl["lat"], "point_lon": isl["lon"],
                      "cell_lat": cell[0], "cell_lon": cell[1], "point_elevation_m": data.get("elevation", ""),
                      "km_point_to_cell": km((float(isl["lat"]), float(isl["lon"])), cell),
                      "model": MODEL, "start": a.start, "end": a.end, "source_ids": "ERA5"})

        mm, n, miss = defaultdict(float), defaultdict(int), defaultdict(int)
        wmm, wn, wmiss, wmonths = defaultdict(float), defaultdict(int), defaultdict(int), defaultdict(set)
        for t, p in days:
            m, s = t[:7], season_of(t)
            n[m] += 1
            if p is None:
                miss[m] += 1
            else:
                mm[m] += p
            if s:
                wmonths[s].add(m)
                wn[s] += 1
                if p is None:
                    wmiss[s] += 1
                else:
                    wmm[s] += p
        for m in sorted(n):
            y, mo = int(m[:4]), int(m[5:])
            full = n[m] == calendar.monthrange(y, mo)[1] and not miss[m]
            monthly.append({"island": name, "month": m, "precip_mm": round(mm[m], 1),
                            "days": n[m], "missing_days": miss[m], "complete": "yes" if full else "no",
                            "kind": "reanalysed", "source_ids": "ERA5"})
        for s in sorted(wn):
            full = len(wmonths[s]) == 6 and not wmiss[s]
            winters.append({"island": name, "winter": s, "oct_mar_mm": round(wmm[s], 1),
                            "missing_days": wmiss[s], "complete": "yes" if full else "no",
                            "kind": "reanalysed", "source_ids": "ERA5"})
        done.add(name)
        print(f"{name}: {len(days)} days, {sum(miss.values())} missing; "
              f"cell {cell[0]}, {cell[1]} ({cells[-1]['km_point_to_cell']} km away, "
              f"point elevation {data.get('elevation')} m)")
        # save after every island, so a failure part-way keeps what was fetched
        update("rain_monthly.csv", monthly, done, quiet=True)
        update("rain_winters.csv", winters, done, quiet=True)
        update("rain_cells.csv", cells, done, quiet=True)
    print(f"Updated rain_monthly.csv, rain_winters.csv, rain_cells.csv for {len(targets)} island(s).")


if __name__ == "__main__":
    main()
