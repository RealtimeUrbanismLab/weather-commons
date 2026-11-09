# Notes for the next version

Working notes for sketch 04. Read this first. Dated entries; move items to Done when they ship.

## Observed

- 2026-11-05: Labels are legible over imagery now, but a few still crowd near the eddies when the frame is turned steeply.

## Next

- Sea-surface height (satellite altimetry) would show the eddies themselves; it is what Xiu et al. used and is not on NASA GIBS for 2012.
- Chlorophyll for the same weeks in other years, to show how unusual 2012 was.
- Check each story step against primary sources and add citations (sailing date, tonnage, the Council of the Haida Nation statement, the London Convention decisions).
- Add the water below the surface (seabed, sinking carbon) if wanted.
- A cloud-cleared chlorophyll picture draped on the sea, so the observed bloom can be seen beside the simulated one.
- June and July composites still show haze; try a wider window or a cloud mask.
- Record the source of `cal/coast.png`.
- Cite the ship's route and bloom envelope to specific reports, not only the Monitor record.

## Decisions

- 2026-11-09: This is v3. The folder name stays `04-haida-gwaii-iron-dump-v2`, because sketch folders are never renamed.
- 2026-11-09: Measured and simulated are kept visibly apart: measured chlorophyll is green on the sea, simulated plankton are teal stems. Each story step says which it is showing.
- 2026-11-09: The archive box takes only public-domain or openly licensed photos; news is a headline and a link, never a screenshot.
- 2026-11-09: Clouds are left out. The picture is a time-faded cloud-cleared composite, not single passes; the "witness" patches are gone.
- 2026-11-09: Plankton stem height shows density, by convention; say so wherever it appears.
- 2026-11-05: Own look, as 01 and 02 have: black ground, one colour per data layer, ABC Diatype where installed (no font files committed). Labels drawn flat to the screen and lifted on leaders, never painted into the tilted layers.

## Questions

- Remove `cal/true/` and `cal/chl/` (8 MB, no longer loaded), or keep them for an observed-chlorophyll layer?
- Does the lab accept a third sketch with its own look, given CONTRIBUTING §9 (black and white, no colour except imagery)?

## Done

- 2026-11-09 (local, not pushed), later the same day: measured chlorophyll from Aqua, Terra and VIIRS as colour and low relief on the sea; sea haze pressed to dark water; terrain rebuilt at 2048 × 1024 with a sharper land picture; a map of the region under the block (Natural Earth) and a Region view; coordinates on the screen's bottom and right edges; story and simulation corrected from Boone's essay (ship sails from Victoria, eddy 370 km west, thirty-day release); archive box for photos and clippings.
- 2026-11-09 (local, not pushed): rebuilt as a 3D model. Perspective camera (drag turns, Shift-drag pans, wheel zooms; Plan / 3D / Elevation); land as shaded relief with the cloud-cleared picture draped over it (Terra + Aqua composites, fading through time); plankton as stems, taller where denser; eight-step story along the clock; place names only while the story runs. Dropped: the patches that chose a pass each, the cloud layer, the satellite line, the orange terrain outlines.
- 2026-11-05: Brought in from the "HAIDA GWAII v2" artifact; coloured layers, terrain (AWS Terrain Tiles), screen-facing labels, the shared site header.
