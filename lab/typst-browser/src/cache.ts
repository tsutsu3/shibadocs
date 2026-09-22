/**
 * IndexedDB cache for the wasm modules and the font.
 *
 * The second visit is the one that matters for a real editor. The browser HTTP
 * cache would also serve it, but it can be evicted at any time and it cannot be
 * measured from the page. An explicit store makes the second load reproducible.
 */
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "shibadocs-lab";
const STORE = "assets";

let dbPromise: Promise<IDBPDatabase> | undefined;

function db() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
  return dbPromise;
}

/**
 * Where the bytes came from.
 *
 * `http-cache` is the browser's own disk or memory cache. It looks like a
 * network fetch from script, but nothing crosses the wire, so counting it as
 * network would make a cold load look fast.
 */
export type Source = "network" | "http-cache" | "indexeddb";

export interface Fetched {
  bytes: ArrayBuffer;
  source: Source;
  /** Bytes on the wire. Smaller than `bytes.byteLength` when brotli is used. */
  transferred?: number;
  /** `cf-cache-status`, when a CDN served the request. HIT means warm edge. */
  edge?: string;
}

/** Age of a cached response, as an HTTP cache reports it. */
function ageOf(res: Response): string | undefined {
  const age = res.headers.get("age");
  return age === null ? undefined : `age=${age}`;
}

/** Resource Timing entry of the last request for this URL. */
function timingOf(url: string): PerformanceResourceTiming | undefined {
  return performance
    .getEntriesByType("resource")
    .filter((e): e is PerformanceResourceTiming => e.name.endsWith(url))
    .at(-1);
}

/**
 * Tell a real transfer from a hit in the browser's own cache.
 *
 * `deliveryType` says so directly where it exists. Everywhere else, a response
 * with a body but no transferred bytes came from the cache.
 */
function classify(entry: PerformanceResourceTiming | undefined): Source {
  if (!entry) return "network";
  const delivery = (entry as PerformanceResourceTiming & { deliveryType?: string })
    .deliveryType;
  if (delivery === "cache") return "http-cache";
  if (entry.transferSize === 0 && entry.decodedBodySize > 0) return "http-cache";
  return "network";
}

/**
 * Fetch a URL, using the IndexedDB copy when there is one.
 *
 * `cacheEnabled: false` still fetches over the network, so a cold load can be
 * measured without clearing the store by hand.
 */
export async function fetchCached(url: string, cacheEnabled: boolean): Promise<Fetched> {
  if (cacheEnabled) {
    const hit = (await (await db()).get(STORE, url)) as ArrayBuffer | undefined;
    if (hit) return { bytes: hit, source: "indexeddb" };
  }

  const res = await fetch(url, { cache: cacheEnabled ? "default" : "reload" });
  if (!res.ok) throw new Error(`fetch failed: ${url} ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (cacheEnabled) await (await db()).put(STORE, bytes, url);
  const entry = timingOf(url);
  return {
    bytes,
    source: classify(entry),
    transferred: entry?.transferSize || undefined,
    // `Age` is set by an HTTP cache that served this, so it marks a hit even
    // when the response carries no vendor-specific status header.
    edge:
      [res.headers.get("cf-cache-status"), ageOf(res)].filter(Boolean).join(" ") ||
      undefined,
  };
}

/**
 * Drop what the page can drop: IndexedDB and the Cache API.
 *
 * The browser HTTP cache is not reachable from script, so this alone does not
 * produce a cold load. The caller has to reload with `?cache=0`, which fetches
 * with `cache: "reload"` and goes past it.
 */
export async function clearCache() {
  await (await db()).clear(STORE);
  if ("caches" in globalThis) {
    for (const key of await caches.keys()) await caches.delete(key);
  }
}
