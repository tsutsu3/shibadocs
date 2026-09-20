# 結果 — ブラウザでの typst.ts 初回ロード（2026-09-20 〜 21）

## 判定: **通過。SPA（ブラウザ完結のエディタ）は成立する。**

最終構成（Cloudflare 配信・実機ブラウザ）で測った値。

| | 実測 | |
|---|---|---|
| **初回プレビュー（cold）** | **3.5 秒** | 判定の基準は「5秒以内」 |
| 2回目（IndexedDB） | 0.9 秒 | |
| **編集可能まで** | **0.36 秒** | ★ 体感を決めるのはここ |
| 再コンパイル | 約 50 ms | 6ページを毎回まるごと |
| PDF 出力 | 12〜62 ms | ブラウザ内で完結。サーバ不要 |

**予定どおり SPA を先に作る。** 後回しにして Excel を先に、という分岐は取らない。

---

## 1. 計測条件

2段階で測った。**①で構成を詰め、②で実際の配信に載せて裏を取った。**

| | ① headless | ② 実機 + Cloudflare |
|---|---|---|
| 実行 | Chromium headless、`scripts/measure.mjs` | 手動、実回線 |
| 配信 | ローカルの `scripts/serve.mjs`（brotli 事前圧縮） | Workers Static Assets + R2 |
| 帯域 | CDP で制限（無制限 / 40Mbps / 10Mbps） | 実回線 |
| 目的 | 条件を揃えた比較（フォント段階など） | 体感と、配信の実力 |

共通の条件:

| | |
|---|---|
| 版 | typst.ts 0.7.0（**Typst 0.14.2** を内蔵。`#panic(str(sys.version))` で確認） |
| 文書 | `public/samples/sample.typ`（6ページ相当の和文設計書。表・admonition・コード・承認欄） |
| フォント | Noto Sans JP の Regular + Bold、サブセット3段階 |
| 生データ | `results/*.json` |

---

## 2. 数字

### 2.1 実機 + Cloudflare（最終構成）

| | |
|---|---|
| 初回プレビュー | **3,626 ms** |
| うち HTML 到達後 | **3,457 ms** ← 配信の実力はこれ（§5.1） |
| 編集可能まで | 363 ms |
| PDF 出力 | 12 ms |

到達までの内訳: ブラウザの立ち上げ 12 ms / DNS 16 ms / TCP+TLS 82 ms / TTFB 58 ms。

### 2.2 headless・帯域制限つき（初回プレビューまで ms）

| 帯域 | かな | 常用漢字 | 常用+人名用 |
|---|---|---|---|
| 無制限 | 646 | 644 | 654 |
| **40Mbps** | 2507 | **2663** | 2700 |
| 10Mbps | 7641 | **8561** | 8456 |

2回目（IndexedDB ヒット）は 467〜1031 ms。編集可能まではどの条件でも 180 ms 以内。
1文字打ってからプレビューが変わるまでは **42〜68 ms**。

実回線の cold 3.5 秒は、40Mbps で測った 2.66 秒と整合する。

### 2.3 転送量

| | 生 | brotli | 備考 |
|---|---|---|---|
| **コンパイラ wasm** | 27.01 MB | **6.88 MB** | 事前の見積もり 7.8MB より小さい |
| レンダラ wasm | 0.93 MB | 264 KB | SVG プレビューに必要 |
| フォント Regular+Bold（常用漢字） | 1.71 MB | **933 KB** | 本番では edge 圧縮で 1.02 MB |
| アプリ本体（JS+CSS+HTML） | 122 KB | 約 35 KB | |
| **合計（常用漢字）** | **29.8 MB** | **約 8.1 MB** | |

フォント単体:

| サブセット | 文字数 | ttf 生 | **ttf brotli** | woff2（参考） |
|---|---|---|---|---|
| かな＋記号のみ | 2,037 | 263 KB | **113 KB** | 100 KB |
| **＋常用漢字2136** | 4,173 | 876 KB | **463 KB** | 385 KB |
| ＋人名用漢字862 | 5,034 | 1,152 KB | **610 KB** | 507 KB |
| サブセットなし | — | 5,632 KB | 2,701 KB | — |

**常用漢字サブセットは 463 KB（brotli）。** 目標に置いていた「400〜700KB」に収まった。
サンプル文書の全文字がこの段階でカバーされることも確認済み（`results/coverage.json`）。

---

## 3. 分かったこと

### 3.1 ★ フォントは支配要因ではない。wasm が支配する

