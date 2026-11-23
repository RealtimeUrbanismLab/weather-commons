# 33 · Island Water

Author: Jacob Moe · Started: 2026-11-23 · Status: sketch · Stack: static HTML + JS

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

The page has three tabs, each with its own address (`#mapping`, `#sifnos`, `#storing`, in that order; the older `#aegean` and `#cisterns` still open them;
`tabs.js`). Its one colour, a water blue, is used only for water: rain, tank water, springs,
cisterns and flow lines. This departs from the shared black-and-white look (CONTRIBUTING §9);
the author chose it on 2026-11-23, while the sketch is `Publish: no`.

## The Sifnos case (`#sifnos`)

Sifnos, summer 2024. In June a desalination unit at Platys Gialos broke down; some
settlements were without water for 10–15 days, and at some points June use was up to twice
the previous August's (reported, Ethnos). On 20 June 2024, at the municipality's request,
the General Secretariat for Civil Protection declared a one-month water emergency, extended
on 22 July to 22 August; Serifos had been under one since 30 April (documented, Diavgeia). It
followed two dry winters: 66% and 74% of the 1991–2020 October–March average (reanalysed,
ERA5).

The tab shows:

- a topographic map of Sifnos (Copernicus DEM GLO-30: contours, relief shading, flow lines
  computed from the terrain), with villages, the desalination units and the Poulati valley;
- October–March rain for every winter since 1991–92;
- a timeline of the five main events, 2021–2026 (the full record is `data/sifnos_timeline.csv`);
- Poulati, from Zepou & Matsaganis (2024) and DECA: a long profile of the valley with its
  nine springs in order of altitude and five communal cisterns (spacing schematic), the week
  as fourteen twelve-hour "waters" with the rights the chapter describes, and the 34
  properties (`data/poulati.csv`, `data/poulati_springs.csv`).

Page data: `sifnos_topo.json` and `sifnos_hillshade.png` (`tools/fetch_dem_sifnos.py`,
`tools/build_sifnos_topo.py`), `poulati.json`, `event_winters.json`; drawn by `event.js` and
`poulati.js`.

## Storing (`#storing`)

A rooftop cistern on Sifnos, run day by day on the rain that fell there from 1991-01-01 to
2026-10-31. Each day the tank fills with roof area × runoff (0.8) × rain, spills what does
not fit, then gives the household its daily use until it is empty. The reader sets the roof,
tank, household and use (toilets and garden, or everything). The tab shows the share of use
met by tank size (1–40 m³) with the cost of a house system; one water year of daily rain and
tank level; and many houses' cisterns as reservoir volume and days of desalination capacity.

Every result is a range: ERA5 rain as it is, and ERA5 reduced by 12%, the amount it
overstates station rain on Chios. The model (`sim-core.js`) gives the same results as
`tools/simulate_cistern.py` (checked by `node tools/check_page_sim.mjs`). With the
paper's settings and ERA5 rain it reproduces the 54 house cases of Kakoulas et al. (2022)
within 1.5–6.9 points (`tools/check_cistern_reference.py`).

## Mapping (`#mapping`)

105 Aegean islands. In October–March 2022–23 all 105 had less rain than their 1991–2020
average and 28 had a drier winter than Sifnos, relative to their own average (reanalysed,
ERA5). In 2024 Civil Protection declared water emergencies in 33 municipalities across
Greece, on eight of the sketch's islands: Serifos (from 30 April), Spetses, Poros, Sifnos,
Leros, Crete (eight municipalities), northern Evia and Andros; Lesvos and Chios followed in
2025 (documented, full-text search of Diavgeia, `data/civil_protection_water.csv`). Leros,
Patmos and Astypalaia in 2025–26: reported. Three views:

- an interactive satellite map with controls to compare the islands (Leaflet on Sentinel-2
  cloudless 2024, EOX, CC BY-NC-SA 4.0): choose a measure (winter rain, desalination per resident,
  rain on roofs), play or scrub through the winters, filter by group, residents, emergency and
  desalination; a ranked list and a card for the selected island sit beside the map;
  a "Reset view" button returns to all islands;
