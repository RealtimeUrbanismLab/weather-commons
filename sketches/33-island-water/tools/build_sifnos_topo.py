#!/usr/bin/env python3
"""Contours and a hillshade of Sifnos from Copernicus DEM GLO-30 (stdlib only).

Input:  data/raw/dem/sifnos_glo30.json  (tools/fetch_dem_sifnos.py)
Output: data/page/sifnos_topo.json      contour lines every STEP m (the coast at 1 m), each
                                        simplified, as [lon, lat, lon, lat, ...] per line
        data/page/sifnos_hillshade.png  greyscale hillshade (light from the north-west),
                                        transparent at sea, same extent as the grid
Kind: cartographic (derived from a digital surface model). The DEM is a surface model:
buildings and trees are included, and 30 m cells smooth small terraces and channels.

Usage: python -I tools/build_sifnos_topo.py
"""
import json
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "raw" / "dem" / "sifnos_glo30.json"
OUT = ROOT / "data" / "page"
STEP = 50
TOL = 0.00012   # ~12 m


def contour(z, rows, cols, level):
    """Marching squares; returns polylines in grid coordinates (col, row)."""
    def v(r, c):
        x = z[r * cols + c]
        return x if x is not None else 0.0
    segs = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            a, b, cc, d = v(r, c), v(r, c + 1), v(r + 1, c + 1), v(r + 1, c)
            idx = (a > level) * 8 + (b > level) * 4 + (cc > level) * 2 + (d > level)
            if idx in (0, 15):
                continue
            def lerp(p, q, x0, y0, x1, y1):
                t = (level - p) / (q - p) if q != p else 0.5
                return (x0 + t * (x1 - x0), y0 + t * (y1 - y0))
            top = lerp(a, b, c, r, c + 1, r)
            right = lerp(b, cc, c + 1, r, c + 1, r + 1)
            bottom = lerp(d, cc, c, r + 1, c + 1, r + 1)
            left = lerp(a, d, c, r, c, r + 1)
            table = {1: [(left, bottom)], 2: [(bottom, right)], 3: [(left, right)], 4: [(top, right)],
                     5: [(left, top), (bottom, right)], 6: [(top, bottom)], 7: [(left, top)], 8: [(left, top)],
                     9: [(top, bottom)], 10: [(left, bottom), (top, right)], 11: [(top, right)], 12: [(left, right)],
                     13: [(bottom, right)], 14: [(left, bottom)]}
            segs += table[idx]
    # join segments end to end
    key = lambda p: (round(p[0], 4), round(p[1], 4))
    ends = {}
    for i, (p, q) in enumerate(segs):
        ends.setdefault(key(p), []).append(i)
        ends.setdefault(key(q), []).append(i)
    used = [False] * len(segs)
    lines = []
    for i in range(len(segs)):
        if used[i]:
            continue
        used[i] = True
        line = list(segs[i])
        for forward in (True, False):
            while True:
                tip = line[-1] if forward else line[0]
                nxt = next((j for j in ends.get(key(tip), []) if not used[j]), None)
                if nxt is None:
                    break
                used[nxt] = True
                p, q = segs[nxt]
                new = q if key(p) == key(tip) else p
                line = line + [new] if forward else [new] + line
        lines.append(line)
    return lines


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy)
        best, idx = 0.0, None
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / n if n else math.hypot(px - ax, py - ay)
            if d > best:
                best, idx = d, i
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


STREAM_CELLS = 180
MONASTERY = (24.73667, 36.98404)   # Panagia Poulati, OSM way 401645635


