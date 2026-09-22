/** Render the timing table. Kept out of main.ts so the flow there stays short. */
import type { Report } from "./measure";

const ms = (n: number) => `${n.toFixed(0)} ms`;
const kb = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(2)} MB`);

/**
 * The gate is about delivery, so it is judged on the time after the HTML
 * arrives. What happens before it — a browser starting a window, a DNS lookup
 * on a cold resolver — is real for the user but is not something the product
 * changes.
 */
function verdict(firstPreviewMs: number): { label: string; cls: string } {
  if (firstPreviewMs <= 5000) return { label: "5秒以内 — SPA は成立", cls: "ok" };
  if (firstPreviewMs <= 10000) return { label: "5〜10秒 — チャンク化を詰める", cls: "warn" };
  return { label: "10秒超 — SPA を後回しにする", cls: "bad" };
}

export function renderHud(root: HTMLElement, r: Report) {
  const rows = r.phases
    .map(
      (p) => `<tr>
        <td>${p.name}</td>
        <td class="num">${p.ms ? ms(p.ms) : ""}</td>
        <td class="num">${ms(p.atMs)}</td>
        <td class="num">${p.wire ? kb(p.wire) : ""}</td>
        <td class="num">${p.bytes ? kb(p.bytes) : ""}</td>
        <td>${p.source ?? ""}${p.note ? ` <span class="note">${p.note}</span>` : ""}</td>
      </tr>`,
    )
    .join("");

  // The verdict only means something on a run that really crossed the wire.
  // With the IndexedDB store enabled, a reload measures the cache, not the load.
  const cold = !r.cacheEnabled;
  const gate =
    r.firstPreviewMs !== undefined && cold ? verdict(r.firstPreviewMs) : undefined;
  const mode = cold
    ? "cold（IndexedDB を使わず、fetch は HTTP キャッシュを迂回）"
    : "warm 可（IndexedDB 使用）。判定は ?cache=0 で";
  const docWarning = r.documentFromCache
    ? "⚠ HTML がブラウザのキャッシュから来ている。初訪問を測るには DevTools の Disable cache か新しいシークレット窓で"
    : "";
  const recompiles = r.recompileMs.slice(-5);
  const avg = recompiles.length
    ? recompiles.reduce((a, b) => a + b, 0) / recompiles.length
    : undefined;

  root.innerHTML = `
    <div class="gate ${gate?.cls ?? ""}">
      <div>
        <span class="label">初回プレビュー</span>
        <span class="value">${r.firstPreviewMs !== undefined ? ms(r.firstPreviewMs) : "…"}</span>
      </div>
      <div>
        <span class="label">編集可能まで</span>
        <span class="value">${r.editorReadyMs !== undefined ? ms(r.editorReadyMs) : "…"}</span>
      </div>
      <div>
        <span class="label">うち HTML 到達後</span>
        <span class="value">${
          r.firstPreviewMs !== undefined && r.documentAtMs !== undefined
            ? ms(r.firstPreviewMs - r.documentAtMs)
            : "…"
        }</span>
      </div>
      <div>
        <span class="label">再コンパイル(直近5回)</span>
        <span class="value">${avg !== undefined ? ms(avg) : "—"}</span>
      </div>
      <div class="verdict">${gate?.label ?? ""}</div>
      <div class="mode">${mode}</div>
      ${docWarning ? `<div class="mode warnline">${docWarning}</div>` : ""}
    </div>
    <table>
      <thead><tr><th>phase</th><th class="num">ms</th><th class="num">@nav</th><th class="num">wire</th><th class="num">decoded</th><th>source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${r.error ? `<p class="error">${r.error}</p>` : ""}
    <p class="meta">tier=${r.tier} / cache=${r.cacheEnabled ? "on" : "off"}</p>
  `;
}
