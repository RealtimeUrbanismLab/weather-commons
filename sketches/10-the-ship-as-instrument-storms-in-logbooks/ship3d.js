// The ship in the pop-up: white linework on black, in a still isometric view, turned to its logged course.
// No sea: only the ship, the set of its sails, the compass of its course and wind, and the air moving through the rig.
// Built in code, at real scale (metres), from the ship's type, nation and year. Interpretive: a typical ship of that
// type, nation and period, not the individual ship. Proportions follow late-18th-century practice (Chapman,
// Architectura Navalis Mercatoria 1768; Steel, Elements of Mastmaking, Sailmaking and Rigging 1794).
(() => {
const { THREE } = window.THREEX;

// ---------- what kind of ship ----------
function classify(o) {
  const t = (o.types || []).join(' '), c = (o.companies || []).join(' '), notes = (o.notes || []).join(' ');
  const g = +(notes.match(/(\d+)\s*guns/i) || notes.match(/armed with (\d+)/i) || [])[1] || 0;
  let kind = 'ship';
  if (/STOOM|STEAM/.test(t)) kind = 'steamer';
  else if (/KOTTER|CUTTER|COTTER|SLOEP\b|BALANDRA|HOEKER|GALJOOT/.test(t)) kind = 'cutter';
  else if (/BRIK|BRIG|BRICK|SNAUW|SNAAUW|SNOW|BERGANTIN|BRIGANTIJN|BARGENTIJN|SCHOENER|SCHOONER|GOLETA|PAKKETBOOT/.test(t)) kind = 'brig';
  else if (/NAV[IÍ]O|LINIE|2ND RATE|3RD RATE|SHIP O\.T\. LINE/.test(t) || g >= 56) kind = 'line';
  else if (/4TH RATE/.test(t) || (g >= 46 && g < 56)) kind = 'line';
  else if (/KORVET|CORVET|CORBETA|6TH RATE|SLOOP|7TH|8TH/.test(t) || (g > 0 && g < 26)) kind = 'corvette';
  else if (/FREGAT|FRAGATA|FRIGAT|FRÉGATE|FREGATE|5TH RATE|FRIGATE|PAQUEBOT|CORREO/.test(t) || g >= 26) kind = 'frigate';
  else if (/VOC|EIC|EAST INDIA|OIC|RETOURSC|WIC/.test(c + ' ' + t)) kind = 'indiaman';
  else if (/OORLOG/.test(t)) kind = 'frigate';
  const navy = /\b(RN|MAR|ADM|ROYAL NAVY)\b/.test(c) || /RATE|OORLOG|NAV[IÍ]O|FRAGATA|FREGAT|KORVET|CORVET|LINIE/.test(t);
  const guns = g || { line: 74, frigate: 32, corvette: 20, brig: 14, cutter: 10, indiaman: 30, ship: 12, steamer: 4 }[kind];
  return { kind, guns, navy, company: c };
}

// dimensions in metres (typical of each class, c. 1760–1830)
const DIM = {
  line:     { L: 52, B: 14.5, T: 6.6, F: 7.6, sheer: 1.6, stern: 1.6, tumble: .16, rows: [2.0, 4.6], bulwark: 1.5, masts: 3, H: 58 },
  frigate:  { L: 43, B: 11.6, T: 5.2, F: 5.4, sheer: 1.3, stern: 1.2, tumble: .1, rows: [2.5], bulwark: 1.3, masts: 3, H: 50 },
  corvette: { L: 34, B: 9.6, T: 4.3, F: 4.2, sheer: 1.0, stern: .9, tumble: .08, rows: [2.3], bulwark: 1.2, masts: 3, H: 40 },
  indiaman: { L: 44, B: 12, T: 5.6, F: 6.2, sheer: 1.6, stern: 2.2, tumble: .14, rows: [2.9], bulwark: 1.4, masts: 3, H: 49 },
  ship:     { L: 34, B: 9.8, T: 4.6, F: 4.6, sheer: 1.1, stern: 1.2, tumble: .1, rows: [], bulwark: 1.2, masts: 3, H: 38 },
  brig:     { L: 29, B: 8.4, T: 3.8, F: 3.1, sheer: .8, stern: .6, tumble: .06, rows: [1.9], bulwark: 1.1, masts: 2, H: 33 },
  cutter:   { L: 21, B: 6.8, T: 3.2, F: 2.4, sheer: .6, stern: .4, tumble: .04, rows: [1.6], bulwark: .9, masts: 1, H: 28 },
  steamer:  { L: 46, B: 9.5, T: 4.0, F: 4.0, sheer: .9, stern: .7, tumble: .05, rows: [], bulwark: 1.2, masts: 3, H: 34 },
};

// ---------- flags by nation and year ----------
function flagCanvas(nat, year, cls) {
  const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d');
  const union = (x, y, w, h) => {
    g.fillStyle = '#1f3a7a'; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.strokeStyle = '#fff'; g.lineWidth = h * .2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke();
    if (year >= 1801) { g.strokeStyle = '#c8202e'; g.lineWidth = h * .07; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke(); }
    g.fillStyle = '#fff'; g.fillRect(x + w / 2 - h * .17, y, h * .34, h); g.fillRect(x, y + h / 2 - h * .17, w, h * .34);
    g.fillStyle = '#c8202e'; g.fillRect(x + w / 2 - h * .1, y, h * .2, h); g.fillRect(x, y + h / 2 - h * .1, w, h * .2);
    g.restore();
  };
  const bands = (cols, vertical) => cols.forEach((col, i) => { g.fillStyle = col; vertical ? g.fillRect(i * 300 / cols.length, 0, 300 / cols.length + 1, 200) : g.fillRect(0, i * 200 / cols.length, 300, 200 / cols.length + 1); });
  if (nat === 'BRITISH') {
    if (/EIC/.test(cls.company)) { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#c8202e'; g.fillRect(0, i * 200 / 13, 300, 200 / 13 + 1); } union(0, 0, 130, 92); }
    else if (cls.navy) { g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#c8202e'; g.fillRect(140, 0, 22, 200); g.fillRect(0, 90, 300, 22); union(0, 0, 150, 100); }
    else { g.fillStyle = '#c8202e'; g.fillRect(0, 0, 300, 200); union(0, 0, 150, 100); }
  } else if (nat === 'DUTCH') {
    bands(['#ae1c28', '#fff', '#21468b']);
    if (/VOC/.test(cls.company)) { g.fillStyle = '#1b1b1b'; g.font = 'bold 54px Georgia'; g.textAlign = 'center'; g.fillText('VOC', 150, 120); }
  } else if (nat === 'SPANISH') {
    if (year >= 1785) { g.fillStyle = '#aa151b'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#f1bf00'; g.fillRect(0, 50, 300, 100); g.fillStyle = '#aa151b'; g.beginPath(); g.ellipse(85, 100, 18, 24, 0, 0, 7); g.fill(); }
    else { g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#b48a3c'; g.beginPath(); g.ellipse(150, 100, 26, 34, 0, 0, 7); g.fill(); g.strokeStyle = '#aa151b'; g.lineWidth = 5; g.stroke(); }
  } else if (nat === 'FRENCH') {
    if (year >= 1794) bands(['#21468b', '#fff', '#c8202e'], true);
    else if (year >= 1790) { g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 200); g.save(); g.translate(0, 0); bands.call(null, []); g.restore(); g.fillStyle = '#21468b'; g.fillRect(0, 0, 40, 90); g.fillStyle = '#fff'; g.fillRect(40, 0, 40, 90); g.fillStyle = '#c8202e'; g.fillRect(80, 0, 40, 90); g.strokeStyle = '#ccc'; g.strokeRect(0, 0, 120, 90); }
    else { g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 300, 200); }
  } else if (nat === 'SWEDISH') { g.fillStyle = '#1f5aa6'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#f2c500'; g.fillRect(90, 0, 34, 200); g.fillRect(0, 83, 300, 34); }
  else if (nat === 'DANISH') { g.fillStyle = '#c8102e'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#fff'; g.fillRect(90, 0, 28, 200); g.fillRect(0, 86, 300, 28); }
  else if (nat === 'AMERICAN') { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#b22234'; g.fillRect(0, i * 200 / 13, 300, 200 / 13 + 1); } g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 130, 108); g.fillStyle = '#fff'; for (let i = 0; i < 15; i++) { g.beginPath(); g.arc(15 + (i % 5) * 25, 18 + (i / 5 | 0) * 34, 5, 0, 7); g.fill(); } }
  else { g.fillStyle = '#c8202e'; g.fillRect(0, 0, 300, 200); }
  return c;
}

// ---------- hull ----------
function hullFns(d) {
  const L2 = d.L / 2, B2 = d.B / 2;
  const hb = u => u > .15 ? B2 * Math.sqrt(Math.max(0, 1 - Math.pow((u - .15) / .85, 2.2))) : u < -.45 ? B2 * (1 - .3 * Math.pow((-u - .45) / .55, 1.5)) : B2;
  const depth = u => d.T * (u > .62 ? 1 - .82 * Math.pow((u - .62) / .38, 2) : 1);
  const rail = u => d.F + d.sheer * u * u + (u < 0 ? d.stern * u * u * u * u : 0) + (u > .82 ? .9 * (u - .82) / .18 : 0);
  const p = u => 1.35 + 2.3 * Math.max(0, 1 - Math.abs(u) / .9);
  // half-breadth at height y (y=0 waterline) for station u
  const half = (u, y) => {
    const h = hb(u), T = depth(u), R = rail(u);
    if (y >= 0) return h * (1 - d.tumble * Math.pow(y / R, 2));
    const f = Math.min(1, -y / T), pp = p(u);
    let z = h * Math.pow(Math.max(0, 1 - Math.pow(f, pp)), 1 / pp);
    if (u < -.3) z *= 1 - .55 * Math.pow((-u - .3) / .7, 1.4) * Math.pow(f, .7); // the run aft
    return z;
  };
  return { L2, hb, depth, rail, half };
}

// Flags in line: the flag's design traced as white lines (where its colours meet), with no colour.
function lineFlag(nat, year, cls) {
  const src = flagCanvas(nat, year, cls), W = src.width, Hh = src.height, d = src.getContext('2d').getImageData(0, 0, W, Hh).data;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  g.fillStyle = BG_CSS; g.fillRect(0, 0, W, Hh);
  const out = g.getImageData(0, 0, W, Hh), o = out.data, diff = (a, b) => Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]);
  for (let y = 0; y < Hh - 2; y++) for (let x = 0; x < W - 2; x++) {
    const i = (y * W + x) * 4;
    if (diff(i, i + 8) > 90 || diff(i, i + W * 8) > 90) for (const j of [i, i + 4, i + W * 4, i + W * 4 + 4]) { o[j] = o[j + 1] = o[j + 2] = 235; }
  }
  g.putImageData(out, 0, 0);
  g.strokeStyle = '#ebebeb'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, Hh - 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- the model ----------
// sail set by force, after the CLIWOC/Beaufort descriptions: [course, topsail, topgallant, spanker, jib]
// jib column: 1 = jib and fore topmast staysail, .5 = staysail only (storm staysail), 0 = none
const SET = [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,0,1,1],[1,.7,0,.75,1],[1,.5,0,.55,.5],[.65,.38,0,0,.5],[0,.32,0,0,.5],[0,0,0,0,.5],[0,0,0,0,0]];
const BFT_MS = [0, .9, 2.4, 4.4, 6.7, 9.4, 12.3, 15.5, 19, 22.6, 26.5, 30.6, 34]; // middle of each Beaufort band (m/s)
const BG = 0x05070f, BG_CSS = '#05070f', INK = 0xe8ecf4;
const COMPASS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const pt16 = deg => COMPASS16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
// world axes: north is -z, east is +x; bearings are clockwise from north
const bearingVec = (deg, len = 1) => { const r = deg * Math.PI / 180; return new THREE.Vector3(Math.sin(r) * len, 0, -Math.cos(r) * len); };

function label(text, size = 30, alpha = 1) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = `${size}px system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 12; c.width = w; c.height = size + 14;
  g.font = `${size}px system-ui, sans-serif`; g.fillStyle = `rgba(232,236,244,${alpha})`; g.textBaseline = 'middle'; g.fillText(text, 6, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.userData.aspect = c.width / c.height; s.renderOrder = 10; return s;
}

class ShipModel {
  constructor() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setClearColor(BG);
    this.scene = new THREE.Scene();
    // a still isometric camera (looking down the cube diagonal); the frame is fitted to the whole ship
    this.camera = new THREE.OrthographicCamera(-50, 50, 30, -30, -5000, 5000); this.aspect = 2;
    this.isoDir = new THREE.Vector3(1, 1, 1).normalize();
    // materials: solids are filled with the background colour so hidden lines disappear; edges are white lines
    this.fillMat = new THREE.MeshBasicMaterial({ color: BG, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    this.outlineMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * 0.07;'); };
    this.lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .9 });
    this.faintMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .4 });
    this.ropeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .5 });
    this.sailFill = new THREE.MeshBasicMaterial({ color: BG, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.sailLine = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .7 });
    this.sailEdge = new THREE.LineBasicMaterial({ color: INK });
    this.sailDiag = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .35 });
    // the ship turns to its course inside `yaw`; inside it, `ship` heels and rolls
    this.yaw = new THREE.Group(); this.scene.add(this.yaw);
    this.ship = new THREE.Group(); this.yaw.add(this.ship);
    this.plinth = new THREE.Group(); this.scene.add(this.plinth); // compass, course, wind and track, fixed to north
    // the air: streaks moving with the wind felt on board, bending round the sails
    this.NP = 2200; this.parts = new Float32Array(this.NP * 6); this.partsOn = 0;
    { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.NP * 6), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.NP * 6), 3));
      this.air = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .9, depthWrite: false })); this.air.frustumCulled = false; this.scene.add(this.air); }
    // spray: water torn off the sea and carried in the air, in a gale and above
    this.NS = 1400; this.spray = new Float32Array(this.NS * 6);
    { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.NS * 6), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.NS * 6), 3));
      this.sprayLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })); this.sprayLines.frustumCulled = false; this.scene.add(this.sprayLines); }
    this.sails = []; this.flags = []; this.clock = new THREE.Clock(); this.opts = { bft: 3 }; this.key = ''; this.lastT = 0;
    r.setAnimationLoop(() => this.frame());
    window.__shipModel = this; // for testing in the browser console
  }
  mount(el) {
    el.prepend(this.renderer.domElement);
    const w = el.clientWidth, h = el.clientHeight;
    this.renderer.setSize(w, h); this.aspect = w / h; this.fit();
  }
  // Fit the still camera so the whole ship, the compass and its labels are inside the frame.
  fit() {
    if (!this.dim) return;
    const cam = this.camera, c = new THREE.Vector3(0, this.dim.H * .4, 0);
    cam.position.copy(c).addScaledVector(this.isoDir, 1000); cam.up.set(0, 1, 0); cam.lookAt(c); cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse, pts = [];
    this.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.ship);
    for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    const R = this.R * 1.32, y0 = this.plinthY;
    for (let a = 0; a < 360; a += 15) pts.push(bearingVec(a, R).setY(y0));
    let x0 = 1e9, x1 = -1e9, yA = 1e9, yB = -1e9;
    for (const p of pts) { p.applyMatrix4(inv); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); yA = Math.min(yA, p.y); yB = Math.max(yB, p.y); }
    let w = (x1 - x0) * 1.06, h = (yB - yA) * 1.08; const cx = (x0 + x1) / 2, cy = (yA + yB) / 2;
    if (w / h < this.aspect) w = h * this.aspect; else h = w / this.aspect;
    Object.assign(cam, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 }); cam.updateProjectionMatrix();
    // labels are sized to the frame, not the ship
    this.plinth.traverse(o => { if (o.isSprite) { const s = h * .045 * (o.userData.scale || 1); o.scale.set(s * o.userData.aspect, s, 1); } });
  }
  set(o) {
    this.opts = o; const b = Math.max(0, Math.min(12, o.bft ?? 3));
    const cls = { ...classify(o), nat: o.nat }, d = DIM[cls.kind], year = o.year || 1790;
    this.cls = cls; this.dim = d; this.b = b;
    this.anchored = !!o.anchored; this.calm = !!o.calm;
    // where the wind comes from (logbook), and the course (from the noon positions); a ship at anchor lies head to wind
    const windFrom = o.windFrom != null ? o.windFrom : (o.heading != null ? o.heading + 150 : 210);
    let heading = o.heading != null ? o.heading : windFrom - 150;
    if (this.anchored) heading = windFrom;
    this.windFrom = windFrom; this.heading = heading;
    // Wind relative to the ship: theta is where the wind comes from, clockwise from the bow (0 ahead, 90 starboard
    // beam, 180 astern). A square-rigger cannot sail closer than about 67 degrees, so closer readings (course errors,
    // tacking between noons) are opened out for the set of the sails.
    let theta = ((windFrom - heading + 540) % 360) - 180;
    if (!this.anchored && Math.abs(theta) < 67) theta = Math.sign(theta || 1) * 67;
    this.theta = theta * Math.PI / 180;
    const px = -Math.cos(this.theta), pz = -Math.sin(this.theta); // where the wind pushes, in ship coordinates
    this.push = { x: px, z: pz };
    this.lee = pz >= 0 ? 1 : -1;
    this.brace = Math.max(-.61, Math.min(.61, Math.atan2(pz, px))); // yards braced round, at most ~35 degrees
    this.squareFill = Math.max(.3, Math.cos(this.brace) * px + Math.sin(this.brace) * pz);
    this.spankerSwing = this.lee * (.12 + .9 * Math.max(0, Math.abs(theta) - 67) / 113);
    const fallback = [0, 1, 2, 3, 4.5, 5.5, 6.5, 7, 6.5, 5.5, 4, 3, 2][b];
    this.speed = this.anchored ? 0 : (o.speedKn != null ? Math.min(13, o.speedKn) : fallback) * .5144; // m/s
    // the wind felt on board (in the scene, where the ship stands still): true wind minus the ship's own motion
    const ws = this.calm ? 0 : (o.ms ?? BFT_MS[b]);
    this.trueWind = bearingVec(windFrom + 180, ws);
    this.app = this.trueWind.clone().sub(bearingVec(heading, this.speed));
    // the ship's local +x (bow) turned to the course
    this.yaw.rotation.y = (90 - heading) * Math.PI / 180;
    const key = [cls.kind, o.nat, year, cls.navy, cls.company, b, o.calm, this.anchored, Math.round(theta / 10)].join('|');
    if (key !== this.key) { this.key = key; this.build(cls, d, year, this.anchored ? 0 : b, !!o.calm); }
    this.heel = this.calm || this.anchored ? 0 : this.push.z * Math.min(b, 8) * .016;
    this.ship.rotation.set(this.heel, 0, 0);
    this.buildPlinth(o);
    this.fit();
    this.resetAir();
  }
  // The compass under the ship: north, the course and the logged wind, and the noon positions before and after.
  buildPlinth(o) {
    const P = this.plinth, d = this.dim; P.clear();
    const R = this.R = d.L * .82, y = this.plinthY = -d.T - .8, V = (x, z) => new THREE.Vector3(x, y, z);
    const seg = [], faint = [];
    for (let a = 0; a < 360; a += 2) { const p = bearingVec(a, R), q = bearingVec(a + 2, R); seg.push(p.setY(y), q.setY(y)); }
    for (let a = 0; a < 360; a += 10) { const l = a % 90 === 0 ? .1 : a % 30 === 0 ? .06 : .03; seg.push(bearingVec(a, R).setY(y), bearingVec(a, R * (1 - l)).setY(y)); }
    for (let a = 0; a < 360; a += 2) { const p = bearingVec(a, R * .35), q = bearingVec(a + 2, R * .35); faint.push(p.setY(y), q.setY(y)); }
    faint.push(bearingVec(0, R).setY(y), bearingVec(180, R).setY(y), bearingVec(90, R).setY(y), bearingVec(270, R).setY(y));
    // north arrow
    const n0 = bearingVec(0, R * 1.02).setY(y), nTip = bearingVec(0, R * 1.14).setY(y);
    seg.push(n0, nTip, nTip, bearingVec(-4, R * 1.06).setY(y), nTip, bearingVec(4, R * 1.06).setY(y));
    // the compass needle: magnetic north, as the officer's compass showed it that day
    if (o.decl != null && Math.abs(o.decl) >= 1) { const md = o.decl, mt = bearingVec(md, R * 1.1).setY(y); for (let k = 0; k < 10; k += 2) faint.push(V(0, 0).lerp(mt, k / 10), V(0, 0).lerp(mt, (k + 1) / 10)); seg.push(mt, bearingVec(md - 3, R * 1.03).setY(y), mt, bearingVec(md + 3, R * 1.03).setY(y)); const ml = label(`magnetic N ${Math.abs(md)}° ${md < 0 ? 'W' : 'E'}`, 22, .8); ml.userData.scale = .7; ml.position.copy(bearingVec(md + (md < 0 ? -9 : 9), R * 1.08).setY(y)); ml.center.set(.5, .5); P.add(ml); }
    for (const [a, t, sc] of [[0, 'N', 1.25], [90, 'E', 1], [180, 'S', 1], [270, 'W', 1]]) { const l = label(t, 34); l.userData.scale = sc; l.position.copy(bearingVec(a, R * (a ? 1.12 : 1.24)).setY(y)); l.center.set(.5, .5); P.add(l); }
    // the course: from the ship's centre along the heading, out past the ring
    if (!this.anchored) {
      const tip = bearingVec(this.heading, R * 1.12).setY(y);
      seg.push(V(0, 0), tip, tip, bearingVec(this.heading - 3, R * 1.04).setY(y), tip, bearingVec(this.heading + 3, R * 1.04).setY(y));
      const l = label('course', 26); l.userData.scale = .8; l.position.copy(bearingVec(this.heading, R * 1.2).setY(y)); l.center.set(.5, .5); P.add(l);
    } else { const l = label('at anchor', 26); l.position.copy(bearingVec(this.heading + 180, R * 1.2).setY(y)); l.center.set(.5, .5); P.add(l); }
    // the logged wind: an arrow from outside the ring, pointing the way the wind blows
    if (!this.calm && this.opts.windFrom != null) {
      const a = this.windFrom, o1 = bearingVec(a, R * 1.32).setY(y), o2 = bearingVec(a, R * 1.03).setY(y);
      seg.push(o1, o2, o2, bearingVec(a - 2.5, R * 1.1).setY(y), o2, bearingVec(a + 2.5, R * 1.1).setY(y));
      for (const f of [1.2, 1.26]) seg.push(bearingVec(a, R * f).setY(y), bearingVec(a + 4, R * (f + .05)).setY(y)); // feathers
      const l = label('wind', 26); l.userData.scale = .8; l.position.copy(bearingVec(a, R * 1.4).setY(y)); l.center.set(.5, .5); P.add(l);
    } else { const l = label(this.calm ? 'calm' : 'wind direction not logged', 26); l.position.copy(bearingVec(225, R * 1.32).setY(y)); l.center.set(.5, .5); P.add(l); }
    // the track: noon positions before (solid) and after (dashed), scaled to fit inside the ring
    const tr = o.track;
    if (tr && (tr.past.length || tr.next.length)) {
      const all = [...tr.past, ...tr.next], mx = Math.max(1, ...all.map(([e, n]) => Math.hypot(e, n))), sc = R * .92 / mx;
      const P3 = ([e, n]) => V(e * sc, -n * sc);
      const past = [...tr.past.map(P3), V(0, 0)], next = [V(0, 0), ...tr.next.map(P3)];
      for (let i = 1; i < past.length; i++) seg.push(past[i - 1], past[i]);
      for (const p of past.slice(0, -1)) for (let k = 0; k < 8; k++) seg.push(p.clone().add(new THREE.Vector3(Math.cos(k * .785) * R * .012, 0, Math.sin(k * .785) * R * .012)), p.clone().add(new THREE.Vector3(Math.cos((k + 1) * .785) * R * .012, 0, Math.sin((k + 1) * .785) * R * .012)));
      for (let i = 1; i < next.length; i++) { const a = next[i - 1], b = next[i], n = Math.max(2, Math.round(a.distanceTo(b) / (R * .04))); for (let k = 0; k < n; k += 2) faint.push(a.clone().lerp(b, k / n), a.clone().lerp(b, Math.min(1, (k + 1) / n))); }
      this.trackKm = Math.round(mx);
    }
    P.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), this.lineMat));
    P.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(faint), this.faintMat));
  }
  build(cls, d, year, b, calm) {
    this.ship.clear(); this.sails = []; this.flags = [];
    const H = hullFns(d), set = this.anchored ? [0, 0, 0, 0, 0] : SET[b]; // at anchor: all sails furled
    this.hull = H;
    const G = this.ship;
    let cur = G, curLines = null; // the square rig of each mast goes in its own group, braced round to the wind
    const lines = [], hullL = [];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const seg = (a, c) => (curLines || lines).push(a, c);
    const solid = (geo, opts = {}) => { const m = new THREE.Mesh(geo, this.fillMat); Object.assign(m.userData, opts); return m; };

    // hull surface (a hidden-line fill), drawn as stations, waterlines, wales and gunports
    const NS = 72, M = 26, pos = [], idx = [];
    const rows = d.rows.map(r => r);
    const portsPerRow = rows.map((_, i) => Math.round((cls.guns / 2) / rows.length * (i === 0 && rows.length > 1 ? 1.05 : .95)) || 0);
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (let i = 0; i <= NS; i++) {
        const u = -1 + 2 * i / NS, x = u * H.L2, T = H.depth(u), R = H.rail(u);
        for (let j = 0; j <= M; j++) { const t = j / M, yy = -T + (R + T) * (t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)); pos.push(x, yy, side * H.half(u, yy)); }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < M; j++) { const a = base + i * (M + 1) + j, c = a + M + 1; side > 0 ? idx.push(a, c, a + 1, c, c + 1, a + 1) : idx.push(a, a + 1, c, c, a + 1, c + 1); }
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setIndex(idx); hg.computeVertexNormals();
    G.add(solid(hg));
    const sheerAt = (u, y) => y + (y > 0 ? (H.rail(u) - H.rail(0)) * Math.min(1, y / d.F) : 0);
    for (const side of [1, -1]) {
      // (no stations: the hull is read by its outline and main lines)
      if (false) for (let i = 0; i <= NS; i += 4) { const u = -1 + 2 * i / NS, T = H.depth(u), R = H.rail(u); let prev = null;
        for (let j = 0; j <= 16; j++) { const yy = -T + (R + T) * j / 16, p = V(u * H.L2, yy, side * H.half(u, yy)); if (prev) hullL.push(prev, p); prev = p; } }
      // waterline (brighter), lines below it, the sheer at the rail, and the wales along the gun decks
      const level = (fy, abs) => { let prev = null; for (let i = 0; i <= NS; i++) { const u = -1 + 2 * i / NS, yy = abs ? fy(u) : fy; if (yy < -H.depth(u) + .05) { prev = null; continue; } const p = V(u * H.L2, yy, side * (H.half(u, yy) + .03)); if (prev) hullL.push(prev, p); prev = p; } };
      level(0, false);
      level(u => H.rail(u), true); level(u => H.rail(u) - d.bulwark, true);
      for (const r of rows) { level(u => sheerAt(u, r - 1.25), true); level(u => sheerAt(u, r - .75), true); }
      if (!rows.length) level(u => H.rail(u) * .45, true);
      // gunports
      rows.forEach((r, ri) => { const n = portsPerRow[ri] || 0;
        for (let k = 0; k < n; k++) { const u = -.6 + 1.18 * (k + .5) / n, x = u * H.L2, yc = sheerAt(u, r), z = q => side * (H.half(q / H.L2, yc) + .05);
          const a = V(x - .47, yc - .42, z(x - .47)), bb = V(x + .47, yc - .42, z(x + .47)), c = V(x + .47, yc + .42, z(x + .47)), e = V(x - .47, yc + .42, z(x - .47));
          hullL.push(a, bb, bb, c, c, e, e, a); } });
    }
    // transom, with its windows
    const tr = new THREE.Shape(), Tu = -1, TT = H.depth(Tu), TR = H.rail(Tu);
    for (let j = 0; j <= 20; j++) { const y = -TT + (TR + TT) * j / 20; j ? tr.lineTo(H.half(Tu, y), y) : tr.moveTo(H.half(Tu, y), y); }
    for (let j = 20; j >= 0; j--) { const y = -TT + (TR + TT) * j / 20; tr.lineTo(-H.half(Tu, y), y); }
    const tg = new THREE.ShapeGeometry(tr); tg.rotateY(-Math.PI / 2);
    const transom = solid(tg, { edges: true }); transom.position.x = -H.L2 + .02; G.add(transom);
    { const galleries = cls.kind === 'line' ? 2 : 1, perRow = cls.kind === 'cutter' || cls.kind === 'brig' ? 3 : 5, w = H.hb(Tu) * 1.5, x = -H.L2 - .05;
      for (let r = 0; r < galleries; r++) for (let i = 0; i < perRow; i++) { const z0 = -w / 2 + i * w / perRow + .15, z1 = z0 + w / perRow - .3, y0 = TR - 1.2 - r * 1.8, y1 = y0 - 1.1;
        hullL.push(V(x, y0, z0), V(x, y0, z1), V(x, y0, z1), V(x, y1, z1), V(x, y1, z1), V(x, y1, z0), V(x, y1, z0), V(x, y0, z0)); } }
    // deck
    const dpos = [], didx = [];
    for (let i = 0; i <= NS; i++) { const u = -1 + 2 * i / NS, y = H.rail(u) - d.bulwark, z = H.half(u, y) * .97; dpos.push(u * H.L2, y, z, u * H.L2, y, -z); if (i < NS) { const a = i * 2; didx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3)); dgeo.setIndex(didx); dgeo.computeVertexNormals();
    G.add(solid(dgeo, { noOutline: true }));
    const deckY = u => H.rail(u) - d.bulwark;
    for (let i = 0; i < NS; i += 3) { const u = -1 + 2 * i / NS; if (Math.abs(u) > .9) continue; } // (deck planking left out: too fine to read)
    // keel, rudder
    const keel = solid(new THREE.BoxGeometry(d.L * .78, .5, .4), { edges: true }); keel.position.set(-d.L * .06, -d.T - .1, 0); G.add(keel);
    const rud = solid(new THREE.BoxGeometry(1.4, d.T + H.rail(-1) * .5, .35), { edges: true }); rud.position.set(-H.L2 - .5, (-d.T + H.rail(-1) * .5) / 2, 0); G.add(rud);
    if (/line|frigate|indiaman/.test(cls.kind)) {
      const qd = solid(new THREE.BoxGeometry(d.L * .22, .25, d.B * .8), { edges: true }); qd.position.set(-d.L * .38, deckY(-.76) + 1.1, 0); G.add(qd);
      const fc = solid(new THREE.BoxGeometry(d.L * .14, .25, d.B * .6), { edges: true }); fc.position.set(d.L * .33, deckY(.66) + 1.0, 0); G.add(fc);
    }
    if (d.L > 25) { const boat = solid(new THREE.CapsuleGeometry(.9, 6, 4, 8)); boat.rotation.z = Math.PI / 2; boat.scale.set(1, 1, .9); boat.position.set(-d.L * .05, deckY(0) + .8, 0); G.add(boat); }
    if (cls.kind === 'steamer') {
      const fun = solid(new THREE.CylinderGeometry(.9, .9, 10, 20)); fun.position.set(-1, deckY(0) + 5, 0); G.add(fun);
      for (const side of [-1, 1]) { const pb = solid(new THREE.CylinderGeometry(3.6, 3.6, 2.2, 24, 1, false, 0, Math.PI)); pb.rotation.x = Math.PI / 2; pb.rotation.y = Math.PI / 2; pb.position.set(0, d.F * .6, side * (d.B / 2 + 1)); G.add(pb); }
    }
    // a ship at anchor: the cable from the hawse down and ahead
    if (this.anchored) { const hawse = V(H.L2 * .93, H.rail(.93) - 1.6, 0); lines.push(hawse, V(H.L2 + d.L * .35, -d.T - .8, 0)); }

    // ---------- masts and yards ----------
    const L = d.L, Hm = d.H;
    const mastsX = { 3: [L * .27, -L * .02, -L * .3], 2: [L * .2, -L * .14], 1: [L * .1] }[d.masts];
    const heightF = { 3: [.89, 1, .74], 2: [.95, 1], 1: [1] }[d.masts];
    const yardF = { 3: [.9, 1, .68], 2: [.95, 1], 1: [.85] }[d.masts];
    const struck = b >= 10; // topgallant masts sent down in a storm
    const cyl = (r0, r1, len) => solid(new THREE.CylinderGeometry(r1, r0, len, 8));
    const addSpar = (a, c, r0, r1) => { const v = new THREE.Vector3().subVectors(c, a), len = v.length(), mesh = cyl(r0, r1, len); mesh.position.copy(a).addScaledVector(v, .5); mesh.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize()); cur.add(mesh); return mesh; };
    const yard = (x, y, len, r) => { const geo = new THREE.CylinderGeometry(r, r, len, 8, 6); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const f = 1 - .55 * Math.pow(Math.abs(p.getY(i)) / (len / 2), 2); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); } geo.computeVertexNormals(); const m = solid(geo); m.rotation.x = Math.PI / 2; m.position.set(x, y, 0); cur.add(m); };
    const crew = (x, y, half, n) => { for (let i = 0; i < n; i++) { const z = -half * .85 + (2 * half * .85) * (i + .5) / n; const man = solid(new THREE.CapsuleGeometry(.2, .9, 3, 6)); man.position.set(x + .5, y - .1, z); man.rotation.z = .5; cur.add(man); seg(V(x + .25, y - .9, -half), V(x + .25, y - .9, half)); } };

    // a sail between four corners, billowing along `dir`; mode 'square' or 'fore-aft'.
    // Drawn as cloth: every seam between the cloths, a line across every other row, and a bold edge.
    const sail = (c0, c1, c2, c3, dir, depth, mode, widthM) => {
      const nu = Math.max(8, Math.min(30, Math.round(widthM / 1.2))), nv = 18, P = [], W8 = [], UU = [], VV = [], I = [], LI = [], EI = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv;
        const top = c0.clone().lerp(c1, u), bot = c3.clone().lerp(c2, u), p = top.lerp(bot, v);
        if (mode === 'square') p.y += Math.sin(Math.PI * u) * v * v * .06 * (c0.y - c3.y); // roach: the foot curves up
        P.push(p.x, p.y, p.z); UU.push(u); VV.push(v);
        W8.push(mode === 'square' ? (1 - .8 * Math.pow(2 * u - 1, 2)) * Math.sin(Math.PI * v * .75) : Math.sin(Math.PI * Math.min(1, u * .85 + .05)) * Math.sin(Math.PI * Math.min(1, v * .8 + .1)));
      }
      const at = (i, j) => j * (nu + 1) + i;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = at(i, j); I.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2); }
      for (let i = 1; i < nu; i++) for (let j = 0; j < nv; j++) LI.push(at(i, j), at(i, j + 1)); // columns
      for (let j = 1; j < nv; j++) for (let i = 0; i < nu; i++) LI.push(at(i, j), at(i + 1, j)); // rows
      const DI = []; for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) DI.push(at(i + 1, j), at(i, j + 1)); // the diagonal of each quad: every triangle
      for (let i = 0; i < nu; i++) EI.push(at(i, 0), at(i + 1, 0), at(i, nv), at(i + 1, nv));
      for (let j = 0; j < nv; j++) EI.push(at(0, j), at(0, j + 1), at(nu, j), at(nu, j + 1));
      const posAttr = new THREE.Float32BufferAttribute(P, 3);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', posAttr); geo.setIndex(I);
      const mesh = new THREE.Mesh(geo, this.sailFill); mesh.userData.sail = true; cur.add(mesh);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', posAttr); lg.setIndex(LI); mesh.add(new THREE.LineSegments(lg, this.sailLine));
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', posAttr); dg.setIndex(DI); mesh.add(new THREE.LineSegments(dg, this.sailDiag));
      const eg = new THREE.BufferGeometry(); eg.setAttribute('position', posAttr); eg.setIndex(EI); mesh.add(new THREE.LineSegments(eg, this.sailEdge));
      for (const o of mesh.children) o.frustumCulled = false; mesh.frustumCulled = false;
      this.sails.push({ mesh, base: Float32Array.from(P), w: Float32Array.from(W8), u: Float32Array.from(UU), v: Float32Array.from(VV), dir, depth: depth * (mode === 'square' ? this.squareFill : 1), mode, corners: [at(0, 0), at(nu, 0), at(nu, nv), at(0, nv)], phase: Math.random() * 6.28 });
    };
    const furl = (x, y, len) => { const m = solid(new THREE.CapsuleGeometry(.32, len * .8, 4, 8)); m.rotation.x = Math.PI / 2; m.position.set(x + .3, y + .15, 0); cur.add(m); };

    const square = d.masts > 1 || cls.kind !== 'cutter';
    const fwdTop = []; // mast heads, for the stays
    mastsX.forEach((mx, mi) => {
      const Ht = Hm * heightF[mi], uM = mx / H.L2, base = deckY(uM), rake = mi === d.masts - 1 && d.masts > 1 ? -.04 : -.015;
      const Lm = Ht * .52, Lt = Ht * .32, Lg = Ht * .22, R0 = d.L / 100 * (mi === 1 || d.masts === 1 ? 1 : .88);
      const at = h => V(mx + rake * h, base + h, 0);
      const lowTop = Lm, topHeel = Lm * .86, topHead = topHeel + Lt, tgHeel = topHead - Lt * .12, tgHead = tgHeel + Lg;
      addSpar(at(-1), at(lowTop), R0, R0 * .78);
      addSpar(at(topHeel), at(topHead), R0 * .62, R0 * .42);
      if (!struck && square) addSpar(at(tgHeel), at(tgHead), R0 * .36, R0 * .2);
      const top = solid(new THREE.BoxGeometry(d.B * .26, .25, d.B * .42), { edges: true }); top.position.copy(at(lowTop * .97)); G.add(top);
      const xt = solid(new THREE.BoxGeometry(.3, .2, d.B * .2), { edges: true }); xt.position.copy(at(topHead - .4)); G.add(xt);
      fwdTop.push({ low: at(lowTop * .97), top: at(topHead), tg: at(struck ? topHead : tgHead), foot: at(1.2), x: mx });
      const ch = H.half(uM, H.rail(uM) - 1) + .5;
      for (const side of [-1, 1]) { const c = solid(new THREE.BoxGeometry(d.B * .5, .15, .9), { edges: true }); c.position.set(mx - .6, H.rail(uM) - 1.1, side * (ch - .2)); G.add(c); }
      const nShroud = d.masts === 1 ? 3 : mi === 1 ? 7 : 6;
      for (const side of [-1, 1]) {
        const feet = [], heads = [];
        for (let k = 0; k < nShroud; k++) { const fx = mx - d.B * .3 + k * (d.B * .45 / nShroud); feet.push(V(fx, H.rail(uM) - 1, side * ch)); heads.push(at(lowTop * .94).add(V(0, 0, side * R0 * 1.5))); }
        feet.forEach((f, k) => seg(heads[k], f));
        for (let h = .6; h < lowTop * .9; h += .55) for (let k = 0; k < nShroud - 1; k++) {
          const a = feet[k].clone().lerp(heads[k], h / (heads[k].y - feet[k].y)), c = feet[k + 1].clone().lerp(heads[k + 1], h / (heads[k + 1].y - feet[k + 1].y)); seg(a, c);
        }
        const tEdge = at(lowTop * .97).add(V(0, 0, side * d.B * .2));
        for (let k = 0; k < 4; k++) seg(at(topHead - .5).add(V(0, 0, side * R0)), tEdge.clone().add(V(-.8 + k * .5, 0, 0)));
        for (let k = 0; k < 2; k++) seg(at(topHead - .4), V(mx - d.B * .55 - k * 1.2, H.rail(uM) - .9, side * ch));
        if (!struck && square) seg(at(tgHead - .3), V(mx - d.B * .9, H.rail(uM) - .9, side * ch));
      }
      if (!square) return; // cutter: rigged below
      const mg = new THREE.Group(), sub = new THREE.Group(); mg.position.set(mx, 0, 0); sub.position.set(-mx, 0, 0); mg.rotation.y = -this.brace; mg.add(sub); G.add(mg);
      cur = sub; curLines = [];
      const isMizzen = d.masts === 3 && mi === 2, brigMain = d.masts === 2 && mi === 1;
      const Yc = d.L * .56 * yardF[mi], Yt = Yc * .74, Yg = Yc * .5;
      const courseY = base + lowTop * .9, topsailHoist = base + topHead - Lt * .12, tgY = base + tgHead - Lg * .12;
      const footC = base + 1.6;
      yard(mx + .35, courseY, Yc, R0 * .55);
      for (const side of [-1, 1]) { seg(at(lowTop + .3), V(mx + .35, courseY, side * Yc / 2)); seg(V(mx + .35, courseY, side * Yc / 2), V(mx - d.L * .12, H.rail(uM) + .3, side * d.B * .48)); }
      if (!isMizzen) {
        const f = set[0];
        if (f > 0) sail(V(mx + .5, courseY, -Yc * .46), V(mx + .5, courseY, Yc * .46), V(mx + .5, courseY - (courseY - footC) * f, Yc * .5), V(mx + .5, courseY - (courseY - footC) * f, -Yc * .5), V(1, 0, 0), 1.3, 'square', Yc);
        else furl(mx + .35, courseY, Yc);
        if (f > 0 && f < 1) crew(mx + .35, courseY, Yc / 2, 8);
      }
      { const f = set[1], yT = courseY + 1.2 + (topsailHoist - courseY - 1.2) * Math.max(f, .02);
        yard(mx + .3, yT, Yt, R0 * .4);
        if (f > 0) sail(V(mx + .45, yT, -Yt * .46), V(mx + .45, yT, Yt * .46), V(mx + .45, courseY + .6, Yc * .44), V(mx + .45, courseY + .6, -Yc * .44), V(1, 0, 0), 1.6, 'square', Yt);
        else furl(mx + .3, yT, Yt);
        if (f > 0 && f < 1) crew(mx + .3, yT, Yt / 2, 6);
        for (const side of [-1, 1]) seg(at(topHead - .2), V(mx + .3, yT, side * Yt / 2));
      }
      if (!struck) { const f = set[2], yG = f > 0 ? tgY : topsailHoist + 1.2;
        yard(mx + .25, yG, Yg, R0 * .3);
        if (f > 0) sail(V(mx + .35, yG, -Yg * .46), V(mx + .35, yG, Yg * .46), V(mx + .35, topsailHoist + .4, Yt * .44), V(mx + .35, topsailHoist + .4, -Yt * .44), V(1, 0, 0), 1.0, 'square', Yg);
        else furl(mx + .25, yG, Yg);
      }
      sub.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(curLines), this.ropeMat)); cur = G; curLines = null;
      if (isMizzen || brigMain) {
        const pv = new THREE.Group(), ps = new THREE.Group(); pv.position.set(mx, 0, 0); ps.position.set(-mx, 0, 0); pv.rotation.y = this.spankerSwing; pv.add(ps); G.add(pv); cur = ps;
        const f = set[3], throat = base + lowTop * .82, gaffLen = d.L * .22, boomLen = d.L * .3, boomY = base + 2.2;
        const peak = V(mx - gaffLen * .92, throat + gaffLen * .45, 0), boomEnd = V(mx - boomLen, boomY + .3, 0);
        addSpar(V(mx - .4, throat, 0), peak, .18, .12); addSpar(V(mx - .4, boomY, 0), boomEnd, .22, .16);
        if (f > 0) { const hgt = 1 - f; sail(V(mx - .5, throat, 0), peak.clone().lerp(V(mx - gaffLen, boomY, 0), hgt * .2), boomEnd, V(mx - .5, boomY + (throat - boomY) * hgt * .5, 0), V(0, 0, this.lee), 1.4, 'fore-aft', gaffLen); }
        seg(at(lowTop * .97), peak); cur = G;
      }
    });

    // bowsprit and jib-boom
    const stem = V(H.L2 - .3, H.rail(1) - .4, 0), bsDir = V(Math.cos(.38), Math.sin(.38), 0), bsLen = d.L * (d.masts === 1 ? .38 : .3);
    const bsEnd = stem.clone().addScaledVector(bsDir, bsLen), jbEnd = bsEnd.clone().addScaledVector(bsDir, bsLen * .7);
    addSpar(stem.clone().addScaledVector(bsDir, -3), bsEnd, d.L / 120, d.L / 200);
    if (d.masts > 1) addSpar(bsEnd.clone().addScaledVector(bsDir, -2), jbEnd, d.L / 260, d.L / 400);
    const fore = fwdTop[0];
    seg(fore.low, stem.clone().addScaledVector(bsDir, bsLen * .25)); seg(fore.top, bsEnd); seg(fore.tg, d.masts > 1 ? jbEnd : bsEnd);
    for (let i = 1; i < fwdTop.length; i++) { seg(fwdTop[i].low, fwdTop[i - 1].foot); seg(fwdTop[i].top, fwdTop[i - 1].low); seg(fwdTop[i].tg, fwdTop[i - 1].top); }
    seg(bsEnd, V(H.L2 - .5, -1, 0)); // bobstay
    const jibF = set[4];
    if (jibF > 0) {
      const tack1 = bsEnd.clone(), tack2 = d.masts > 1 ? jbEnd.clone() : bsEnd.clone();
      const head1 = fore.top.clone().lerp(tack1, .32), clew1 = V(stem.x - d.L * .1, H.rail(.75) + 2.5, 0);
      clew1.z = this.lee * d.L * .03; sail(head1, head1, tack1.clone().lerp(stem, .3), clew1, V(0, 0, this.lee), .6, 'fore-aft', d.L * .12);
      if (jibF >= 1 && d.masts > 1) { const head2 = fore.tg.clone().lerp(tack2, .42), clew2 = V(stem.x + d.L * .02, H.rail(.9) + 4.5, 0); clew2.z = this.lee * d.L * .04; sail(head2, head2, tack2, clew2, V(0, 0, this.lee), .6, 'fore-aft', d.L * .12); }
    }
    if (!square) {
      const m = fwdTop[0], throat = m.low.y - .5, boomY = deckY(.1) + 1.8, gaffLen = d.L * .42, boomLen = d.L * .62, f = Math.max(set[3], set[1] * .8);
      const peak = V(m.x - gaffLen * .9, throat + gaffLen * .45, 0), boomEnd = V(m.x - boomLen, boomY + .3, 0);
      const pv = new THREE.Group(), ps = new THREE.Group(); pv.position.set(m.x, 0, 0); ps.position.set(-m.x, 0, 0); pv.rotation.y = this.spankerSwing * .8; pv.add(ps); G.add(pv); cur = ps;
      addSpar(V(m.x - .3, throat, 0), peak, .2, .14); addSpar(V(m.x - .3, boomY, 0), boomEnd, .26, .18);
      if (f > 0) sail(V(m.x - .4, boomY + (throat - boomY) * (1 - f) * .6 + (throat - boomY) * f, 0), peak.clone().lerp(boomEnd, (1 - f) * .5), boomEnd, V(m.x - .4, boomY, 0), V(0, 0, this.lee), 1.6, 'fore-aft', gaffLen);
      cur = G;
    }
    // crew on deck
    for (let i = 0; i < Math.min(18, d.L / 3); i++) { const u = -.8 + Math.random() * 1.4, man = solid(new THREE.CapsuleGeometry(.22, 1.1, 3, 6)); man.position.set(u * H.L2, deckY(u) + .8, (Math.random() - .5) * d.B * .5); G.add(man); }
    // ensign at the stern, and a pennant at the main truck for warships: the design in line, no colour
    const fw = d.L * .2, fh = fw * .62, staff = V(-H.L2 - .6, H.rail(-1) + 1, 0);
    addSpar(staff, staff.clone().add(V(-.6, d.L * .16, 0)), .1, .06);
    const fgeo = new THREE.PlaneGeometry(fw, fh, 14, 8); fgeo.translate(fw / 2, -fh / 2, 0);
    const flag = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ map: lineFlag(cls.nat, year, cls), side: THREE.DoubleSide })); flag.userData.keep = true;
    flag.position.copy(staff).add(V(-.6, d.L * .16, 0)); flag.rotation.y = Math.PI;
    G.add(flag); this.flags.push({ mesh: flag, base: Float32Array.from(fgeo.attributes.position.array), w: fw });
    if (cls.navy && square) {
      const main = fwdTop[Math.min(1, fwdTop.length - 1)], pl = d.L * .35, pgeo = new THREE.PlaneGeometry(pl, .7, 20, 1); pgeo.translate(pl / 2, 0, 0);
      const pp = pgeo.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, pp.getY(i) * (1 - pp.getX(i) / pl * .9));
      const pen = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: INK, wireframe: true, transparent: true, opacity: .8 })); pen.userData.keep = true; pen.position.copy(main.tg).add(V(0, .5, 0)); pen.rotation.y = Math.PI; G.add(pen);
      this.flags.push({ mesh: pen, base: Float32Array.from(pgeo.attributes.position.array), w: pl });
    }
    G.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), this.ropeMat));
    G.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hullL), this.lineMat));
    // linework for every solid: box and plate edges as lines, round things by their silhouette
    const solids = []; G.traverse(o => { if (o.isMesh && o.material === this.fillMat) solids.push(o); });
    for (const o of solids) {
      if (o.userData.edges) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 20), this.lineMat));
      else if (!o.userData.noOutline) o.add(new THREE.Mesh(o.geometry, this.outlineMat));
    }
  }
  // the air: streaks with the wind felt on board, slowed and turned where they meet a sail
  resetAir() {
    const d = this.dim, Rb = Math.max(d.L, d.H) * .8, b = this.b;
    this.box = { R: Rb, y0: -d.T, y1: d.H * 1.08 };
    this.partsOn = this.calm ? 380 : Math.min(this.NP, 420 + b * 80);
    this.sprayOn = b >= 9 && !this.calm ? Math.min(this.NS, (b - 8) * 260) : 0;
    this.pv = new Float32Array(this.NP * 3); this.sv = new Float32Array(this.NS * 3);
    for (let i = 0; i < this.NP; i++) this.spawn(this.parts, this.pv, i, true, false);
    for (let i = 0; i < this.NS; i++) this.spawn(this.spray, this.sv, i, true, true);
  }
  spawn(arr, vel, i, anywhere, low) {
    const B = this.box, R = B.R, w = this.app.lengthSq() > .01 ? this.app.clone().setY(0).normalize() : new THREE.Vector3(1, 0, 0), perp = new THREE.Vector3(-w.z, 0, w.x);
    const s = (Math.random() * 2 - 1) * R, along = anywhere ? (Math.random() * 2 - 1) * R : -R * (.95 + Math.random() * .1);
    const y = low ? B.y0 + Math.pow(Math.random(), 2.2) * (B.y1 - B.y0) * .55 : B.y0 + Math.random() * (B.y1 - B.y0);
    const k = i * 6; arr[k] = perp.x * s + w.x * along; arr[k + 1] = y; arr[k + 2] = perp.z * s + w.z * along;
    arr[k + 3] = arr[k]; arr[k + 4] = arr[k + 1]; arr[k + 5] = arr[k + 2];
    vel[i * 3] = this.app.x; vel[i * 3 + 1] = 0; vel[i * 3 + 2] = this.app.z;
  }
  stepAir(t, dt) {
    const B = this.box; if (!B) return;
    // the sails as planes in world space, for the air to meet
    const planes = [], tmp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (const s of this.sails) { const p = s.mesh.geometry.attributes.position;
      s.corners.forEach((ci, n) => tmp[n].fromBufferAttribute(p, ci).applyMatrix4(s.mesh.matrixWorld));
      const c = tmp[0].clone().add(tmp[1]).add(tmp[2]).add(tmp[3]).multiplyScalar(.25), e1 = tmp[1].clone().sub(tmp[0]), e2 = tmp[3].clone().sub(tmp[0]);
      const n = e1.clone().cross(e2).normalize(), hw = Math.max(e1.length(), tmp[2].distanceTo(tmp[3])) / 2 + .5, hh = Math.max(e2.length(), tmp[2].distanceTo(tmp[1])) / 2 + .5;
      planes.push({ c, n, e1: e1.normalize(), e2: e2.normalize(), hw, hh }); }
    const A = this.app, sp = A.length(), calm = sp < .3, gust = 1 + .18 * Math.sin(t * .9) + .08 * Math.sin(t * 2.3);
    const run = (arr, vel, count, geo, isSpray) => {
      const P = geo.attributes.position.array, C = geo.attributes.color.array;
      for (let i = 0; i < count; i++) {
        const k = i * 6, j = i * 3; let x = arr[k], y = arr[k + 1], z = arr[k + 2], vx = vel[j], vy = vel[j + 1], vz = vel[j + 2];
        // relax towards the wind, with gusts and a little turbulence
        const tx = A.x * gust * (isSpray ? 1.1 : 1) + Math.sin(y * .25 + t * 1.7 + i) * (.6 + sp * .08), tz = A.z * gust * (isSpray ? 1.1 : 1) + Math.cos(x * .21 - t * 1.3 + i) * (.6 + sp * .08);
        const ty = calm ? Math.sin(t * .5 + i) * .15 : Math.sin(x * .17 + t * 2.1 + i * .3) * (.3 + sp * .04) - (isSpray ? 1.2 : 0);
        const rlx = Math.min(1, dt * (calm ? .6 : 1.6)); vx += (tx - vx) * rlx; vy += (ty - vy) * rlx; vz += (tz - vz) * rlx;
        if (!isSpray) for (const q of planes) {
          const rx = x - q.c.x, ry = y - q.c.y, rz = z - q.c.z, dn = rx * q.n.x + ry * q.n.y + rz * q.n.z;
          if (dn > 2.2 || dn < -2.2) continue;
          const a = rx * q.e1.x + ry * q.e1.y + rz * q.e1.z, bb = rx * q.e2.x + ry * q.e2.y + rz * q.e2.z;
          if (Math.abs(a) > q.hw || Math.abs(bb) > q.hh) continue;
          const vn = vx * q.n.x + vy * q.n.y + vz * q.n.z;
          if (vn * dn < 0) { // coming at the sail: the push goes into the cloth, the air spills along it
            vx -= q.n.x * vn * 1.05; vy -= q.n.y * vn * 1.05; vz -= q.n.z * vn * 1.05;
            const sa = Math.sign(a || 1) * Math.abs(vn) * .5; vx += q.e1.x * sa; vy += q.e1.y * sa; vz += q.e1.z * sa;
          }
        }
        x += vx * dt; y += vy * dt; z += vz * dt;
        const out = Math.abs(x) > B.R * 1.05 || Math.abs(z) > B.R * 1.05 || y < B.y0 - 1 || y > B.y1 + 2;
        if (out) { this.spawn(arr, vel, i, calm, isSpray); continue; }
        arr[k] = x; arr[k + 1] = y; arr[k + 2] = z; vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
        // a streak: bright at the head, fading to nothing at the tail; longer in a stronger wind
        const v = Math.hypot(vx, vy, vz) || 1, len = isSpray ? Math.min(.8, .25 + v * .02) : Math.min(4.5, .5 + v * .16);
        const fade = Math.min(1, (B.R * 1.05 - Math.max(Math.abs(x), Math.abs(z))) / (B.R * .25)), I = (isSpray ? .9 : calm ? .3 : Math.max(.28, .5 - this.b * .02)) * fade;
        P[k] = x; P[k + 1] = y; P[k + 2] = z; P[k + 3] = x - vx / v * len; P[k + 4] = y - vy / v * len; P[k + 5] = z - vz / v * len;
        C[k] = C[k + 1] = C[k + 2] = I; C[k + 3] = C[k + 4] = C[k + 5] = 0;
      }
      geo.setDrawRange(0, count * 2); geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    };
    run(this.parts, this.pv, this.partsOn, this.air.geometry, false);
    run(this.spray, this.sv, this.sprayOn, this.sprayLines.geometry, true);
  }
  frame() {
    const t = this.clock.getElapsedTime(), dt = Math.min(.05, t - this.lastT), b = this.b ?? 3, calm = this.calm || this.anchored;
    this.lastT = t;
    // the cloth: filled by the wind and breathing with the gusts, ripples running aft across it and the leeches
    // shaking; in a calm the sails hang slack and slat as the ship rolls
    const fill = calm ? .04 : .5 + Math.min(b, 8) * .14, ripple = calm ? .18 : .05 + Math.min(b, 10) * .02, fs = 3 + b * .7;
    for (const s of this.sails) {
      const p = s.mesh.geometry.attributes.position, B = s.base, ph = s.phase;
      const gust = 1 + .14 * Math.sin(t * (.8 + b * .08) + ph) + .07 * Math.sin(t * (2.1 + b * .15) + ph * 2);
      for (let i = 0; i < p.count; i++) {
        const u = s.u[i], v = s.v[i];
        const edge = s.mode === 'square' ? Math.max(0, 1 - Math.min(u, 1 - u) * 6) + Math.max(0, (v - .8) * 5) : Math.max(0, (u - .7) * 3.3) + Math.max(0, (v - .85) * 5);
        let k = s.w[i] * fill * gust * s.depth;
        k += ripple * (.25 + edge) * Math.sin(u * 7 + v * 3 - t * fs + ph) * (s.mode === 'square' ? 1 : u);
        k += .04 * Math.sin(u * 19 - v * 11 - t * fs * 1.7 + ph) * fill; // small wrinkles running across the cloth
        if (calm) k += .5 * Math.sin(t * .6 + ph) * v * v; // slatting
        p.setXYZ(i, B[i * 3] + s.dir.x * k, B[i * 3 + 1], B[i * 3 + 2] + s.dir.z * k);
      }
      p.needsUpdate = true;
    }
    // flags stream with the wind felt on board
    if (this.app) {
      const local = this.app.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw.rotation.y), flap = calm ? .1 : .5 + b * .12;
      const dir = Math.atan2(-local.z, local.x) + Math.PI;
      for (const f of this.flags) {
        f.mesh.rotation.y = calm ? Math.PI : dir + Math.sin(t * 1.7) * .05 + Math.PI;
        const p = f.mesh.geometry.attributes.position, B = f.base;
        for (let i = 0; i < p.count; i++) { const x = B[i * 3], r = x / f.w; p.setZ(i, B[i * 3 + 2] + Math.sin(x * .9 - t * (3 + b * .5)) * r * flap * (calm ? .2 : 1)); if (calm) p.setY(i, B[i * 3 + 1] - r * r * f.w * .45); }
        p.needsUpdate = true;
      }
    }
    // the ship heels to leeward under sail and rolls a little (no sea is drawn: only the motion it gives)
    if (this.dim) {
      const roll = (.008 + b * .006) * Math.sin(t * .7), pitch = (.003 + b * .002) * Math.sin(t * .55 + 1);
      this.ship.rotation.x = (this.heel || 0) + roll; this.ship.rotation.z = pitch;
      this.scene.updateMatrixWorld(true);
      this.stepAir(t, dt);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
window.ShipModel = ShipModel;
window.dispatchEvent(new Event('shipmodel-ready'));
})();
