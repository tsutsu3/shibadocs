# typst-browser — ブラウザでの typst.ts 初回ロード検証

**SPA（ブラウザ完結のエディタ）が成立するかを決めるための計測。**

ブラウザだけで Markdown → Typst → プレビュー / PDF を完結させる構成は、
27MB の wasm と和文フォントを最初に読む。**それを待てるかどうかが分かれ目。**

事前に決めてあった判定基準:

| 初回ロード | 対応 |
|---|---|
| 5秒以内 | SPA が成立。予定どおり SPA を先に作る |
| 5〜10秒 | チャンク化を詰める |
| 10秒超 | **SPA を後回しにし、Excel 出力を先に作る** |

結果は [RESULT.md](RESULT.md)。生データは `results/`。

---

## 何を測るか

```
① 編集可能まで        ページを開いてからテキストを打てるまで
② 初回プレビューまで   ★ 判定の本体。HTML + JS + wasm + フォント + 初回コンパイル
③ 再コンパイル        1文字打ってからプレビューが変わるまで
④ 2回目の訪問        IndexedDB にキャッシュした状態
```

**①と②を分けているのが要点。** 「初回ペイントで書ける」構成なので、
27MB の wasm を待つ間もエディタは動く。体感を決めるのは①で、②は待ち時間の上限。

## 手順

```bash
pnpm install                    # ルートで一度だけ（workspace 全体）

# 1) 生成物を揃える（Python venv が要る。下記）
pnpm lab assets                 # フォント取得 → 静的インスタンス → サブセット → wasm を public/ へ
pnpm lab coverage               # サンプルの全文字がサブセットに入っているか

#   個別に回すとき: fonts / subset / wasm / charset
#   charset は commit 済みの data/*.txt を作り直すときだけ

# 2) ブラウザで測る
pnpm lab build
pnpm lab serve                  # brotli 配信の静的サーバ。--mbps 40 で帯域制限
#   → http://localhost:5273 を開く（★ 体感はここで判断する）

# 3) 数字だけ機械的に取る
pnpm lab measure                # playwright で cold / warm を各 tier
```

### Python venv

`fonttools` を使う。Node からは `.venv/bin/python` を直接叩く。

```bash
cd lab/typst-browser
python3 -m venv .venv
./.venv/bin/pip install "fonttools[woff]" brotli zopfli
```

## 計測の前提

| | |
|---|---|
| 配信 | `scripts/serve.mjs`。brotli 事前圧縮 + `cache-control: no-store` |
| 帯域 | 既定は制限なし（＝ローカル）。`--mbps 40` で実回線に寄せる |
| フォント | **Typst は woff2 を読まない。** 配るのは `.ttf`、削減は HTTP の brotli で取る |
| 既定フォント | `disableDefaultFontAssets()` で CDN からの追加取得を止めている |
| キャッシュ | IndexedDB に wasm とフォントを入れる。`?cache=0` で無効 |

⚠️ **`pnpm lab build` し直したら `serve` も再起動する。** 事前圧縮は起動時にしか走らない
（古い `.br` は mtime で弾くので、再起動を忘れても無圧縮で正しいものが出る）。

### URL パラメータ

```
?tier=kana|joyo|joyo-jinmeiyo   フォントのサブセット段階
?cache=0                        IndexedDB を使わない（毎回 cold）
?bold=0                         Bold を読まない（Regular のみ）
```

## Cloudflare に載せる（実回線で測るため）

ローカルの headless では「待たされる感じ」が分からないので、実際に配信して測る。

### 構成

```
Workers Static Assets   dist/ 全部（アプリ・フォント・レンダラ wasm）
R2                      コンパイラ wasm だけ
```

**コンパイラ wasm は 27.01 MiB で、静的アセットの1ファイル上限 25 MiB を超える**
（2.0 MiB 超過）。そこだけ R2 に置き、Worker が `/wasm/*` を R2 から返す。
URL の形は変わらないので、アプリ側のコードは分岐を持たない。

