#!/usr/bin/env node
// Build the data files for the ship map from CLIWOC 2.1 (CC0, https://doi.org/10.17026/dans-2bx-dutg).
//   node tools/build-data.mjs path/to/cliwoc21.gpkg
// Writes data/entries.js (positions, for the map), data/details.js (words and archive, loaded on first click),
// data/ships.js (one record per ship), data/wind.js (CLIWOC winds averaged by month), data/ships.csv (research list).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('Usage: node tools/build-data.mjs path/to/cliwoc21.gpkg'); process.exit(1); }
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
fs.mkdirSync(out, { recursive: true });
const db = new DatabaseSync(src, { readOnly: true });

const rows = db.prepare(`
  select ShipName, Nationality, ShipType, Company, OtherShipInformation, Name1, Rank1,
         Year, Month, Day, HR, latitude, longitude, D, W, AllWindForces, AllWindDirections, Weather, StateSea,
         LogbookIdent, InstName, InstPlace, NumberEntry, NameArchiveSet, LogbookLanguage,
         VoyageFrom, VoyageTo, WindScale, LatInd, LonInd,
         drLatDeg, drLatMin, drLatHem, drLongDeg, drLongMin, drLongHem, LatDeg, LatMin, LatHem, LongDeg, LongMin, LongHem,
         Decl, SLP, AT, BaroReading, AirPressureReadingUnits, TairReading, AirThermReadingUnits, ZeroMeridian,
         OtherRem, ShipAndRigMemo, BiologyMemo, LifeOnBoard, Clearness, ShapeClouds, CargoMemo, EncName, EncNat, EncRem, SeaIce, Snow, Hail
  from CLIWOC21
  where Year is not null and Month between 1 and 12 and Day between 1 and 31
    and latitude is not null and longitude is not null
  order by Year, Month, Day, LogbookIdent, HR`).all();

const EPOCH = Date.UTC(1662, 0, 1);
const dayOf = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
const NAT = { SPANISH: 0, DUTCH: 1, BRITISH: 2, FRENCH: 3 }; // anything else: 4 (other)

// Rough role from ship type and company. Interpretive, to be checked ship by ship.
function role(types, companies, info) {
  const t = types.join(' '), c = companies.join(' '), i = (info || '').toUpperCase();
  if (/SLAV|SLAAF|SLAVEN/.test(i)) return 'slave voyage (stated in record)';
  if (/\bMCC\b/.test(c)) return 'trade, possibly slave voyages (MCC): check';
  if (/WHA/.test(c)) return 'whaling';
  if (/PAQUEBOT|CORREO|PACKET/.test(t)) return 'mail packet';
  if (/EXPLORATION/.test(t)) return 'exploration';
  if (/\b(RN|MAR|ADM|ROYAL NAVY)\b/.test(c) || /RATE|OORLOG|NAV[IÍ]O|KORVET|BOMB/.test(t)) return 'warship';
  if (/EIC|VOC|WIC|OIC|MER|PARTICULIER|HUDSON|EAST INDIA|ROTTERDAM|BROUW|MERCHANT/.test(c)) return 'trade';
  if (/TRANSPORT|STORESHIP/.test(t)) return 'transport';
  return 'unknown';
}

// Dictionaries for repeated strings.
function dict() {
  const m = new Map(), a = [''];
  return { a, id(s) { if (s == null || s === '') return 0; let k = m.get(s); if (k == null) { k = a.length; a.push(s); m.set(s, k); } return k; } };
}
const words = dict(), dirs = dict(), weather = dict(), sea = dict();

