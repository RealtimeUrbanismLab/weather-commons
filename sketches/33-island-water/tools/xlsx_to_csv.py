#!/usr/bin/env python3
"""Convert one sheet of an .xlsx file to CSV, using only the standard library.

Usage: python -I tools/xlsx_to_csv.py <file.xlsx> <out.csv> [--sheet N]   (N from 1)
       python -I tools/xlsx_to_csv.py <file.xlsx> --list

Reads cell values only (shared strings, inline strings, numbers); no formulas or styles.
Self-contained so it can run with `python -I` on downloaded files.
"""
import csv
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def sheets(z):
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target = {r.get("Id"): r.get("Target") for r in rels.iter(REL + "Relationship")}
    out = []
    for s in wb.find("m:sheets", NS):
        t = target[s.get("{%s}id" % NS["r"])].lstrip("/")
        out.append((s.get("name"), t if t.startswith("xl/") else "xl/" + t))
    return out


def shared_strings(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])) for si in root.findall("m:si", NS)]


def rows(z, path, strings):
    root = ET.fromstring(z.read(path))
    for row in root.iter("{%s}row" % NS["m"]):
        vals = {}
        for c in row.findall("m:c", NS):
            t, v = c.get("t"), c.find("m:v", NS)
            if t == "s" and v is not None:
                val = strings[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
            else:
                val = v.text if v is not None else ""
            vals[col_index(c.get("r"))] = val
        width = max(vals) + 1 if vals else 0
        yield [vals.get(i, "") for i in range(width)]


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    with zipfile.ZipFile(argv[1]) as z:
        sh = sheets(z)
        if "--list" in argv:
            for i, (name, _) in enumerate(sh, 1):
                print(i, name)
            return
        n = int(argv[argv.index("--sheet") + 1]) if "--sheet" in argv else 1
        strings = shared_strings(z)
        with open(argv[2], "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            for r in rows(z, sh[n - 1][1], strings):
                w.writerow(r)


if __name__ == "__main__":
    main(sys.argv)
