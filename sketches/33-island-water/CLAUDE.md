# CLAUDE.md: Sketch 33, Island Water

You are helping build **sketch 33** for the Realtime Weather working group (Weather
Commons, TBA21–Academy UNI, Realtime Urbanism Lab). The user works in their own fork of
`RealtimeUrbanismLab/weather-commons`. This kit holds the research done so far.

**This is an iterative research project.** The datasets are incomplete and the user
expects to dig for better ones before building much. Favour finding, checking and
documenting data over polishing pages.

## First session: set up (do once)

**Done on 2026-11-23** (see `NOTES.md`). The sketch is `sketches/33-island-water/`, and the
kit's `scripts/` folder is now `tools/`. Read `docs/scope.md` (geographic and time scope,
agreed 2026-11-23), then `NOTES.md`. The island list (T0.3) is built; next is Phase 1.

1. Read the repository's `AGENTS.md` (and `CONTRIBUTING.md`, `README.md`) and follow
   them. Where they conflict with this file, **they win**; tell the user what differed.
2. Create the sketch with the repository's script, if it has not been made already:
   `node scripts/new-sketch.mjs "Island Water" --number 33 --author "<ask the user>"`
   Ask the user for the author name; it will be public (a pseudonym is fine).
3. Move this kit into the new sketch folder (`sketches/33-<slug>/`), keeping its
   structure: `docs/`, `data/`, `tools/`, `private/`. Then delete the empty kit folder.
   If `AGENTS.md` restricts which files a sketch may contain, propose a layout that fits
   (for example research files on a separate branch) and ask before moving.
4. Confirm `private/` is git-ignored (the kit includes a `.gitignore` for it).
5. Summarise for the user what is in `docs/` and `data/` and what is missing.

After setup, work only inside the sketch folder, as the repository asks.

## The project in brief

A citizen map of where Aegean islands get their water: now (springs, wells, reservoirs,
desalination, tankers, pipelines) and before desalination (cisterns, furrows, check dams,
watermills, sharing rules), zooming into **Sifnos**. Framing: Zepou & Matsaganis (2024),
the Poulati water commons and tourism as a "resource curse". Goal: a public resource for
imagining more sustainable water futures, including what desalination is, what islands
will need, and what else could meet it.

Read `docs/brief.md`, then `docs/tasks.md`, then `docs/dataset_hunt.md`.

## House format (from sketch 03, Operation Popeye)

Four parts, then sources and limits:

1. **Event**: Sifnos, June 2024, set against Poulati's 12-hour water shares.
2. **Simulate**: a rooftop cistern filled by real rain, beside desal output and demand.
3. **Situate**: the Aegean comparative map, islands drawn as cisterns.
4. **Narrate**: sharing rules, rain readings, water habits.

Tag every claim with an evidence kind from `data/evidence_kinds.csv`
(documented, reported, reanalysed, calculated, synthetic, cartographic, interpretive,
not known). Log every data request in `data/manifest.json` (scripts do this).

## Rules

1. **Copyright and licences.** The Zepou & Matsaganis chapter is CC BY-NC-ND: quote and
   cite it, do not adapt or translate passages, do not reuse its DECA photographs.
   News articles: extract facts, do not copy text. Record each dataset's licence.
2. **Public by default.** Everything in the sketch folder becomes public when merged.
   Interview notes, contacts and unpublished material go in `private/` only.
3. **Mark uncertainty.** Blank means not found. Every number carries a date and a
   `source_ids` value. Older or second-hand figures say so in `notes`.
4. **Polite fetching.** Ask before bulk downloads or crawls; respect rate limits and
   robots.txt; prefer official APIs and bulk downloads.
5. **People.** Name Poulati residents only as the chapter does, and only in quotes
   attributed to the chapter. No new personal data without consent.
6. **Ask before** contacting anyone, downloading media, deleting data, or opening a pull
   request to `RealtimeUrbanismLab` (the shared site). Pull requests go to the user's
   fork unless they say otherwise.

## Data conventions

- CSV, UTF-8, header row, ISO dates, one row per fact or feature, `source_ids` column
  pointing to `data/sources.csv` (semicolon-separated).
- Coordinates WGS84 decimal degrees; mark `precision` (exact / approximate).
- Raw downloads in `data/raw/` (git-ignore anything large or with an unclear licence);
  cleaned outputs in `data/derived/`.
- Status values in `data/datasets.csv`: to pull, pulled, checked, rejected, ask, locate.

## Scripts (Python 3.9+, standard library only)

```
python tools/check_data.py                      # validate CSVs and source IDs
python tools/fetch_rain.py --start 1991-01-01 --end 2025-12-31
python tools/fetch_osm_water.py --island Sifnos  # ask before running for all islands
python tools/simulate_cistern.py --island Sifnos --roof 80 --tank 30 --use 150
```

The fetch scripts were written without network access; test them on first run and fix
against the APIs' own documentation (Open-Meteo, Overpass) if a request fails.
