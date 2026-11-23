"""Sketch 22 · Turn the Earth Engine v3 exports into the page's data files.

Usage (from the sketch folder or anywhere):
    python tools/ingest_gee.py ~/Downloads
The folder must contain the files exported from Earth Engine to Google Drive:
    presena_s2_yearly.csv, presena_s2_observations.csv, presena_s2_outlines.geojson
and optionally your own visual check, qa.csv, with columns:
    year,verdict,note        verdict = ok | cloud | snow | shadow | other
Writes into data/:
    area_s2.json         one record per year: lower / best / upper, error outside the ski run, QA, status
    observations_s2.json one record per usable summer scene (for the calendar)
    outlines_s2.geojson  core and outer outlines per year, coordinates rounded to ~1 m
Nothing is invented: missing values stay missing, and every record keeps its scene ID.
"""
import csv, json, sys, datetime
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser()
data = Path(__file__).resolve().parent.parent / "data"

def num(v):
    try:
        return None if v in ("", None) else float(v)
    except ValueError:
        return None

def read_csv(name):
    p = src / name
    if not p.exists():
        print("missing:", p); return []
    with p.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

qa = {}
for r in read_csv("qa.csv"):
    qa[int(float(r["year"]))] = (r.get("verdict", "").strip(), r.get("note", "").strip())

years = []
for r in read_csv("presena_s2_yearly.csv"):
    y = int(float(r["year"]))
    rec = {k: num(r.get(k)) for k in ("lower_m2", "best_m2", "upper_m2", "rf_m2", "outside_best_m2", "cloud_frac")}
    rec.update({"year": y, "date": r.get("date"), "scene": r.get("scene")})
    v, note = qa.get(y, ("", ""))
    rec["qa"] = v or "not checked"
    rec["qa_note"] = note
    err = rec["outside_best_m2"] or 0
    best = rec["best_m2"] or 0
    if v == "ok" and (best == 0 or err <= 0.2 * best):
        rec["status"] = "calculated, visually checked"
    else:
        rec["status"] = "calculated, not validated"
        flags = []
        if v and v != "ok": flags.append("visual check: " + v)
        if best and err > 0.2 * best: flags.append("much fleece found outside the ski run")
        if flags: rec["flag"] = "; ".join(flags)
    years.append(rec)
years.sort(key=lambda r: r["year"])

area = {
    "about": "Fleece area inside the ski-run polygon, one late-summer Sentinel-2 scene per year. LOWER counts near-pure pixels (fleece fraction >= 0.75), UPPER every pixel with some fleece (>= 0.15), BEST sums the fractions. 'outside_best_m2' is fleece found outside the ski run: an error measure. Kind: calculated.",
    "method": "Linear spectral unmixing and random forest on Sentinel-2 L1C TOA (COPERNICUS/S2_HARMONIZED), endmembers from 2021-08-14; Earth Engine script tools/gee_presena_v3.js",
    "ingested": datetime.date.today().isoformat(),
    "licence": "Derived from Copernicus Sentinel data; CC BY 4.0 for the derived values",
    "years": years,
}
(data / "area_s2.json").write_text(json.dumps(area, indent=1))
print(len(years), "years ->", data / "area_s2.json")

obs = []
for r in read_csv("presena_s2_observations.csv"):
    obs.append({"date": r.get("date"), "year": int(float(r["year"])), "doy": int(float(r["doy"])),
                "cloud_frac": num(r.get("cloud_frac")), "fleece_best_m2": num(r.get("fleece_best_m2")),
                "snow_frac": num(r.get("snow_frac")), "scene": r.get("scene")})
obs.sort(key=lambda r: r["date"] or "")
(data / "observations_s2.json").write_text(json.dumps({"about": "Usable summer Sentinel-2 scenes (cloud share over the ski run < 30%), 1 Jun - 17 Oct, 2016-2026. Kind: calculated per scene.", "observations": obs}, indent=1))
print(len(obs), "observations ->", data / "observations_s2.json")

gp = src / "presena_s2_outlines.geojson"
if gp.exists():
    g = json.loads(gp.read_text())
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 5), round(c[1], 5)]
    feats = []
    for f in g.get("features", []):
        geom = f.get("geometry")
        if not geom: continue
        geom["coordinates"] = rnd(geom["coordinates"])
        p = f.get("properties", {})
        feats.append({"type": "Feature", "geometry": geom,
                      "properties": {"year": int(float(p.get("year"))), "level": p.get("level"), "date": p.get("date")}})
    out = {"type": "FeatureCollection", "about": "Fleece outlines per year inside the ski run: 'core' fraction >= 0.75, 'outer' >= 0.15. Kind: calculated.", "features": feats}
    (data / "outlines_s2.geojson").write_text(json.dumps(out))
    print(len(feats), "outline polygons ->", data / "outlines_s2.geojson")
else:
    print("missing:", gp)
