// The cistern model, with no page code, so tools/check_page_sim.mjs can test it against
// tools/simulate_cistern.py. Same rule as the Python default: each day the tank fills with
// roof rain (spilling what does not fit), then the day's use is drawn from it.
(function (root) {
  "use strict";

  // Daily tank balance. mm: daily rain; need: litres needed that day (array or number).
  // Returns totals and, if keep is true, the tank level and supply for every day.
  function simulate(mm, { roof, tank, need, runoff = 0.8, factor = 1, start = 0, keep = false }) {
    let s = start, supplied = 0, demand = 0, short = 0;
    const n = mm.length;
    const level = keep ? new Float32Array(n) : null;
    const got = keep ? new Float32Array(n) : null;
    for (let i = 0; i < n; i++) {
      const inflow = roof * runoff * (mm[i] || 0) * factor / 1000;   // m3
      const d = (typeof need === "number" ? need : need[i]) / 1000;   // m3
      s = Math.min(tank, s + inflow);
      const y = Math.min(s, d);
      s -= y;
      supplied += y;
      demand += d;
      if (y < d - 1e-9) short++;
      if (keep) { level[i] = s; got[i] = y; }
    }
    return { supplied, demand, share: demand ? supplied / demand : 0, short, level, got };
  }

  // Dates for each day from an ISO start date.
  function days(startIso, n) {
    const t0 = Date.UTC(+startIso.slice(0, 4), +startIso.slice(5, 7) - 1, +startIso.slice(8, 10));
    return Array.from({ length: n }, (_, i) => new Date(t0 + i * 86400000));
  }

  // Orthodox Easter Sunday (Gregorian date), valid 1900-2099.
  function orthodoxEaster(y) {
    const a = y % 4, b = y % 7, c = y % 19;
    const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
    return new Date(Date.UTC(y, month - 1, day) + 13 * 86400000);
  }

  // An approximate Greek school calendar: weekdays only; no school from 15 June to
  // 10 September, 24 December to 7 January, or Holy Week to the Sunday after Easter.
  // A simplification (synthetic), not the official calendar of any year.
  function schoolDay(dt) {
    const wd = dt.getUTCDay(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    if (wd === 0 || wd === 6) return false;
    const md = m * 100 + d;
    if (md >= 615 && md <= 910) return false;
    if (md >= 1224 || md <= 107) return false;
    const easter = orthodoxEaster(dt.getUTCFullYear()).getTime();
    const t = dt.getTime();
    if (t >= easter - 6 * 86400000 && t <= easter + 7 * 86400000) return false;
    return true;
  }

  root.SimCore = { simulate, days, orthodoxEaster, schoolDay };
})(typeof window !== "undefined" ? window : globalThis);
