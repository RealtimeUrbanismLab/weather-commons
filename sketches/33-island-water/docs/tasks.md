# Tasks

Phases overlap, but data comes first. After each task, tell the user what changed and
update `data/datasets.csv` status.

## Phase 0: set up

- **T0.1** Follow "First session" in `CLAUDE.md` (sketch 33 created, kit moved).
- **T0.2** Run `python tools/check_data.py`; report gaps by file.
- **T0.3 Island list.** Build the base layer defined in `docs/scope.md`: every inhabited
  Greek Aegean island from the ELSTAT 2021 census (name, group, residents, scope =
  `base` or `context`), with coordinates checked against OpenStreetMap. Replace
  `data/islands_geo.csv` and extend `data/islands.csv`. Keep existing facts; tag
  Aegina, Poros, Spetses and Kythera `context`. Ask before downloading the census tables.

## Phase 1: dig for datasets

Work through `docs/dataset_hunt.md`. For each dataset: find it, check its licence and
date, pull a small sample, record it in `data/datasets.csv` and `data/sources.csv`, then
ask the user before a full pull.

- **T1.1 Rain.** After T0.3, run `tools/fetch_rain.py` for the base-layer islands in
  `data/islands_geo.csv` (1991 to the latest full month, monthly; compare with the
  1991–2020 normal). Add the wettest and driest recent winters to `data/derived/`.
  Then compare with NOA station data where an island has a station (request via
  Meteosearch; the user sends the request).
- **T1.2 Desalination plants.** Find the EMODnet Human Activities desalination layer
  (WFS or download), filter to Greece, join to islands. Note capacity, year, technology.
- **T1.3 Groundwater status.** Find River Basin District GR14 (Aegean Islands) in the
  EEA WISE Water Framework Directive data: groundwater bodies, quantitative status.
- **T1.4 OpenStreetMap water features.** Run `tools/fetch_osm_water.py` for Sifnos
  first; review tag counts with the user; then other islands.
- **T1.5 Population.** ELSTAT 2021 census by municipality; port passenger statistics
  and tourist beds as a summer-population proxy.
- **T1.6 Emergencies.** Compile every water emergency declaration 2024-2026 for Aegean
  islands from Civil Protection and Diavgeia; add to a new `data/emergencies.csv`.
- **T1.7 Costs and tankers.** Locate the University of the Aegean study; search Diavgeia
  and KIMDIS for current tanker contracts (υδροφόρα, μεταφορά νερού) and desal tenders.
- **T1.8 Sifnos detail.** Desal plant capacities at Platys Gialos and Kamares; the
  reservoir; DEYA/municipal figures; the 2026 tender documents; Zafeirakou et al. 2022.
- **T1.9 Drought and futures.** Copernicus European Drought Observatory layers; C3S or
  EURO-CORDEX rainfall projections for the Aegean; the national seven-island demand
  study if published.
- **T1.10 Traditional systems.** Ask Cisterns Know (DECA) and Andros Routes for data;
  search folklore and archaeology sources per `docs/dataset_hunt.md`.

**Phase 1 done when:** every layer in `docs/design.md` has at least one dataset marked
`checked`, or a note saying why none exists.

## Phase 2: design

- **T2.1** Sketch the island-as-cistern glyph on paper-like SVG with 5 islands' real
  numbers. Show the user three variants.
- **T2.2** Draft the comparative map in kepler.gl from `data/` (no code) to test layers.
- **T2.3** Write the cistern simulation page section with real Sifnos rain
  (`tools/simulate_cistern.py` output). Label assumptions as synthetic.
- **T2.4** Draft the four parts as text, with evidence-kind tags, using the repository's
  sketch template.

## Phase 3: build

- **T3.1** Build the page in the sketch folder per `AGENTS.md`. Relative paths only.
  Offline-safe; data embedded or in `data/`.
- **T3.2** Sources and limits section and `data/manifest.json` complete.
- **T3.3** Check on a phone width.

## Phase 4: share

- **T4.1** Commit (message starts with 33), push a branch, open a pull request **to the
  user's fork**. The user merges.
- **T4.2** When the user says so, prepare a pull request to `RealtimeUrbanismLab`.
- **T4.3** Draft a short post for the community space.
