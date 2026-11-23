#!/usr/bin/env bash
# Sketch 22 · Put the final Earth Engine results in place, in the right order:
#   1) local archive (raw, untouched, with checksums)  2) sketch data and images  3) GitHub (branch 22-final)
# Usage:  bash finalize.sh  [folder with the downloads]  [unzipped package folder]
# Defaults: ~/Downloads/Presena_GEE  and  ~/Downloads/maintained_ice_v10_package
set -euo pipefail
SRC="${1:-$HOME/Downloads/Presena_GEE}"
PKG="${2:-$HOME/Downloads/maintained_ice_v10_package}/sketch-22"
REPO="${REPO:-$HOME/weather-commons}"   # override: REPO=/path/to/weather-commons bash finalize.sh
D="$REPO/sketches/22-maintained-ice-presena-2008-2026"
ARCH="$HOME/Presena_archive/$(date +%Y-%m-%d)_gee_v3.6"

echo "1 · Archive (raw files, never edited) -> $ARCH"
mkdir -p "$ARCH"
cp -R "$SRC"/. "$ARCH"/
( cd "$ARCH" && find . -type f ! -name SHA256SUMS.txt ! -name .DS_Store -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS.txt )

echo "2 · Repository branch 22-final"
cd "$REPO"
git switch main && git pull
git switch -c 22-final 2>/dev/null || git switch 22-final
cp "$PKG"/tools/*.py "$PKG"/tools/*.js "$PKG"/tools/*.sh "$D/tools/"
cp "$PKG/data/claims.json" "$PKG/data/assertions.json" "$PKG/data/years.json" "$PKG/data/parameters.json" "$D/data/"

echo "3 · Data files for the page"
python3 "$D/tools/ingest_gee.py" "$ARCH"
[ -f "$ARCH/presena_s2_skirun_zone.geojson" ] && cp "$ARCH/presena_s2_skirun_zone.geojson" "$D/data/skirun_zone.geojson"
cp "$ARCH/qa.csv" "$D/data/qa.csv" 2>/dev/null || echo "   (no qa.csv found)"

echo "4 · Images: strips, GIF, one frame per year"
mkdir -p "$D/img"
for f in filmstrip_nat.png filmstrip_swir.png filmstrip_frac.png presena_swir.gif; do
  [ -f "$ARCH/$f" ] && cp "$ARCH/$f" "$D/img/" || echo "   missing: $f"
done
for p in nat swir frac; do
  [ -f "$D/img/filmstrip_$p.png" ] && python3 "$D/tools/slice_filmstrip.py" "$D/img/filmstrip_$p.png" "$p"
done

echo "5 · Checks and commit"
node scripts/check-sizes.mjs || true
git add "$D"
git commit -m "22: final Sentinel-2 results (v3.6): area with bounds, observations, outlines, zone, QA, images" || echo "   nothing to commit"
git push -u origin 22-final
echo "Done. Archive: $ARCH"
