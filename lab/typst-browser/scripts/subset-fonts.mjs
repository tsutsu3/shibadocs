/**
 * Build the subset tiers used by the measurement.
 *
 * Typst reads TrueType and OpenType. It does not read woff2, so the shipped
 * file is a .ttf and the saving comes from HTTP compression. The woff2 column
 * is kept as a reference point for what a plain web font would cost.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = path.join(ROOT, "assets", "fonts");
const DATA = path.join(ROOT, "data");
const OUT = path.join(ROOT, "public", "fonts");
// pyftsubset reads the character set from a file. It is an intermediate, so it
// must not land in public/ and be published with the fonts.
const TMP = path.join(ROOT, ".cache");
const PY = path.join(ROOT, ".venv", "bin", "python");

/** Subset tiers, from smallest to largest. */
const TIERS = [
  { id: "kana", sets: ["base.txt"] },
  { id: "joyo", sets: ["base.txt", "joyo.txt"] },
  { id: "joyo-jinmeiyo", sets: ["base.txt", "joyo.txt", "jinmeiyo.txt"] },
];

const FACES = ["NotoSansJP-Regular.ttf", "NotoSansJP-Bold.ttf"];

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function charsOf(sets) {
  let out = "";
  // Only the trailing newline is dropped. U+0020 is the first character of
  // base.txt, and a plain trim() would eat it.
  for (const s of sets) out += (await readFile(path.join(DATA, s), "utf8")).replace(/\n$/, "");
  return out;
}

/** Compress with the settings a CDN uses for static assets. */
function compressedSizes(buf) {
  return {
    gzip: gzipSync(buf, { level: 9 }).length,
    brotli: brotliCompressSync(buf, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
      },
    }).length,
  };
}

await mkdir(OUT, { recursive: true });
await mkdir(TMP, { recursive: true });
const rows = [];

for (const face of FACES) {
  const src = path.join(FONTS, face);
  const base = face.replace(/\.ttf$/, "");

  for (const tier of TIERS) {
    const text = await charsOf(tier.sets);
    const textFile = path.join(TMP, `${tier.id}.txt`);
    await writeFile(textFile, text);

    for (const flavor of ["ttf", "woff2"]) {
      const out = path.join(OUT, `${base}-${tier.id}.${flavor}`);
      const args = [
        "-m", "fontTools.subset", src,
        `--text-file=${textFile}`,
        "--layout-features=kern,liga,clig,palt,halt,vert,vrt2,ccmp,locl",
        "--drop-tables+=DSIG",
        "--name-IDs=*",
        "--notdef-outline",
        `--output-file=${out}`,
      ];
      if (flavor !== "ttf") args.push(`--flavor=${flavor}`);
      execFileSync(PY, args, { stdio: "pipe" });
      const buf = await readFile(out);
      const sizes = compressedSizes(buf);
      rows.push({
        face: base, tier: tier.id, flavor,
        chars: [...text].length,
        raw: buf.length, ...sizes,
      });
    }
  }

  // The unsubsetted static instance, for comparison.
  const buf = await readFile(src);
  rows.push({
    face: base, tier: "full", flavor: "ttf",
    chars: null, raw: buf.length, ...compressedSizes(buf),
  });
}

await writeFile(
  path.join(ROOT, "results", "font-sizes.json"),
  JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2) + "\n",
);

const W = [22, 15, 8, 8, 10, 10, 10];
const line = (cells) => cells.map((c, i) => String(c).padEnd(W[i])).join("");
console.log(line(["face", "tier", "flavor", "chars", "raw", "gzip", "brotli"]));
for (const r of rows) {
  console.log(line([r.face, r.tier, r.flavor, r.chars ?? "-", kb(r.raw), kb(r.gzip), kb(r.brotli)]));
}
