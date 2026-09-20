/**
 * Copy the typst.ts wasm modules into public/wasm.
 *
 * The harness fetches them by URL instead of letting the bundler inline them.
 * That is how a CDN would serve them, and it makes the transfer measurable.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "wasm");

const MODULES = [
  "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
  "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
];

await mkdir(OUT, { recursive: true });
for (const id of MODULES) {
  const [scope, name, ...rest] = id.split("/");
  const pkg = `${scope}/${name}`;
  const src = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), ...rest);
  const dest = path.join(OUT, path.basename(src));
  await copyFile(src, dest);
  console.log(`${path.basename(dest).padEnd(34)} ${((await stat(dest)).size / 1048576).toFixed(2)} MB`);
}
