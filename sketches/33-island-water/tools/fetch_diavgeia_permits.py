#!/usr/bin/env python3
"""Pull Diavgeia decision METADATA (no documents) on desalination permits (stdlib only).

Diavgeia starts in October 2010. The advanced search API returns at most a 6-month
window per query, so the script walks half-years. For each window it records:
  - the total number of decisions with desalination in the subject (an activity count);
  - the metadata of decisions whose subject also names a permit, approval of
    environmental terms, or water-use licence (these state capacity, units and site).
Greek stemming is handled by the API (αφαλάτωση / αφαλάτωσης / αφαλατώσεως match alike).

Outputs (git-ignored raw):
  data/raw/diavgeia/permits.json        decisions, one object each, de-duplicated by ADA
  data/raw/diavgeia/window_counts.csv   per half-year: all desal decisions, permit matches
Logs one manifest entry per run.

Usage: python tools/fetch_diavgeia_permits.py [--from 2010-10-01] [--to YYYY-MM-DD]
API: https://diavgeia.gov.gr/api/help
"""
import argparse
import csv
import datetime as dt
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from manifest import record

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw" / "diavgeia"
API = "https://diavgeia.gov.gr/opendata/search/advanced"
UA = "weather-commons sketch 33 (research)"
DESAL = 'subject:"αφαλάτωσης"'
PERMIT = ('(subject:"άδεια" OR subject:"αδειοδότηση" OR subject:"περιβαλλοντικών όρων" '
          'OR subject:"ΑΕΠΟ" OR subject:"περιβαλλοντικές δεσμεύσεις" OR subject:"χρήσης νερού")')
PAGE = 100
KEEP = ("ada", "subject", "issueDate", "submissionTimestamp", "organizationId", "decisionTypeId",
        "unitIds", "thematicCategoryIds", "protocolNumber", "status", "url", "documentUrl",
        "extraFieldValues")


def get(q, page=0, size=PAGE, tries=4):
    url = f"{API}?{urllib.parse.urlencode({'q': q, 'page': page, 'size': size})}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
            time.sleep(15 * (attempt + 1))


def windows(start, end):
    s = start
    while s <= end:
        e = dt.date(s.year, 6, 30) if s.month <= 6 else dt.date(s.year, 12, 31)
        yield s, min(e, end)
        s = e + dt.timedelta(days=1)


def when(d0, d1):
    return f"issueDate:[DT({d0}T00:00:00) TO DT({d1}T23:59:59)]"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", default="2010-10-01")
    ap.add_argument("--to", dest="end", default=dt.date.today().isoformat())
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    decisions, counts, requests = {}, [], 0
    for d0, d1 in windows(dt.date.fromisoformat(a.start), dt.date.fromisoformat(a.end)):
        total_all = get(f"{DESAL} AND {when(d0, d1)}", size=1)["info"]["total"]
        requests += 1
        time.sleep(1)
        q = f"{DESAL} AND {PERMIT} AND {when(d0, d1)}"
        page, got = 0, 0
        while True:
            d = get(q, page=page)
            requests += 1
            for x in d.get("decisions", []):
                decisions[x["ada"]] = {k: x.get(k) for k in KEEP}
            got += d["info"]["actualSize"]
            if got >= d["info"]["total"] or not d["info"]["actualSize"]:
                break
            page += 1
            time.sleep(1)
        counts.append({"from": d0.isoformat(), "to": d1.isoformat(),
                       "desal_decisions": total_all, "permit_decisions": d["info"]["total"]})
        print(f"{d0} to {d1}: {total_all} desal decisions, {d['info']['total']} permit-type")
        time.sleep(1)
    (OUT / "permits.json").write_text(json.dumps(sorted(decisions.values(), key=lambda x: x["issueDate"]),
                                                 ensure_ascii=False, indent=1), encoding="utf-8")
    with (OUT / "window_counts.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(counts[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(counts)
    record(f"{API}?q={DESAL} AND {PERMIT} AND issueDate per half-year {a.start}..{a.end}",
           OUT / "permits.json", licence="Diavgeia open data (public decisions, Law 4210/2013)",
           note=f"Metadata only: {len(decisions)} permit-type decisions; {requests} API requests")
    print(f"{len(decisions)} decisions saved; {requests} requests")


if __name__ == "__main__":
    main()
