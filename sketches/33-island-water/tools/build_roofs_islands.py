#!/usr/bin/env python3
"""Every roof on every island as a cistern: footprints per island and the rain that lands on them (stdlib only).

Input:  data/raw/ms_buildings/*.csv.gz          Microsoft Global ML Building Footprints (ODbL; fetch_ms_buildings.py)
        data/raw/natural_earth/*.zip            Natural Earth 1:10m land and minor islands (fetch_coastlines.py)
        data/raw/osm_islands/outlines.json      OSM outlines of the small islands Natural Earth leaves out
        data/derived/islands_geo_osm.csv        island bounding boxes (OSM)
        data/derived/rain_monthly.csv           ERA5 monthly rain for each island's cell
        data/page/situate_islands.json          residents (ELSTAT 2021), desalination capacity
Output: data/page/roofs_islands.json            totals for each island
        data/page/roofs/<slug>.json             footprints for each island, in compact form:
                                                {"o": [lon0, lat0], "u": 1e-5, "f": [[x0, y0, dx1, dy1, ...], ...]}
                                                integers in units of u degrees from o (~1 m); after the first
                                                vertex each pair is the step from the previous vertex.

Which island a building is on: land is rasterised on a grid of about 220 m from Natural Earth
rings (and the OSM outlines), each ring given to the island whose OSM bounding box holds its
centre and whose size it matches. A building counts for an island when its centre falls in that
island's cells, or, for buildings on the shore that the 1:10m coastline misses, when the nearest
land cell within SEARCH cells is that island's. Buildings nearer the mainland or another island
are left out.

Rain on the roofs in a year = roof area x RUNOFF x rain from October to September. An upper bound
on what cisterns could collect: it ignores tank size, overflow and use (the Cisterns tab models those).
Kind: footprints derived from imagery by machine learning (cartographic); totals calculated.

Usage: python -I tools/build_roofs_islands.py
"""
import csv
import glob
import gzip
import json
import math
import re
import statistics
import struct
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "data" / "page"
RAW = ROOT / "data" / "raw"
RUNOFF = 0.8
USE_L = 150            # litres per resident a day, the Cisterns tab's default (synthetic)
DLAT, DLON = 0.002, 0.0025
SEARCH = 3             # cells (~660 m) to look for land around a building whose centre falls in the sea
U = 1e-5
BBOX = (22.7, 34.6, 29.9, 41.05)


def ne_rings(zpath):
    """Outer rings of the zipped shapefile's polygons inside BBOX, as [(lon, lat), ...] (holes dropped)."""
    with zipfile.ZipFile(zpath) as z:
        shp = z.read(next(n for n in z.namelist() if n.endswith(".shp")))
    pos = 100
    while pos < len(shp):
        _, length = struct.unpack(">ii", shp[pos:pos + 8])
        rec = shp[pos + 8:pos + 8 + 2 * length]
        pos += 8 + 2 * length
        if struct.unpack("<i", rec[:4])[0] not in (5, 15, 25):
            continue
        xmin, ymin, xmax, ymax = struct.unpack("<4d", rec[4:36])
        if xmax < BBOX[0] or xmin > BBOX[2] or ymax < BBOX[1] or ymin > BBOX[3]:
            continue
        nparts, npts = struct.unpack("<ii", rec[36:44])
        parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npts]
        p0 = 44 + 4 * nparts
        pts = [struct.unpack("<2d", rec[p0 + 16 * i:p0 + 16 * i + 16]) for i in range(npts)]
        for a, b in zip(parts, parts[1:]):
            r = pts[a:b]
            if sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r))) > 0:
                yield r   # shapefile outer rings run clockwise (positive in this sum)


def osm_rings():
    """[(island, ring)] from the Overpass 'out geom' outlines; member ways joined end to end."""
    d = json.loads((RAW / "osm_islands" / "outlines.json").read_text(encoding="utf-8"))
    name = {i["osm_id"]: i["island"] for i in d["islands"]}
    out = []
    for e in d["elements"]:
        isl = name.get(f"{e['type']}/{e['id']}")
        if e["type"] == "way":
            parts = [[(g["lon"], g["lat"]) for g in e["geometry"]]]
        else:
            parts = [[(g["lon"], g["lat"]) for g in m["geometry"]] for m in e.get("members", [])
                     if m["type"] == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
        while parts:
            ring = parts.pop(0)
            while ring[0] != ring[-1]:
                for i, q in enumerate(parts):
                    if q[0] == ring[-1]:
                        ring += q[1:]
                    elif q[-1] == ring[-1]:
                        ring += q[::-1][1:]
                    else:
                        continue
                    parts.pop(i)
                    break
                else:
                    break
            out.append((isl, ring))
    return out


def rasterise(ring, label, size, cells):
    """Scanline fill: each cell whose centre is inside the ring gets the label; a smaller ring wins."""
    ys = [p[1] for p in ring]
    r0, r1 = math.floor(min(ys) / DLAT), math.floor(max(ys) / DLAT)
    n = len(ring)
    rows = {}
    for i in range(n):   # bucket the edges by the rows they cross
        (x1, y1), (x2, y2) = ring[i - 1], ring[i]
        if y1 == y2:
            continue
        lo, hi = (y1, y2) if y1 < y2 else (y2, y1)
        for r in range(math.ceil(lo / DLAT - 0.5), math.ceil(hi / DLAT - 0.5)):
            yc = (r + 0.5) * DLAT
            rows.setdefault(r, []).append(x1 + (yc - y1) * (x2 - x1) / (y2 - y1))
    for r, xs in rows.items():
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            for c in range(math.ceil(a / DLON - 0.5), math.ceil(b / DLON - 0.5)):
                k = (r, c)
                if k not in cells or cells[k][0] > size:
                    cells[k] = (size, label)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().split(" (")[0]).strip("-")


