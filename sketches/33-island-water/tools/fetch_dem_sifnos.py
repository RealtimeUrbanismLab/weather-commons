#!/usr/bin/env python3
"""Read Copernicus DEM GLO-30 elevation for Sifnos straight from the cloud-optimised GeoTIFFs.

Only the internal tiles that cover Sifnos are fetched, with HTTP range requests (well under
1 MB), from the public AWS copy of the DEM. stdlib only: the TIFF directory is parsed by
hand, tiles are DEFLATE (zlib) with the floating-point predictor (TIFF predictor 3).

Output: data/raw/dem/sifnos_glo30.json  {"lat0","lon0","dlat","dlon","rows","cols","z":[...]}  (git-ignored)
        north-west corner first, row by row; elevation in metres; sea and no-data as null.
Licence: Copernicus DEM GLO-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
2014-2018, provided under COPERNICUS by the European Union and ESA; free licence with attribution.

Usage: python tools/fetch_dem_sifnos.py    (run from tools/)
"""
import json
import struct
import urllib.request
import zlib
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "dem" / "sifnos_glo30.json"
BBOX = (24.62, 36.86, 24.78, 37.05)   # lon0, lat0, lon1, lat1: Sifnos with a margin
BASE = "https://copernicus-dem-30m.s3.amazonaws.com/"
UA = {"User-Agent": "weather-commons sketch 33 (research)"}


def rng(url, start, length):
    req = urllib.request.Request(url, headers=dict(UA, Range=f"bytes={start}-{start + length - 1}"))
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def ifd(url):
    """Parse the first image directory of a little-endian classic TIFF."""
    head = rng(url, 0, 65536)
    assert head[:4] == b"II*\x00", "expected a little-endian classic TIFF"
    (off,) = struct.unpack("<I", head[4:8])
    (n,) = struct.unpack("<H", head[off:off + 2])
    sizes = {1: 1, 2: 1, 3: 2, 4: 4, 11: 4, 12: 8, 16: 8}
    fmt = {1: "B", 2: "c", 3: "H", 4: "I", 11: "f", 12: "d", 16: "Q"}
    tags = {}
    for i in range(n):
        e = head[off + 2 + 12 * i: off + 14 + 12 * i]
        tag, typ, cnt = struct.unpack("<HHI", e[:8])
        size = sizes[typ] * cnt
        if size <= 4:
            raw = e[8:8 + size]
        else:
            (vo,) = struct.unpack("<I", e[8:12])
            raw = head[vo:vo + size] if vo + size <= len(head) else rng(url, vo, size)
        tags[tag] = struct.unpack("<" + fmt[typ] * cnt, raw) if typ != 2 else raw
    return tags


def tile(url, t, idx):
    tw, th = t[322][0], t[323][0]
    data = zlib.decompress(rng(url, t[324][idx], t[325][idx]))
    assert t.get(317, (1,))[0] == 3 and t[258][0] == 32, "expected float32 with predictor 3"
    out = []
    rowb = tw * 4
    for r in range(th):
        b = bytearray(data[r * rowb:(r + 1) * rowb])
        for i in range(1, rowb):
            b[i] = (b[i] + b[i - 1]) & 0xFF
        row = [struct.unpack(">f", bytes((b[i], b[tw + i], b[2 * tw + i], b[3 * tw + i])))[0] for i in range(tw)]
        out.append(row)
    return out


def main():
    lon0, lat0, lon1, lat1 = BBOX
    grids = {}
    for lat_t in range(int(lat0), int(lat1) + 1):
        name = f"Copernicus_DSM_COG_10_N{lat_t:02d}_00_E{int(lon0):03d}_00_DEM"
        url = f"{BASE}{name}/{name}.tif"
        t = ifd(url)
        W, H, tw, th = t[256][0], t[257][0], t[322][0], t[323][0]
        sx, sy = t[33550][0], t[33550][1]
        x0, y0 = t[33922][3], t[33922][4]        # top-left corner (lon, lat)
        c0, c1 = int((lon0 - x0) / sx), int((lon1 - x0) / sx) + 1
        r0, r1 = max(0, int((y0 - lat1) / sy)), min(H, int((y0 - lat0) / sy) + 1)
        if r0 >= r1:
            continue
        across = (W + tw - 1) // tw
        got = 0
        for tr in range(r0 // th, (r1 - 1) // th + 1):
            for tc in range(c0 // tw, (c1 - 1) // tw + 1):
                rows = tile(url, t, tr * across + tc)
                got += t[325][tr * across + tc]
                for i, row in enumerate(rows):
                    r = tr * th + i
                    if r0 <= r < r1:
                        for j, v in enumerate(row):
                            c = tc * tw + j
                            if c0 <= c < c1:
                                grids[(round(y0 - (r + 0.5) * sy, 6), round(x0 + (c + 0.5) * sx, 6))] = v
        record(url, OUT, licence="Copernicus DEM GLO-30 (free, with attribution: DLR / Airbus, under COPERNICUS by EU and ESA)",
               note=f"Range requests only: internal tiles covering {BBOX}, {got / 1024:.0f} KB")
        print(name, f"{got / 1024:.0f} KB", f"rows {r0}-{r1} cols {c0}-{c1}", f"pixel {sx:.6f} x {sy:.6f}")
    lats = sorted({k[0] for k in grids}, reverse=True)
    lons = sorted({k[1] for k in grids})
    z = [[(round(grids.get((la, lo), 0.0), 1) if grids.get((la, lo), 0.0) > 0 else None) for lo in lons] for la in lats]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"lat0": lats[0], "lon0": lons[0], "dlat": round(lats[0] - lats[1], 8),
                               "dlon": round(lons[1] - lons[0], 8), "rows": len(lats), "cols": len(lons),
                               "z": [v for row in z for v in row]}, separators=(",", ":")), encoding="utf-8")
    top = max(v for row in z for v in row if v is not None)
    print(f"{len(lats)} x {len(lons)} cells, highest {top:.0f} m -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
