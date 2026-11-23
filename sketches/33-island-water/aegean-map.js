// Mapping: an interactive satellite map of the islands (Leaflet + Sentinel-2 cloudless 2024, EOX),
// with controls to compare them.
// - Each island is a small tank filled with one measure: a winter's rain as a share of its
//   1991-2020 average (reanalysed, ERA5), desalination capacity per resident (documented /
//   observed = calculated), or rain on its roofs against residents' use (calculated, upper bound).
// - Filters (group, residents, emergency, desalination) fade the islands that do not match; the
//   list beside the map ranks the ones that do. A card shows the selected island.
// - Zoomed in, every building footprint on the 85 islands with buildings is drawn as a possible
//   cistern (Microsoft ML footprints, ODbL; cartographic); each island's file loads when it
//   comes into view.
// - A scatter plot below the map sets two measures against each other for the same islands.
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const dash = (w) => w.replace("-", "–");
  const short = (n) => n.replace(" (Thira)", "").replace(" (Megisti)", "");
  const ZOOM_ROOFS = 12;
  const RES_STEPS = [0, 100, 500, 1000, 5000, 10000, 50000];
  const water = () => getComputedStyle(document.documentElement).getPropertyValue("--water").trim() || "#1a5fb4";
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ---- the three measures: value, how full a tank is, a reference line, the label
  const MEASURES = {
    rain: { top: 150, ref: 100, unit: "%", head: (w) => `winter rain, ${w}, % of average` },
    desal: { top: 1000, ref: null, unit: " L", head: () => "desalination, litres per resident a day" },
    roofs: { top: 200, ref: 100, unit: "%", head: () => "rain on roofs, average year, % of residents' use" },
  };

  function tankIcon(f, opts) {
    const w = 12, ht = 18, fh = Math.max(0, Math.min(1, f)) * (ht - 3);
    const normal = opts.normal != null ? `<line x1="-1" x2="${w + 1}" y1="${ht - 1.5 - opts.normal * (ht - 3)}" y2="${ht - 1.5 - opts.normal * (ht - 3)}" stroke="#000" stroke-width="1"/>` : "";
    const em = opts.emergency ? `<circle cx="${w + 3}" cy="2" r="3" fill="#000" stroke="#fff" stroke-width="1"/>` : "";
    const dashArr = opts.none ? ' stroke-dasharray="2 2"' : "";
    const ring = opts.sel ? `<rect x="-3" y="-3" width="${w + 6}" height="${ht + 6}" fill="none" stroke="#fff" stroke-width="2"/>` : "";
    const svg = `<svg width="${w + 10}" height="${ht + 8}" viewBox="-4 -4 ${w + 10} ${ht + 8}" aria-hidden="true">${ring}
      <rect x="0" y="0" width="${w}" height="${ht}" fill="#fff" stroke="#000" stroke-width="${opts.sel ? 2 : 1.2}"${dashArr}/>
      <rect x="1.5" y="${ht - 1.5 - fh}" width="${w - 3}" height="${fh}" fill="${water()}"/>${normal}${em}</svg>`;
    return L.divIcon({ className: "tank-icon", html: svg, iconSize: [w + 10, ht + 8], iconAnchor: [w / 2 + 4, ht + 5], tooltipAnchor: [8, -ht / 2] });
  }

  // ---- footprints: one file per island, decoded to Web Mercator units (0-1) and bucketed
  const BUCKET = 2 ** 14;   // a zoom-14 tile, ~2 km here
  const merc = (lon, lat) => {
    const s = Math.sin(lat * Math.PI / 180);
    return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
  };
  const cache = {};
  function loadIsland(r) {
    if (!cache[r.slug]) {
      cache[r.slug] = fetch(`data/page/roofs/${r.slug}.json`).then((x) => x.json()).then((src) => {
        const [lon0, lat0] = src.o, u = src.u, buckets = new Map();
        for (const enc of src.f) {
          let x = enc[0], y = enc[1], cx = 0, cy = 0;
          const pts = [];
          for (let k = 0; k < enc.length; k += 2) {
            if (k) { x += enc[k]; y += enc[k + 1]; }
            const m = merc(lon0 + x * u, lat0 + y * u);
            pts.push(m[0], m[1]); cx += m[0]; cy += m[1];
          }
          const n = pts.length / 2, key = Math.floor(cx / n * BUCKET) + "," + Math.floor(cy / n * BUCKET);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(pts);
        }
        return buckets;
      });
    }
    return cache[r.slug];
  }
  const RoofLayer = L.GridLayer.extend({
    initialize(islands, opts) { this._isl = islands; L.setOptions(this, opts); },
    createTile(c, done) {
      const tile = document.createElement("canvas"), size = this.getTileSize(), dpr = window.devicePixelRatio || 1;
      tile.width = size.x * dpr; tile.height = size.y * dpr;
      const n = 2 ** c.z, x0 = c.x / n, y0 = c.y / n, x1 = (c.x + 1) / n, y1 = (c.y + 1) / n;
      const lon = (x) => x * 360 - 180, lat = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
      const w = lon(x0), e = lon(x1), no = lat(y0), so = lat(y1);
      const need = this._isl.filter((r) => r.bbox[0] < e + 0.01 && r.bbox[2] > w - 0.01 && r.bbox[1] < no + 0.01 && r.bbox[3] > so - 0.01);
      Promise.all(need.map(loadIsland)).then((all) => {
        const ctx = tile.getContext("2d"), k = size.x * n * dpr;
        ctx.beginPath();
        const b0 = Math.floor(x0 * BUCKET) - 1, b1 = Math.floor(x1 * BUCKET) + 1;
        const c0 = Math.floor(y0 * BUCKET) - 1, c1 = Math.floor(y1 * BUCKET) + 1;
        for (const buckets of all) {
          for (let bx = b0; bx <= b1; bx++) for (let by = c0; by <= c1; by++) {
            const list = buckets.get(bx + "," + by);
            if (!list) continue;
            for (const p of list) {
              ctx.moveTo((p[0] - x0) * k, (p[1] - y0) * k);
              for (let j = 2; j < p.length; j += 2) ctx.lineTo((p[j] - x0) * k, (p[j + 1] - y0) * k);
              ctx.closePath();
            }
          }
        }
        ctx.globalAlpha = 0.85; ctx.fillStyle = water(); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = water(); ctx.lineWidth = 1.2 * dpr; ctx.stroke();
        done(null, tile);
      }).catch((err) => done(err, tile));
      return tile;
    },
  });

  Promise.all(["situate_islands", "roofs_islands", "roofs_sifnos", "sifnos_topo"].map((f) => fetch(`data/page/${f}.json`).then((r) => r.json())))
    .then(([d, ri, roofs, topo]) => {
      const { perRes } = window.SituateRows;
      const roofBy = Object.fromEntries(ri.islands.map((r) => [r.name, r]));
      const roofPct = (r, v) => (r && r.residents_use_m3 && v != null ? 100 * v / r.residents_use_m3 : null);

      // ---- state
      const st = { mode: "rain", wi: d.winters.indexOf("2023-24"), groups: new Set(), minRes: 0, emerg: false, desal: "", sel: "Sifnos" };
      const groups = [...new Set(d.islands.map((i) => i.group))]
        .map((g) => [g, d.islands.filter((i) => i.group === g).length]).sort((a, b) => b[1] - a[1]);
      groups.forEach(([g]) => st.groups.add(g));
      const value = (i, mode = st.mode) => {
        if (mode === "rain") return i.rain_pct[st.wi];
        if (mode === "desal") return perRes(i);
        if (mode === "residents") return i.residents || null;
        const r = roofBy[i.name];
        return r && r.buildings ? roofPct(r, r.catch_normal_m3) : null;
      };
      const passes = (i) => st.groups.has(i.group) && (i.residents || 0) >= st.minRes &&
        (!st.emerg || i.emergencies.length > 0) &&
        (!st.desal || (st.desal === "yes" ? !!i.desal_m3d : !i.desal_m3d));
      const valText = (v, mode = st.mode) => (v == null ? "–" : fmt(v) + MEASURES[mode].unit);

      // ---- map
      const map = L.map("aegean-map", { zoomSnap: 0.5, scrollWheelZoom: false, worldCopyJump: false });
      L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg", {
        maxNativeZoom: 15, maxZoom: 17, minZoom: 6,
        attribution: 'Sentinel-2 cloudless 2024 by <a href="https://s2maps.eu">EOX IT Services GmbH</a> ' +
                     '(modified Copernicus Sentinel data 2024; CC BY-NC-SA 4.0) · buildings: Microsoft (ODbL)',
      }).addTo(map);
      const allBounds = L.latLngBounds(d.islands.map((i) => [i.lat, i.lon]));
      const home = () => map.flyToBounds(allBounds, { padding: [10, 10], duration: 1.0 });
      map.fitBounds(allBounds, { padding: [10, 10] });
      const Reset = L.Control.extend({
        options: { position: "topleft" },
        onAdd() {
          const b = L.DomUtil.create("button", "map-reset");
          b.type = "button"; b.textContent = "Reset view"; b.title = "Back to all islands";
          L.DomEvent.disableClickPropagation(b);
          L.DomEvent.on(b, "click", home);
          return b;
        },
      });
      new Reset().addTo(map);

      const marks = L.layerGroup().addTo(map);
      const markerBy = {};
      for (const i of d.islands) {
        const m = L.marker([i.lat, i.lon], { title: i.name, keyboard: true, riseOnHover: true });
        m.bindTooltip("", { direction: "right", offset: [4, 0] });
        m.on("click", () => select(i.name));
        m.on("mouseover", () => hot(i.name, true));
        m.on("mouseout", () => hot(i.name, false));
        markerBy[i.name] = m;
        marks.addLayer(m);
      }
      function drawMarks() {
        const M = MEASURES[st.mode], close = map.getZoom() >= ZOOM_ROOFS;
        for (const i of d.islands) {
          const m = markerBy[i.name], v = value(i), ok = passes(i);
          const show = !(close && i.name === "Sifnos");   // Sifnos's villages take over when zoomed in
          if (show && !marks.hasLayer(m)) marks.addLayer(m);
          if (!show && marks.hasLayer(m)) marks.removeLayer(m);
          m.setIcon(tankIcon(v == null ? 0 : v / M.top, { none: v == null, normal: M.ref != null && v != null ? M.ref / M.top : null,
                                                          emergency: i.emergencies.length > 0, sel: i.name === st.sel }));
          m.setOpacity(ok ? 1 : 0.3);
          m.setZIndexOffset(i.name === st.sel ? 1000 : ok ? 100 : 0);
          m.setTooltipContent(`${short(i.name)} · ${valText(v)}`);
        }
      }

      // ---- ranking
      function drawRank() {
        const M = MEASURES[st.mode], ol = $("map-rank");
        ol.replaceChildren();
        const kept = d.islands.filter(passes);
        const known = kept.filter((i) => value(i) != null).sort((a, b) => value(b) - value(a));
        const scale = Math.max(M.ref || 0, ...known.map((i) => value(i)), 1);
        $("map-rank-head").textContent = `${kept.length} of ${d.islands.length} islands, by ${M.head(dash(d.winters[st.wi]))}`;
        for (const i of known) {
          const v = value(i), li = h("li"), b = h("button");
          b.type = "button"; b.dataset.name = i.name;
          if (i.name === st.sel) b.classList.add("sel");
          const nm = h("span", "nm", short(i.name));
          if (i.emergencies.length) { const e = h("span", "em"); e.title = "water emergency, 2024–26"; nm.appendChild(e); }
          const bar = h("span", "bar"), fill = h("i");
          fill.style.width = (100 * v / scale).toFixed(1) + "%";
          bar.appendChild(fill);
          if (M.ref != null) { const r = h("b"); r.style.left = (100 * M.ref / scale).toFixed(1) + "%"; bar.appendChild(r); }
          b.append(nm, bar, h("span", "v", valText(v)));
          b.setAttribute("aria-label", `${short(i.name)}: ${valText(v)}`);
          b.addEventListener("click", () => { select(i.name); map.panTo([i.lat, i.lon]); });
          b.addEventListener("mouseenter", () => markerBy[i.name].openTooltip());
          b.addEventListener("mouseleave", () => markerBy[i.name].closeTooltip());
          li.appendChild(b); ol.appendChild(li);
        }
        const missing = kept.length - known.length;
        if (missing) ol.appendChild(h("li", "none", `${missing} more with no value for this measure`));
        if (!kept.length) ol.appendChild(h("li", "none", "No island matches these filters."));
      }
      function hot(name, on) {
        const b = $("map-rank").querySelector(`button[data-name="${CSS.escape(name)}"]`);
        if (b) b.classList.toggle("hot", on);
        const g = $("map-scatter").querySelector(`g[data-name="${CSS.escape(name)}"]`);
        if (g) g.classList.toggle("hot", on);
      }

      // ---- scatter: two measures at once, for the islands the filters keep
      const AXES = {
        rain: { name: "Winter rain", short: () => `Rain ${dash(d.winters[st.wi])}, % of average`, title: () => `Winter rain ${dash(d.winters[st.wi])}, % of the island's average`, ref: 100, refName: "average", unit: "%" },
        desal: { name: "Desalination per resident", short: () => "Desalination, L per resident a day (log)", title: () => "Desalination capacity, litres per resident a day (log scale)", log: true, unit: " L" },
        roofs: { name: "Rain on roofs", short: () => "Rain on roofs, % of residents' use (log)", title: () => "Rain on roofs, average year, % of residents' use (log scale)", ref: 100, refName: "residents' use", log: true, unit: "%" },
        residents: { name: "Residents", short: () => "Residents, 2021 (log)", title: () => "Residents, 2021 (log scale)", log: true, unit: "" },
      };
      function niceStep(v) {
        const e = 10 ** Math.floor(Math.log10(v)), m = v / e;
        return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e;
      }
      function axis(key, vals, a, b) {
        const A = AXES[key];
        if (A.log) {   // whole decades around the data; 2 and 5 between them when there are few
          const lo = Math.floor(Math.log10(Math.min(...vals, A.ref || Infinity))), hi = Math.ceil(Math.log10(Math.max(...vals, A.ref || 0)));
          const span = Math.max(1, hi - lo), ticks = [];
          for (let k = lo; k <= hi; k++) for (const m of span <= 2 ? [1, 2, 5] : [1]) if (k < hi || m === 1) ticks.push(m * 10 ** k);
          return { f: (v) => a + (Math.log10(v) - lo) / span * (b - a), ticks };
        }
        const max = Math.max(...vals, (A.ref || 0) * 1.05, 1), step = niceStep(max / 5), top = Math.ceil(max / step) * step, ticks = [];
        for (let t = 0; t <= top + 1e-9; t += step) ticks.push(t);
        return { f: (v) => a + v / top * (b - a), ticks };
      }
      function drawScatter() {
        const svg = $("map-scatter"), wrap = svg.parentElement, sx = $("sc-x").value, sy = $("sc-y").value;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const W = Math.round(Math.max(320, Math.min(1100, wrap.clientWidth || 680))), H = W < 520 ? 340 : 420;
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        const Lm = 52, R = 16, T = 26, B = 40;
        const kept = d.islands.filter(passes);
        const pts = kept.map((i) => ({ i, x: value(i, sx), y: value(i, sy) })).filter((p) => p.x != null && p.y != null);
        const X = axis(sx, pts.map((p) => p.x), Lm, W - R), Y = axis(sy, pts.map((p) => p.y), H - B, T);
        const el = (n, a, parent = svg) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };
        const tx = (x, y, str, a = {}, parent = svg) => { const t = el("text", Object.assign({ x, y }, a), parent); t.textContent = str; return t; };
        const tick = (v, key) => (AXES[key].log ? fmt(v) : fmt(v) + (AXES[key].unit === "%" ? "%" : ""));
        for (const t of X.ticks) { el("line", { x1: X.f(t), x2: X.f(t), y1: T, y2: H - B, class: "grid" }); tx(X.f(t), H - B + 16, tick(t, sx), { class: "tick", "text-anchor": "middle" }); }
        for (const t of Y.ticks) { el("line", { x1: Lm, x2: W - R, y1: Y.f(t), y2: Y.f(t), class: "grid" }); tx(Lm - 6, Y.f(t) + 4, tick(t, sy), { class: "tick", "text-anchor": "end" }); }
        if (AXES[sx].ref != null) { el("line", { x1: X.f(100), x2: X.f(100), y1: T, y2: H - B, class: "line thin" }); tx(X.f(100) + 4, T + 10, AXES[sx].refName, { class: "tick" }); }
        if (AXES[sy].ref != null) { el("line", { x1: Lm, x2: W - R, y1: Y.f(100), y2: Y.f(100), class: "line thin" }); tx(W - R, Y.f(100) - 5, AXES[sy].refName, { class: "tick", "text-anchor": "end" }); }
        const ttl = (k) => (W < 620 ? AXES[k].short() : AXES[k].title());
        tx(W - R, H - 4, ttl(sx) + " →", { class: "direct", "text-anchor": "end" });
        tx(Math.min(Lm, 8), T - 12, "↑ " + ttl(sy), { class: "direct" });
        const order = pts.slice().sort((a, b) => (a.i.name === st.sel) - (b.i.name === st.sel));   // the selected island on top
        for (const p of order) {
          const cx = X.f(p.x), cy = Y.f(p.y), sel = p.i.name === st.sel;
          const g = el("g", { class: "pt" + (sel ? " sel" : ""), "data-name": p.i.name });
          if (p.i.emergencies.length) el("circle", { cx, cy, r: 8, class: "em-ring" }, g);
          el("circle", { cx, cy, r: sel ? 6.5 : 5, class: "dot water" }, g);
          if (sel || p.i.name === "Sifnos") tx(cx + 10, cy + 4, short(p.i.name), { class: sel ? "direct strong" : "direct" }, g);
          el("circle", { cx, cy, r: 11, class: "hit" }, g);
          const rows = [`${AXES[sx].name}: ${fmt(p.x)}${AXES[sx].unit}`, `${AXES[sy].name}: ${fmt(p.y)}${AXES[sy].unit}`];
          if (p.i.emergencies.length) rows.push("Water emergency, 2024–26");
          g.addEventListener("pointerenter", () => { scTip(wrap, svg, cx, cy, short(p.i.name), rows); markerBy[p.i.name].openTooltip(); hot(p.i.name, true); });
          g.addEventListener("pointerleave", () => { scHide(wrap); markerBy[p.i.name].closeTooltip(); hot(p.i.name, false); });
          g.addEventListener("click", () => { select(p.i.name); map.panTo([p.i.lat, p.i.lon]); });
        }
        const out = kept.filter((i) => value(i, sx) == null || value(i, sy) == null);
        const noPlant = (sx === "desal" || sy === "desal") ? out.filter((i) => !i.desal_m3d).length : 0;
        const why = noPlant ? ` (${noPlant === out.length ? "all" : noPlant} with no desalination plant listed)` : "";
        $("sc-note").textContent = `${pts.length} islands${out.length ? `; ${out.length} more are left out for lack of a value${why}` : ""}. ` +
          "The filters above apply, and the axes rescale to the islands they keep. Ring: a water emergency, 2024–26. Click a dot to select the island.";
      }
      function scTip(wrap, svg, px, py, title, rows) {
        let t = wrap.querySelector(".tip");
        if (!t) { t = h("div", "tip"); wrap.appendChild(t); }
        t.replaceChildren(h("strong", null, title), ...rows.map((r) => h("div", null, r)));
        const box = svg.getBoundingClientRect(), k = box.width / svg.viewBox.baseVal.width;
        t.hidden = false;
        let left = px * k + 14;
        if (left + t.offsetWidth > box.width) left = px * k - t.offsetWidth - 14;
        t.style.left = Math.max(0, left) + "px";
        t.style.top = Math.max(0, py * k - t.offsetHeight / 2) + "px";
      }
      function scHide(wrap) { const t = wrap.querySelector(".tip"); if (t) t.hidden = true; }
      for (const [id, def] of [["sc-x", "rain"], ["sc-y", "desal"]]) {
        const sel = $(id);
        for (const k in AXES) sel.add(new Option(AXES[k].name, k));
        sel.value = def;
        sel.addEventListener("input", drawScatter);
      }

      // ---- the selected island
      function drawCard() {
        const i = d.islands.find((x) => x.name === st.sel), r = roofBy[i.name], c = $("map-card");
        c.replaceChildren();
        c.appendChild(h("h4", null, short(i.name)));
        c.appendChild(h("p", "meta", `${i.group} · ${i.residents != null ? fmt(i.residents) + " residents (2021)" : "residents not known"}`));
        const sec = (title) => { const s = h("div", "sec"); s.appendChild(h("div", "sec-h", title)); c.appendChild(s); return s; };
        const meter = (s, pct, ref, soft) => {
          const m = h("div", "meter"), f = h("i", soft ? "soft" : null);
          f.style.width = Math.min(100, pct).toFixed(1) + "%"; m.appendChild(f);
          if (ref != null) { const b = h("b"); b.style.left = ref.toFixed(1) + "%"; m.appendChild(b); }
          s.appendChild(m);
        };
        // winter rain, every winter: a small column chart; click a column to choose that winter
        const s1 = sec("Winter rain, every winter since 1991–92 (reanalysed)");
        const svg = document.createElementNS(NS, "svg"), n = d.winters.length, W = 300, H = 56, TOP = 200;
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "spark"); svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Winter rain on ${short(i.name)}, 1991–92 to 2025–26`);
        i.rain_pct.forEach((p, j) => {
          if (p == null) return;
          const bh = Math.min(p, TOP) / TOP * H, rc = document.createElementNS(NS, "rect");
          rc.setAttribute("x", (j * W / n + 0.5).toFixed(1)); rc.setAttribute("width", (W / n - 1).toFixed(1));
          rc.setAttribute("y", (H - bh).toFixed(1)); rc.setAttribute("height", bh.toFixed(1));
          if (j === st.wi) rc.setAttribute("class", "on");
          const t = document.createElementNS(NS, "title"); t.textContent = `${dash(d.winters[j])}: ${p}%`; rc.appendChild(t);
          rc.addEventListener("click", () => setWinter(j, true));
          svg.appendChild(rc);
        });
        const ln = document.createElementNS(NS, "line");
        ln.setAttribute("x1", 0); ln.setAttribute("x2", W); ln.setAttribute("y1", H - 100 / TOP * H); ln.setAttribute("y2", H - 100 / TOP * H);
        ln.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(ln); s1.appendChild(svg);
        const p = i.rain_pct[st.wi];
        s1.appendChild(h("div", "val", p != null ? `${dash(d.winters[st.wi])}: ${p}% of the average ${fmt(i.normal_mm)} mm (line)` : "Not known"));
        // desalination
        const s2 = sec("Desalination capacity (documented)");
        const v = perRes(i);
        if (v != null) {
          meter(s2, 100 * v / 2100, null);
          s2.appendChild(h("div", "val", `${fmt(i.desal_m3d)} m³/day = ${fmt(v)} L per resident a day`));
        } else s2.appendChild(h("div", "val", "No plant listed in the sources used"));
        if (i.temp_permits) s2.appendChild(h("div", "val", `${i.temp_permits} temporary permit${i.temp_permits > 1 ? "s" : ""}${i.temp_permit_m3d ? ", " + fmt(i.temp_permit_m3d) + " m³/day" : ""} (2024–26)`));
        if (i.desal_cost_2025) s2.appendChild(h("div", "val", `Cost in 2025: €${fmt(i.desal_cost_2025, 2)}/m³ (reported)`));
        // roofs
        const s3 = sec("Rain on all its roofs vs residents' use (calculated, upper bound)");
        if (r && r.buildings && r.residents_use_m3) {
          const a = roofPct(r, r.catch_normal_m3), b = roofPct(r, r.catch_driest_m3), top = Math.max(200, a);
          const m = h("div", "meter"), fa = h("i", "lite"), fb = h("i"), ref = h("b");   // pale: average year; solid: driest
          fa.style.width = (100 * a / top).toFixed(1) + "%"; fb.style.width = (100 * b / top).toFixed(1) + "%";
          ref.style.left = (100 * 100 / top).toFixed(1) + "%"; m.append(fa, fb, ref); s3.appendChild(m);
          s3.appendChild(h("div", "val", `Average year ${fmt(a)}% (pale) · driest, ${r.driest_year}, ${fmt(b)}% (solid)`));
          s3.appendChild(h("div", "val", `${fmt(r.buildings)} buildings, ${fmt(r.roof_m2 / 1e4, 1)} ha of roof; use at 150 L a day (line)`));
        } else s3.appendChild(h("div", "val", r ? "No building footprints in the dataset" : "Not counted for this island"));
        // emergencies
        if (i.emergencies.length) {
          const s4 = sec("Water emergencies");
          const em = i.emergencies;
          if (em.length > 3) {
            const doc = em.filter((e) => e.kind === "documented");
            s4.appendChild(h("div", "val", `${doc.length} municipalities, declared ${doc[0].start} to ${doc[doc.length - 1].start} (documented)`));
          } else for (const e of em) s4.appendChild(h("div", "val", `${e.start}${e.end ? " to " + e.end : ""}${e.place && e.place !== i.name ? ", " + e.place : ""}, ${e.by} (${e.kind})`));
        }
        if (r && r.buildings) {
          const b = h("button", "ex-btn", "Zoom to its roofs"); b.type = "button";
          b.addEventListener("click", () => goTo(r));
          c.appendChild(b);
        }
      }

      function update() { drawMarks(); drawRank(); drawCard(); drawScatter(); }
      function select(name) { st.sel = name; update(); }

      // ---- controls
      const winter = $("map-winter");
      winter.max = d.winters.length - 1;
      function setWinter(j, toRain) {
        st.wi = j; winter.value = j;
        $("map-winter-out").textContent = dash(d.winters[j]);
        if (toRain && st.mode !== "rain") { st.mode = "rain"; document.querySelector('input[name=fill][value="rain"]').checked = true; }
        winter.dispatchEvent(new Event("input"));   // the "Numbers" table follows the winter
      }
      winter.addEventListener("input", (e) => {
        if (e.isTrusted) setWinter(+winter.value, true);
        update();
      });
      document.querySelectorAll("input[name=fill]").forEach((r) => r.addEventListener("input", () => { st.mode = r.value; update(); }));
      let timer = null, paused = false;   // Play runs from 1991-92, or resumes where it was paused
      const play = $("map-play"), last = d.winters.length - 1;
      function stop(pause) { clearInterval(timer); timer = null; paused = !!pause; play.textContent = "Play"; play.setAttribute("aria-pressed", "false"); }
      play.addEventListener("click", () => {
        if (timer) return stop(true);
        setWinter(paused && st.wi < last ? st.wi : 0, true);
        play.textContent = "Pause"; play.setAttribute("aria-pressed", "true");
        timer = setInterval(() => { if (st.wi >= last) return stop(false); setWinter(st.wi + 1, true); }, 700);
      });
      const chips = $("map-groups");
      for (const [g, n] of groups) {
        const b = h("button", null, `${g} ${n}`); b.type = "button"; b.setAttribute("aria-pressed", "true");
        b.addEventListener("click", () => {
          if (st.groups.size === groups.length) { st.groups.clear(); st.groups.add(g); }   // first click: only this group
          else if (st.groups.has(g)) { st.groups.delete(g); if (!st.groups.size) groups.forEach(([x]) => st.groups.add(x)); }
          else st.groups.add(g);
          chips.querySelectorAll("button").forEach((x, k) => x.setAttribute("aria-pressed", st.groups.has(groups[k][0]) ? "true" : "false"));
          update();
        });
        chips.appendChild(b);
      }
      const res = $("map-res");
      res.addEventListener("input", () => {
        st.minRes = RES_STEPS[+res.value];
        $("map-res-out").textContent = st.minRes ? fmt(st.minRes) : "any number of";
        update();
      });
      $("map-emerg").addEventListener("input", (e) => { st.emerg = e.target.checked; update(); });
      $("map-desal").addEventListener("input", (e) => { st.desal = e.target.value; update(); });
      $("map-clear").addEventListener("click", () => {
        groups.forEach(([g]) => st.groups.add(g));
        chips.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "true"));
        res.value = 0; st.minRes = 0; $("map-res-out").textContent = "any number of";
        $("map-emerg").checked = false; st.emerg = false;
        $("map-desal").value = ""; st.desal = "";
        update();
      });

      // ---- every roof as a cistern, shown when zoomed in
      const roofLayer = new RoofLayer(ri.islands.filter((r) => r.buildings), { minZoom: ZOOM_ROOFS, maxZoom: 17, pane: "overlayPane" });
      const byName = Object.fromEntries(topo.places.map((p) => [p.name, p]));
      const villageLayer = L.layerGroup();
      const card = (title, rows) => { const box = h("div", "map-card"); box.appendChild(h("strong", null, title)); rows.forEach((t) => box.appendChild(h("div", null, t))); return box; };
      for (const v of roofs.villages) {
        const p = byName[v.name];
        if (!p) continue;
        const c = L.circleMarker([p.lat, p.lon], { radius: 6, color: "#000", weight: 1.5, fillColor: "#fff", fillOpacity: 1 });
        c.bindTooltip(v.name, { direction: "right", offset: [6, 0] });
        c.bindPopup(() => card(`${v.name} and nearby, Sifnos`, [
          `${fmt(v.buildings)} buildings, ${fmt(v.roof_m2)} m² of roof`,
          `Rain on these roofs: ${fmt(v.catch_normal_m3)} m³ in an average year, ${fmt(v.catch_2022_23_m3)} m³ in 2022–23`,
          "Upper bound: every roof drained to a tank large enough to hold it (calculated)",
        ]), { maxWidth: 300 });
        villageLayer.addLayer(c);
      }
      let wasClose = null;
      map.on("zoomend", () => {
        const close = map.getZoom() >= ZOOM_ROOFS;
        if (close === wasClose) return;
        wasClose = close;
        if (close) { map.addLayer(roofLayer); map.addLayer(villageLayer); } else { map.removeLayer(roofLayer); map.removeLayer(villageLayer); }
        drawMarks();
      });
      const centre = Object.fromEntries(d.islands.map((i) => [i.name, [i.lat, i.lon]]));
      function goTo(r) {
        const b = L.latLngBounds([[r.bbox[1], r.bbox[0]], [r.bbox[3], r.bbox[2]]]);
        if (map.getBoundsZoom(b) >= ZOOM_ROOFS + 0.5) map.flyToBounds(b, { duration: 1.2, maxZoom: 15 });
        else map.flyTo(centre[r.name] || b.getCenter(), 13, { duration: 1.2 });   // a large island: its main village
      }

      setWinter(st.wi, false);
      update();
      map.fire("zoomend");

      // ---- the Sifnos roof figures in the text
      const use = roofs.residents * 150 * 365 / 1000;
      const set = (id, s) => { const e = $(id); if (e) e.textContent = s; };
      set("roof-n", fmt(roofs.buildings));
      set("roof-ha", fmt(roofs.roof_m2 / 1e4));
      set("roof-median", fmt(roofs.median_roof_m2));
      set("roof-normal", fmt(Math.round(roofs.catch_normal_m3 / 1000) * 1000));
      set("roof-dry", fmt(Math.round(roofs.catch_2022_23_m3 / 1000) * 1000));
      set("roof-use-normal", fmt(100 * roofs.catch_normal_m3 / use) + "%");
      set("roof-use-dry", fmt(100 * roofs.catch_2022_23_m3 / use) + "%");
      set("roof-desal-normal", fmt(roofs.catch_normal_m3 / roofs.desal_capacity_m3d));
      set("roof-desal-dry", fmt(roofs.catch_2022_23_m3 / roofs.desal_capacity_m3d));

      let lastW = 0, rt;
      window.addEventListener("resize", () => {
        map.invalidateSize();
        clearTimeout(rt);
        rt = setTimeout(() => { const w = $("map-scatter").parentElement.clientWidth; if (w && w !== lastW) { lastW = w; drawScatter(); } }, 150);
      });
    }).catch((e) => { const m = $("aegean-map"); if (m) m.textContent = "The map did not load (" + e.message + ")."; });
})();
