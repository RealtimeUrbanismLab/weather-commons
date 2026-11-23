// The Ship as Instrument: the map, timeline, ship pop-up, ship index and sources.
(() => {
// ---------- data ----------
const dec = (b, T) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
const RAW = window.CLIWOC_ENTRIES, SHIPS = window.CLIWOC_SHIPS, STORMS = window.CLIWOC_STORMS || [], EVENTS = window.EVENTS || [], GL = window.GLOSSARY;
const N = RAW.n, DAY = dec(RAW.day, Uint32Array), LAT = dec(RAW.lat, Int16Array), LON = dec(RAW.lon, Int16Array), SHIP = dec(RAW.ship, Uint16Array);
const HOW = RAW.how ? dec(RAW.how, Uint8Array) : new Uint8Array(N);
const WIND = window.CLIWOC_WIND, WU = dec(WIND.u, Float32Array), WV = dec(WIND.v, Float32Array), WC = dec(WIND.count, Float32Array);
const EPOCH = Date.UTC(1662, 0, 1);
const dateOf = d => new Date(EPOCH + d * 864e5);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = d => { const t = dateOf(d); return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
const dayOfDate = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 864e5);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const title = s => String(s || '').toLowerCase().replace(/(^|[\s'(-])\S/g, c => c.toUpperCase());
let DETAILS = null;

// slavery recorded in the logbooks, by voyage: recorded / likely / aboard; and slave ships met by other ships
const SLAV = window.SLAVERY || { voyages: [], encounters: [] }, SLAVE_COL = '#e0508a';
const shipSlav = new Map(); SLAV.voyages.forEach(v => { if (!shipSlav.has(v.ship)) shipSlav.set(v.ship, []); shipSlav.get(v.ship).push(v); });
const slaveAt = (s, d) => (shipSlav.get(s) || []).find(v => d >= v.start - 1 && d <= v.end + 1);
const SLAVE_LABEL = { recorded: 'slave voyage: recorded in its own logbook', likely: 'slave voyage: very likely (company and route)', aboard: 'enslaved people on board', encounter: 'slave ship met by another ship' };
// storms and events that each ship took part in
const shipStorms = new Map(), shipEvents = new Map();
STORMS.forEach((s, i) => s.ships.forEach(k => { if (!shipStorms.has(k)) shipStorms.set(k, []); shipStorms.get(k).push(i); }));
EVENTS.forEach((e, i) => (e.ships || []).forEach(k => { if (!shipEvents.has(k)) shipEvents.set(k, []); shipEvents.get(k).push(i); }));

// ---------- empire colours: each ship its own tone ----------
const NATIONS = [
  { name: 'Spanish', hue: 348, sat: 62 }, { name: 'Dutch', hue: 176, sat: 58 }, { name: 'British', hue: 214, sat: 72 },
  { name: 'French', hue: 42, sat: 70 }, { name: 'Other', hue: 0, sat: 0 }];
const shown = NATIONS.map(() => true);
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
const tone = SHIPS.map(s => { const n = NATIONS[s.nat], r = hash(s.name); return `hsl(${n.hue + (r - .5) * 18} ${n.sat}% ${48 + r * 30}%)`; });
NATIONS.forEach((n, i) => {
  const l = document.createElement('label');
  l.innerHTML = `<i style="background:hsl(${n.hue} ${n.sat}% 60%)"></i>${n.name}`;
  l.onclick = () => { shown[i] = !shown[i]; l.style.opacity = shown[i] ? 1 : .35; drawShips(); };
  $('legend').appendChild(l);
});

// ---------- view: plate carrée with pan and zoom ----------
const stage = $('stage'), cBase = $('base'), cWind = $('wind'), cShips = $('ships');
const gBase = cBase.getContext('2d'), gWind = cWind.getContext('2d'), gShips = cShips.getContext('2d');
let W = 0, H = 0, DPR = 1, k = 4, ox = 0, oy = 0;
const X = lon => ox + lon * k, Y = lat => oy - lat * k;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  for (const c of [cBase, cWind, cShips]) { c.width = W * DPR; c.height = H * DPR; c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0); }
}
function home() { k = Math.max(W / 360, Math.min(W / 160, H / 110)); ox = W / 2 + 25 * k; oy = H / 2 - 5 * k; }

// ---------- wind field ----------
let month = 0;
function windAt(lon, lat, m = month) {
  const g = WIND.g, fx = (lon + 180) / g - .5, fy = (90 - lat) / g - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  let u = 0, v = 0, c = 0;
  for (const [dx, dy, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
    const yy = Math.min(WIND.ny - 1, Math.max(0, y0 + dy)), xx = ((x0 + dx) % WIND.nx + WIND.nx) % WIND.nx, i = (m * WIND.ny + yy) * WIND.nx + xx;
    u += WU[i] * w; v += WV[i] * w; c += WC[i] * w;
  }
  return [u, v, c];
}
// Land and the speed shading are drawn to offscreen canvases: land once per view, shading once per month per view.
let landCanvas = null, landMask = null, shadeCache = new Map();
function off() { const c = document.createElement('canvas'); c.width = W * DPR; c.height = H * DPR; const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); return [c, g]; }
function buildLand() {
  const [c, g] = off();
  g.fillStyle = '#0d1120'; g.strokeStyle = 'rgba(200,215,240,.55)'; g.lineWidth = .7; g.beginPath();
  for (const ring of window.LAND) { ring.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath(); }
  g.fill(); g.stroke();
  g.strokeStyle = 'rgba(150,170,210,.08)'; g.beginPath();
  for (let lo = -180; lo <= 180; lo += 30) { g.moveTo(X(lo), Y(85)); g.lineTo(X(lo), Y(-85)); }
  for (let la = -60; la <= 60; la += 30) { g.moveTo(X(-180), Y(la)); g.lineTo(X(180), Y(la)); }
  g.stroke();
  landCanvas = c;
  // mask: draw land alone and read back alpha
  const [mc, mg] = off(); mg.fillStyle = '#000'; mg.beginPath();
  for (const ring of window.LAND) { ring.forEach(([lo, la], i) => i ? mg.lineTo(X(lo), Y(la)) : mg.moveTo(X(lo), Y(la))); mg.closePath(); }
  mg.fill(); landMask = { d: mg.getImageData(0, 0, mc.width, mc.height).data, w: mc.width };
  shadeCache = new Map();
}
function shade(m) {
  if (shadeCache.has(m)) return shadeCache.get(m);
  const [c, g] = off(), step = 6;
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    const lon = (x - ox) / k, lat = (oy - y) / k;
    if (lat > 85 || lat < -85 || lon < -180 || lon > 180) continue;
    const [u, v, n] = windAt(lon, lat, m); if (n < .3) continue;
    const t = Math.min(1, Math.hypot(u, v) / 12);
    g.fillStyle = `rgba(${30 + t * 60 | 0},${40 + t * 170 | 0},${110 + t * 30 | 0},${Math.min(.85, n / 6)})`; g.fillRect(x, y, step, step);
  }
  shadeCache.set(m, c); return c;
}
function drawBase() {
  gBase.setTransform(1, 0, 0, 1, 0, 0);
  gBase.fillStyle = '#05070f'; gBase.fillRect(0, 0, cBase.width, cBase.height);
  gBase.drawImage(shade(month), 0, 0); gBase.drawImage(landCanvas, 0, 0);
  gBase.setTransform(DPR, 0, 0, DPR, 0, 0);
}
const onLand = (x, y) => { if (!landMask || x < 0 || y < 0 || x >= W || y >= H) return false; return landMask.d[((y * DPR | 0) * landMask.w + (x * DPR | 0)) * 4 + 3] > 0; };

let parts = [];
function spawn(p) { for (let t = 0; t < 20; t++) { p.x = Math.random() * W; p.y = Math.random() * H; const [, , c] = windAt((p.x - ox) / k, (oy - p.y) / k); if (c > .5 && !onLand(p.x, p.y)) break; } p.age = Math.random() * 80 | 0; return p; }
function resetParticles() { parts = Array.from({ length: Math.min(5000, (W * H) / 260 | 0) }, () => spawn({})); gWind.clearRect(0, 0, W, H); }
function stepWind() {
  gWind.globalCompositeOperation = 'destination-in'; gWind.fillStyle = 'rgba(0,0,0,.93)'; gWind.fillRect(0, 0, W, H);
  gWind.globalCompositeOperation = 'source-over'; gWind.strokeStyle = 'rgba(225,235,255,.55)'; gWind.lineWidth = .8; gWind.beginPath();
  const sp = .045 * Math.sqrt(k);
  for (const p of parts) {
    const lon = (p.x - ox) / k, lat = (oy - p.y) / k, [u, v, c] = windAt(lon, lat);
    if (p.age-- < 0 || c < .3 || lat > 85 || lat < -85) { spawn(p); continue; }
    const nx = p.x + u * sp, ny = p.y - v * sp;
    if (onLand(nx, ny)) { spawn(p); continue; }
    gWind.moveTo(p.x, p.y); gWind.lineTo(nx, ny); p.x = nx; p.y = ny;
  }
  gWind.stroke();
}

// ---------- ships, storms and events at a moment ----------
const TRAIL = 25, PRESENT = 4;
let today = dayOfDate(1796, 3, 7), visible = [], selected = null, pulse = 0;
const lowerBound = d => { let a = 0, b = N; while (a < b) { const m = a + b >> 1; DAY[m] < d ? a = m + 1 : b = m; } return a; };
const kmToPx = km => km / 111 * k;
function rkUnderline(g, txt, x, y) { const w = g.measureText(txt).width; g.save(); g.strokeStyle = 'rgba(159,176,204,.9)'; g.lineWidth = 1; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x + w, y + 3); g.stroke(); g.restore(); }
function drawShips() {
  gShips.clearRect(0, 0, W, H);
  drawLayersUnder(gShips);
  // events of empire: a red epicentre with a radius, while the event lasts (and fading for 30 days after)
  for (const e of EVENTS) {
    if (today < e.start - 2 || today > e.end + 30) continue;
    const a = today <= e.end ? 1 : 1 - (today - e.end) / 30;
    if (e.radiusKm >= 1000) { // a voyage, not a place (the Middle Passage): mark the ship itself while it lasts
      if (today > e.end) continue;
      for (const s of e.ships) {
        let j = lowerBound(today - PRESENT), at = -1; for (; j < N && DAY[j] <= today; j++) if (SHIP[j] === s) at = j;
        if (at < 0) continue;
        const x = X(LON[at] / 100), y = Y(LAT[at] / 100), grd = gShips.createRadialGradient(x, y, 0, x, y, 26);
        grd.addColorStop(0, 'rgba(224,83,61,.6)'); grd.addColorStop(1, 'rgba(224,83,61,0)');
        gShips.fillStyle = grd; gShips.beginPath(); gShips.arc(x, y, 26, 0, 7); gShips.fill();
        gShips.fillStyle = 'rgb(255,190,175)'; gShips.font = '12px system-ui'; const lbl = e.name.replace(/^MCC slave voyage: (.*) \(Middle Passage\)$/, (m, n) => `${title(n)}: enslaved people on board`); gShips.fillText(lbl, x + 14, y - 12); if (rkOn) rkUnderline(gShips, lbl, x + 14, y - 12);
      }
      continue;
    }
    const x = X(e.lon), y = Y(e.lat), r = Math.max(10, kmToPx(e.radiusKm || 150));
    const grd = gShips.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, `rgba(224,83,61,${.45 * a})`); grd.addColorStop(1, 'rgba(224,83,61,0)');
    gShips.fillStyle = grd; gShips.beginPath(); gShips.arc(x, y, r, 0, 7); gShips.fill();
    gShips.strokeStyle = `rgba(224,83,61,${.8 * a})`; gShips.lineWidth = 1; gShips.beginPath(); gShips.arc(x, y, r, 0, 7); gShips.stroke();
    gShips.fillStyle = `rgba(255,190,175,${a})`; gShips.font = '12px system-ui'; gShips.fillText(e.name, x + r * .72 + 4, y - r * .72); if (rkOn) rkUnderline(gShips, e.name, x + r * .72 + 4, y - r * .72);
  }
  // storms: an ochre ring where the logbooks recorded one, during its days
  for (const s of STORMS) {
    if (today < s.start - 1 || today > s.end + 2 || s.ships.length < 1) continue;
    if (!s.ships.some(i => shown[SHIPS[i].nat])) continue;
    const x = X(s.lon), y = Y(s.lat), r = 8 + Math.sqrt(s.ships.length) * 6;
    gShips.strokeStyle = 'rgba(217,164,65,.85)'; gShips.lineWidth = 1.5; gShips.setLineDash([3, 3]);
    gShips.beginPath(); gShips.arc(x, y, r, 0, 7); gShips.stroke(); gShips.setLineDash([]);
    gShips.fillStyle = 'rgba(217,164,65,.12)'; gShips.fill();
  }
  const lo = lowerBound(today - TRAIL), hi = lowerBound(today + 1), tracks = new Map();
  for (let i = lo; i < hi; i++) { const s = SHIP[i]; if (!shown[SHIPS[s].nat]) continue; let t = tracks.get(s); if (!t) tracks.set(s, t = []); t.push(i); }
  visible = []; gShips.lineCap = 'round';
  for (const [s, t] of tracks) {
    t.sort((a, b) => DAY[a] - DAY[b]);
    const last = t[t.length - 1], age = today - DAY[last], fade = age <= PRESENT ? 1 : Math.max(0, 1 - (age - PRESENT) / (TRAIL - PRESENT));
    if (fade <= 0) continue;
    gShips.strokeStyle = tone[s]; gShips.globalAlpha = .55 * fade; gShips.lineWidth = 1.2;
    strokeTrack(gShips, t, i => X(LON[i] / 100), i => Y(LAT[i] / 100), (a, b) => Math.abs(LON[b] - LON[a]) <= 9000);
    const sv = slaveAt(s, DAY[last]);
    if (sv) { // the whole voyage so far, in the slavery colour: solid when recorded, dashed when likely, dotted for people aboard
      gShips.save(); gShips.globalAlpha = fade; gShips.strokeStyle = SLAVE_COL; gShips.lineWidth = sv.tier === 'aboard' ? 1.4 : 2.4;
      gShips.setLineDash(sv.tier === 'recorded' ? [] : sv.tier === 'likely' ? [6, 4] : [1.5, 3]); gShips.beginPath();
      let pv = null; for (let i = lowerBound(Math.max(sv.start, today - 400)); i < hi; i++) { if (SHIP[i] !== s) continue; const lon = LON[i] / 100, lat = LAT[i] / 100; if (pv == null || Math.abs(lon - pv) > 90) gShips.moveTo(X(lon), Y(lat)); else gShips.lineTo(X(lon), Y(lat)); pv = lon; }
      gShips.stroke(); gShips.restore();
    }
    const x = X(LON[last] / 100), y = Y(LAT[last] / 100);
    gShips.globalAlpha = fade; gShips.fillStyle = tone[s]; gShips.beginPath(); gShips.arc(x, y, age <= PRESENT ? 3.6 : 2.4, 0, 7); gShips.fill();
    if (age <= PRESENT) { gShips.strokeStyle = shipEvents.has(s) ? 'rgba(255,140,120,.95)' : 'rgba(255,255,255,.7)'; gShips.lineWidth = .8; gShips.stroke(); visible.push({ s, i: last, x, y }); }
  }
  gShips.globalAlpha = 1;
  for (const v of visible) { const sv = slaveAt(v.s, DAY[v.i]); if (!sv) continue;
    gShips.strokeStyle = SLAVE_COL; gShips.lineWidth = 2; gShips.setLineDash(sv.tier === 'recorded' ? [] : sv.tier === 'likely' ? [4, 3] : [1.5, 2.5]);
    gShips.beginPath(); gShips.rect(v.x - 8, v.y - 8, 16, 16); gShips.stroke(); gShips.setLineDash([]); }
  for (const e of SLAV.encounters) {
    if (Math.abs(today - e.day) > 6 || !shown[SHIPS[e.by].nat]) continue;
    const a = 1 - Math.abs(today - e.day) / 7, x = X(e.lon), y = Y(e.lat);
    gShips.globalAlpha = a; gShips.strokeStyle = SLAVE_COL; gShips.lineWidth = 1.3; gShips.setLineDash([2, 2]);
    gShips.beginPath(); gShips.rect(x - 7, y - 7, 14, 14); gShips.stroke(); gShips.setLineDash([]);
    gShips.beginPath(); gShips.moveTo(x - 4, y - 4); gShips.lineTo(x + 4, y + 4); gShips.moveTo(x + 4, y - 4); gShips.lineTo(x - 4, y + 4); gShips.stroke();
    gShips.fillStyle = SLAVE_COL; gShips.font = '12px system-ui';
    gShips.fillText(`slave ship, logged by the ${title(SHIPS[e.by].name)}`, x + 11, y + 4);
  }
  gShips.globalAlpha = 1;
  drawLabels(gShips, visible); drawLayersOver(gShips);
  if (selected != null) { const v = visible.find(v => v.s === selected); if (v) { gShips.strokeStyle = '#fff'; gShips.lineWidth = 1.5; gShips.beginPath(); gShips.arc(v.x, v.y, 9, 0, 7); gShips.stroke(); } }
  $('count').textContent = `${visible.length} ship${visible.length === 1 ? '' : 's'} writing in their logbooks around this day`;
}

