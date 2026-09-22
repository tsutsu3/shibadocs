# baseline — 既存ツールで同じ和文を PDF にする

**比較対象を手元に持つ。** 同じ和文の設計書（`input/sample.md`）を、既存のツールで
既定のまま PDF にした結果を集める。結果は [RESULT.md](RESULT.md)。

| ツール | 方式 | 入力 |
|---|---|---|
| pandoc.org/app | pandoc（wasm）→ Typst、ブラウザ内 | Markdown ファイル |
| docusaurus-prince-pdf | 描画済みサイトを巡回 → Prince | Docusaurus サイト |
| docs-to-pdf | 描画済みサイトを巡回 → Chromium の印刷 | 同上 |
| mr-pdf | 同上（docs-to-pdf の元になった実装） | 同上 |

手作業で測るもの（Google Docs）は [manual/README.md](manual/README.md)。

## 手順

```bash
pnpm install                          # ルートで一度だけ

# pandoc.org/app（Playwright で実物の Web アプリを操作する）
pnpm lab:baseline pandoc-app

# サイト系の3ツール
pnpm lab:baseline site:build          # Docusaurus サイトを作る（workspace とは別に入れる）
pnpm lab:baseline site:serve          # 別の端末で。http://localhost:3100
pnpm lab:baseline site-tools          # 3つの PDF を作る

# 検査と比較画像
pnpm lab:baseline inspect             # フォント・コピーできるか・透かし・しおり
pnpm lab:baseline compare             # out/compare.png
```

### 手で入れるもの

```bash
cd lab/baseline

# PDF の検査用
python3 -m venv .venv && ./.venv/bin/pip install pymupdf pillow

# Prince（無償版は1ページ目に透かしが入る）
mkdir -p .bin && cd .bin
curl -LO https://www.princexml.com/download/prince-16.2-linux-generic-x86_64.tar.gz
tar xzf prince-16.2-linux-generic-x86_64.tar.gz
cd prince-16.2-linux-generic-x86_64 && echo "$(pwd)/../prince" | ./install.sh
```

Puppeteer は Chrome を落とさず、Playwright が入れた Chromium を使う（`scripts/site-tools.sh`）。

## 注意

- **和文フォントは環境に依存する。** この環境には IPAゴシック が入っていたので、
  サイト系の3ツールは和文を描けた。和文フォントの無いコンテナで動かすと豆腐になる
- docusaurus-prince-pdf 1.2.1 は **Node 22 で起動しない**（`import ... assert` を使っている）。
  スクリプトは Node 20 で動かしている
