/**
 * Run `myst build --typst` over the fixtures and keep everything it says.
 *
 * The point is not to adopt mystmd. It is to see what its converter drops from
 * a Docusaurus-flavoured document, and to read the Typst it writes.
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(ROOT, "fixtures");
const OUT = path.join(ROOT, "out");
// mystmd rewrites its input directory, so it gets a copy to work in.
const WORK = path.join(OUT, "work");

await rm(WORK, { recursive: true, force: true });
await mkdir(WORK, { recursive: true });
await cp(FIXTURES, WORK, { recursive: true });

// A project file, so the CLI does not ask anything.
await writeFile(
  path.join(WORK, "myst.yml"),
  `version: 1
project:
  title: reference check
site:
  template: book-theme
`,
);

// Each fixture is built on its own, into its own output file. Without an
// explicit file list the CLI only builds documents that declare an export.
const files = (await readdir(FIXTURES)).filter((f) => /\.mdx?$/.test(f)).sort();
const log = [];

for (const file of files) {
  process.stderr.write(`\n=== ${file} ===\n`);
  let stdout = "";
  let stderr = "";
  let failed = false;
  try {
    const res = await run(
      path.join(ROOT, "node_modules", ".bin", "myst"),
      ["build", "--typst", "--force", "-o", `${path.parse(file).name}.typ`, file],
      { cwd: WORK, maxBuffer: 32 * 1024 * 1024 },
    );
    stdout = res.stdout;
    stderr = res.stderr;
  } catch (err) {
    // A missing typst CLI fails the PDF step after the .typ file is written.
    failed = true;
    stdout = err.stdout ?? "";
    stderr = `${err.stderr ?? ""}\n${err.message}`;
  }
  process.stderr.write(stderr || stdout);
  log.push({ file, failed, stdout, stderr });
}

// Collect whatever Typst it produced.
// The template files ship with mystmd; only the converted documents matter.
const TEMPLATE_FILES = ["frontmatter.typ", "lapreprint.typ", "myst-imports.typ", "template.typ"];
const typst = (await readdir(WORK))
  .filter((f) => f.endsWith(".typ") && !TEMPLATE_FILES.includes(f))
  .map((f) => path.join(WORK, f));

await mkdir(path.join(OUT, "typst"), { recursive: true });
for (const file of typst) {
  const dest = path.join(OUT, "typst", path.basename(file));
  await cp(file, dest);
  const lines = (await readFile(file, "utf8")).split("\n").length;
  console.log(`${path.relative(WORK, file).padEnd(50)} ${String(lines).padStart(5)} 行`);
}

await writeFile(path.join(OUT, "myst-log.json"), JSON.stringify(log, null, 2) + "\n");
console.log(`\n${typst.length} ファイル。ログは out/myst-log.json`);
