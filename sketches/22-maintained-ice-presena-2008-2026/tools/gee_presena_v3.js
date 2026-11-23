// Sketch 22 · Presena glacier cover · Earth Engine v3 (2026-11-14)
// Paste into a NEW script in the Code Editor. Copy your geometry imports from the v2 script
// (open v2, select all imports in the Imports panel, copy, paste into v3), then fix them as below.
//
// Geometry imports needed (FeatureCollections, properties 'class' and 'label'):
//   fleece  class 1   bright in visible AND bright in SWIR (whitish in the SWIR composite)
//   ice     class 2   clean ice/snow, blue in the SWIR composite
//   rock    class 4   SUNLIT rock and debris (visible ~2000, B11 ~2500-3000 in the Inspector)
//   shadow  class 5   optional: the dark polygons that were wrongly called 'rock' in v2
//   snow    class 3   optional
//   glacier           any geometry: everything that could have been covered over the years
//   skirun            any geometry: the zone where covers are laid, with a margin of a few tens of metres
//
// What it produces (all "calculated"; check every year by eye before trusting it):
//   1. Per year 2016-2026: fleece area inside 'skirun' as LOWER / BEST / UPPER, from the fleece
//      fraction of each pixel (linear spectral unmixing), plus the random-forest count and the
//      fleece found OUTSIDE the ski run (an error measure).            -> Export 'presena_s2_yearly'
//   2. Every summer scene (1 Jun - 17 Oct) with < 30% cloud over the ski run: date, cloud,
//      snow share, best fleece area. For the observation calendar.       -> Export 'presena_s2_observations'
//   3. Outlines per year: 'core' (fraction >= 0.75) and 'outer' (>= 0.15). -> Export 'presena_s2_outlines'
//   4. A filmstrip and an animation of the yearly scenes (natural colour and SWIR), printed as links.
// Run the three exports from the Tasks tab. Files go to your Google Drive.

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
var REF_DATE = '2021-08-14';                 // training scene (cover on, snow-free)
var YEAR_DOY = [213, 248];                   // 1 Aug - 5 Sep: one best scene per year
var OBS_DOY = [152, 290];                    // 1 Jun - 17 Oct: observation calendar
var YEAR_MAX_CLOUD = 0.05;                   // share of cloudy pixels over the ski run
var OBS_MAX_CLOUD = 0.30;
var T_CORE = 0.75, T_OUTER = 0.15;           // fleece fraction thresholds for lower/upper bounds
var SPEC = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
var BANDS = SPEC.concat(['NDSI']);
var site = ee.Geometry.Point([10.580597, 46.224523]);   // 2012 test site, AINEVA 80

var ready = (typeof fleece !== 'undefined') && (typeof ice !== 'undefined') &&
            (typeof rock !== 'undefined') && (typeof skirun !== 'undefined');
if (!ready) {
  print('Missing imports. Needed: fleece, ice, rock (sunlit), skirun. Optional: shadow, snow, glacier.');
} else {
  main();
}

