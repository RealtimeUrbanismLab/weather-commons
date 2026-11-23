// Sketch 22 · Presena glacier cover · Earth Engine v3.6 (2026-11-23) · no drawing needed
// v3.6: FRESH SNOW. The 2018 scene chosen by v3.5 had fresh snow over the lower run, hiding the sheets.
// Each scene now also gets 'snow_run' (share of the run with B3 > 6000 and NDSI > 0.6), added to the score.
// v3.5: CLOUD SHADOWS. The cloud check on the ring does not see shadows (2017, 2018 had the lower run in
// shadow). Each scene now gets 'shadow_run' = share of the ski-run zone darker than B8 < 1500, and the
// yearly scene is the one with the lowest cloud + shadow. A table lists every candidate scene per year,
// and OVERRIDE lets you pick a date by hand after looking (write the reason in qa.csv).
// v3.4, after the visual check of 2016:
//  - ROCK: bright sunlit rock got low fleece fractions (0.15-0.3) and inflated the error. Fleece is now
//    counted only where the pixel is also bright in visible light (B3 > 2800), as fleece and its mixes
//    with ice or snow are; rock is darker.
//  - ZONE: the ski-run zone was built from 2021 only, so cover segments laid elsewhere in other years
//    fell outside it. The zone is now every pixel that looks like pure fleece in at least 30% of the fairly
//    clear late-summer scenes of 2016-2026 (clouds move, covers stay), within 700 m of the test site, plus 50 m.
// v3.3: yearly window 19 Jul - 28 Aug (avoids scenes after removal, like 2020-09-03); a map layer shows
// where 'fleece' is found OUTSIDE the ski-run zone, to tell real covers elsewhere from dirty snow.
// Changes from v3.1, after the first run:
//  - CLOUDS: s2cloudless marks the bright fleece itself as cloud, so filtering on clouds over the ski run
//    threw away the years with most fleece (2021 vanished). Clouds are now judged on a RING around the
//    ski run (300 m wide), where there is no fleece. Both values are reported.
//  - SNOW: fresh snow is brighter than every endmember, so unmixing explained it with 'fleece' and found
//    up to 700,000 m2 of 'fleece' outside the run. A SNOW endmember is added (fresh snow of 2021-10-10),
//    and fleece is only counted where the pixel is fleece-like in SWIR (NDSI < 0.7 and B11 > 600).
// Paste into a NEW script and press Run. Nothing to draw.
//
// Training pixels are chosen automatically on the reference scene (14 Aug 2021) with rules taken
// from the values measured with the Inspector on 4 Nov 2026 (TOA x1e4):
//   fleece : green B3 > 3500, SWIR B11 > 2500, NDSI < 0.3     (measured: B3 4617-5414, B11 3704-4684, NDSI ~0.1)
//   ice    : B3 > 2500, B11 < 600, NDSI > 0.7                 (measured: B3 2872-5468, B11 248-435, NDSI 0.83-0.90)
//   rock   : 1200 < B3 < 2600, B11 > 2000, NDSI < 0           (measured sunlit rock: B3 1939, B11 3008, NDSI -0.22)
//   shadow : B3 < 1000 and B8 < 1000                          (measured: B3 573-743)
// Only interior pixels are kept (edges removed). CHECK the 'seeds' layer by eye before trusting anything.
// The ski-run zone is the 2021 fleece plus an 80 m margin (or your own 'skirun' polygon, if you draw one).
//
// Produces: yearly LOWER / BEST / UPPER fleece area (2016-2026) with an error measure, an observation
// calendar, outlines per year, a filmstrip and a GIF. Run the three exports from the Tasks tab.

// ---------------------------------------------------------------------------
var REF_DATE = '2021-08-14';
var YEAR_DOY = [200, 240];        // 19 Jul - 28 Aug
var OBS_DOY = [152, 290];         // 1 Jun - 17 Oct
var YEAR_MAX_CLOUD = 0.05, OBS_MAX_CLOUD = 0.30;
var T_CORE = 0.75, T_OUTER = 0.15;
var OVERRIDE = {};   // e.g. {'2018': '2018-08-20'} after checking the candidates table
var RUN_MARGIN_M = 80;   // used only for the v3.1-3.3 zone; v3.4 builds the zone from all years
var SPEC = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
var BANDS = SPEC.concat(['NDSI']);
var site = ee.Geometry.Point([10.580597, 46.224523]);   // 2012 test site, AINEVA 80
var aoi = (typeof glacier !== 'undefined') ? ee.FeatureCollection(glacier).geometry() : site.buffer(900).bounds();
var pa = ee.Image.pixelArea();

