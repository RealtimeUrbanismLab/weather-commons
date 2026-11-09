# 10 · The Ship as Instrument: Storms in Logbooks

Author: Christos Montsenigos · Started: 2026-11-09 · Status: sketch · Stack: static HTML, no build step

Before wind gauges, sailors judged the wind by how much sail their ship could carry and wrote it down in words every day at noon. This sketch looks at storms in those logbooks and asks what a storm looks like when the instrument is a ship, and what changes when the sailors' words become data.

## Run

Online, once published: `https://abj3ct.github.io/weather-commons/10-the-ship-as-instrument-storms-in-logbooks/`

On your computer:

```bash
cd sketches/10-the-ship-as-instrument-storms-in-logbooks
python -m http.server 8000
```

Then open http://localhost:8000.

## 1. Event

Storms as recorded in European ships' logbooks, 1662–1855, through the CLIWOC database. A first case is 7 March 1796, when six ships of a Dutch group sailing from Texel north around Scotland logged a storm near 63°N, each in its own words. If the sketch needs one very specific case, it will follow this group's voyage.

## 2. Simulate

To come. The plan:
- show each ship's noon positions as dots, since we only know where it was at noon;
- put the logbook words beside the numbers the database turns them into;
- draw how much sail each entry implies.

## 3. Situate

To come: the routes, the war that shaped them, and the archives that hold the logbooks.

## 4. Narrate

To come.

## Sources and limits

- **CLIWOC 2.1** (Climatological Database for the World's Oceans).
  - Who: reformatted by Dagomar Degroot and Steven Ottens at https://historicalclimatology.com/cliwoc, from the EU CLIWOC project (2001–2004).
  - Size: 282,322 entries from 1,756 logbooks, 1662–1855.
  - Downloaded: 8 November 2026, the GeoPackage version.
  - Licence: not stated by the source.
  - Used on the page: six entries for 7 March 1796, plus the last logged dates and places of the same voyages. Positions are rounded to 0.1°; nothing else is changed. No data file is committed.
  - What kind of material: the logbook words are **observed**, as transcribed by CLIWOC. The wind speeds are **converted** by the database from words to the middle of a Beaufort band, so they are not measurements.
  - Coding caveats: https://stvno.github.io/page/cliwoc/
- **English translations** of the Dutch wind words: mine, **interpretive**.
- **Readings:**
  - García-Herrera et al. 2005, *Climatic Change* 73: 1–12.
  - Wheeler & Wilkinson 2004, *Mariner's Mirror* 90: 187–201.
  - Wheeler & Wilkinson 2005, *Climatic Change* 73: 57–77.
  - Sorrenson 1996, *Osiris* 11: 221–236.

What this sketch cannot show yet:
- The wind speeds are estimates for words.
- Positions were often worked out by dead reckoning, not observed.
- There is one entry a day, so we don't know what happened in between.
- Some voyages were entered twice in the database.
- A ship that wrote nothing was not necessarily in calm weather.
- What happened at Saldanha Bay in August 1796 still needs a historical source.