def main():
    with (ROOT / "data" / "derived" / "islands_geo_osm.csv").open(encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["scope"] == "base"]
    boxes = {r["island"]: tuple(map(float, r["bbox"].split(","))) for r in rows}   # s, w, n, e
    sit = {i["name"]: i for i in json.loads((PAGE / "situate_islands.json").read_text(encoding="utf-8"))["islands"]}

    # ---- land cells, labelled by island
    cells = {}
    def match(ring):
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        cx, cy, w, h = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(xs) - min(xs), max(ys) - min(ys)
        best = None
        for isl, (s, wl, n, e) in boxes.items():
            bw, bh = e - wl, n - s
            if wl <= cx <= e and s <= cy <= n and w <= 2 * bw + 0.01 and h <= 2 * bh + 0.01 \
                    and (w >= 0.3 * bw or h >= 0.3 * bh):
                d = abs(w - bw) + abs(h - bh)
                if best is None or d < best[0]:
                    best = (d, isl)
        return best[1] if best else None
    def near_any(ring):
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        return any(min(xs) <= e + 0.02 and max(xs) >= w - 0.02 and min(ys) <= n + 0.02 and max(ys) >= s - 0.02
                   for s, w, n, e in boxes.values())
    matched = {}
    for f in ("ne_10m_land.zip", "ne_10m_minor_islands.zip"):
        for ring in ne_rings(RAW / "natural_earth" / f):
            if len(ring) > 20000 or not near_any(ring):
                continue   # the mainland ring, or far from every island: a building there finds no island cell
            isl = match(ring)
            matched[isl] = matched.get(isl, 0) + 1
            xs, ys = [p[0] for p in ring], [p[1] for p in ring]
            rasterise(ring, isl, (max(xs) - min(xs)) * (max(ys) - min(ys)), cells)
    for isl, ring in osm_rings():
        if isl in boxes:
            xs, ys = [p[0] for p in ring], [p[1] for p in ring]
            rasterise(ring, isl, (max(xs) - min(xs)) * (max(ys) - min(ys)) * 0.5, cells)   # OSM wins ties
            matched[isl] = matched.get(isl, 0) + 1
    no_land = [i for i in boxes if i not in matched]
    print(f"{len(cells):,} land cells; islands with no land ring: {no_land or 'none'}")

    def island_at(lon, lat):
        r, c = math.floor(lat / DLAT), math.floor(lon / DLON)
        if (r, c) in cells:
            return cells[(r, c)][1], 0
        best = None
        for dr in range(-SEARCH, SEARCH + 1):
            for dc in range(-SEARCH, SEARCH + 1):
                k = (r + dr, c + dc)
                if k in cells:
                    d = (dr * DLAT * 110.5) ** 2 + (dc * DLON * 88.9) ** 2
                    if best is None or d < best[0]:
                        best = (d, cells[k][1])
        return (best[1], 1) if best else (None, 0)

    # ---- buildings
    K = math.cos(math.radians(37))
    s0 = min(b[0] for b in boxes.values()) - 0.02; n0 = max(b[2] for b in boxes.values()) + 0.02
    w0 = min(b[1] for b in boxes.values()) - 0.02; e0 = max(b[3] for b in boxes.values()) + 0.02
    acc = {i: {"areas": [], "f": [], "shore": 0} for i in boxes}
    seen = 0
    for path in sorted(glob.glob(str(RAW / "ms_buildings" / "*.csv.gz"))):
        for line in gzip.open(path, "rt", encoding="utf-8"):
            g = json.loads(line)
            ring = g["geometry"]["coordinates"][0]
            if ring[0] == ring[-1]:
                ring = ring[:-1]
            lon = sum(p[0] for p in ring) / len(ring)
            lat = sum(p[1] for p in ring) / len(ring)
            seen += 1
            if not (w0 < lon < e0 and s0 < lat < n0):
                continue
            isl, shore = island_at(lon, lat)
            if isl is None:
                continue
            s, w, n, e = boxes[isl]
            if not (w - 0.003 < lon < e + 0.003 and s - 0.003 < lat < n + 0.003):
                continue   # near land of this island but outside its OSM box (by more than ~300 m): another shore
            xy = [(p[0] * 111320 * K, p[1] * 110540) for p in ring]
            a = abs(sum(xy[i][0] * xy[i - 1][1] - xy[i - 1][0] * xy[i][1] for i in range(len(xy)))) / 2
            A = acc[isl]
            A["areas"].append(a)
            A["shore"] += shore
            q = [(round((p[0] - w) / U), round((p[1] - s) / U)) for p in ring]
            enc = [q[0][0], q[0][1]]
            for (x1, y1), (x2, y2) in zip(q, q[1:]):
                enc += [x2 - x1, y2 - y1]
            A["f"].append(enc)
    print(f"{seen:,} buildings read")

    # ---- rain: October-September totals for each island's ERA5 cell
    wy = {}
    with (ROOT / "data" / "derived" / "rain_monthly.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            y, m = map(int, r["month"].split("-"))
            k = (r["island"], y if m >= 10 else y - 1)
            t = wy.setdefault(k, [0.0, 0])
            t[0] += float(r["precip_mm"]) if r["precip_mm"] else 0.0
            t[1] += r["complete"] == "yes"
    full = {k: v[0] for k, v in wy.items() if v[1] == 12}

    (PAGE / "roofs").mkdir(exist_ok=True)
    out = []
    for isl, A in acc.items():
        s, w, n, e = boxes[isl]
        i = sit.get(isl, {})
        years = {y: mm for (name, y), mm in full.items() if name == isl}
        base = [years[y] for y in range(1991, 2020) if y in years]
        normal = sum(base) / len(base) if base else None
        dry_y = min((y for y in years if y >= 1991), key=lambda y: years[y], default=None)
        m2 = sum(A["areas"])
        catch = lambda mm: round(m2 * RUNOFF * mm / 1000) if mm is not None else None
        use = i.get("residents", 0) * USE_L * 365 / 1000
        row = {
            "name": isl, "slug": slug(isl), "group": i.get("group"), "bbox": [w, s, e, n],
            "residents": i.get("residents"), "desal_m3d": i.get("desal_m3d"),
            "buildings": len(A["areas"]), "roof_m2": round(m2),
            "median_roof_m2": round(statistics.median(A["areas"])) if A["areas"] else None,
            "shore_assigned": A["shore"],
            "rain_normal_mm": round(normal, 1) if normal else None,
            "rain_2022_23_mm": round(years[2022], 1) if 2022 in years else None,
            "driest_year": f"{dry_y}–{str(dry_y + 1)[2:]}" if dry_y else None,
            "rain_driest_mm": round(years[dry_y], 1) if dry_y else None,
            "catch_normal_m3": catch(normal), "catch_2022_23_m3": catch(years.get(2022)),
            "catch_driest_m3": catch(years.get(dry_y)),
            "residents_use_m3": round(use) if use else None,
        }
        out.append(row)
        if A["f"]:
            (PAGE / "roofs" / f"{row['slug']}.json").write_text(json.dumps(
                {"island": isl, "o": [w, s], "u": U, "f": A["f"]}, separators=(",", ":")), encoding="utf-8")
    out.sort(key=lambda r: -r["buildings"])
    (PAGE / "roofs_islands.json").write_text(json.dumps({
        "runoff": RUNOFF, "use_l_per_day": USE_L, "normal_period": "October-September years 1991-92 to 2019-20",
        "kinds": {"footprints": "cartographic (machine-learning footprints from imagery, Microsoft, ODbL)",
                  "island": "calculated (land rasterised from Natural Earth 1:10m and OSM outlines, ~220 m cells)",
                  "rain": "reanalysed (ERA5, one cell per island)", "residents": "observed (ELSTAT 2021)",
                  "catch": "calculated (upper bound: no tank, overflow or use)",
                  "residents_use": "synthetic (150 litres a resident a day)"},
        "islands": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kb = sum(p.stat().st_size for p in (PAGE / "roofs").glob("*.json")) / 1024
    print(f"{sum(r['buildings'] for r in out):,} buildings on {sum(1 for r in out if r['buildings'])} islands; "
          f"footprint files {kb:,.0f} KB, largest "
          f"{max(p.stat().st_size for p in (PAGE / 'roofs').glob('*.json')) / 1024:,.0f} KB")
    for r in out[:12] + [r for r in out if r["name"] == "Sifnos"]:
        pct = 100 * r["catch_normal_m3"] / r["residents_use_m3"] if r["residents_use_m3"] and r["catch_normal_m3"] else None
        print(f"  {r['name']:<22} {r['buildings']:>7,} bldg {r['roof_m2'] / 1e4:>7.1f} ha  shore {r['shore_assigned']:>5}"
              f"  {r['rain_normal_mm']} mm  {pct and round(pct)}% of use")


if __name__ == "__main__":
    main()