var s2 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED').filterBounds(site);
var prob = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY').filterBounds(site);
function addIdx(img) { return img.addBands(img.normalizedDifference(['B3', 'B11']).rename('NDSI')); }
var ref = addIdx(ee.Image(s2.filterDate(REF_DATE, ee.Date(REF_DATE).advance(1, 'day')).first()));

// ----- automatic training seeds -----
var b3 = ref.select('B3'), b8 = ref.select('B8'), b11 = ref.select('B11'), nd = ref.select('NDSI');
var rawFleece = b3.gt(3500).and(b11.gt(2500)).and(nd.lt(0.3)).and(ee.Image.constant(1).clip(site.buffer(600)));
var raw = {
  1: rawFleece,
  2: b3.gt(2500).and(b11.lt(600)).and(nd.gt(0.7)),
  4: b3.gt(1200).and(b3.lt(2600)).and(b11.gt(2000)).and(nd.lt(0)),
  5: b3.lt(1000).and(b8.lt(1000))
};
function interior(m) { return m.and(m.focal_min({radius: 15, units: 'meters'})); }
var seeds = ee.Image(0)
  .where(interior(raw[4]), 4).where(interior(raw[5]), 5)
  .where(interior(raw[2]), 2).where(interior(raw[1]), 1)
  .rename('class').selfMask().clip(aoi).toInt();
print('Seed pixels per class (1 fleece, 2 ice, 4 rock, 5 shadow):',
  seeds.reduceRegion({reducer: ee.Reducer.frequencyHistogram(), geometry: aoi, scale: 10, maxPixels: 1e9}));

// Ski-run zone: your 'skirun' polygon if drawn, otherwise the 2021 fleece plus a margin.
var runMask = (typeof skirun !== 'undefined')
  ? ee.Image.constant(1).clip(ee.FeatureCollection(skirun).geometry()).mask()
  : (function () {
      var strict = function (img) {
        img = addIdx(img);
        return img.select('B3').gt(3500).and(img.select('B11').gt(2500)).and(img.select('NDSI').lt(0.3)).rename('n');
      };
      // Only fairly clear scenes (tile cloud < 10%), and a pixel must look like pure fleece in at least
      // 30% of them: a cover stays, a cloud does not come back to the same place that often.
      var clearish = s2.filter(ee.Filter.calendarRange(YEAR_DOY[0], YEAR_DOY[1], 'day_of_year'))
        .filter(ee.Filter.calendarRange(2016, 2026, 'year')).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));
      var freq = clearish.map(strict).mean();
      print('Scenes used to build the ski-run zone:', clearish.size());
      return freq.gte(0.3).and(ee.Image.constant(1).clip(site.buffer(700)))
        .focal_max({radius: 50, units: 'meters'}).clip(aoi);
    })();
runMask = ee.Image(runMask).unmask(0).gt(0).rename('run');
print('Ski-run zone area, m2:', runMask.multiply(pa).reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e9}).get('run'));

var training = ref.select(BANDS).addBands(seeds).stratifiedSample({
  numPoints: 150, classBand: 'class', region: aoi, scale: 10, seed: 22, geometries: true
});
var clf = ee.Classifier.smileRandomForest(100).train({features: training, classProperty: 'class', inputProperties: BANDS});

