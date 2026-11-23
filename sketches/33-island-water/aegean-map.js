// Aegean freshwater map: an interactive satellite map (Leaflet + Sentinel-2 cloudless 2024, EOX).
// Each island is a small tank filled with a winter's rain (reanalysed, ERA5) or desalination
// capacity per resident (documented / observed = calculated). Zoomed in, every building
// footprint on the 85 islands with buildings is drawn as a possible cistern (Microsoft ML
// footprints, ODbL; cartographic). Each island's footprints load when it comes into view.
// The island card adds the rain that lands on its roofs (calculated, an upper bound).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const RAIN_TOP = 150, DESAL_TOP = 1000;
  const USE_L = 150;   // litres per resident a day, the Cisterns tab's default (synthetic)
  const ZOOM_ROOFS = 12;
  const water = () => getComputedStyle(document.documentElement).getPropertyValue("--water").trim() || "#1a5fb4";
  const short = (n) => n.replace(" (Thira)", "").replace(" (Megisti)", "");

  function card(title, rows) {   // popup content, built with text nodes only
    const box = document.createElement("div");
    box.className = "map-card";
    const h = document.createElement("strong"); h.textContent = title; box.appendChild(h);
    for (const r of rows) { const p = document.createElement("div"); p.textContent = r; box.appendChild(p); }
    return box;
  }

  function roofRows(r) {
    if (!r || !r.buildings) return ["Roofs: no building footprints in the dataset"];
    const rows = [`Roofs: ${fmt(r.buildings)} buildings, ${fmt(r.roof_m2 / 1e4, r.roof_m2 < 1e5 ? 1 : 0)} ha (cartographic)`];
    if (r.catch_normal_m3 != null) {
      const pct = (v) => r.residents_use_m3 ? `, ${fmt(100 * v / r.residents_use_m3)}% of residents' use` : "";
      rows.push(`Rain on them: ${fmt(r.catch_normal_m3)} m³ in an average year${pct(r.catch_normal_m3)}`);
      rows.push(`${fmt(r.catch_driest_m3)} m³ in the driest year, ${r.driest_year}${pct(r.catch_driest_m3)} (calculated, upper bound)`);
    }
    return rows;
  }

  function tankIcon(f, opts) {
    const w = 12, h = 18, fh = Math.max(0, Math.min(1, f)) * (h - 3);
    const normal = opts.normal != null ? `<line x1="-1" x2="${w + 1}" y1="${h - 1.5 - opts.normal * (h - 3)}" y2="${h - 1.5 - opts.normal * (h - 3)}" stroke="#000" stroke-width="1"/>` : "";
    const em = opts.emergency ? `<circle cx="${w + 3}" cy="2" r="3" fill="#000" stroke="#fff" stroke-width="1"/>` : "";
    const dashArr = opts.none ? ' stroke-dasharray="2 2"' : "";
    const svg = `<svg width="${w + 8}" height="${h + 2}" viewBox="-1 -1 ${w + 8} ${h + 2}" aria-hidden="true">
      <rect x="0" y="0" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="${opts.here ? 2 : 1.2}"${dashArr}/>
      <rect x="1.5" y="${h - 1.5 - fh}" width="${w - 3}" height="${fh}" fill="${water()}"/>${normal}${em}</svg>`;
    return L.divIcon({ className: "tank-icon", html: svg, iconSize: [w + 8, h + 2], iconAnchor: [w / 2, h + 1], popupAnchor: [0, -h] });
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
          let x = enc[0], y = enc[1];
          const pts = [];
          let cx = 0, cy = 0;
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
      const { mapRows, perRes } = window.SituateRows;
      const roofBy = Object.fromEntries(ri.islands.map((r) => [r.name, r]));
      const map = L.map("aegean-map", { zoomSnap: 0.5, scrollWheelZoom: false, worldCopyJump: false });
      L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg", {
        maxNativeZoom: 15, maxZoom: 17, minZoom: 6,
        attribution: 'Sentinel-2 cloudless 2024 by <a href="https://s2maps.eu">EOX IT Services GmbH</a> ' +
                     '(modified Copernicus Sentinel data 2024; CC BY-NC-SA 4.0) · buildings: Microsoft (ODbL)',
      }).addTo(map);
      const allBounds = d.islands.map((i) => [i.lat, i.lon]);
      map.fitBounds(allBounds, { padding: [10, 10] });

      // ---- islands as tanks (Sifnos's tank gives way to its villages when zoomed in)
      const marks = L.layerGroup().addTo(map);
      function drawIslands() {
        marks.clearLayers();
        const mode = document.querySelector("input[name=fill]:checked").value;
        const wi = +$("map-winter").value, close = map.getZoom() >= ZOOM_ROOFS;
        $("map-winter").disabled = mode !== "rain";
        for (const i of d.islands) {
          if (close && i.name === "Sifnos") continue;
          let f = 0, none = false, normal = null;
          if (mode === "rain") {
            const p = i.rain_pct[wi];
            if (p == null) none = true; else { f = p / RAIN_TOP; normal = 100 / RAIN_TOP; }
          } else {
            const v = perRes(i);
            if (v == null) none = true; else f = v / DESAL_TOP;
          }
          const m = L.marker([i.lat, i.lon], { icon: tankIcon(f, { none, normal, emergency: i.emergencies.length > 0, here: i.name === "Sifnos" }),
                                               title: i.name, keyboard: true, riseOnHover: true });
          m.bindPopup(() => card(i.name, mapRows(i, d, wi).concat(roofRows(roofBy[i.name]))), { maxWidth: 320 });
          marks.addLayer(m);
        }
      }
      document.querySelectorAll("input[name=fill], #map-winter").forEach((e) => e.addEventListener("input", drawIslands));
      drawIslands();

      // ---- every roof as a cistern, shown when zoomed in
      const roofLayer = new RoofLayer(ri.islands.filter((r) => r.buildings), { minZoom: ZOOM_ROOFS, maxZoom: 17, pane: "overlayPane" });
      const byName = Object.fromEntries(topo.places.map((p) => [p.name, p]));
      const villageLayer = L.layerGroup();
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
      function byZoom() {
        const close = map.getZoom() >= ZOOM_ROOFS;
        if (close === wasClose) return;
        wasClose = close;
        if (close) { map.addLayer(roofLayer); map.addLayer(villageLayer); } else { map.removeLayer(roofLayer); map.removeLayer(villageLayer); }
        drawIslands();
      }
      map.on("zoomend", byZoom);
      byZoom();

      // ---- getting around
      const centre = Object.fromEntries(d.islands.map((i) => [i.name, [i.lat, i.lon]]));
      function goTo(r) {
        const b = L.latLngBounds([[r.bbox[1], r.bbox[0]], [r.bbox[3], r.bbox[2]]]);
        if (map.getBoundsZoom(b) >= ZOOM_ROOFS + 0.5) map.flyToBounds(b, { duration: 1.2, maxZoom: 15 });
        else map.flyTo(centre[r.name] || b.getCenter(), 13, { duration: 1.2 });   // a large island: its main village
      }
      const sel = $("roof-island");
      if (sel) {
        ri.islands.filter((r) => r.buildings).sort((a, b) => a.name.localeCompare(b.name)).forEach((r) => {
          const o = document.createElement("option"); o.value = r.name; o.textContent = short(r.name); sel.appendChild(o);
        });
        sel.addEventListener("change", () => { if (sel.value) goTo(roofBy[sel.value]); });
      }
      $("zoom-sifnos").addEventListener("click", () => map.flyTo([36.965, 24.705], 13, { duration: 1.2 }));
      $("zoom-aegean").addEventListener("click", () => { if (sel) sel.value = ""; map.flyToBounds(allBounds, { padding: [10, 10], duration: 1.2 }); });

      // ---- the Sifnos roof figures in the text
      const use = roofs.residents * USE_L * 365 / 1000;
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