function main() {
  var aoi = (typeof glacier !== 'undefined') ? ee.FeatureCollection(glacier).geometry() : site.buffer(900).bounds();
  var run = ee.FeatureCollection(skirun).geometry();
  var outside = aoi.difference(run, 1);
  print('Areas, m2 (glacier, ski run):', aoi.area(1), run.area(1));

  // ----- data -----
  var s2 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED').filterBounds(run);
  var prob = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY').filterBounds(run);
  function withCloud(col) {
    return ee.ImageCollection(ee.Join.saveFirst('cloud').apply({
      primary: col, secondary: prob,
      condition: ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
    }));
  }
  function addIdx(img) { return img.addBands(img.normalizedDifference(['B3', 'B11']).rename('NDSI')); }
  function tagCloud(img) {
    var p = ee.Image(img.get('cloud')).select('probability');
    var c = p.gt(50).reduceRegion({reducer: ee.Reducer.mean(), geometry: run, scale: 20, maxPixels: 1e8}).get('probability');
    var d = img.date();
    return img.set('cloud_frac', c, 'date', d.format('YYYY-MM-dd'), 'year', d.get('year'), 'doy', d.getRelative('day', 'year').add(1));
  }

  // ----- training -----
  var ref = addIdx(ee.Image(s2.filterDate(REF_DATE, ee.Date(REF_DATE).advance(1, 'day')).first()));
  var classes = [fleece, ice, rock];
  if (typeof snow !== 'undefined') { classes.push(snow); }
  if (typeof shadow !== 'undefined') { classes.push(shadow); }
  var training = classes[0];
  for (var i = 1; i < classes.length; i++) { training = training.merge(classes[i]); }

  print('Training signatures on ' + REF_DATE + ' (one line per polygon; check each class is consistent)',
    ui.Chart.image.regions({image: ref.select(BANDS), regions: training, reducer: ee.Reducer.mean(), scale: 10, seriesProperty: 'label'})
      .setOptions({title: 'Training signatures', lineWidth: 2, pointSize: 4}));

  var clf = ee.Classifier.smileRandomForest(100).train({
    features: ref.select(BANDS).sampleRegions({collection: training, properties: ['class'], scale: 10}),
    classProperty: 'class', inputProperties: BANDS
  });

  // Endmembers for unmixing: mean spectrum of each class on the reference scene. Fleece first.
  function meanSpec(fc) {
    var d = ref.select(SPEC).reduceRegion({reducer: ee.Reducer.mean(), geometry: ee.FeatureCollection(fc).geometry(), scale: 10, maxPixels: 1e8});
    return ee.List(SPEC.map(function (b) { return d.get(b); }));
  }
  var EM = ee.List(classes.map(meanSpec));
  print('Endmembers (fleece first), TOA x1e4:', EM);

  function fleeceFraction(img) {
    return img.select(SPEC).unmix(EM, true, true).select('band_0').clamp(0, 1).rename('f');
  }

  // ----- 1. one best scene per year -----
  var yearCol = withCloud(s2.filter(ee.Filter.calendarRange(YEAR_DOY[0], YEAR_DOY[1], 'day_of_year')))
    .map(tagCloud).filter(ee.Filter.lt('cloud_frac', YEAR_MAX_CLOUD));
  var best = ee.ImageCollection(ee.List.sequence(2016, 2026).map(function (y) {
    var c = yearCol.filter(ee.Filter.eq('year', y)).sort('cloud_frac');
    return ee.Algorithms.If(c.size().gt(0), c.first(), null);
  }, true));
  print('Best scene per year (date, cloud share over the ski run):', best.aggregate_array('date'), best.aggregate_array('cloud_frac'));

  var pa = ee.Image.pixelArea();
  var yearly = ee.FeatureCollection(best.map(function (img) {
    img = addIdx(ee.Image(img));
    var f = fleeceFraction(img);
    var st = ee.Image.cat([
      f.multiply(pa).updateMask(f.gte(T_OUTER)).rename('best'),
      f.gte(T_CORE).multiply(pa).rename('lower'),
      f.gte(T_OUTER).multiply(pa).rename('upper'),
      img.select(BANDS).classify(clf).eq(1).multiply(pa).rename('rf')
    ]);
    var inRun = st.reduceRegion({reducer: ee.Reducer.sum(), geometry: run, scale: 10, maxPixels: 1e9});
    var outRun = st.select('best').reduceRegion({reducer: ee.Reducer.sum(), geometry: outside, scale: 10, maxPixels: 1e9});
    return ee.Feature(null, {
      year: img.get('year'), date: img.get('date'), scene: img.get('system:index'), cloud_frac: img.get('cloud_frac'),
      lower_m2: inRun.get('lower'), best_m2: inRun.get('best'), upper_m2: inRun.get('upper'), rf_m2: inRun.get('rf'),
      outside_best_m2: outRun.get('best')
    });
  }));
  print('1 · Yearly fleece area inside the ski run (calculated):', yearly);
  print(ui.Chart.feature.byFeature({features: yearly, xProperty: 'year', yProperties: ['lower_m2', 'best_m2', 'upper_m2', 'outside_best_m2']})
    .setChartType('LineChart').setOptions({title: 'Fleece area: lower / best / upper inside the ski run; best outside (error)', pointSize: 4, hAxis: {format: '####'}, vAxis: {viewWindow: {min: 0}}}));
  Export.table.toDrive({collection: yearly, description: 'presena_s2_yearly', fileFormat: 'CSV'});

  // ----- 2. observation calendar -----
  var obs = withCloud(s2.filter(ee.Filter.calendarRange(OBS_DOY[0], OBS_DOY[1], 'day_of_year')).filter(ee.Filter.calendarRange(2016, 2026, 'year')))
    .map(tagCloud).filter(ee.Filter.lt('cloud_frac', OBS_MAX_CLOUD))
    .map(function (img) {
      img = addIdx(img);
      var f = fleeceFraction(img);
      var snowMask = img.select('NDSI').gt(0.4).and(img.select('B11').lt(1500));
      var r = ee.Image.cat([f.multiply(pa).updateMask(f.gte(T_OUTER)).rename('best'), snowMask.rename('snow')])
        .reduceRegion({reducer: ee.Reducer.sum().combine(ee.Reducer.mean(), null, true), geometry: run, scale: 10, maxPixels: 1e9});
      return ee.Feature(null, {
        date: img.get('date'), year: img.get('year'), doy: img.get('doy'), scene: img.get('system:index'),
        cloud_frac: img.get('cloud_frac'), fleece_best_m2: r.get('best_sum'), snow_frac: r.get('snow_mean')
      });
    });
  obs = ee.FeatureCollection(obs).distinct('date');   // two tiles on the same day count once
  print('2 · Observations for the calendar (number of usable summer scenes):', obs.size());
  Export.table.toDrive({collection: obs, description: 'presena_s2_observations', fileFormat: 'CSV'});

  // ----- 3. outlines per year -----
  var outlines = ee.FeatureCollection(best.map(function (img) {
    img = addIdx(ee.Image(img));
    var f = fleeceFraction(img);
    function vec(mask, level) {
      return mask.selfMask().toInt().reduceToVectors({geometry: run, scale: 10, geometryType: 'polygon', eightConnected: true, maxPixels: 1e9})
        .map(function (ft) { return ee.Feature(ft.geometry().simplify(5)).set({year: img.get('year'), level: level, date: img.get('date')}); });
    }
    return vec(f.gte(T_CORE), 'core').merge(vec(f.gte(T_OUTER), 'outer'));
  })).flatten();
  Export.table.toDrive({collection: outlines, description: 'presena_s2_outlines', fileFormat: 'GeoJSON'});

  // ----- 4. filmstrip and animation -----
  var region = run.buffer(250).bounds();
  var nat = best.map(function (img) { return ee.Image(img).visualize({bands: ['B4', 'B3', 'B2'], min: 0, max: 9000}); });
  var swir = best.map(function (img) { return ee.Image(img).visualize({bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}); });
  print('4 · Filmstrip, natural colour (one frame per year in date order; open and save as PNG):',
    nat.getFilmstripThumbURL({region: region, dimensions: 240, crs: 'EPSG:3857'}));
  print('Filmstrip, SWIR composite:', swir.getFilmstripThumbURL({region: region, dimensions: 240, crs: 'EPSG:3857'}));
  print('Animation, SWIR composite (GIF, 1 frame/s):', swir.getVideoThumbURL({region: region, dimensions: 480, framesPerSecond: 1, crs: 'EPSG:3857'}));

  // ----- map -----
  Map.centerObject(run, 15);
  var refF = fleeceFraction(ref);
  Map.addLayer(ref, {bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}, 'REF SWIR composite', false);
  Map.addLayer(refF.updateMask(refF.gte(T_OUTER)).clip(aoi), {min: 0, max: 1, palette: ['000000', 'ffffff']}, 'REF fleece fraction');
  Map.addLayer(ee.Image().paint(ee.FeatureCollection([ee.Feature(run)]), 0, 2), {palette: ['ffff00']}, 'ski run');

  // QA: look at one year at a time
  var SHOW_YEAR = 2024;
  var qa = addIdx(ee.Image(best.filter(ee.Filter.eq('year', SHOW_YEAR)).first()));
  print('QA ' + SHOW_YEAR + ':', qa.get('date'), qa.get('system:index'), qa.get('cloud_frac'));
  Map.addLayer(qa, {bands: ['B4', 'B3', 'B2'], min: 0, max: 9000}, 'QA ' + SHOW_YEAR + ' natural colour', false);
  var qaF = fleeceFraction(qa);
  Map.addLayer(qaF.updateMask(qaF.gte(T_OUTER)).clip(aoi), {min: 0, max: 1, palette: ['000000', 'ffffff']}, 'QA ' + SHOW_YEAR + ' fleece fraction', false);
}

// Limits, to copy into the method note:
// - Unmixing uses endmembers from one date; ageing, dirt and wet snow change real spectra.
// - TOA reflectance; no terrain or atmospheric correction.
// - LOWER counts only near-pure pixels, UPPER every pixel with some fleece: the truth lies between,
//   unless the classes themselves are wrong. 'outside_best_m2' should stay close to zero.
// - The operator reports fabric area; folds, overlaps and buried sheets make visible area differ.