// ---------- timeline: density (blue), storms (ochre), events of empire (red), draggable ----------
// The timeline starts in 1750: before that CLIWOC has only a few hundred scattered entries.
const tl = $('timeline'), first = dayOfDate(1750, 1, 1), lastDay = DAY[N - 1], PADX = 8;
let tlW = 0, tlH = 82, density = null;
const dayToX = d => PADX + (d - first) / (lastDay - first) * (tlW - 2 * PADX);
const xToDay = x => first + (x - PADX) / (tlW - 2 * PADX) * (lastDay - first);
function buildTimeline() {
  tlW = tl.clientWidth; tl.width = tlW * DPR; tl.height = tlH * DPR;
  density = new Float32Array(Math.max(1, (tlW - 2 * PADX) / 3 | 0));
  for (let i = 0; i < N; i++) if (DAY[i] >= first) density[Math.min(density.length - 1, (DAY[i] - first) / (lastDay - first) * density.length | 0)]++;
}
function drawTimeline() {
  const g = tl.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, tlW, tlH);
  // rows: events of empire on top (y 0–12), sky and sea (14–22, when that layer is on), storms (26–40), entries per year at the bottom (base 64)
  const base = 64, mx = Math.max(...density);
  g.fillStyle = 'rgba(111,168,214,.55)';
  density.forEach((b, i) => { const h = Math.sqrt(b / mx) * 22; g.fillRect(PADX + i * 3, base - h, 2, h); });
  // storms as ochre ticks above, taller when more ships logged them
  // one-ship storms faint and short; storms logged by several ships bright and tall
  for (const s of STORMS) {
    const x = dayToX(s.start), many = s.ships.length > 1, h = many ? 6 + Math.min(8, s.ships.length * 2) : 4;
    g.fillStyle = many ? 'rgba(232,176,72,.95)' : 'rgba(217,164,65,.22)'; g.fillRect(x - (many ? .5 : 0), 40 - h, many ? 2 : 1, h);
  }
  // sky and sea: only the rare sightings (aurora, comet, eclipse, waterspout, earthquake)
  if (LY.sky && DATA.sky) { g.fillStyle = 'rgba(215,200,255,.95)'; for (const p of DATA.sky) { if (!SKY_RARE.has(p.c)) continue; g.beginPath(); g.arc(dayToX(p.day), 18, 2.2, 0, 7); g.fill(); } }
  // events of empire as red marks
  g.fillStyle = '#e0533d';
  for (const e of EVENTS) { const x = dayToX(e.start); g.globalAlpha = 1; g.beginPath(); g.moveTo(x, 9); g.lineTo(x - 4.5, 1); g.lineTo(x + 4.5, 1); g.closePath(); g.fill(); g.fillRect(x - .5, 9, 1, 4); g.globalAlpha = .28; g.fillRect(x - .5, 41, 1, base - 41); }
  g.globalAlpha = 1;
  // year labels
  g.fillStyle = '#93a0b8'; g.font = '11px system-ui'; g.textAlign = 'center';
  for (let y = 1750; y <= 1850; y += 10) { const x = dayToX(dayOfDate(y, 1, 1)); g.fillText(y, x, 79); g.fillRect(x - .5, base, 1, 3); }
  // the handle
  g.save(); for (const v of SLAV.voyages) { if (v.tier === 'aboard') continue; g.strokeStyle = SLAVE_COL; g.lineWidth = 2.2; g.setLineDash(v.tier === 'likely' ? [3, 2] : []); g.beginPath(); g.moveTo(dayToX(v.start), 68); g.lineTo(Math.max(dayToX(v.start) + 1.5, dayToX(v.end)), 68); g.stroke(); } g.restore();
  if (showWords && numShare) { g.strokeStyle = '#8fd3e8'; g.lineWidth = 1.5; g.beginPath(); let on = false; numShare.share.forEach((v, k) => { if (v == null) { on = false; return; } const x = dayToX(dayOfDate(numShare.y0 + k, 7, 1)), y = base - 2 - v * 30; on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; }); g.stroke(); }
  const hx = dayToX(today); g.fillStyle = '#fff'; g.fillRect(hx - 1, 0, 2, base + 2); g.beginPath(); g.arc(hx, base + 2, 4, 0, 7); g.fill();
}
function setDay(d) {
  today = Math.max(first, Math.min(lastDay, Math.round(d)));
  $('date').textContent = fmt(today);
  const m = dateOf(today).getUTCMonth(); if (m !== month) { month = m; drawBase(); }
  drawShips(); drawTimeline();
  if (selected != null && DETAILS) showShip(selected);
}
let dragTL = false;
const tlX = e => e.clientX - tl.getBoundingClientRect().left;
// the top row is for events of empire, the row below for storms
function nearMark(x, y) {
  if (y >= 13 && y < 24) { if (!(LY.sky && DATA.sky)) return null; let best = null, bd = 4; for (const p of DATA.sky) { if (!SKY_RARE.has(p.c)) continue; const d = Math.abs(dayToX(p.day) - x); if (d < bd) { bd = d; best = p; } } return best ? { kind: 'sky', p: best } : null; }
  if (y < 13) { let best = null, bd = 6; for (const e of EVENTS) { const d = Math.abs(dayToX(e.start) - x); if (d < bd) { bd = d; best = e; } } return best ? { kind: 'event', e: best } : null; }
  if (y > 42) return null;
  let best = null, bd = 3;
  for (const s of STORMS) if (s.ships.length > 1) { const d = Math.abs(dayToX(s.start) - x); if (d < bd + 1) { bd = d - 1; best = s; } }
  for (const s of STORMS) { const d = Math.abs(dayToX(s.start) - x); if (d < bd) { bd = d; best = s; } }
  return best ? { kind: 'storm', s: best } : null;
}
tl.addEventListener('pointerdown', e => { dragTL = true; tl.setPointerCapture(e.pointerId); stop(); setDay(xToDay(tlX(e))); });
tl.addEventListener('pointermove', e => {
  const x = tlX(e);
  if (dragTL) { setDay(xToDay(x)); return; }
  const y = e.clientY - tl.getBoundingClientRect().top, m = nearMark(x, y), tip = $('tip');
  if (m) {
    tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 330, e.clientX + 10) + 'px'; tip.style.top = e.clientY - 60 + 'px';
    tip.innerHTML = m.kind === 'sky' ? skyText(m.p) + '<br><span style="color:#93a0b8">click to go there</span>' : m.kind === 'event' ? `<b class="mx" style="color:#ff9b88">${esc(m.e.name)}</b><br>${fmt(m.e.start)} · click to go there` :
      `<b style="color:#e2b25a">Storm</b> · ${fmt(m.s.start)}${m.s.end > m.s.start ? '–' + fmt(m.s.end) : ''}<br>${m.s.ships.length} ship${m.s.ships.length > 1 ? 's' : ''}: <i>${esc((m.s.words[0] || '').toLowerCase())}</i>${m.s.ships.length > 1 ? '<br>click to see how each ship logged it' : ''}`;
  } else tip.style.display = 'none';
});
tl.addEventListener('pointerup', e => {
  dragTL = false;
  const y = e.clientY - tl.getBoundingClientRect().top, m = nearMark(tlX(e), y);
  if (m && m.kind === 'sky') { setDay(m.p.day); flyTo(LON[m.p.i] / 100, LAT[m.p.i] / 100); return; }
  if (m) { const t = m.kind === 'event' ? m.e : m.s; setDay(t.start); flyTo(t.lon, t.lat); if (m.kind === 'storm' && m.s.ships.length > 1) openStormWithData(m.s); }
});
tl.addEventListener('pointerleave', () => { $('tip').style.display = 'none'; });
tl.addEventListener('keydown', e => {
  const step = e.shiftKey ? 365 : 1;
  if (e.key === 'ArrowRight') { setDay(today + step); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { setDay(today - step); e.preventDefault(); }
  if (e.key === ' ') { togglePlay(); e.preventDefault(); }
});
function flyTo(lon, lat) { const nk = Math.max(k, W / 90); ox = W / 2 - lon * nk; oy = H / 2 + lat * nk; k = nk; viewChanged(); }
let playing = false, lastT = 0, acc = 0;
function stop() { playing = false; $('play').textContent = 'Play'; }
function togglePlay() { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; }
$('play').onclick = togglePlay;

// ---------- pan, zoom, click ----------
let drag = null;
stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox, oy, moved: false }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', e => {
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true; if (drag.moved) { ox = drag.ox + dx; oy = drag.oy + dy; viewChanged(true); } return; }
  const v = hit(e.clientX, e.clientY), tip = $('tip');
  stage.style.cursor = v ? 'pointer' : 'grab';
  if (!v && LY.sky) { const p = skyAt(e.clientX, e.clientY); if (p) { tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 330, e.clientX + 12) + 'px'; tip.style.top = e.clientY + 12 + 'px'; tip.innerHTML = skyText(p); stage.style.cursor = 'help'; return; } }
  if (v) { const S = SHIPS[v.s]; tip.style.display = 'block'; tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY + 12 + 'px'; tip.textContent = `${title(S.name)} · ${NATIONS[S.nat].name} · ${S.role}`; } else tip.style.display = 'none';
});
stage.addEventListener('pointerup', e => { const d = drag; drag = null; if (d && d.moved) viewChanged(); else if (d) { const v = hit(e.clientX, e.clientY); if (v) openShip(v.s); } });
stage.addEventListener('wheel', e => { e.preventDefault(); const f = Math.exp(-e.deltaY * .0015), nk = Math.max(W / 400, Math.min(80, k * f)); ox = e.clientX - (e.clientX - ox) * nk / k; oy = e.clientY - (e.clientY - oy) * nk / k; k = nk; viewChanged(true); }, { passive: false });
let vcTimer = 0;
function viewChanged(quick) {
  drawShips(); gWind.clearRect(0, 0, W, H);
  // while moving, slide the old background; redraw it properly once movement stops
  clearTimeout(vcTimer); vcTimer = setTimeout(() => { buildLand(); drawBase(); resetParticles(); }, quick ? 150 : 0);
}
function hit(x, y) { let best = null, bd = 10; for (const v of visible) { const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = v; } } return best; }

// ---------- translation ----------
const PHRASES = { FRENCH: ['petit frais', 'bon frais', 'joli frais', 'grand frais', 'gros frais', 'coup de vent'] };
function gloss(text, lang) {
  const dict = GL[lang]; if (!text || !dict || lang === 'ENGLISH') return '';
  let s = ' ' + text.toLowerCase() + ' ';
  for (const p of PHRASES[lang] || []) s = s.split(p).join(p.replace(/ /g, '_'));
  const out = s.trim().split(/(\s+|[.,;:()\/-]+)/).map(t => {
    if (!t || /^\s+$/.test(t) || /^[.,;:()\/-]+$/.test(t)) return t;
    const key = t.replace(/_/g, ' ');
    if (dict[key] != null) return dict[key] === '' ? '' : esc(dict[key]);
    if (/^[nzoewst.]+$/i.test(key) && key.length <= 6) return esc(key.toUpperCase()); // compass abbreviations
    return `<span class="unk">${esc(key)}</span>`;
  }).join('').replace(/\s+/g, ' ').trim();
  return out;
}
const tType = t => GL.types[t] || title(t);
const tCompany = c => GL.companies[c] || c;
const tInst = i => GL.institutions[i] || title(i);

