#!/usr/bin/env python3
"""Pull Diavgeia decision METADATA (no documents) about water on Sifnos (stdlib only).

Two queries per half-year window (the API allows at most six months per query):
  A. decisions issued by the Municipality of Sifnos (organisation 6278) whose subject
     mentions desalination, water supply, water shortage, water, boreholes or tanks;
  B. decisions by any body whose subject names Sifnos together with water shortage,
     emergency, desalination or water supply (Civil Protection, Region, Ministries).
Titles can name people (payments, staff, contractors), so the output stays in the
git-ignored raw folder; only reviewed, name-free summaries go into data/.

Output: data/raw/diavgeia/sifnos.json   (one object per decision, de-duplicated by ADA)
Usage:  python tools/fetch_diavgeia_sifnos.py [--from 2010-10-01] [--to YYYY-MM-DD]
"""
import argparse
import datetime as dt
import json
import time
from pathlib import Path

from fetch_diavgeia_permits import KEEP, get, when, windows
from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "diavgeia" / "sifnos.json"
ORG = "6278"  # ΔΗΜΟΣ ΣΙΦΝΟΥ
WATER = ('(subject:"αφαλάτωσης" OR subject:"ύδρευσης" OR subject:"λειψυδρίας" OR subject:"νερού" '
         'OR subject:"γεώτρησης" OR subject:"δεξαμενής" OR subject:"ταμιευτήρα")')
OUTSIDE = ('subject:"Σίφνου" AND (subject:"λειψυδρίας" OR subject:"έκτακτης ανάγκης" '
           'OR subject:"αφαλάτωσης" OR subject:"ύδρευσης")')


def pull(q, decisions):
    page, got, n = 0, 0, 0
    while True:
        d = get(q, page=page)
        n += 1
        for x in d.get("decisions", []):
            decisions[x["ada"]] = {k: x.get(k) for k in KEEP}
        got += d["info"]["actualSize"]
        if got >= d["info"]["total"] or not d["info"]["actualSize"]:
            return d["info"]["total"], n
        page += 1
        time.sleep(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", default="2010-10-01")
    ap.add_argument("--to", dest="end", default=dt.date.today().isoformat())
    a = ap.parse_args()
    decisions, requests = {}, 0
    for d0, d1 in windows(dt.date.fromisoformat(a.start), dt.date.fromisoformat(a.end)):
        ta, na = pull(f'organizationUid:"{ORG}" AND {WATER} AND {when(d0, d1)}', decisions)
        time.sleep(1)
        tb, nb = pull(f"{OUTSIDE} AND {when(d0, d1)}", decisions)
        requests += na + nb
        print(f"{d0} to {d1}: municipality {ta}, other bodies {tb}")
        time.sleep(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(sorted(decisions.values(), key=lambda x: x["issueDate"]),
                              ensure_ascii=False, indent=1), encoding="utf-8")
    record(f"https://diavgeia.gov.gr/opendata/search/advanced (Sifnos water: org {ORG} + subject terms; "
           f"other bodies naming Sifnos) per half-year {a.start}..{a.end}",
           OUT, licence="Diavgeia open data (public decisions, Law 4210/2013)",
           note=f"Metadata only: {len(decisions)} decisions; {requests} API requests")
    print(f"{len(decisions)} decisions saved; {requests} requests")


if __name__ == "__main__":
    main()
