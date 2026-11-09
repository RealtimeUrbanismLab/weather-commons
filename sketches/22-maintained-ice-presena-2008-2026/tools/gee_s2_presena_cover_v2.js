// Sketch 22 / Track B · Presena glacier cover · Sentinel-2 test, v2.7 (2026-11-04: optional skirun polygon, fleece inside vs outside as error check)
// Paste into the Google Earth Engine Code Editor (code.earthengine.google.com) and press Run.
//
// Three steps, run in order (the script detects what you have drawn):
//   STEP 1  Find clear summer scenes over the glacier and look at them (always runs).
//   STEP 2  Draw small training polygons on a clear scene -> spectral signatures chart.
//           Can the fleece be told apart from snow and ice? (runs when the polygons exist)
//   STEP 3  Classify one late-summer scene per year 2016-2026 and compare the fleece area
//           with the operator's claimed areas (runs when STEP 2 polygons exist).
//
// Data: Sentinel-2 L1C top-of-atmosphere (COPERNICUS/S2_HARMONIZED), available from 2015,
// and s2cloudless cloud probability (COPERNICUS/S2_CLOUD_PROBABILITY). Kind: observed.
// Everything this script computes is "calculated" and must be checked by eye.

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
// 2012 test site, AINEVA Neve e Valanghe 80
var site = ee.Geometry.Point([10.580597, 46.224523]);

// Area of interest: if you draw a polygon named 'glacier' around the glacier (and nothing
// else bright, like snowfields on rock), it is used; otherwise a 900 m box around the site.
// Works whether 'glacier' was imported as a Geometry or as a FeatureCollection.
var aoi = (typeof glacier !== 'undefined') ? ee.FeatureCollection(glacier).geometry() : site.buffer(900).bounds();
print('AOI area, m2 (upper bound for any fleece area measured inside it):', aoi.area(1));

// Window for "cover on and bare ice around it": day of year 213-248 = 1 Aug - 5 Sep.
var DOY_START = 213, DOY_END = 248;

// The scene you want to look at in STEP 1 and use for training in STEP 2.
// Change it after reading the printed list of clear scenes.
var REF_DATE = '2020-08-20';

// Operator's claimed fabric area (m2), read 2026-11-04 on pontedilegnotonale.com (claim C10).
var CLAIMED = ee.Dictionary({
  '2016': 50000, '2017': 65000, '2018': 80000, '2019': 100000, '2020': 110000, '2021': 110000
});

var BANDS = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDSI'];

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
var s2 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
  .filterBounds(aoi)
  .filter(ee.Filter.calendarRange(DOY_START, DOY_END, 'day_of_year'));

var prob = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY').filterBounds(aoi);

var joined = ee.ImageCollection(ee.Join.saveFirst('cloud').apply({
  primary: s2,
  secondary: prob,
  condition: ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
}));

function addIdx(img) {
  return img.addBands(img.normalizedDifference(['B3', 'B11']).rename('NDSI'));
}

// Mean cloud probability inside the AOI (tile-level cloud cover says little about one glacier).
// Note: s2cloudless can mistake bright snow for cloud. Always check the chosen scenes by eye.
function addAoiCloud(img) {
  var p = ee.Image(img.get('cloud')).select('probability');
  var c = p.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 20, maxPixels: 1e8})
    .get('probability');
  return img.set('aoi_cloud', c, 'date', img.date().format('YYYY-MM-dd'));
}

var scenes = joined.map(addAoiCloud).filter(ee.Filter.lt('aoi_cloud', 20)).sort('system:time_start');

// ---------------------------------------------------------------------------
// STEP 1 - clear scenes and a first look
// ---------------------------------------------------------------------------
print('STEP 1 · Clear late-summer scenes over the AOI (aoi_cloud < 20):', scenes.size());
print('Dates', scenes.aggregate_array('date'));
print('AOI cloud %', scenes.aggregate_array('aoi_cloud'));
print('Scene IDs (copy into the evidence log)', scenes.aggregate_array('system:index'));

// Readable table: one row per clear scene (the same date can appear twice: two overlapping tiles).
var sceneTable = ee.FeatureCollection(scenes.map(function (i) {
  return ee.Feature(null, {date: i.get('date'), aoi_cloud: i.get('aoi_cloud'), id: i.get('system:index')});
}));
print('Clear scenes, table (copy the date you want into REF_DATE)',
  ui.Chart.feature.byFeature(sceneTable, 'id', ['date', 'aoi_cloud']).setChartType('Table'));