const shipKey = new Map(), ships = [];
const logKey = new Map(), logs = [];
const seen = new Set();
const E = { day: [], lat: [], lon: [], ship: [], log: [], d: [], w: [], words: [], dirs: [], weather: [], sea: [], how: [] };
// How the position was found. CLIWOC's LatInd/LonInd: 1 = reckoned (only the dead-reckoning fields are filled),
// 2 = observed (the observed fields are filled); other codes are rarer (landmarks, interpolation, missing).
// Where a logbook gives both a reckoned and an observed position, keep the difference (observed minus reckoned).
const DR = { i: [], dlat: [], dlon: [] };
const X = { decl: [], clim: new Map(), sky: new Map(), cargo: new Map(), enc: new Map(), mer: [], merOff: new Map() };
const baroTxt = dict(), thermTxt = dict(), merName = dict();
// rare things seen, searched in the remarks (Dutch, English, Spanish, French). Negations are skipped.
const SKY = [
  ['aurora', /AURORA|NOORDERLICHT|ZUIDERLICHT|NORTHERN LIGHT|SOUTHERN LIGHT/],
  ['waterspout', /WATERSPOUT|WATER SPOUT|WATERHOOS|\bHOOS\b|MANGA DE AGUA|TROMBE/],
  ['comet', /KOMEET|COMET|COMÈTE/, /ZAGEN|ZIEN|SAW|SEEN|VIMOS|OBSERV|STAART|TAIL|COLA|QUEUE/],
  ['eclipse', /ECLIPS|VERDUISTERING/],
  ['earthquake', /EARTHQUAKE|AARDBEVING|ZEEBEVING|TERREMOTO|TEMBLOR|TREMBLEMENT/],
  ['whales', /WHALE|WALVIS|BALLENA|BALEINE/],
  ['birds', /\bBIRDS?\b|VOGEL|PAJARO|PÁJARO|PETREL|ALBATROS|BOOB(Y|IES)|MEEUW|DUIVEN|PINTADO|OISEAU/],
  ['ice', /ICEBERG|ISLANDS? OF ICE|ISLES OF ICE|IJSBERG|IJSSCHOTS|\bSCHOTS|\bICE\b|\bIJS\b|HIELO|GLACE/],
];
const NEG = /\bGEEN\b|\bNO (WHALE|BIRD|ICE)|SAW NO|SEEN NO|NINGUN|NI UN|PAS DE/;
const fields = r => [r.OtherRem, r.Weather, r.ShipAndRigMemo, r.BiologyMemo, r.LifeOnBoard, r.Clearness, r.ShapeClouds].filter(Boolean);
const dmsRaw = (d, m, h) => d == null ? null : (d + (m || 0) / 60) * (/[SW]/.test(h || '') ? -1 : 1);
function extras(r, ei) {
  if (X.decl[ei] == null && r.Decl != null) X.decl[ei] = Math.max(-120, Math.min(120, Math.round(r.Decl)));
  if (!X.clim.has(ei) && (r.SLP != null || r.AT != null)) X.clim.set(ei, [r.SLP ?? -32768, r.AT ?? -32768,
    baroTxt.id(r.BaroReading != null ? String(r.BaroReading).trim() + ' ' + (r.AirPressureReadingUnits || '') : ''),
    thermTxt.id(r.TairReading != null ? String(r.TairReading).trim() + ' ' + (r.AirThermReadingUnits || '') : '')]);
  if (X.mer[ei] == null && r.ZeroMeridian) {
    X.mer[ei] = merName.id(r.ZeroMeridian);
    // where this zero meridian lies: CLIWOC's longitude (from Greenwich) minus the longitude as written
    const raw = dmsRaw(r.LongDeg, r.LongMin, r.LongHem) ?? dmsRaw(r.drLongDeg, r.drLongMin, r.drLongHem);
    if (raw != null && r.longitude != null) { let o = ((r.longitude - raw) % 360 + 540) % 360 - 180; if (!X.merOff.has(r.ZeroMeridian)) X.merOff.set(r.ZeroMeridian, []); const a = X.merOff.get(r.ZeroMeridian); if (a.length < 4000) a.push(o); }
  }
  const txt = fields(r);
  for (const [cat, re, need] of SKY) for (const t of txt) {
    if (!re.test(t) || (need && !need.test(t))) continue;
    if ((cat === 'whales' || cat === 'birds' || cat === 'ice') && NEG.test(t)) continue;
    const k = ei + '|' + cat; if (!X.sky.has(k)) X.sky.set(k, { i: ei, c: cat, t: t.slice(0, 240) }); break;
  }
  for (const [flag, cat] of [[r.SeaIce, 'ice'], [r.Snow, 'snow'], [r.Hail, 'hail']]) {
    if (flag !== 1) continue; const k = ei + '|' + cat; if (!X.sky.has(k)) X.sky.set(k, { i: ei, c: cat, t: (txt[0] || '').slice(0, 240) });
  }
  if (r.CargoMemo && !/SLAAF|SLAVIN/.test(r.CargoMemo) && !X.cargo.has(ei)) X.cargo.set(ei, r.CargoMemo.slice(0, 300));
  if (r.EncName || r.EncNat || r.EncRem) { const k = ei + '|' + (r.EncName || '') + '|' + (r.EncNat || ''); if (!X.enc.has(k)) X.enc.set(k, { i: ei, n: r.EncName || '', nat: r.EncNat || '', r: (r.EncRem || '').slice(0, 160) }); }
}
const dayIdx = new Map();
const dms = (d, m, h) => d == null || !h ? null : (d + (m || 0) / 60) * (/[SW]/.test(h) ? -1 : 1);

