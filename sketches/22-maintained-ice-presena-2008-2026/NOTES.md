# Notes · 22 · Maintained Ice

Read this before working on the sketch. Newest first.

## Next (before session 2, 9 November)

- [ ] Post the research question and five sources in the community space.
- [ ] Ask a facilitator: rename folder `22-otherweather` → `22-presena-glacier-covers` before the first pull request to the shared repository? Is linking to my own site from Sources and limits fine?
- [x] Visibility test (2026-11-04, script v2.7): the cover IS visible and spectrally distinct at 10–20 m (bright in visible and SWIR; ice is dark in SWIR). Reference scene 2021-08-14.
- [ ] Validate the yearly areas (fix rock/shadow classes, add skirun polygon, check 2024 and 2026 by eye). Until then, the page says: measurement in progress, not validated.
- [ ] Run `tools/fetch_meteotrentino_stations.py`; choose the station(s) for one summer; find the historical download.
- [ ] Read Senese et al. 2020 and AINEVA 74/80; replace the albedo placeholders in `data/parameters.json`.
- [ ] Verify the Pellicciotti et al. 2005 factors against the paper.
- [x] Archive the cited sources with ArchiveBox (2026-11-04). Redo by hand: operator page (captured as 404), MEMOTEF link (404). Add archived links to Sources and limits.

## Decisions

- 2026-11-09 · index.html is the overview from the template; explore.html is the prototype explorable view. Folder renamed from 22-otherweather.
- 2026-11-04 · Two tracks: this sketch follows the workshop's format; the full investigation lives on my own site. Results move here only when small, checked and peer-reviewed.
- 2026-11-04 · Evidence labels follow sketch 03: Documented, Reported, Observed, Reanalysed, Calculated, Synthetic, Cartographic, Interpretive, Not known.
- 2026-11-04 · Melt rule: enhanced temperature-index (temperature + albedo-weighted sunlight), because albedo is the main thing a cover changes and station data rarely include a full energy balance.
- 2026-11-04 · The seasons control keeps a fixed patch and a repeated summer, labelled synthetic: it shows the size of the effect, not its history.

## Open questions

- Operator page (read 2026-11-04) gives covered fabric area per year: 40,000 m² (2014) to 110,000 m² (2020–2021). AINEVA gives 76,400 m² in 2010. Different definitions, or a real change? Sentinel-2 can test 2016–2021.
- Operator attributes to the University of Milan an absorbed solar energy of 36% (covered) vs 57% (uncovered), i.e. albedo ~0.64 vs ~0.43. Candidate values for `data/parameters.json` once confirmed in Senese et al. 2020 / AINEVA 74.
- Snow is laid on the glacier every winter and the covered mass is kept with snowmaking (operator, citing a 2021 MUSE study). Mention in Situate; find the MUSE study.

- Which Meteotrentino station near Presena measures shortwave radiation? Candidates: Cima Presena (about 3,015 m, cited in Meteotrentino press releases), Passo Tonale (about 1,880 m).
- Which Natura 2000 site contains the patch? Candidate: IT3120158 Adamello Presanella.
- Is the cover visible in Sentinel-2 at 10 m?

## Done

- 2026-11-04 · ArchiveBox set up; nine sources archived. Operator page read in full: eight new claims logged in the Track B claims register.

- 2026-11-02 · First page live in my own copy: https://lucalonga.github.io/weather-commons/22-otherweather/
- 2026-11-04 · Prototype page with synthetic inputs; data catalog of 60 sources.