// Reference scene: REF_DATE if it is in the clear list, otherwise the clearest scene of 2019-2021.
var refCol = scenes.filter(ee.Filter.eq('date', REF_DATE)).sort('aoi_cloud');
var fallback = scenes.filter(ee.Filter.calendarRange(2019, 2021, 'year')).sort('aoi_cloud');
var ref = addIdx(ee.Image(ee.Algorithms.If(refCol.size().gt(0), refCol.first(), fallback.first())));
print('Reference scene actually used (date, id, AOI cloud %):',
  ref.get('date'), ref.get('system:index'), ref.get('aoi_cloud'));

Map.centerObject(aoi, 15);
Map.addLayer(ref, {bands: ['B4', 'B3', 'B2'], min: 0, max: 12000}, 'REF natural colour');
Map.addLayer(ref, {bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}, 'REF SWIR composite', false);
Map.addLayer(ref.select('NDSI'), {min: -0.2, max: 1, palette: ['000000', 'ffffff']}, 'REF NDSI', false);
// After-removal comparison: same year, mid-September to mid-October, before lasting snow.
// What changes between REF and OFF on the ski run is the best first clue to where the cover was.
// 2021-10-10 had fresh snow everywhere: look for a snow-free scene in September.
var OFF_START = '2021-09-06', OFF_END = '2021-09-30';
var off = addIdx(ee.Image(ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
  .filterBounds(site).filterDate(OFF_START, OFF_END)
  .sort('CLOUDY_PIXEL_PERCENTAGE').first()));
print('OFF scene used (date, id):', off.date().format('YYYY-MM-dd'), off.get('system:index'));
Map.addLayer(off, {bands: ['B4', 'B3', 'B2'], min: 0, max: 12000}, 'OFF natural colour (after removal)', false);
Map.addLayer(off, {bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}, 'OFF SWIR composite', false);

Map.addLayer(ee.Image().paint(ee.FeatureCollection([ee.Feature(aoi)]), 0, 2), {palette: ['ffff00']}, 'AOI');
Map.addLayer(site, {color: 'ff0000'}, '2012 test site');

// ---------------------------------------------------------------------------
// STEP 2 - spectral signatures (draw the polygons first)
// ---------------------------------------------------------------------------
// With the geometry tools, on the REF scene, draw small polygons (5-15 pixels each, well inside
// each surface) and import each set as a FeatureCollection with two properties:
//   fleece : class = 1, label = 'fleece'   (the white rectangles on the ski run)
//   ice    : class = 2, label = 'ice'      (bare grey ice next to the cover)
//   snow   : class = 3, label = 'snow'     (old snow / firn, upper glacier)
//   rock   : class = 4, label = 'rock'     (SUNLIT rock and debris: needed, it is bright in SWIR like fleece)
//   shadow : class = 5, label = 'shadow'   (optional: dark shaded slopes)
// Draw from the REF date only. If you cannot see any white rectangle, the answer to the
// visibility question at this date is "not visible": write it down, try another date.

// fleece and ice are required; snow and rock are optional (late-summer scenes may have no snow left).
var haveTraining = (typeof fleece !== 'undefined') && (typeof ice !== 'undefined');