// Endmembers: mean spectrum of each seed class, fleece first.
var ORDER = [1, 2, 4, 5];   // snow endmember added below from the 2021-10-10 scene
var EM = ee.List(ORDER.map(function (k) {
  var d = ref.select(SPEC).updateMask(seeds.eq(k)).reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 10, maxPixels: 1e9});
  return ee.List(SPEC.map(function (b) { return d.get(b); }));
}));
var snowRef = addIdx(ee.Image('COPERNICUS/S2_HARMONIZED/20211010T100941_20211010T101728_T32TPS'));
var snowSeed = snowRef.select('NDSI').gt(0.8).and(snowRef.select('B3').gt(6000));
var snowD = snowRef.select(SPEC).updateMask(snowSeed).reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 10, maxPixels: 1e9});
EM = EM.add(ee.List(SPEC.map(function (b) { return snowD.get(b); })));
print('Endmembers (rows: fleece, ice, rock, shadow, snow; columns: B2 B3 B4 B8 B11 B12):', EM);
function fleeceFraction(img) {
  var gate = img.select('NDSI').lt(0.7).and(img.select('B11').gt(600)).and(img.select('B3').gt(2800));   // fleece-like in SWIR, bright in visible
  return img.select(SPEC).unmix(EM, true, true).select('band_0').clamp(0, 1).multiply(gate).rename('f');
}

// ----- clouds -----
function withCloud(col) {
  return ee.ImageCollection(ee.Join.saveFirst('cloud').apply({
    primary: col, secondary: prob,
    condition: ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
  }));
}
var ringMask = runMask.focal_max({radius: 300, units: 'meters'}).and(runMask.not());
function tagCloud(img) {
  var p = ee.Image(img.get('cloud')).select('probability').gt(50);
  var c = p.updateMask(ringMask).reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 20, maxPixels: 1e8}).get('probability');
  var cRun = p.updateMask(runMask).reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 20, maxPixels: 1e8}).get('probability');
  var sh = img.select('B8').lt(1500).updateMask(runMask).reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 20, maxPixels: 1e8}).get('B8');
  var ix = addIdx(img);
  var sn = ix.select('B3').gt(6000).and(ix.select('NDSI').gt(0.6)).rename('s').updateMask(runMask)
    .reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 20, maxPixels: 1e8}).get('s');
  var d = img.date();
  return img.set('cloud_frac', c, 'cloud_run', cRun, 'shadow_run', sh, 'snow_run', sn, 'score', ee.Number(c).add(ee.Number(sh)).add(ee.Number(sn)), 'date', d.format('YYYY-MM-dd'), 'year', d.get('year'), 'doy', d.getRelative('day', 'year').add(1));
}

// ----- 1. one best scene per year, area with bounds -----
var yearCol = withCloud(s2.filter(ee.Filter.calendarRange(YEAR_DOY[0], YEAR_DOY[1], 'day_of_year')))
  .map(tagCloud).filter(ee.Filter.lt('cloud_frac', YEAR_MAX_CLOUD));
var OVR = ee.Dictionary(OVERRIDE);
var best = ee.ImageCollection(ee.List.sequence(2016, 2026).map(function (y) {
  var key = ee.Number(y).format('%.0f');
  var c = ee.ImageCollection(ee.Algorithms.If(OVR.contains(key),
    yearCol.filter(ee.Filter.eq('date', OVR.get(key, ''))),
    yearCol.filter(ee.Filter.eq('year', y)).sort('score')));
  return ee.Algorithms.If(c.size().gt(0), c.first(), null);
}, true));
var cands = ee.FeatureCollection(yearCol.map(function (i) {
  return ee.Feature(null, {date: i.get('date'), cloud_ring: i.get('cloud_frac'), shadow_run: i.get('shadow_run'), snow_run: i.get('snow_run'), score: i.get('score')});
})).sort('date');
print('Candidate scenes per year (19 Jul - 28 Aug): pick by eye if needed, then use OVERRIDE',
  ui.Chart.feature.byFeature(cands, 'date', ['cloud_ring', 'shadow_run', 'snow_run', 'score']).setChartType('Table'));
print('Best scene per year (dates, cloud on the ring, cloud on the run, shadow on the run):', best.aggregate_array('date'), best.aggregate_array('cloud_frac'), best.aggregate_array('cloud_run'), best.aggregate_array('shadow_run'));
var refTagged = tagCloud(ee.Image(withCloud(s2.filterDate(REF_DATE, ee.Date(REF_DATE).advance(1, 'day'))).first()));
print('Diagnostic, 2021-08-14: cloud share on the ring vs on the ski run (fleece mistaken for cloud?)', refTagged.get('cloud_frac'), refTagged.get('cloud_run'));

