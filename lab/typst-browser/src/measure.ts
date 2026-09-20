/**
 * Timing recorder.
 *
 * Every phase is measured from the navigation start, not from module start.
 * The number that decides the gate is "first preview painted", which includes
 * the HTML, the bundle, the wasm, the font and the first compile.
 */
import type { Source } from "./cache";

export interface Phase {
  /** Phase name, shown in the HUD. */
  name: string;
  /** Milliseconds this phase took. */
  ms: number;
  /** Milliseconds from navigation start to the end of this phase. */
  atMs: number;
  /** Decoded bytes, when the phase fetched something. */
  bytes?: number;
  /** Bytes on the wire, after HTTP compression. */
  wire?: number;
  /** Where the bytes came from. */
  source?: Source;
  /** Free-form note, shown after the numbers. */
  note?: string;
}

export interface Report {
  startedAt: string;
  tier: string;
  cacheEnabled: boolean;
  phases: Phase[];
  /** Navigation start to first preview painted. The gate number. */
  firstPreviewMs?: number;
  /** Navigation start to a usable editor. */
  editorReadyMs?: number;
  /** Compile plus render times of later edits. */
  recompileMs: number[];
  /** True when the browser served the HTML itself from its own cache. */
  documentFromCache?: boolean;
  /** When the HTML finished arriving. Everything before it is not delivery. */
  documentAtMs?: number;
  error?: string;
}

const listeners = new Set<(r: Report) => void>();

export const report: Report = {
  startedAt: new Date().toISOString(),
  tier: "",
  cacheEnabled: true,
  phases: [],
  recompileMs: [],
};

/** Milliseconds since the navigation started. */
export function sinceNavigation(): number {
  return performance.now();
}

function emit() {
  for (const fn of listeners) fn(report);
}

export function onUpdate(fn: (r: Report) => void) {
  listeners.add(fn);
  fn(report);
}

/** Run a phase and record how long it took. */
export async function phase<T>(
  name: string,
  fn: () => Promise<T>,
  describe?: (value: T) => Omit<Phase, "name" | "ms" | "atMs">,
): Promise<T> {
  const t0 = performance.now();
  const value = await fn();
  const ms = performance.now() - t0;
  report.phases.push({ name, ms, atMs: sinceNavigation(), ...(describe?.(value) ?? {}) });
  emit();
  return value;
}

/**
 * Record how the HTML itself arrived.
 *
 * A slow first visit is usually not the wasm. It is DNS, TLS, a cold Worker
 * and a cold edge cache, all of which land before the first byte of HTML.
 * Without this breakdown those seconds are invisible.
 */
export function recordNavigationTiming() {
  const nav = performance.getEntriesByType("navigation").at(0) as
    | PerformanceNavigationTiming
    | undefined;
  if (!nav) return;

  const steps: [string, number, number][] = [
    // Everything before the request leaves: unload, redirects, service worker
    // startup, and the browser opening a window. A fresh incognito window
    // spends seconds here, and none of it is delivery.
    ["ブラウザの立ち上げ (nav→fetch)", 0, nav.fetchStart],
    ["DNS", nav.domainLookupStart, nav.domainLookupEnd],
    ["TCP + TLS", nav.connectStart, nav.connectEnd],
    ["HTML 待ち (TTFB)", nav.requestStart, nav.responseStart],
    ["HTML 受信", nav.responseStart, nav.responseEnd],
  ];
  for (const [name, from, to] of steps) {
    if (to <= 0 || to < from) continue;
    report.phases.push({ name, ms: to - from, atMs: to });
  }

  // The document itself is fetched by the browser, not by this script, so
  // `?cache=0` does not cover it. If it came from disk, the run is not a first
  // visit however empty IndexedDB was. Say so rather than let it pass.
  const delivery = (nav as PerformanceNavigationTiming & { deliveryType?: string })
    .deliveryType;
  const fromCache =
    delivery === "cache" || (nav.transferSize === 0 && nav.decodedBodySize > 0);
  report.documentFromCache = fromCache;
  report.documentAtMs = nav.responseEnd;
  report.phases.push({
    name: "HTML の配信元",
    ms: 0,
    atMs: nav.responseEnd,
    wire: nav.transferSize || undefined,
    source: fromCache ? "http-cache" : "network",
    note: fromCache ? "★ 初訪問の計測にはならない" : undefined,
  });
  emit();
}

/** Record a moment that is not a phase of its own. */
export function mark(name: string, note?: string) {
  report.phases.push({ name, ms: 0, atMs: sinceNavigation(), note });
  emit();
}

export function setGate(field: "firstPreviewMs" | "editorReadyMs", ms: number) {
  report[field] = ms;
  emit();
}

export function addRecompile(ms: number) {
  report.recompileMs.push(ms);
  emit();
}

export function fail(err: unknown) {
  report.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  emit();
}