for (const r of rows) {
  const k = r.LogbookIdent + '|' + r.Year + '-' + r.Month + '-' + r.Day;
  if (seen.has(k)) { extras(r, dayIdx.get(k)); continue; } // one entry per logbook per day: the first by hour (its other rows still add to the extras)
  seen.add(k);
  const sk = r.ShipName + '|' + (r.Nationality || '');
  let si = shipKey.get(sk);
  if (si == null) {
    si = ships.length; shipKey.set(sk, si);
    ships.push({ name: r.ShipName, nat: NAT[r.Nationality] ?? 4, natName: r.Nationality || 'UNKNOWN', types: new Set(), companies: new Set(),
      info: new Set(), captains: new Set(), first: 1e9, last: -1, n: 0, logs: new Set() });
  }
  const s = ships[si];
  if (r.ShipType) s.types.add(r.ShipType);
  if (r.Company) s.companies.add(r.Company);
  if (r.OtherShipInformation) s.info.add(r.OtherShipInformation);
  if (r.Name1) s.captains.add(r.Name1 + (r.Rank1 ? ` (${r.Rank1})` : ''));
  let li = logKey.get(r.LogbookIdent);
  if (li == null) {
    li = logs.length; logKey.set(r.LogbookIdent, li);
    logs.push({ id: r.LogbookIdent, inst: r.InstName, place: r.InstPlace, ref: [r.NumberEntry, r.NameArchiveSet].filter(Boolean).join(' / '),
      lang: r.LogbookLanguage, from: r.VoyageFrom, to: r.VoyageTo, ship: si });
  }
  s.logs.add(li);
  const day = dayOf(r.Year, r.Month, r.Day);
  s.first = Math.min(s.first, day); s.last = Math.max(s.last, day); s.n++;
  E.day.push(day);
  E.lat.push(Math.round(r.latitude * 100));
  E.lon.push(Math.round(r.longitude * 100));
  E.ship.push(si);
  E.log.push(li);
  E.d.push(r.D == null ? 65535 : r.D);   // degrees the wind comes from; 361 calm, 362 variable (CLIWOC codes)
  E.w.push(r.W == null ? 65535 : r.W);   // 0.1 m/s, CLIWOC's conversion of the words
  E.words.push(words.id(r.AllWindForces));
  E.dirs.push(dirs.id(r.AllWindDirections));
  E.weather.push(weather.id(r.Weather));
  E.sea.push(sea.id(r.StateSea));
  dayIdx.set(k, E.day.length - 1); extras(r, E.day.length - 1);
  E.how.push((r.LatInd === 2 ? 1 : 0) | (r.LonInd === 2 ? 2 : 0) | (r.LatInd === 1 ? 4 : 0) | (r.LonInd === 1 ? 8 : 0));
  { const a = dms(r.drLatDeg, r.drLatMin, r.drLatHem), o = dms(r.LatDeg, r.LatMin, r.LatHem), b = dms(r.drLongDeg, r.drLongMin, r.drLongHem), p = dms(r.LongDeg, r.LongMin, r.LongHem);
    let dla = a != null && o != null && r.LatInd === 2 ? o - a : null, dlo = b != null && p != null && r.LonInd === 2 ? p - b : null;
    if (dlo != null) { if (dlo > 180) dlo -= 360; if (dlo < -180) dlo += 360; }
    if (dla != null && Math.abs(dla) * 111.2 > 600) dla = null; // transcription slips
    if (dlo != null && Math.abs(dlo) * 111.2 * Math.cos(r.latitude * Math.PI / 180) > 1500) dlo = null;
    if (dla != null || dlo != null) { DR.i.push(E.day.length - 1); DR.dlat.push(Math.round((dla ?? 0) * 100)); DR.dlon.push(Math.round((dlo ?? 0) * 100)); } }
}

