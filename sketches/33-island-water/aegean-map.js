// Aegean freshwater map: an interactive satellite map (Leaflet + Sentinel-2 cloudless 2024, EOX).
// Each island is a small tank filled with a winter's rain (reanalysed, ERA5) or desalination
// capacity per resident (documented / observed = calculated). On Sifnos, every building
// footprint is drawn as a possible cistern (Microsoft ML footprints, ODbL), with the rain that
// lands on the roofs of each settlement (calculated, an upper bound).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const dash = (w) => w.replace("-", "–");
  const RAIN_TOP = 150, DESAL_TOP = 1000;
  const USE_L = 150;   // litres per resident a day, the Cisterns tab's default (synthetic)
  const water = () => getComputedStyle(document.documentElement).getPropertyValue("--water").trim() || "#1a5fb4";

  function card(title, rows) {   // popup content, built with text nodes only
    const box = document.createElement("div");
    box.className = "map-card";
    const h = document.createElement("strong"); h.textContent = title; box.appendChild(h);
    for (const r of rows) { const p = document.createElement("div"); p.textContent = r; box.appendChild(p); }
    return box;
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

  Promise.all(["situate_islands", "roofs_sifnos", "sifnos_topo"].map((f) => fetch(`data/page/${f}.json`).then((r) => r.json())))
    .then(([d, roofs, topo]) => {
      const { mapRows, perRes } = window.SituateRows;
      const map = L.map("aegean-map", { zoomSnap: 0.5, scrollWheelZoom: false, worldCopyJump: false });
      L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg", {
        maxNativeZoom: 15, maxZoom: 17, minZoom: 6,
        attribution: 'Sentinel-2 cloudless 2024 by <a href="https://s2maps.eu">EOX IT Services GmbH</a> ' +
                     '(modified Copernicus Sentinel data 2024; CC BY-NC-SA 4.0) · buildings: Microsoft (ODbL)',
      }).addTo(map);
      map.fitBounds(d.islands.map((i) => [i.lat, i.lon]), { padding: [10, 10] });

      // ---- islands as tanks
      const marks = L.layerGroup().addTo(map);
      function drawIslands() {
        marks.clearLayers();
        const mode = document.querySelector("input[name=fill]:checked").value;
        const wi = +$("map-winter").value;
        $("map-winter").disabled = mode !== "rain";
        for (const i of d.islands) {
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
          m.bindPopup(() => card(i.name, mapRows(i, d, wi)), { maxWidth: 300 });
          marks.addLayer(m);
        }
      }
      document.querySelectorAll("input[name=fill], #map-winter").forEach((e) => e.addEventListener("input", drawIslands));
      drawIslands();

      // ---- Sifnos: every roof as a cistern, shown when zoomed in
      const canvas = L.canvas({ padding: 0.3 });
      const roofLayer = L.layerGroup();
      for (const f of roofs.footprints) {
        const ll = [];
        for (let k = 0; k < f.length; k += 2) ll.push([f[k + 1], f[k]]);
        roofLayer.addLayer(L.polygon(ll, { renderer: canvas, stroke: true, weight: 1.2, color: water(), opacity: 1,
                                           fillColor: water(), fillOpacity: 0.85, interactive: false }));
      }
      const byName = Object.fromEntries(topo.places.map((p) => [p.name, p]));
      const villageLayer = L.layerGroup();
      for (const v of roofs.villages) {
        const p = byName[v.name];
        if (!p) continue;
        const c = L.circleMarker([p.lat, p.lon], { radius: 6, color: "#000", weight: 1.5, fillColor: "#fff", fillOpacity: 1 });
        c.bindTooltip(v.name, { direction: "right", offset: [6, 0] });
        c.bindPopup(() => card(`${v.name} and nearby`, [
          `${fmt(v.buildings)} buildings, ${fmt(v.roof_m2)} m² of roof`,
          `Rain on these roofs: ${fmt(v.catch_normal_m3)} m³ in an average year, ${fmt(v.catch_2022_23_m3)} m³ in 2022–23`,
          "Upper bound: every roof drained to a tank large enough to hold it (calculated)",
        ]), { maxWidth: 300 });
        villageLayer.addLayer(c);
      }
      const ZOOM_ROOFS = 12;
      function roofsByZoom() {
        const on = map.getZoom() >= ZOOM_ROOFS;
        if (on && !map.hasLayer(roofLayer)) { map.addLayer(roofLayer); map.addLayer(villageLayer); map.removeLayer(marks); }
        if (!on && map.hasLayer(roofLayer)) { map.removeLayer(roofLayer); map.removeLayer(villageLayer); map.addLayer(marks); }
      }
      map.on("zoomend", roofsByZoom);
      $("zoom-sifnos").addEventListener("click", () => map.flyTo([36.965, 24.705], 13, { duration: 1.2 }));
      $("zoom-aegean").addEventListener("click", () => map.flyToBounds(d.islands.map((i) => [i.lat, i.lon]), { padding: [10, 10], duration: 1.2 }));

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
