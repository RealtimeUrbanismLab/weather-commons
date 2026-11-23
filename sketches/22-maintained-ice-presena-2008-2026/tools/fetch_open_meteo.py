"""Sketch 22 · Fetch one summer of daily weather for the Presena test site from Open-Meteo.

Writes ../data/weather_summer_2021.json, which the page uses instead of synthetic weather.
Source: Open-Meteo historical weather API (ERA5 / ERA5-Land reanalysis), https://open-meteo.com
Licence: CC BY 4.0 (attribution: Open-Meteo.com). Kind: reanalysed, not observed.
The 'elevation' parameter asks Open-Meteo to adjust temperature to 2,765 m with a lapse rate.
Run:  python fetch_open_meteo.py   (no account needed)
"""
import json, urllib.request, urllib.parse
from pathlib import Path

LAT, LON, ELEV = 46.224523, 10.580597, 2765   # 2012 test site, AINEVA 80
START, END = "2021-06-25", "2021-09-05"
q = urllib.parse.urlencode({
    "latitude": LAT, "longitude": LON, "elevation": ELEV,
    "start_date": START, "end_date": END,
    "daily": "temperature_2m_mean,shortwave_radiation_sum",
    "timezone": "Europe/Rome",
})
url = "https://archive-api.open-meteo.com/v1/archive?" + q
raw = json.load(urllib.request.urlopen(url, timeout=60))
d = raw["daily"]
days = []
for date, t, sw in zip(d["time"], d["temperature_2m_mean"], d["shortwave_radiation_sum"]):
    if t is None or sw is None:
        continue                                   # gaps are skipped, and counted below
    days.append({"date": date, "t_mean_c": t, "sw_mean_wm2": round(sw * 1e6 / 86400, 1)})  # MJ/m2/day -> W/m2
out = {
    "source": "ERA5 reanalysis via Open-Meteo (CC BY 4.0), temperature adjusted to 2,765 m",
    "kind": "reanalysed",
    "url": url, "start": START, "end": END,
    "units": {"t_mean_c": "degC, daily mean", "sw_mean_wm2": "W/m2, daily mean shortwave"},
    "missing_days": len(d["time"]) - len(days),
    "days": days,
}
p = Path(__file__).resolve().parent.parent / "data" / "weather_summer_2021.json"
p.write_text(json.dumps(out, indent=1))
print(f"{len(days)} days written to {p} ({out['missing_days']} missing)")
