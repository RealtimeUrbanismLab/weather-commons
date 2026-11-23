#!/usr/bin/env python3
"""Validate the sketch's CSVs: same column count per row, known source IDs, gaps."""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main():
    ids = {r["source_id"] for r in csv.DictReader((DATA / "sources.csv").open(encoding="utf-8"))}
    problems = 0
    for f in sorted(DATA.glob("*.csv")):
        rows = list(csv.reader(f.open(encoding="utf-8")))
        widths = {len(r) for r in rows}
        header, body = rows[0], rows[1:]
        empty = sum(1 for r in body for c in r if not c.strip())
        line = f"{f.name}: {len(body)} rows, {empty} empty cells"
        if len(widths) > 1:
            line += f", RAGGED rows {sorted(widths)}"
            problems += 1
        if "source_ids" in header:
            i = header.index("source_ids")
            unknown = {s for r in body for s in r[i].split(";") if s and s not in ids}
            nosrc = sum(1 for r in body if not r[i].strip())
            if unknown:
                line += f", UNKNOWN source ids {sorted(unknown)}"
                problems += 1
            if nosrc:
                line += f", {nosrc} rows without a source"
        print(line)
    print("OK" if not problems else f"{problems} problem(s)")


if __name__ == "__main__":
    main()
