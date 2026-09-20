/**
 * Harness: how long does a Typst editor take to become usable in a browser,
 * with a Japanese font?
 *
 * The page renders the editor first and loads the compiler afterwards. That is
 * the "you can type on first paint" layout the gate asks about.
 */
import { $typst, TypstSnippet } from "@myriaddreamin/typst.ts/contrib/snippet";
import { clearCache, fetchCached } from "./cache";
import {
  addRecompile,
  fail,
  mark,
  onUpdate,
  phase,
  recordNavigationTiming,
  report,
  setGate,
  sinceNavigation,
} from "./measure";
import { renderHud } from "./hud";

const TIERS = {
  kana: "fonts/NotoSansJP-Regular-kana.ttf",
  joyo: "fonts/NotoSansJP-Regular-joyo.ttf",
  "joyo-jinmeiyo": "fonts/NotoSansJP-Regular-joyo-jinmeiyo.ttf",
} as const;

type TierId = keyof typeof TIERS;

const params = new URLSearchParams(location.search);
const tier = (params.get("tier") ?? "joyo") as TierId;
const cacheEnabled = params.get("cache") !== "0";
/** Load the bold face too. A document without bold headings is not realistic. */
const withBold = params.get("bold") !== "0";

report.tier = tier;
report.cacheEnabled = cacheEnabled;

const editor = document.querySelector<HTMLTextAreaElement>("#editor")!;
const preview = document.querySelector<HTMLDivElement>("#preview")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;

onUpdate((r) => renderHud(hud, r));

document.querySelector("#clear")!.addEventListener("click", async () => {
  await clearCache();
  // The HTTP cache survives clearCache(), so reload into the mode that fetches
  // past it. Otherwise the "cold" run is served from disk at 0 bytes on the wire.
  location.search = "?tier=" + tier + "&cache=0";
});

// The editor is usable before anything else loads. This is the point of the
// layout: the user can start writing while the compiler is still downloading.
recordNavigationTiming();
editor.disabled = false;
editor.focus();
setGate("editorReadyMs", sinceNavigation());
mark("editor interactive");

async function boot() {
  const sampleUrl = "samples/sample.typ";
  const baseUrl = "samples/base.typ";

  const [sample, base] = await phase(
    "fetch sample .typ",
    async () => {
      const [a, b] = await Promise.all([
        fetch(sampleUrl).then((r) => r.text()),
        fetch(baseUrl).then((r) => r.text()),
      ]);
      return [a, b] as const;
    },
    ([a, b]) => ({ bytes: a.length + b.length, source: "network" as const }),
  );
  editor.value = sample;

  const fontFiles = [TIERS[tier], ...(withBold ? [TIERS[tier].replace("Regular", "Bold")] : [])];
  const fonts = await phase(
    `fetch font (${tier}${withBold ? " x2" : ""})`,
    async () => Promise.all(fontFiles.map((f) => fetchCached(f, cacheEnabled))),
    (f) => ({
      bytes: f.reduce((n, x) => n + x.bytes.byteLength, 0),
      wire: f.reduce((n, x) => n + (x.transferred ?? 0), 0) || undefined,
      // If any face crossed the wire, the phase was not a cache hit.
      source: f.find((x) => x.source === "network")?.source ?? f[0].source,
      note: [`${fontFiles.length} face`, f[0].edge].filter(Boolean).join(" "),
    }),
  );

  const renderer = await phase(
    "fetch renderer wasm",
    () => fetchCached("wasm/typst_ts_renderer_bg.wasm", cacheEnabled),
    (f) => ({ bytes: f.bytes.byteLength, wire: f.transferred, source: f.source, note: f.edge }),
  );

  const compiler = await phase(
    "fetch compiler wasm",
    () => fetchCached("wasm/typst_ts_web_compiler_bg.wasm", cacheEnabled),
    (f) => ({ bytes: f.bytes.byteLength, wire: f.transferred, source: f.source, note: f.edge }),
  );

  // A wasm module starts with "\0asm". Anything else means the bytes were
  // mangled in transit, usually by a Content-Encoding that the browser did not
  // undo. Say that, instead of letting WebAssembly report a magic word error.
  const magic = new Uint8Array(compiler.bytes.slice(0, 4));
  if (!(magic[0] === 0x00 && magic[1] === 0x61 && magic[2] === 0x73 && magic[3] === 0x6d)) {
    const hex = [...magic].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    throw new Error(
      `compiler wasm が壊れている（先頭が ${hex}）。配信側の Content-Encoding を疑う`,
    );
  }

  // The default assets would pull more fonts from a CDN. The measurement has to
  // cover exactly the bytes this page asked for.
  $typst.use(
    TypstSnippet.disableDefaultFontAssets(),
    TypstSnippet.preloadFonts(fonts.map((f) => new Uint8Array(f.bytes))),
  );
  $typst.setCompilerInitOptions({ getModule: () => compiler.bytes });
  $typst.setRendererInitOptions({ getModule: () => renderer.bytes });

  await phase("init compiler (wasm + font)", async () => {
    await $typst.getCompiler();
  });

  // base.typ is imported by sample.typ, so the compiler needs it in its vfs.
  await $typst.addSource("/base.typ", base);

  const svg = await phase("first compile + render", () => compile(sample));
  preview.innerHTML = svg;
  setGate("firstPreviewMs", sinceNavigation());
  mark("first preview painted");

  // The editor has to export a PDF in the browser, not only show a preview.
  // Measured after the gate mark, so it does not inflate the gate number.
  const pdf = await phase(
    "PDF 出力",
    () => $typst.pdf({ mainFilePath: "/main.typ" }),
    (bytes) => ({ bytes: bytes?.byteLength }),
  );
  document.querySelector("#pdf")!.addEventListener("click", async () => {
    const data = (await $typst.pdf({ mainFilePath: "/main.typ" })) ?? pdf;
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/pdf" }));
    Object.assign(document.createElement("a"), { href: url, download: "preview.pdf" }).click();
    URL.revokeObjectURL(url);
  });

  let timer: number | undefined;
  editor.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const t0 = performance.now();
      try {
        preview.innerHTML = await compile(editor.value);
        addRecompile(performance.now() - t0);
      } catch (err) {
        fail(err);
      }
    }, 150) as unknown as number;
  });
}

async function compile(source: string): Promise<string> {
  await $typst.addSource("/main.typ", source);
  return $typst.svg({ mainFilePath: "/main.typ" });
}

boot().catch((err) => {
  fail(err);
  console.error(err);
});

// Handle for the headless runner.
Object.defineProperty(window, "__metrics", { value: report });
