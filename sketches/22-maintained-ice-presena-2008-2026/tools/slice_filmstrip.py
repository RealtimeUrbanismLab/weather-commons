"""Sketch 22 · Cut an Earth Engine filmstrip into one image per year.

Usage:  python3 tools/slice_filmstrip.py <filmstrip.png> <prefix>
Example: python3 tools/slice_filmstrip.py img/filmstrip_nat.png nat
Reads the years and dates from data/area_s2.json (frames are in the same order) and writes
img/years/<prefix>_<year>.png plus img/years/index.json. Needs Pillow:  pip3 install pillow
"""
import json, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
strip, prefix = Path(sys.argv[1]), sys.argv[2]
years = json.loads((root / "data" / "area_s2.json").read_text())["years"]
im = Image.open(strip).convert("RGB")
n = len(years)
w, h = im.size
vertical = h >= w
step = (h if vertical else w) // n
out = root / "img" / "years"
out.mkdir(parents=True, exist_ok=True)
idx_path = out / "index.json"
index = json.loads(idx_path.read_text()) if idx_path.exists() else {}
for i, y in enumerate(years):
    box = (0, i * step, w, (i + 1) * step) if vertical else (i * step, 0, (i + 1) * step, h)
    name = f"{prefix}_{y['year']}.png"
    im.crop(box).save(out / name, optimize=True)
    index.setdefault(str(y["year"]), {"date": y.get("date"), "scene": y.get("scene")})[prefix] = f"img/years/{name}"
idx_path.write_text(json.dumps(index, indent=1))
print(f"{n} frames of {step}px -> {out}")
