/**
 * Static server for the built harness.
 *
 * Vite's own preview server sends everything uncompressed, which makes the
 * 27 MB wasm look far worse than it is on a CDN. This server precompresses
 * with brotli and can throttle the connection, so the measured numbers match
 * what a user on a normal line would see.
 *
 * Usage: node scripts/serve.mjs [--port 5273] [--mbps 40] [--no-brotli]
 */
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { brotliCompressSync, constants } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CACHE = path.join(ROOT, ".serve-cache");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const PORT = Number(flag("port", 5273));
const MBPS = Number(flag("mbps", 0));
const USE_BROTLI = !argv.includes("--no-brotli");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".typ": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};

if (!existsSync(DIST)) {
  console.error("dist/ is missing. Run: pnpm build");
  process.exit(1);
}

/** Walk dist and write a .br next to every compressible file. */
async function precompress(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await precompress(full);
      continue;
    }
    const rel = path.relative(DIST, full);
    const out = path.join(CACHE, `${rel}.br`);
    const src = await stat(full);
    if (src.size < 1024) continue;
    if (existsSync(out) && (await stat(out)).mtimeMs >= src.mtimeMs) continue;
    const buf = await readFile(full);
    await mkdir(path.dirname(out), { recursive: true });
    process.stderr.write(`compressing ${rel} (${(src.size / 1048576).toFixed(1)} MB)\n`);
    await writeFile(
      out,
      brotliCompressSync(buf, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
        },
      }),
    );
  }
}

/** Is something already listening on this port? */
function portInUse(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", (err) => resolve(err.code === "EADDRINUSE"));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(port);
  });
}

// Checked before compressing, so a busy port fails in a second and not after
// 27 MB of brotli.
if (await portInUse(PORT)) {
  console.error(
    `ポート ${PORT} は使用中です。既に serve が動いている可能性があります。\n` +
      `  使っているプロセス: ss -lptn 'sport = :${PORT}'\n` +
      `  止める:             kill $(ss -lptn 'sport = :${PORT}' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)\n` +
      `  別のポートで動かす:   pnpm lab serve --port ${PORT + 1}`,
  );
  process.exit(1);
}

if (USE_BROTLI) {
  // Only the files that changed since the last run are compressed. After a
  // fresh build that is everything, which takes about a minute for 30 MB.
  process.stderr.write("brotli で事前圧縮します（変更のあったファイルのみ）\n");
  await precompress(DIST);
}

/** Write a buffer at a fixed bit rate, to imitate a real line. */
async function sendThrottled(res, file, mbps) {
  const chunkMs = 50;
  const chunkBytes = Math.max(4096, Math.floor(((mbps * 1e6) / 8) * (chunkMs / 1000)));
  const stream = createReadStream(file, { highWaterMark: chunkBytes });
  for await (const chunk of stream) {
    if (!res.write(chunk)) await new Promise((r) => res.once("drain", r));
    await new Promise((r) => setTimeout(r, chunkMs));
  }
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let rel = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "index.html";
    let file = path.join(DIST, rel);
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || (await stat(file)).isDirectory()) {
      file = path.join(DIST, "index.html");
      rel = "index.html";
    }

    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    // No caching: every reload has to be a cold load unless IndexedDB served it.
    const headers = { "content-type": type, "cache-control": "no-store" };

    const br = path.join(CACHE, `${rel}.br`);
    const acceptsBr = (req.headers["accept-encoding"] ?? "").includes("br");
    // A .br older than its source is stale: the page was rebuilt after the
    // server started. Serving it would hand the browser the previous build.
    const brIsFresh =
      existsSync(br) && (await stat(br)).mtimeMs >= (await stat(file)).mtimeMs;
    let body = file;
    if (USE_BROTLI && acceptsBr && brIsFresh) {
      body = br;
      headers["content-encoding"] = "br";
      headers.vary = "accept-encoding";
    }

    headers["content-length"] = String((await stat(body)).size);
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    if (MBPS > 0) await sendThrottled(res, body, MBPS);
    else createReadStream(body).pipe(res);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.on("error", (err) => {
  console.error(`サーバを起動できません: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, () => {
  const rate = MBPS > 0 ? `${MBPS} Mbps` : "制限なし";
  console.log(`http://localhost:${PORT}  brotli=${USE_BROTLI ? "on" : "off"}  帯域=${rate}`);
});
