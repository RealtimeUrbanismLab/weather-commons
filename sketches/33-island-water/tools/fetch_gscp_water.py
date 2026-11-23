#!/usr/bin/env python3
"""Find every Civil Protection decision whose TEXT mentions water shortage (stdlib only).

Diavgeia searches decision texts with `content:`. One query per month (to stay well under
the page cap), for the General Secretariat for Civil Protection (organisation 100068650),
term "λειψυδρίας" (the search stems: λειψυδρία and λειψυδρίες give the same results; the
terms ανομβρίας, ξηρασίας, "έλλειψη νερού" add nothing for 2024). Metadata only.

A text match is not proof of cause: each first declaration's operative paragraph
("ΑΠΟΦΑΣΙΖΟΥΜΕ ...") was read to confirm it is for water shortage, and the last decision
of each island chain was read for its end date. The reviewed result is
data/civil_protection_water.csv.

Output: data/raw/diavgeia/gscp_water.json (git-ignored), logged in data/manifest.json.
Usage:  python tools/fetch_gscp_water.py [--from 2024-01-01] [--to 2026-11-23]   (run from tools/)
"""
import argparse
import datetime as dt
import json
import time
from pathlib import Path

from fetch_diavgeia_permits import KEEP, get, when
from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "diavgeia" / "gscp_water.json"
ORG = "100068650"   # General Secretariat for Civil Protection


def months(start, end):
    d = start.replace(day=1)
    while d <= end:
        nxt = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        yield max(d, start), min(nxt - dt.timedelta(days=1), end)
        d = nxt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", default="2024-01-01")
    ap.add_argument("--to", dest="end", default=dt.date.today().isoformat())
    a = ap.parse_args()
    found, requests = {}, 0
    for d0, d1 in months(dt.date.fromisoformat(a.start), dt.date.fromisoformat(a.end)):
        page, got = 0, 0
        while True:
            d = get(f'organizationUid:"{ORG}" AND content:"λειψυδρίας" AND {when(d0, d1)}', page=page)
            requests += 1
            for x in d.get("decisions", []):
                found[x["ada"]] = {k: x.get(k) for k in KEEP}
            got += d["info"]["actualSize"]
            if got >= d["info"]["total"] or not d["info"]["actualSize"]:
                break
            page += 1
            time.sleep(1)
        print(f"{d0:%Y-%m}: {d['info']['total']}")
        time.sleep(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(sorted(found.values(), key=lambda x: x["issueDate"]), ensure_ascii=False, indent=1),
                   encoding="utf-8")
    record(f'https://diavgeia.gov.gr/opendata/search/advanced (organizationUid:"{ORG}" AND content:"λειψυδρίας", '
           f"monthly {a.start}..{a.end})", OUT, licence="Diavgeia open data (public decisions, Law 4210/2013)",
           note=f"Metadata only: {len(found)} decisions; {requests} API requests")
    print(f"{len(found)} decisions")


if __name__ == "__main__":
    main()