サブセットを かな のみ（113KB）から 常用+人名用（610KB）まで **5.4倍** にしても、
初回プレビューは 40Mbps で 2507→2700ms（**+8%**）、10Mbps で 7641→8456ms（+11%）。

**フォントを削っても初回ロードはほとんど縮まない。** 縮むのは 6.88MB の wasm を
どうにかしたときだけ。SPA で詰めるのは、サブセットではなく wasm の配信方法。

ただしサブセットは **PDF の埋め込みサイズ**に直結するので、生成側では引き続き効く。

### 3.2 「初回ペイントで書ける」は成立する

エディタは 0.4 秒以内に入力可能になり、wasm とフォントはその裏で読み込まれる。
**9MB という絶対値ではなく、待たされるのがプレビューだけという構造が答え。**
判定の本体はここで、構成として成立した。

### 3.3 2回目が速い。IndexedDB は効く

0.9 秒。27MB の wasm を IndexedDB から読み戻す時間が支配的で、帯域には依存しない。
**常用の道具として使う分には初回だけの問題。**

### 3.4 編集ループは 50ms 前後

6ページを毎回まるごとコンパイルして 42〜68 ms。差分コンパイルは要らない。
事前に見ていた「5〜10ページで 30〜50ms」という報告とほぼ一致する。

### 3.5 ブラウザで PDF が出る

`$typst.pdf()` が 12〜62 ms で 118KB の PDF を返した。サーバは要らない。

### 3.6 ★ typst.ts が内蔵する Typst は 0.14.2。CLI 側は 0.15.1

**和文テンプレート（`public/samples/base.typ`）は 0.14.2 でもそのまま通った**
（今回のプレビューはすべてこれを経由している）。
ただし CLI と SPA で版がずれる状態は続く。**テンプレートは両方の版で compile を通す。**

### 3.7 Typst は woff2 を読まない

配るのは `.ttf`。削減は HTTP の brotli で取る（463KB）。
woff2 なら 385KB だが、ブラウザ側で展開する手間に見合わない。

### 3.8 ブラウザのエラーは行番号ではなく Span で来る

```
[SourceDiagnostic { severity: Error, span: Span(285938697326695), message: "panicked with: ...", ... }]
```

Rust の Debug 出力がそのまま来る。**SPA では span → 行 の逆引きが別途必要。**
CLI 側のソースマップとは別口の対応になる。

---

## 4. 配信の構成（Cloudflare）

### 4.1 なぜこの形か

```
Workers Static Assets   アプリ・フォント・レンダラ wasm・サンプル
R2 + Worker             コンパイラ wasm だけ
```

**コンパイラ wasm は 27.01 MiB で、静的アセットの1ファイル上限 25 MiB を超える**
（2.0 MiB 超過）。KV も値の上限が 25 MiB なので同じ壁に当たる。そこだけ R2 に置き、
Worker が `/wasm/*` を返す。URL の形は変わらないので、アプリ側に分岐は無い。

R2 には **brotli 済み（q11、6.88 MiB）** を入れ、Worker はそのバイト列を素通しする
（`encodeBody: "manual"`）。edge の自動圧縮は約 9.4 MiB にしかならない。

キャッシュは **Workers Cache**（`cache.enabled`。GA）。レスポンスの `Cache-Control`
で効き、**ヒット時は Worker が動かない**。エントリは Worker のバージョン単位なので、
デプロイすれば古い版が切れる。

ブラウザ側のキャッシュは `_headers` で指定する。既定は
`public, max-age=0, must-revalidate` で、**ファイルごとに 304 の往復が発生していた。**

| パス | | |
|---|---|---|
| `/assets/*` | `immutable` | Vite が内容ハッシュを名前に入れる |
| `/wasm/*` | `immutable` | typst.ts の版に固定 |
| `/fonts/*` | `max-age=86400` | 名前は同じままサブセットを作り直す |
| `/index.html` | 既定のまま | 新しいデプロイを拾う必要がある |

### 4.2 ★ 手で付けた Content-Encoding は、2つの経路で壊れた

事前圧縮（6.88 MB）は edge の自動圧縮（約 9.4 MB）より 2.5 MB 小さいので、
自分で `Content-Encoding: br` を付けて配ろうとした。**2通り試して2つとも壊れた。**

```
① Cache API に入れる          → ヒット時にヘッダだけ落ちる
② 静的アセット + _headers      → 保存したバイト列をもう一度圧縮され、宣言は1層だけ
```

どちらもブラウザに brotli ストリームが wasm として渡る。

