# Notes

Working notes for sketch 33. Read this first. Date each entry, and move items to Done when they ship.

## Next

- T1.1 rain: all 105 islands fetched (see Done). Next: compare ERA5 with NOA stations
  (Sifnos, Chios first; Chios ERA5 is ~14% wetter than stations, 2013–2019). A request
  to NOA is drafted in `private/noa_request_draft.md` for the author to send; it asks for
  the station list, daily rain, and whether derived station figures may be published
  (NOA's 2025 agreement restricts third-party use). Meteosearch accounts allow 30 files a
  day, 720 in total; its station-records spreadsheet timed out (HTTP 522).
- ERA5 resolution: 105 islands fall in 79 grid cells (66 for base islands); small islets
  share their parent's cell, so they are not independent rain records. Median 12 km from
  point to cell centre, max 35 km (Makronisos). Say so in Sources and limits.
- Daily rain per island is kept in git-ignored `data/raw/rain_daily/` (~200 KB each,
  refetchable); only monthly, winter and cell summaries go in `data/derived/`. Copy
  Sifnos's daily file into the page data when building the simulation.
- EMODnet's `customer`, `plant_owner` and `project` fields (in `desal_plants_greece.csv`)
  name businesses, some after families (e.g. laundries, small hotels). It is a published
  CC BY dataset, so kept as is; decide whether the page shows owner names at all.
- Desal history: timeline built and 13 islands reconciled (see Done). Gaps: the
  1970s–90s (Desalination-journal inventories; solar stills), plants closed before 2020,
  which EMODnet drops, and Crete (67 records, mostly hotels; reconcile separately if
  needed). For the 13 reconciled islands, use `desal_reconciled_by_island.csv`, not raw
  EMODnet sums. To verify on the ground or with the utilities: Syros's 2005 plants (Ano
  Syros 7th, Poseidonia 2nd), Chios's Omiroupoli 2nd and 3rd, Milos 3,360 vs 1,200 m³/day.
  EMODnet record 413 ("Thirasia") is counted under Santorini because EMODnet gives Thira
  municipality; it belongs to Therasia.
  Pre-2018 Diavgeia titles rarely state capacity: open selected PDFs only with permission.
- Water 2014 discrepancies to resolve: Leros 200 m³/day in Table 7 vs a 4,800 m³/day plant
  in the text; Sifnos brackish in the table, "seawater" in Figure 7; text says 35 island
  plants, table totals 32; Nisyros 1991 plant "out of operation" (c. 2008) but EMODnet
  lists 1990 and 1991 Nisyros plants as presumed online; "geothermal MED on Milos" may be
  Kimolos's plant.
- ERA5 is ~14% wetter than the stations in Chios town (664 vs 582 mm/yr, 2013–2019).
  Before the simulation goes on the page, compare ERA5 with NOA stations on Sifnos and
  Chios (T1.1) and decide: correct the bias, or show both as a range.
