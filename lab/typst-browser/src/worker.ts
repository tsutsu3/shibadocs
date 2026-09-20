/**
 * Serves the harness from Cloudflare.
 *
 * Static assets cover the whole build except one file. The Typst compiler wasm
 * is 27.01 MiB and the per-file limit for static assets is 25 MiB, so that one
 * object lives in R2 and this Worker hands it out.
 *
 * The object is stored brotli-compressed, which is smaller than what the edge
 * produces on the fly (6.88 MiB against about 9.4 MiB), and this Worker passes
 * those bytes through untouched.
 *
 * Caching is done by Workers Cache (`cache.enabled` in wrangler.jsonc), driven
 * by the Cache-Control header on the response. On a hit the Worker does not run
 * at all. The Cache API is deliberately not used: it drops Content-Encoding on
 * a hit, and the browser then receives a brotli stream where it expects wasm.
 */

interface Env {
  WASM: R2Bucket;
}

/** Prefix that this Worker serves from R2 rather than from static assets. */
const R2_PREFIX = "/wasm/";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Static assets are matched before this Worker runs, so anything arriving
    // here matched no asset. The only path it is meant to handle is the one
    // kept out of the asset upload by .assetsignore.
    if (!url.pathname.startsWith(R2_PREFIX)) {
      return new Response("not found", { status: 404 });
    }

    const object = await env.WASM.get(url.pathname.slice(R2_PREFIX.length));
    if (object === null) return new Response("not found", { status: 404 });

    const headers = new Headers();
    // contentType, contentEncoding and cacheControl come from the upload.
    // Cache-Control is what makes Workers Cache keep this response.
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, {
      headers,
      // The stored bytes are already compressed. Without this the runtime
      // compresses them a second time.
      encodeBody: headers.has("content-encoding") ? "manual" : "automatic",
    });
  },
} satisfies ExportedHandler<Env>;
