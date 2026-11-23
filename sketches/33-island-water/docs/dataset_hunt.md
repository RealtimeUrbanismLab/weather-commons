# Dataset hunt

One section per map layer: what we need, where to look first, search terms, who to ask.
Status lives in `data/datasets.csv`. Search in Greek as well as English: most island
water information is published only in Greek.

## 1. Supply mix (where the tap water comes from)

**Need:** per island, the sources in use (springs, boreholes, reservoirs, desalination,
tankers, pipelines) and, ideally, their share by season.

- River Basin Management Plan for the Aegean Islands (GR14), Special Secretariat for
  Water, Ministry of Environment and Energy: water balances and abstractions by island.
- Municipal water utilities (ΔΕΥΑ) annual reports and websites; municipal council
  decisions on Diavgeia.
- Island press: Sustainable Cyclades (sustainablecyclades.gr), kykladiki.gr,
  naxospress.gr, milosvoice.gr, local Dodecanese sites.
- Search: `ύδρευση [νησί] πηγές νερού`, `ΔΕΥΑ [νησί] ετήσια έκθεση`,
  `υδατικό ισοζύγιο [νησί]`, `σχέδιο διαχείρισης λεκάνης απορροής νησιά Αιγαίου`.

## 2. Desalination plants

**Need:** location, capacity (m³/day), technology (seawater RO, brackish), year, owner,
energy source, status (permanent, temporary, portable).

- EMODnet Human Activities: desalination plants (from GWI DesalData). Check licence and
  whether capacity is included.
- EEA figure "Location of water desalination systems".
- Ministry of Maritime Affairs / General Secretariat for the Aegean: fast-track permits
  (25 in 2024; 35 for 27+ islands by 2026), the 103-project programme.
- Diavgeia: `αφαλάτωση [νησί] προμήθεια`, `άδεια προσωρινής λειτουργίας αφαλάτωσης`.

## 3. Cost and price

**Need:** production cost €/m³ per island; tariffs paid by users; tanker cost €/m³.

- University of the Aegean study (press: Proto Thema, Sept 2025; newmoney 2025). Find the
  report or paper and its authors; ask for the table.
- Regulatory Authority for Energy, Waste and Water (RAAEY) for tariff rules.
- DEYA tariff decisions on Diavgeia.
- Tanker contracts: Diavgeia and KIMDIS, `μεταφορά πόσιμου νερού με υδροφόρα πλοία`.

## 4. Demand and population

**Need:** residents; summer population; daily use per person; tourism trend.

- ELSTAT 2021 census (municipality level).
- ELSTAT maritime passenger traffic by port; tourist accommodation capacity.
- Airport arrivals for islands with airports.
- Per-person use: EGU26 analysis assumes 173 L/day; look for island-specific figures.

## 5. Stress, drought and emergencies

**Need:** dated declarations; drought indices; groundwater status.

- General Secretariat for Civil Protection decisions (Diavgeia, civilprotection.gov.gr);
  Ministry of Environment decisions (Leros, Patmos, Attica, Nov 2025).
- Copernicus European Drought Observatory: Combined Drought Indicator, SPI.
- EEA WISE WFD: groundwater bodies' quantitative status (GR14).
- EEA Water Exploitation Index plus (WEI+), seasonal.

## 6. Weather: rain past and future

**Need:** monthly rain per island since 1991; recent dry winters; projected change.

- ERA5 via Open-Meteo (`tools/fetch_rain.py`). Coarse (~25 km): small islands may
  share a grid cell with the sea; note it.
- NOA meteo.gr stations on islands (data on request via Meteosearch).
- C3S Climate Atlas; EURO-CORDEX; Demokritos projections cited by Reuters (to 2049).

## 7. Traditional and community systems

**Need:** cisterns, springs, wells, furrows, check dams, watermills, terraces, sharing
rules; with location where possible.

- OpenStreetMap (`tools/fetch_osm_water.py`): springs, wells, water tanks, reservoirs,
  watermills, fountains.
- Cisterns Know (DECA Architecture, UrbanDig): ask whether the crowd map's data exists.
- Andros Routes and the Centre for Contemporary Research & Action on Andros: ask for
  trail, spring and mill GIS, and oral history.
- LIFE TERRACESCAPE (University of the Aegean): Andros terraces and mills.
- CARDIMED: Sifnos check-dam revival (contacts, locations).
- Angelakis et al. 2025: history of rainwater harvesting and reuse in Greece.
- Hellenic Folklore Research Centre: manuscripts on water, cisterns, springs.
- Archaeology: Delos cisterns, Kythera Karavas Water Project; search
  `στέρνες Κυκλάδες`, `ξερολιθιές νερό`, `νερόμυλοι [νησί]`.

## 8. Stories and sharing rules

**Need:** oral histories and documented informal rules.

- Zepou & Matsaganis 2024 (Poulati); The New Republic on Sifnos habits.
- kaipoutheos.gr (Karavos: rain readings and dry-adapted seed; drought notes).
- New interviews: `docs/interview_guide.md`, notes in `private/`.

## 9. Futures and alternatives

**Need:** projected demand; options and their costs, energy and side effects.

- National seven-island demand study (Agathonisi, Amorgos, Thasos, Kasos, Serifos,
  Sifnos, Paxoi): find the results.
- Zafeirakou et al. 2022 (Sifnos, 20-year plan with wastewater reuse).
- HYDROUSA and CARDIMED pilots (Lesvos, Mykonos, Tinos, Sifnos).
- Desalination energy: 3-5 kWh/m³ for RO (SCIEPUB); thermal 23-25 (MDPI22).
