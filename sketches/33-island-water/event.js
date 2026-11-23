// Event: October-March rain on Sifnos for every winter since 1991, against the 1991-2020
// average. Rain: reanalysed (ERA5). The three dry winters around the 2024 emergency are
// drawn in full colour; the others are lighter.
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const HIGHLIGHT = ["2022-23", "2023-24", "2024-25"];
  const fmt = (x) => Math.round(x).toLocaleString("en-GB");
  const label = (w) => w.replace("-", "–");

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

  function draw(d) {
    const svg = document.getElementById("winters"), wrap = svg.parentElement;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = Math.round(Math.max(320, Math.min(680, wrap.clientWidth || 680)));
    const L = 48, R = 8, T = 30, H = 170, B = 26;
    svg.setAttribute("viewBox", `0 0 ${W} ${T + H + B}`);
    const n = d.winters.length, step = (W - L - R) / n, bw = Math.max(2, step - 2);
    const top = Math.ceil(Math.max(...d.winters.map((w) => w.mm)) / 100) * 100;
    const y = (v) => T + H - v * H / top;
    for (const t of [0, top / 2, top]) {
      el("line", { x1: L, x2: W - R, y1: y(t), y2: y(t), class: "grid" }, svg);
      text(svg, L - 6, y(t) + 4, fmt(t) + " mm", { class: "tick", "text-anchor": "end" });
    }
    d.winters.forEach((w, i) => {
      const hi = HIGHLIGHT.includes(w.winter);
      const bar = el("rect", { x: L + i * step + 1, y: y(w.mm), width: bw, height: y(0) - y(w.mm),
                               class: hi ? "bar water" : "bar water soft", tabindex: 0 }, svg);
      const pct = Math.round(100 * w.mm / d.normal_mm);
      const tip = `${label(w.winter)}: ${fmt(w.mm)} mm, ${pct}% of the 1991–2020 average`;
      el("title", {}, bar).textContent = tip;
      const every = W < 520 ? 10 : 5;   // fewer labels on a phone
      if (i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2)) {
        text(svg, L + i * step + step / 2, T + H + 16, label(w.winter), { class: "tick", "text-anchor": "middle" });
      }
      if (w.winter === "2023-24") {
        // above the taller of its highlighted neighbours, so the label never sits on a bar
        const tallest = Math.max(...d.winters.slice(Math.max(0, i - 1), i + 2).map((v) => v.mm));
        text(svg, L + i * step + step / 2, y(tallest) - 6, `${pct}%`, { class: "direct", "text-anchor": "middle" });
      }
    });
    // the average, as a solid hairline; its key sits in the top margin, clear of the bars
    el("line", { x1: L, x2: W - R, y1: y(d.normal_mm), y2: y(d.normal_mm), class: "line thin" }, svg);
    el("line", { x1: L, x2: L + 18, y1: 12, y2: 12, class: "line thin" }, svg);
    text(svg, L + 24, 16, `1991–2020 average, ${fmt(d.normal_mm)} mm`, { class: "direct" });
    // table view
    const tb = document.getElementById("winters-table").tBodies[0];
    tb.replaceChildren();
    for (const w of d.winters) {
      const tr = tb.insertRow();
      [label(w.winter), fmt(w.mm), Math.round(100 * w.mm / d.normal_mm) + "%"].forEach((v) => (tr.insertCell().textContent = v));
    }
  }

  fetch("data/page/event_winters.json").then((r) => r.json()).then((d) => {
    draw(d);
    let last = 0, timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { const w = document.getElementById("winters").parentElement.clientWidth; if (w !== last) { last = w; draw(d); } }, 150);
    });
  }).catch(() => {});
})();
