/**
 * Put the Typst compiler wasm into R2, brotli-compressed.
 *
 * Static assets cannot hold it: the file is 27.01 MiB and the per-file limit
 * is 25 MiB. The limit applies to the stored file, so the compressed copy
 * would fit, but a static asset cannot be served precompressed: the asset
 * server compresses the stored bytes again and declares only one layer.
 *
 * Compressing here rather than at the edge is worth about 2.5 MiB. Quality 11
 * gives 6.88 MiB, while the edge produces roughly 9.4 MiB on the fly.
 *
 * Usage: node scripts/upload-wasm.mjs [--local] [--bucket <name>]
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { brotliCompressSync, constants } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "wasm", "typst_ts_web_compiler_bg.wasm");
const CACHE = path.join(ROOT, ".cache", "typst_ts_web_compiler_bg.wasm.br");

const argv = process.argv.slice(2);
const LOCAL = argv.includes("--local");
const bucketFlag = argv.indexOf("--bucket");
const BUCKET = bucketFlag === -1 ? "shibadocs-lab-wasm" : argv[bucketFlag + 1];
const KEY = "typst_ts_web_compiler_bg.wasm";

const mb = (n) => `${(n / 1048576).toFixed(2)} MiB`;

if (!existsSync(SOURCE)) {
  console.error(`${SOURCE} がありません。先に: pnpm lab wasm`);
  process.exit(1);
}

// Reuse the compressed copy while the source is older than it. Brotli at
// quality 11 on 27 MiB takes about a minute.
const src = await stat(SOURCE);
if (!existsSync(CACHE) || (await stat(CACHE)).mtimeMs < src.mtimeMs) {
  const buf = await readFile(SOURCE);
  process.stderr.write(`brotli で圧縮します（${mb(buf.length)}、1分ほどかかる）\n`);
  const out = brotliCompressSync(buf, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  });
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, out);
}

console.log(`${mb(src.size)} → ${mb((await stat(CACHE)).size)}  (${LOCAL ? "local" : "remote"})`);

execFileSync(
  path.join(ROOT, "node_modules", ".bin", "wrangler"),
  [
    "r2", "object", "put", `${BUCKET}/${KEY}`,
    "--file", CACHE,
    "--content-type", "application/wasm",
    "--content-encoding", "br",
    // Read back by the Worker and handed to Workers Cache, which keeps the
    // response for as long as this says.
    "--cache-control", "public, max-age=31536000, immutable",
    LOCAL ? "--local" : "--remote",
  ],
  { stdio: "inherit", cwd: ROOT },
);

console.log("\n差し替えたら pnpm lab cf:deploy も回すこと。" +
  "\nキャッシュは Worker のバージョン単位なので、デプロイで古い版が切れる。");
