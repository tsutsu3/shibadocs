/**
 * Try tex-to-typst on the kind of math a Japanese design document contains.
 *
 * The package is at 0.0.x and does not claim full coverage. What matters is
 * how it fails: silently, or in a way we can turn into a warning.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { texToTypst } from "tex-to-typst";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Commands confirmed to convert correctly by this script.
 *
 * The package gives no way to ask what it supports. `typstMacros` (972),
 * `typstEnvs` (9) and `typstStrings` (6) are the only tables it exports, and
 * they are keyed by Typst or unicode-math names, not by LaTeX commands:
 * `sigma` and `lim` are absent from all three although both convert fine. The
 * LaTeX names live in a `symbols` table that is not exported, and the rest are
 * special cases inside the writer.
 *
 * So the list has to be ours, and it has to be earned one command at a time.
 */
const SUPPORTED = new Set([
  "frac", "sqrt", "cdot", "times", "sum", "int", "infty", "lim", "to",
  "text", "left", "right", "quad", "overline", "underline",
  "alpha", "beta", "gamma", "sigma", "mu", "pi", "theta", "lambda",
  "begin", "end", "pmatrix", "bmatrix", "matrix", "cases", "align",
]);

/**
 * Find commands outside the list above.
 *
 * The converter never throws and never reports a failure, so an unsupported
 * command comes back as plausible-looking garbage: `\\ce{H2O}` becomes
 * `ce H 2 O`. Checking the input is the only way to warn.
 */
function unsupported(tex) {
  const used = [...tex.matchAll(/\\([a-zA-Z]+)/g)].map((m) => m[1]);
  const envs = [...tex.matchAll(/\\(?:begin|end)\{([a-zA-Z*]+)\}/g)].map((m) => m[1]);
  return [...new Set([...used, ...envs])].filter((name) => !SUPPORTED.has(name));
}

/** [label, LaTeX] pairs, from plain to unlikely. */
const CASES = [
  ["四則", String.raw`r = C / I`],
  ["分数", String.raw`\frac{C}{I}`],
  ["平方根と添字", String.raw`S = z \cdot \sigma_L \cdot \sqrt{L}`],
  ["総和", String.raw`\sum_{i=1}^{n} x_i`],
  ["積分", String.raw`\int_0^\infty e^{-x} dx`],
  ["行列", String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`],
  ["場合分け", String.raw`f(x) = \begin{cases} 1 & x > 0 \\ 0 & \text{otherwise} \end{cases}`],
  ["整列", String.raw`\begin{align} a &= b \\ c &= d \end{align}`],
  ["テキスト混在", String.raw`x = \text{在庫数} \times 2`],
  ["演算子", String.raw`\lim_{n \to \infty} a_n = \alpha`],
  ["括弧の自動調整", String.raw`\left( \frac{a}{b} \right)^2`],
  ["上下線", String.raw`\overline{AB} \quad \underline{CD}`],
  ["色（LaTeX 拡張）", String.raw`\textcolor{red}{x}`],
  ["自作マクロ", String.raw`\myMacro{x}`],
  ["単位（siunitx）", String.raw`\SI{3}{\kilo\gram}`],
  ["化学式（mhchem）", String.raw`\ce{H2O}`],
];

const rows = [];
for (const [label, tex] of CASES) {
  let typst = "";
  let macros;
  let error;
  try {
    // The call returns { value, macros }. `macros` lists the helper
    // definitions the output needs, which the caller has to emit itself.
    const res = texToTypst(tex);
    typst = res.value;
    macros = res.macros;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  rows.push({ label, tex, typst, macros, error, unsupported: unsupported(tex) });
}

const width = Math.max(...rows.map((r) => [...r.label].length)) + 2;
for (const r of rows) {
  const pad = r.label + "　".repeat(Math.max(0, width - [...r.label].length));
  const flags = [];
  if (r.macros && Object.keys(r.macros).length) flags.push(`要マクロ: ${Object.keys(r.macros).join(", ")}`);
  if (r.unsupported.length) flags.push(`★未対応: ${r.unsupported.map((u) => `\\${u}`).join(" ")}`);
  const tail = flags.length ? `   （${flags.join(" / ")}）` : "";
  console.log(`${pad}${r.error ? `⛔ ${r.error}` : r.typst}${tail}`);
}

await writeFile(
  path.join(ROOT, "out", "tex-to-typst.json"),
  JSON.stringify({ version: "0.0.22", rows }, null, 2) + "\n",
);
