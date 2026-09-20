/**
 * Check that a subset covers every character of the sample documents.
 *
 * A missing glyph is not an error in Typst. It renders as a blank box, so the
 * gap only shows up in the PDF. The check has to be explicit.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(ROOT, "public", "samples");
const FONTS = path.join(ROOT, "public", "fonts");
const PY = path.join(ROOT, ".venv", "bin", "python");

function cmapOf(file) {
  const out = execFileSync(PY, [path.join(ROOT, "scripts", "dump_cmap.py"), file], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return new Set(out.trim().split("\n").map((h) => parseInt(h, 16)));
}

/** Drop Typst comments. Their characters are never drawn. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Every character the samples ask the font to draw.
const sampleFiles = (await readdir(SAMPLES)).filter((f) => f.endsWith(".typ"));
const wanted = new Map();
for (const f of sampleFiles) {
  const text = stripComments(await readFile(path.join(SAMPLES, f), "utf8"));
  for (const ch of text) {
    if (ch === "\n" || ch === "\r" || ch === "\t") continue;
    if (!wanted.has(ch)) wanted.set(ch, f);
  }
}

const fonts = (await readdir(FONTS))
  .filter((f) => f.endsWith(".ttf") && f.includes("Regular"))
  .sort();

const report = [];
for (const font of fonts) {
  const cmap = cmapOf(path.join(FONTS, font));
  const missing = [...wanted.keys()].filter((ch) => !cmap.has(ch.codePointAt(0)));
  report.push({ font, glyphs: cmap.size, missing });
  const verdict = missing.length === 0 ? "OK" : `MISSING ${missing.length}`;
  console.log(`${font.padEnd(40)} cmap=${String(cmap.size).padStart(6)}  ${verdict}`);
  if (missing.length > 0) {
    console.log(`  ${missing.map((c) => `${c} U+${c.codePointAt(0).toString(16).toUpperCase()}`).join("  ")}`);
  }
}

console.log(`\nsample characters: ${wanted.size} distinct, from ${sampleFiles.join(", ")}`);
await writeFile(
  path.join(ROOT, "results", "coverage.json"),
  JSON.stringify({ measuredAt: new Date().toISOString(), distinct: wanted.size, report }, null, 2) + "\n",
);
