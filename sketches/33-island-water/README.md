# 33 · Island Water

Author: Jacob Moe · Started: 2026-11-23 · Status: sketch · Stack: static HTML + JS

One or two sentences: what this sketch shows and the question it asks. The first sentence appears on the shared site.

## Run

Online, once published: `https://<github-username>.github.io/weather-commons/33-island-water/`

On your computer:

```bash
cd sketches/33-island-water
python -m http.server 8000
```

Then open http://localhost:8000.

## 1. Event

Which weather event, practice or intervention is this about? When and where did it happen, and who was involved?

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

Where does it sit in the world: places, infrastructure, institutions, history, politics?

## 4. Narrate

The story in a few sentences. What can a viewer learn here, and what should they not conclude?

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
- Sifnos desalination capacity (1,500 m³/day): documented; EMODnet Human Activities
  desalination plants (CC BY 4.0, records to 2020), Zotalis et al., *Water* 6 (2014) 1134
  (CC BY 3.0) and press reports, reconciled in `data/desal_reconciled.csv`.
- Residents: observed, ELSTAT 2021 census (re-use approved by ELSTAT).
- Full list of datasets, licences and downloads: `data/datasets.csv`, `data/sources.csv`,
  `data/manifest.json`.

The sketch cannot show water quality, leaks, evaporation from open cisterns, or how people
change their use in a dry year. One ERA5 cell stands for all of Sifnos, and ERA5 has not yet
been checked against a Sifnos station.