const n = E.day.length;
for (const d of [words, dirs, weather, sea]) if (d.a.length > 65535) throw new Error('dictionary too large for Uint16');
const b64 = (Type, arr) => Buffer.from(new Type(arr).buffer).toString('base64');
const head = `// Generated by tools/build-data.mjs from CLIWOC 2.1 (CC0, https://doi.org/10.17026/dans-2bx-dutg).\n`;

fs.writeFileSync(path.join(out, 'entries.js'), head +
  `// ${n} noon entries, one per logbook per day, sorted by day. Base64 typed arrays.\n` +
  `window.CLIWOC_ENTRIES = ${JSON.stringify({ n, epoch: '1662-01-01',
    day: b64(Uint32Array, E.day), lat: b64(Int16Array, E.lat), lon: b64(Int16Array, E.lon), ship: b64(Uint16Array, E.ship), how: b64(Uint8Array, E.how) })};\n`);

fs.writeFileSync(path.join(out, 'details.js'), head +
  `// Per entry, in the same order as entries.js: logbook, wind direction (deg), wind speed (0.1 m/s), and the logbook's words.\n` +
  `window.CLIWOC_DETAILS = ${JSON.stringify({
    log: b64(Uint16Array, E.log), d: b64(Uint16Array, E.d), w: b64(Uint16Array, E.w),
    words: b64(Uint16Array, E.words), dirs: b64(Uint16Array, E.dirs), weather: b64(Uint16Array, E.weather), sea: b64(Uint16Array, E.sea),
    dict: { words: words.a, dirs: dirs.a, weather: weather.a, sea: sea.a }, logs,
    dr: { i: b64(Uint32Array, DR.i), dlat: b64(Int16Array, DR.dlat), dlon: b64(Int16Array, DR.dlon) } })};\n`);

