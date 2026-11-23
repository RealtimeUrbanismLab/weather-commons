#!/usr/bin/env python3
"""Clip and simplify Natural Earth land to the Aegean for the Situate map (stdlib only).

Input:  data/raw/natural_earth/ne_10m_land.zip, ne_10m_minor_islands.zip  (tools/fetch_coastlines.py)
        data/raw/osm_islands/outlines.json  OSM outlines of the 30 islands Natural Earth leaves out
                                            (tools/fetch_osm_outlines.py; ODbL)
Output: data/page/aegean_land.json  {"bbox": [lon0, lat0, lon1, lat1], "rings": [[lon, lat, lon, lat, ...], ...]}

Each polygon ring is clipped to the map frame (Sutherland-Hodgman against a rectangle),
simplified (Douglas-Peucker, tolerance TOL degrees) and rounded to 3 decimals (~100 m).
Holes are dropped: the page fills every ring with the nonzero rule, so overlapping
outlines from the two sources do not cut each other.
Kind: cartographic. Natural Earth is public domain; OSM outlines © OpenStreetMap contributors, ODbL.

Usage: python -I tools/build_coastline.py
"""
import json
import struct
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "natural_earth"
OUT = ROOT / "data" / "page" / "aegean_land.json"
BBOX = (22.7, 34.6, 29.9, 41.05)   # a little wider than the map frame in situate.js
TOL = 0.006


def polygons(zpath):
    """Yield each ring of every polygon record in the zipped shapefile, as [(lon, lat), ...]."""
    with zipfile.ZipFile(zpath) as z:
        shp = z.read(next(n for n in z.namelist() if n.endswith(".shp")))
    pos = 100
    while pos < len(shp):
        _, length = struct.unpack(">ii", shp[pos:pos + 8])
        rec = shp[pos + 8:pos + 8 + 2 * length]
        pos += 8 + 2 * length
        (stype,) = struct.unpack("<i", rec[:4])
        if stype not in (5, 15, 25):
            continue
        xmin, ymin, xmax, ymax = struct.unpack("<4d", rec[4:36])
        if xmax < BBOX[0] or xmin > BBOX[2] or ymax < BBOX[1] or ymin > BBOX[3]:
            continue
        nparts, npts = struct.unpack("<ii", rec[36:44])
        parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npts]
        p0 = 44 + 4 * nparts
        pts = [struct.unpack("<2d", rec[p0 + 16 * i:p0 + 16 * i + 16]) for i in range(npts)]
        for a, b in zip(parts, parts[1:]):
            yield pts[a:b]


def clip(ring):
    """Sutherland-Hodgman: clip a closed ring to BBOX."""
    x0, y0, x1, y1 = BBOX
    edges = [(lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
             (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1))]
    out = ring
    for inside, cross in edges:
        if not out:
            break
        src, out = out, []
        prev = src[-1]
        for cur in src:
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
            prev = cur
    return out


def simplify(pts, tol):
    """Douglas-Peucker, iterative."""
    if len(pts) < 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        n = (dx * dx + dy * dy) ** 0.5
        best, idx = 0.0, None
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / n if n else ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            if d > best:
                best, idx = d, i
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def osm_rings(path):
    """Closed outer rings from Overpass 'out geom' ways and relations (member ways joined end to end)."""
    if not path.exists():
        return []
    rings = []
    for e in json.loads(path.read_text(encoding="utf-8"))["elements"]:
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
                    break   # cannot close: keep what joined
            rings.append(ring[:-1] if ring[0] == ring[-1] else ring)
    return rings


def area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2


def main():
    rings, src_rings = [], 0
    sources = [polygons(RAW / f) for f in ("ne_10m_land.zip", "ne_10m_minor_islands.zip")]
    sources.append(osm_rings(ROOT / "data" / "raw" / "osm_islands" / "outlines.json"))
    for src in sources:
        for ring in src:
            src_rings += 1
            if len(ring) > 3 and sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1]
                                     for i in range(len(ring))) < 0 and src is not sources[-1]:
                continue   # shapefile holes run counter-clockwise (negative here): drop them
            c = clip(ring)
            if len(c) < 3:
                continue
            s = simplify(c + [c[0]], TOL if area(c) > TOL * TOL * 4 else TOL / 4)[:-1]
            if len(s) < 3:
                s = c   # an islet smaller than the tolerance: keep its outline as it is
            flat = []
            for x, y in s:
                flat += [round(x, 3), round(y, 3)]
            rings.append(flat)
    OUT.write_text(json.dumps({
        "bbox": BBOX, "kind": "cartographic",
        "source": "Natural Earth 1:10m land and minor islands, v5.1.1 (public domain); OpenStreetMap "
                  "outlines for 30 small islands it leaves out (ODbL); clipped and simplified",
        "rings": rings}, separators=(",", ":")), encoding="utf-8")
    pts = sum(len(r) // 2 for r in rings)
    print(f"{src_rings} rings in the frame -> {len(rings)} rings, {pts} points, {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