if (!haveTraining) {
  print('STEP 2 · Draw the fleece and ice polygons (snow, rock optional; see comments), then Run again.');
} else {
  var training = fleece.merge(ice);
  if (typeof snow !== 'undefined') { training = training.merge(snow); }
  if (typeof rock !== 'undefined') { training = training.merge(rock); }
  if (typeof shadow !== 'undefined') { training = training.merge(shadow); }

  print('STEP 2 · Mean reflectance per surface (x 10000) and NDSI',
    ui.Chart.image.regions({
      image: ref.select(BANDS),
      regions: training,
      reducer: ee.Reducer.mean(),
      scale: 10,
      seriesProperty: 'label'
    }).setOptions({title: 'Presena, reference scene (see console for its date): spectral signatures', lineWidth: 2, pointSize: 4}));

  // Read the chart: if fleece and snow overlap in every band, the cover is not separable
  // at this date. If they differ clearly in one band (often B11/B12 or NDSI), it is.

  // -------------------------------------------------------------------------
  // STEP 3 - one classified scene per year, fleece area vs claimed area
  // -------------------------------------------------------------------------
  var samples = ref.select(BANDS).sampleRegions({collection: training, properties: ['class'], scale: 10});
  var clf = ee.Classifier.smileRandomForest(50).train({
    features: samples, classProperty: 'class', inputProperties: BANDS
  });

  var refClass = ref.select(BANDS).classify(clf);
  Map.addLayer(refClass.clip(aoi), {min: 1, max: 5, palette: ['ff00ff', '4a90d9', 'ffffff', '8b5a2b', '000000']},
    'REF classified (magenta = fleece)');

  // Claimed area for a year, or -1 when the operator gives none (Dictionary.get has no null default).
  function claimedFor(key) {
    return ee.Algorithms.If(CLAIMED.contains(key), CLAIMED.get(key), -1);
  }

  var years = ee.List.sequence(2016, 2026);
  var perYear = ee.FeatureCollection(years.map(function (y) {
    y = ee.Number(y);
    var key = y.format('%.0f');
    var col = scenes.filter(ee.Filter.calendarRange(y, y, 'year')).sort('aoi_cloud');
    return ee.Algorithms.If(col.size().gt(0),
      (function () {
        var img = addIdx(ee.Image(col.first()));
        var cls = img.select(BANDS).classify(clf);
        var area = cls.eq(1).multiply(ee.Image.pixelArea())
          .reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e9})
          .get('classification');
        // Optional 'skirun' polygon (the zone where covers are laid): fleece found outside it is
        // most likely misclassified debris, cloud or snow, so it measures the error.
        var inRun = (typeof skirun !== 'undefined')
          ? cls.eq(1).multiply(ee.Image.pixelArea())
              .reduceRegion({reducer: ee.Reducer.sum(), geometry: ee.FeatureCollection(skirun).geometry(), scale: 10, maxPixels: 1e9})
              .get('classification')
          : -1;
        return ee.Feature(null, {
          year: y, fleece_m2: area, fleece_in_skirun_m2: inRun,
          fleece_outside_skirun_m2: (typeof skirun !== 'undefined') ? ee.Number(area).subtract(inRun) : -1,
          claimed_m2: claimedFor(key),
          scene: img.get('system:index'), date: img.get('date'), aoi_cloud: img.get('aoi_cloud')
        });
      })(),
      ee.Feature(null, {year: y, fleece_m2: null, claimed_m2: claimedFor(key), scene: 'no clear scene'})
    );
  }));

  print('STEP 3 · Classified fleece area per year (calculated) vs operator claim', perYear);
  print(ui.Chart.feature.byFeature({features: perYear, xProperty: 'year',
    yProperties: (typeof skirun !== 'undefined') ? ['fleece_in_skirun_m2', 'fleece_outside_skirun_m2', 'claimed_m2'] : ['fleece_m2', 'claimed_m2']})
    .setChartType('LineChart')
    .setOptions({title: 'Presena: fleece area, Sentinel-2 (calculated) vs operator claim', pointSize: 5,
      vAxis: {title: 'm2', viewWindow: {min: 0}}, hAxis: {format: '####'}}));
  // claimed_m2 = -1 means: no figure from the operator for that year (hidden by the axis minimum).

  Export.table.toDrive({collection: perYear, description: 'presena_fleece_area_2016_2026', fileFormat: 'CSV'});

  // Quality check, one year at a time: the scene used for SHOW_YEAR and its classification.
  // Look for clouds, fresh snow, shadows or debris counted as fleece before trusting a number.
  var SHOW_YEAR = 2024;
  var qa = addIdx(ee.Image(scenes.filter(ee.Filter.calendarRange(SHOW_YEAR, SHOW_YEAR, 'year')).sort('aoi_cloud').first()));
  print('QA scene for ' + SHOW_YEAR + ' (date, id, AOI cloud %):', qa.get('date'), qa.get('system:index'), qa.get('aoi_cloud'));
  Map.addLayer(qa, {bands: ['B4', 'B3', 'B2'], min: 0, max: 12000}, 'QA ' + SHOW_YEAR + ' natural colour', false);
  Map.addLayer(qa, {bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}, 'QA ' + SHOW_YEAR + ' SWIR composite', false);
  Map.addLayer(qa.select(BANDS).classify(clf).clip(aoi), {min: 1, max: 5, palette: ['ff00ff', '4a90d9', 'ffffff', '8b5a2b', '000000']},
    'QA ' + SHOW_YEAR + ' classified (magenta = fleece)', false);
}

// Limits, to copy into the method note:
// - TOA reflectance, one training date, random forest: classes can drift between years
//   (dirty fleece late in summer, fresh snow, shadows). Check every yearly scene by eye.
// - 10-20 m pixels: edges are mixed; the area is approximate (expect tens of percent).
// - The operator reports fabric area; overlaps, folds and buried sheets make visible area differ.
// - Bright surfaces other than fleece inside the AOI are counted: draw a tight 'glacier' polygon.
