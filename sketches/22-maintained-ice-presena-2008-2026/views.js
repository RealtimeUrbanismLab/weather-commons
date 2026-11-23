/* Sketch 22 · Do glaciers breathe? · shared views for index.html and explore.html.
   Plain SVG + vanilla JS. Reads only files in data/ and img/ (relative paths).
   Nothing here changes a value: every number on the page comes from a data file. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var V = (window.V22 = {});
  var SRC = (window.V22_SRC || "") + "#"; // where the numbered sources live ("" on index, "index.html" on explore)

  // ---------- small helpers ----------
  function fmt(n) { return n == null || isNaN(n) ? "–" : Math.round(n).toLocaleString("en-GB"); }
  function k(n) { return Math.round(n / 1000) + "k"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function tag(kind) {
    var cls = /claimed|reported/i.test(kind) ? " soft" : /not known/i.test(kind) ? " dot" : /calculated|reanalysed|synthetic/i.test(kind) ? " calc" : "";
    return '<span class="tag' + cls + '">' + esc(kind) + "</span>";
  }
  function src(ids) {
    if (!ids) return "";
    return String(ids).split(/\s*,\s*/).map(function (s) { var n = s.replace(/^s/, ""); return '<sup><a href="' + SRC + s + '">' + n + "</a></sup>"; }).join('<sup>,</sup>');
  }
  function el(name, attrs, parent) { var e = document.createElementNS(NS, name); for (var a in attrs) e.setAttribute(a, attrs[a]); if (parent) parent.appendChild(e); return e; }
  function text(parent, x, y, s, attrs) { var t = el("text", Object.assign({ x: x, y: y, "font-size": 11, fill: "currentColor" }, attrs || {}), parent); t.textContent = s; return t; }
  function getJSON(p) { return fetch(p).then(function (r) { if (!r.ok) throw new Error(p); return r.json(); }); }
  function getText(p) { return fetch(p).then(function (r) { if (!r.ok) throw new Error(p); return r.text(); }); }
  function parseCSV(t) {
    var rows = [], lines = t.trim().split(/\r?\n/), head = lines.shift().split(",");
    lines.forEach(function (line) {
      var out = [], cur = "", q = false;
      for (var i = 0; i < line.length; i++) { var c = line[i]; if (c === '"') q = !q; else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c; }
      out.push(cur); var r = {}; head.forEach(function (h, j) { r[h] = out[j] || ""; }); rows.push(r);
    });
    return rows;
  }
  function doyFromJun1(date) { var d = new Date(date + "T12:00:00Z"), j = new Date(date.slice(0, 4) + "-06-01T12:00:00Z"); return Math.round((d - j) / 864e5); }
  var SPAN = 138; // 1 June to 17 October

  // ---------- data ----------
  V.load = function () {
    var D = {};
    var opt = function (p, f) { return f(p).catch(function () { return null; }); };
    return Promise.all([
      getJSON("data/years.json"), getJSON("data/claims.json"), getJSON("data/area_s2.json"), getJSON("data/observations_s2.json"),
      getText("data/qa.csv"), getJSON("data/parameters.json"), opt("data/weather_summer_2021.json", getJSON), getJSON("data/actors.json"),
      getJSON("data/assertions.json"), opt("data/outlines_s2.geojson", getJSON), opt("data/skirun_zone.geojson", getJSON), opt("img/years/index.json", getJSON),
      opt("data/weather_summers.json", getJSON)
    ]).then(function (r) {
      D.years = r[0]; D.claims = r[1]; D.area = r[2]; D.obs = r[3].observations; D.qa = {};
      parseCSV(r[4]).forEach(function (q) { D.qa[+q.year] = q; });
      D.params = r[5]; D.weather = r[6]; D.weatherSummers = r[12]; D.actors = r[7]; D.assert = r[8]; D.outlines = r[9]; D.zone = r[10]; D.img = r[11] || {};
      D.byYear = {}; D.years.years.forEach(function (y) { D.byYear[y.year] = y; });
      D.areaByYear = {}; D.area.years.forEach(function (a) { D.areaByYear[a.year] = a; });
      D.qaOk = function (y) { var q = D.qa[y]; return !q || q.verdict === "ok"; };
      D.claimById = {}; D.claims.claims.forEach(function (c) { D.claimById[c.id] = c; });
      return D;
    });
  };

  // ---------- 1. Eleven breaths ----------
  V.breaths = function (box, D) {
    var max = 0; D.obs.forEach(function (o) { max = Math.max(max, o.fleece_best_m2 || 0); });
    max = Math.ceil(max / 20000) * 20000;
    var grid = document.createElement("div"); grid.className = "breaths"; box.appendChild(grid);
    for (var y = 2016; y <= 2026; y++) {
      var ok = D.qaOk(y), q = D.qa[y] || {}, a = D.areaByYear[y];
      var pts = D.obs.filter(function (o) { return o.year === y; }).map(function (o) { return { x: doyFromJun1(o.date), v: o.fleece_best_m2 || 0, d: o.date }; }).sort(function (p, q) { return p.x - q.x; });
      var fig = document.createElement("figure"); fig.className = "breath" + (ok ? "" : " notok"); grid.appendChild(fig);
      var W = 200, H = 96, x0 = 4, x1 = 196, y0 = 80, y1 = 8;
      var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Visible fleece area per clear scene, summer " + y }, fig);
      var px = function (x) { return x0 + (x1 - x0) * Math.max(-2, Math.min(SPAN, x)) / SPAN; }, py = function (v) { return y0 - (y0 - y1) * v / max; };
      el("line", { x1: x0, x2: x1, y1: y0, y2: y0, stroke: "currentColor", "stroke-width": 1, opacity: 0.4 }, svg);
      [0, 30, 61, 92, 122].forEach(function (m, i) { el("line", { x1: px(m), x2: px(m), y1: y0, y2: y0 + 3, stroke: "currentColor", opacity: 0.4 }, svg); text(svg, px(m) + 2, y0 + 12, ["Jun", "Jul", "Aug", "Sep", "Oct"][i], { "font-size": 9, opacity: 0.6 }); });
      var d = "", prev = null;
      pts.forEach(function (p) { d += (prev && p.x - prev.x <= 16 ? "L" : "M") + px(p.x).toFixed(1) + " " + py(p.v).toFixed(1) + " "; prev = p; });
      el("path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linejoin": "round" }, svg);
      pts.forEach(function (p) { el("circle", { cx: px(p.x), cy: py(p.v), r: 1.8, fill: "currentColor" }, svg).appendChild(Object.assign(document.createElementNS(NS, "title"), { textContent: p.d + ": " + fmt(p.v) + " m²" })); });
      if (a) { var sx = px(doyFromJun1(a.date)); el("line", { x1: sx, x2: sx, y1: y1 - 4, y2: y0, stroke: "currentColor", "stroke-dasharray": "2 2", opacity: 0.7 }, svg); el("circle", { cx: sx, cy: py(a.best_m2), r: 4, fill: "none", stroke: "currentColor", "stroke-width": 1.5 }, svg); }
      var cap = document.createElement("figcaption");
      cap.innerHTML = "<b>" + y + "</b> " + (ok ? "" : '<span class="verdict">' + esc(q.verdict) + "</span>") + '<span class="muted"> · ' + pts.length + " clear views</span>";
      fig.appendChild(cap);
    }
    var note = document.createElement("p"); note.className = "small";
    note.innerHTML = tag("Calculated") + "Visible fleece area (best estimate) in each Sentinel-2 scene with a clear view of the run, 1 June to 17 October, same scale for all years (0–" + fmt(max) + " m²). A dot is a clear view; the line breaks where there was none for more than 16 days. The ring marks the scene used for the yearly figure. Grey years failed the visual check (snow) and are not validated. Early-summer values may count old snow as fleece." + src("s8");
    box.appendChild(note);
  };

  // ---------- 2. Area chart 2008–2026 ----------
  V.areaChart = function (box, D) {
    var W = 680, H = 300, x0 = 60, x1 = 664, y0 = 260, y1 = 16, MAX = 120000;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Covered area per summer 2008 to 2026 by kind of source" }, box);
    var px = function (y) { return x0 + (x1 - x0) * (y - 2008 + 0.5) / 19; }, py = function (v) { return y0 - (y0 - y1) * v / MAX; };
    for (var v = 0; v <= MAX; v += 20000) { el("line", { x1: x0, x2: x1, y1: py(v), y2: py(v), stroke: "currentColor", opacity: v ? 0.12 : 0.5 }, svg); text(svg, x0 - 6, py(v) + 4, v ? k(v) : "0", { "text-anchor": "end", "font-size": 10, opacity: 0.7 }); }
    text(svg, 4, 12, "m²", { "font-size": 10, opacity: 0.7 });
    for (var y = 2008; y <= 2026; y++) {
      text(svg, px(y), y0 + 16, String(y).slice(2), { "text-anchor": "middle", "font-size": 10, opacity: 0.8 });
      var r = D.byYear[y] || {}, a = D.areaByYear[y], ok = D.qaOk(y), g = el("g", { opacity: a && !ok ? 0.35 : 1 }, svg);
      if (a) {
        el("line", { x1: px(y), x2: px(y), y1: py(a.lower_m2), y2: py(a.upper_m2), stroke: "currentColor", "stroke-width": 7, opacity: 0.35 }, g);
        el("line", { x1: px(y) - 6, x2: px(y) + 6, y1: py(a.best_m2), y2: py(a.best_m2), stroke: "currentColor", "stroke-width": 2 }, g);
        if (!ok) text(svg, px(y), py(a.upper_m2) - 5, (D.qa[y] || {}).verdict || "", { "text-anchor": "middle", "font-size": 9, opacity: 0.6 });
      }
      if (r.documented_m2) el("rect", { x: px(y) - 4.5, y: py(r.documented_m2) - 4.5, width: 9, height: 9, fill: "currentColor" }, svg);
      if (r.claimed_m2) el("circle", { cx: px(y), cy: py(r.claimed_m2), r: 4.5, fill: "var(--bg)", stroke: "currentColor", "stroke-width": 1.5 }, svg);
      if (r.reported_m2) el("path", { d: "M" + (px(y) + 9) + " " + (py(r.reported_m2) + 4) + " l5 -8 l5 8 z", fill: "none", stroke: "currentColor", "stroke-width": 1.2 }, svg);
      if (!r.documented_m2 && !r.claimed_m2 && !r.reported_m2 && !a) text(svg, px(y), y0 - 8, "not known", { "text-anchor": "start", "font-size": 9, opacity: 0.6, transform: "rotate(-90 " + px(y) + " " + (y0 - 8) + ")", dx: 0, dy: 3 });
    }
    var leg = document.createElement("div"); leg.className = "legend small";
    leg.innerHTML =
      '<span><svg width="14" height="14"><rect x="2.5" y="2.5" width="9" height="9" fill="currentColor"/></svg>' + tag("Documented") + "AINEVA, 2008–2011" + src("s2") + "</span>" +
      '<span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' + tag("Claimed (operator)") + "2014–2021" + src("s1") + "</span>" +
      '<span><svg width="14" height="14"><path d="M2 11 l5 -8 l5 8 z" fill="none" stroke="currentColor"/></svg>' + tag("Reported") + "“more than 100,000 m²”, 2020" + src("s10") + "</span>" +
      '<span><svg width="22" height="14"><line x1="11" x2="11" y1="1" y2="13" stroke="currentColor" stroke-width="7" opacity=".35"/><line x1="5" x2="17" y1="7" y2="7" stroke="currentColor" stroke-width="2"/></svg>' + tag("Calculated") + "Sentinel-2, lowest–highest with best estimate; grey = visual check failed" + src("s8") + "</span>";
    box.appendChild(leg);
  };

  // ---------- 3. Melt model (documented albedos; not tuned) ----------
  V.model = function (box, D) {
    var v = D.params.values;
    var P = { tf: v.tf.value, srf: v.srf.value, tt: v.tt.value, dens: (D.params.ice_density_kg_m3 || {}).value || 900 };
    var surf = [
      { id: "ice", label: "bare glacier", a: v.albedo_ice.value, why: v.albedo_ice.source },
      { id: "new", label: "new fleece", a: v.albedo_fleece.value, why: v.albedo_fleece.source },
      { id: "reused", label: "reused fleece", a: (v.albedo_fleece_reused || {}).value, why: (v.albedo_fleece_reused || {}).source }
    ].filter(function (s) { return s.a != null; });
    var W = null, kind = "Synthetic", label = "";
    if (D.weather && D.weather.days) { W = D.weather.days.map(function (d) { return { t: d.t_mean_c, g: d.sw_mean_wm2 }; }); kind = "Reanalysed"; label = D.weather.start + " to " + D.weather.end + ", " + D.weather.source; }
    if (!W) { box.innerHTML = "<p>Weather file missing: model not run.</p>"; return; }
    function melt(al) { var cum = 0, s = []; W.forEach(function (w) { var m = w.t > P.tt ? 24 * (P.tf * w.t + P.srf * (1 - al) * w.g) : 0; cum += Math.max(0, m) / 1000; s.push(cum); }); return s; }
    var S = {}; surf.forEach(function (s) { S[s.id] = melt(s.a); });
    var n = W.length, ice = S.ice[n - 1];
    var svgW = 680, H = 230, x0 = 40, x1 = 560, y0 = 205, y1 = 18, max = ice;
    var svg = el("svg", { viewBox: "0 0 " + svgW + " " + H, role: "img", "aria-label": "Cumulative melt over one summer, three surfaces" }, box);
    var px = function (i) { return x0 + (x1 - x0) * i / (n - 1); }, py = function (x) { return y0 - (y0 - y1) * x / max; };
    el("line", { x1: x0, x2: x1, y1: y0, y2: y0, stroke: "currentColor", opacity: 0.4 }, svg);
    text(svg, x0, 12, max.toFixed(2) + " m w.e.", { "font-size": 11 });
    surf.forEach(function (s, j) {
      var d = S[s.id].map(function (x, i) { return (i ? "L" : "M") + px(i).toFixed(1) + " " + py(x).toFixed(1); }).join(" ");
      el("path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": s.id === "new" ? 2.5 : 1.2, "stroke-dasharray": s.id === "reused" ? "5 4" : "" }, svg);
      text(svg, x1 + 6, py(S[s.id][n - 1]) + 4 + (s.id === "reused" ? 12 : 0), s.label + " (" + s.a.toFixed(2) + ")", { "font-size": 11 });
    });
    var cut = function (id) { return S[id] ? Math.round((1 - S[id][n - 1] / ice) * 100) : null; };
    var cNew = cut("new"), cRe = cut("reused"), step = (ice - S["new"][n - 1]) * 1000 / P.dens;
    var c = D.params.checks || {}, meas = c.melt_2010_covered_vs_unmodified_cm_we, stepObs = c.step_end_of_summer_2010_m;
    var measCut = meas ? Math.round((1 - meas.value[0] / meas.value[1]) * 100) : 52;
    var gap = cNew - measCut;
    var out = document.createElement("div"); out.className = "readout";
    out.innerHTML =
      "<div><strong>" + ice.toFixed(2) + "</strong>m w.e. melt on the bare glacier " + tag("Calculated") + "</div>" +
      "<div><strong>" + cNew + "%</strong>less melt under new fleece " + tag("Calculated") + "</div>" +
      (cRe != null ? "<div><strong>" + cRe + "%</strong>less melt under reused fleece " + tag("Calculated") + "</div>" : "") +
      "<div><strong>" + measCut + "%</strong>less ablation measured, 31 Jul–29 Aug 2010 " + tag("Documented") + src("s2") + "</div>" +
      "<div><strong>62–94%</strong>less melt in the 2012 fabric tests " + tag("Documented") + src("s9") + "</div>";
    box.appendChild(out);
    var p = document.createElement("p");
    p.innerHTML = "<b>How close is the model?</b> With the albedos measured on the glacier, the model gives " + cNew + "% less melt under new fleece: " +
      (Math.abs(gap) <= 5 ? "close to" : gap < 0 ? Math.abs(gap) + " points below" : gap + " points above") + " the " + measCut + "% measured in 2010, and " + (cNew < 62 ? "below" : "inside") + " the 62–94% of the 2012 tests. " +
      "Under reused fleece, whose albedo equals the glacier's, the model gives " + cRe + "%: it knows only albedo, not the insulation of the fabric, so it cannot explain any saving there. " +
      "Converted to ice, new fleece keeps about " + step.toFixed(1) + " m in this summer" + (stepObs ? "; the step seen after summer 2010 was about " + stepObs.value.join("–") + " m " + tag("Documented") + src("s2") : "") + ". The parameters were not tuned to match.";
    box.appendChild(p);
    var f = document.createElement("p"); f.className = "small";
    f.innerHTML = tag("Calculated") + tag(kind) + "Weather: " + esc(label) + ". Melt per day = 24 × (" + P.tf + " × T + " + P.srf + " × (1 − albedo) × sunlight) when T > " + P.tt + " °C (enhanced temperature-index model; factors still to check against the paper)." + src("s7") + " Albedos: " + surf.map(function (s) { return s.label + " " + s.a + " (" + esc(s.why) + ")"; }).join("; ") + ". Left out: wind, rain, summer snow, slope, shade, ice flow, insulation, grooming and snowmaking.";
    box.appendChild(f);
  };


  // ---------- 3b. The plinth: what the covers could have kept in place ----------
  V.plinth = function (box, D) {
    var WS = D.weatherSummers, v = D.params.values;
    if (!WS) { box.innerHTML = '<p class="small">' + tag("Not known") + "Weather for 2008–2026 missing (data/weather_summers.json): plinth not calculated.</p>"; return; }
    var P = { tf: v.tf.value, srf: v.srf.value, tt: v.tt.value }, dens = ((D.params.ice_density_kg_m3 || {}).value || 900) / 1000;
    function melt(days, al) { var m = 0; days.forEach(function (w) { if (w.t_mean_c > P.tt) m += Math.max(0, 24 * (P.tf * w.t_mean_c + P.srf * (1 - al) * w.sw_mean_wm2)); }); return m / 1000; }
    var c = D.params.checks || {}, meas = c.melt_2010_covered_vs_unmodified_cm_we, stepObs = c.step_end_of_summer_2010_m;
    var E_MID = meas ? 1 - meas.value[0] / meas.value[1] : 0.52, E_HIGH = 0.69;
    var rows = [];
    for (var y = 2008; y <= 2026; y++) {
      var yr = WS.years[String(y)]; if (!yr) continue;
      var bare = melt(yr.days, v.albedo_ice.value), eLow = 1 - melt(yr.days, v.albedo_fleece.value) / bare;
      rows.push({ y: y, bare: bare, lo: bare * eLow / dens, mid: bare * E_MID / dens, hi: bare * E_HIGH / dens, proj: false });
    }
    var hist = rows.slice(), base = rows.filter(function (r) { return r.y >= 2016; });
    for (var i = 0; i < 9; i++) { var b = base[i % base.length]; rows.push({ y: 2027 + i, bare: b.bare, lo: b.lo, mid: b.mid, hi: b.hi, proj: true, from: b.y }); }
    var cum = { lo: 0, mid: 0, hi: 0 }; rows.forEach(function (r) { cum.lo += r.lo; cum.mid += r.mid; cum.hi += r.hi; r.cLo = cum.lo; r.cMid = cum.mid; r.cHi = cum.hi; });
    var byY = {}; rows.forEach(function (r) { byY[r.y] = r; });

    // A · per summer
    var W = 680, H = 190, x0 = 46, x1 = 664, y0 = 160, y1 = 14, MAXS = 3;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Height kept by the cover each summer, 2008 to 2026" }, box);
    var px = function (y) { return x0 + (x1 - x0) * (y - 2008 + 0.5) / 19; }, py = function (m) { return y0 - (y0 - y1) * m / MAXS; };
    for (var m = 0; m <= MAXS; m++) { el("line", { x1: x0, x2: x1, y1: py(m), y2: py(m), stroke: "currentColor", opacity: m ? 0.12 : 0.5 }, svg); text(svg, x0 - 6, py(m) + 4, m + " m", { "text-anchor": "end", "font-size": 10, opacity: 0.7 }); }
    hist.forEach(function (r) {
      el("line", { x1: px(r.y), x2: px(r.y), y1: py(r.lo), y2: py(r.hi), stroke: "currentColor", "stroke-width": 7, opacity: 0.3 }, svg);
      el("line", { x1: px(r.y) - 6, x2: px(r.y) + 6, y1: py(r.mid), y2: py(r.mid), stroke: "currentColor", "stroke-width": 2 }, svg);
      text(svg, px(r.y), y0 + 14, String(r.y).slice(2), { "text-anchor": "middle", "font-size": 10, opacity: 0.8 });
    });
    if (stepObs) { var a = stepObs.value; el("rect", { x: px(2010) + 7, y: py(a[1]), width: 5, height: py(a[0]) - py(a[1]), fill: "currentColor" }, svg); text(svg, px(2010) + 15, py(a[1]) - 2, "step seen after summer 2010", { "font-size": 10 }); }
    var cap1 = document.createElement("p"); cap1.className = "small";
    cap1.innerHTML = tag("Calculated") + "Ice kept in place by the cover each summer (m of ice): melt of the bare glacier from the model, with the ERA5 weather of that summer (28 June to 14 September) " + tag("Reanalysed") + ", times the cover's efficacy. Low = albedo only (the model, about 28–30%); tick = 52% measured in 2010" + src("s2") + "; high = 69% from the 2012 tests" + src("s3") + ". Black bar: step of " + (stepObs ? stepObs.value.join("–") : "1.5–2") + " m observed at the end of summer 2010 " + tag("Documented") + src("s2") + ".";
    box.appendChild(cap1);

    // B · accumulated, with a year slider and a cross-section
    var wrap = document.createElement("div"); wrap.className = "plinth"; box.appendChild(wrap);
    var W2 = 680, H2 = 230, X0 = 46, X1 = 664, Y0 = 200, Y1 = 14, MAXC = 70;
    var s2 = el("svg", { viewBox: "0 0 " + W2 + " " + H2, role: "img", "aria-label": "Accumulated plinth height 2008 to 2035" }, wrap);
    var qx = function (y) { return X0 + (X1 - X0) * (y - 2008) / (2035 - 2008); }, qy = function (m) { return Y0 - (Y0 - Y1) * Math.min(m, MAXC) / MAXC; };
    for (var mm = 0; mm <= MAXC; mm += 10) { el("line", { x1: X0, x2: X1, y1: qy(mm), y2: qy(mm), stroke: "currentColor", opacity: mm ? 0.12 : 0.5 }, s2); text(s2, X0 - 6, qy(mm) + 4, mm + " m", { "text-anchor": "end", "font-size": 10, opacity: 0.7 }); }
    [2008, 2013, 2018, 2023, 2026, 2030, 2035].forEach(function (y) { text(s2, qx(y), Y0 + 14, y, { "text-anchor": "middle", "font-size": 10, opacity: 0.8 }); });
    el("rect", { x: qx(2026), y: Y1, width: qx(2035) - qx(2026), height: Y0 - Y1, fill: "currentColor", opacity: 0.05 }, s2);
    text(s2, qx(2026) + 6, Y1 + 12, "projection: 2016–2024 summers repeated", { "font-size": 10, opacity: 0.7 });
    text(s2, X0 + 8, Y1 + 12, "straight by construction: each summer is simply added", { "font-size": 10, opacity: 0.7 });
    function band(list, dash) {
      var top = list.map(function (r, i) { return (i ? "L" : "M") + qx(r.y).toFixed(1) + " " + qy(r.cHi).toFixed(1); }).join(" ");
      var bot = list.slice().reverse().map(function (r) { return "L" + qx(r.y).toFixed(1) + " " + qy(r.cLo).toFixed(1); }).join(" ");
      el("path", { d: top + " " + bot + "Z", fill: "currentColor", opacity: dash ? 0.1 : 0.2 }, s2);
      el("path", { d: list.map(function (r, i) { return (i ? "L" : "M") + qx(r.y).toFixed(1) + " " + qy(r.cMid).toFixed(1); }).join(" "), fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-dasharray": dash ? "5 4" : "" }, s2);
    }
    band(rows.filter(function (r) { return r.y <= 2026; }), false);
    band(rows.filter(function (r) { return r.y >= 2026; }), true);
    var claim = D.claimById.C09;
    if (claim) { el("circle", { cx: qx(2013), cy: qy(11), r: 5, fill: "var(--bg)", stroke: "currentColor", "stroke-width": 1.5 }, s2); text(s2, qx(2013) + 8, qy(11) - 6, "11 m after six seasons (C09)", { "font-size": 10 }); }
    var cursor = el("line", { y1: Y1, y2: Y0, stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "2 2" }, s2);

    var ctl = document.createElement("div"); ctl.className = "controls";
    ctl.innerHTML = '<label style="display:flex;gap:8px;align-items:center;flex:1 1 300px">Year <input type="range" min="2008" max="2035" step="1" value="2026" style="flex:1;accent-color:currentColor"> <output></output></label>';
    wrap.appendChild(ctl);
    var s3 = el("svg", { viewBox: "0 0 680 200", role: "img", "aria-label": "Cross-section of the ski run: plinth height in the chosen year" }, wrap);
    var read = document.createElement("p"); wrap.appendChild(read);
    var slider = ctl.querySelector("input"), out = ctl.querySelector("output");
    function sect(y) {
      var r = byY[y]; out.textContent = y; cursor.setAttribute("x1", qx(y)); cursor.setAttribute("x2", qx(y));
      while (s3.firstChild) s3.removeChild(s3.firstChild);
      var g0 = 170, sc = 140 / MAXC, cx = 340, half = 90, slope = 30;
      el("path", { d: "M20 " + g0 + " L660 " + g0, stroke: "currentColor", "stroke-width": 1.5 }, s3);
      text(s3, 24, g0 + 16, "uncovered ice next to the run (reference level)", { "font-size": 10, opacity: 0.7 });
      function trap(h, attrs) { var t = g0 - h * sc; return el("path", Object.assign({ d: "M" + (cx - half - slope) + " " + g0 + " L" + (cx - half) + " " + t + " L" + (cx + half) + " " + t + " L" + (cx + half + slope) + " " + g0 }, attrs), s3); }
      trap(r.cHi, { fill: "none", stroke: "currentColor", "stroke-dasharray": "3 3", opacity: 0.6 });
      trap(r.cMid, { fill: "currentColor", "fill-opacity": r.proj ? 0.15 : 0.3, stroke: "currentColor", "stroke-width": 1.5, "stroke-dasharray": r.proj ? "5 4" : "" });
      trap(r.cLo, { fill: "none", stroke: "currentColor", "stroke-dasharray": "3 3", opacity: 0.6 });
      text(s3, cx + half + 8, g0 - r.cMid * sc - 4, r.cMid.toFixed(0) + " m", { "font-size": 12, "font-weight": 700 });
      // a person, 1.8 m, for scale
      var ph = 1.8 * sc, pxp = 600; el("line", { x1: pxp, x2: pxp, y1: g0, y2: g0 - ph, stroke: "currentColor", "stroke-width": 2 }, s3); text(s3, pxp + 4, g0 - 2, "1.8 m", { "font-size": 9, opacity: 0.7 });
      read.innerHTML = (r.proj ? tag("Synthetic") : tag("Calculated")) + "<b>" + y + "</b>: if every summer since 2008 had kept its ice in place, and nothing else changed, the covered run would stand about <b>" + r.cMid.toFixed(0) + " m</b> above the ice beside it (" + r.cLo.toFixed(0) + "–" + r.cHi.toFixed(0) + " m)." + (r.proj ? " Projection: the summer of " + r.from + " repeated." : "");
    }
    slider.addEventListener("input", function () { sect(+slider.value); });
    sect(2026);
    var r13 = byY[2013], r10 = byY[2010];
    var note = document.createElement("p");
    note.innerHTML = "<b>What the arithmetic says.</b> For one summer it lands on the field: about " + r10.mid.toFixed(1) + " m for 2010 against the " + (stepObs ? stepObs.value.join("–") : "1.5–2") + " m step observed. After six seasons (2013) it gives " + r13.cLo.toFixed(0) + "–" + r13.cHi.toFixed(0) + " m, a range that holds the operator's 11 m (C09: \u201cuncovered ice dropped 11 m\u201d, read here as a step)" + src("s1") + ". By 2026 it reaches " + byY[2026].cLo.toFixed(0) + "–" + byY[2026].cHi.toFixed(0) + " m. A plinth that tall would be hard to miss; ice flow, snow laid and pushed every winter, grooming and covers that move between years all wear it down, and none of them is in the model. The LiDAR flights (2006–09, 2014, 2018) can measure the real step: that test is next.";
    var lin = document.createElement("p");
    lin.innerHTML = "<b>Why the line is straight, and the real plinth is not.</b> The model adds one summer to the next, so it can only draw a straight line (steeper in warmer summers). A real plinth should bend: the taller it stands, the more its sides are exposed to sun and wind, and the faster the ice creeps outwards under its own weight, so its growth should slow towards a height where gains and losses balance. Where the ice beside the run melts down to rock, the step loses its reference altogether. How fast it bends is " + tag("Not known") + "here: no curve is drawn without a measurement to fit it to.";
    box.appendChild(lin);
    box.appendChild(note);
    var lim = document.createElement("p"); lim.className = "small";
    lim.innerHTML = tag("Calculated") + "Same melt model as above (not tuned); m w.e. converted to m of ice at " + (dens * 1000) + " kg/m³. Assumes the same patch covered every summer, 28 June to 14 September. Not a measurement: an upper limit of what the covers could have kept, if nothing else moved the ice. " + tag("Synthetic") + "2027–2035 repeat the 2016–2024 summers; no warming trend is added.";
    box.appendChild(lim);
  };

  // ---------- 4. Actors ----------
  var POS = { glacier: [400, 215], province: [170, 60], lifts: [420, 60], comune: [670, 60], consorzio: [665, 150], unimi: [75, 165], unitn: [235, 245], linz: [130, 370], bolzano: [440, 370], biennale: [680, 320] };
  V.actors = function (box, D) {
    var W = 780, H = 400;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Actors who maintain the glacier and the links between them" }, box);
    var pair = {}, linkG = el("g", {}, svg), nodeG = el("g", {}, svg), labG = el("g", {}, svg);
    D.actors.links.forEach(function (l) {
      var a = POS[l.from], b = POS[l.to]; if (!a || !b) return;
      var key = [l.from, l.to].sort().join("-"), i = (pair[key] = (pair[key] || 0) + 1) - 1;
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, off = i ? 60 : 0;
      var cx = mx - dy / len * off, cy = my + dx / len * off;
      var unknown = l.known === false;
      el("path", { d: "M" + a[0] + " " + a[1] + " Q" + cx + " " + cy + " " + b[0] + " " + b[1], fill: "none", stroke: "currentColor", "stroke-width": unknown ? 1.2 : 1.4, "stroke-dasharray": unknown ? "1.5 3.5" : /claimed|reported/i.test(l.kind) ? "6 4" : "", opacity: unknown ? 0.7 : 0.85 }, linkG);
      var lx = (mx + cx) / 2, ly = (my + cy) / 2;
      var t = text(labG, lx, ly - 3, l.label, { "font-size": 9.5, "text-anchor": "middle", "paint-order": "stroke", stroke: "var(--bg)", "stroke-width": 3 });
      t.appendChild(Object.assign(document.createElementNS(NS, "title"), { textContent: l.kind + (l.source ? " · " + l.source : " · no source") }));
    });
    D.actors.actors.forEach(function (a) {
      var p = POS[a.id]; if (!p) return;
      var g = el("g", {}, nodeG), w = Math.max(a.label.length, (a.sub || "").length) * 6.2 + 16;
      el("rect", { x: p[0] - w / 2, y: p[1] - 17, width: w, height: 34, fill: "var(--bg)", stroke: "currentColor", "stroke-width": a.id === "glacier" ? 2.5 : 1, "stroke-dasharray": /reported/i.test(a.kind || "") ? "6 4" : "" }, g);
      text(g, p[0], p[1] - 2, a.label, { "font-size": 11, "font-weight": 700, "text-anchor": "middle" });
      text(g, p[0], p[1] + 11, a.sub || "", { "font-size": 9.5, "text-anchor": "middle", opacity: 0.7 });
      g.appendChild(Object.assign(document.createElementNS(NS, "title"), { textContent: (a.role || "") + (a.kind ? " · " + a.kind + " · " + a.source : "") }));
    });
    var leg = document.createElement("p"); leg.className = "legend small";
    leg.innerHTML = '<span><svg width="30" height="10"><line x1="0" x2="30" y1="5" y2="5" stroke="currentColor"/></svg>' + tag("Documented") + "</span>" +
      '<span><svg width="30" height="10"><line x1="0" x2="30" y1="5" y2="5" stroke="currentColor" stroke-dasharray="6 4"/></svg>' + tag("Reported") + " or " + tag("Claimed (operator)") + "</span>" +
      '<span><svg width="30" height="10"><line x1="0" x2="30" y1="5" y2="5" stroke="currentColor" stroke-dasharray="1.5 3.5"/></svg>' + tag("Not known") + "no source yet</span>";
    box.appendChild(leg);
    var ul = document.createElement("ul"); ul.className = "small actors-list";
    D.actors.links.forEach(function (l) {
      var A = D.actors.actors.filter(function (x) { return x.id === l.from; })[0], B = D.actors.actors.filter(function (x) { return x.id === l.to; })[0];
      var li = document.createElement("li"); li.innerHTML = tag(l.kind) + esc(A.label) + " → " + esc(B.label) + ": " + esc(l.label) + (l.source ? src(l.source) : ""); ul.appendChild(li);
    });
    var det = document.createElement("details"); det.className = "small"; det.innerHTML = "<summary>Every link, with its kind and source</summary>"; det.appendChild(ul); box.appendChild(det);
  };

  // ---------- 5. Claims ledger ----------
  var ORDER = ["supported", "published", "pending", "tension", "unverifiable", "contradicted"];
  V.counts = function (D) { var c = {}; D.claims.claims.forEach(function (x) { c[x.status] = (c[x.status] || 0) + 1; }); return ORDER.filter(function (s) { return c[s]; }).map(function (s) { return c[s] + " " + s; }).join(", "); };
  V.ledger = function (box, D, filters) {
    var state = "all", list = document.createElement("div");
    if (filters !== false) {
      var bar = document.createElement("div"); bar.className = "controls"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Filter claims by status");
      ["all"].concat(ORDER).forEach(function (s) {
        var n = s === "all" ? D.claims.claims.length : D.claims.claims.filter(function (c) { return c.status === s; }).length; if (!n) return;
        var b = document.createElement("button"); b.type = "button"; b.textContent = s + " (" + n + ")"; b.setAttribute("aria-pressed", s === state);
        b.onclick = function () { state = s; bar.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); draw(); }; bar.appendChild(b);
      });
      box.appendChild(bar);
    }
    box.appendChild(list);
    function draw() {
      list.innerHTML = '<table class="ledger"><thead><tr><th>Claim</th><th>Who</th><th>Status</th><th>Test so far</th></tr></thead><tbody>' +
        D.claims.claims.filter(function (c) { return state === "all" || c.status === state; }).map(function (c) {
          return "<tr><td><b>" + c.id + "</b> " + esc(c.text) + src(c.source) + "</td><td>" + esc(c.who) + '</td><td><span class="chip ' + c.status + '">' + c.status + "</span></td><td>" + esc(c.test) + "</td></tr>";
        }).join("") + "</tbody></table>";
    }
    draw();
  };

  // ---------- 6. Evidence stack (explore) ----------
  V.stack = function (box, panel, D) {
    var LAT0 = 46.2245, LON0 = 10.5806, mx = Math.cos(LAT0 * Math.PI / 180) * 111320, my = 110540;
    function loc(c) { return [(c[0] - LON0) * mx, (c[1] - LAT0) * my]; } // east, north in metres
    var rings = function (g) { return g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? [].concat.apply([], g.coordinates) : []; };
    var zone = D.zone ? D.zone.features.map(function (f) { return rings(f.geometry).map(function (r) { return r.map(loc); }); }) : [];
    var E0 = 1e9, E1 = -1e9, N0 = 1e9, N1 = -1e9;
    zone.forEach(function (rs) { rs.forEach(function (r) { r.forEach(function (p) { E0 = Math.min(E0, p[0]); E1 = Math.max(E1, p[0]); N0 = Math.min(N0, p[1]); N1 = Math.max(N1, p[1]); }); }); });
    if (E0 > E1) { E0 = -250; E1 = 250; N0 = -500; N1 = 500; }
    var m = 60; E0 -= m; E1 += m; N0 -= m; N1 += m;
    var s = 0.46, KX = 0.6, KY = 0.3, LEFT = 58, plateW = (N1 - N0) * s, plateD = (E1 - E0) * s, GAP = plateD * KY + 20;
    var SCALE_X = LEFT + plateW + plateD * KX + 20, SCALE_W = 150, MAXA = 120000;
    var years = []; for (var y = 2008; y <= 2026; y++) years.push(y);
    var top = 46, H = top + (years.length - 1) * GAP + plateD * KY + 40, W = SCALE_X + SCALE_W + 20;
    var svg = el("svg", { viewBox: "0 0 " + W.toFixed(0) + " " + H.toFixed(0), role: "img", "aria-label": "Stack of summers 2008 (bottom) to 2026 (top)" }, box);
    // north runs to the right along the plate, east goes into depth
    function P(e, n, base) { var u = (n - N0) * s, v = (E1 - e) * s; return [LEFT + u + v * KX, base - v * KY]; }
    function pathOf(r, base) { return r.map(function (c, i) { var p = P(c[0], c[1], base); return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ") + "Z"; }
    var ol = {}; if (D.outlines) D.outlines.features.forEach(function (f) { var p = f.properties, key = p.year + "-" + p.level; (ol[key] = ol[key] || []).push.apply(ol[key], rings(f.geometry).map(function (r) { return r.map(loc); })); });
    text(svg, SCALE_X, 14, "area, 0–120,000 m²", { "font-size": 13, opacity: 0.8 });
    text(svg, LEFT, 14, "north →   front-edge ticks: clear views, 1 Jun to 17 Oct", { "font-size": 13, opacity: 0.7 });
    var sel = null, groups = {};
    years.slice().forEach(function (y, i) {
      var base = top + (years.length - 1 - i) * GAP + plateD * KY; // front edge of the plate, 2008 at the bottom
      var r = D.byYear[y] || {}, a = D.areaByYear[y], ok = D.qaOk(y), known = r.documented_m2 || r.claimed_m2 || r.reported_m2 || a;
      var g = el("g", { class: "plate" + (a && !ok ? " notok" : "") + (known ? "" : " unknown"), tabindex: 0, role: "button", "aria-label": "Summer " + y }, svg);
      groups[y] = g;
      var c = [P(E1, N0, base), P(E1, N1, base), P(E0, N1, base), P(E0, N0, base)];
      el("path", { d: "M" + c.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L") + "Z", class: "slab", fill: "var(--bg)", "fill-opacity": 0.93, stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": known ? "" : "1.5 3" }, g);
      zone.forEach(function (rs) { rs.forEach(function (rr) { el("path", { d: pathOf(rr, base), fill: "currentColor", "fill-opacity": 0.07, stroke: "currentColor", "stroke-opacity": 0.18, "stroke-width": 0.6 }, g); }); });
      var lg = el("g", { opacity: a && !ok ? 0.35 : 1 }, g);
      (ol[y + "-outer"] || []).forEach(function (rr) { el("path", { d: pathOf(rr, base), fill: "none", stroke: "currentColor", "stroke-width": 0.9, "stroke-dasharray": "3 2" }, lg); });
      (ol[y + "-core"] || []).forEach(function (rr) { el("path", { d: pathOf(rr, base), fill: "currentColor", "fill-opacity": 0.75, stroke: "currentColor", "stroke-width": 0.6 }, lg); });
      // observation ticks on the front edge (1 Jun to 17 Oct along the plate)
      D.obs.filter(function (o) { return o.year === y; }).forEach(function (o) { var x = LEFT + plateW * Math.max(0, Math.min(SPAN, doyFromJun1(o.date))) / SPAN; el("line", { x1: x, x2: x, y1: base, y2: base + 4, stroke: "currentColor", "stroke-width": 0.8 }, lg); });
      text(g, 2, base - 2, String(y), { "font-size": 15, "font-weight": 700 });
      if (a && !ok) text(g, 2, base + 12, (D.qa[y] || {}).verdict || "", { "font-size": 12, opacity: 0.6, "font-style": "italic" });
      if (!known) text(g, LEFT + 8, base - 6, "not known" + (r.events ? " (see events)" : ""), { "font-size": 13, opacity: 0.7 });
      else if (!a && r.documented_m2) text(g, LEFT + 8, base - 6, "no outline: area only", { "font-size": 13, opacity: 0.7 });
      // area scale beside the plate
      var sy = base - 10, sx = function (v) { return SCALE_X + SCALE_W * v / MAXA; }, sg = el("g", {}, g);
      el("line", { x1: SCALE_X, x2: SCALE_X + SCALE_W, y1: sy, y2: sy, stroke: "currentColor", opacity: 0.25 }, sg);
      if (a) { var ag = el("g", { opacity: ok ? 1 : 0.35 }, sg); el("line", { x1: sx(a.lower_m2), x2: sx(a.upper_m2), y1: sy, y2: sy, stroke: "currentColor", "stroke-width": 6, opacity: 0.35 }, ag); el("line", { x1: sx(a.best_m2), x2: sx(a.best_m2), y1: sy - 5, y2: sy + 5, stroke: "currentColor", "stroke-width": 2 }, ag); }
      if (r.documented_m2) el("rect", { x: sx(r.documented_m2) - 4, y: sy - 4, width: 8, height: 8, fill: "currentColor" }, sg);
      if (r.claimed_m2) el("circle", { cx: sx(r.claimed_m2), cy: sy, r: 4, fill: "var(--bg)", stroke: "currentColor", "stroke-width": 1.4 }, sg);
      if (r.reported_m2) el("path", { d: "M" + (sx(r.reported_m2) - 4) + " " + (sy + 9) + " l4 -7 l4 7 z", fill: "none", stroke: "currentColor" }, sg);
      g.addEventListener("click", function () { show(y); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(y); } });
    });
    text(svg, LEFT, H - 8, "Faint shape on every plate: measured zone (calculated, 2016–2026), a reference only.", { "font-size": 13, opacity: 0.8 });
    function show(y) {
      if (sel) groups[sel].classList.remove("sel"); sel = y; groups[y].classList.add("sel");
      var r = D.byYear[y] || {}, a = D.areaByYear[y], q = D.qa[y], im = D.img[y], h = "<h3>Summer " + y + "</h3>";
      if (im) h += '<div class="witness">' + [["nat", "natural colour"], ["swir", "shortwave infrared"], ["frac", "fleece fraction"]].map(function (p) { return '<figure><img src="' + im[p[0]] + '" alt="Sentinel-2 ' + p[1] + ", " + im.date + '" width="240" height="240"><figcaption>' + p[1] + "</figcaption></figure>"; }).join("") + "</div><p class=\"small\">" + tag("Observed") + "Sentinel-2 scene " + esc(im.date) + src("s8") + "</p>";
      if (a) h += "<p>" + tag("Calculated") + "Visible fleece in the zone: <b>" + fmt(a.lower_m2) + "–" + fmt(a.upper_m2) + " m²</b>, best " + fmt(a.best_m2) + ". Fleece found outside the zone: " + fmt(a.outside_best_m2) + " m² (an error measure; part of it is real fleece just past the zone edge).</p>";
      if (q) h += "<p>Visual check: <b>" + esc(q.verdict) + "</b>. " + esc(q.note) + "</p>";
      if (a) h += '<p class="small">Status: ' + esc(a.status) + ".</p>";
      if (r.documented_m2) h += "<p>" + tag("Documented") + "Covered area " + fmt(r.documented_m2) + " m². " + esc(r.documented_note || "") + src(r.documented_source) + "</p>";
      if (r.claimed_m2) { var c = D.claimById[r.claim] || {}; h += "<p>" + tag("Claimed (operator)") + fmt(r.claimed_m2) + " m² (" + esc(r.claim) + ", status: " + esc(c.status) + ")" + src("s1") + "</p>"; }
      if (r.reported_m2) h += "<p>" + tag("Reported") + esc(r.reported_note || fmt(r.reported_m2) + " m²") + src("s10") + "</p>";
      (r.events || []).forEach(function (e) { h += "<p>" + tag(e.kind) + esc(e.text) + src(e.source) + "</p>"; });
      if (r.note) h += '<p class="small">' + esc(r.note) + "</p>";
      if (!r.documented_m2 && !r.claimed_m2 && !a) h += "<p>" + tag("Not known") + "No documented, claimed or calculated area for this summer.</p>";
      (D.years.pending_tests || []).filter(function (t) { return t.year === y; }).forEach(function (t) { h += '<p class="small">' + tag("Not known") + "Pending test, " + esc(t.label) + ": " + esc(t.text) + "</p>"; });
      panel.innerHTML = h;
    }
    show(2021);
  };
})();