- Leads from KAKOULAS22: Sazakli 2007 (rainwater quality, Kefalonia), Koumoura 2018
  (uncertainty in sizing tanks on an isolated island), Yannopoulos 2017 (history of rain
  harvesting in Greece), Koutrou 2021 (Chios citizens' attitudes to water).
- BERTSIOU23: fill the exact thesis title and handle URL in `data/sources.csv`.
- University of the Aegean cost study (57 units, 39 islands): still not found. Leads: the
  Aegean sustainable tourism observatory and the Atlas of the Islands. Hellanicus and
  didaktorika.gr cannot be searched by script (bot check; robots.txt): search them by hand
  in a browser, or ask the library or the lab for the study.
- Earlier plan, now done: metadata-only pull from the Diavgeia API (see Done). Other sources found (to open): TED tender notices (Tinos 2026,
  5 RO units, 4,500 m³/day), Greece 2.0 inclusion decisions, ministerial answers in
  parliament, press lists. Press figures to verify, not yet facts: 25 island desal
  licences in 2024; 35 new units on 27+ islands approved by Aug 2025; 103 projects in
  61 island municipalities (€9.07m); €75.5m for 42 projects incl. first units on
  Andros and Kea.
- Desal records to verify: the Symi record named for Mykonos's water utility; "Ro,
  Megistis island" (Ro islet or Megisti?); "Koufonisi" assumed Cycladic; Sifnos has four
  EMODnet records against three units in ETHNOS24 (two 500 m³/day seawater plants from
  2008 may be one); 12 identical record pairs flagged `possible_duplicate_of`.
- Antiparos: its main village has no OSM place node inside the island outline; it sits at
  the box centre. Find the node and add it as `village_osm_id` in `data/island_rules.csv`.
- Tidy the data (see Questions): island names, status values, `residents` as numbers only.
- Page: Simulate is built (see Done). Still template text: the lede (the sketch's question),
  Event, Situate and Narrate in `index.html`, and the README's first sentence, Event,
  Situate and Narrate. Before any push to `main`, decide on `Publish: no` (Questions).
- Simulate, later: let the reader pick another island (page data is Sifnos only; run
  `build_page_data.py` per island); show drinking use only with a treatment note.

## Decisions

- 2026-11-23: sketch 33 is Island Water. An earlier untracked template folder,
  `33-aegean-weather-knowledge-and-landscape-research` (made 2026-11-09, never committed),
  was deleted and the sketch was made again with `new-sketch.mjs`. Its draft question, kept
  for reference: "How is weather known in the Aegean, and how is that knowledge written
  into its landscape?"
- 2026-11-23: the kit's `scripts/` folder became `tools/`, following CONTRIBUTING.md and
  to avoid confusion with the repository's root `scripts/`. The kit's README is now
  `docs/kit.md`.
- 2026-11-23: `private/` and `data/raw/*` are git-ignored by the sketch's `.gitignore`.
- 2026-11-23: scope agreed (`docs/scope.md`). The kit's 27 islands were chosen by press
  coverage, not a rule. Base layer is now every inhabited Greek Aegean island (2021
  census); Crete, Evia, Saronic islands and Kythera are context only; Turkish islands
  out. Present day 1991–2026; traditional systems from living memory, c. 1950 on.
- 2026-11-23: borderline calls kept: Ammouliani base (North Aegean), Palaio Trikeri base
  (Sporades), Makronisos base (Cyclades), Elafonisos context (with Kythera).
- 2026-11-23: base islands with fewer than 10 residents (22) are drawn as dots, not
  cisterns (`map_symbol` in `islands.csv` and `islands_geo.csv`).
- 2026-11-23: each island is placed at its main village, defined as its most populous
  settlement in the 2021 census (so Santorini is at Emporio, not Fira). Islands with no
  village point in OSM keep the bounding-box centre, flagged in `notes`.
- 2026-11-23: design changes after KAKOULAS22 and the desal timeline, all adopted
  (`docs/design.md`):
  - Simulate:
    - The tank-size curve with cost leads.
    - One year of tank level at a time.
    - A house beside a public roof.
    - "More cisterns" expressed as a reservoir.
    - Non-drinking use by default.
    - ERA5 rain shown as a range until checked against stations.
  - Glyph: drinking vs non-drinking, plus a bottled-water band.
  - Situate:
    - An existing-storage layer.
    - One €/m³ scale.
    - Desalination strips per island.

## Questions

- Evidence kinds: the kit uses documented, reported, reanalysed, calculated, synthetic,
  cartographic, interpretive, not known. AGENTS.md asks for observed, reanalysed, modelled,
  synthetic, cartographic, interpretive. Map one onto the other in Sources and limits?
- `data/datasets.csv` status values (reference, compile, live layer, request, search,
  check online…) don't match the list in CLAUDE.md (to pull, pulled, checked, rejected,
  ask, locate). Which list should win?
- `data/datasets.csv` has no licence column; licences are partly in `access`.
- Island names: `islands_geo.csv` has Tinos, Kythera and Koufonisia, while `islands.csv` has
  "Koufonisia and Small Cyclades" and no Tinos or Kythera.
- Should the sketch carry `Publish: no` until the page has real content?
- Futures horizon: 2050 proposed in `docs/scope.md`, not yet agreed.
- Donousa: the census settlement "Δονούσα" is taken to be Stavros, the main village. Verify.
- Keep a copy of ELSTAT's re-use approval in `private/` (it is recorded as "approved by
  ELSTAT, per author, 2026-11-23" in `datasets.csv` and the manifest).
- ELSTAT's "Aegean islands - Crete" booklet (31 MB PDF) not downloaded; fetch with
  `tools/fetch_census.py --booklet` if wanted.

## Done

- 2026-11-23: T2.3 Simulate section built in `index.html` (`sim-core.js` model, `sim.js`
  views, styles in the page head; black and white, light and dark, phone width checked).
  Four views per `docs/design.md`:
  - the tank-size curve with the cost of a house system in its own panel below;
  - one water year of daily rain and tank level, with the days the tank fell short;
  - a house beside a school roof;
  - many houses' cisterns as reservoir volume and days of desalination capacity.
  Every result is a range, ERA5 as it is and ERA5 −12% (the Chios station check). Each
  chart has a crosshair readout, and the tank-size chart has a table of its numbers.
  Default (100 m² roof, 10 m³ tank, 3 people, 150 L a day for toilets and garden): rain
  covers 45–50% over 1991–2026, and 33% in the worst year, 2000–01. On Sifnos the school
  roof covers less (39–43%) than on Chios (~60%), because Sifnos is much drier.
  `tools/build_page_data.py` writes `data/page/` (56 KB). `node tools/check_page_sim.mjs`
  confirms the page model matches `simulate_cistern.py`; that script gained `--no-write`.
  Sources and limits filled in on the page and in the README.

- 2026-11-23: desal plants reconciled for 13 islands (all with EMODnet, literature and
  Diavgeia except Crete). `data/desal_reconciled.csv` (64 rows) groups the records into
  plants, each marked likely / possible / one source only, with the reason; groupings are
  interpretive. `tools/check_desal_reconciled.py` confirms every EMODnet record, literature
  plant and permit ID on those islands is used exactly once, and writes
  `desal_reconciled_by_island.csv`. Operating capacity, EMODnet raw (2020) → reconciled:
  56,660 → 53,330 m³/day overall (−6%), but the island-level changes are larger:
  - Mykonos −4,500: a 2008 plant entered twice.
  - Chios −1,000: a 2010 plant entered twice.
  - Nisyros −550: the 1990–91 plant closed, and it was entered twice.
  - Sifnos −500: down to three plants, as ETHNOS24 reports.
  - Milos +2,160: Water 2014's 3,360 m³/day wind-powered plant is missing from EMODnet.
  - Tinos +500 and Santorini +220: plants listed in Water 2014 only.
  One EMODnet "duplicate" was real: Syros 2002 had two 500 m³/day plants (Ano Syros 5th
  and Poseidonia 1st). Permit-only capacity (permitted, no plant by 2020): Paros 3,100,
  Leros 2,600, Tinos 2,000, Kimolos 600, Fournoi 350.

- 2026-11-23: T1.1 rain fetch complete. `fetch_rain.py --missing-only` fetched the last
  51 islands (a few HTTP 429s, all recovered by the retry). All 105 islands have
  1991-01-01 to 2026-10-31, 13,088 days each, none missing. Across the 66 base-island
  cells (one value per cell), Oct–Mar rain as a median share of the 1991–2020 normal:
  driest winters 1999–00 (63%), 2006–07 (65%), 2000–01 (66%), 2015–16 (67%), 2022–23
  (68%). 2022–23, 2023–24 and 2024–25 (68%, 78%, 82%) are the only three winters in a
  row all below 85% since 1991; their mean (76%) is the lowest of any three-winter run.
  Dry in every group, not only the Cyclades. 2025–26 recovered (111%). Reanalysed, not
  observed.

- 2026-11-23: personal names removed from the committed permits table (kit rule 5).
  Titles named people (an official's travel claim, private holders, plots called after
  their owners), and redacting names inside titles is unreliable, so
  `tools/parse_diavgeia_permits.py` now writes two files:
  - `data/derived/desal_permits_diavgeia.csv` (committed): 409 decisions, with the
    `subject` column and the 59 payment/consultancy rows removed. A new `holder_type`
    column (municipal / public 246, company 31, hotel 16, not known 116) keeps the
    public/private distinction without names.
  - `data/raw/diavgeia/permits_parsed_full.csv` (git-ignored): all 468 decisions with
    their full titles.
  The ADA and URL still lead to each public decision. The timeline was rebuilt; its
  figures are unchanged.

- 2026-11-23: read KAKOULAS22 in full (Chios rain tanks; CC BY 4.0; PDF supplied by the
  author). Its Table 5 and 6 results are in `data/rwh_reference_kakoulas22.csv` (60 cases;
  totals cross-checked). `tools/simulate_cistern.py` gained `--rule ybs` (the paper's
  use-before-overflow order) and `--first-flush`; the default is unchanged. Fetched ERA5
  rain for Chios alone (`fetch_rain.py --island Chios`; 54 of 105 islands now).
  `tools/check_cistern_reference.py` reruns the paper's 54 household cases with ERA5:
  every case within 1.5–6.9 points (mean 3.3), all higher, which matches ERA5 being
  ~14% wetter. Use-before-overflow vs overflow-before-use changes results by <1 point.
  Facts added to `desalination_facts.csv`, Chios tariff and intermittent supply to
  `islands.csv`, Chios household tanks to `traditional_systems.csv`.

- 2026-11-23: desal timeline. Read HELLEXP14 (Water 2014, CC BY 3.0) in full and the
  BERTSIOU23 thesis (Fournoi). Hand-entered `data/desal_literature.csv` (39 rows: Table 7's
  32 RO plants with year, capacity, capital and operating cost, status c. 2008; five
  renewable-powered plants; Fournoi–Chrysomilia 100 m³/day from 2008 and Thymaina RO 2009).
  `tools/build_desal_timeline.py` merges it with EMODnet and Diavgeia →
  `data/derived/desal_timeline.csv` (516 events on three tracks: operating, historic,
  permitted; never summed together), `desal_history_by_island.csv` (59 islands: first
  known plant, capacity per source, permits) and `desal_by_year.csv`. Earliest island plant:
  Syros MSF 1970 (EMODnet, presumed offline). Base islands: 94,400 m³/day still listed by
  EMODnet in 2020 (all uses, by year online); temporary permits 2024: 15 (8,350 m³/day),
  2025: 12 (7,000), 2026: 2 (1,200). Islands with permits but no listed plant: Andros,
  Serifos, Donousa, Lipsi, Pserimos, Telendos, Arkoi, Ikaria, Oinousses, Psara, Skiathos,
  Alonnisos, Kythera, Antikythera, Poros (15). Fournoi facts added to `islands.csv`, `traditional_systems.csv` and
  `desalination_facts.csv` (national 2011 inventory, 2012 operating costs, shipping cost).

- 2026-11-23: Diavgeia permit metadata, 2010-10 to 2026-11 (Diavgeia starts Oct 2010):
  66 API requests, 468 permit-type decisions (titles only; `tools/fetch_diavgeia_permits.py`,
  raw in `data/raw/diavgeia/`). Also counts all desalination decisions per half-year
  (`window_counts.csv`: ~300/yr in 2011 to 2,000–2,400/yr since 2018).
  `tools/parse_diavgeia_permits.py` → `data/derived/desal_permits_diavgeia.csv`: kind,
  capacity and units read from the title (114 and 101 decisions), island matched with
  Greek case endings (312 base, 91 context, 38 outside, 27 not known). New fast-track
  temporary permits (Ministry of Maritime Affairs): 2024: 22 (12,850 m³/day), 2025: 16
  (9,600), 2026 to Nov: 4 (3,200); 33 islands. Rows mean "permitted", not "operating".
- 2026-11-23: University of the Aegean search. The PhD found (didaktorika 10442/50990,
  Stathi 2022) is from Aristotle University of Thessaloniki, not Aegean: Mykonos, Naxos,
  Kos water balance and SPI drought; full text needs registration, copyright. The
  llid.aegean.gr deck (Spilanis, 2025-09-30) is a GReco Islands overview with no desal data.

- 2026-11-23: EMODnet desalination, full pull: 415 Greek records (one WFS request,
  `tools/fetch_emodnet_desal.py`, logged). `tools/match_desal.py` applies
  `data/desal_place_rules.csv`: 217 placed by municipality, 144 by project/location text,
  54 with no usable location. Result: 151 records on base islands, 89 on context islands
  (Crete 71), 118 outside scope, 57 not known. 42 islands have at least one record.
  Outputs: `data/derived/desal_plants_greece.csv` (one row per record; point =
  municipality centroid only where real, otherwise blank) and `desal_by_island.csv`
  (records, online capacity, municipal capacity, seawater, years, possible duplicates).
  Sifnos: 4 municipal plants, 2,000 m³/day online in 2020 (brackish 750; seawater 500,
  500, 250), online 2001–2008.

- 2026-11-23: T1.2 started. EMODnet Human Activities WFS has `emodnet:desalination`
  (Cogea Srl from GWI DesalData; CC BY 4.0; created 2021, metadata updated 2025-08-29).
  3,911 plants in Europe, 415 in Greece. 10-plant sample saved to
  `data/raw/emodnet_desal/` and logged. Findings: points are municipality centroids, not
  plant sites; 128 of 415 Greek plants sit at the Athens centroid (location unknown,
  project names like "Corfu", "Greece", "Aegean Water Kiosks"); records last updated in
  2020, so the 2021–2026 fast-track plants are missing; mixes municipal (152), tourist and
  industrial plants. Useful fields: capacity m³/day, units, technology, feedwater, award
  and online year, status, customer type, owner.

- 2026-11-23: T1.1 test, Sifnos. `tools/fetch_rain.py` fixed before use: explicit
  `models=era5` (the default blends other models), missing days counted not zeroed,
  per-island update of shared files, grid cell recorded in `rain_cells.csv`, end date =
  latest full month, Python 3.9-safe. Result: 13,088 days (1991-01-01 to 2026-10-31), none
  missing; ERA5 cell 37.00 N, 24.75 E, 3.7 km from Apollonia. Reanalysed, not observed:
  mean 371 mm/yr (1991–2020); Oct–Mar normal 334 mm; winters 2022–23, 2023–24, 2024–25
  at 66%, 74%, 86% of normal; 2025–26 at 93%. Driest winter 2000–01 (197 mm), wettest
  2002–03 (610 mm).

- 2026-11-23: T0.3 done. Main villages: one Overpass request for place nodes inside the
  105 island outlines (4,577 nodes; `tools/fetch_osm_villages.py`, logged).
  `tools/locate_villages.py` matched 73 islands to their main village (four pinned by hand
  in `island_rules.csv`: Amorgos, Kimolos, Donousa, Evia); 31 islets and Antiparos keep
  the box centre. `data/islands_geo.csv` regenerated (105 islands: 66 cistern, 22 dot,
  17 context). `data/islands.csv` extended to 105 rows with census residents; every kit
  fact kept (checked field by field); renamed Santorini, Kastellorizo and "Koufonisia and
  Small Cyclades" (now Ano Koufonisi, with a note). Kit originals saved outside the repo
  before overwriting. Pipeline: fetch_census → build_islands → fetch_osm_islands →
  match_islands → fetch_osm_villages → locate_villages.

- 2026-11-23: island coordinates from OpenStreetMap. One Overpass request (named
  place=island|islet in the Aegean box plus a small box for Kastellorizo; 1,232
  features; `tools/fetch_osm_islands.py`, raw JSON git-ignored, logged in the manifest).
  `tools/match_islands.py` matched all 105 census islands → `data/derived/islands_geo_osm.csv`,
  recording how each was matched. Name aliases and one forced match (Koufonisi, Crete)
  are in `data/island_rules.csv`. Checked by hand: islet distances to parents, sizes,
  and the kit's 27 approximate points (all within 0.2–9 km). ELSTAT licence recorded.

- 2026-11-23: downloaded the ELSTAT 2021 census tables by settlement and by community
  (`tools/fetch_census.py`, logged in `data/manifest.json`; files in git-ignored
  `data/raw/`). Built `data/derived/islands_census_2021.csv` with `tools/build_islands.py`
  from the rules in `data/island_rules.csv`: 88 inhabited base islands (555,531
  residents) and 17 context islands. Islets come from the census "(νησίς)" tag; Therasia
  and Thymaina added by hand; Anthidona, Avlida and Troizinia-Methana excluded as
  mainland; six Ionian and Gulf of Corinth islets excluded. Corrections to the kit:
  Sifnos 2,777 (kit had preliminary 2,755), Astypalaia 1,371 (kit had 1,400).

- 2026-11-23: started from the template; moved the Island Water research kit in;
  `tools/check_data.py`, `check-sketches.mjs` and `check-sizes.mjs` pass.