// ---------- the ship pop-up ----------
const BFT_TOP = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
const BFT_NAME = ['calm','light air','light breeze','gentle breeze','moderate breeze','fresh breeze','strong breeze','near gale','gale','strong gale','storm','violent storm','hurricane'];
const bft = ms => { let b = 0; while (b < 12 && ms > BFT_TOP[b]) b++; return b; };
const compass = d => d === 361 ? 'calm' : d === 362 ? 'variable' : d > 360 ? '—' : ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d / 22.5) % 16];
const panel = $('panel'), pbody = $('pbody');
document.querySelectorAll('.side .close').forEach(b => b.onclick = () => { b.parentElement.classList.remove('open'); if (b.parentElement === panel) { selected = null; drawShips(); closeVoyage(); } });
function loadDetails() {
  return new Promise(res => {
    if (DETAILS) return res();
    pbody.innerHTML = '<p class="sub">Loading the logbook words…</p>';
    const s = document.createElement('script'); s.src = 'data/details.js';
    s.onload = () => { const D = window.CLIWOC_DETAILS; DETAILS = { log: dec(D.log, Uint16Array), d: dec(D.d, Uint16Array), w: dec(D.w, Uint16Array), words: dec(D.words, Uint16Array), dirs: dec(D.dirs, Uint16Array), weather: dec(D.weather, Uint16Array), sea: dec(D.sea, Uint16Array), dict: D.dict, logs: D.logs }; res(); };
    document.body.appendChild(s);
  });
}
async function openShip(s) { selected = s; panel.classList.add('open'); drawShips(); await loadDetails(); await Promise.all([ensure('mag'), ensure('clim'), ensure('emp')]).catch(() => {}); showShip(s); }
function mastsFor(types) { const t = types.join(' '); if (/KOTTER|CUTTER|COTTER|SLOEP\b|BALANDRA/.test(t)) return 1; if (/BRIK|BRIG|BRICK|SNAUW|SNOW|SCHOENER|SCHOONER|BERGANTIN|BRIGANTIJN|GOLETA|KETCH|HOEKER|GALJOOT/.test(t)) return 2; return 3; }
function line(orig, lang) { const g = gloss(orig, lang); return `<div class="words">“${esc(orig.toLowerCase())}”</div>${g ? `<div class="gloss">${g}</div>` : ''}`; }
function showShip(s) {
  const S = SHIPS[s], D = DETAILS;
  const lo = lowerBound(today - TRAIL), hi = lowerBound(today + 1);
  let near = -1; for (let i = lo; i < hi; i++) if (SHIP[i] === s && (near < 0 || DAY[i] >= DAY[near])) near = i;
  const header = `<h2>${esc(title(S.name))}</h2>
    <div class="sub"><span style="color:${tone[s]}">●</span> ${esc(title(S.natName))} · <span class="mx">${esc(S.types.map(tType).join(', ') || 'type not recorded')}</span>${S.companies.length ? ' · <span class="mx">' + esc(S.companies.map(tCompany).join(', ')) + '</span>' : ''}</div>`;
  const evs = (shipEvents.get(s) || []).map(i => EVENTS[i]);
  const sts = (shipStorms.get(s) || []).map(i => STORMS[i]);
  const svs = shipSlav.get(s) || [], seen = SLAV.encounters.filter(e => e.by === s);
  const slavHTML = (svs.length || seen.length) ? `<h3>Slavery in this ship's logbooks</h3>` + svs.map(v => `<div class="slave"><b class="mx">${esc(SLAVE_LABEL[v.tier])}</b>, ${fmt(v.start)} to ${fmt(v.end)} <span class="lab">${v.tier === 'likely' ? 'inferred: company and route' : 'recorded'}</span>
      ${v.count ? `<br>${v.count} enslaved people named in the logbook` : ''}${v.deaths ? `<br>${v.deaths} entries record deaths` : ''}
      ${v.evidence ? `<div class="orig">“${esc(v.evidence.toLowerCase())}”</div>` : ''} <a href="#" data-day="${v.start}" data-lon="${LON[lowerBound(v.start)] / 100}" data-lat="${LAT[lowerBound(v.start)] / 100}">go to the voyage</a></div>`).join('')
    + seen.map(e => `<div class="slave"><b>Met a slave ship</b>, ${fmt(e.day)} <span class="lab">recorded</span><div class="orig">“${esc(e.text.toLowerCase())}”</div> <a href="#" data-day="${e.day}" data-lon="${e.lon}" data-lat="${e.lat}">go there</a></div>`).join('') : '';
  const empire = `
    <h3>Instrument of empire</h3>
    <dl>
      <dt>Role</dt><dd class="${/slave/.test(S.role) ? 'flag' : ''}"><span class="mx">${esc(S.role)}</span> <span class="lab">interpretive</span></dd>
      ${S.captains.length ? `<dt>Captain(s)</dt><dd>${esc(S.captains.map(title).join('; '))}</dd>` : ''}
      ${S.infoEn.length ? `<dt>Notes</dt><dd>${S.infoEn.map((t, i) => `${t !== S.info[i] ? `<span class="mx">${esc(t)}</span>` : `<span class="lg">${esc(t)}</span>`}${t !== S.info[i] ? `<div class="orig">${esc(S.info[i].toLowerCase())}</div>` : ''}`).join('')}</dd>` : ''}
    </dl>
    ${slavHTML}
    ${evs.map(e => `<div class="event"><b class="mx">${esc(e.name)}</b>, ${fmt(e.start)}${e.end > e.start ? ' to ' + fmt(e.end) : ''} <span class="lab">${esc(e.confidence)}</span><br><span class="sub mx">${esc(e.evidence || '')}</span>${e.sources.length ? `<br><span class="sub">Sources: ${e.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(', ')}</span>` : ''} <a href="#" data-day="${e.start}" data-lon="${e.lon}" data-lat="${e.lat}">go there</a></div>`).join('')}`;
  const instrument = `
    <h3>Instrument of weather</h3>
    <dl><dt>In CLIWOC</dt><dd>${S.n.toLocaleString()} daily entries, ${fmt(S.first)} to ${fmt(S.last)}, ${S.logs.length} logbook${S.logs.length > 1 ? 's' : ''}</dd>
    ${sts.length ? `<dt>Storms logged</dt><dd>${sts.slice(0, 8).map(t => `<a href="#" data-day="${t.start}" data-lon="${t.lon}" data-lat="${t.lat}">${fmt(t.start)}</a>`).join(', ')}${sts.length > 8 ? ` and ${sts.length - 8} more` : ''}</dd>` : ''}</dl>`;
  if (near < 0) { pbody.innerHTML = header + `<p class="sub">Not at sea, or not writing, on ${fmt(today)}.</p>` + empire + instrument; wireLinks(); return; }
  const same = []; for (let i = lo; i < hi; i++) if (SHIP[i] === s && DAY[i] === DAY[near]) same.push(i);
  const e = same[0], ms = D.w[e] === 65535 ? null : D.w[e] / 10, b = ms == null ? null : bft(ms);
  const log = D.logs[D.log[e]], lang = log.lang || 'ENGLISH';
  const wordsHTML = same.map(i => D.dict.words[D.words[i]]).filter(Boolean).map(w => line(w, lang)).join('') || '<div class="sub">no wind words for this day</div>';
  const extra = [['Direction', D.dict.dirs[D.dirs[e]]], ['Weather', D.dict.weather[D.weather[e]]], ['Sea', D.dict.sea[D.sea[e]]]].filter(([, v]) => v)
    .map(([k2, v]) => `<div class="sub" style="margin-top:4px">${k2}: <i class="lg">${esc(v.toLowerCase())}</i>${k2 !== 'Direction' && gloss(v, lang) ? `<div class="gloss">${gloss(v, lang)}</div>` : ''}</div>`).join('');
  const cs = courseOf(s, e), wd = D.d[e] <= 360 ? D.d[e] : null;
  let rel = '';
  if (cs && !cs.anchored && wd != null) {
    const th = ((wd - cs.heading + 540) % 360) - 180, a = Math.abs(th), side = th >= 0 ? 'starboard' : 'port';
    rel = a < 30 ? 'wind ahead (beating, or the course changed between noons)' : a < 75 ? `close-hauled on the ${side} tack` : a < 112 ? `wind on the ${side} beam` : a < 160 ? `wind on the ${side} quarter` : 'wind astern';
  }
  const courseHTML = cs ? `<div class="sub" style="margin-top:6px">${cs.anchored ? 'Not moving between noons: probably at anchor.' : `Course ${compass(Math.round(cs.heading))}, about ${cs.knots.toFixed(1)} knots${rel ? ' · ' + rel : ''}.`} <span class="lab">derived from noon positions</span></div>` : '';
  pbody.innerHTML = header + `
    <div class="sub">${fmt(DAY[e])}${DAY[e] !== today ? ` (last entry before ${fmt(today)})` : ''} · ${(LAT[e] / 100).toFixed(1)}°, ${(LON[e] / 100).toFixed(1)}°</div>
    ${positionHTML(e)}
    ${courseHTML}
    <div id="ship3d"><span class="tag">A typical ${esc(title(S.natName))} ship of this type and year (interpretive), turned to its course, sails set for force ${b ?? '?'}.</span></div>
    <p class="sub" style="font-size:12px;margin:6px 0 0">On the compass: north, the course (arrow from the centre), the logged wind (feathered arrow, pointing the way it blew), and the noon positions before (solid) and after (dashed), scaled to fit the ring. The streaks are the wind felt on board; in a gale and above, the short bright marks are spray.</p>
    <button id="voyageBtn">The whole voyage: every entry in this logbook</button>
    <h3>From words to numbers</h3>
    <div class="chain">
      <div class="step"><b>The officer wrote${same.length > 1 ? ` (${same.length} logbooks)` : ''} <span class="lab">observed</span>${lang !== 'ENGLISH' ? ' <span class="lab">English: word-by-word gloss</span>' : ''}</b>${wordsHTML}${extra}</div>
      <div class="arrow">↓ CLIWOC wind dictionary</div>
      <div class="step"><b>Beaufort force <span class="lab">reanalysed</span></b><span class="big">${b == null ? '—' : b}</span> ${b == null ? '' : `<span class="sub">${BFT_NAME[b]}</span>`}</div>
      <div class="arrow">↓ middle of the Beaufort band</div>
      <div class="step"><b>Wind speed <span class="lab">reanalysed</span></b><span class="big">${ms == null ? '—' : ms.toFixed(1) + ' m/s'}</span> <span class="sub">from ${compass(D.d[e])}${D.d[e] <= 360 ? ` (${D.d[e]}°)` : ''}</span></div>
    </div>` + aboardHTML(s, e) + empire + instrument + `
    <h3>The logbook</h3>
    <dl>
      <dt>Voyage</dt><dd>${esc(title(log.from || '?'))} → ${esc(title(log.to || '?'))}</dd>
      <dt>Held at</dt><dd>${esc(tInst(log.inst || '?'))}, ${esc(title(log.place || ''))}</dd>
      <dt>Reference</dt><dd>${esc(log.ref || '—')} · ${esc(log.id)}</dd>
      <dt>Language</dt><dd>${esc(title(lang))}</dd>
    </dl>`;
  wireLinks();
  $('voyageBtn').onclick = () => openVoyage(s, e);
  if (voy.open && voy.s === s) followVoyage(e);
  const mount = () => { if (!window.ShipModel) return false; if (!model) model = new window.ShipModel(); const el = $('ship3d'); if (!el) return true; model.mount(el); model.set({ name: S.name + S.natName, types: S.types, companies: S.companies, notes: S.infoEn, nat: S.natName, year: dateOf(DAY[e]).getUTCFullYear(), bft: b ?? 3, calm: D.d[e] === 361,
    lat: LAT[e] / 100, doy: Math.floor((dateOf(DAY[e]) - Date.UTC(dateOf(DAY[e]).getUTCFullYear(), 0, 1)) / 864e5) + 1,
    windFrom: wd, heading: cs && !cs.anchored ? cs.heading : null, speedKn: cs ? (cs.anchored ? 0 : cs.knots) : null, anchored: !!(cs && cs.anchored), ms, track: trackFor(s, e), decl: DATA.mag && DATA.mag.decl[e] !== 127 ? DATA.mag.decl[e] : null }); return true; };
  if (!mount()) addEventListener('shipmodel-ready', mount, { once: true });
}
let model = null;
// ---------- reckoned text: mark what a machine wrote (dashed) and what the logbooks say (solid) ----------
let rkOn = false;
$('rkBtn').onclick = () => { rkOn = !rkOn; document.body.classList.toggle('rk', rkOn); $('rkBtn').setAttribute('aria-pressed', rkOn); $('rkBtn').setAttribute('aria-checked', rkOn); $('rkKey').hidden = !rkOn; fitHud(); drawShips(); };
// ---------- layers: compass, instruments, sky and sea, cargo and encounters, zero meridians (all off by default) ----------
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.body.appendChild(s); });
const LY = { compass: false, instr: false, sky: false, cargo: false, meridians: false };
const DATA = {};
async function ensure(name) {
  if (DATA[name]) return DATA[name];
  if (name === 'mag') { await loadScript('data/magnetic.js'); const M = window.CLIWOC_MAGNETIC; DATA.mag = { ...M, decl: dec(M.decl, Int8Array), mean: dec(M.mean, Float32Array), count: dec(M.count, Float32Array) }; }
  if (name === 'clim') { await loadScript('data/climate.js'); const C = window.CLIWOC_CLIMATE, I = dec(C.i, Uint32Array), slp = dec(C.slp, Int16Array), at = dec(C.at, Int16Array), b = dec(C.baro, Uint16Array), t = dec(C.therm, Uint16Array), m = new Map();
    I.forEach((i, k) => m.set(i, { slp: slp[k] === -32768 ? null : slp[k] / 10, at: at[k] === -32768 ? null : at[k] / 10, baro: C.dict.baro[b[k]], therm: C.dict.therm[t[k]] })); DATA.clim = m; }
  if (name === 'sky') { await loadScript('data/phenomena.js'); DATA.sky = window.CLIWOC_SKY.map(p => ({ ...p, day: DAY[p.i] })).sort((a, b) => a.day - b.day); }
  if (name === 'emp') { await loadScript('data/empire2.js'); const E2 = window.CLIWOC_EMPIRE2, cargo = new Map(E2.cargo.map(c => [c.i, c.t])), enc = new Map();
    for (const x of E2.enc) { if (!enc.has(x.i)) enc.set(x.i, []); enc.get(x.i).push(x); }
    DATA.emp = { cargo, enc, meridians: E2.meridians, cargoShips: new Map() };
    for (const i of cargo.keys()) { const s = SHIP[i]; if (!DATA.emp.cargoShips.has(s)) DATA.emp.cargoShips.set(s, []); DATA.emp.cargoShips.get(s).push(i); } }
  return DATA[name];
}
const NEEDS = { compass: ['mag'], instr: ['clim'], sky: ['sky'], cargo: ['emp'], meridians: ['emp'] };
const LAYER_KEY = {
  compass: 'Compass needles: where the officers\' compasses pointed (magnetic north), averaged by decade on a 5° grid; true north is straight up. <span style="color:#9fd3ff">Blue</span>: west of true north; <span style="color:#f0c070">ochre</span>: east. Drag the timeline to see the field turn.',
  instr: 'Barometer and temperature: ships writing today with an instrument reading show it in <span style="font-family:ui-monospace,Consolas,monospace;color:#a9dcb8">pressure (hPa) · air temperature (°C)</span>, CLIWOC\'s conversion of what was read.',
  sky: 'Sky and sea: rare things the officers wrote down (auroras, comets, eclipses, waterspouts, an earthquake, ice, snow, hail, whales, birds), shown on the map for about two weeks after the day, and, for the rare ones (auroras, comets, eclipses, waterspouts, the earthquake), in their own row on the timeline. Hover for the words. <a href="#" id="openSky">List all</a>',
  cargo: 'Cargo and encounters: <span style="color:#e8c27a">cargo</span> written in the logbook, and <span style="color:#c9d4ff">ships met at sea</span>, next to the ship that wrote them.',
  meridians: 'Zero meridians: longitude was counted from many different zero lines. The lines are drawn where the data puts them, thicker when more entries used them; most are national (Greenwich, Tenerife, Paris, Cádiz), many others the last land seen.',
};
async function toggleLayer(name) {
  LY[name] = !LY[name];
  document.querySelector(`#layers [data-l="${name}"]`).setAttribute('aria-pressed', LY[name]);
  if (LY[name]) await Promise.all(NEEDS[name].map(ensure));
  $('layerKey').innerHTML = Object.keys(LY).filter(k => LY[k]).map(k => `<p>${LAYER_KEY[k]}</p>`).join('');
  const os = $('openSky'); if (os) os.onclick = ev => { ev.preventDefault(); openSkyList(); };
  fitHud();
  drawShips(); drawTimeline();
}
document.querySelectorAll('#layers [data-l]').forEach(b => b.onclick = () => toggleLayer(b.dataset.l));

