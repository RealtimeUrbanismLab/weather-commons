# Scope

Agreed 2026-11-23. Every data task follows this. Change it only by agreement, and log the
change under Decisions in `NOTES.md`.

## Why a rule

The kit's first island list (27 islands) was not chosen by any rule. Islands were added
when they came up in the press or in project sites: emergency declarations, the 2025
desalination cost reporting, a 2019 tanker contract. A map built on that list would make
crisis look normal and hide islands that cope quietly. The base layer is now defined by a
rule, and depth is added where sources exist.

## Geographic scope

**Base layer: every inhabited Greek island in the Aegean.**

- *Inhabited* means a resident population above zero in the 2021 census (ELSTAT). The
  census is the source of the list, not the press.
- Groups: Cyclades, Dodecanese, North Aegean (incl. Thasos, Samothraki), Sporades, and the
  small islands off Evia.
- Every island gets name, group, residents (2021), coordinates and source. Everything else
  is filled where found and left blank (not known) where not.
- Turkish Aegean islands are out of scope.

**Context only: Crete, Evia, the Saronic islands, Kythera.** Their water systems (rivers,
large aquifers, pipelines from the mainland) are too different to compare like for like.
They appear on the map in grey, with no cistern glyph and no comparative numbers. Facts
already gathered for Aegina, Poros, Spetses and Kythera are kept but tagged `context`.

**On the map** (decided 2026-11-23): base islands with 10 or more residents get a cistern
glyph; the 22 with fewer (lighthouse keepers, monks, soldiers, a farm) get a dot. Each
island is placed at its main village, its most populous settlement in the 2021 census.

**Zoom: Sifnos**, unchanged.

## Time frame

| Layer | Window | Notes |
| --- | --- | --- |
| Now: supply, costs, demand, emergencies | 1991–2026 | Older figures will be patchy; every number carries its own date |
| Rain | 1991 to the latest full month | 1991–2020 is the standard climate normal to compare against |
| Before desalination: traditional systems | Living memory, c. 1950 on | Systems people remember or still use; fits interviews and Poulati. Older origins (e.g. Poulati's Byzantine-era rules) can be mentioned as context, not hunted for |
| Futures | Not yet agreed | Proposal: to 2050, matching the Aegean rainfall projections cited to 2049 |

## Open edges

- Which small islands count as "off Evia" and which as Sporades or Saronic: every call is
  a row in `data/island_rules.csv` (census code → island, group, scope, note), applied by
  `tools/build_islands.py`. Borderline ones are listed in `NOTES.md`.
- Uninhabited islands with water infrastructure (cisterns, chapels, grazing) are out of
  the base layer; note any we meet.
- Each island's first desalination plant date is still worth finding: it marks where
  "before" ends on that island, even though the layer itself starts c. 1950.