- a scatter plot under the map: any two of winter rain, desalination per resident, rain on roofs
  and residents, for the islands the filters keep, linked to the map, list and card;
  each island a small tank filled with one winter's rain as a share of its average, or with
  desalination capacity per 2021 resident; zoomed in, every building footprint on 85 islands
  (613,641 Microsoft ML footprints, ODbL) as a possible cistern, each island's file loaded when
  it comes into view (`tools/fetch_ms_buildings.py`, `tools/build_roofs_islands.py`,
  `tools/build_roofs.py`, `aegean-map.js`);
- every roof a cistern?: the rain on each island's roofs in an average and in its driest water
  year, against what its 2021 residents would use at 150 litres a day (upper bound; visitors not
  counted; `roofs.js`);
- desalination over time: capacity still listed in 2020 by year online (a survivor count,
  94,400 m³/day on the base islands), and one strip of records per island, 1970–2026,
  with the 29 temporary permits of 2024–26 (16,550 m³/day) shown apart;
- one €/m³ scale for eight reported costs (`data/water_costs.csv`).

Page data: `situate_islands.json`, `situate_desal.json`, `situate_costs.json`; drawn by
`situate.js`. All page data: `python -I tools/build_page_data.py`.

## Sources and limits

For every dataset: who made it, which version and date, when you downloaded it, its licence, and what you changed. Say whether each layer is observed, reanalysed, modelled, synthetic or interpretive. Then say what this sketch cannot show.

- Daily rain, Sifnos and 104 other islands, 1991-01-01 to 2026-10-31: reanalysed. ERA5
  (Copernicus Climate Change Service, ECMWF) via the Open-Meteo historical weather API
  (`models=era5`), downloaded 2026-11-23, CC BY 4.0. Rounded to 0.1 mm for the page.
  Sifnos grid cell 37.00 N, 24.75 E, 3.7 km from Apollonia. Not a rain gauge.
- ERA5 adjustment (−12%): calculated from Chios station rain 2013–2019 in Kakoulas,
  Golfinopoulos, Koumparou & Alexakis, *Water* 14 (2022) 716 (CC BY 4.0), against ERA5 for
  the same years. Measured on Chios only.
- House system costs: reported, same study (Chios, 2022).
- Roof, tank, household and use: synthetic, set by the reader.
- Sifnos desalination capacity (2,250 m³/day since 2021): documented; EMODnet Human Activities
  desalination plants (CC BY 4.0, records to 2020), Zotalis et al., *Water* 6 (2014) 1134
  (CC BY 3.0), Diavgeia decisions of the Municipality of Sifnos (public, Law 4210/2013) and
  press reports, reconciled in `data/desal_reconciled.csv`.
- Residents: observed, ELSTAT 2021 census (re-use approved by ELSTAT).
- Full list of datasets, licences and downloads: `data/datasets.csv`, `data/sources.csv`,
  `data/manifest.json`.

- Poulati: reported. Zepou & Matsaganis, in Curci & Chiffi (eds), *Fragility and
  Antifragility in Cities and Regions*, Edward Elgar 2024, pp. 213–228 (CC BY-NC-ND 4.0;
  facts only, figures not reproduced, landowners' names left out); DECA Architecture,
  "Learning from Poulati" (2022). Spring spacing on the profile: schematic.
- Terrain: Copernicus DEM GLO-30 (© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH
  2014–2018, provided under COPERNICUS by the EU and ESA), read 2026-11-23 by range
  requests; flow lines and the valley line computed from it (calculated). Villages and the
  monastery: OSM (ODbL).
- Aegean water map: island positions (cartographic, OpenStreetMap, ODbL); land (cartographic,
  Natural Earth 1:10m v5.1.1, public domain, plus OSM outlines for 30 small islands, ODbL); water emergencies
  (documented for 2024–2025 from Civil Protection decisions on Diavgeia, reported for
  2025–26 elsewhere, `data/emergencies.csv`); costs (reported,
  `data/water_costs.csv`); Sifnos visitors and electricity (reported, The Press Project 2025).

The sketch cannot show water quality, leaks, evaporation from open cisterns, or how people
change their use in a dry year. One ERA5 cell stands for all of Sifnos, and ERA5 has not yet
been checked against a Sifnos station. Coastlines are simplified to about 600 m, and an island
with no plant listed may still have one.
