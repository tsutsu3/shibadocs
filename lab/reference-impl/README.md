# reference-impl — 既存実装の確認

自前の変換器（Markdown → Typst）を書く前に、**既に同じことをしている実装が
どこまでやれているかを実物で確かめる**ためのコード。

対象は3つ。

```
mystmd         MyST Markdown → Typst → PDF。myst-to-typst を内蔵
myst-spec      MyST の AST 仕様（JSON Schema）
tex-to-typst   LaTeX 数式 → Typst 数式。これは実際に依存する候補
```

**目的は「乗るか」ではなく「参考にする」。** 結果は [RESULT.md](RESULT.md)。

## 手順

```bash
pnpm install          # ルートで一度だけ

pnpm lab:ref myst     # fixtures を myst build --typst にかけ、出力と警告を集める
pnpm lab:ref tex      # tex-to-typst に設計書の数式を通す
pnpm lab:ref nodes    # myst-spec のノード型を一覧にする
```

出力は `out/` に落ちる（gitignore）。

```
out/typst/*.typ          生成された Typst
out/myst-log.json        mystmd の標準出力と警告
out/tex-to-typst.json    数式の変換結果
out/myst-spec-nodes.json ノード型
```

⚠️ **typst CLI が無いと最後の PDF 化で失敗する。** `.typ` はその前に書かれるので、
調べたいものは手に入る。

## fixtures

| ファイル | 何を見るためのものか |
|---|---|
| `docusaurus.mdx` | **`.mdx` が読まれるかどうか**（読まれない） |
| `docusaurus-as-md.md` | 同じ中身を `.md` にしたもの。方言が何になるか |
| `myst.md` | MyST 記法。mystmd が本来想定している書き方 |
| `plain.md` | CommonMark + GFM だけ。比較の基準 |

`docusaurus-as-md.md` は `docusaurus.mdx` から import 行を落としただけの同じ文書。
**拡張子の違いだけで結果が変わる**ことを見るために2つ置いてある。
