# 22 · Do glaciers breathe?

Author: Luca · Started: 2026-11-02 · Status: v0.3 · Stack: static HTML + JS (SVG), no build step

Maintained ice, Presena 2008–2026. Since 2008 part of the Presena glacier has been covered with white fleece every summer; this sketch shows, summer by summer, what is documented, claimed, reported, observed, calculated and not known about the covers, and who maintains the glacier.

## Event

The Presena glacier (Vermiglio, Trentino) above Passo del Tonale. Summer covers since 2008; an instrumented season in 2010 (76,400 m², about 52% less ablation) and a materials test in 2012 (up to 69% less melt). The operator states costs of up to €350,000 a year, partly paid by the Province of Trento.

## Simulate

An enhanced temperature-index melt model on three surfaces (bare ice, fleece, snow), one summer, daily steps. One experiment: change the fleece albedo and the number of seasons, and compare with the 52–69% field band. Prototype inputs are synthetic and labelled.

## Situate

Five places: the covered patch; Passo del Tonale and Ponte di Legno (operator); Trento (Province); the Noce and the Adige (meltwater); Diavolezza and Morteratsch (comparison).

## Narrate

To come: one scene at the removal of the sheets in September, and a table of kinds.

## Run

Open `index.html` through a local server (the page loads `data/parameters.json`):

```bash
python -m http.server 8090
# then open http://localhost:8090/
```

## Files

| File | What it is |
| --- | --- |
| `index.html` | the overview: Event, Simulate, Situate, Narrate, Sources and limits |
| `explore.html` | prototype, v0: the explorable view of the evidence (stack of summers, claims ledger, melt model) |
| `data/years.json` | one record per summer: documented, claimed and calculated areas, events, pending tests |
| `data/claims.json` | statements by others, with status (supported, published, pending, tension, unverifiable) |
| `data/assertions.json` | what the sketch itself asserts, with confidence and limits |
| `views.js`, `views.css` | the shared views of both pages: eleven breaths, area chart, melt model, actors, claims ledger, evidence stack |
| `data/area_s2.json`, `data/observations_s2.json`, `data/outlines_s2.geojson`, `data/skirun_zone.geojson`, `data/qa.csv` | Sentinel-2 results v3.6 (calculated, preliminary) and the visual check |
| `data/actors.json` | who maintains the glacier: actors and links, each with kind and source |
| `img/years/` | one Sentinel-2 image per summer 2016–2026: natural colour, SWIR, fleece fraction |
| `data/weather_summer_2021.json` | optional: reanalysed weather from `tools/fetch_open_meteo.py` |
| `data/parameters.json` | model parameters, each with source and status |
| `data/DATA_CATALOG.md`, `data/presena_data_catalog.csv` | candidate datasets, access, licences |
| `tools/gee_s2_visibility.js` | Google Earth Engine script for the Sentinel-2 visibility test |
| `tools/fetch_meteotrentino_stations.py` | lists Meteotrentino stations nearest to Presena |
| `NOTES.md` | decisions, next steps, open questions |

## Sources and limits

| Data | Maker, date | Licence | Changes | Kind |
| --- | --- | --- | --- | --- |
| Weather in the Simulate chart | ERA5 via Open-Meteo, adjusted to 2,765 m, if present; otherwise generated in the page (seed 22) | CC BY 4.0 (Open-Meteo) | daily means, MJ/m² converted to W/m² | reanalysed or synthetic |
| Satellite count v3.6 | own calculation, Sentinel-2 L1C via Earth Engine, run 2026-11-23 (snapshot f8e14116f7fcb7becc513334a3ccfc29) | CC BY 4.0 | unmixing; lowest/best/highest; visual check in qa.csv; not validated | calculated |
| Cover areas 2008–2011, glacier areas 1961–2011, governance | AINEVA, Neve e Valanghe 74 (full text) | AINEVA | none | documented |
| Material weights, Bolzano, Biennale | Betti and Fleck 2021, with materials from the operator | authors | none | reported |
| Actors and links | data/actors.json, from the sources above, 2026-11-23 | CC BY 4.0 | links without a source marked not known | documented / reported / not known |
| Albedo values | AINEVA Neve e Valanghe 74 (2010: glacier 0.43, new fleece 0.64); PhD thesis UniMi 2013 (reused fleece 0.43); snow still a placeholder | publisher | none | documented (snow: synthetic) |
| Melt rule and factors | Pellicciotti et al. 2005 | journal | values to verify | modelled (rule) |
| 2010 cover area and ablation | AINEVA, Neve e Valanghe 74 | AINEVA | none | observed (field) |
| Covered area 2014–2021, sheet size, snow laid each winter | Consorzio Pontedilegno–Tonale, read 2026-11-04 | all rights reserved | none | operator's claim |
| 2012 melt reduction | Senese et al. 2020 (doi:10.1016/j.coldregions.2020.103007); AINEVA 80 | publisher | none | observed (field) |
| Fleece and ice reflectance, 2021-08-14 | ESA / Copernicus Sentinel-2 L1C via Earth Engine | Copernicus licence | means over hand-drawn areas | observed |
| Costs and funding | Consorzio Pontedilegno–Tonale, read 2026-11-03 | all rights reserved | none | operator's claim |

What the model calculates: seasonal melt on a patch under three surfaces. What it cannot establish: the covered area in any real year, whether covering pays, or any effect downstream.

Extended work on the same case, outside this sketch: link to come (author's own site). Its results are not part of this sketch until reviewed.
