#!/usr/bin/env python3
"""Download the EMODnet Human Activities desalination plants for Greece (stdlib only).

One WFS request: layer emodnet:desalination, country = Greece, key fields only, GeoJSON.
Output: data/raw/emodnet_desal/desal_greece.json (git-ignored), logged in the manifest.

Licence: CC BY 4.0, EMODnet Human Activities; originator Cogea Srl, from GWI DesalData.
Points are municipality centroids, not plant sites. Records last updated 2020.

Usage: python tools/fetch_emodnet_desal.py
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "emodnet_desal" / "desal_greece.json"
WFS = "https://ows.emodnet-humanactivities.eu/wfs"
FIELDS = ("id,country,positionsrc,comm_name,nuts3id,lat,lon,locationname,stateregion,region,"
          "subregion,project,capacity_m3d,size,units,unit_size_m3d,technology,feedwater,"
          "plant_type,plant_status,award_date,online_date,location_type,customer_type,"
          "industry_type,customer,holding_company,plant_owner,accuracy,last_update,technical_notes")
PARAMS = {"service": "WFS", "version": "2.0.0", "request": "GetFeature",
          "typeNames": "emodnet:desalination", "outputFormat": "application/json",
          "cql_filter": "country='Greece'", "propertyName": FIELDS}


def main():
    url = f"{WFS}?{urllib.parse.urlencode(PARAMS)}"
    req = urllib.request.Request(url, headers={"User-Agent": "weather-commons sketch 33 (research)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    n = len(json.loads(data)["features"])
    record(url, OUT, licence="CC BY 4.0 (EMODnet Human Activities; originator Cogea Srl, from GWI DesalData)",
           note=f"Desalination plants, Greece: {n} records")
    print(f"{OUT.relative_to(ROOT)}: {n} records, {len(data):,} bytes")


if __name__ == "__main__":
    main()