def drainage(z, rows, cols, to_ll):
    """D8 flow directions and accumulation; stream polylines; the line reaching the sea nearest the monastery."""
    n = rows * cols
    el = [v if v is not None else 0.0 for v in z]
    down = [-1] * n
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            if z[i] is None:
                continue
            best, bi = 0.0, -1
            for dr, dc in nb:
                rr, cc = r + dr, c + dc
                if 0 <= rr < rows and 0 <= cc < cols:
                    j = rr * cols + cc
                    drop = (el[i] - el[j]) / (1.4142 if dr and dc else 1.0)
                    if drop > best:
                        best, bi = drop, j
            down[i] = bi
    acc = [1 if z[i] is not None else 0 for i in range(n)]
    for i in sorted((i for i in range(n) if z[i] is not None), key=lambda i: -el[i]):
        if down[i] >= 0:
            acc[down[i]] += acc[i]
    # trace each stream from its head (a stream cell with no stream cell flowing in) to the sea
    is_s = [acc[i] >= STREAM_CELLS for i in range(n)]
    fed = [0] * n
    for i in range(n):
        if is_s[i] and down[i] >= 0 and is_s[down[i]]:
            fed[down[i]] += 1
    seen, lines = set(), []
    for i in range(n):
        if not is_s[i] or fed[i]:
            continue
        line, j = [], i
        while j >= 0 and z[j] is not None:
            line.append(j)
            if j in seen:
                break
            seen.add(j)
            j = down[j]
        if len(line) > 2:
            lines.append(line)
    def ll(i):
        return to_ll((i % cols, i // cols))
    streams = [{"a": max(acc[k] for k in l), "c": [v for k in l for v in ll(k)]} for l in lines]
    # Poulati: the stream whose sea outlet is nearest the monastery; walk it from its head
    def d2(i, p):
        x, y = ll(i)
        return ((x - p[0]) * 0.8) ** 2 + (y - p[1]) ** 2
    outlets = [l for l in lines if down[l[-1]] < 0 or z[down[l[-1]]] is None]
    best = min(outlets, key=lambda l: d2(l[-1], MONASTERY)) if outlets else []
    # longest upstream path into that outlet
    up = {}
    for i in range(n):
        if down[i] >= 0:
            up.setdefault(down[i], []).append(i)
    path, j = [], best[-1] if best else -1
    while j >= 0:   # follow the largest tributary up to the head of the valley (>= 20 cells draining)
        path.append(j)
        prev = [k for k in up.get(j, []) if acc[k] >= 20]
        j = max(prev, key=lambda k: acc[k]) if prev else -1
    prof, dist = [], 0.0
    pts = list(reversed(path))
    for a_, b_ in zip([None] + pts[:-1], pts):
        if a_ is not None:
            (x0, y0), (x1, y1) = ll(a_), ll(b_)
            dist += math.hypot((x1 - x0) * 111320 * math.cos(math.radians(37)), (y1 - y0) * 110540)
        prof.append([round(dist), round(el[b_], 1)])
    poulati = {"c": [v for k in reversed(path) for v in ll(k)], "profile_m": prof,
               "outlet_km_from_monastery": round(d2(best[-1], MONASTERY) ** 0.5 * 111, 2) if best else None,
               "top_m": round(max(el[k] for k in path)) if path else None}
    return streams, poulati


EN = {"Απολλωνία": "Apollonia", "Αρτεμώνας": "Artemonas", "Βαθύ": "Vathy", "Κάστρο": "Kastro",
      "Κάτω Πετάλι": "Kato Petali", "Καμάρες": "Kamares", "Πλατύς Γιαλός": "Platys Gialos", "Φάρος": "Faros",
      "Αγία Μαρίνα": "Agia Marina", "Εξάμπελα": "Exampela", "Τρουλάκι": "Troulaki", "Φασολού": "Fasolou",
      "Χερρόνησος": "Chersonisos"}


def places():
    """OSM place nodes on Sifnos (village and hamlet), from the raw village pull."""
    d = json.loads((ROOT / "data" / "raw" / "osm_islands" / "villages.json").read_text(encoding="utf-8"))
    out = []
    for e in d["elements"] if isinstance(d, dict) else d:
        la, lo = e.get("lat"), e.get("lon")
        t = e.get("tags", {})
        if la and 36.86 < la < 37.05 and 24.62 < lo < 24.78 and t.get("name") in EN:
            out.append({"name": EN[t["name"]], "name_el": t["name"], "place": t.get("place"),
                        "lon": round(lo, 5), "lat": round(la, 5), "osm": f"node/{e['id']}"})
    return sorted(out, key=lambda x: x["name"])


def png_grey_alpha(w, h, pix):
    """pix: list of (grey, alpha) rows; writes an 8-bit grey+alpha PNG."""
    raw = b"".join(b"\x00" + bytes(v for ga in row for v in ga) for row in pix)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 4, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    g = json.loads(SRC.read_text(encoding="utf-8"))
    rows, cols, z = g["rows"], g["cols"], g["z"]
    lat0, lon0, dlat, dlon = g["lat0"], g["lon0"], g["dlat"], g["dlon"]
    to_ll = lambda p: (round(lon0 + p[0] * dlon, 5), round(lat0 - p[1] * dlat, 5))
    top = max(v for v in z if v is not None)
    levels = [1] + list(range(STEP, int(top) + 1, STEP))
    out = []
    for lv in levels:
        for line in contour(z, rows, cols, lv):
            ll = simplify([to_ll(p) for p in line], TOL)
            if len(ll) >= 3 or lv == 1:
                out.append({"m": lv, "c": [v for p in ll for v in p]})
    streams, poulati = drainage(z, rows, cols, to_ll)
    (OUT / "sifnos_topo.json").write_text(json.dumps({
        "source": "Copernicus DEM GLO-30 (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, "
                  "provided under COPERNICUS by the EU and ESA)", "kind": "cartographic",
        "step_m": STEP, "coast_m": 1, "highest_m": round(top),
        "extent": [lon0 - dlon / 2, lat0 - (rows - 0.5) * dlat, lon0 + (cols - 0.5) * dlon, lat0 + dlat / 2],
        "lines": out, "streams": streams, "poulati_valley": poulati, "places": places(),
        "monastery": {"name": "Panagia Poulati", "lon": MONASTERY[0], "lat": MONASTERY[1], "source": "OSM way 401645635"},
        "streams_note": "D8 flow lines draining at least STREAM_CELLS cells (~0.16 km2), from the DEM; "
                        "drawn where water would run, not mapped streams"}, separators=(",", ":")), encoding="utf-8")

    # hillshade: sun from the north-west at 45 degrees; metres per cell from the grid spacing
    mx, my = dlon * 111320 * math.cos(math.radians(37)), dlat * 110540
    az, alt = math.radians(315), math.radians(45)
    def e(r, c):
        r, c = min(max(r, 0), rows - 1), min(max(c, 0), cols - 1)
        x = z[r * cols + c]
        return x if x is not None else 0.0
    pix = []
    for r in range(rows):
        row = []
        for c in range(cols):
            if z[r * cols + c] is None:
                row.append((0, 0))
                continue
            dzdx = ((e(r - 1, c + 1) + 2 * e(r, c + 1) + e(r + 1, c + 1)) - (e(r - 1, c - 1) + 2 * e(r, c - 1) + e(r + 1, c - 1))) / (8 * mx)
            dzdy = ((e(r + 1, c - 1) + 2 * e(r + 1, c) + e(r + 1, c + 1)) - (e(r - 1, c - 1) + 2 * e(r - 1, c) + e(r - 1, c + 1))) / (8 * my)
            slope = math.atan(math.hypot(dzdx, dzdy))
            aspect = math.atan2(dzdy, -dzdx)
            hs = math.cos(alt) * math.cos(slope) + math.sin(alt) * math.sin(slope) * math.cos(az - aspect)
            shade = max(0.0, hs)
            # dark ink where the slope faces away from the light; transparent where it is lit
            row.append((0, int(round(255 * (1 - shade) * 0.9))))
        pix.append(row)
    (OUT / "sifnos_hillshade.png").write_bytes(png_grey_alpha(cols, rows, pix))
    n = sum(len(l["c"]) // 2 for l in out)
    print(f"{len(out)} contour lines, {n} points, {(OUT / 'sifnos_topo.json').stat().st_size / 1024:.0f} KB; "
          f"hillshade {cols}x{rows}, {(OUT / 'sifnos_hillshade.png').stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