// the left column scrolls (and takes the mouse) only when it is taller than the window
function fitHud() { const h = $('hud'); h.classList.toggle('scroll', h.scrollHeight > h.clientHeight + 1); }
addEventListener('resize', fitHud); setTimeout(fitHud, 0); $('amore').addEventListener('click', () => setTimeout(fitHud, 0));
// under the ships: zero meridians and compass needles
function drawLayersUnder(g) {
  if (LY.meridians && DATA.emp) {
    const list = DATA.emp.meridians.filter(m => m.lon != null && m.n >= 300 && !/UNKNOWN|_0|_00|DESCONOCIDO/.test(m.name)), max = list[0].n, used = [], rows = [];
    for (const m of list) { const x = X(m.lon); if (x < -5 || x > W + 5) continue; const big = m.n > 2000;
      g.strokeStyle = big ? 'rgba(232,236,244,.55)' : 'rgba(232,236,244,.22)'; g.lineWidth = .5 + 2.5 * Math.sqrt(m.n / max); g.beginPath(); g.moveTo(x, Y(78)); g.lineTo(x, Y(-70)); g.stroke();
      const pctTxt = (m.n / 257498 * 100).toFixed(m.n > 2500 ? 0 : 1) + '%', label = `${title(m.name)} ${pctTxt}`;
      if (big) { g.font = '12px system-ui'; const tw = g.measureText(label).width; let r = 0; while ((rows[r] || []).some(([a, b]) => x + 3 < b + 6 && x + 3 + tw > a - 6)) r++; (rows[r] ||= []).push([x + 3, x + 3 + tw]);
        const ty = Math.max(Y(76), 16) + r * 15; g.fillStyle = 'rgba(5,7,15,.7)'; g.fillRect(x + 1, ty - 11, tw + 4, 14); g.fillStyle = '#e8ecf4'; g.fillText(label, x + 3, ty); }
      else if (used.every(u => Math.abs(u - x) > 14)) { used.push(x); g.fillStyle = '#93a0b8'; g.font = '10px system-ui'; g.save(); g.translate(x + 3, Math.max(Y(76), 16) + 70); g.rotate(Math.PI / 2); g.fillText(label, 0, 0); g.restore(); } }
  }
  if (LY.compass && DATA.mag) {
    const M = DATA.mag, yr = dateOf(today).getUTCFullYear() + dateOf(today).getUTCMonth() / 12, f = Math.max(0, Math.min(M.nd - 1, (yr - M.d0 - 5) / 10)), d0 = Math.floor(f), d1 = Math.min(M.nd - 1, d0 + 1), t = f - d0, cell = M.g * k;
    const step = cell < 14 ? 2 : 1, len = Math.max(5, Math.min(22, cell * step * .42));
    for (let cy = 0; cy < M.ny; cy += step) for (let cx = 0; cx < M.nx; cx += step) {
      const a = (d0 * M.ny + cy) * M.nx + cx, b = (d1 * M.ny + cy) * M.nx + cx, na = M.count[a], nb = M.count[b];
      if (na < 3 && nb < 3) continue;
      const v = na >= 3 && nb >= 3 ? M.mean[a] * (1 - t) + M.mean[b] * t : na >= 3 ? M.mean[a] : M.mean[b];
      const x = X(-180 + (cx + .5) * M.g), y = Y(90 - (cy + .5) * M.g); if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const r = v * Math.PI / 180, ux = Math.sin(r), uy = -Math.cos(r), col = v < 0 ? '159,211,255' : '240,192,112', op = Math.min(1, .35 + Math.max(na, nb) / 60);
      g.strokeStyle = `rgba(${col},${.35 * op})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - ux * len, y - uy * len); g.stroke(); // south half, faint
      g.strokeStyle = `rgba(${col},${.95 * op})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ux * len, y + uy * len); g.stroke(); // north half
      g.fillStyle = `rgba(${col},${op})`; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill();
      if (cell * step > 64) { g.fillStyle = `rgba(${col},.8)`; g.font = '10px system-ui'; g.fillText(`${Math.abs(Math.round(v))}°${v < 0 ? 'W' : 'E'}`, x + 4, y + 12); }
    }
  }
}
// sky and sea: glyphs where and when something was seen
let skyHits = [];
const SKY_RARE = new Set(['aurora', 'comet', 'eclipse', 'waterspout', 'earthquake']);
const SKY_NAME = { aurora: 'aurora', waterspout: 'waterspout', comet: 'comet', eclipse: 'eclipse', earthquake: 'earthquake at sea', whales: 'whales', birds: 'birds', ice: 'ice', snow: 'snow', hail: 'hail' };
function skyGlyph(g, c, x, y, s) {
  g.beginPath();
  if (c === 'aurora') { for (let k2 = 0; k2 < 3; k2++) { g.moveTo(x - s, y + 2 - k2 * 3); g.quadraticCurveTo(x, y - s - k2 * 3, x + s, y + 2 - k2 * 3); } }
  else if (c === 'comet') { g.arc(x + s * .5, y - s * .5, 2, 0, 7); g.moveTo(x + s * .5, y - s * .5); g.lineTo(x - s, y + s); g.moveTo(x + s * .3, y - s * .2); g.lineTo(x - s * .7, y + s * 1.1); }
  else if (c === 'eclipse') { g.arc(x, y, s * .8, 0, 7); g.moveTo(x + s * .3, y - s * .7); g.arc(x + s * .3, y, s * .7, -Math.PI / 2, Math.PI / 2); }
  else if (c === 'waterspout') { g.moveTo(x - s, y - s); g.quadraticCurveTo(x, y - s * .2, x - s * .1, y + s); g.moveTo(x + s, y - s); g.quadraticCurveTo(x + s * .1, y - s * .2, x + s * .1, y + s); g.moveTo(x - s * .7, y + s); g.lineTo(x + s * .7, y + s); }
  else if (c === 'earthquake') { g.moveTo(x - s, y); for (let k2 = 0; k2 < 6; k2++) g.lineTo(x - s + (k2 + 1) * s / 3, y + (k2 % 2 ? s : -s) * .8); }
  else if (c === 'ice') { g.moveTo(x - s, y + s * .5); g.lineTo(x - s * .3, y - s); g.lineTo(x + s * .4, y - s * .4); g.lineTo(x + s, y + s * .5); g.closePath(); g.moveTo(x - s * 1.3, y + s * .5); g.lineTo(x + s * 1.3, y + s * .5); }
  else if (c === 'snow') { for (let k2 = 0; k2 < 3; k2++) { const a = k2 * Math.PI / 3; g.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s); g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } }
  else if (c === 'hail') { for (const [dx, dy] of [[-s * .6, -s * .4], [s * .5, -s * .5], [0, s * .5]]) { g.moveTo(x + dx + 1.8, y + dy); g.arc(x + dx, y + dy, 1.8, 0, 7); } }
  else if (c === 'whales') { g.moveTo(x - s, y); g.quadraticCurveTo(x - s * .2, y - s * .9, x + s * .6, y - s * .1); g.lineTo(x + s, y - s * .6); g.moveTo(x + s * .6, y - s * .1); g.lineTo(x + s, y + s * .3); g.moveTo(x - s, y); g.lineTo(x + s * .6, y - s * .1); }
  else if (c === 'birds') { for (const [dx, dy] of [[-s * .5, 0], [s * .6, -s * .6]]) { g.moveTo(x + dx - s * .5, y + dy - s * .3); g.quadraticCurveTo(x + dx - s * .2, y + dy - s * .4, x + dx, y + dy); g.quadraticCurveTo(x + dx + s * .2, y + dy - s * .4, x + dx + s * .5, y + dy - s * .3); } }
  g.stroke();
}
function drawLayersOver(g) {
  skyHits = [];
  if (LY.sky && DATA.sky) {
    const lo2 = today - 14, list = DATA.sky; let a = 0, b = list.length; while (a < b) { const m = a + b >> 1; list[m].day < lo2 ? a = m + 1 : b = m; }
    for (let j = a; j < list.length && list[j].day <= today; j++) {
      const p = list[j], x = X(LON[p.i] / 100), y = Y(LAT[p.i] / 100), age = today - p.day, al = Math.max(.15, 1 - age / 15);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      g.strokeStyle = `rgba(215,200,255,${al})`; g.fillStyle = g.strokeStyle; g.lineWidth = 1.3; skyGlyph(g, p.c, x + 12, y - 12, 7);
      if (age < 4) { g.font = '11px system-ui'; g.fillText(SKY_NAME[p.c], x + 22, y - 16); }
      skyHits.push({ x: x + 12, y: y - 12, p });
    }
  }
}
function skyAt(x, y) { let best = null, bd = 12; for (const h of skyHits) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h.p; } } return best; }
function skyText(p) { const lang = DETAILS ? (DETAILS.logs[DETAILS.log[p.i]].lang || 'ENGLISH') : 'ENGLISH', gl = DETAILS ? gloss(p.t, lang) : ''; return `<b style="color:#d7c8ff">${esc(SKY_NAME[p.c])}</b> · ${fmt(p.day)} · ${esc(title(SHIPS[SHIP[p.i]].name))}<br><i class="lg">“${esc(p.t.toLowerCase())}”</i>${gl && lang !== 'ENGLISH' ? `<br><span class="mx" style="color:#c9d3e6">${gl}</span>` : ''}`; }
// the list of everything seen
let skyCat = null;
async function openSkyList() {
  await ensure('sky'); await loadDetails(); $('index').classList.remove('open'); $('sources').classList.remove('open'); $('skyp').classList.add('open');
  const counts = {}; for (const p of DATA.sky) counts[p.c] = (counts[p.c] || 0) + 1;
  $('skyf').innerHTML = `<button data-c="" aria-pressed="${!skyCat}">All ${DATA.sky.length}</button>` + Object.keys(SKY_NAME).filter(c => counts[c]).map(c => `<button data-c="${c}" aria-pressed="${skyCat === c}">${SKY_NAME[c]} ${counts[c]}</button>`).join('');
  $('skyf').querySelectorAll('button').forEach(b => b.onclick = () => { skyCat = b.dataset.c || null; openSkyList(); });
  const rows = DATA.sky.filter(p => !skyCat || p.c === skyCat);
  $('skyl').innerHTML = rows.map(p => `<div class="it" data-k="${DATA.sky.indexOf(p)}"><span class="d">${fmt(p.day)}</span> <b>${esc(SKY_NAME[p.c])}</b> · ${esc(title(SHIPS[SHIP[p.i]].name))}<div class="t lgb">“${esc(p.t.toLowerCase())}”</div></div>`).join('');
  $('skyl').querySelectorAll('.it').forEach(el => el.onclick = () => { const p = DATA.sky[+el.dataset.k]; if (!LY.sky) toggleLayer('sky'); setDay(p.day); flyTo(LON[p.i] / 100, LAT[p.i] / 100); });
}
// labels next to each ship writing today: words, instruments, cargo, encounters (one block per ship, no overlaps)
function drawLabels(g, list) {
  const wantWords = showWords && recKind, D = DETAILS, boxes = [];
  if (!wantWords && !(LY.instr && DATA.clim) && !(LY.cargo && DATA.emp)) return;
  for (const v of list) {
    const lines = [];
    if (wantWords) { const w = D.dict.words[D.words[v.i]], kk = recKind[D.words[v.i]]; if (kk) { let t = w.toLowerCase(); if (t.length > 34) t = t.slice(0, 32) + '…'; lines.push(kk === 2 ? [t, '12px ui-monospace, Consolas, monospace', '#8fd3e8'] : ['“' + t + '”', 'italic 13px Georgia, serif', '#f1e6cf']); } }
    if (LY.instr && DATA.clim) { const c = DATA.clim.get(v.i); if (c) lines.push([[c.slp != null ? Math.round(c.slp) + ' hPa' : '', c.at != null ? c.at.toFixed(1) + ' °C' : ''].filter(Boolean).join(' · '), '12px ui-monospace, Consolas, monospace', '#a9dcb8']); }
    if (LY.cargo && DATA.emp) {
      const cs = DATA.emp.cargoShips.get(v.s); if (cs) { const near = cs.filter(i => Math.abs(DAY[i] - today) <= 60); if (near.length) { let t = DATA.emp.cargo.get(near[0]).toLowerCase(); if (t.length > 44) t = t.slice(0, 42) + '…'; lines.push(['cargo: ' + t, '12px system-ui', '#e8c27a']); } }
      for (let j = lowerBound(today - PRESENT); j < N && DAY[j] <= today; j++) { if (SHIP[j] !== v.s) continue; const es = DATA.emp.enc.get(j); if (!es) continue; const e = es[0]; let t = e.n ? `met ${title(e.n)}${e.nat ? ' (' + title(e.nat) + ')' : ''}` : (e.r ? e.r.toLowerCase() : `met a ${title(e.nat)} ship`); if (t.length > 46) t = t.slice(0, 44) + '…'; lines.push([t, '12px system-ui', '#c9d4ff']); break; }
    }
    if (!lines.length) continue;
    let w = 0; for (const [t, f] of lines) { g.font = f; w = Math.max(w, g.measureText(t).width); }
    const x = v.x + 7, y0 = v.y - 6, hgt = lines.length * 15, b = [x - 2, y0 - 12, x + w + 2, y0 - 12 + hgt + 2];
    if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
    boxes.push(b); g.fillStyle = 'rgba(5,7,15,.62)'; g.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    lines.forEach(([t, f, col], k2) => { g.font = f; g.fillStyle = col; g.fillText(t, x, y0 + k2 * 15); });
  }
}
// ---------- whose logbooks: the archives behind the map ----------
{ const AR = window.ARCHIVES;
  if (!AR) $('archive').remove();
  else {
    const HUE = { Netherlands: [176, 45], 'United Kingdom': [214, 55], Spain: [348, 55], France: [42, 60] }, total = AR.total;
    const countries = [...new Set(AR.list.map(a => a.country))].map(c => ({ c, list: AR.list.filter(a => a.country === c) })).map(g => ({ ...g, n: g.list.reduce((s, a) => s + a.entries, 0) })).sort((a, b) => b.n - a.n);
    // each archive a shade of its country's map colour: the largest darkest
    for (const g of countries) g.list.forEach((a, k) => { const [h, s] = HUE[g.c] || [0, 0]; a.col = `hsl(${h} ${s}% ${Math.min(80, 38 + k * (g.list.length > 4 ? 6 : 12))}%)`; a.cc = `hsl(${h} ${s}% 50%)`; });
    const pct = n => n / total * 100 < 1 ? (n / total * 100).toFixed(1) + '%' : Math.round(n / total * 100) + '%';
    // the donut
    let a0 = -Math.PI / 2, svg = '';
    for (const g of countries) for (const a of g.list) { const a1 = a0 + a.entries / total * Math.PI * 2, r = 46, r2 = 26, big = a1 - a0 > Math.PI ? 1 : 0, p = (r, t) => `${(Math.cos(t) * r).toFixed(2)} ${(Math.sin(t) * r).toFixed(2)}`;
      svg += `<path data-a="${AR.list.indexOf(a)}" fill="${a.col}" stroke="#05070f" stroke-width=".6" d="M${p(r, a0)} A${r} ${r} 0 ${big} 1 ${p(r, a1)} L${p(r2, a1)} A${r2} ${r2} 0 ${big} 0 ${p(r2, a0)}Z"/>`; a0 = a1; }
    svg += `<text x="0" y="-2" text-anchor="middle" fill="#e8ecf4" font-size="11">${AR.list.reduce((s, a) => s + a.logbooks, 0).toLocaleString()}</text><text x="0" y="10" text-anchor="middle" fill="#93a0b8" font-size="8">logbooks</text>`;
    $('apie').innerHTML = svg;
    $('acountries').innerHTML = countries.map(g => `<div data-c="${esc(g.c)}"><i style="background:${g.list[0].cc}"></i><span>${pct(g.n)}</span> ${esc(g.c)} · ${g.list.length} archive${g.list.length > 1 ? 's' : ''}</div>`).join('');
    $('alist').innerHTML = countries.map(g => g.list.map(a => `<div data-a="${AR.list.indexOf(a)}" title="${esc(a.place)} · ${a.logbooks} logbooks · ${a.from}–${a.to}"><i style="background:${a.col}"></i>${esc(a.name)}<span>${pct(a.entries)}</span></div>`).join('')).join('');
    const tip = $('tip'), show = (a, ev) => { tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 330, ev.clientX + 12) + 'px'; tip.style.top = ev.clientY - 70 + 'px';
      tip.innerHTML = `<b>${esc(a.name)}</b><br>${esc(a.place)}${a.place ? ', ' : ''}${esc(a.country)}<br>${pct(a.entries)} of the entries · ${a.logbooks} logbooks · ${a.from}–${a.to}`; };
    const hi = idx => { $('apie').classList.toggle('hov', idx != null); $('apie').querySelectorAll('path').forEach(p => p.classList.toggle('on', +p.dataset.a === idx)); $('alist').querySelectorAll('div').forEach(d => d.classList.toggle('on', +d.dataset.a === idx)); };
    for (const el of [$('apie'), $('alist')]) {
      el.addEventListener('pointermove', ev => { const t = ev.target.closest('[data-a]'); if (!t) { hi(null); tip.style.display = 'none'; return; } const i = +t.dataset.a; hi(i); show(AR.list[i], ev); });
      el.addEventListener('pointerleave', () => { hi(null); tip.style.display = 'none'; });
    }
    $('amore').onclick = () => { const open = $('adetail').hidden; $('adetail').hidden = !open; $('amore').setAttribute('aria-expanded', open); $('amore').textContent = open ? 'Hide' : 'The archives, and how the collection came together'; };
  }
}
// ---------- reckoned or observed: how each noon position was found ----------
// HOW per entry: 1 latitude observed, 2 longitude observed, 4 latitude reckoned, 8 longitude reckoned (CLIWOC LatInd/LonInd)
const reckoned = i => (HOW[i] & 12) !== 0;
let DRMAP = null;
function drOf(i) { // where the logbook gives both: [observed minus reckoned latitude, longitude] in degrees
  if (!DRMAP) { const D = window.CLIWOC_DETAILS.dr, I = dec(D.i, Uint32Array), A = dec(D.dlat, Int16Array), B = dec(D.dlon, Int16Array); DRMAP = new Map(); for (let k = 0; k < I.length; k++) DRMAP.set(I[k], [A[k] / 100, B[k] / 100]); }
  return DRMAP.get(i) || null;
}
const drKm = (i, c) => Math.hypot(c[0] * 111.2, c[1] * 111.2 * Math.cos(LAT[i] / 100 * Math.PI / 180));
// a track: solid where the position was observed, dashed where it was only reckoned
function strokeTrack(g, idx, px, py, joined) {
  const solid = new Path2D(), dash = new Path2D(); let pv = -1, x0 = 0, y0 = 0;
  for (const i of idx) { const x = px(i), y = py(i); if (pv >= 0 && joined(pv, i)) { const p = reckoned(i) ? dash : solid; p.moveTo(x0, y0); p.lineTo(x, y); } pv = i; x0 = x; y0 = y; }
  g.stroke(solid); g.save(); g.setLineDash([2.5, 3.5]); g.stroke(dash); g.restore();
}
function positionHTML(e) {
  const obsLat = HOW[e] & 1, obsLon = HOW[e] & 2, c = DETAILS ? drOf(e) : null;
  const how = obsLat && obsLon ? 'observed at noon (sun or stars)' : obsLat ? 'latitude observed at noon; longitude reckoned' : reckoned(e) ? 'reckoned only (dead reckoning): not checked against the sky that day' : 'method not recorded';
  return `<div class="sub" style="margin-top:4px">Position: ${how}${c ? `; the officer's reckoning had been ${Math.round(drKm(e, c))} km off` : ''}. <a href="#" class="howpos">How positions were found</a></div>`;
}
// ---------- the explainer: how a ship knew where it was ----------
const rk = { on: false, t0: 0 };
function openReckon() { $('reckon').classList.add('open'); rk.on = true; rk.t0 = performance.now(); requestAnimationFrame(drawReckon); }
function closeReckon() { $('reckon').classList.remove('open'); rk.on = false; }
$('rclose').onclick = closeReckon;
document.addEventListener('click', ev => { const a = ev.target.closest('.howpos'); if (a) { ev.preventDefault(); openReckon(); } });
const RK_STEPS = [
  [0, 'Yesterday at noon the ship knew its position. From here on the officer cannot see where he is.'],
  [1.5, 'Every hour: the compass gives the course, the log line gives the speed. Each hour becomes one leg.'],
  [8.5, 'Adding up the legs gives the reckoned position: where the ship should be.'],
  [10.5, 'But wind and current have pushed the ship the whole time, unseen (the faint line).'],
  [12.5, 'At noon the sun gives the true latitude. Where it meets the reckoning, the officer finds his error and starts again.'],
  [16, 'Under cloud there is no sight. The guess becomes the record: a dashed track on the map.'],
];
function drawReckon(now) {
  if (!rk.on) return;
  const c = $('rkc'), [g, w, h] = vctx(c), T = 24, t = ((now - rk.t0) / 1000) % T, cloudy = t > 15.5;
  g.clearRect(0, 0, w, h);
  // the moving air and water: faint streaks drifting down-right
  g.strokeStyle = 'rgba(232,236,244,.18)'; g.lineWidth = 1; g.beginPath();
  for (let k = 0; k < 70; k++) { const sx = ((k * 97.3 + now * .03) % (w + 60)) - 30, sy = ((k * 53.7 + now * .012) % (h + 40)) - 20; g.moveTo(sx, sy); g.lineTo(sx + 9, sy + 3); }
  g.stroke();
  const ax = w * .12, ay = h * .32, leg = w * .062, legs = 12, drift = h * .045;
  const real = hh => [ax + hh * leg * .97, ay + hh * drift + Math.sin(hh * 1.3) * 3];
  const hours = Math.max(0, Math.min(legs, (t - 1.5) / 7 * legs)), cur = Math.floor(hours);
  const label = (txt, x, y, col = '#93a0b8') => { g.fillStyle = col; g.font = '12px system-ui'; g.fillText(txt, x, y); };
  // yesterday's noon
  g.fillStyle = '#e8ecf4'; g.beginPath(); g.arc(ax, ay, 4, 0, 7); g.fill(); label('yesterday noon', ax - 30, ay - 14);
  // the unseen real path
  if (t > 10.5) { g.strokeStyle = 'rgba(217,164,65,.55)'; g.setLineDash([2, 4]); g.beginPath(); for (let k = 0; k <= hours * 4; k++) { const [x, y] = real(k / 4); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.setLineDash([]); }
  // the reckoning: hourly legs along the course steered (due east here)
  g.strokeStyle = '#e8ecf4'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + hours * leg, ay); g.stroke();
  for (let k = 1; k <= cur; k++) { const x = ax + k * leg; g.beginPath(); g.moveTo(x, ay - 4); g.lineTo(x, ay + 4); g.stroke(); }
  if (t > 1.5 && t < 8.6) { label(`${cur} h · course E · ${5 + (cur % 3)} knots`, ax + hours * leg - 40, ay - 12, '#e8ecf4'); }
  const rx = ax + legs * leg;
  if (t > 8.5) { g.strokeStyle = '#e8ecf4'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(rx - 6, ay - 6); g.lineTo(rx + 6, ay + 6); g.moveTo(rx + 6, ay - 6); g.lineTo(rx - 6, ay + 6); g.stroke(); label('reckoned noon', rx - 30, ay - 14, '#e8ecf4'); }
  const [ox, oy] = real(legs);
  if (t > 12.5 && !cloudy) {
    g.strokeStyle = 'rgba(217,164,65,.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w * .05, oy); g.lineTo(w * .95, oy); g.stroke(); label('noon sun: true latitude', w * .05, oy - 6, '#d9a441');
    g.fillStyle = '#d9a441'; g.beginPath(); g.arc(ox, oy, 4.5, 0, 7); g.fill();
    if (t > 13.5) { g.strokeStyle = '#fff'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(rx, ay); g.lineTo(ox, oy); g.stroke(); g.setLineDash([]); label('the error', rx + 10, (ay + oy) / 2, '#e8ecf4'); }
  }
  if (cloudy) { g.fillStyle = 'rgba(147,160,184,.12)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(w * (.2 + k * .16), h * .12, 70, 16, 0, 0, 7); g.fill(); } label('cloud: no sight today', w * .42, h * .2); }
  // the sun, low in the frame
  if (!cloudy) { g.strokeStyle = 'rgba(232,236,244,.5)'; g.beginPath(); g.arc(w * .9, h * .12, 9, 0, 7); g.stroke(); }
  let cap = RK_STEPS[0][1]; for (const [s, txt] of RK_STEPS) if (t >= s) cap = txt; $('rkcap').textContent = cap;
  requestAnimationFrame(drawReckon);
}
// ---------- the storm's form, sketched from the ships' winds ----------
// Buys Ballot's rule: with your back to the wind, low pressure (the storm's centre) lies to your left in the northern
// hemisphere, to your right in the southern, a little ahead. So each ship's wind points to where the centre could be;
// stronger winds mean it was nearer. A sketch of a plausible form, not a reconstruction.
function stormCentre(day) {
  const D = DETAILS, pts = [];
  for (const t of sto.tracks) for (const i of t.list) {
    if (DAY[i] !== day || D.d[i] > 360) continue; const b = forceOf(i); if (b == null || b < 6) continue;
    const lat = LAT[i] / 100, toward = D.d[i] + 180, brg = (toward + (lat >= 0 ? -70 : 70)) * Math.PI / 180, km = b >= 10 ? 150 : b >= 8 ? 260 : 400;
    pts.push({ lat: lat + Math.cos(brg) * km / 111.2, lon: LON[i] / 100 + Math.sin(brg) * km / (111.2 * Math.cos(lat * Math.PI / 180)), b, south: lat < 0 });
  }
  if (!pts.length) return null;
  const n = pts.length; return { lat: pts.reduce((a, p) => a + p.lat, 0) / n, lon: pts.reduce((a, p) => a + p.lon, 0) / n, b: Math.max(...pts.map(p => p.b)), south: pts[0].south };
}
function drawStormForm(g, V, now) {
  const st = sto.s, centres = []; for (let d = st.start - 1; d <= st.end + 1; d++) { const c = stormCentre(d); if (c) centres.push({ d, ...c }); }
  if (!centres.length) return;
  // the centre's sketched track over the days
  g.strokeStyle = 'rgba(232,176,72,.35)'; g.setLineDash([2, 5]); g.beginPath(); centres.forEach((c, k) => { const x = V.px(c.lon), y = V.py(c.lat); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
  const c = centres.find(c => c.d === sto.day) || centres.reduce((a, b) => Math.abs(b.d - sto.day) < Math.abs(a.d - sto.day) ? b : a);
  const x = V.px(c.lon), y = V.py(c.lat), kmPx = Math.abs(V.px(c.lon + 1) - V.px(c.lon)) / (111.2 * Math.cos(c.lat * Math.PI / 180));
  const R = 520 * kmPx, strength = Math.min(1, (c.b - 5) / 6), spin = now / 1000 * (.25 + strength * .35), near = c.d === sto.day ? 1 : .45;
  // spiral bands, turning counter-clockwise in the north and clockwise in the south (on the map, north up)
  g.lineWidth = 1.2;
  for (let arm = 0; arm < 5; arm++) {
    g.strokeStyle = `rgba(232,176,72,${(.18 + strength * .32) * near})`; g.beginPath();
    for (let s = 0; s <= 60; s++) { const r = R * (.08 + s / 60 * .92), a = spin + arm * 2 * Math.PI / 5 - Math.log(r / (R * .08)) * 1.25, px = x + Math.cos(a) * r, py = y - Math.sin(a) * r * (c.south ? -1 : 1);
      s ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  }
  for (const f of [.35, .7, 1]) { g.strokeStyle = `rgba(232,176,72,${.1 * near})`; g.beginPath(); g.arc(x, y, R * f, 0, 7); g.stroke(); }
  g.fillStyle = `rgba(232,176,72,${.7 * near})`; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
  g.fillStyle = 'rgba(232,176,72,.9)'; g.font = '11px system-ui'; g.fillText('sketched centre', x + 6, y - 6);
}
// ---------- words and numbers: how each officer wrote the wind ----------
let showWords = false, recKind = null, numShare = null;
const recordKind = w => { if (!w) return 0; if (/^[\d\s.,;\/-]+$/.test(w)) return 2; return 1; }; // 0 none, 1 words, 2 numbers
function prepWords() {
  const D = DETAILS; recKind = Uint8Array.from(D.dict.words.map(recordKind));
  const y0 = 1750, y1 = dateOf(lastDay).getUTCFullYear(), num = new Float32Array(y1 - y0 + 1), all = new Float32Array(y1 - y0 + 1);
  for (let i = 0; i < N; i++) { const k = recKind[D.words[i]]; if (!k) continue; const y = dateOf(DAY[i]).getUTCFullYear() - y0; if (y < 0) continue; all[y]++; if (k === 2) num[y]++; }
  numShare = { y0, share: Array.from(num, (n, i) => all[i] > 200 ? n / all[i] : null) };
}
$('wordsBtn').onclick = async () => { showWords = !showWords; $('wordsBtn').setAttribute('aria-pressed', showWords); $('wordsKey').style.display = showWords ? 'block' : 'none'; if (showWords && !recKind) { await loadDetails(); prepWords(); } drawShips(); drawTimeline(); };
function drawWords(g, list) {
  if (!showWords || !recKind) return;
  const D = DETAILS, boxes = [];
  for (const v of list) {
    const w = D.dict.words[D.words[v.i]], k = recKind[D.words[v.i]]; if (!k) continue;
    let t = w.toLowerCase(); if (t.length > 34) t = t.slice(0, 32) + '…';
    g.font = k === 2 ? '12px ui-monospace, Consolas, monospace' : 'italic 13px Georgia, serif';
    const tw = g.measureText(k === 2 ? t : '“' + t + '”').width, x = v.x + 7, y = v.y - 6, b = [x - 2, y - 12, x + tw + 2, y + 4];
    if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue; // no overlapping labels
    boxes.push(b);
    g.fillStyle = 'rgba(5,7,15,.6)'; g.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    g.fillStyle = k === 2 ? '#8fd3e8' : '#f1e6cf'; g.fillText(k === 2 ? t : '“' + t + '”', x, y);
  }
}
// ---------- a storm logged by several ships ----------
const sto = { open: false, s: null, day: 0, view: null };
function openStorm(st) {
  sto.s = st; sto.day = st.start; sto.open = true; sto.view = null; $('storm').classList.add('open');
  const mx = st.maxMs; $('stitle').textContent = `Storm logged by ${st.ships.length} ships · ${fmt(st.start)}${st.end > st.start ? ' to ' + fmt(st.end) : ''} · up to force ${bft(mx)}`;
  // each ship's entries from 3 days before to 3 days after
  sto.tracks = st.ships.map(s => ({ s, list: [...shipIdx(s)].filter(i => DAY[i] >= st.start - 3 && DAY[i] <= st.end + 3) })).filter(t => t.list.length);
  drawStorm(); requestAnimationFrame(spinStorm);
}
function closeStorm() { sto.open = false; $('storm').classList.remove('open'); }
function spinStorm() { if (!sto.open) return; drawStorm(true); requestAnimationFrame(spinStorm); }
function drawStorm(anim) {
  if (!sto.open) return;
  const D = DETAILS, st = sto.s, all = sto.tracks.flatMap(t => t.list);
  $('sday').textContent = fmt(sto.day) + (sto.day >= st.start && sto.day <= st.end ? ' · storm' : '');
  const [g, w, h] = vctx($('smap'));
  if (!sto.view || sto.view.w !== w || sto.view.h !== h) {
    const lons = all.map(i => LON[i] / 100), lats = all.map(i => LAT[i] / 100);
    let lo0 = Math.min(...lons), lo1 = Math.max(...lons), la0 = Math.min(...lats), la1 = Math.max(...lats);
    const pad = Math.max(1.5, (lo1 - lo0) * .15, (la1 - la0) * .15); lo0 -= pad; lo1 += pad; la0 -= pad; la1 += pad;
    const cl = Math.cos((la0 + la1) / 2 * Math.PI / 180), sc = Math.min(w / ((lo1 - lo0) * cl), h / (la1 - la0)), cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
    const bx = lo => w / 2 + (lo - cx) * cl * sc, by = la => h / 2 - (la - cy) * sc;
    if (!sto.z || sto.zFor !== sto.s) { sto.z = { s: 1, ox: 0, oy: 0 }; sto.zFor = sto.s; } // zoom and pan: scroll to zoom, drag to move
    const Z = sto.z;
    sto.view = { w, h, px: lo => bx(lo) * Z.s + Z.ox, py: la => by(la) * Z.s + Z.oy, box: [lo0, lo1, la0, la1], key: '' };
  }
  const V = sto.view, zk = [sto.z.s, sto.z.ox, sto.z.oy].join(',');
  if (V.key !== zk) { // land and graticule, redrawn only when the zoom or pan changes
    V.key = zk; const land = V.land || document.createElement('canvas'), dd = devicePixelRatio || 1; land.width = w * dd; land.height = h * dd; const lg = land.getContext('2d'); lg.setTransform(dd, 0, 0, dd, 0, 0);
    lg.fillStyle = '#05070f'; lg.fillRect(0, 0, w, h);
    lg.fillStyle = '#0d1120'; lg.strokeStyle = 'rgba(200,215,240,.5)'; lg.lineWidth = .7; lg.beginPath();
    for (const ring of window.LAND) { let prev = null; ring.forEach(([lo, la]) => { const x = V.px(lo), y = V.py(la); if (prev == null || Math.abs(x - prev) > w * .6 * sto.z.s) lg.moveTo(x, y); else lg.lineTo(x, y); prev = x; }); }
    lg.fill(); lg.stroke();
    // a 1-degree graticule, for scale
    const [lo0, lo1, la0, la1] = V.box; lg.strokeStyle = 'rgba(147,160,184,.12)'; lg.beginPath();
    for (let a = Math.floor(lo0) - 20; a <= lo1 + 20; a++) { lg.moveTo(V.px(a), 0); lg.lineTo(V.px(a), h); } for (let a = Math.floor(la0) - 20; a <= la1 + 20; a++) { lg.moveTo(0, V.py(a)); lg.lineTo(w, V.py(a)); } lg.stroke();
    if (sto.z.s > 1.01) { lg.fillStyle = '#93a0b8'; lg.font = '11px system-ui'; lg.fillText(`×${sto.z.s.toFixed(1)} · double-click to reset`, 8, h - 8); }
    V.land = land;
  }
  g.clearRect(0, 0, w, h); g.drawImage(V.land, 0, 0, w, h);
  drawStormForm(g, V, performance.now());
  const arrow = (x, y, dir, b, col, wd) => { // feathered arrow pointing the way the wind blew; length and feathers by force
    const a = (dir + 180) * Math.PI / 180, L = 14 + b * 2.2, ux = Math.sin(a), uy = -Math.cos(a), tx = x - ux * L / 2, ty = y - uy * L / 2, hx = x + ux * L / 2, hy = y + uy * L / 2;
    g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy);
    g.moveTo(hx, hy); g.lineTo(hx - ux * 5 + uy * 3.5, hy - uy * 5 - ux * 3.5); g.moveTo(hx, hy); g.lineTo(hx - ux * 5 - uy * 3.5, hy - uy * 5 + ux * 3.5);
    for (let f = 0; f < Math.round(b / 2); f++) { const fx = tx + ux * f * 3.2, fy = ty + uy * f * 3.2; g.moveTo(fx, fy); g.lineTo(fx - uy * 6 - ux * 2, fy + ux * 6 - uy * 2); }
    g.stroke(); };
  for (const t of sto.tracks) {
    g.strokeStyle = tone[t.s]; g.globalAlpha = .7; g.lineWidth = 1.2; g.beginPath();
    t.list.forEach((i, k) => { const x = V.px(LON[i] / 100), y = V.py(LAT[i] / 100); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.globalAlpha = 1;
    for (const i of t.list) {
      const x = V.px(LON[i] / 100), y = V.py(LAT[i] / 100), inStorm = DAY[i] >= st.start && DAY[i] <= st.end, today2 = DAY[i] === sto.day, b = forceOf(i);
      const col = inStorm ? 'rgba(232,176,72,' + (today2 ? 1 : .55) + ')' : 'rgba(232,236,244,' + (today2 ? 1 : .35) + ')';
      if (D.d[i] <= 360 && b != null) arrow(x, y, D.d[i], b, col, today2 ? 2 : 1);
      g.fillStyle = tone[t.s]; g.beginPath(); g.arc(x, y, today2 ? 4 : 2.2, 0, 7); g.fill();
      if (today2) { g.fillStyle = '#e8ecf4'; g.font = '12px system-ui'; g.fillText(title(SHIPS[t.s].name), x + 8, y + 14); }
    }
  }
  // the ships' words, day by day
  if (anim && sto.listDay === sto.day) return; sto.listDay = sto.day;
  $('slist').innerHTML = sto.tracks.map(t => `<div class="sh"><b><span style="color:${tone[t.s]}">●</span> ${esc(title(SHIPS[t.s].name))}</b> <span class="d">${esc(title(SHIPS[t.s].natName))}</span>` +
    t.list.map(i => { const b = forceOf(i), wd = D.dict.words[D.words[i]], lang = D.logs[D.log[i]].lang || 'ENGLISH', on = DAY[i] === sto.day;
      const cl = DATA.clim && DATA.clim.get(i); return `<div class="${on ? 'on' : 'd'}">${fmt(DAY[i])} · ${b == null ? '?' : 'force ' + b}${cl && cl.slp != null ? ' · ' + Math.round(cl.slp) + ' hPa' : ''}${D.d[i] <= 360 ? ' from ' + compass(D.d[i]) : ''}${wd ? ` · <i class="lg">${esc(wd.toLowerCase())}</i>${on && gloss(wd, lang) ? `<div class="gloss">${gloss(wd, lang)}</div>` : ''}` : ''}</div>`; }).join('') + '</div>').join('');
}
$('sclose').onclick = closeStorm;
async function openStormWithData(st) { await Promise.all([loadDetails(), ensure('clim')]).catch(() => {}); openStorm(st); }
$('sprev').onclick = () => { sto.day = Math.max(sto.s.start - 3, sto.day - 1); drawStorm(); };
$('snext').onclick = () => { sto.day = Math.min(sto.s.end + 3, sto.day + 1); drawStorm(); };
$('sgo').onclick = () => { setDay(sto.day); flyTo(sto.s.lon, sto.s.lat); };
addEventListener('resize', () => { if (sto.open) { sto.view = null; drawStorm(); } });
// zoom (scroll) and pan (drag) in the storm map; double-click to reset
{ const sm = $('smap'); let pan = null;
  sm.addEventListener('wheel', ev => { if (!sto.z) return; ev.preventDefault(); const r = sm.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, Z = sto.z, s = Math.max(1, Math.min(40, Z.s * Math.exp(-ev.deltaY * .0015))), k = s / Z.s; Z.ox = mx - (mx - Z.ox) * k; Z.oy = my - (my - Z.oy) * k; Z.s = s; if (s === 1) Z.ox = Z.oy = 0; drawStorm(true); }, { passive: false });
  sm.addEventListener('pointerdown', ev => { if (sto.z) { pan = { x: ev.clientX, y: ev.clientY, ox: sto.z.ox, oy: sto.z.oy }; sm.style.cursor = 'grabbing'; } });
  addEventListener('pointermove', ev => { if (!pan) return; sto.z.ox = pan.ox + ev.clientX - pan.x; sto.z.oy = pan.oy + ev.clientY - pan.y; });
  addEventListener('pointerup', () => { if (pan) { pan = null; sm.style.cursor = ''; } });
  sm.addEventListener('dblclick', () => { if (sto.z) { sto.z.s = 1; sto.z.ox = sto.z.oy = 0; } }); }
// ---------- one ship's entries, its track around a day, and the whole-voyage pop-up ----------
const shipIdxCache = new Map();
function shipIdx(s) { if (!shipIdxCache.has(s)) { const a = []; for (let i = 0; i < N; i++) if (SHIP[i] === s) a.push(i); shipIdxCache.set(s, Int32Array.from(a)); } return shipIdxCache.get(s); }
const kmOff = (i, i0) => { let dl = (LON[i] - LON[i0]) / 100; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; return [dl * 111.32 * Math.cos(LAT[i0] / 100 * Math.PI / 180), (LAT[i] - LAT[i0]) / 100 * 110.57]; };
// noon positions of the same logbook, up to 5 before and 5 after (within 12 days), as km east and north of this one
function trackFor(s, e) {
  const L = shipIdx(s), lg = DETAILS.log[e], p = L.indexOf(e); if (p < 0) return null;
  const past = [], next = [];
  for (let k = p - 1; k >= 0 && past.length < 5 && DAY[L[k]] >= DAY[e] - 12; k--) if (DETAILS.log[L[k]] === lg && DAY[L[k]] < DAY[e]) past.unshift(kmOff(L[k], e));
  for (let k = p + 1; k < L.length && next.length < 5 && DAY[L[k]] <= DAY[e] + 12; k++) if (DETAILS.log[L[k]] === lg && DAY[L[k]] > DAY[e]) next.push(kmOff(L[k], e));
  return { past, next };
}
const voy = { open: false, s: -1, list: [], cur: 0, timer: 0, view: null };
const vmap = $('vmap'), vchart = $('vchart');
function openVoyage(s, e) {
  const D = DETAILS, L = shipIdx(s), logs = new Map();
  for (const i of L) { const lg = D.log[i]; if (!logs.has(lg)) logs.set(lg, []); logs.get(lg).push(i); }
  voy.s = s; voy.logs = [...logs.entries()].sort((a, b) => DAY[a[1][0]] - DAY[b[1][0]]);
  $('vtitle').textContent = title(SHIPS[s].name);
  $('vlog').innerHTML = voy.logs.map(([lg, list], k) => { const l = D.logs[lg]; return `<option value="${k}">${esc(title(l.from || '?'))} → ${esc(title(l.to || '?'))}, ${fmt(DAY[list[0]])} to ${fmt(DAY[list[list.length - 1]])} (${list.length} entries)</option>`; }).join('');
  const k = Math.max(0, voy.logs.findIndex(([lg]) => lg === D.log[e]));
  $('vlog').value = k; voy.open = true; $('voyage').classList.add('open');
  useLog(k, e);
}
function useLog(k, e) { voy.list = voy.logs[k][1]; voy.view = null; const p = voy.list.indexOf(e); voy.cur = p >= 0 ? p : 0; drawVoyage(); }
function closeVoyage() { voy.open = false; clearInterval(voy.timer); voy.timer = 0; $('vplay').textContent = 'Play'; $('voyage').classList.remove('open'); }
// the main timeline moved: follow it, if the day is in this logbook
function followVoyage(e) { const p = voy.list.indexOf(e); if (p >= 0 && p !== voy.cur) { voy.cur = p; drawVoyage(); } }
function pickEntry(p) {
  voy.cur = Math.max(0, Math.min(voy.list.length - 1, p)); const i = voy.list[voy.cur];
  selected = voy.s; setDay(DAY[i]);
  const x = X(LON[i] / 100), y = Y(LAT[i] / 100); if (x < 60 || x > W - 460 || y < 40 || y > H - 120) flyTo(LON[i] / 100, LAT[i] / 100);
  drawVoyage();
}
const vctx = c => { const r = c.getBoundingClientRect(), d = devicePixelRatio || 1; if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); } const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return [g, r.width, r.height]; };
const forceOf = i => DETAILS.w[i] === 65535 ? null : bft(DETAILS.w[i] / 10);
function drawVoyage() {
  if (!voy.open) return;
  const D = DETAILS, list = voy.list, cur = list[voy.cur];
  // --- map: the track, fitted to the canvas
  { const [g, w, h] = vctx(vmap);
    if (!voy.view || voy.view.w !== w || voy.view.h !== h || voy.view.list !== list) {
      let lons = [...list].map(i => LON[i] / 100); const wrap = Math.max(...lons) - Math.min(...lons) > 180; if (wrap) lons = lons.map(l => l < 0 ? l + 360 : l);
      const lats = [...list].map(i => LAT[i] / 100);
      let lo0 = Math.min(...lons), lo1 = Math.max(...lons), la0 = Math.min(...lats), la1 = Math.max(...lats);
      const pad = Math.max(3, (lo1 - lo0) * .08, (la1 - la0) * .08); lo0 -= pad; lo1 += pad; la0 -= pad; la1 += pad;
      const cl = Math.cos((la0 + la1) / 2 * Math.PI / 180), sc = Math.min(w / ((lo1 - lo0) * cl), h / (la1 - la0));
      const cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
      const bx = lo => w / 2 + ((wrap && lo < 0 ? lo + 360 : lo) - cx) * cl * sc, by = la => h / 2 - (la - cy) * sc;
      if (!voy.z || voy.view?.list !== list) voy.z = { s: 1, ox: 0, oy: 0 }; // zoom and pan: scroll to zoom, drag to move
      const Z = voy.z;
      voy.view = { w, h, list, px: lo => bx(lo) * Z.s + Z.ox, py: la => by(la) * Z.s + Z.oy };
    }
    const V = voy.view, zs = voy.z.s; g.fillStyle = '#05070f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d1120'; g.strokeStyle = 'rgba(200,215,240,.5)'; g.lineWidth = .7; g.beginPath();
    for (const ring of window.LAND) { let prev = null; ring.forEach(([lo, la]) => { const x = V.px(lo), y = V.py(la); if (prev == null || Math.abs(x - prev) > w * .6 * zs) g.moveTo(x, y); else g.lineTo(x, y); prev = x; }); }
    g.fill(); g.stroke();
    // the dots, small, so the track and the corrections between them stay visible; they grow a little when zoomed in
    const dot = b => (b == null ? .8 : .9 + b * .2) * Math.min(2.2, Math.sqrt(zs));
    for (const i of list) { const b = forceOf(i), x = V.px(LON[i] / 100), y = V.py(LAT[i] / 100); g.fillStyle = b >= 10 ? '#d9a441' : 'rgba(232,236,244,.6)'; g.beginPath(); g.arc(x, y, dot(b), 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(232,236,244,.75)'; g.lineWidth = 1;
    strokeTrack(g, list, i => V.px(LON[i] / 100), i => V.py(LAT[i] / 100), (a, b) => DAY[b] - DAY[a] <= 5);
    // where the officer reckoned the ship was, joined to where the sky showed it
    g.strokeStyle = 'rgba(159,211,255,.8)'; g.lineWidth = .9;
    for (const i of list) { const c = drOf(i); if (!c || drKm(i, c) < 3) continue; const x = V.px(LON[i] / 100), y = V.py(LAT[i] / 100), rx = V.px(LON[i] / 100 - c[1]), ry = V.py(LAT[i] / 100 - c[0]); g.beginPath(); g.moveTo(rx, ry); g.lineTo(x, y); g.stroke(); g.beginPath(); g.arc(rx, ry, 2.4, 0, 7); g.stroke(); }
    if (zs > 1.01) { g.fillStyle = '#93a0b8'; g.font = '11px system-ui'; g.fillText(`×${zs.toFixed(1)} · double-click to reset`, 8, h - 8); }
    const x = V.px(LON[cur] / 100), y = V.py(LAT[cur] / 100); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 8, 0, 7); g.moveTo(x - 13, y); g.lineTo(x - 9, y); g.moveTo(x + 9, y); g.lineTo(x + 13, y); g.moveTo(x, y - 13); g.lineTo(x, y - 9); g.moveTo(x, y + 9); g.lineTo(x, y + 13); g.stroke();
  }
  // --- chart: force by day, wind direction above
  { const [g, w, h] = vctx(vchart), L = 30, Rr = 10, T = 34, B = 22;
    // time along the axis, but long gaps (in port, or a logbook that resumes years later) are closed up and marked
    const GAP = 8, pos = new Float64Array(list.length), breaks = []; let tt = 0;
    for (let k = 1; k < list.length; k++) { const dd = DAY[list[k]] - DAY[list[k - 1]]; if (dd > GAP) { breaks.push(k); tt += 3; } else tt += dd; pos[k] = tt; }
    const span = Math.max(1, tt), xAt = k => L + pos[k] / span * (w - L - Rr), base = h - B, top = T + 6, yOf = b => base - b / 12 * (base - top);
    voy.xAt = xAt; g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(147,160,184,.25)'; g.fillStyle = '#93a0b8'; g.font = '10px system-ui'; g.lineWidth = 1; g.beginPath();
    for (const b of [0, 4, 8, 12]) { g.moveTo(L, yOf(b)); g.lineTo(w - Rr, yOf(b)); g.fillText(b, 8, yOf(b) + 3); } g.stroke();
    g.fillText('force', 4, top - 8);
    // the closed-up gaps: a double slash on the axis
    g.strokeStyle = '#93a0b8'; g.beginPath(); for (const k of breaks) { const x = (xAt(k - 1) + xAt(k)) / 2; g.moveTo(x - 3, base + 5); g.lineTo(x, base - 5); g.moveTo(x, base + 5); g.lineTo(x + 3, base - 5); } g.stroke();
    // months along the axis (years, if the voyage is long), labelled where they begin; skipped when crowded
    { const long = tt > 500; let last = -1, lastX = -99;
      list.forEach((i, k) => { const t = dateOf(DAY[i]), key = long ? t.getUTCFullYear() : t.getUTCFullYear() * 12 + t.getUTCMonth(); if (key === last) return; last = key;
        const x = xAt(k); if (x > w - 40 || x - lastX < 46) return; lastX = x;
        g.fillText(long ? String(t.getUTCFullYear()) : MONTHS[t.getUTCMonth()].slice(0, 3) + (t.getUTCMonth() === 0 || k === 0 || breaks.includes(k) ? ' ' + t.getUTCFullYear() : ''), x + 2, h - 6); g.fillRect(x, base, 1, 4); }); }
    const bw = Math.max(1, Math.min(8, (w - L - Rr) / list.length * .7));
    list.forEach((i, k) => { const b = forceOf(i); if (b == null) return; g.fillStyle = i === cur ? '#fff' : b >= 10 ? '#d9a441' : 'rgba(232,236,244,.55)'; const x = xAt(k); g.fillRect(x - bw / 2, yOf(b), bw, base - yOf(b) + .5); });
    // barometer, where read: a line against a pressure scale on the right (960 to 1050 hPa)
    if (DATA.clim) { const yP = p => base - (Math.max(960, Math.min(1050, p)) - 960) / 90 * (base - top); let on = false, any = false; g.strokeStyle = '#8fd3e8'; g.lineWidth = 1.4; g.beginPath();
      list.forEach((i, k) => { const c = DATA.clim.get(i); if (!c || c.slp == null) { on = false; return; } any = true; const x = xAt(k), y = yP(c.slp); on && !breaks.includes(k) ? g.lineTo(x, y) : g.moveTo(x, y); on = true; }); g.stroke();
      if (any) { g.fillStyle = '#8fd3e8'; g.font = '10px system-ui'; g.textAlign = 'right'; for (const p of [980, 1010, 1040]) g.fillText(p, w - 2, yP(p) - 2); g.fillText('hPa', w - 2, top - 8); g.textAlign = 'left'; g.fillStyle = '#93a0b8'; } }
    // wind direction: a tick pointing the way the wind blew (north up), thinned to fit
    const step = Math.max(1, Math.ceil(list.length / ((w - L - Rr) / 7)));
    g.strokeStyle = 'rgba(232,236,244,.75)'; g.beginPath();
    list.forEach((i, k) => { if (k % step && i !== cur) return; const dd = D.d[i]; if (dd > 360) return; const a = (dd + 180) * Math.PI / 180, x = xAt(k), y = T / 2 + 2, r = 7;
      const hx = x + Math.sin(a) * r * .5, hy = y - Math.cos(a) * r * .5; g.moveTo(x - Math.sin(a) * r * .5, y + Math.cos(a) * r * .5); g.lineTo(hx, hy); g.moveTo(hx, hy); g.lineTo(hx - Math.sin(a - .5) * r * .35, hy + Math.cos(a - .5) * r * .35); g.moveTo(hx, hy); g.lineTo(hx - Math.sin(a + .5) * r * .35, hy + Math.cos(a + .5) * r * .35); });
    g.stroke(); g.fillText('wind', 4, T / 2 + 5);
    const cx = xAt(voy.cur); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(cx, T); g.lineTo(cx, base); g.stroke();
  }
  // --- the day's words
  { const b = forceOf(cur), w = D.dict.words[D.words[cur]], lang = (D.logs[D.log[cur]].lang) || 'ENGLISH';
    $('vinfo').innerHTML = `<b>${fmt(DAY[cur])}</b> · entry ${voy.cur + 1} of ${list.length} · ${(LAT[cur] / 100).toFixed(1)}°, ${(LON[cur] / 100).toFixed(1)}° · ${b == null ? 'force not known' : `force ${b}, ${BFT_NAME[b]}`}${D.d[cur] <= 360 ? ', from ' + compass(D.d[cur]) : D.d[cur] === 361 ? ', calm' : ''}${w ? line(w, lang) : ''}${positionHTML(cur)}`; }
}
$('vclose').onclick = closeVoyage;
$('vlog').onchange = () => { const k = +$('vlog').value; useLog(k, voy.logs[k][1][0]); pickEntry(0); };
$('vprev').onclick = () => pickEntry(voy.cur - 1);
$('vnext').onclick = () => pickEntry(voy.cur + 1);
$('vplay').onclick = () => { if (voy.timer) { clearInterval(voy.timer); voy.timer = 0; $('vplay').textContent = 'Play'; return; } $('vplay').textContent = 'Pause'; voy.timer = setInterval(() => { if (voy.cur >= voy.list.length - 1) { $('vplay').click(); return; } pickEntry(voy.cur + 1); }, 1200); };
vmap.onclick = ev => { const V = voy.view; if (!V || voy.dragged) return; const r = vmap.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; let best = -1, bd = 14; voy.list.forEach((i, k) => { const dd = Math.hypot(V.px(LON[i] / 100) - x, V.py(LAT[i] / 100) - y); if (dd < bd) { bd = dd; best = k; } }); if (best >= 0) pickEntry(best); };
vchart.onclick = ev => { if (!voy.xAt) return; const r = vchart.getBoundingClientRect(), x = ev.clientX - r.left; let best = 0, bd = 1e9; voy.list.forEach((i, k) => { const dd = Math.abs(voy.xAt(k) - x); if (dd < bd) { bd = dd; best = k; } }); pickEntry(best); };
// zoom (scroll) and pan (drag) in the voyage map; double-click to reset
vmap.addEventListener('wheel', ev => { if (!voy.z) return; ev.preventDefault(); const r = vmap.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, Z = voy.z, f = Math.exp(-ev.deltaY * .0015), s = Math.max(1, Math.min(60, Z.s * f)), k = s / Z.s; Z.ox = mx - (mx - Z.ox) * k; Z.oy = my - (my - Z.oy) * k; Z.s = s; if (s === 1) { Z.ox = Z.oy = 0; } drawVoyage(); }, { passive: false });
vmap.addEventListener('pointerdown', ev => { if (!voy.z) return; voy.pan = { x: ev.clientX, y: ev.clientY, ox: voy.z.ox, oy: voy.z.oy }; voy.dragged = false; vmap.style.cursor = 'grabbing'; });
addEventListener('pointermove', ev => { const p = voy.pan; if (!p) return; const dx = ev.clientX - p.x, dy = ev.clientY - p.y; if (Math.hypot(dx, dy) > 4) voy.dragged = true; if (voy.dragged) { voy.z.ox = p.ox + dx; voy.z.oy = p.oy + dy; drawVoyage(); } });
addEventListener('pointerup', () => { if (voy.pan) { voy.pan = null; vmap.style.cursor = ''; setTimeout(() => { voy.dragged = false; }, 0); } });
vmap.addEventListener('dblclick', () => { if (voy.z) { voy.z.s = 1; voy.z.ox = voy.z.oy = 0; drawVoyage(); } });
addEventListener('resize', () => { if (voy.open) { voy.view = null; drawVoyage(); } });
// Course and speed between this noon position and the ship's previous one (or the next, if none), within 3 days.
function courseOf(s, e) {
  let a = -1, b = e;
  for (let i = e - 1; i >= 0 && DAY[i] >= DAY[e] - 3; i--) if (SHIP[i] === s && DAY[i] < DAY[e]) { a = i; break; }
  if (a < 0) { for (let i = e + 1; i < N && DAY[i] <= DAY[e] + 3; i++) if (SHIP[i] === s && DAY[i] > DAY[e]) { a = e; b = i; break; } }
  if (a < 0) return null;
  const R = Math.PI / 180, p1 = LAT[a] / 100 * R, p2 = LAT[b] / 100 * R, dl = (LON[b] - LON[a]) / 100 * R;
  const km = 6371 * Math.acos(Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl)));
  const heading = (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / R + 360) % 360;
  const days = DAY[b] - DAY[a], knots = km / (days * 24) / 1.852;
  if (knots > 14) return null; // a position error, not a speed
  return { heading, knots, anchored: km < 3 };
}
function aboardHTML(s, e) {
  const c = DATA.clim && DATA.clim.get(e), d = DATA.mag && DATA.mag.decl[e] !== 127 ? DATA.mag.decl[e] : null, rows = [];
  if (c && (c.baro || c.slp != null)) rows.push(`<dt>Barometer</dt><dd>${c.baro ? esc(c.baro.toLowerCase()) : ''}${c.slp != null ? ` → <b>${c.slp.toFixed(1)} hPa</b> <span class="lab">CLIWOC</span>` : ''}</dd>`);
  if (c && (c.therm || c.at != null)) rows.push(`<dt>Thermometer</dt><dd>${c.therm ? esc(c.therm.toLowerCase()) : ''}${c.at != null ? ` → <b>${c.at.toFixed(1)} °C</b>` : ''}</dd>`);
  if (d != null) rows.push(`<dt>Compass</dt><dd>the needle pointed ${Math.abs(d)}° ${d < 0 ? 'west' : 'east'} of true north <span class="lab">observed</span></dd>`);
  let out = rows.length ? `<h3>Instruments aboard</h3><dl>${rows.join('')}</dl>` : '';
  if (DATA.emp) {
    const cg = (DATA.emp.cargoShips.get(s) || []).filter(i => Math.abs(DAY[i] - DAY[e]) <= 120), lang = DETAILS.logs[DETAILS.log[e]].lang || 'ENGLISH';
    if (cg.length) { const t = DATA.emp.cargo.get(cg[0]); out += `<h3>Cargo</h3><div class="sub"><i class="lg">“${esc(t.toLowerCase())}”</i>${gloss(t, lang) && lang !== 'ENGLISH' ? `<div class="gloss">${gloss(t, lang)}</div>` : ''}</div>`; }
    const met = [], seen2 = new Set(); for (const i of shipIdx(s)) { if (Math.abs(DAY[i] - DAY[e]) > 10) continue; for (const x of DATA.emp.enc.get(i) || []) { const key = x.n + x.nat + x.r; if (seen2.has(key)) continue; seen2.add(key); met.push([i, x]); } }
    if (met.length) out += `<h3>Ships met, ten days either side</h3>` + met.slice(0, 8).map(([i, x]) => `<div class="sub">${fmt(DAY[i])}: ${x.n ? '<b>' + esc(title(x.n)) + '</b> ' : ''}${x.nat ? esc(title(x.nat)) : ''}${x.r ? ` · <i>${esc(x.r.toLowerCase())}</i>` : ''}</div>`).join('') + (met.length > 8 ? `<div class="sub">and ${met.length - 8} more</div>` : '');
  }
  return out;
}
function wireLinks() { pbody.querySelectorAll('a[data-day]').forEach(a => a.onclick = ev => { ev.preventDefault(); setDay(+a.dataset.day); flyTo(+a.dataset.lon, +a.dataset.lat); }); }

// ---------- ship index ----------
const roles = [...new Set(SHIPS.map(s => s.role))].sort();
roles.forEach(r => $('fRole').insertAdjacentHTML('beforeend', `<option>${esc(r)}</option>`));
const fNat = NATIONS.map(() => true);
NATIONS.forEach((n, i) => { const b = document.createElement('button'); b.innerHTML = `<span style="color:hsl(${n.hue} ${n.sat}% 60%)">●</span> ${n.name}`; b.onclick = () => { fNat[i] = !fNat[i]; b.style.opacity = fNat[i] ? 1 : .4; renderList(); }; $('fNat').appendChild(b); });
function renderList() {
  const q = $('q').value.trim().toLowerCase(), role = $('fRole').value, sort = $('fSort').value;
  let rows = SHIPS.map((s, i) => ({ s, i })).filter(({ s }) => fNat[s.nat] && (!role || s.role === role) &&
    (!q || [s.name, ...s.captains, ...s.types.map(tType), ...s.companies.map(tCompany), ...s.infoEn].join(' ').toLowerCase().includes(q)));
  rows.sort(sort === 'first' ? (a, b) => a.s.first - b.s.first : sort === 'n' ? (a, b) => b.s.n - a.s.n : (a, b) => a.s.name.localeCompare(b.s.name));
  $('list').innerHTML = rows.slice(0, 400).map(({ s, i }) => `<div class="it" data-i="${i}"><i style="background:${tone[i]}"></i>${esc(title(s.name))}${shipEvents.has(i) ? ' <span style="color:#ff9b88;margin:0">●</span>' : ''}<span>${dateOf(s.first).getUTCFullYear()}–${dateOf(s.last).getUTCFullYear()} · <span class="mx">${esc(s.role.split(',')[0])}</span></span></div>`).join('') +
    (rows.length > 400 ? `<p class="sub">${rows.length - 400} more; refine the search.</p>` : '') + (rows.length ? '' : '<p class="sub">No ships match.</p>');
  $('list').querySelectorAll('.it').forEach(el => el.onclick = () => {
    const i = +el.dataset.i, S = SHIPS[i]; stop(); setDay(S.first);
    let j = lowerBound(S.first); while (j < N && SHIP[j] !== i) j++;
    if (j < N) flyTo(LON[j] / 100, LAT[j] / 100);
    openShip(i);
  });
}
$('q').oninput = renderList; $('fRole').onchange = renderList; $('fSort').onchange = renderList;
$('openIndex').onclick = () => { $('sources').classList.remove('open'); $('index').classList.toggle('open'); renderList(); };

// ---------- about and sources ----------
{ // each event of empire's sources join the list, once per URL
  const g = window.SOURCES.find(x => x.group === 'Events of Empire'), seen = new Set();
  for (const e of EVENTS) for (const u of e.sources) if (!seen.has(u)) { seen.add(u); g.items.push({ title: u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), who: 'cited for: ' + EVENTS.filter(x => x.sources.includes(u)).map(x => x.name).join('; '), licence: 'cited', url: u, used: '' }); }
  g.items.unshift({ title: 'Event matching', who: 'Done for this map: ship name, date and position in CLIWOC checked against documented events; evidence from the logbooks’ own remarks (EncRem, OtherRem, CargoMemo, LifeOnBoard)', licence: 'this project', url: '', used: 'Each event is marked secure or probable. Wikipedia links should be spot-checked before publishing.' });
}
$('openSources').onclick = () => { $('index').classList.remove('open'); $('sources').classList.toggle('open'); };
$('sbody').innerHTML = `<h2>About and sources</h2>
  <p>Between 1662 and 1855, officers on Dutch, British, Spanish and French ships wrote down the wind every day. They did it for navigation, for promotion and for courts martial; climate science later turned the same pages into data. This map shows both: the ships as instruments that measured the wind, and as instruments of trade, war, colonisation and the slave trade.</p>
  <h3>How to read it</h3>
  <p><b>Dots</b> are ships that wrote in their logbook within the last 4 days, with 25 days of track. <b>Ochre rings</b> and ticks are storms found in the logbooks (Beaufort 10 or more, or a storm word, grouped by 3 days and about 900 km). <b>Red epicentres</b> are documented events of empire that ships in this data took part in. The blue <b>background</b> is the average wind for this month from all the logbooks, not that day’s weather.</p>
  <p><b>Slavery</b> is marked by voyage, never by ship, in <span style="color:#e0508a">this colour</span>: a solid square and track where the ship's own logbook records enslaved people carried for sale (46 voyages, almost all of the Dutch Middelburgsche Commercie Compagnie); dashed where a voyage of that company follows the Africa–Americas route without saying so (5); dotted where enslaved people travelled on board as servants or survivors (2); and a crossed dashed square where another ship's logbook records meeting a slave ship (15). The route alone is not used for any other ship: tested on all 1,756 logbooks, it finds mostly ships that were not slavers. Apart from these Dutch voyages, the slave trade is nearly absent from this climate archive, which kept navy and company logbooks: slave ships appear mostly as ships seen by others.</p>
  <p><b>Labels:</b> observed (the logbook’s words), reanalysed (CLIWOC’s conversion to Beaufort and m/s), interpretive (the 3D rig, ship roles, English glosses).</p>
  <h3>The path of every entry</h3>
  <p class="sub">Handwritten logbook page → national archive → typed by the CLIWOC project (2001–2004) → CLIWOC 2.1 database → this map.</p>
  ${window.SOURCES.map(g => `<h3>${esc(g.group)}</h3>` + (g.items.length ? g.items.map(s => `<p><b>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</b><br><span class="sub">${esc(s.who)} · ${esc(s.licence)}</span><br>${esc(s.used)}</p>`).join('') : '<p class="sub">None yet.</p>')).join('')}`;

// ---------- start ----------
function loop(t) {
  const dt = Math.min(100, t - lastT); lastT = t;
  if (playing && !dragTL) { acc += dt / 1000 * +$('speed').value; if (acc >= 1) { const n = Math.floor(acc); acc -= n; setDay(today + n); if (today >= lastDay) stop(); } }
  stepWind();
  requestAnimationFrame(loop);
}
resize(); home(); month = dateOf(today).getUTCMonth(); buildLand(); drawBase(); resetParticles(); buildTimeline(); setDay(today);
$('loading').remove();
addEventListener('resize', () => { resize(); buildLand(); drawBase(); resetParticles(); buildTimeline(); drawShips(); drawTimeline(); });
requestAnimationFrame(loop);
})();