```
CompileError: WebAssembly.instantiate(): expected magic word 00 61 73 6d, found cb ff ff 3f
```

`cb ff ff 3f` は `.br` ファイルの先頭バイトそのものだった。
①は `encodeBody: "manual"` を付け直しても直らない（落ちるのはヘッダのほう）。
②は展開して出てきたものが元の `.br` ファイルと一致した（＝二重圧縮）。

**解決は Workers Cache。** Cache API ではなく素の HTTP キャッシュなので、
Content-Encoding が保たれる。事前圧縮を保ったままキャッシュできる。

アプリ側には**先頭4バイトが `00 61 73 6d` かを見る検査**を入れた。
同じ壊れ方をしたときに、配信を疑えと言えるようにするため。

### 4.3 本番で確認したヘッダ

```
/wasm/typst_ts_web_compiler_bg.wasm
  content-length: 7216543          ← 事前 brotli q11 そのもの
  content-encoding: br
  cache-control: public, max-age=31536000, immutable
  cf-cache-status: HIT   age: 374  ← Workers Cache。Worker は動いていない

/assets/index-*.js
  cache-control: public, max-age=31536000, immutable
  cf-cache-status: HIT             ← 304 の往復は消えた

/ (index.html)
  cache-control: public, max-age=0, must-revalidate
  cf-cache-status: REVALIDATED     ← 新しいデプロイを拾うため、これでよい
```

**キャッシュは拠点単位。** 「その拠点で最初の1人」だけが R2 を読み、
同じ拠点の2人目以降は Worker を動かさずに配られる。容量から追い出されれば戻る。

---

## 5. 計測の落とし穴（ここが一番の収穫かもしれない）

### 5.1 初訪問の 14.3 秒は配信ではなかった

最初の実機計測で 14,317 ms が出た。**うち 4,987 ms が編集可能まで**で、
この区間は HTML と JS しか読んでいない（他の回は 175〜206 ms）。追試で3つに割れた。

```
1. 新しいシークレット窓の起動      ナビゲーション開始から DNS を引くまでに 4.0 秒
                                  （通常の窓では 12 ms）
2. Cloudflare Access の往復        計測中は掛けていた。外すと TTFB が 1,010 → 58 ms
3. デプロイ直後で edge が冷たい     いまは cf-cache-status: HIT
```

**いずれも配信の実力とは無関係。**「**HTML 到達後**」で揃えると、
どの条件でも 3.4〜3.9 秒に収まる。HUD にこの行を出すようにした。

⚠️ **計測対象のサイトに Cloudflare Access を掛けない。** 認可の往復が初回に乗る。

### 5.2 キャッシュは3層ある。混ぜると数字が嘘になる

| 層 | 迂回する方法 |
|---|---|
| IndexedDB（ページ内） | `?cache=0`、またはボタン |
| ブラウザの HTTP キャッシュ | DevTools の Disable cache、ハードリロード、シークレット窓 |
| CF の edge キャッシュ | クライアントからは不可。時間か再デプロイ |

**`?cache=0` が迂回するのは fetch した分だけ**で、HTML と JS には効かない
（ブラウザが取りに行くため）。「キャッシュを消して再読込」ボタンも、
消せるのは IndexedDB と Cache API だけで、**ディスクキャッシュは消せない。**
最初はそれを network と数えていて、wire 0 KB の回を cold として記録していた。

塞いだ穴:

```
・source を network / http-cache / indexeddb の3種に分ける
  （transferSize と deliveryType で判別。wire 0 は http-cache）
・ボタンは ?cache=0 に遷移させる
・判定は cold のときだけ出す。warm な回に「成立」と出さない
・ナビゲーションの内訳（ブラウザの立ち上げ / DNS / TCP+TLS / TTFB / HTML 受信）
・cf-cache-status と age を各フェーズに出す
・HTML 自体がキャッシュ由来なら警告を出す
```

**測る条件は4通り。** どれを測ったかは source 列で確かめる（手順は README）。

---

## 6. SPA に向けて残るもの（今はやらない）

```
1. wasm の分割と遅延ロード      6.88MB。圧縮とキャッシュは詰め終えた（§4）
2. span → 行 の逆引き           §3.8
3. コンパイラの版を CLI と揃える   §3.6
4. Worker に逃がす              init と compile が main thread を塞ぐ（199ms + 215ms）
```

## 7. 未実施

```
[ ] Firefox / Safari での確認
[ ] typst.ts 0.8.0-rc の評価（0.7.0 で pin 中）
```