var yearly = ee.FeatureCollection(best.map(function (img) {
  img = addIdx(ee.Image(img));
  var f = fleeceFraction(img);
  var st = ee.Image.cat([
    f.multiply(pa).updateMask(f.gte(T_OUTER)).rename('best'),
    f.gte(T_CORE).multiply(pa).rename('lower'),
    f.gte(T_OUTER).multiply(pa).rename('upper'),
    img.select(BANDS).classify(clf).eq(1).multiply(pa).rename('rf')
  ]);
  var inRun = st.updateMask(runMask).reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e9});
  var outRun = st.select('best').updateMask(runMask.not()).reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e9});
  return ee.Feature(null, {
    year: img.get('year'), date: img.get('date'), scene: img.get('system:index'), cloud_frac: img.get('cloud_frac'), cloud_run: img.get('cloud_run'), shadow_run: img.get('shadow_run'), snow_run: img.get('snow_run'),
    lower_m2: inRun.get('lower'), best_m2: inRun.get('best'), upper_m2: inRun.get('upper'), rf_m2: inRun.get('rf'),
    outside_best_m2: outRun.get('best')
  });
}));
print('1 · Yearly fleece area in the ski-run zone (calculated):', yearly);
print(ui.Chart.feature.byFeature({features: yearly, xProperty: 'year', yProperties: ['lower_m2', 'best_m2', 'upper_m2', 'outside_best_m2']})
  .setChartType('LineChart').setOptions({title: 'Fleece area: lower / best / upper in the ski-run zone; best outside (error)', pointSize: 4, hAxis: {format: '####'}, vAxis: {viewWindow: {min: 0}}}));
Export.table.toDrive({collection: yearly, description: 'presena_s2_yearly', fileFormat: 'CSV'});

// ----- 2. observation calendar -----
var obs = withCloud(s2.filter(ee.Filter.calendarRange(OBS_DOY[0], OBS_DOY[1], 'day_of_year')).filter(ee.Filter.calendarRange(2016, 2026, 'year')))
  .map(tagCloud).filter(ee.Filter.lt('cloud_frac', OBS_MAX_CLOUD))
  .map(function (img) {
    img = addIdx(img);
    var f = fleeceFraction(img);
    var snowMask = img.select('NDSI').gt(0.4).and(img.select('B11').lt(1500));
    var r = ee.Image.cat([f.multiply(pa).updateMask(f.gte(T_OUTER)).rename('best'), snowMask.rename('snow')])
      .updateMask(runMask)
      .reduceRegion({reducer: ee.Reducer.sum().combine(ee.Reducer.mean(), null, true), geometry: aoi, scale: 10, maxPixels: 1e9});
    return ee.Feature(null, {
      date: img.get('date'), year: img.get('year'), doy: img.get('doy'), scene: img.get('system:index'),
      cloud_frac: img.get('cloud_frac'), fleece_best_m2: r.get('best_sum'), snow_frac: r.get('snow_mean')
    });
  });
obs = ee.FeatureCollection(obs).distinct('date');
print('2 · Usable summer scenes for the calendar:', obs.size());
Export.table.toDrive({collection: obs, description: 'presena_s2_observations', fileFormat: 'CSV'});

// ----- 3. outlines per year -----
var outlines = ee.FeatureCollection(best.map(function (img) {
  img = addIdx(ee.Image(img));
  var f = fleeceFraction(img);
  function vec(mask, level) {
    return mask.and(runMask).selfMask().toInt()
      .reduceToVectors({geometry: aoi, scale: 10, geometryType: 'polygon', eightConnected: true, maxPixels: 1e9})
      .map(function (ft) { return ee.Feature(ft.geometry().simplify(5)).set({year: img.get('year'), level: level, date: img.get('date')}); });
  }
  return vec(f.gte(T_CORE), 'core').merge(vec(f.gte(T_OUTER), 'outer'));
})).flatten();
Export.table.toDrive({collection: outlines, description: 'presena_s2_outlines', fileFormat: 'GeoJSON'});

