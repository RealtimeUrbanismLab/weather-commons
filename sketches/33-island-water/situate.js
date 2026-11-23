// Situate: Sifnos among the Aegean islands.
// 1. A map (land: Natural Earth, public domain, and OSM outlines for 30 small islands, ODbL;
//    cartographic): each island drawn as a small cistern, filled with either a winter's rain
//    (reanalysed, ERA5) or desalination capacity per resident (documented capacity /
//    observed residents = calculated). Positions: the main village (cartographic, OSM).
// 2. Desalination over time: every record per island, 1970-2026 (documented).
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const dash = (w) => w.replace("-", "–");

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
  function chartWidth(svg) { return Math.round(Math.max(320, Math.min(680, svg.parentElement.clientWidth || 680))); }
  function tip(wrap, svg, px, py, title, rows) {
    let t = wrap.querySelector(".tip");
    if (!t) { t = document.createElement("div"); t.className = "tip"; wrap.appendChild(t); }
    t.replaceChildren();
    const h = document.createElement("strong"); h.textContent = title; t.appendChild(h);
    for (const s of rows) { const r = document.createElement("div"); r.textContent = s; t.appendChild(r); }
    const box = svg.getBoundingClientRect(), k = box.width / svg.viewBox.baseVal.width;
    t.hidden = false;
    let left = px * k + 14;
    if (left + t.offsetWidth > box.width) left = px * k - t.offsetWidth - 14;
    t.style.left = Math.max(0, left) + "px";
    t.style.top = Math.max(0, py * k - t.offsetHeight / 2) + "px";
  }
  function hideTip(wrap) { const t = wrap.querySelector(".tip"); if (t) t.hidden = true; }

  // ---------------------------------------------------------------- 1. the map
  const RAIN_TOP = 150, DESAL_TOP = 1000;   // a full glyph: 150% of a normal winter; 1,000 L per resident a day
  const short = (n) => n.replace(" (Thira)", "").replace(" (Megisti)", "");
  const perRes = (i) => (i.desal_m3d && i.residents ? 1000 * i.desal_m3d / i.residents : null);

  function mapRows(i, d, wi) {
    const rows = [`${i.group} · ${i.residents != null ? fmt(i.residents) + " residents (2021)" : "residents not known"}`];
    const p = i.rain_pct[wi];
    rows.push(p != null ? `Winter ${dash(d.winters[wi])}: ${p}% of normal rain (normal ${fmt(i.normal_mm)} mm)` : "Winter rain not known");
    if (i.desal_m3d) {
      rows.push(`Desalination: ${fmt(i.desal_m3d)} m³/day (${i.desal_basis === "reconciled" ? "reconciled across sources" : "EMODnet, records to 2020"})`);
      rows.push(`= ${fmt(perRes(i))} L per resident a day`);
    } else rows.push("No desalination plant listed");
    if (i.temp_permits) rows.push(`Temporary permits 2024–26: ${i.temp_permits}${i.temp_permit_m3d ? ", " + fmt(i.temp_permit_m3d) + " m³/day" : ""}`);
    if (i.desal_cost_2025) rows.push(`Desalination cost 2025: €${fmt(i.desal_cost_2025, 2)}/m³ (reported)`);
    const em = i.emergencies;
    if (em.length > 3) {   // Crete: one per municipality
      const doc = em.filter((e) => e.kind === "documented");
      rows.push(`Water emergencies: ${doc.length} municipalities, declared ${doc[0].start} to ${doc[doc.length - 1].start} (documented)`);
    } else {
      for (const e of em) rows.push(`Water emergency ${e.start}${e.end ? " to " + e.end : ""}${e.place && e.place !== i.name ? ", " + e.place : ""}, ${e.by} (${e.kind})`);
    }
    return rows;
  }

  let LAND = null;
  window.SituateRows = { mapRows, perRes };   // the island card, shared with aegean-map.js

  function mapTable(d) {
    const wi = +$("map-winter").value;
    $("map-table-winter").textContent = dash(d.winters[wi]);
    const tb = $("map-table").tBodies[0];
    tb.replaceChildren();
    const rows = d.islands.slice().sort((a, b) => a.group.localeCompare(b.group) || (b.residents || 0) - (a.residents || 0));
    for (const i of rows) {
      const tr = tb.insertRow(), p = i.rain_pct[wi], v = perRes(i);
      [i.name, i.group, i.residents != null ? fmt(i.residents) : "not known", p != null ? p + "%" : "not known",
       i.desal_m3d ? fmt(i.desal_m3d) : "none listed", v != null ? fmt(v) : "",
       i.emergencies.map((e) => e.start).join("; ")].forEach((s) => (tr.insertCell().textContent = s));
    }
  }

  // ---------------------------------------------------- 2. desalination over time
  function drawDesal(d) {
    const svg = $("desal-time"), wrap = svg.parentElement;
    clear(svg);
    const W = chartWidth(svg), L = W < 520 ? 84 : 112, R = 10;
    const y0 = 1970, y1 = 2027, x = (yr) => L + (yr - y0) * (W - L - R) / (y1 - y0);
    // panel A: capacity still listed in 2020, by the year it came online (a survivor count)
    const T = 34, HA = 110;
    const by = d.by_year.filter((r) => r.year >= y0 && r.year <= 2020);
    const maxA = Math.ceil(Math.max(...by.map((r) => r.listed_m3d)) / 20000) * 20000;
    const yA = (v) => T + HA - v * HA / maxA;
    for (const t of [0, maxA / 2, maxA]) {
      el("line", { x1: L, x2: W - R, y1: yA(t), y2: yA(t), class: "grid" }, svg);
      text(svg, L - 6, yA(t) + 4, fmt(t), { class: "tick", "text-anchor": "end" });
    }
    text(svg, L - 6, T - 14, "m³/day", { class: "tick", "text-anchor": "end" });
    let p = "";
    by.forEach((r, j) => { p += (j ? `H${x(r.year).toFixed(1)}V` : `M${x(r.year).toFixed(1)},`) + yA(r.listed_m3d).toFixed(1); });
    p += `H${x(2021).toFixed(1)}`;
    el("path", { d: p, class: "line" }, svg);
    const last = by[by.length - 1];
    text(svg, x(2020) - 4, yA(last.listed_m3d) - 6, fmt(Math.round(last.listed_m3d / 100) * 100), { class: "direct", "text-anchor": "end" });
    text(svg, L + 4, T - 14, W < 520 ? "Listed in 2020, by year online" : "Capacity still listed in 2020, by the year it came online", { class: "direct" });
    // fast-track temporary permits, 2024-26: a note, not added to the line
    const tp = d.by_year.filter((r) => r.year >= 2024);
    const n = tp.reduce((a, r) => a + r.temp_permits, 0), m = tp.reduce((a, r) => a + r.temp_permit_m3d, 0);
    el("rect", { x: x(2024), y: T, width: x(2027) - x(2024), height: HA, class: "band" }, svg);
    text(svg, x(2027), T + HA + 14, `2024–26: ${n} temporary permits, ${fmt(m)} m³/day`, { class: "tick", "text-anchor": "end" });

    // panel B: one strip per island; each mark is a record, not a plant
    const TB = T + HA + 44, rh = 13;
    // area follows capacity (3,000 m³/day or more at full size); records without a capacity drawn small
    const r = (v) => (v ? Math.max(2.5, Math.min(5.5, 5.5 * Math.sqrt(v / 3000))) : 2.5);
    d.islands.forEach((isl, j) => {
      const cy = TB + j * rh + rh / 2;
      el("line", { x1: L, x2: W - R, y1: cy, y2: cy, class: "grid faint" }, svg);
      text(svg, L - 6, cy + 4, short(isl.name), { class: isl.name === "Sifnos" ? "direct strong" : "tick", "text-anchor": "end" });
      for (const e of isl.events) {
        const cx = x(Math.min(Math.max(e.y, y0), 2026) + 0.5);
        let m;
        if (e.t === "historic") {
          m = el("path", { d: `M${cx - 3},${cy - 3}L${cx + 3},${cy + 3}M${cx - 3},${cy + 3}L${cx + 3},${cy - 3}`, class: "line thin" }, svg);
        } else {
          m = el("circle", { cx, cy, r: r(e.m3d), class: e.t === "operating" ? "dot" : "dot hollow" }, svg);
        }
        el("title", {}, m).textContent = `${isl.name}, ${e.y}: ${e.e}${e.m3d ? ", " + fmt(e.m3d) + " m³/day" : ""}` +
          `${e.place && e.place !== isl.name ? " (" + e.place + ")" : ""}. ${e.k}, ${e.s.replace(/;/g, ", ")}`;
      }
    });
    const yb = TB + d.islands.length * rh + 6;
    for (const yr of [1970, 1980, 1990, 2000, 2010, 2020]) {
      if (W < 520 && yr % 20) continue;
      text(svg, x(yr), yb + 12, yr, { class: "tick", "text-anchor": "middle" });
      el("line", { x1: x(yr), x2: x(yr), y1: TB - 4, y2: yb, class: "grid faint" }, svg);
    }
    // key
    const ky = yb + 34;
    el("circle", { cx: L + 4, cy: ky - 4, r: 4, class: "dot" }, svg);
    text(svg, L + 14, ky, "plant online or installed", { class: "tick" });
    const k2 = L + (W < 520 ? 0 : 190), ky2 = W < 520 ? ky + 18 : ky;
    el("circle", { cx: k2 + 4, cy: ky2 - 4, r: 4, class: "dot hollow" }, svg);
    text(svg, k2 + 14, ky2, "permit or decision", { class: "tick" });
    const k3 = W < 520 ? L : L + 350, ky3 = W < 520 ? ky + 36 : ky;
    el("path", { d: `M${k3 + 1},${ky3 - 7}L${k3 + 7},${ky3 - 1}M${k3 + 1},${ky3 - 1}L${k3 + 7},${ky3 - 7}`, class: "line thin" }, svg);
    text(svg, k3 + 14, ky3, "closed", { class: "tick" });
    svg.setAttribute("viewBox", `0 0 ${W} ${ky3 + 8}`);
  }

  function desalTable(d) {
    const tb = $("desal-table").tBodies[0];
    tb.replaceChildren();
    for (const isl of d.islands) {
      const op = isl.events.filter((e) => e.t !== "permitted"), pm = isl.events.filter((e) => e.t === "permitted");
      const tr = tb.insertRow();
      [isl.name, Math.min(...isl.events.map((e) => e.y)), op.length, pm.length,
       pm.filter((e) => e.y >= 2024 && e.e.startsWith("temporary")).length].forEach((s) => (tr.insertCell().textContent = s));
    }
  }

  // ------------------------------------------------------- 3. one EUR/m3 scale
  // ------------------------------------------------------------------ wiring
  Promise.all(["situate_islands", "situate_desal", "aegean_land"].map((f) =>
    fetch(`data/page/${f}.json`).then((r) => r.json()))).then(([isl, desal, land]) => {
    LAND = land;
    const sel = $("map-winter");   // a range over the winters; aegean-map.js labels it
    sel.max = isl.winters.length - 1;
    const redraw = () => mapTable(isl);
    document.querySelectorAll("input[name=fill], #map-winter").forEach((e) => e.addEventListener("input", redraw));
    redraw();
    drawDesal(desal); desalTable(desal);
    let last = 0, timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const w = $("desal-time").parentElement.clientWidth;
        if (w !== last) { last = w; drawDesal(desal); }
      }, 150);
    });
  }).catch(() => {});
})();