// ---------- the extra layers ----------
{ const n2 = E.day.length, decl = new Int8Array(n2).fill(127); X.decl.forEach((v, i) => { if (v != null) decl[i] = Math.max(-126, Math.min(126, v)); });
  // declination averaged on a 5-degree grid by decade, for the compass-needle layer
  const G = 5, NX = 72, NY = 36, D0 = 1750, ND = 11, sum = new Float32Array(ND * NX * NY), cnt = new Float32Array(ND * NX * NY);
  for (let i = 0; i < n2; i++) { if (decl[i] === 127) continue; const y = new Date(Date.UTC(1662, 0, 1) + E.day[i] * 864e5).getUTCFullYear(), dI = Math.floor((y - D0) / 10); if (dI < 0 || dI >= ND) continue;
    const cx = Math.min(NX - 1, Math.floor((E.lon[i] / 100 + 180) / G)), cy = Math.min(NY - 1, Math.floor((90 - E.lat[i] / 100) / G)), c = (dI * NY + cy) * NX + cx; sum[c] += decl[i]; cnt[c]++; }
  const mean = new Float32Array(ND * NX * NY); for (let c = 0; c < mean.length; c++) mean[c] = cnt[c] ? sum[c] / cnt[c] : NaN;
  fs.writeFileSync(path.join(out, 'magnetic.js'), head + '// Compass declination (degrees, east positive) per entry (127 = not recorded), and averaged on a 5-degree grid by decade from 1750.\n' +
    `window.CLIWOC_MAGNETIC = ${JSON.stringify({ decl: b64(Int8Array, decl), g: G, nx: NX, ny: NY, d0: D0, nd: ND, mean: b64(Float32Array, mean), count: b64(Float32Array, cnt) })};\n`);
  const ci = [...X.clim.keys()].sort((a, b) => a - b);
  fs.writeFileSync(path.join(out, 'climate.js'), head + '// Barometer and thermometer, where recorded: entry index, CLIWOC sea-level pressure (0.1 hPa) and air temperature (0.1 C), and the reading as written.\n' +
    `window.CLIWOC_CLIMATE = ${JSON.stringify({ i: b64(Uint32Array, ci), slp: b64(Int16Array, ci.map(i => X.clim.get(i)[0])), at: b64(Int16Array, ci.map(i => X.clim.get(i)[1])),
      baro: b64(Uint16Array, ci.map(i => X.clim.get(i)[2])), therm: b64(Uint16Array, ci.map(i => X.clim.get(i)[3])), dict: { baro: baroTxt.a, therm: thermTxt.a } })};\n`);
  const sky = [...X.sky.values()].sort((a, b) => a.i - b.i);
  fs.writeFileSync(path.join(out, 'phenomena.js'), head + '// Rare things seen, found in the logbook remarks (and CLIWOC sea-ice, snow and hail flags): entry index, category, the remark as written.\n' +
    `window.CLIWOC_SKY = ${JSON.stringify(sky)};\n`);
  const med = a => { const s2 = [...a].sort((x, y) => x - y); return s2[s2.length >> 1]; };
  const merCount = new Map(); X.mer.forEach(m => { if (m != null) merCount.set(m, (merCount.get(m) || 0) + 1); });
  const meridians = [...merCount].map(([m, n3]) => { const name = merName.a[m], off = X.merOff.get(name); return { name, n: n3, lon: off && off.length >= 5 ? Math.round(med(off) * 100) / 100 : null }; }).sort((a, b) => b.n - a.n);
  fs.writeFileSync(path.join(out, 'empire2.js'), head + '// Cargo and encounters noted in the logbooks (entry index and text), and the zero meridians longitude was counted from (with where each lies, estimated from the data).\n' +
    `window.CLIWOC_EMPIRE2 = ${JSON.stringify({ cargo: [...X.cargo].map(([i, t]) => ({ i, t })), enc: [...X.enc.values()], meridians })};\n`);
  console.log('extras:', sky.length, 'sightings,', ci.length, 'instrument readings,', X.cargo.size, 'cargo notes,', X.enc.size, 'encounters,', meridians.length, 'zero meridians');
}
// English versions of the ship notes, if translated (tools/notes-en.json: original → English).
const notesFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'notes-en.json');
const NOTES_EN = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : {};
const codeNote = (s) => s.replace(/(\d+)\s*G\b/g, '$1 guns').replace(/(\d+)\s*BM\b/g, '$1 tons burthen');
const shipOut = ships.map((s) => {
  const types = [...s.types], companies = [...s.companies], info = [...s.info];
  return { name: s.name, nat: s.nat, natName: s.natName, types, companies, info, infoEn: info.map((t) => NOTES_EN[t] || codeNote(t)),
    captains: [...s.captains].slice(0, 8), role: role(types, companies, info.join(' ')), first: s.first, last: s.last, n: s.n, logs: [...s.logs] };
});
fs.writeFileSync(path.join(out, 'ships.js'), head + `window.CLIWOC_SHIPS = ${JSON.stringify(shipOut)};\n`);
const iso = (d) => new Date(EPOCH + d * 86400000).toISOString().slice(0, 10);

