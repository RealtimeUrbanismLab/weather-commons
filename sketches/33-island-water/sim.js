// Simulate: a rooftop cistern on Sifnos, filled by daily ERA5 rain, 1991-2026.
// The model is in sim-core.js. This file reads the controls and draws the views.
// Rain: reanalysed. Roof, tank, people, use: synthetic (the reader's choice). Results: calculated.
(function () {
  "use strict";
  const { simulate, days } = window.SimCore;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const pct = (x) => fmt(100 * x) + "%";
  // A range, low to high, shown once when both ends round the same.
  function range(a, b, f) {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return f(lo) === f(hi) ? f(lo) : f(lo) + "–" + f(hi);
  }
  const pctRange = (a, b) => range(a, b, (v) => fmt(100 * v)) + "%";
  const TANKS = Array.from({ length: 40 }, (_, i) => i + 1);
  const MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

  let rain, ctx, dates, years, factor;

  // ---- small SVG helpers (text always set with textContent)
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs = {}) {
    const t = el("text", Object.assign({ x, y }, attrs), parent);
    t.textContent = s;
    return t;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  // Draw at the width the chart really has, so text stays readable on a phone.
  function chartWidth(svg) { return Math.round(Math.max(320, Math.min(680, svg.parentElement.clientWidth || 680))); }
  function scale(d0, d1, r0, r1) { return (v) => r0 + (v - d0) * (r1 - r0) / (d1 - d0); }
  function linePath(xs, ys, x, y) {
    return xs.map((v, i) => (i ? "L" : "M") + x(v).toFixed(1) + "," + y(ys[i]).toFixed(1)).join("");
  }
  function hGrid(g, y, ticks, x0, x1, label) {
    for (const t of ticks) {
      el("line", { x1: x0, x2: x1, y1: y(t), y2: y(t), class: "grid" }, g);
      text(g, x0 - 6, y(t) + 4, label(t), { class: "tick", "text-anchor": "end" });
    }
  }
  function tip(wrap, svg, px, py, rows) {
    let t = wrap.querySelector(".tip");
    if (!t) { t = document.createElement("div"); t.className = "tip"; wrap.appendChild(t); }
    t.replaceChildren();
    for (const [value, label] of rows) {
      const r = document.createElement("div");
      const b = document.createElement("strong"); b.textContent = value;
      r.append(b, document.createTextNode(" " + label));
      t.appendChild(r);
    }
    const box = svg.getBoundingClientRect(), k = box.width / svg.viewBox.baseVal.width;
    const left = Math.min(px * k + 12, box.width - t.offsetWidth - 4);
    t.style.left = Math.max(0, left) + "px";
    t.style.top = (py * k) + "px";
    t.hidden = false;
  }
  function hideTip(wrap) { const t = wrap.querySelector(".tip"); if (t) t.hidden = true; }

  // ---- settings from the controls
  function settings() {
    const people = +$("people").value, litres = +$("litres").value;
    const share = +document.querySelector("input[name=use]:checked").value;
    return { roof: +$("roof").value, tank: +$("tank").value, people, litres, share,
             need: people * litres * share };
  }

  // ---- 1. tank-size curve, with cost in its own panel below (same x, separate y)
  function drawCurve(s) {
    const svg = $("curve"), wrap = svg.parentElement;
    clear(svg);
    const W = chartWidth(svg), narrow = W < 520;
    const L = 52, R = narrow ? 92 : 150, T = 12, H1 = narrow ? 170 : 200, gap = 34, H2 = 70, B = 30;
    svg.setAttribute("viewBox", `0 0 ${W} ${T + H1 + gap + H2 + B}`);
    const x = scale(1, 40, L, W - R);
    const y = scale(0, 1, T + H1, T);
    const hi = TANKS.map((t) => simulate(rain.mm, { roof: s.roof, tank: t, need: s.need }).share);
    const lo = TANKS.map((t) => simulate(rain.mm, { roof: s.roof, tank: t, need: s.need, factor }).share);
    const g = el("g", {}, svg);
    hGrid(g, y, [0, 0.25, 0.5, 0.75, 1], L, W - R, pct);
    // band between the two rain versions
    el("path", { d: linePath(TANKS, hi, x, y) + linePath([...TANKS].reverse(), [...lo].reverse(), x, y).replace("M", "L") + "Z",
                 class: "band" }, g);
    el("path", { d: linePath(TANKS, hi, x, y), class: "line water" }, g);
    el("path", { d: linePath(TANKS, lo, x, y), class: "line thin water" }, g);
    text(g, W - R + 8, y(hi[39]) + 4, "ERA5 rain", { class: "direct" });
    text(g, W - R + 8, y(lo[39]) + 16, `ERA5 −${fmt(100 * (1 - factor))}%`, { class: "direct" });
    text(g, W - R + 8, y(lo[39]) + 30, "(Chios check)", { class: "direct muted-text" });
    // the chosen tank
    el("line", { x1: x(s.tank), x2: x(s.tank), y1: T, y2: T + H1, class: "pick" }, g);
    el("circle", { cx: x(s.tank), cy: y(hi[s.tank - 1]), r: 4.5, class: "dot water" }, g);
    el("circle", { cx: x(s.tank), cy: y(lo[s.tank - 1]), r: 4.5, class: "dot hollow" }, g);
    // cost panel
    const costs = ctx.house_cost_eur_by_tank_m3.value;
    const ct = Object.keys(costs).map(Number), cv = ct.map((k) => costs[k]);
    const y2 = scale(0, 6000, T + H1 + gap + H2, T + H1 + gap);
    hGrid(g, y2, [0, 3000, 6000], L, W - R, (v) => "€" + fmt(v));
    el("path", { d: linePath(ct, cv, x, y2), class: "line thin" }, g);
    ct.forEach((k, i) => el("circle", { cx: x(k), cy: y2(cv[i]), r: 3.5, class: "dot" }, g));
    text(g, W - R + 8, y2(cv[cv.length - 1]) + 4, narrow ? "Cost (Chios)" : "Cost, Chios 2022", { class: "direct" });
    // x axis
    for (const t of narrow ? [1, 10, 20, 30, 40] : [1, 5, 10, 15, 20, 25, 30, 35, 40]) {
      text(g, x(t), T + H1 + gap + H2 + 18, String(t), { class: "tick", "text-anchor": "middle" });
    }
    text(g, (L + W - R) / 2, T + H1 + gap + H2 + 30, "tank size, m³", { class: "tick", "text-anchor": "middle" });
    text(g, L, T + H1 + gap - 8, "Cost of a house system (tank, pump, pipes, filter)", { class: "tick" });
    // crosshair
    const cross = el("line", { y1: T, y2: T + H1 + gap + H2, class: "cross", visibility: "hidden" }, svg);
    const hit = el("rect", { x: L, y: T, width: W - R - L, height: H1 + gap + H2, class: "hit" }, svg);
    hit.addEventListener("pointermove", (ev) => {
      const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
      const q = p.matrixTransform(svg.getScreenCTM().inverse());
      const t = Math.max(1, Math.min(40, Math.round(1 + (q.x - L) * 39 / (W - R - L))));
      cross.setAttribute("x1", x(t)); cross.setAttribute("x2", x(t)); cross.setAttribute("visibility", "visible");
      const rows = [[t + " m³", "tank"], [pctRange(lo[t - 1], hi[t - 1]), "of the use met"]];
      if (costs[t]) rows.push(["€" + fmt(costs[t]), "house system, Chios 2022"]);
      tip(wrap, svg, x(t), q.y, rows);
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(wrap); });
    // table view
    const tb = $("curve-table").tBodies[0];
    tb.replaceChildren();
    TANKS.forEach((t, i) => {
      const tr = tb.insertRow();
      [t, pct(hi[i]), pct(lo[i]), costs[t] ? "€" + fmt(costs[t]) : ""].forEach((v) => (tr.insertCell().textContent = v));
    });
    return { hi, lo };
  }

  // ---- 2. one water year (October to September): rain above, tank level below
  function drawYear(s, run) {
    const svg = $("year"), wrap = svg.parentElement;
    clear(svg);
    const y0 = +$("wyear").value;
    const i0 = years[y0].i0, i1 = years[y0].i1;
    const n = i1 - i0;
    const W = chartWidth(svg), L = 52, R = 12, T = 12, H1 = 80, gap = 26, H2 = 120, rug = 16, B = 26;
    svg.setAttribute("viewBox", `0 0 ${W} ${T + H1 + gap + H2 + rug + B}`);
    const x = scale(0, n, L, W - R);
    const maxMm = Math.max(20, ...rain.mm.slice(i0, i1).map((v) => v || 0));
    const yr = scale(0, Math.ceil(maxMm / 10) * 10, T + H1, T);
    const yt = scale(0, s.tank, T + H1 + gap + H2, T + H1 + gap);
    const g = el("g", {}, svg);
    hGrid(g, yr, [0, Math.ceil(maxMm / 10) * 10], L, W - R, (v) => fmt(v) + " mm");
    hGrid(g, yt, [0, s.tank], L, W - R, (v) => fmt(v) + " m³");
    const bw = Math.max(1, (W - R - L) / n - 0.4);
    for (let i = i0; i < i1; i++) {
      const v = rain.mm[i] || 0;
      if (v > 0) el("rect", { x: x(i - i0), y: yr(v), width: bw, height: yr(0) - yr(v), class: "bar water" }, g);
    }
    let d = "", dry = 0;
    for (let i = i0; i < i1; i++) d += (i === i0 ? "M" : "L") + x(i - i0 + 0.5).toFixed(1) + "," + yt(run.level[i]).toFixed(1);
    el("path", { d: d + `L${x(n - 0.5)},${yt(0)}L${x(0.5)},${yt(0)}Z`, class: "band water" }, g);
    el("path", { d, class: "line water" }, g);
    const ry = T + H1 + gap + H2 + 4;
    for (let i = i0; i < i1; i++) {
      if (run.got[i] < s.need / 1000 - 1e-9) { dry++; el("rect", { x: x(i - i0), y: ry, width: bw, height: rug - 6, class: "bar" }, g); }
    }
    text(g, L, T + H1 + gap - 8, "Water in the tank", { class: "tick" });
    MONTHS.forEach((m, k) => {
      if (W < 520 && k % 2) return;   // every other month on a phone
      const day = Math.round(k * n / 12);
      text(g, x(day + n / 24), T + H1 + gap + H2 + rug + 20, m, { class: "tick", "text-anchor": "middle" });
    });
    // crosshair
    const cross = el("line", { y1: T, y2: ry + rug - 6, class: "cross", visibility: "hidden" }, svg);
    const hit = el("rect", { x: L, y: T, width: W - R - L, height: H1 + gap + H2 + rug, class: "hit" }, svg);
    hit.addEventListener("pointermove", (ev) => {
      const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
      const q = p.matrixTransform(svg.getScreenCTM().inverse());
      const k = Math.max(0, Math.min(n - 1, Math.floor((q.x - L) * n / (W - R - L))));
      const i = i0 + k;
      cross.setAttribute("x1", x(k + 0.5)); cross.setAttribute("x2", x(k + 0.5)); cross.setAttribute("visibility", "visible");
      tip(wrap, svg, x(k + 0.5), q.y, [
        [dates[i].toISOString().slice(0, 10), ""],
        [fmt(rain.mm[i] || 0, 1) + " mm", "rain (reanalysed)"],
        [fmt(run.level[i], 1) + " m³", "in the tank at day's end"],
        [fmt(run.got[i] * 1000) + " of " + fmt(s.need) + " L", "from the tank"],
      ]);
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(wrap); });
    const total = rain.mm.slice(i0, i1).reduce((a, v) => a + (v || 0), 0);
    $("year-note").textContent = `${years[y0].label}: ${fmt(total)} mm of rain (reanalysed). ` +
      `The tank could not cover the day's use on ${dry} of ${n} days.`;
  }

  // ---- 3. more cisterns, as a reservoir
  function drawReservoir(s, house) {
    const n = +$("houses").value;
    const nYears = rain.mm.length / 365.25;
    const lowShare = simulate(rain.mm, { roof: s.roof, tank: s.tank, need: s.need, factor }).supplied / nYears;
    const highShare = house.supplied / nYears;
    const cap = ctx.desal_capacity_m3d.value;
    $("houses-out").textContent = fmt(n);
    $("reservoir").textContent =
      `${fmt(n)} houses with this roof and a ${s.tank} m³ tank would hold ${fmt(n * s.tank)} m³ at once, ` +
      `as much as a small reservoir of that size. In an average year they would supply ` +
      `${range(n * lowShare, n * highShare, (v) => fmt(v))} m³ of rainwater, the same as running Sifnos's ` +
      `desalination plants (${fmt(cap)} m³/day capacity) at full capacity for ` +
      `${range(n * lowShare / cap, n * highShare / cap, (v) => fmt(v, v < 10 ? 1 : 0))} days.`;
  }

  function update() {
    const s = settings();
    $("roof-out").textContent = s.roof + " m²";
    $("tank-out").textContent = s.tank + " m³";
    $("people-out").textContent = String(s.people);
    $("litres-out").textContent = s.litres + " L";
    const c = drawCurve(s);
    const run = simulate(rain.mm, { roof: s.roof, tank: s.tank, need: s.need, keep: true });
    // worst water year
    let worst = { share: 2 };
    for (const k in years) {
      const { i0, i1, label } = years[k];
      let sup = 0, dem = 0;
      for (let i = i0; i < i1; i++) { sup += run.got[i]; dem += s.need / 1000; }
      if (sup / dem < worst.share) worst = { share: sup / dem, label };
    }
    $("headline").textContent =
      `With a ${s.roof} m² roof and a ${s.tank} m³ tank, rain covers ${pctRange(c.lo[s.tank - 1], c.hi[s.tank - 1])} ` +
      `of ${fmt(s.need)} litres a day over 1991–2026. In the worst year, ${worst.label}, it covered ${pct(worst.share)}.`;
    drawYear(s, run);
    drawReservoir(s, simulate(rain.mm, { roof: s.roof, tank: s.tank, need: s.need }));
  }

  Promise.all([fetch("data/page/sifnos_rain_daily.json").then((r) => r.json()),
               fetch("data/page/simulate_context.json").then((r) => r.json())])
    .then(([r, c]) => {
      rain = r; ctx = c; factor = ctx.era5_vs_station_factor.value;
      dates = days(rain.start, rain.mm.length);
      // water years October-September that are complete in the data
      years = {};
      const sel = $("wyear");
      dates.forEach((d, i) => {
        if (d.getUTCMonth() === 9 && d.getUTCDate() === 1 && i + 365 <= dates.length) {
          const y = d.getUTCFullYear();
          const i1 = dates.findIndex((e, j) => j > i && e.getUTCMonth() === 9 && e.getUTCDate() === 1);
          if (i1 < 0) return;
          years[y] = { i0: i, i1, label: `${y}–${String(y + 1).slice(2)}` };
          const o = document.createElement("option"); o.value = y; o.textContent = years[y].label; sel.appendChild(o);
        }
      });
      sel.value = "2022";
      document.querySelectorAll("#storing input, #storing select").forEach((e) => e.addEventListener("input", update));
      let lastW = 0, timer;
      window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => { const w = chartWidth($("curve")); if (w !== lastW) { lastW = w; update(); } }, 150);
      });
      update();
      lastW = chartWidth($("curve"));
    })
    .catch((e) => { $("headline").textContent = "The rain data did not load (" + e.message + "). Open the page through a web server, not as a file."; });
})();
