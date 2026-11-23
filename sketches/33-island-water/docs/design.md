# Design

## Structure (revised 2026-11-23)

The author replaced the four workshop parts with three tabs, each written as a narrative:
**The Sifnos case** (first called Sifnos in crisis; formerly Event; adds a topographic map of Sifnos and Poulati as
diagrams), **Storing** (formerly Simulate, then Cisterns; the school roof view removed; first
called "Cisterns know", renamed by the author) and
**Mapping** (formerly Situate, then Aegean freshwater map; first tab since 2026-11-23; map rebuilt as an explorer with filters, a ranking and an island card). "What not to conclude" notes removed by the author. Narrate is removed; its points went into the tab
each belongs to, each tab with its own "what not to conclude" and sources. Visual identity:
one colour, a water blue (#1a5fb4 light, #4b95e2 dark; both pass the dataviz validator),
used only for water. A predictive "this winter" outlook for the Aegean map was proposed and
declined (2026-11-23). The original plan follows.

## Structure (original)

Follow the house format of sketch 03 (Operation Popeye): four parts, then sources and
limits, with an evidence-kind tag on every claim (`data/evidence_kinds.csv`).

| Part | Shows | Main data | Evidence |
| --- | --- | --- | --- |
| 1. Event | Sifnos, June 2024: desal failure, June use doubles, water emergency (20 Jun - 22 Aug, after one extension; Serifos had one from 30 Apr). Counterpoint: Poulati's 12-hour "waters" | `sifnos_timeline.csv` | documented, reported |
| 2. Simulate | A rooftop cistern on Sifnos filled by real daily rain: the tank-size curve, one year of tank level, a house beside a public roof; sliders: more cisterns (as a reservoir), wastewater reuse, leak repair, fewer pools, lower use | `simulate_cistern.py`, ERA5, `rwh_reference_kakoulas22.csv` | reanalysed, calculated, synthetic |
| 3. Situate | Aegean map, each island as a cistern glyph: supply mix, cost, emergencies; traditional systems and existing-storage layers; desalination over time; one €/m³ scale | `islands.csv`, `traditional_systems.csv`, `desal_timeline.csv`, OSM, EMODnet, Diavgeia | documented, reported, cartographic |
| 4. Narrate | Sharing rules, rain readings, water habits | chapter quotes, interviews with consent | interpretive |

## Principles

1. **The open-air cistern.** Poulati's cisterns were left uncovered so everyone could see
   the stock at a glance (DECA). Each island glyph should show supply and summer gap the
   same way, readable without a legend.
2. **Show what official maps miss.** Private cisterns, springs and boreholes are mostly
   undeclared (Cisterns Know call). The map's value is in adding them.
3. **Co-produce.** Islanders choose what the Sifnos layers show (Eos, Tar Creek).
4. **Seed, then open.** Arrive pre-filled; invite cisterns and stories afterwards.
5. **Beyond the screen.** A printed version for a winter feast day on Sifnos (Bad River's
   wall and floor maps).
6. **Date everything; blank means unknown.**

## The island-as-cistern glyph (first idea)

- A rectangle (the cistern) whose height is summer demand.
- Filled from the bottom in bands by source: springs/groundwater, reservoir, rain
  cisterns, desalination, tankers, pipeline, bottled water.
- Drinking and non-drinking water are told apart: rain cisterns (and tanker water that
  is not potable) are drawn as non-drinking, with a pattern, not counted as drinking
  supply. Bottled water is its own band where it is the drinking source (Fournoi's
  main village has no piped network; BERTSIOU23).
- The unfilled top is the summer gap; a dashed line for winter demand.
- Below: cost per m³ and emergency dates as small marks.
- Grey hatching where a value is not known, never a guess.

## Simulate: views (agreed 2026-11-23, after KAKOULAS22)

1. **The tank-size curve leads.** Share of use met against tank size (3–40 m³), with
   cost as a second line. The curve flattens above 10–15 m³ because there is not
   enough rain to fill a bigger tank (Chios: a 4-person house with a 75 m² roof tops out
   at 38% whatever the tank). Readers should see "a bigger cistern stops helping" without
   reading a number. Controls: roof area, household size, litres per person; lowering use
   from 200 to 150 L/day raises the share a roof can supply by a third.
2. **One year at a time.** Daily rain as bars, daily use, and the tank level as a line,
   with a year picker over 1991–2026. Pair a year that empties in May with one of similar
   total that is saved by summer rain (KAKOULAS22 used 2019 and 2018): timing matters
   more than the yearly total.
3. **A house beside a public roof.** A school, church or town hall: large roof, use that
   stops in summer when the tank is empty, so it does better (Chios school: ~60% of
   non-drinking use for €5,700, payback ~14 years). Fits the commons thread from Poulati.
4. **More cisterns, as a reservoir.** The slider answers in comparable units: N
   households' tanks equal a reservoir of X m³, or Y days of the island's desalination
   output (Chios municipality: tanks on 25% of homes ≈ a 370,000 m³ dam, ~€1.5m).
5. **Say what the water is for.** The default use is the non-drinking share (toilets
   and garden, about a third of household use, as in KAKOULAS22); drinking is opt-in and
   flagged.
6. **Rain is a range until checked.** ERA5 is ~14% wetter than the stations in Chios town
   (2013–2019). Until ERA5 is compared with NOA stations (T1.1), show results as a band
   (ERA5 and ERA5 reduced by the measured bias), labelled reanalysed. The model itself
   reproduces the paper's 54 published cases within 1.5–6.9 points
   (`tools/check_cistern_reference.py`); say so in Sources and limits.

## Situate: added layers and views (agreed 2026-11-23)

- **Storage already in place.** Where mains water is intermittent, households keep their
  own tanks and pumps (Chios town; `traditional_systems.csv`). Map it as hidden storage
  that could take roof rain, with the undeclared cisterns (principle 2).
- **One €/m³ scale.** A single horizontal scale shared by every cost on the page: water
  tariffs (Chios: first 20 m³ free, then €1.15–1.99), rainwater (roughly the tariff over
  its 21–36 year payback), desalination (€0.85 running cost in 2012; €2.56–6.69
  production cost in 2025), tankers (€4.91–8.32 in 2012; €7–12 later). Each mark carries
  its year and evidence kind, because the figures measure different things.
- **Desalination over time.** One strip per island, 1970–2026: filled marks for plants
  reported operating, outlines for permits, crosses for closures. Never stack permits on
  capacity. Above the strips, one step chart of capacity still listed in 2020 by year
  online, labelled as a survivor count, with the 2024–26 fast-track permits as a separate
  band (`desal_timeline.csv`, `desal_by_year.csv`).

## Tools (from the workshop's resources list)

| Tool | Use |
| --- | --- |
| Open-Meteo | Rain per island; drives the cistern simulation |
| Copernicus Data Space | Sentinel-2 reservoir area over time (Astypalaia, Naxos); Poulati's green vein |
| Geobodies (Lucia Rebolino) | Method for water and vegetation indexes (Earth Engine) |
| kepler.gl | First look at `data/` without code |
| deck.gl or plain SVG | The published map |
| CesiumJS / Re:Earth | 3D Poulati terraces and cistern cascade (needs terrain; ask DECA for drone survey) |
| TimeMap (Forensic Architecture) | Emergencies, failures and tenders in time and space |
| En-ROADS | Precedent for the futures sliders |
| NetLogo Web | Poulati sharing rules vs. open access (Ostrom vs. Hardin) |
| Conflict Urbanism: Aleppo; Geoengineering Map | Precedents for layered evidence maps |
| Bellingcat toolkit | Check plant and reservoir locations on imagery |

## Precedents

- Sketch 03, Operation Popeye: four parts, evidence kinds, data manifest.
- Cisterns Know (Sifnos): crowd map of cisterns with capacity and volume.
- Andros Routes: volunteer path mapping with oral history.
- Bad River Water and Culture Maps: web, wall and floor maps for storytelling.

The group's are.na channel could not be read during research (it loads by script); look
through it in a browser and add precedents here.
