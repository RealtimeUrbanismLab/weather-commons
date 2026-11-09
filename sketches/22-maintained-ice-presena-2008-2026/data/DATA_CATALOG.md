# Data catalog: Presena glacier covers

Sketch 22 · Realtime Weather · started 2026-11-03, updated 2026-11-04 · machine-readable version: `presena_data_catalog.csv` (same rows, more columns).

Each row is a source, not a download. A source enters the evidence log only when you have used it, with the exact file, date and permalink.

## How to read it

- **Access type:** api, dataset (file download), archive (search then order), permalink (stable page), basemap (map service), webcam, request (ask the holder), literature.
- **State:** raw (as the provider measured it), processed (already corrected or derived by the provider), derived (made by us, with the script in `tools/`).
- **Kind:** observed, reanalysed, simulation, cartographic, documented, model-derived, as in the workshop's vocabulary.
- **Track:** A = the shared sketch; B = the extended investigation on my site.
- **Priority:** 1 = needed before 9 November or for the core question; 3 = later or context.
- **Link status:** *seen in search* or *from v1 sketch* means the link was found, not that the data was checked; *to verify* means the endpoint, licence or coverage still needs checking at the source.

## Weather stations

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W01 | **Meteotrentino station list** (Provincia autonoma di Trento / Meteotrentino). XML. Field names partly inconsistent (UTM fields swapped, per MeteoDataTrentino R package) | current | — | api | [link](https://dati.meteotrentino.it/service.asmx/listaStazioni) | open · CC BY 4.0 (check dataset page) | observed | A+B | 1 | seen in search |
| W02 | **Meteotrentino snow fields list** (Meteotrentino). Snow depth, new snow; winter season only | current | — | api | [link](http://dati.meteotrentino.it/service.asmx/listaCampiNeve) | open · CC BY 4.0 (check) | observed | A+B | 1 | seen in search |
| W03 | **Meteotrentino recent station data** (Meteotrentino). Recent only. For past summers use the historical archive (W04) | last days only | 15 min | api | [link](https://dati.meteotrentino.it/service.asmx/ultimiDatiStazione?codice=TXXXX) | open · CC BY 4.0 (check) | observed | B | 3 | seen in search |
| W04 | **Meteotrentino historical station series** (Meteotrentino). Find the download page for historical data; identify stations near Tonale/Presena with shortwave radiation | station dependent | daily / sub-daily | dataset | [link](https://www.meteotrentino.it) | open · CC BY 4.0 (check) | observed | A+B | 1 | to verify |
| W05 | **meteo.report (Euregio)** (Euregio Tirol–Südtirol–Trentino). Tirol data reserved | current + recent | 10 min | api | [link](https://meteo.report) | open · CC BY 4.0 for Trentino and Alto Adige data | observed | B | 3 | seen in search |
| W06 | **MeteoSwiss automatic weather stations (SwissMetNet)** (MeteoSwiss via FSDI/swisstopo). Semicolon CSV, UTC, dd.mm.yyyy HH:MM. Samedan, Corvatsch for Morteratsch/Diavolezza. Download the granularity you need, don't aggregate 10-min yourself | from start of measurement | 10 min to yearly | api | [link](https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-smn) | open · Source: MeteoSwiss (opendata.swiss terms BY) | observed | B | 2 | seen in search |
| W07 | **ARPA Lombardia station data** (ARPA Lombardia / Regione Lombardia). Lombardy side of the pass; useful cross-check | station dependent | 10 min / hourly | api | [link](https://www.dati.lombardia.it) | open (check) · check | observed | B | 3 | to verify |
| W08 | **University of Milan AWS on the Presena cover (2010, 2012)** (Università degli Studi di Milano (Diolaiuti, Senese)). Best source for real albedo and radiation values on the patch | 2010, 2012 summers | sub-hourly | request | by request to authors | request · authors' terms | observed | A+B | 1 | to request |

## Reanalysis

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | **ERA5-Land hourly** (ECMWF / Copernicus Climate Change Service). Also in Google Earth Engine as ECMWF/ERA5_LAND/HOURLY. 9 km cell ≠ glacier surface: use for gaps and context, state the limit | 1950–present | ~9 km, hourly | api | [link](https://cds.climate.copernicus.eu) | registration · Copernicus licence (free, attribution) | reanalysed | A+B | 2 | to verify |

## Satellite optical

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | **Sentinel-2 L2A** (ESA / Copernicus). Also GEE: COPERNICUS/S2_SR_HARMONIZED. Visibility test, cover extent per year | 2015/2017–present | 10–20–60 m, ~5 days | api | [link](https://dataspace.copernicus.eu) | open · Copernicus licence (free, attribution) | observed | A+B | 1 | to verify |
| S02 | **Copernicus Browser** (ESA / Copernicus). Save a permalink for every scene you use, in the evidence log | 2015–present | 10 m | permalink | [link](https://browser.dataspace.copernicus.eu) | open · Copernicus licence | observed | A+B | 1 | known |
| S03 | **Copernicus High Resolution Snow & Ice** (Copernicus Land Monitoring Service). Context, not the patch itself | 2016–present | 20 m (optical), 60 m (SAR) | dataset | [link](https://cryo.land.copernicus.eu/finder/) | open · Copernicus licence | observed | B | 2 | seen earlier |
| S04 | **Landsat Collection 2 Level 2** (USGS / NASA). GEE: LANDSAT/LC08/C02/T1_L2 etc. Long view of retreat, too coarse for the cover | 1984–present | 30 m | api | [link](https://earthexplorer.usgs.gov) | registration · public domain (USGS) | observed | B | 3 | to verify |
| S05 | **Harmonized Landsat Sentinel-2 (HLS)** (NASA). Denser time series at 30 m | 2013–present | 30 m | api | [link](https://www.earthdata.nasa.gov) | registration · open | observed | B | 3 | to verify |
| S06 | **MODIS albedo MCD43A3** (NASA). Regional comparison only | 2000–present | 500 m | dataset | GEE: MODIS/061/MCD43A3 | open · open | observed | B | 3 | to verify |
| S07 | **SPOT World Heritage** (CNES / Theia). Extent 2008–2015 | 1986–2015 | 10–20 m | archive | [link](https://regards.cnes.fr/html/swh/Home-swh3.html) | registration · free, non-commercial | observed | B | 2 | seen earlier |
| S08 | **ESA SPOT 1–5 archive** (ESA). Request reviewed by ESA, about 2 days. SPOT 5 pan is the best free pre-2015 option | 1986–2015 | 2.5–20 m | archive | [link](https://earth.esa.int/eogateway/catalog/spot1-5-esa-archive) | request · free for ESA member-state users, ESA terms | observed | B | 1 | seen earlier |
| S09 | **Planet (PlanetScope, RapidEye archive)** (Planet). Check E&R eligibility. Images can't be republished, only derived results | 2009–present | 3–5 m | api | [link](https://www.planet.com) | paid / Education & Research · Planet licence, no redistribution | observed | B | 3 | to verify |
| S10 | **Google Earth Pro historical imagery** (Google and imagery providers). Use for quick checks and dating; log date and provider; don't publish screenshots | varies | sub-metre to metres | permalink | Google Earth Pro desktop | open to view · not republishable | observed | B | 2 | known |

## Elevation

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | **Trentino LiDAR 2006–2009** (Provincia autonoma di Trento). Find the Presena tile and its flight date: before summer 2008 = pre-cover baseline | 2006–2009 | ~1 m | dataset | [link](https://siat.provincia.tn.it) | open (check) · check | observed | B | 1 | to verify |
| E02 | **Trentino LiDAR PAT 2014 + 2018 flights** (Provincia autonoma di Trento). Core comparison for the plinth test | 2014 / 2018 | ~1 m | dataset | [link](https://www.provincia.tn.it/News/Approfondimenti/Rilievo-Lidar-del-territorio-della-Provincia-di-Trento) | open · check | observed | B | 1 | seen in search |
| E03 | **Trentino LiDAR tile index 2014/2018** (Provincia autonoma di Trento – Servizio Geologico). Use first to find which tiles cover Presena | 2013–2018 | — | dataset | [link](https://siatservices.provincia.tn.it/idt/vector/p_TN_9f2cc32d-1030-430d-be85-7f95c9cc24ea.zip) | open · check | cartographic | B | 1 | seen in search |
| E04 | **TanDEM-X 90 m DEM** (DLR). Too coarse for the patch; context | 2011–2015 | 90 m | dataset | [link](https://geoservice.dlr.de/web/dataguide/tdm90/) | registration · free for science | observed | B | 3 | to verify |
| E05 | **TanDEM-X 30 m Edited DEM and DEM Change Maps** (DLR). About 85 pixels on the 2010 patch | 2011–2015 / 2016+ | 30 m | dataset | [link](https://geoservice.dlr.de/web/dataguide/tdm30/) | registration · free for scientific non-commercial use | observed | B | 2 | seen in search |
| E06 | **TanDEM-X 12 m DEM** (DLR). Slow; later phase | 2011–2015 | 12 m | dataset | science proposal to DLR | proposal · DLR science licence | observed | B | 3 | seen in search |
| E07 | **Copernicus DEM GLO-30** (ESA / Airbus (from TanDEM-X)). Base terrain for maps and monoplotting | 2011–2015 | 30 m | dataset | GEE: COPERNICUS/DEM/GLO30 | open · Copernicus DEM licence | observed | A+B | 2 | to verify |
| E08 | **SRTM** (NASA / USGS). Pre-cover reference; C-band penetrates snow and firn | 2000 | 30 m | dataset | GEE: USGS/SRTMGL1_003 | open · public domain | observed | B | 3 | to verify |
| E09 | **swissALTI3D / swissSURFACE3D** (swisstopo). Diavolezza comparison | recent epochs | 0.5–2 m | api | [link](https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d) | open · swisstopo OGD (attribution) | observed | B | 3 | to verify |
| E12 | **ICESat-2 ATL06** (NASA / NSIDC). Check whether a track crosses Presena | 2018–present | ~20 m along track | dataset | [link](https://nsidc.org/data/atl06) | registration (Earthdata) · open | observed | B | 3 | to verify |

## Radar

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E10 | **Sentinel-1 GRD/SLC** (ESA / Copernicus). Wet snow and melt timing; fleece signature is a hypothesis. GEE: COPERNICUS/S1_GRD | 2014–present | ~10–20 m | api | [link](https://dataspace.copernicus.eu;) | open · Copernicus licence | observed | B | 3 | to verify |
| E11 | **NISAR L-band** (NASA / ISRO via ASF DAAC). One season only; curiosity | June 2026–present | ~10 m | api | [link](https://asf.alaska.edu) | registration (Earthdata) · open | observed | B | 3 | seen in search |

## Base map / aerial

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M01 | **Trentino orthophoto 2015** (Provincia autonoma di Trento). Check flight date: in summer the cover is unmistakable | 2015 | 0.2 m | dataset | [link](https://www.provincia.tn.it/Argomenti/Ambiente/Geologia) | open (check) · check | observed | A+B | 1 | seen in search |
| M02 | **Trentino geoportal and WMS services** (Provincia autonoma di Trento (SIAT)). List which orthophoto years exist over Presena | various | various | basemap | [link](https://siat.provincia.tn.it) | open (check) · check | cartographic | A+B | 2 | to verify |
| M03 | **CTP 2000 topographic layer (glaciers and snowfields)** (Provincia autonoma di Trento). Pre-cover glacier outline | 1998–2007 | 1:10,000 | dataset | [link](https://siatservices.provincia.tn.it/idt/raster/ctp_2000_topografia/) | open · check | cartographic | B | 2 | seen in search |
| M04 | **Geoportale Lombardia** (Regione Lombardia).  | various | various | basemap | [link](https://www.geoportale.regione.lombardia.it) | open (check) · check | cartographic | B | 3 | to verify |
| M05 | **swisstopo LUBIS aerial images** (swisstopo). Diavolezza/Morteratsch history | 1920s–present | scan dependent | permalink | [link](https://map.geo.admin.ch) | open · free, attribution | observed | B | 2 | seen earlier |
| M06 | **SWISSIMAGE** (swisstopo).  | recent epochs | 0.1 m | api | [link](https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissimage-dop10) | open · swisstopo OGD | observed | B | 3 | to verify |
| M07 | **OpenStreetMap** (OpenStreetMap contributors). Base layers for the Situate map; ODbL is share-alike for the database | current | vector | api | [link](https://overpass-api.de) | open · ODbL | cartographic | A+B | 1 | known |
| M08 | **Randolph Glacier Inventory 7.0** (GLIMS / NSIDC). Glacier geometry | ~2000 | vector | dataset | [link](https://nsidc.org/data/nsidc-0770) | open · CC BY 4.0 | model-derived | A+B | 2 | to verify |
| M09 | **GLIMS glacier database** (GLIMS / NSIDC). Look for repeated outlines of Presena | various | vector | api | [link](https://www.glims.org/maps/glims) | open · check | cartographic | B | 3 | to verify |

## Glacier monitoring

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G01 | **GLAMOS** (Glacier Monitoring Switzerland). Retreat timeline for Morteratsch | 1880s–present | per glacier | dataset | [link](https://www.glamos.ch) | open · check | observed | B | 2 | to verify |
| G02 | **WGMS Fluctuations of Glaciers database** (World Glacier Monitoring Service). Check if Presena has mass-balance or length series | 1890s–present | per glacier | dataset | [link](https://wgms.ch) | open · check (DOI per version) | observed | B | 2 | to verify |
| G03 | **Comitato Glaciologico Italiano: campaigns and photo archive** (CGI). Late-summer photos of Presena may show the cover | 1969–present | per glacier | archive | [link](https://www.glaciologia.it) | request / open reports · check | observed | B | 1 | seen in search |
| G04 | **SAT Commissione Glaciologica** (Società degli Alpinisti Tridentini). Published a 1916–2021 Presena comparison | 1916–present | per glacier | request | [link](https://www.sat.tn.it) | request · check | observed | B | 1 | seen in search |

## Ground photos

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | **Operator webcam 'Presena 3000'** (Consorzio Pontedilegno–Tonale). Served as a live JPEG with an access token (do not publish the token). Summer frames would date laying/removal; consider a daily capture from June 2027, with the operator's permission | live only; no public archive found on operator site | — | webcam | [link](https://www.pontedilegnotonale.com/it/webcam/) | open to view · not republishable | observed | B | 1 | checked 2026-11-04 |
| P02 | **Flickr API** (Flickr). Store metadata and links only | 2004–present | — | api | [link](https://www.flickr.com/services/api/) | registration (API key) · per photo | observed | B | 1 | known |
| P03 | **Wikimedia Commons API** (Wikimedia). Easiest to republish | 2004–present | — | api | [link](https://commons.wikimedia.org/w/api.php) | open · per file (CC/PD) | observed | A+B | 2 | known |
| P04 | **camptocamp.org** (Camptocamp association).  | 2000s–present | — | api | [link](https://api.camptocamp.org) | open · CC BY-SA (check per item) | observed | B | 2 | to verify |
| P05 | **YouTube Data API v3** (Google). Drone videos as possible SfM input | 2005–present | — | api | [link](https://developers.google.com/youtube/v3) | registration (API key) · YouTube terms, not republishable | observed | B | 3 | known |
| P06 | **ETH-Bibliothek E-Pics Bildarchiv** (ETH Zurich). Morteratsch | 1860s–present | — | archive | [link](https://ba.e-pics.ethz.ch) | open · CC BY-SA 4.0 / PD (per item) | observed | B | 2 | seen earlier |
| P07 | **SwissEduc glacier repeat photos** (SwissEduc (J. Alean)).  | 1900s–present | — | permalink | [link](https://swisseduc.ch/glaciers/) | open to view · per image | observed | B | 3 | seen earlier |
| P08 | **Panomax 'Passo Tonale' and 'Ponte di Legno'** (Panomax / Consorzio Pontedilegno–Tonale). Check in the full 360° whether the Presena glacier is in view (south of the pass); the default frame looks at the opposite slope | archive depth to verify | — | webcam | [link](https://pontedilegnotonale.panomax.com/passodeltonale) | open to view · not republishable | observed | B | 2 | checked 2026-11-04 |
| P09 | **Windy webcam 'Vermiglio: Ghiacciaio Presena'** (Windy / Panomax). Possibly a different camera from the operator's 'Presena 3000'; check whether it keeps a timelapse or archive | to verify | — | webcam | [link](https://windy.com/webcams/1759237005) | open to view · not republishable | observed | B | 2 | seen in search |

## Records

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D01 | **Natura 2000 site data** (EEA / Provincia autonoma di Trento). Confirm which site boundary (ZPS/ZSC) contains the covered patch | 2007–2013 updates | — | dataset | [link](https://tla.provincia.tn.it/media/aree_protette/formulari_dati/IT3120158.pdf) | open · EEA / PAT terms | documented | A+B | 1 | seen in search |
| D02 | **Provincial acts (delibere) and press releases** (Provincia autonoma di Trento). Search by Presena, Carosello Tonale, teli geotessili | 2008–present | — | archive | [link](https://www.provincia.tn.it) | open · public records | documented | B | 1 | to verify |
| D03 | **Operator page on Presena protection** (Consorzio Pontedilegno–Tonale). Main source of claims C01, C04, C07–C14. Capture by hand (SingleFile/PDF/Wayback); check older Wayback versions | current | — | permalink | [link](https://pontedilegnotonale.com/en/pontedilegno-tonale-what-to-see/the-protection-of-presena-glacier) | open · all rights reserved | documented (operator claim) | A | 1 | live 2026-11-04; ArchiveBox got 404 |

## Literature

| ID | Source | Coverage | Resolution | Type | Link | Access · licence | Kind | Track | Prio | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L01 | **AINEVA, Presena 2010 point energy balance** (AINEVA, Neve e Valanghe 74).  | 2010 | — | literature | [link](https://aineva.it/wp-content/uploads/Pubblicazioni/Rivista74/nv74_abstract.pdf) | open · AINEVA | documented | A | 1 | from v1 sketch |
| L02 | **AINEVA, Presena 2012 materials test** (AINEVA, Neve e Valanghe 80).  | 2012 | — | literature | [link](https://aineva.it/wp-content/uploads/Pubblicazioni/Rivista80/nv80_rivista-9.pdf) | open · AINEVA | documented | A | 1 | seen in search |
| L03 | **Senese et al. 2020** (Università degli Studi di Milano). DOI 10.1016/j.coldregions.2020.103007 (Cold Regions Science and Technology). Model calibration | 2012 | — | literature | [link](https://air.unimi.it/handle/2434/715669) | open (check) · publisher | documented | A | 1 | from v1 sketch |
| L04 | **Huss et al., EGU 2022** (EGU). DOI 10.5194/egusphere-egu22-1808 | 2021 | — | literature | [link](https://meetingorganizer.copernicus.org/EGU22/EGU22-1808.html) | open · CC BY 4.0 (EGU abstracts) | documented | A | 1 | from v1 sketch |
| L05 | **Oerlemans et al. 2017** (Climatic Change).  | 2017 | — | literature | [link](https://ideas.repec.org/a/spr/climat/v145y2017i1d10.1007_s10584-017-2102-1.html) | check · publisher | simulation (theirs) | A | 2 | from v1 sketch |
| L06 | **Annali MEMOTEF, Presena case study** (Sapienza Università di Roma). Find the stable article page | — | — | literature | [link](https://rosa.uniroma1.it/rosa02/annali_memotef/article/download/1389/1345/4414) | open · check | documented | A+B | 2 | download link 404 on 2026-11-04 |
| L07 | **MUSE 2021 study on the future of the Presena glacier** (MUSE, Museo delle Scienze, Trento). Cited on the operator page (claim C14). Find the report itself; ask MUSE | to 2100 | — | literature | to find | to find ·  | simulation (theirs) | A+B | 1 | cited by operator only |

## Open checks

- Which LiDAR tiles cover Presena, and their flight dates (E01–E03).
- Which orthophoto years exist over Presena, and their flight dates (M01, M02).
- Which Natura 2000 boundary contains the covered patch (D01).
- Historical download page and radiation sensors for Meteotrentino stations near Tonale (W04).
- Licence wording on every Trentino dataset page before redistributing derived files.
