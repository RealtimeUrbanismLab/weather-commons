// Sketch 22 · Sentinel-2 visibility test for the Presena glacier cover
// Paste into the Google Earth Engine Code Editor (code.earthengine.google.com) and press Run.
// Question: can the white fleece be told apart from snow and ice at 10-20 m?
// Output: list of summer scenes, and for a chosen date three layers:
//   natural colour, SWIR composite, NDSI. Record the result in NOTES.md with scene IDs.

// 2012 test site, AINEVA Neve e Valanghe 80: 46.224523 N, 10.580597 E
var site = ee.Geometry.Point([10.580597, 46.224523]);
var aoi = site.buffer(1500).bounds();

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filter(ee.Filter.calendarRange(7, 9, 'month'))        // July to September
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40));

print('Summer scenes over Presena:', s2.size());
print('Dates and cloud cover:', s2.aggregate_array('system:index'),
      s2.aggregate_array('CLOUDY_PIXEL_PERCENTAGE'));

// Change these two dates after looking at the list: one with the cover on (July-August),
// one after removal (mid to late September), ideally the same year.
var COVER_ON  = '2023-08-12';
var COVER_OFF = '2023-09-21';

function sceneOn(dateStr) {
  var d = ee.Date(dateStr);
  return ee.Image(s2.filterDate(d, d.advance(1, 'day')).first());
}

function show(img, label) {
  Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 12000}, label + ' natural colour');
  Map.addLayer(img, {bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}, label + ' SWIR composite', false);
  var ndsi = img.normalizedDifference(['B3', 'B11']).rename('NDSI');
  Map.addLayer(ndsi, {min: -0.2, max: 1, palette: ['000000', 'ffffff']}, label + ' NDSI', false);
}

show(sceneOn(COVER_ON), 'ON ' + COVER_ON);
show(sceneOn(COVER_OFF), 'OFF ' + COVER_OFF);
Map.centerObject(aoi, 15);
Map.addLayer(site, {color: 'ffffff'}, '2012 test site');

// Profile along a line across the cover edge: draw a line with the geometry tool,
// name it 'transect', then uncomment:
// print(ui.Chart.image.byRegion(sceneOn(COVER_ON).select(['B3','B8','B11']),
//       transect, ee.Reducer.mean(), 10));
