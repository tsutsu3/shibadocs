/**
 * Headless run of the harness, for numbers that do not depend on a hand test.
 *
 * Chromium throttles the network through CDP, so the measured time includes a
 * realistic transfer of the 6.9 MB (brotli) compiler wasm. Each tier is run
 * cold (empty IndexedDB, empty HTTP cache) and warm (IndexedDB hit).
 *
 * The hand test still decides the gate. This only produces the numbers.
 *
 * Usage: node scripts/measure.mjs [--url http://localhost:5273]
 *                                 [--tiers joyo] [--profiles local,office,mobile]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const BASE = flag("url", "http://localhost:5273");
const TIERS = flag("tiers", "kana,joyo,joyo-jinmeiyo").split(",");

/** Download rate and latency, as seen by the page. */
const PROFILES = {
  // No throttling. The floor: everything except the transfer.
  local: null,
  // A wired office line.
  office: { mbps: 40, latencyMs: 20 },
  // A good mobile line, or a busy cafe.
  mobile: { mbps: 10, latencyMs: 70 },
};
const USE = flag("profiles", "local,office,mobile").split(",");

const browser = await chromium.launch();

/** Load the page once and read the report the harness exposes. */
async function run(context, { tier, profile }) {
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const p = PROFILES[profile];
  if (p) {
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: p.latencyMs,
      downloadThroughput: (p.mbps * 1e6) / 8,
      uploadThroughput: (p.mbps * 1e6) / 8,
    });
  }

  await page.goto(`${BASE}/?tier=${tier}&cache=1`, { waitUntil: "commit" });
  await page.waitForFunction(
    () => window.__metrics?.firstPreviewMs !== undefined || window.__metrics?.error,
    null,
    { timeout: 300_000 },
  );

  // Type once, to measure the edit loop.
  await page.focus("#editor");
  await page.type("#editor", "\n追記: 計測用の一行。", { delay: 20 });
  await page
    .waitForFunction(() => window.__metrics.recompileMs.length > 0, null, { timeout: 120_000 })
    .catch(() => {});

  const report = await page.evaluate(() => window.__metrics);
  await page.close();
  return report;
}

const results = [];
const ms = (n) => `${n.toFixed(0)} ms`;

for (const profile of USE) {
  for (const tier of TIERS) {
    // A fresh context: empty IndexedDB, empty HTTP cache.
    const context = await browser.newContext();
    const cold = await run(context, { tier, profile });
    // Same context, so IndexedDB now holds the wasm and the font.
    const warm = await run(context, { tier, profile });
    await context.close();

    results.push({ profile, tier, cold, warm });
    const fmt = (r) => (r.error ? `ERROR ${r.error}` : ms(r.firstPreviewMs));
    const edit = cold.recompileMs.length ? ms(cold.recompileMs.at(-1)) : "—";
    console.log(
      `${profile.padEnd(8)} ${tier.padEnd(15)} ` +
        `編集可=${ms(cold.editorReadyMs).padEnd(9)} ` +
        `初回=${fmt(cold).padEnd(10)} 2回目=${fmt(warm).padEnd(10)} 再コンパイル=${edit}`,
    );
  }
}

await browser.close();
await writeFile(
  path.join(ROOT, "results", "browser-timings.json"),
  JSON.stringify({ measuredAt: new Date().toISOString(), base: BASE, profiles: PROFILES, results }, null, 2) + "\n",
);
console.log("\nwrote results/browser-timings.json");
