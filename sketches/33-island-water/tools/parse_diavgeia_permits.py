#!/usr/bin/env python3
"""Turn Diavgeia permit metadata into a table: kind, capacity, units, island (stdlib only).

Input:  data/raw/diavgeia/permits.json   (tools/fetch_diavgeia_permits.py)
        data/islands_geo.csv, data/island_rules.csv (island names, scope)
Cache:  data/raw/diavgeia/orgs.json      (issuing body names; fetched once per id)
Output: data/derived/desal_permits_diavgeia.csv     (committed: no titles, no payment rows)
        data/raw/diavgeia/permits_parsed_full.csv  (git-ignored: every row, with full titles)

Everything is read from the decision TITLE only; no documents are opened.
Titles can name people (officials' travel claims, private permit holders, plots named
after their owners), so the committed table drops the title text and the
"payment / consultancy" rows (fees, contracts, travel), and keeps only categories read
from the title: kind, holder type, capacity, units, island. The ADA and URL lead to the
public decision for anyone who needs the wording.
A permit or approval is not a built plant: rows say "permitted", not "operating".
Islands are matched on whole words, with Greek case endings generated from the
nominative (Νάξος / Νάξου / Νάξο), plus hand-listed forms (municipality names, other
names). Islands under 10 residents are not matched by text (their names are common
words: Νερά, Στρογγυλή). If the title names no island, the issuing body's name is tried.

Usage: python -I tools/parse_diavgeia_permits.py
"""
import csv
import datetime as dt
import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "diavgeia"
OUT = ROOT / "data" / "derived" / "desal_permits_diavgeia.csv"
FULL = RAW / "permits_parsed_full.csv"
NOT_COMMITTED_KINDS = {"payment / consultancy for permits"}
PRIVATE_FIELDS = ("subject",)
UA = "weather-commons sketch 33 (research)"

EXTRA = {  # other names and municipality forms, nominative or as they appear
    "Ios": ["Ιητών"], "Kalymnos": ["Καλυμνίων"], "Syros": ["Ερμούπολη", "Ερμουπόλεως", "Σύρου-Ερμούπολης"],
    "Santorini (Thira)": ["Θήρα", "Σαντορίνη"], "Kastellorizo (Megisti)": ["Μεγίστη", "Καστελλόριζο", "Καστελόριζο"],
    "Lesvos": ["Μυτιλήνη", "Λέσβος"], "Kea": ["Κέα", "Τζιά", "Τζια"], "Rhodes": ["Ρόδος", "Λίνδος"],
    "Crete": ["Κρήτη", "Ηράκλειο", "Χανιά", "Ρέθυμνο", "Λασίθι", "Χερσόνησος", "Ιεράπετρα", "Σητεία",
              "Μαλεβίζι", "Ελούντα", "Βρουχάς", "Άγιος Νικόλαος"],
    "Evia": ["Εύβοια", "Ευβοίας", "Χαλκίδα", "Κάρυστος", "Κύμη", "Ιστιαία", "Αιδηψός", "Λιχάδα",
             "Ιστιαίας - Αιδηψού"], "Kos": ["Κως", "Κω"],
    "Ano Koufonisi": ["Κουφονήσι", "Κουφονήσια", "Κουφονησίων"], "Agios Efstratios": ["Άγιος Ευστράτιος"],
    "Samos": ["Σάμος", "Καρλόβασι"], "Chios": ["Χίος"], "Lemnos": ["Λήμνος", "Μύρινα"],
    "Fournoi": ["Φούρνοι", "Φούρνων Κορσεών"], "Oinousses": ["Οινούσσες", "Οινουσσών"],
    "Psara": ["Ψαρά", "Ψαρών"], "Lipsi": ["Λειψοί", "Λειψών"], "Spetses": ["Σπέτσες", "Σπετσών"],
    "Kythera": ["Κύθηρα", "Κυθήρων"], "Antikythera": ["Αντικύθηρα", "Αντικυθήρων"],
    "Agathonisi": ["Αγαθονήσι", "Αγαθονησίου"], "Therasia": ["Θηρασία"], "Delos": ["Δήλος"],
    "Donousa": ["Δονούσα"], "Iraklia": ["Ηρακλειά"], "Schinoussa": ["Σχοινούσα", "Σχοινούσσα"],
}
OUTSIDE = ["Κέρκυρα", "Κεφαλονιά", "Κεφαλληνία", "Ζάκυνθος", "Λευκάδα", "Ιθάκη", "Παξοί", "Μεγανήσι",
           "Πύλος", "Μεσσηνία", "Κασσωπαίων", "Ασπρόπυργος", "Αττική", "Πειραιάς", "Θεσσαλονίκη",
           "Χαλκιδική", "Μάνδρα", "Πρέβεζα", "Πελοπόννησος", "Ερμιονίδα", "Λαύριο"]
