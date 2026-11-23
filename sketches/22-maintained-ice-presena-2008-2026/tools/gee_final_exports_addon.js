// Sketch 22 · FINAL EXPORTS add-on for v3.6 (2026-11-23)
// Paste at the very END of the v3.6 script, then Run once. Adds:
//  - a third filmstrip: the fleece fraction actually counted each year (white = fleece), for visual audit;
//  - a GeoTIFF with one band per year of fleece fraction (0-1), 10 m, UTM 32N: the raw result to archive;
//  - the ski-run zone as GeoJSON, so the zone used for every number is documented.
var fracFilm = best.map(function (img) {
  img = addIdx(ee.Image(img));
  var f = fleeceFraction(img);
  return f.updateMask(f.gte(T_OUTER)).unmask(0).visualize({min: 0, max: 1, palette: ['000000', 'ffffff']});
});
print('Filmstrip, fleece fraction counted (years in date order):', fracFilm.getFilmstripThumbURL({region: region, dimensions: 240, crs: 'EPSG:3857'}));

var fracStack = best.map(function (img) { return fleeceFraction(addIdx(ee.Image(img))); }).toBands();
print('Bands of the fraction GeoTIFF (scene id + _f):', fracStack.bandNames());
Export.image.toDrive({image: fracStack.toFloat(), description: 'presena_s2_fleece_fraction_stack', folder: 'Presena_GEE',
  region: site.buffer(450).bounds(), scale: 10, crs: 'EPSG:32632', maxPixels: 1e8});

var zoneVec = runMask.selfMask().toInt().reduceToVectors({geometry: aoi, scale: 10, geometryType: 'polygon', eightConnected: true, maxPixels: 1e9});
Export.table.toDrive({collection: zoneVec, description: 'presena_s2_skirun_zone', folder: 'Presena_GEE', fileFormat: 'GeoJSON'});
