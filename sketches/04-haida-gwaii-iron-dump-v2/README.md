# 04 · Haida Gwaii iron dump v2

Author: Boone Mercado (with Claude) · Started: 2026-11-05 · Status: sketch · Stack: static HTML + JS, WebGL 2, no build step

The 2012 Haida Gwaii iron release told in eight steps over a 3D model you can turn: the real shape of the land, the chlorophyll that satellites measured on the sea, and a simulated plankton bloom standing on the water. A second version of sketch 02, from the "HAIDA GWAII v2" artifact.

## Run

Online, once published: https://realtimeurbanismlab.github.io/weather-commons/04-haida-gwaii-iron-dump-v2/

On your computer:

```bash
cd sketches/04-haida-gwaii-iron-dump-v2
python -m http.server 8000
```

Then open http://localhost:8000. The page needs WebGL 2.

Drag to turn the model, Shift-drag (or right-drag) to pan, scroll to zoom. Region, Plan, 3D and Elevation switch the view (keys 4, 1, 2, 3). Chlorophyll turns the measured layer on and off (key C). The numbered steps along the bottom tell the story and move the clock and the camera; `,` and `.` step through them. Space runs the clock, ← → step a day, W A S D pan, F fits the frame. Place names show only while the story runs. The box on the right shows archive photos and news clippings for the step being told. Rest the pointer on the model to read what is there.

## 1. Event

In July 2012 a chartered fishing boat, the *Ocean Pearl*, left Victoria, British Columbia, with a crew of eleven and a hold of iron compounds. About 370 km (230 mi) west of Haida Gwaii the crew scattered roughly 100 t of iron sulphate and 20 t of iron oxide along a zigzag track inside a Haida eddy, a slowly turning body of water 150 to 300 km across, over about thirty days. The voyage was paid for by the Haida village of Old Massett, about $2.5 million, through the Haida Salmon Restoration Corporation; its chief scientist was the American businessman Russ George. The hope was twofold: more plankton to feed salmon, and carbon credits to sell.

A plankton bloom followed and was recorded by satellites: about 10,000 km² by one account, 35,000 km² by the corporation's. Environment Canada was told of a possible incident on 29 August 2012 and opened an investigation the next day. The release became public in mid-October 2012. On 18 October the Council of the Haida Nation and the Hereditary Chiefs Council said they were in no way involved.

## 2. Simulate

Two things are on the sea, and they are kept apart.

**Measured.** Chlorophyll, the green pigment of plankton, as three satellite instruments recorded it. It is drawn in colour and as a low relief on the sea, and fades from one date to the next as the clock moves.

**Simulated.** A toy sea, not an ocean model. The ship sails from Victoria to the eddy; particles of iron leave it along a zigzag track over about thirty days; plankton grow near the iron, drift with three eddies and a steady current, and are grazed away. Each patch of simulated plankton is a stem with a dot on top: the taller it stands, the denser the bloom there. That height shows density, not a real height above the sea. The run goes from 30 days before sailing to 110 days after and is stored as half-day keyframes, so the clock scrubs both ways.

The model is one block seen through a perspective camera, sitting on a map of the region from Alaska to Oregon. The land is real relief (exaggerated 5× by default) with a sharp satellite picture draped over it and shading computed from its shape. The sea picture has its remaining cloud and haze pressed down to dark water, so nothing covers what is being shown. Lines of latitude and longitude are drawn on the ground, and their numbers ride the bottom and right edges of the screen.

Earlier versions cut the picture into patches that each chose a single satellite pass, floated each day's clouds above the sea, and drew the land as outlines. Those were dropped on 9 November 2026 because they got in the way of the water.

## 3. Situate

The site is the north-east Pacific, 49–58° N, 145–127° W: the Haida Gwaii archipelago, Hecate Strait, Queen Charlotte Sound and the coast mountains of British Columbia and south-east Alaska. The iron went in just outside Canada's waters, so the London Convention and Protocol on dumping at sea were the likeliest law to apply; both they (2008) and the UN Convention on Biological Diversity (2008) had asked that ocean fertilization not go ahead except as small-scale research.

Old Massett is one of two Haida villages on the islands. Its leaders described a fishing economy that had collapsed over twenty years, with unemployment around 70 percent; residents approved the project by vote in 2011. The President of the Haida Nation said the village had agreed believing it would do the sea good. Scientists objected that a Haida eddy, which blooms on its own, was among the worst places to test iron fertilization, because the iron's effect could not be told apart from what the eddy would have done anyway.

## 4. Narrate

You can see where the iron was released, the chlorophyll the satellites measured before, during and after, and how a bloom fed by the iron might have spread. You should not conclude that the simulated bloom is what happened, or that the iron caused everything green in the measured layer: the eddy and the coast bloom on their own.

