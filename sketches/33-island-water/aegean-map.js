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
    rain: { top: 150, ref: 100, unit: "%", head: (w) => `rain ${w}, % of average` },
    desal: { top: 1000, ref: null, unit: " L", head: () => "litres per resident a day" },
    roofs: { top: 200, ref: 100, unit: "%", head: () => "roof rain, % of use" },
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
        $("map-rank-head").textContent = `${kept.length} of ${d.islands.length} islands · ${M.head(dash(d.winters[st.wi]))}`;
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
      }

      // ---- the selected island
      function drawCard() {
        const i = d.islands.find((x) => x.name === st.sel), r = roofBy[i.name], c = $("map-card");
        c.replaceChildren();
        c.appendChild(h("h4", null, short(i.name)));
        c.appendChild(h("p", "meta", `${i.group} · ${i.residents != null ? fmt(i.residents) + " residents (2021)" : "residents not known"}`));
        // one block per measure: a label and the headline number, a small graphic, a note
        const stat = (label, big) => {
          const b = h("div", "stat"), top = h("div", "stat-h");
          top.append(h("span", null, label), h("strong", null, big));
          b.appendChild(top); c.appendChild(b); return b;
        };
        const meter = (pct, ref) => {
          const m = h("div", "meter"), f = h("i");
          f.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%"; m.appendChild(f);
          if (ref != null) { const b = h("b"); b.style.left = ref.toFixed(1) + "%"; m.appendChild(b); }
          return m;
        };

        // winter rain: every winter since 1991-92, the chosen one dark; click a column to choose it
        const p = i.rain_pct[st.wi];
        const s1 = stat(`Winter rain, ${dash(d.winters[st.wi])}`, p != null ? `${p}%` : "–");
        const svg = document.createElementNS(NS, "svg"), n = d.winters.length, W = 300, H = 34, TOP = 200;
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "spark"); svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Winter rain on ${short(i.name)}, each winter from 1991–92 to 2025–26`);
        i.rain_pct.forEach((v, j) => {
          if (v == null) return;
          const bh = Math.min(v, TOP) / TOP * H, rc = document.createElementNS(NS, "rect");
          rc.setAttribute("x", (j * W / n + 0.5).toFixed(1)); rc.setAttribute("width", (W / n - 1).toFixed(1));
          rc.setAttribute("y", (H - bh).toFixed(1)); rc.setAttribute("height", bh.toFixed(1));
          if (j === st.wi) rc.setAttribute("class", "on");
          const t = document.createElementNS(NS, "title"); t.textContent = `${dash(d.winters[j])}: ${v}%`; rc.appendChild(t);
          rc.addEventListener("click", () => setWinter(j, true));
          svg.appendChild(rc);
        });
        const ln = document.createElementNS(NS, "line");
        ln.setAttribute("x1", 0); ln.setAttribute("x2", W); ln.setAttribute("y1", H / 2); ln.setAttribute("y2", H / 2);
        ln.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(ln); s1.appendChild(svg);
        s1.appendChild(h("div", "stat-n", `of the 1991–2020 average, ${fmt(i.normal_mm)} mm (line); one column per winter since 1991–92`));

        // desalination per resident
        const v = perRes(i);
        const s2 = stat("Desalination per resident", v != null ? `${fmt(v)} L/day` : "none listed");
        if (v != null) {
          s2.appendChild(meter(100 * v / 2000));
          const notes = [`${fmt(i.desal_m3d)} m³/day of capacity`];
          if (i.desal_cost_2025) notes.push(`€${fmt(i.desal_cost_2025, 2)}/m³ in 2025 (reported)`);
          if (i.temp_permits) notes.push(`${i.temp_permits} temporary permit${i.temp_permits > 1 ? "s" : ""} 2024–26${i.temp_permit_m3d ? ", " + fmt(i.temp_permit_m3d) + " m³/day" : ""}`);
          s2.appendChild(h("div", "stat-n", notes.join(" · ")));
        } else s2.appendChild(h("div", "stat-n", "No plant in the sources used."));

        // rain on roofs: average and driest year, against residents' use (the line)
        if (r && r.buildings && r.residents_use_m3) {
          const a = roofPct(r, r.catch_normal_m3), b = roofPct(r, r.catch_driest_m3), top = Math.max(200, Math.ceil(a / 50) * 50);
          const s3 = stat("Rain on roofs, % of residents' use", `${fmt(a)}%`);
          const pair = h("div", "pair");
          pair.append(h("span", null, "average year"), meter(100 * a / top, 100 * 100 / top), h("span", "v", `${fmt(a)}%`),
                      h("span", null, `driest, ${r.driest_year}`), meter(100 * b / top, 100 * 100 / top), h("span", "v", `${fmt(b)}%`));
          s3.appendChild(pair);
          s3.appendChild(h("div", "stat-n", `${fmt(r.buildings)} buildings, ${fmt(r.roof_m2 / 1e4, 1)} ha of roof; line: use at 150 L a day; upper bound`));
        } else stat("Rain on roofs", "–").appendChild(h("div", "stat-n", r ? "No building footprints in the dataset." : "Not counted for this island."));

        // emergencies
        if (i.emergencies.length) {
          const em = i.emergencies, s4 = stat("Water emergencies, 2024–26", "");
          const lines = em.length > 3
            ? [`${em.filter((e) => e.kind === "documented").length} municipalities, declared ${em[0].start} to ${em[em.length - 1].start}`]
            : em.map((e) => `${e.start}${e.end ? " to " + e.end : ""}${e.place && e.place !== i.name ? ", " + e.place : ""} (${e.kind})`);
          s4.appendChild(h("div", "stat-n", lines.join("; ")));
        }
        if (r && r.buildings) {
          const b = h("button", "ex-btn", "Zoom to its roofs"); b.type = "button";
          b.addEventListener("click", () => goTo(r));
          c.appendChild(b);
        }
      }

      function update() { drawMarks(); drawRank(); drawCard(); }
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

      window.addEventListener("resize", () => map.invalidateSize());
    }).catch((e) => { const m = $("aegean-map"); if (m) m.textContent = "The map did not load (" + e.message + ")."; });
})();
