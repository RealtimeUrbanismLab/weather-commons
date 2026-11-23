# 10 · The Ship as Instrument: Storms in Logbooks

Author: Christos Montsenigos · Started: 2026-11-09 · Status: prototype · Stack: static HTML and three.js, no build step

Before wind gauges, sailors judged the wind by how much sail their ship could carry and wrote it down in words every day at noon. This sketch maps every noon entry in the CLIWOC logbook database, 1750–1855, day by day. It shows the ships as instruments of weather and of empire: what they measured, how, in whose words, and why they were there.

## Run

Online: `https://abj3ct.github.io/weather-commons/10-the-ship-as-instrument-storms-in-logbooks/`

On your computer:

```bash
cd sketches/10-the-ship-as-instrument-storms-in-logbooks
python -m http.server 8000
```

Then open http://localhost:8000. The ship view loads three.js from a CDN, so it needs internet.

## 1. Event

Storms, winds and the daily weather recorded in European ships' logbooks, 1750–1855, through CLIWOC 2.1. Specific cases inside the map: the storm of 7 March 1796, logged by six ships of a Dutch squadron, and the same squadron's surrender at Saldanha Bay on 17 August 1796.

## 2. Simulate

- **The map:** every logbook entry as a dot, day by day, coloured by nation, with 25 days of track. The background wind is CLIWOC's own winds averaged by month.
- **Storms:** entries at Beaufort 10 or more, or with a storm word, grouped by days and distance. For storms logged by several ships, a pop-up shows each ship's winds and words, and an ochre spiral sketches the storm's form by Buys Ballot's rule (**interpretive**).
- **The ship pop-up:** a typical ship of that type, nation and year, drawn in white linework in a still isometric view, turned to its logged course, with its sails set for the day's force and the wind moving through the rig (**interpretive**). Under it, a compass with the logged wind, the course, the compass needle and the noon positions before and after. Then the officer's words, CLIWOC's Beaufort force and wind speed, and any barometer, thermometer and compass readings.
- **The whole voyage:** a map and a chart of every entry in a logbook, with the barometer where it was read.

## 3. Situate

- **Reckoned or observed:** tracks are solid where the noon position was observed and dashed where it was only reckoned (dead reckoning). In the voyage view, small blue circles show where the officer reckoned the ship was, joined to where the sky showed it.
- **Events of empire:** battles, captures, expeditions, slave revolts and 16 Middle Passages that these ships took part in.
- **Slave voyages:** recorded in a ship's own logbook, very likely from company and route, or met by another ship.
- **Layers:** words and numbers, barometer and temperature, compass needles, sky and sea (auroras, comets, eclipses, waterspouts, ice, snow, hail, whales, birds), cargo and encounters, zero meridians.
- **Whose logbooks?:** the archives behind the map, by country, and a short note on how the collection was made and its bias.

## 4. Narrate

The sketch argues that the ships measured the weather because empire sent them, so the record shows the empire as much as the weather. A **Reckoned text** switch marks everything a machine wrote (dashed) apart from what comes from the logbooks (solid).

## Sources and limits

- **CLIWOC 2.1**, Climatological Database for the World's Oceans:
  - Who: the EU CLIWOC project (García-Herrera, Können, Wheeler, Prieto, Jones, Koek and others, 2001–2004); version 2.1 at DANS, https://doi.org/10.17026/dans-2bx-dutg, licence CC0. Downloaded as a GeoPackage reformatted by Dagomar Degroot and Steven Ottens at https://historicalclimatology.com/cliwoc, 8 November 2026.
  - Used: all positions, dates, logbook words, wind direction, CLIWOC's Beaufort force and wind speed, how each position was found, barometer, thermometer and compass readings, remarks, cargo, encounters, zero meridians and archive references. One entry per logbook per day: 257,498 entries, 991 ships, 1,742 logbooks.
  - Kind of material: the logbook words and readings are **observed**, as transcribed. The Beaufort force and wind speed are **reanalysed** (CLIWOC's conversion of the words). The background wind is CLIWOC averaged by month.
  - Built into `data/` by the scripts in `tools/` (`build-data.mjs`, `build-slavery.mjs`, `build-events.mjs`, `build-archives.mjs`, `land.mjs`).
- **Events of empire:** gathered for this sketch from Wikipedia and similar secondary sources (links in the page's About and sources), matched to CLIWOC ships. **Interpretive.** Some links still need checking.
- **Coastlines:** Natural Earth 1:50m land, public domain.
- **Ship designs:** proportions after Chapman, *Architectura Navalis Mercatoria* (1768) and Steel, *The Elements and Practice of Rigging and Seamanship* (1794); paint and flags from general naval history. **Interpretive**: a typical ship, not the individual ship.
- **English glosses and translations** of logbook words and ship notes, ship roles, event summaries and the history of CLIWOC were written with an AI model. **Interpretive.** Turn on **Reckoned text** to see them marked.
- **three.js** (MIT) for the ship view.
- **Readings:** García-Herrera et al. 2005, *Climatic Change* 73: 1–12; Wheeler & Wilkinson 2004, *Mariner's Mirror* 90: 187–201; Wheeler & Wilkinson 2005, *Climatic Change* 73: 57–77; Sorrenson 1996, *Osiris* 11: 221–236.

What this sketch cannot show:
- The wind speeds are estimates for words, not measurements.
- About 36% of latitudes and 40% of longitudes are reckoned, not observed.
- There is one entry a day, so we don't know what happened in between.
- Storms, slave voyages, ship roles and sightings are found by rules and keyword searches, so some are missed and a few may be wrong.
- The collection reflects which logbooks survived and were chosen, not how many ships sailed: Dutch 45%, British 35%, Spanish 17%, French 2%.
- These logbooks hold 53 slave voyages; the Trans-Atlantic Slave Trade Database records about 36,000.
- Some voyages were entered twice in the database, and not every logbook was digitised in full.