// Wind: CLIWOC winds averaged by calendar month on a 5-degree grid (all years together), lightly smoothed.
const G = 5, NX = 360 / G, NY = 180 / G;
const U = new Float64Array(12 * NX * NY), V = new Float64Array(U.length), C = new Float64Array(U.length);
for (let i = 0; i < n; i++) {
  const d = E.d[i], w = E.w[i];
  if (d > 360 || w === 65535) continue;
  const month = new Date(EPOCH + E.day[i] * 86400000).getUTCMonth();
  const x = Math.min(NX - 1, Math.floor((E.lon[i] / 100 + 180) / G)), y = Math.min(NY - 1, Math.floor((90 - E.lat[i] / 100) / G));
  const k = (month * NY + y) * NX + x, sp = w / 10, rad = (d * Math.PI) / 180;
  U[k] += -sp * Math.sin(rad); V[k] += -sp * Math.cos(rad); C[k] += 1; // blowing toward; v positive = north
}
const su = new Float32Array(U.length), sv = new Float32Array(U.length), sc = new Float32Array(U.length);
for (let m = 0; m < 12; m++) for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
  let u = 0, v = 0, c = 0, wsum = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const yy = y + dy, xx = (x + dx + NX) % NX; if (yy < 0 || yy >= NY) continue;
    const k = (m * NY + yy) * NX + xx, wt = dx === 0 && dy === 0 ? 4 : 1;
    u += U[k] * wt; v += V[k] * wt; c += C[k] * wt; wsum += wt;
  }
  const k = (m * NY + y) * NX + x;
  if (c > 0) { su[k] = u / c; sv[k] = v / c; }
  sc[k] = c / wsum;
}
fs.writeFileSync(path.join(out, 'wind.js'), head +
  `// Mean wind (m/s, blowing toward) by calendar month, ${G}-degree grid from 90N/180W, all years together; count = observations per cell, smoothed.\n` +
  `window.CLIWOC_WIND = ${JSON.stringify({ g: G, nx: NX, ny: NY, u: b64(Float32Array, su), v: b64(Float32Array, sv), count: b64(Float32Array, sc) })};\n`);

// Storms: entries at Beaufort 10 or more, or whose words name a storm, grouped into events
// (same event when within 3 days and about 900 km of another stormy entry).
const STORM_WORDS = /\b(storm\w*|orkaan|hurricane|tempest\w*|temporal|tormenta|hurac[aá]n|temp[eê]s?te|tempeste|ouragan)\b/i;
const stormy = [];
for (let i = 0; i < n; i++) {
  const w = E.w[i], txt = words.a[E.words[i]] || '';
  if ((w !== 65535 && w >= 245) || STORM_WORDS.test(txt)) stormy.push(i);
}
const parent = stormy.map((_, j) => j);
const find = (j) => (parent[j] === j ? j : (parent[j] = find(parent[j])));
const km = (a, b) => {
  const R = 6371, p1 = (E.lat[a] / 100) * Math.PI / 180, p2 = (E.lat[b] / 100) * Math.PI / 180;
  const dl = ((E.lon[b] - E.lon[a]) / 100) * Math.PI / 180;
  return R * Math.acos(Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl)));
};
for (let a = 0; a < stormy.length; a++) for (let b = a + 1; b < stormy.length && E.day[stormy[b]] - E.day[stormy[a]] <= 3; b++)
  if (km(stormy[a], stormy[b]) < 900) parent[find(a)] = find(b);
const groups = new Map();
stormy.forEach((i, j) => { const r = find(j); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
const storms = [...groups.values()].map((g) => {
  const shipsIn = new Set(g.map((i) => E.ship[i]));
  const maxW = Math.max(...g.map((i) => (E.w[i] === 65535 ? 0 : E.w[i])));
  const sample = [...new Set(g.map((i) => words.a[E.words[i]]).filter(Boolean))].slice(0, 4);
  return {
    start: Math.min(...g.map((i) => E.day[i])), end: Math.max(...g.map((i) => E.day[i])),
    lat: +(g.reduce((s, i) => s + E.lat[i], 0) / g.length / 100).toFixed(2), lon: +(g.reduce((s, i) => s + E.lon[i], 0) / g.length / 100).toFixed(2),
    ships: [...shipsIn], entries: g.length, maxMs: maxW / 10, words: sample,
  };
}).sort((a, b) => a.start - b.start);
fs.writeFileSync(path.join(out, 'storms.js'), head +
  `// ${storms.length} storm events found in the logbooks: Beaufort 10+ or a storm word, grouped by 3 days and ~900 km. Days since 1662-01-01.\n` +
  `window.CLIWOC_STORMS = ${JSON.stringify(storms)};\n`);
console.log('storms:', storms.length, 'with 2+ ships:', storms.filter((s) => s.ships.length > 1).length, 'with 4+ ships:', storms.filter((s) => s.ships.length > 3).length);

for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(path.join(out, f)).size / 1e6).toFixed(2) + ' MB');
console.log(n, 'entries,', ships.length, 'ships,', logs.length, 'logbooks; first', iso(E.day[0]), 'last', iso(E.day[n - 1]));