R2 には **brotli 済み（q11、6.88 MiB）** を入れ、Worker はそのバイト列を素通しする。
edge の自動圧縮は約 9.4 MiB にしかならないので、事前圧縮で **2.5 MiB 得をする**。

キャッシュは **Workers Cache**（`wrangler.jsonc` の `cache.enabled`）。レスポンスの
`Cache-Control` が効き、**ヒット時は Worker が動かない**。エントリは Worker の
バージョン単位なので、**デプロイすれば古い版は切れる**（手動のバージョン管理は不要）。

⚠️ **自分で `Content-Encoding` を管理する経路は2つとも壊れた。** 記録として残す。

```
Cache API に入れる        → ヒット時にヘッダだけ落ちる
静的アセット + _headers   → 保存したバイト列をもう一度圧縮され、宣言は1層だけ
```

どちらもブラウザに brotli ストリームが wasm として渡り、
`expected magic word 00 61 73 6d, found cb ff ff 3f` で落ちる。
**Workers Cache は素の HTTP キャッシュ**なので、この問題は起きない。

### 手順

```bash
pnpm lab build
pnpm lab cf:types                 # wrangler.jsonc を変えたら再生成

# 初回だけ: バケットを作る
pnpm lab exec wrangler r2 bucket create shibadocs-lab-wasm

pnpm lab cf:upload                # brotli 圧縮して R2 へ（初回は1分ほど）
pnpm lab cf:deploy
```

ローカルで通しを見るとき:

```bash
pnpm lab cf:upload --local        # ローカルの R2 エミュレータへ
pnpm lab cf:dev
```

### デプロイ後に確認すること

```bash
curl -s --compressed -o /tmp/w.wasm -D - \
  -H 'Accept-Encoding: br' https://<deployed>/wasm/typst_ts_web_compiler_bg.wasm \
  | grep -iE 'content-encoding|x-edge-cache'
head -c 4 /tmp/w.wasm | xxd     # 00 61 73 6d でなければ配信が壊れている
stat -c%s /tmp/w.wasm           # 28325178
```

- `content-encoding: br` が無ければ、27MB がそのまま降りている
- **HUD の `fetch compiler wasm` で wire と decoded を見る**
  - wire 6.88 MB / decoded 27.01 MB なら意図どおり
  - decoded が 6.88 MB なら二重圧縮。アプリが先頭4バイトを見て落とす
- キャッシュのヒットは `age=` の有無で分かる（ヒット時は Worker が動かないので、
  Worker が付けるヘッダでは判別できない）

⚠️ **`wrangler dev` はブラウザ相手に gzip へ付け替える。** ローカルの wire は当てにならない。

## ファイル

```
scripts/gen-charset.mjs    文字集合の生成（常用漢字2136 / 人名用862）
scripts/setup-fonts.mjs    可変フォント → wght=400/700 の静的インスタンス
scripts/subset-fonts.mjs   サブセット生成 + サイズ計測 → results/font-sizes.json
scripts/coverage.mjs       サンプルの文字がサブセットに入っているか → results/coverage.json
scripts/copy-wasm.mjs      typst.ts の wasm を public/ へ
scripts/serve.mjs          brotli 配信 + 帯域制限の静的サーバ
scripts/measure.mjs        playwright で自動計測 → results/browser-timings.json
scripts/upload-wasm.mjs    コンパイラ wasm を brotli 化して R2 へ
src/                       計測用のエディタ（textarea + プレビュー + 計測パネル）
src/worker.ts              Cloudflare 用。/wasm/* だけ R2 から返す
wrangler.jsonc             Workers Static Assets + R2 の設定
public/samples/            和文テンプレートと設計書サンプル
data/                      文字集合。生成物だが commit する（再現のため）
```

## 注意

- `public/fonts/` と `public/wasm/` は生成物。**commit しない**（合計 30MB 超）
- `data/*.txt` は commit する。生成元の kanji-data が消えても再現できるようにするため
- `public/samples/base.typ` は和文テンプレートのコピー。**ここでは編集しない**
- `worker-configuration.d.ts` は生成物。`pnpm lab cf:types` で作る
