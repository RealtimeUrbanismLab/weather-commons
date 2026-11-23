// Sifnos in crisis: a topographic map of Sifnos, and Poulati as diagrams.
// Terrain: Copernicus DEM GLO-30 (cartographic); flow lines computed from it. Villages and the
// monastery: OpenStreetMap. Poulati facts: Zepou & Matsaganis 2024 and DECA (reported); spring
// positions along the valley are schematic (the chapter gives their order, not their places).
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });

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
  function width(svg, max = 680) { return Math.round(Math.max(300, Math.min(max, svg.parentElement.clientWidth || max))); }
  function path(c, X, Y) {
    let d = "";
    for (let i = 0; i < c.length; i += 2) d += (i ? "L" : "M") + X(c[i]).toFixed(1) + "," + Y(c[i + 1]).toFixed(1);
    return d;
  }

  // Desalination on Sifnos, reconciled (data/desal_reconciled.csv): documented capacity.
  const DESAL = [{ at: "Platys Gialos", label: "desalination, 1,500 m³/day", anchor: "middle" },
                 { at: "Kamares", label: "desalination, 750 m³/day", anchor: "start", dx: 8, dy: -12 }];
  // label side for each village (right unless listed)
  const LEFT = new Set(["Kamares", "Artemonas", "Apollonia", "Vathy", "Platys Gialos", "Agia Marina", "Troulaki", "Chersonisos"]);

  // ------------------------------------------------------------ the island
  function drawMap(t) {
    const svg = $("sifnos-map");
    clear(svg);
    const W = width(svg, 460);
    const coast = t.lines.filter((l) => l.m === 1);
    let x0 = 99, x1 = 0, y0 = 99, y1 = 0;
    for (const l of coast) for (let i = 0; i < l.c.length; i += 2) {
      x0 = Math.min(x0, l.c[i]); x1 = Math.max(x1, l.c[i]); y0 = Math.min(y0, l.c[i + 1]); y1 = Math.max(y1, l.c[i + 1]);
    }
    const k = Math.cos(37 * Math.PI / 180), padL = 8, padR = 8, padT = 14, padB = 34;
    const sx = (W - padL - padR) / ((x1 - x0) * k);
    const H = Math.round((y1 - y0) * sx + padT + padB);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const X = (lo) => padL + (lo - x0) * k * sx, Y = (la) => padT + (y1 - la) * sx;
    const [ex0, ey0, ex1, ey1] = t.extent;
    el("image", { href: "data/page/sifnos_hillshade.png", x: X(ex0), y: Y(ey1), width: X(ex1) - X(ex0),
                  height: Y(ey0) - Y(ey1), preserveAspectRatio: "none", opacity: 0.55, class: "hillshade" }, svg);
    for (const l of t.lines) {
      if (l.m === 1) continue;
      el("path", { d: path(l.c, X, Y), class: "contour" + (l.m % 200 === 0 ? " major" : "") }, svg);
    }
    for (const l of coast) el("path", { d: path(l.c, X, Y), class: "coast" }, svg);
    const amax = Math.max(...t.streams.map((s) => s.a));
    for (const s of t.streams) {
      el("path", { d: path(s.c, X, Y), class: "stream", "stroke-width": (0.7 + 2.2 * Math.sqrt(s.a / amax)).toFixed(2) }, svg);
    }
    const v = t.poulati_valley.c;
    el("path", { d: path(v, X, Y), class: "valley" }, svg);
    const vx = X(v[v.length - 2]), vy = Y(v[v.length - 1]);
    text(svg, vx + 10, vy - 10, "Poulati", { class: "direct strong water-text" });
    const m = t.monastery;
    const mx = X(m.lon), my = Y(m.lat);
    el("path", { d: `M${mx - 4},${my}H${mx + 4}M${mx},${my - 4}V${my + 4}`, class: "line thin" }, svg);
    text(svg, vx + 10, vy + 4, "monastery", { class: "tick" });
    // villages, then desalination
    const byName = Object.fromEntries(t.places.map((p) => [p.name, p]));
    for (const p of t.places) {
      const px = X(p.lon), py = Y(p.lat), village = p.place === "village";
      el("circle", { cx: px, cy: py, r: village ? 2.6 : 1.6, class: "place" }, svg);
      if (village && p.name !== "Kato Petali") {
        const left = LEFT.has(p.name);
        text(svg, px + (left ? -5 : 5), py + 4, p.name, { class: village ? "direct" : "tick", "text-anchor": left ? "end" : "start" });
      }
    }
    DESAL.forEach((d, i) => {
      const p = byName[d.at];
      if (!p) return;
      const px = X(p.lon), py = Y(p.lat) + 14;
      el("rect", { x: px - 4, y: py - 4, width: 8, height: 8, class: "desal" }, svg);
      const label = W < 400 ? d.label.replace("desalination, ", "") : d.label;   // short on a phone
      const tt = text(svg, px + (d.dx || 0), py + 16 + (d.dy || 0), label, { class: "tick", "text-anchor": d.anchor });
      el("title", {}, tt).textContent = "Documented capacity, the most the units can make. Drawn at the village; the exact site is not mapped.";
    });
    // scale bar and key
    const km = sx * k / (111.32 * k);   // px per km along a parallel: degrees of longitude per km = 1/(111.32 cos lat)
    const sb = 2 * km, bx = padL + 4, by = H - 12;
    el("path", { d: `M${bx},${by - 4}V${by}H${bx + sb}V${by - 4}`, class: "line thin" }, svg);
    text(svg, bx + sb + 5, by, "2 km", { class: "tick" });
    text(svg, W - padR, by, `contours every ${t.step_m} m`, { class: "tick", "text-anchor": "end" });
  }

  // ------------------------------------------------------------ the valley in section
  function drawProfile(t, p) {
    const svg = $("poulati-profile");
    clear(svg);
    const W = width(svg), narrow = W < 520;
    const prof = t.poulati_valley.profile_m;
    const len = prof[prof.length - 1][0];
    const L = 44, R = 14, T = 16, H = narrow ? 150 : 190, B = 28;
    const x = (d) => L + d * (W - L - R) / len, y = (z) => T + H - z * H / 180;
    // terrain
    let d = `M${x(0)},${y(0)}`;
    for (const [dd, z] of prof) d += `L${x(dd).toFixed(1)},${y(z).toFixed(1)}`;
    d += `L${x(len)},${y(0)}Z`;
    el("path", { d, class: "terrain" }, svg);
    for (const z of [0, 50, 100, 150]) {
      el("line", { x1: L, x2: W - R, y1: y(z), y2: y(z), class: "grid faint" }, svg);
      text(svg, L - 6, y(z) + 4, z + " m", { class: "tick", "text-anchor": "end" });
    }
    text(svg, L, T + H + 18, "edge of Artemonas", { class: "tick" });
    text(svg, W - R, T + H + 18, `sea, ${fmt(Math.round(len / 10) * 10)} m down the valley`, { class: "tick", "text-anchor": "end" });
    // springs: in the chapter's order, spaced evenly from 140 m to the sea (schematic)
    const at = (z) => {   // distance where the valley floor first drops to altitude z
      for (let i = 1; i < prof.length; i++) {
        const [d0, z0] = prof[i - 1], [d1, z1] = prof[i];
        if (z1 <= z && z0 >= z) return d0 + (z0 - z) / (z0 - z1 || 1) * (d1 - d0);
      }
      return len;
    };
    const top = p.spring_top_m, n = p.springs.length, pos = {};
    p.springs.forEach((s, i) => {
      const z = top - i * (top - 4) / (n - 1), dd = at(z);
      pos[s.n] = { x: x(dd), y: y(z) };
    });
    const tank = (cx, cy, w, h, fill) => {
      el("rect", { x: cx - w / 2, y: cy - h, width: w, height: h, class: "cistern" }, svg);
      el("rect", { x: cx - w / 2 + 1.5, y: cy - h * fill, width: w - 3, height: h * fill - 1.5, class: "water-fill" }, svg);
    };
    // communal cisterns just below their spring; secondary cisterns where the chapter places them
    for (const s of p.springs) {
      const q = pos[s.n];
      if (p.communal_near.includes(s.n)) tank(q.x + 12, q.y + 14, 16, 10, 0.6);
    }
    const flow = (a, b) => el("path", { d: `M${a.x},${a.y}Q${(a.x + b.x) / 2},${Math.max(a.y, b.y) + 6} ${b.x},${b.y}`,
                                         class: "water-line", "stroke-width": 1.5, "stroke-dasharray": "3 2" }, svg);
    if (pos[1] && pos[2]) {   // spring 1's cistern feeds the plot of spring 2 and its secondary cistern
      const s2 = { x: pos[2].x + 12, y: pos[2].y + 12 };
      flow({ x: pos[1].x + 20, y: pos[1].y + 9 }, { x: s2.x - 6, y: s2.y - 4 });
      tank(s2.x, s2.y, 11, 7, 0.5);
    }
    if (pos[6]) {   // spring 6: overflow piped to a cistern two terraces below
      const below = { x: pos[6].x + 30, y: pos[6].y + 20 };
      flow({ x: pos[6].x + 20, y: pos[6].y + 9 }, { x: below.x - 6, y: below.y - 4 });
      tank(below.x, below.y, 11, 7, 0.5);
    }
    for (const s of p.springs) {
      const q = pos[s.n];
      el("circle", { cx: q.x, cy: q.y, r: 4.5, class: "dot water" }, svg);
      text(svg, q.x - 2, q.y - 9, String(s.n), { class: "direct strong", "text-anchor": "middle" });
    }
    // key and notes below the section
    let ky = T + H + 44;
    const key = [["spring (number in order of altitude)", "dot"], ["communal cistern", "tank"], ["secondary cistern, fed from one above", "small"]];
    let kx = L;
    for (const [label, kind] of key) {
      if (kind === "dot") el("circle", { cx: kx + 5, cy: ky - 4, r: 4.5, class: "dot water" }, svg);
      else tank(kx + 6, ky + 1, kind === "tank" ? 14 : 10, kind === "tank" ? 9 : 7, 0.6);
      const tt = text(svg, kx + 16, ky, label, { class: "tick" });
      kx += 16 + tt.getComputedTextLength() + 18;
      if (narrow || kx > W - 160) { kx = L; ky += 18; }
    }
    if (kx !== L) ky += 18;
    const notes = [[1, "του Κόκκινου, 'The Red One', the highest. Its cistern feeds the plot of spring 2; one plot has water from it twice a week"],
                   [5, "'Flea' or 'Vein'. Its cistern gives 14 waters a week to plots below, shared by five families; the steadiest flow"],
                   [6, "Two cisterns, one open, one closed; overflow piped to a cistern two terraces down, which has one water a week"]];
    const maxChars = Math.floor((W - L - 30) / 6.3);
    for (const [nn, s] of notes) {
      el("circle", { cx: L + 6, cy: ky + 8, r: 8, class: "dot water" }, svg);
      text(svg, L + 6, ky + 12, String(nn), { class: "tick", "text-anchor": "middle", style: "fill:var(--bg);font-weight:700" });
      const words = s.split(" "), lines = [""];
      for (const w of words) {
        if ((lines[lines.length - 1] + " " + w).length > maxChars) lines.push(w);
        else lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim();
      }
      lines.forEach((ln, i) => text(svg, L + 22, ky + 12 + i * 15, ln, { class: "direct" }));
      ky += Math.max(22, lines.length * 15 + 8);
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${ky + 4}`);
  }

  // ------------------------------------------------------------ the week as fourteen waters
  function drawWeek(p) {
    const svg = $("poulati-week");
    clear(svg);
    const W = width(svg), narrow = W < 520;
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const L = narrow ? 0 : 230, R = 4, cw = (W - L - R) / 14, ch = 20;
    let y = 22;
    DAYS.forEach((d, i) => text(svg, L + (2 * i + 1) * cw, y - 6, d, { class: "tick", "text-anchor": "middle" }));
    const rows = [
      { label: "Spring 5's communal cistern", sub: "14 waters a week, shared by five families; how they divide them is not published",
        cells: () => Array(14).fill(1) },
      { label: "A plot, by contract", sub: "4 waters a week from a spring outside it, on Tuesday, Wednesday, Saturday and Sunday; which 12 hours is not stated",
        cells: () => DAYS.map((d) => (["Tue", "Wed", "Sat", "Sun"].includes(d) ? [0.5, 0.5] : [0, 0])).flat() },
      { label: "A plot below spring 1's cistern", sub: "2 waters a week; the days are not stated", count: 2 },
      { label: "A plot two terraces below spring 6", sub: "1 water a week by pipe; the drain-offs by trust, unwritten", count: 1 },
    ];
    const maxChars = Math.floor((narrow ? W : L - 12) / 6.2);
    const wrap = (s) => {
      const lines = [""];
      for (const w of s.split(" ")) {
        if ((lines[lines.length - 1] + " " + w).length > maxChars) lines.push(w);
        else lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim();
      }
      return lines;
    };
    for (const r of rows) {
      const sub = wrap(r.sub);
      let ty = y + 13;
      if (narrow) {
        text(svg, 0, ty, r.label, { class: "direct strong" });
        sub.forEach((ln, i) => text(svg, 0, ty + 15 * (i + 1), ln, { class: "tick" }));
        y = ty + 15 * sub.length + 8;
      } else {
        text(svg, 0, ty, r.label, { class: "direct strong" });
        sub.forEach((ln, i) => text(svg, 0, ty + 15 * (i + 1), ln, { class: "tick" }));
      }
      for (let i = 0; i < 14; i++) {
        el("rect", { x: L + i * cw + 1, y, width: cw - 2, height: ch, class: "cell" }, svg);
      }
      if (r.cells) {
        r.cells().forEach((v, i) => {
          if (v) el("rect", { x: L + i * cw + 1, y, width: cw - 2, height: ch, class: "water-fill", "fill-opacity": v === 1 ? 1 : 0.45 }, svg);
        });
      } else {
        for (let j = 0; j < r.count; j++) {
          el("rect", { x: L + j * (cw * 0.8) + 1, y: y + ch + 4, width: cw * 0.8 - 3, height: 8, class: "water-fill" }, svg);
        }
        text(svg, L + r.count * cw * 0.8 + 6, y + ch + 12, `${r.count} × 12 hours, days not stated`, { class: "tick" });
      }
      const rowBottom = y + ch + (r.cells ? 0 : 16);
      y = narrow ? rowBottom + 22 : Math.max(rowBottom, ty + 15 * sub.length) + 22;
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${y}`);
  }

  // ------------------------------------------------------------ the 34 properties
  function drawPlots(p) {
    const svg = $("poulati-plots");
    clear(svg);
    const W = width(svg), pr = p.properties;
    const kinds = [["farmed", pr.farmed, "farmed"], ["with summer houses", pr.summer_houses, "house"], ["abandoned-looking plots or olive groves", pr.abandoned, "abandoned"]];
    const per = W < 520 ? 17 : 34, s = Math.min(18, (W - 4) / per - 3);
    let i = 0;
    for (const [, n, cls] of kinds) {
      for (let j = 0; j < n; j++, i++) {
        el("rect", { x: (i % per) * (s + 3) + 1, y: Math.floor(i / per) * (s + 3) + 1, width: s, height: s, class: "plot " + cls }, svg);
      }
    }
    let y = Math.ceil(pr.total / per) * (s + 3) + 18, x = 1;
    for (const [label, n, cls] of kinds) {
      el("rect", { x, y: y - 10, width: 10, height: 10, class: "plot " + cls }, svg);
      const tt = text(svg, x + 15, y, `${n} ${label}`, { class: "tick" });
      x += 15 + tt.getComputedTextLength() + 18;
      if (x > W - 120) { x = 1; y += 18; }
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${y + 8}`);
  }

  Promise.all(["sifnos_topo", "poulati"].map((f) => fetch(`data/page/${f}.json`).then((r) => r.json())))
    .then(([t, p]) => {
      const draw = () => { drawMap(t); drawProfile(t, p); drawWeek(p); drawPlots(p); };
      draw();
      let last = 0, timer;
      window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => { const w = $("poulati-profile").parentElement.clientWidth; if (w && w !== last) { last = w; draw(); } }, 120);
      });
    }).catch(() => {});
})();
