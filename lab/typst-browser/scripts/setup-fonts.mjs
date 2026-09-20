/**
 * Download Noto Sans JP and build a static Regular instance.
 *
 * Google Fonts ships Noto Sans JP as a variable font. Typst reads static
 * TrueType and OpenType files, so the variable axis is pinned to wght=400
 * with the fonttools instancer.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = path.join(ROOT, "assets", "fonts");
const PY = path.join(ROOT, ".venv", "bin", "python");

const SOURCES = [
  {
    name: "NotoSansJP[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf",
    instances: [
      { out: "NotoSansJP-Regular.ttf", axes: ["wght=400"] },
      { out: "NotoSansJP-Bold.ttf", axes: ["wght=700"] },
    ],
  },
  {
    name: "NotoSerifJP[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf",
    instances: [{ out: "NotoSerifJP-Regular.ttf", axes: ["wght=400"] }],
  },
];

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

await mkdir(FONTS, { recursive: true });

for (const src of SOURCES) {
  const file = path.join(FONTS, src.name);
  if (!existsSync(file)) {
    process.stderr.write(`downloading ${src.name}\n`);
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`fetch failed: ${src.url} ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  console.log(`${src.name.padEnd(24)} ${mb((await stat(file)).size)}`);

  for (const inst of src.instances) {
    const out = path.join(FONTS, inst.out);
    if (!existsSync(out)) {
      process.stderr.write(`instancing ${inst.out}\n`);
      execFileSync(
        PY,
        ["-m", "fontTools.varLib.instancer", file, ...inst.axes, "-o", out],
        { stdio: "pipe" },
      );
    }
    console.log(`${inst.out.padEnd(24)} ${mb((await stat(out)).size)}`);
  }
}