What followed is unsettled. Two studies in 2014 give the clearest independent picture: the 2012 bloom was the most intense in that area in ten years but small in the carbon it drew down (Xiu, Thomas and Chai), and plankton recorders towed by commercial ships caught fewer plant plankton and more animal plankton than in any earlier autumn, which suggests grazers ate the bloom (Batten and Gower). Salmon returned in large numbers in 2013 and 2014; with no untreated water to compare, nobody can say the iron was why. In March 2013 Environment Canada searched the corporation's offices and the ship; no charges are on the public record. In October 2013 the London Protocol adopted an amendment on marine geoengineering, which has not entered into force.

## Sources and limits

1. **Chlorophyll: observed, composited.** Made for this sketch from daily chlorophyll-a pictures of `MODIS_Aqua_L2_Chlorophyll_A`, `MODIS_Terra_L2_Chlorophyll_A` and `VIIRS_SNPP_L2_Chlorophyll_A` on NASA GIBS (public domain), retrieved 9 November 2026. For each of 19 dates between 14 June and 28 October 2012, every picture within 8 days is turned back into mg/m³ with the layer's colour map, and the middle value of the valid readings is kept, in `cal/chlc/` (900 × 450; grey 1–255 is log10 of mg/m³ from −2 to log10 of 20; 0 is never seen). Coverage of the sea is nearly complete. Limits: each picture gathers about two weeks; satellites see only the top few metres of water; values near the coast are less reliable; the model draws only about 0.3 to 4 mg/m³, and the relief on the sea shows the same value, not a height.
2. **The picture: observed, composited.** MODIS Terra and Aqua true colour from NASA GIBS (`MODIS_Terra_CorrectedReflectance_TrueColor`, `MODIS_Aqua_CorrectedReflectance_TrueColor`), public domain, retrieved 9 November 2026. Sea: for each of the 19 dates, every picture within 8 days (34 views) is stacked and the third-darkest view of each pixel kept (`cal/clear/`, 1200 × 600); the page then presses remaining cloud and haze down to dark water. Land: one sharper composite of 21 August – 6 September 2012 made the same way (`cal/land.jpg`, 4096 × 2048). No single day looked like these pictures, and clouds are left out on purpose.
3. **Land relief: modelled from observations.** AWS Terrain Tiles (Tilezen "terrarium" encoding, zoom 9; built from SRTM, GMTED2010, ETOPO1 and other sources), retrieved 9 November 2026, resampled to 2048 × 1024 in `cal/terrain16.png` (metres × 8 = red × 256 + green; the sea is 0). Heights are exaggerated 5× by default. The shading is computed, lit from the north-west.
4. **Coast, borders and the region: cartographic.** `cal/context.png` is drawn from Natural Earth 1:50m land, coastline, national and state or province lines (public domain), retrieved 9 November 2026. The coastline inside the block, `cal/coast.png`, is from an earlier source that still needs to be recorded.
5. **The sea model: synthetic.** The iron, plankton stems, eddies and grazing are a made-up toy model, not a forecast or a hindcast. The ship's track, the eddy's position and the dates are approximate: the sailing day is set to 14 July 2012 for the clock, and the sources say only "July". The dashed outline of the reported bloom is a rough guide, not a measured edge.
6. **The story steps: reported and documented.** Each step is labelled observed, simulated, reported, documented or not known. The account follows Boone Mercado's research essay of November 2026 and its references, chiefly:
   - Xiu, Thomas and Chai, "Satellite bio-optical and altimeter comparisons of phytoplankton blooms induced by natural and artificial iron addition in the Gulf of Alaska", *Remote Sensing of Environment* 145 (2014): 38–46.
   - Batten and Gower, "Did the iron fertilization near Haida Gwaii in 2012 affect the pelagic lower trophic level ecosystem?", *Journal of Plankton Research* 36, no. 4 (2014): 925–932.
   - CBC the fifth estate, "B.C. village's ocean fertilization experiment probed", March 2013.
   - Fountain, "A Rogue Climate Experiment Outrages Scientists", *The New York Times*, 18 October 2012.
   - ETC Group, "World's Largest Geoengineering Deployment Off Coast of Canada's British Columbia", 16 October 2012.
   - Raven's Eye (AMMSA), "Council of the Haida Nation state they are not involved in artificial fertilization", 2012.
   - London Protocol, Resolution LP.4(8), 18 October 2013; London Convention and Protocol, Resolution LC-LP.1 (2008).
   - Geoengineering Monitor record: https://map.geoengineeringmonitor.org/ggr/haida-salmon-restoration-corporation-(hsrc)
7. **Archive box.** Photos in `media/` are public domain or openly licensed; each carries its credit, licence and source in `media/media.json` and on screen. News coverage is shown as a headline and a link, never as a copy of the article or its photographs.

`cal/true/` and `cal/chl/` hold 19 single MODIS Aqua passes and chlorophyll pictures that earlier versions used, and `cal/terrain.png` an earlier, coarser height grid. The page no longer loads them.

What it cannot show: where the iron actually went, how much of the measured chlorophyll it caused, the carbon exported, or the effect on salmon.

**Design note.** This sketch keeps its own look, as 01 and 02 do: a black ground, colour for the measured and simulated layers, and the font ABC Diatype where it is installed. It falls back to system fonts, and no font files are included.
