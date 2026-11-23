#!/usr/bin/env python3
"""Every roof on Sifnos as a cistern: footprints, roof area and the rain that lands on them (stdlib only).

Input:  data/raw/ms_buildings/*.csv.gz      Microsoft Global ML Building Footprints (ODbL; fetch_ms_buildings.py)
        data/raw/dem/sifnos_glo30.json      land mask (Copernicus DEM GLO-30; fetch_dem_sifnos.py)
        data/page/sifnos_rain_daily.json    ERA5 daily rain for the Sifnos cell
        data/page/sifnos_topo.json          OSM settlements (for "nearest settlement" totals)
        data/page/simulate_context.json     desalination capacity, residents
Output: data/page/roofs_sifnos.json         footprints (rounded to ~1 m) and totals

Rain on a roof per year = roof area x RUNOFF x rain. This is an upper bound on what cisterns
could collect: it ignores tank size, overflow and use (the Cisterns tab models those).
Kind: footprints derived from imagery by machine learning (cartographic); totals calculated.

Usage: python -I tools/build_roofs.py
"""
import glob
import gzip
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "data" / "page"
RUNOFF = 0.8
K = math.cos(math.radians(37))


def main():
    dem = json.loads((ROOT / "data" / "raw" / "dem" / "sifnos_glo30.json").read_text(encoding="utf-8"))
    def land(lon, lat):
        r = round((dem["lat0"] - lat) / dem["dlat"])
        c = round((lon - dem["lon0"]) / dem["dlon"])
        if not (0 <= r < dem["rows"] and 0 <= c < dem["cols"]):
            return False
        # a building on the shore may sit in a sea cell of the 30 m grid: accept any land within one cell
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                rr, cc = r + dr, c + dc
                if 0 <= rr < dem["rows"] and 0 <= cc < dem["cols"] and dem["z"][rr * dem["cols"] + cc] is not None:
                    return True
        return False
    topo = json.loads((PAGE / "sifnos_topo.json").read_text(encoding="utf-8"))
    places = topo["places"]
    feats, total, conf = [], 0.0, []
    by_place = {p["name"]: {"n": 0, "m2": 0.0} for p in places}
    for f in glob.glob(str(ROOT / "data" / "raw" / "ms_buildings" / "*.csv.gz")):
        for line in gzip.open(f, "rt", encoding="utf-8"):
            g = json.loads(line)
            ring = g["geometry"]["coordinates"][0]
            lon = sum(p[0] for p in ring[:-1]) / (len(ring) - 1)
            lat = sum(p[1] for p in ring[:-1]) / (len(ring) - 1)
            if not (24.62 < lon < 24.78 and 36.86 < lat < 37.05) or not land(lon, lat):
                continue
            xy = [(p[0] * 111320 * K, p[1] * 110540) for p in ring]
            a = abs(sum(xy[i][0] * xy[i - 1][1] - xy[i - 1][0] * xy[i][1] for i in range(1, len(xy)))) / 2
            near = min(places, key=lambda p: ((p["lon"] - lon) * K) ** 2 + (p["lat"] - lat) ** 2)
            by_place[near["name"]]["n"] += 1
            by_place[near["name"]]["m2"] += a
            total += a
            conf.append(g["properties"].get("confidence", -1))
            feats.append([round(v, 5) for p in ring[:-1] for v in p])
    rain = json.loads((PAGE / "sifnos_rain_daily.json").read_text(encoding="utf-8"))
    import datetime as dt
    d0 = dt.date.fromisoformat(rain["start"])
    wy = {}
    for i, mm in enumerate(rain["mm"]):
        d = d0 + dt.timedelta(days=i)
        y = d.year if d.month >= 10 else d.year - 1
        wy.setdefault(y, [0.0, 0])
        if mm is not None:
            wy[y][0] += mm
            wy[y][1] += 1
    full = {y: v[0] for y, v in wy.items() if v[1] >= 365}
    normal = sum(full[y] for y in range(1991, 2020)) / len(range(1991, 2020))
    dry = full[2022]
    ctx = json.loads((PAGE / "simulate_context.json").read_text(encoding="utf-8"))
    cap = ctx["desal_capacity_m3d"]["value"]
    res = ctx["residents_2021"]["value"]
    catch = lambda m2, mm: m2 * RUNOFF * mm / 1000
    villages = sorted(({"name": k, "buildings": v["n"], "roof_m2": round(v["m2"]),
                        "catch_normal_m3": round(catch(v["m2"], normal)), "catch_2022_23_m3": round(catch(v["m2"], dry))}
                       for k, v in by_place.items() if v["n"]), key=lambda v: -v["roof_m2"])
    out = {
        "island": "Sifnos", "buildings": len(feats), "roof_m2": round(total),
        "median_roof_m2": None,
        "rain_normal_mm": round(normal, 1), "rain_2022_23_mm": round(dry, 1), "runoff": RUNOFF,
        "catch_normal_m3": round(catch(total, normal)), "catch_2022_23_m3": round(catch(total, dry)),
        "desal_capacity_m3d": cap, "residents": res,
        "villages": villages,
        "kinds": {"footprints": "cartographic (machine-learning footprints from imagery, Microsoft, ODbL)",
                  "rain": "reanalysed (ERA5)", "catch": "calculated (upper bound: no tank, overflow or use)",
                  "nearest_settlement": "calculated (each building assigned to the nearest OSM place node)"},
        "footprints": feats,
    }
    areas = sorted(abs(sum((p[0] * 111320 * K) * (q[1] * 110540) - (q[0] * 111320 * K) * (p[1] * 110540)
                           for p, q in zip(zip(f[0::2], f[1::2]), list(zip(f[0::2], f[1::2]))[1:] + [(f[0], f[1])]))) / 2
                   for f in feats)
    out["median_roof_m2"] = round(areas[len(areas) // 2]) if areas else None
    (PAGE / "roofs_sifnos.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kb = (PAGE / "roofs_sifnos.json").stat().st_size / 1024
    print(f"{len(feats)} buildings, roofs {total / 1e4:.1f} ha (median {out['median_roof_m2']} m2); "
          f"rain on roofs {out['catch_normal_m3']:,} m3 in an average year, {out['catch_2022_23_m3']:,} in 2022-23 "
          f"({normal:.0f} / {dry:.0f} mm); confidence min {min(conf):.2f}; {kb:.0f} KB")
    for v in villages[:6]:
        print("  ", v)


if __name__ == "__main__":
    main()