NUM = {"μια": 1, "μιας": 1, "μία": 1, "μίας": 1, "ενός": 1, "δύο": 2, "δυο": 2, "τριών": 3, "τρεις": 3,
       "τεσσάρων": 4, "τέσσερις": 4, "πέντε": 5, "έξι": 6, "επτά": 7, "οκτώ": 8}


LATIN_LOOKALIKE = str.maketrans("ABEHIKMNOPTXYZabeiknoptxyz", "ΑΒΕΗΙΚΜΝΟΡΤΧΥΖαβεικνοπτχυζ")


def norm(s):
    # Greek titles sometimes mix in Latin look-alike letters ("AΓΙΟΥ"); map them to Greek
    # only inside words that are otherwise Greek.
    s = re.sub(r"\w+", lambda m: m.group(0).translate(LATIN_LOOKALIKE)
               if re.search(r"[Α-Ωα-ωΆ-ώ]", m.group(0)) else m.group(0), s)
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").replace("ς", "σ")


def tokens(s):
    return re.findall(r"[a-zα-ω0-9]+", norm(s))


def declensions(name):
    w = tokens(name)
    if not w:
        return set()
    last, head = w[-1], w[:-1]
    forms = {last}
    for end, subs in (("οσ", ["ου", "ο"]), ("ωσ", ["ω"]), ("οι", ["ων"]), ("εσ", ["ων"]),
                      ("η", ["ησ"]), ("α", ["ασ", "ων"]), ("ι", ["ιου", "ια"]), ("ο", ["ου"])):
        if last.endswith(end):
            forms |= {last[: -len(end)] + s for s in subs}
    out = set()
    for f in forms:
        hs = [head]
        if head and head[-1].endswith("οσ"):  # "Άγιος Ευστράτιος" -> "Αγίου Ευστρατίου"
            hs.append(head[:-1] + [head[-1][:-2] + "ου"])
        for h in hs:
            out.add(tuple(h + [f]))
    return out


def phrase_in(phrase, toks):
    n = len(phrase)
    return any(tuple(toks[i:i + n]) == phrase for i in range(len(toks) - n + 1))


def org_names(ids):
    cache_path = RAW / "orgs.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    for oid in sorted(ids - set(cache)):
        req = urllib.request.Request(f"https://diavgeia.gov.gr/opendata/organizations/{oid}",
                                     headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read().decode("utf-8"))
        cache[oid] = {"label": d.get("label", ""), "category": d.get("category", "")}
        time.sleep(0.5)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    return cache


def kind(s):
    n = norm(s)
    if "προσωριν" in n and ("αδεια" in n or "εγκαταστασ" in n):
        return "temporary install/operate permit"
    if "περιβαλλοντικ" in n or "αεπο" in n:
        return "environmental terms"
    if "χρησησ νερου" in n or "χρησησ θαλασσινου" in n or "υδατικων πορων" in n:
        return "water-use / works permit"
    if "αδεια εγκαταστασησ" in n or "μηχανολογικ" in n or "αδεια λειτουργιασ" in n:
        return "installation / operating permit"
    if "οικοδομικ" in n or "δομησησ" in n:
        return "building permit"
    if "παραβολ" in n or "δαπαν" in n or "πληρωμ" in n or "αναθεσ" in n or "συμβουλ" in n:
        return "payment / consultancy for permits"
    return "other"


def holder_type(s):
    """Who the decision is about, as a category only (never a name). Approximate: private
    permits also name the municipality as their location, so hotel and company are tested
    first; "municipal / public" means no private holder was recognised."""
    n = norm(s)
    if "ξενοδοχ" in n or "hotel" in n or "resort" in n:
        return "hotel"
    if re.search(r"\bα\s?ε\b|\bε\s?π\s?ε\b|\bι\s?κ\s?ε\b|\bο\s?ε\b|limited|\bltd\b|εταιρει", n):
        return "company"
    if re.search(r"δημο|δ\s?ε\s?υ\s?α|κοινοτητ|περιφερει|υπουργει", n):
        return "municipal / public"
    return "not known"


CAP = re.compile(r"(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)\s*(?:m3|m³|μ3|κ\.?\s?μ\.?|κυβικ\w*\s*μετρ\w*)"
                 r"\s*(?:/|ανα|την)?\s*(?:d\b|day|ημερ\w*|24\s*ωρ\w*|ημερησιωσ)", re.I)
