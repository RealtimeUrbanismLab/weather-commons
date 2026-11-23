// Every roof a cistern? The rain that lands on each island's roofs (Microsoft ML footprints,
// cartographic; ERA5 rain, reanalysed; calculated, an upper bound) against what its 2021
// residents (observed, ELSTAT) would use at 150 litres a day (synthetic). Visitors are not counted.
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const short = (n) => n.replace(" (Thira)", "").replace(" (Megisti)", "");
  const MIN_RES = 1000;   // islands in the chart; the table has every island

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs = {}) { const t = el("text", Object.assign({ x, y }, attrs), parent); t.textContent = s; return t; }
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

  const pct = (r, v) => 100 * v / r.residents_use_m3;
  const tipRows = (r) => [
    `${fmt(r.residents)} residents (2021) · ${fmt(r.buildings)} buildings, ${fmt(r.roof_m2 / 1e4)} ha of roof`,
    `Average year (${fmt(r.rain_normal_mm)} mm): ${fmt(r.catch_normal_m3)} m³, ${fmt(pct(r, r.catch_normal_m3))}% of residents' use`,
    `Driest year, ${r.driest_year} (${fmt(r.rain_driest_mm)} mm): ${fmt(r.catch_driest_m3)} m³, ${fmt(pct(r, r.catch_driest_m3))}%`,
  ];

  function draw(rows) {
    const svg = $("roof-chart"), wrap = svg.parentElement;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = chartWidth(svg), Lm = W < 480 ? 92 : 130, R = 16, T = W < 480 ? 62 : 46, rh = 17;
    const H = T + rows.length * rh + 26;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const top = Math.ceil(Math.max(...rows.map((r) => pct(r, r.catch_normal_m3))) / 50) * 50;
    const x = (v) => Lm + v * (W - Lm - R) / top;
    // legend: two marks, named
    el("circle", { cx: Lm + 5, cy: 12, r: 4.5, class: "dot water" }, svg);
    text(svg, Lm + 14, 16, "average water year, 1991–2020", { class: "direct" });
    const lx = Lm + (W < 480 ? 5 : 230), ly = W < 480 ? 30 : 12;
    el("circle", { cx: lx, cy: ly, r: 4, class: "dot hollow water" }, svg);
    text(svg, lx + 9, ly + 4, "driest water year since 1991–92", { class: "direct" });
    for (let t = 0; t <= top; t += 50) {
      el("line", { x1: x(t), x2: x(t), y1: T - 6, y2: H - 22, class: t === 100 ? "line thin" : "grid" }, svg);
      text(svg, x(t), H - 8, t + "%", { class: "tick", "text-anchor": "middle" });
    }
    text(svg, x(100) + 4, T - 8, "= residents' use", { class: "tick" });
    rows.forEach((r, j) => {
      const y = T + j * rh + rh / 2, a = pct(r, r.catch_normal_m3), b = pct(r, r.catch_driest_m3);
      const g = el("g", { tabindex: 0, role: "img", "aria-label": `${short(r.name)}: ${fmt(a)}% in an average year, ${fmt(b)}% in the driest year` }, svg);
      text(g, Lm - 8, y + 4, short(r.name), { class: r.name === "Sifnos" ? "direct strong" : "direct", "text-anchor": "end" });
      el("line", { x1: x(b), x2: x(a), y1: y, y2: y, class: "line thin water" }, g);
      el("circle", { cx: x(b), cy: y, r: 4, class: "dot hollow water" }, g);
      el("circle", { cx: x(a), cy: y, r: 4.5, class: "dot water" }, g);
      el("rect", { x: 0, y: y - rh / 2, width: W, height: rh, class: "hit" }, g);
      const show = () => tip(wrap, svg, x(a), y, short(r.name), tipRows(r));
      g.addEventListener("pointerenter", show); g.addEventListener("focus", show);
      g.addEventListener("pointerleave", () => hideTip(wrap)); g.addEventListener("blur", () => hideTip(wrap));
    });
  }

  function table(all) {
    const tb = $("roof-table").tBodies[0];
    tb.replaceChildren();
    for (const r of all.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      const tr = tb.insertRow(), has = r.buildings && r.residents_use_m3;
      [short(r.name), fmt(r.residents), fmt(r.buildings), fmt(r.roof_m2 / 1e4, 1),
       r.catch_normal_m3 != null ? fmt(r.catch_normal_m3) : "", has ? fmt(pct(r, r.catch_normal_m3)) + "%" : "",
       r.driest_year || "", has ? fmt(pct(r, r.catch_driest_m3)) + "%" : ""].forEach((s) => (tr.insertCell().textContent = s));
    }
  }

  fetch("data/page/roofs_islands.json").then((r) => r.json()).then((d) => {
    const all = d.islands, withB = all.filter((r) => r.buildings);
    const big = withB.filter((r) => r.residents >= MIN_RES).sort((a, b) => pct(b, b.catch_normal_m3) - pct(a, a.catch_normal_m3));
    const set = (id, s) => { const e = $(id); if (e) e.textContent = s; };
    set("roofs-n", fmt(withB.reduce((a, r) => a + r.buildings, 0)));
    set("roofs-islands", withB.length);
    set("roofs-ha", fmt(withB.reduce((a, r) => a + r.roof_m2, 0) / 1e4));
    set("roofs-big", big.length);
    set("roofs-big-normal", big.filter((r) => r.catch_normal_m3 > r.residents_use_m3).length);
    set("roofs-big-driest", big.filter((r) => r.catch_driest_m3 > r.residents_use_m3).length);
    set("roofs-big-2000", big.filter((r) => r.driest_year === "1999–00" || r.driest_year === "2000–01").length);
    table(all);
    draw(big);
    let last = 0, timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { const w = $("roof-chart").parentElement.clientWidth; if (w && w !== last) { last = w; draw(big); } }, 150);
    });
  }).catch(() => {});
})();
