// Check that the page's model (sim-core.js) gives the same answers as the Python tool.
// Runs tools/simulate_cistern.py on Sifnos for a few settings and compares the share of use met.
// Usage (from the sketch folder): node tools/check_page_sim.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ctx = {};
vm.runInNewContext(readFileSync(path.join(root, "sim-core.js"), "utf8"), ctx);
const { simulate, days, orthodoxEaster, schoolDay } = ctx.SimCore;
const rain = JSON.parse(readFileSync(path.join(root, "data/page/sifnos_rain_daily.json"), "utf8"));

let bad = 0;
for (const [roof, tank, use] of [[100, 10, 150], [80, 30, 150], [150, 5, 66]]) {
  const out = execFileSync("python3", ["tools/simulate_cistern.py", "--island", "Sifnos",
    "--roof", String(roof), "--tank", String(tank), "--use", String(use), "--no-write"], { cwd: root, encoding: "utf8" });
  const py = +out.match(/WSE ([\d.]+)%/)[1];
  const js = 100 * simulate(rain.mm, { roof, tank, need: use }).share;
  const ok = Math.abs(js - py) < 0.2;
  if (!ok) bad++;
  console.log(`roof ${roof} tank ${tank} use ${use}: python ${py.toFixed(1)}%, page ${js.toFixed(1)}% ${ok ? "ok" : "DIFFERENT"}`);
}
// Orthodox Easter spot checks (known dates)
for (const [y, iso] of [[2023, "2023-04-16"], [2024, "2024-05-05"], [2025, "2025-04-20"]]) {
  const got = orthodoxEaster(y).toISOString().slice(0, 10);
  if (got !== iso) { bad++; console.log(`Easter ${y}: ${got}, expected ${iso}`); }
}
const d = days(rain.start, rain.mm.length);
const term = d.filter(schoolDay).length / (d.length / 365.25);
console.log(`school days per year (approximate calendar): ${term.toFixed(0)}`);
console.log(bad ? `${bad} problem(s)` : "OK");
process.exit(bad ? 1 : 0);
