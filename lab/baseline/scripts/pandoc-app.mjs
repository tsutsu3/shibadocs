/**
 * Convert the sample with pandoc.org/app, the way a user would.
 *
 * The app runs pandoc as wasm in the browser and, for PDF, lazy-loads Typst.
 * No options are changed from their defaults: the point is what someone gets
 * by dropping a Japanese Markdown file in and pressing Convert.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "input", "sample.md");
const OUT = path.join(ROOT, "out");
const NAME = "pandoc-app";

// There is no way to hand Typst a Japanese font from the UI. The app's only
// font upload field belongs to the EPUB options ("Embed fonts"), and the PDF
// path loads typst-assets fonts (Libertinus, New Computer Modern, DejaVu).

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
const log = [];
page.on("console", (m) => log.push(`[${m.type()}] ${m.text()}`));

await page.goto("https://pandoc.org/app/", { waitUntil: "networkidle", timeout: 60_000 });

// Same as dropping the file on the page. The first file input on the page
// belongs to the examples bar (.zip only); the main drop zone is the one that
// takes several files and has no accept filter.
await page.locator('input[type="file"][multiple]:not([accept])').first().setInputFiles(INPUT);
await page.waitForFunction(() => !document.querySelector(".convert-btn")?.disabled, null, {
  timeout: 60_000,
});
await page.selectOption("#output-format", "pdf");

// Convert produces a "Download sample.pdf" button rather than a download.
const t0 = Date.now();
await page.getByRole("button", { name: "Convert" }).click();
const button = page.getByRole("button", { name: /Download .*\.pdf/ });
await button.waitFor({ timeout: 300_000 });
const seconds = ((Date.now() - t0) / 1000).toFixed(1);

const download = page.waitForEvent("download", { timeout: 60_000 });
await button.click();
const file = await download;

const dest = path.join(OUT, `${NAME}.pdf`);
await file.saveAs(dest);
await writeFile(path.join(OUT, `${NAME}.log`), log.join("\n") + "\n");

console.log(`${dest}  (${seconds}s, suggested name: ${file.suggestedFilename()})`);
await browser.close();
