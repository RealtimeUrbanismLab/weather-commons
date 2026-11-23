#!/usr/bin/env python3
"""Every roof on Sifnos as a cistern: roof area and the rain that lands on them, by settlement (stdlib only).

Input:  data/page/roofs/sifnos.json         the island's footprints (tools/build_roofs_islands.py; Microsoft, ODbL)
        data/page/sifnos_rain_daily.json    ERA5 daily rain for the Sifnos cell
        data/page/sifnos_topo.json          OSM settlements (for "nearest settlement" totals)
        data/page/simulate_context.json     desalination capacity, residents
Output: data/page/roofs_sifnos.json         totals for the island and for each settlement

Rain on a roof per year = roof area x RUNOFF x rain. This is an upper bound on what cisterns
could collect: it ignores tank size, overflow and use (the Cisterns tab models those).
Kind: footprints derived from imagery by machine learning (cartographic); totals calculated.

Usage: python -I tools/build_roofs.py
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "data" / "page"
RUNOFF = 0.8
K = math.cos(math.radians(37))


def main():
    topo = json.loads((PAGE / "sifnos_topo.json").read_text(encoding="utf-8"))
    places = topo["places"]
    src = json.loads((PAGE / "roofs" / "sifnos.json").read_text(encoding="utf-8"))
    (w, s0), u = src["o"], src["u"]
    total, areas = 0.0, []
    by_place = {p["name"]: {"n": 0, "m2": 0.0} for p in places}
    for enc in src["f"]:
        x, y, ring = enc[0], enc[1], []
        ring.append((x, y))
        for k in range(2, len(enc), 2):
            x += enc[k]; y += enc[k + 1]
            ring.append((x, y))
        ring = [(w + a * u, s0 + b * u) for a, b in ring]
        lon = sum(p[0] for p in ring) / len(ring)
        lat = sum(p[1] for p in ring) / len(ring)
        xy = [(p[0] * 111320 * K, p[1] * 110540) for p in ring]
        a = abs(sum(xy[i][0] * xy[i - 1][1] - xy[i - 1][0] * xy[i][1] for i in range(len(xy)))) / 2
        near = min(places, key=lambda p: ((p["lon"] - lon) * K) ** 2 + (p["lat"] - lat) ** 2)
        by_place[near["name"]]["n"] += 1
        by_place[near["name"]]["m2"] += a
        total += a
        areas.append(a)
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
        "island": "Sifnos", "buildings": len(areas), "roof_m2": round(total),
        "median_roof_m2": None,
        "rain_normal_mm": round(normal, 1), "rain_2022_23_mm": round(dry, 1), "runoff": RUNOFF,
        "catch_normal_m3": round(catch(total, normal)), "catch_2022_23_m3": round(catch(total, dry)),
        "desal_capacity_m3d": cap, "residents": res,
        "villages": villages,
        "kinds": {"footprints": "cartographic (machine-learning footprints from imagery, Microsoft, ODbL)",
                  "rain": "reanalysed (ERA5)", "catch": "calculated (upper bound: no tank, overflow or use)",
                  "nearest_settlement": "calculated (each building assigned to the nearest OSM place node)"},
    }
    areas.sort()
    out["median_roof_m2"] = round(areas[len(areas) // 2]) if areas else None
    (PAGE / "roofs_sifnos.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kb = (PAGE / "roofs_sifnos.json").stat().st_size / 1024
    print(f"{len(areas)} buildings, roofs {total / 1e4:.1f} ha (median {out['median_roof_m2']} m2); "
          f"rain on roofs {out['catch_normal_m3']:,} m3 in an average year, {out['catch_2022_23_m3']:,} in 2022-23 "
          f"({normal:.0f} / {dry:.0f} mm); {kb:.0f} KB")
    for v in villages[:6]:
        print("  ", v)


if __name__ == "__main__":
    main()
