# 04 · Haida Gwaii iron dump v2

Author: Boone Mercado (with Claude) · Started: 2026-11-05 · Status: sketch · Stack: static HTML + JS, WebGL 2, no build step

The 2012 Haida Gwaii iron sulphate release as a simulated sea under a picture stitched from nineteen MODIS Aqua passes, with terrain: which satellite day best witnesses each part of the water? A second version of sketch 02, from the "HAIDA GWAII v2" artifact.

## Run

Online, once published: https://realtimeurbanismlab.github.io/weather-commons/04-haida-gwaii-iron-dump-v2/

On your computer:

```bash
cd sketches/04-haida-gwaii-iron-dump-v2
python -m http.server 8000
```

Then open http://localhost:8000. The page needs WebGL 2.

Drag to turn the frame, Alt-drag to pan, scroll to zoom. Space runs the clock, ← → step a day, F fits the frame. Rest the pointer on a patch to read which day it shows and why.

## 1. Event

In July and August 2012 the Haida Salmon Restoration Corporation, with funds from the village of Old Massett, sailed the *Ocean Pearl* out to an eddy about 190 mi (300 km) west of Haida Gwaii. It released about 120 t (132 US tons) of iron sulphate and iron oxide into the sea, hoping to feed plankton and bring back salmon. The plankton bloom it reported covered about 10,000 km² (3,900 sq mi). Environment Canada investigated it, and the parties to the London Convention and Protocol on dumping at sea expressed grave concern about it as ocean fertilization outside legitimate research.

## 2. Simulate

A toy sea, not an ocean model. Particles of iron leave the ship along its route; plankton grow near the iron, drift with three eddies and a steady current, and are grazed away. Clouds drift with a wind setting. The run goes from 30 days before the release to 110 days after, and is stored as half-day keyframes so the clock scrubs both ways.

The picture over the sea is cut into ten or so patches. Each patch rides on something in the simulation (the ship, an eddy, the bloom, the sky, open water) and shows the MODIS pass that best "witnesses" what the simulation says is under it: chlorophyll that matches the simulated bloom, cloud that matches the simulated sky, the day nearest the ship's passing, or simply the nearest date. The settings panel sets how much each kind of evidence counts.

Layers are stacked at different heights and coloured one per layer: the composite of passes (red edges), coast and graticule, plankton, iron and the ship's track, the cloud deck, the ship and satellite, and the terrain. Labels stay flat to the screen and are lifted off their layer on a leader line.

## 3. Situate

The site is the north-east Pacific, 49–58° N, 145–127° W: the Haida Gwaii archipelago, Hecate Strait, Queen Charlotte Sound and the coast mountains of British Columbia and south-east Alaska. The release was planned from Old Massett, a Haida village, and sold as salmon restoration; critics called it geoengineering, because the same method is proposed for drawing carbon into the deep sea. Satellite records of that summer are mostly cloud.

## 4. Narrate

You can see where the iron was released, how a bloom like the reported one might spread and drift, and how patchy the satellite record is: on most days cloud hides the water, so any "picture of the bloom" is stitched together from many days. You should not conclude that the simulated bloom is what happened, that the iron caused the bloom seen in the passes, or anything about salmon returns.

## Sources and limits

1. **Satellite imagery: observed.** NASA MODIS Aqua true colour and chlorophyll-a, via NASA Worldview (GIBS), public domain. 19 passes, 14 June – 28 October 2012, cropped to 49–58° N, 145–127° W at 1800 × 900, in `cal/true/` and `cal/chl/`. Cloud fraction and chlorophyll per cell are derived from these images in the browser. Clouds cover most of the frame on most days.
2. **Coastline and graticule: cartographic.** `cal/coast.png`. The coastline's source still needs to be recorded.
3. **Terrain: modelled from observations.** AWS Terrain Tiles (Tilezen "terrarium" encoding, zoom 7; built from SRTM, GMTED2010, ETOPO1 and other sources), retrieved 5 November 2026 and resampled to a 360 × 180 equirectangular grid of land heights in `cal/terrain.png` (grey × 16 = metres; the sea is 0). Land only; heights are exaggerated 100× by default.
4. **The sea: synthetic.** The iron, plankton, eddies, clouds and grazing are a made-up toy model, not a forecast or a hindcast. The ship's route, the eddy positions and the bloom envelope are approximate, drawn from news reports and the Geoengineering Monitor record: https://map.geoengineeringmonitor.org/ggr/haida-salmon-restoration-corporation-(hsrc). The reported bloom of about 10,000 km² is the project's own claim.

What it cannot show: where the iron actually went, whether it caused any bloom, the carbon exported or the effect on salmon. The patches choose among days by rules set in the panel, so the composite is an argument about evidence, not a record of any one day.

**Design note.** This sketch keeps its own look, as 01 and 02 do: a black ground for imagery, one colour per data layer, and the font ABC Diatype where it is installed. It falls back to system fonts, and no font files are included.
