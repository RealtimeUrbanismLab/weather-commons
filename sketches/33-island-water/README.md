# 33 · Island Water

Author: Jacob Moe · Started: 2026-11-23 · Status: sketch · Stack: static HTML + JS · Publish: no

Sifnos ran short of water in June 2024, after two winters of 66% and 74% of its usual rain
and the breakdown of a desalination unit; this sketch sets that summer against daily rain
since 1991, a rooftop cistern model, and 105 other Aegean islands. It asks where an island's
water comes from, who decides, and what a fairer and less fragile water future could look like.

## Run

Online, once published: `https://<github-username>.github.io/weather-commons/33-island-water/`

On your computer:

```bash
cd sketches/33-island-water
python -m http.server 8000
```

Then open http://localhost:8000.

## 1. Event

Sifnos, summer 2024. In June a desalination unit at Platys Gialos broke down; some
settlements were without water for 10–15 days, and at some points June use was up to twice
the previous August's (reported, Ethnos). On 20 June 2024, at the municipality's request,
the General Secretariat for Civil Protection declared a one-month water emergency, the first
on a Cycladic island, extended on 22 July to 22 August (documented, Diavgeia). It followed
two dry winters: 66% and 74% of the 1991–2020 October–March average (reanalysed, ERA5).

The page sets this in 2021–2026: drought restrictions in 2021, tanker trucks every summer,
a 1,000 m³/day portable unit in 2021, pool licensing in 2024, restrictions with fines in
2026, and a new solar-assisted unit whose tender was cancelled in November 2026. The
counterpoint is Poulati, a valley a few kilometres away that still shares nine springs in
twelve-hour turns (reported, Zepou & Matsaganis 2024). Timeline with sources:
`data/sifnos_timeline.csv`; notes: `docs/sifnos.md`.

## 2. Simulate

A rooftop cistern on Sifnos, run day by day on the rain that fell there from 1991-01-01 to
2026-10-31. Each day the tank fills with roof area × runoff (0.8) × rain, spills what does
not fit, then gives the household its daily use until it is empty. The reader sets the roof,
tank, household and use (toilets and garden, or everything). The page shows:

- the share of use met by tank size (1–40 m³), with the cost of a house system below it;
- one water year (October–September) of daily rain and tank level, with the days the tank
  could not cover;
- the same house beside a school roof (600 m², 24 m³, 100 people × 20 L on school days);
- many houses' cisterns expressed as reservoir volume and days of desalination capacity.

Every result is a range: ERA5 rain as it is, and ERA5 reduced by 12%, the amount it
overstates station rain on Chios. The model (`sim-core.js`) gives the same results as
`tools/simulate_cistern.py` (checked by `node tools/check_page_sim.mjs`). With the
paper's settings and ERA5 rain it reproduces the 54 house cases of Kakoulas et al. (2022)
within 1.5–6.9 points (`tools/check_cistern_reference.py`). Page data:
`python -I tools/build_page_data.py` writes `data/page/`.

## 3. Situate

105 Aegean islands. In October–March 2022–23 all 105 had less rain than their 1991–2020
average and 28 had a drier winter than Sifnos, relative to their own average (reanalysed,
ERA5). Water emergencies found so far: seven islands, 2024–26 (documented for Sifnos,
reported for the others). Three views:

- a map with each island drawn as a small tank at its main village (cartographic, OSM),
  over Natural Earth land with OSM outlines for 30 small islands,
  filled with one winter's rain as a share of its average, or with desalination capacity
  per 2021 resident (Sifnos 810 L a day; seven islands above 1,000);
- desalination over time: capacity still listed in 2020 by year online (a survivor count,
  94,400 m³/day on the base islands), and one strip of records per island, 1970–2026,
  with the 29 temporary permits of 2024–26 (16,550 m³/day) shown apart;
- one €/m³ scale for eight reported costs (`data/water_costs.csv`).

Page data: `situate_islands.json`, `situate_desal.json`, `situate_costs.json`, built by
`tools/build_page_data.py`; drawn by `situate.js`.

## 4. Narrate

Four paragraphs on the page: the three conditions that coincided in June 2024; the
municipality's measures 2021–2026 and the 29 temporary permits across the islands; what a
default rooftop cistern meets (45–50% of toilet and garden use, 33% in 2000–01); and
Poulati's allocation by twelve-hour weekday turns. A note lists what not to conclude:
that Sifnos was drier than the other islands, that capacity is output, that no plant listed
means none, that cistern water is drinking water, or that the costs compare one to one.

## Sources and limits

For every dataset: who made it, which version and date, when you downloaded it, its licence, and what you changed. Say whether each layer is observed, reanalysed, modelled, synthetic or interpretive. Then say what this sketch cannot show.

- Daily rain, Sifnos and 104 other islands, 1991-01-01 to 2026-10-31: reanalysed. ERA5
  (Copernicus Climate Change Service, ECMWF) via the Open-Meteo historical weather API
  (`models=era5`), downloaded 2026-11-23, CC BY 4.0. Rounded to 0.1 mm for the page.
  Sifnos grid cell 37.00 N, 24.75 E, 3.7 km from Apollonia. Not a rain gauge.
- ERA5 adjustment (−12%): calculated from Chios station rain 2013–2019 in Kakoulas,
  Golfinopoulos, Koumparou & Alexakis, *Water* 14 (2022) 716 (CC BY 4.0), against ERA5 for
  the same years. Measured on Chios only.
- House system costs and the school case: reported, same study (Chios, 2022).
- Roof, tank, household and use: synthetic, set by the reader. The school calendar is an
  approximation (weekdays; no school 15 Jun–10 Sep, 24 Dec–7 Jan, Holy Week to the Sunday
  after Orthodox Easter).
- Sifnos desalination capacity (2,250 m³/day since 2021): documented; EMODnet Human Activities
  desalination plants (CC BY 4.0, records to 2020), Zotalis et al., *Water* 6 (2014) 1134
  (CC BY 3.0), Diavgeia decisions of the Municipality of Sifnos (public, Law 4210/2013) and
  press reports, reconciled in `data/desal_reconciled.csv`.
- Residents: observed, ELSTAT 2021 census (re-use approved by ELSTAT).
- Full list of datasets, licences and downloads: `data/datasets.csv`, `data/sources.csv`,
  `data/manifest.json`.

- Situate: island positions (cartographic, OpenStreetMap, ODbL); land (cartographic,
  Natural Earth 1:10m v5.1.1, public domain, plus OSM outlines for 30 small islands, ODbL); water emergencies
  (documented for Sifnos, reported elsewhere, `data/emergencies.csv`); costs (reported,
  `data/water_costs.csv`); Sifnos visitors and electricity (reported, The Press Project 2025).

The sketch cannot show water quality, leaks, evaporation from open cisterns, or how people
change their use in a dry year. One ERA5 cell stands for all of Sifnos, and ERA5 has not yet
been checked against a Sifnos station. Coastlines are simplified to about 600 m, and an island
with no plant listed may still have one.
