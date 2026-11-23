"""Sketch 22 · Fetch daily weather for every summer 2008-2026 at the Presena run, from Open-Meteo.

Writes ../data/weather_summers.json: one list of days per year, 28 June to 14 September
(the 2010 laying and removal dates, PhD thesis UniMi 2013, used for every year as an assumption).
Source: Open-Meteo historical weather API (ERA5 reanalysis), https://open-meteo.com
Licence: CC BY 4.0 (attribution: Open-Meteo.com). Kind: reanalysed, not observed.
'elevation' asks Open-Meteo to adjust temperature to 2,765 m with a lapse rate.
Run:  python3 fetch_open_meteo_summers.py   (no account needed)
"""
import json, urllib.request, urllib.parse
from pathlib import Path

LAT, LON, ELEV = 46.224523, 10.580597, 2765
Y0, Y1 = 2008, 2026
FROM, TO = "06-28", "09-14"
q = urllib.parse.urlencode({
    "latitude": LAT, "longitude": LON, "elevation": ELEV,
    "start_date": f"{Y0}-{FROM}", "end_date": f"{Y1}-{TO}",
    "daily": "temperature_2m_mean,shortwave_radiation_sum",
    "timezone": "Europe/Rome",
})
url = "https://archive-api.open-meteo.com/v1/archive?" + q
raw = json.load(urllib.request.urlopen(url, timeout=120))
d = raw["daily"]
years = {}
for date, t, sw in zip(d["time"], d["temperature_2m_mean"], d["shortwave_radiation_sum"]):
    md = date[5:]
    if not (FROM <= md <= TO):
        continue
    y = years.setdefault(date[:4], {"days": [], "missing": 0})
    if t is None or sw is None:
        y["missing"] += 1
        continue
    y["days"].append({"date": date, "t_mean_c": t, "sw_mean_wm2": round(sw * 1e6 / 86400, 1)})
out = {
    "source": "ERA5 reanalysis via Open-Meteo (CC BY 4.0), temperature adjusted to 2,765 m",
    "kind": "reanalysed",
    "url": url,
    "season": f"{FROM} to {TO} every year (2010 dates, PhD thesis UniMi 2013; an assumption for other years)",
    "units": {"t_mean_c": "degC, daily mean", "sw_mean_wm2": "W/m2, daily mean shortwave"},
    "years": years,
}
p = Path(__file__).resolve().parent.parent / "data" / "weather_summers.json"
p.write_text(json.dumps(out, separators=(",", ":")))
for y, v in sorted(years.items()):
    print(y, len(v["days"]), "days,", v["missing"], "missing")
print("written:", p)