// ----- 4. filmstrip and GIF -----
var region = site.buffer(450).bounds();
var nat = best.map(function (img) { return ee.Image(img).visualize({bands: ['B4', 'B3', 'B2'], min: 0, max: 9000}); });
var swir = best.map(function (img) { return ee.Image(img).visualize({bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}); });
print('4 · Filmstrip, natural colour (years in date order):', nat.getFilmstripThumbURL({region: region, dimensions: 240, crs: 'EPSG:3857'}));
print('Filmstrip, SWIR composite:', swir.getFilmstripThumbURL({region: region, dimensions: 240, crs: 'EPSG:3857'}));
print('GIF, SWIR composite (1 frame per second):', swir.getVideoThumbURL({region: region, dimensions: 480, framesPerSecond: 1, crs: 'EPSG:3857'}));

// ----- map: check the seeds first -----
Map.centerObject(site, 15);
Map.addLayer(ref, {bands: ['B4', 'B3', 'B2'], min: 0, max: 9000}, 'REF natural colour 2021-08-14', false);
Map.addLayer(ref, {bands: ['B12', 'B11', 'B8'], min: 0, max: 8000}, 'REF SWIR composite', false);
Map.addLayer(seeds, {min: 1, max: 5, palette: ['ff00ff', '00aaff', 'ffffff', 'aa7744', '000000']}, 'seeds (magenta fleece, blue ice, brown rock, black shadow)');
Map.addLayer(runMask.selfMask(), {palette: ['ffff00'], opacity: 0.3}, 'ski-run zone');
var refF = fleeceFraction(ref);
Map.addLayer(refF.updateMask(refF.gte(T_OUTER)).clip(aoi), {min: 0, max: 1, palette: ['000000', 'ffffff']}, 'REF fleece fraction', false);

var SHOW_YEAR = 2024;
var qa = addIdx(ee.Image(best.filter(ee.Filter.eq('year', SHOW_YEAR)).first()));
print('QA ' + SHOW_YEAR + ' (date, id, cloud share):', qa.get('date'), qa.get('system:index'), qa.get('cloud_frac'));
Map.addLayer(qa, {bands: ['B4', 'B3', 'B2'], min: 0, max: 9000}, 'QA ' + SHOW_YEAR + ' natural colour', false);
var qaF = fleeceFraction(qa);
Map.addLayer(qaF.updateMask(qaF.gte(T_OUTER)).clip(aoi), {min: 0, max: 1, palette: ['000000', 'ffffff']}, 'QA ' + SHOW_YEAR + ' fleece fraction', false);
Map.addLayer(qaF.updateMask(qaF.gte(T_OUTER).and(runMask.not())).clip(aoi), {min: 0, max: 1, palette: ['ff0000', 'ffff00']}, 'QA ' + SHOW_YEAR + ' fleece OUTSIDE the zone (red-yellow)');

// Limits: seeds come from rules on one date (check them by eye); TOA reflectance; the ski-run zone is
// derived from 2021, so a cover laid elsewhere in other years would count as "outside" (it is reported).

// QA menu: choose a year, the map updates without re-running the script.
var qaLayers = [];
function showQA(y) {
  qaLayers.forEach(function (l) { Map.layers().remove(l); });
  qaLayers = [];
  var img = addIdx(ee.Image(best.filter(ee.Filter.eq('year', y)).first()));
  var f = fleeceFraction(img);
  qaLayers.push(Map.addLayer(img, {bands: ['B4', 'B3', 'B2'], min: 0, max: 9000}, 'QA ' + y + ' natural colour'));
  qaLayers.push(Map.addLayer(f.updateMask(f.gte(T_OUTER).and(runMask)).clip(aoi), {min: 0, max: 1, palette: ['000000', 'ffffff']}, 'QA ' + y + ' fleece inside the zone'));
  qaLayers.push(Map.addLayer(f.updateMask(f.gte(T_OUTER).and(runMask.not())).clip(aoi), {min: 0, max: 1, palette: ['ff0000', 'ffff00']}, 'QA ' + y + ' fleece OUTSIDE the zone'));
  print('QA ' + y + ' (date, id):', img.get('date'), img.get('system:index'));
}
var qaYears = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
Map.add(ui.Panel([ui.Label('QA year'), ui.Select({items: qaYears, placeholder: 'choose', onChange: function (v) { showQA(parseInt(v, 10)); }})],
  ui.Panel.Layout.flow('horizontal'), {position: 'top-center'}));
