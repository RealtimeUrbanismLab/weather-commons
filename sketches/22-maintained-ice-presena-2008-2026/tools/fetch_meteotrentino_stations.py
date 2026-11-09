"""Sketch 22 · List Meteotrentino stations nearest to the Presena glacier.

Run on your own computer (needs internet):  python fetch_meteotrentino_stations.py
Writes stations_near_presena.csv next to this script.
Source: Meteotrentino open data, https://dati.meteotrentino.it/service.asmx/listaStazioni
Licence: check https://dati.trentino.it/dataset/anagrafica-stazioni-meteo-stazioni-automatiche
Known issue: some coordinate field names are inconsistent (UTM fields swapped), so this
script uses only the latitude/longitude fields and prints them for a manual check.
"""
import csv, math, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

URL = "https://dati.meteotrentino.it/service.asmx/listaStazioni"
PRESENA = (46.224523, 10.580597)  # 2012 test site, AINEVA 80

def strip(tag):
    return tag.split('}', 1)[-1]

def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))

raw = urllib.request.urlopen(URL, timeout=60).read()
Path(__file__).with_name("listaStazioni_raw.xml").write_bytes(raw)  # keep the raw download
root = ET.fromstring(raw)
rows = []
for st in root.iter():
    fields = {strip(c.tag): (c.text or "").strip() for c in st}
    lat = next((v for k, v in fields.items() if k.lower().startswith("lat")), None)
    lon = next((v for k, v in fields.items() if k.lower().startswith("lon")), None)
    if not lat or not lon:
        continue
    try:
        p = (float(lat.replace(",", ".")), float(lon.replace(",", ".")))
    except ValueError:
        continue
    fields["distance_km"] = round(km(PRESENA, p), 2)
    rows.append(fields)

rows.sort(key=lambda r: r["distance_km"])
out = Path(__file__).with_name("stations_near_presena.csv")
keys = sorted({k for r in rows for k in r})
with out.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(rows)
for r in rows[:12]:
    print(r["distance_km"], "km |", " | ".join(f"{k}={v}" for k, v in r.items() if k != "distance_km"))
print(f"\n{len(rows)} stations written to {out}")