UNITS = re.compile(r"\b(\d+|" + "|".join(NUM) + r")\s*(?:\(\d+\)\s*)?(?:\w+\s+){0,2}μοναδ", re.I)


def capacities(s):
    out = []
    for m in CAP.finditer(norm(s).replace("m 3", "m3")):
        v = m.group(1).replace(" ", "").replace(".", "").replace(",", ".")
        try:
            out.append(float(v))
        except ValueError:
            pass
    return out


def main():
    D = json.loads((RAW / "permits.json").read_text(encoding="utf-8"))
    geo = list(csv.DictReader((ROOT / "data" / "islands_geo.csv").open(encoding="utf-8")))
    rules = {r["island_en"]: r for r in csv.DictReader((ROOT / "data" / "island_rules.csv").open(encoding="utf-8"))}
    scope = {g["island"]: g["scope"] for g in geo}
    pats = []
    for g in geo:
        if int(g["residents_2021"]) < 10:
            continue
        names = [rules.get(g["island"], {}).get("island_el", "")] + EXTRA.get(g["island"], [])
        forms = set()
        for nm in names:
            for part in re.split(r"[()]", nm):
                if part.strip():
                    forms |= declensions(part)
        pats += [(f, g["island"]) for f in forms]
    outside = set()
    for nm in OUTSIDE:
        outside |= declensions(nm)
    pats.sort(key=lambda p: -len(p[0]))  # longest phrases first
    orgs = org_names({x["organizationId"] for x in D})

    rows = []
    for x in D:
        subj = " ".join(x["subject"].split())
        toks = tokens(subj)
        found = []
        for p, isl in pats:
            if phrase_in(p, toks) and isl not in found:
                found.append(isl)
        how = "title" if found else ""
        also = ""
        if len(found) == 2:  # an islet named with its parent island: the islet is meant
            res = {g["island"]: int(g["residents_2021"]) for g in geo}
            found.sort(key=lambda i: res[i])
            also, found = found[1], found[:1]
            how = f"title (smaller of two; also names {also})"
        elif len(found) > 2:
            how = "title (several islands named)"
        if not found:
            olab = orgs.get(x["organizationId"], {}).get("label", "")
            ot = tokens(olab)
            for p, isl in pats:
                if phrase_in(p, ot) and isl not in found:
                    found.append(isl)
            how = "issuing body" if found else ""
        if not found and any(phrase_in(p, toks) for p in outside):
            sc, how = "outside", "title (mainland / Ionian)"
        else:
            sc = ";".join(sorted({scope[i] for i in found})) if found else "not known"
        caps = capacities(subj)
        um = UNITS.search(norm(subj))
        units = ""
        if um:
            g1 = um.group(1)
            units = int(g1) if g1.isdigit() else NUM.get(g1, "")
        n = norm(subj)
        rows.append({
            "ada": x["ada"], "issue_date": dt.date.fromtimestamp(x["issueDate"] / 1000).isoformat(),
            "issuer": orgs.get(x["organizationId"], {}).get("label", ""), "issuer_id": x["organizationId"],
            "kind": kind(subj), "holder_type": holder_type(subj),
            "amends_or_corrects": "yes" if re.search(r"τροποποιησ|ορθη επαναληψη|ανακλησ|ανανεωσ|παραταση", n) else "",
            "island": ";".join(found), "island_scope": sc, "island_from": how,
            "capacity_m3d": caps[0] if caps else "", "capacities_in_title": ";".join(f"{c:g}" for c in caps),
            "units": units, "portable": "yes" if "φορητ" in n else "",
            "meaning": "permitted or approved; not proof of a built or operating plant",
            "subject": subj, "url": f"https://diavgeia.gov.gr/decision/view/{x['ada']}",
            "evidence_kind": "documented", "source_ids": "DIAVGEIA",
        })
    with FULL.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    public = [{k: v for k, v in r.items() if k not in PRIVATE_FIELDS}
              for r in rows if r["kind"] not in NOT_COMMITTED_KINDS]
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(public[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(public)
    from collections import Counter
    print(f"Wrote {FULL.relative_to(ROOT)}: {len(rows)} decisions with titles (git-ignored)")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(public)} decisions, no titles, no payment rows")
    print("  holder:", dict(Counter(r["holder_type"] for r in public)))
    print("  kind:", dict(Counter(r["kind"] for r in rows)))
    print("  scope:", dict(Counter(r["island_scope"] for r in rows)))
    print("  with capacity:", sum(1 for r in rows if r["capacity_m3d"] != ""),
          "| with units:", sum(1 for r in rows if r["units"] != ""))


if __name__ == "__main__":
    main()
