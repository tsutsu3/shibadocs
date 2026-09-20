# 結果 — 既存実装の確認（2026-09-21）

## 結論

**mystmd には乗れない。理由は品質ではなく入力方言。** 出力の質は高く、参考にする価値がある。
`tex-to-typst` は**使うが、失敗を検出する仕組みを自前で足す必要がある。**

| | 判断 |
|---|---|
| mystmd に乗る | ❌ **Docusaurus のドキュメントが1文字も通らない**（§1） |
| 出力の形を参考にする | ✅ admonition・figure・相互参照の Typst 表現は素直（§2） |
| myst-spec のノード型を参考にする | ✅ 42種のうち 18種が Markdown に無い概念（§4） |
| tex-to-typst に依存する | ✅ ただし**未対応を黙って壊す**ので、対応表は自前で持つ（§3） |

検証に使った版: mystmd 1.10.1 / myst-spec 0.0.5 / tex-to-typst 0.0.22。

---

## 1. Docusaurus のドキュメントは通らない

### 1.1 `.mdx` は読まれない

```
⛔️ docusaurus.mdx Unrecognized extension
```

拡張子だけで弾かれる。生成された `docusaurus.typ` は他ファイルの `#include` 2行で、
**本文が1文字も出ていない。** 最初この出力を見て変換できたと勘違いしかけた。

### 1.2 `.md` に変えると読むが、方言はほぼ落ちる

同じ中身を `.md` にして通した結果（`out/typst/docusaurus-as-md.typ`）。

| 入力 | 出力 | 警告 |
|---|---|---|
| `:::note` | ```` ```note ```` （**コードブロック**） | なし |
| `:::warning[在庫の反映は…]` | ```` ```warning[在庫の反映は…] ```` | なし |
| `<Tabs>` / `<TabItem>` | **消える。**中のコードブロックだけ残る | なし |
| `<Badge type="draft">レビュー中</Badge>` | 中の文字だけ見出しに混入 | なし |
| ` ```ts title="src/client.ts" {2-3} ` | ` ```ts ` （**meta が全部落ちる**） | なし |
| `- [x] 性能試験の実施` | `- 性能試験の実施`（**チェック状態が落ちる**） | なし |
| `<kbd>Ctrl</kbd>` | **本文から消える**（`キーボードは  +  で保存する。`） | ⛔ あり |
| frontmatter の `id` / `sidebar_position` | 無視 | ⚠️ あり |

**警告が出たのは `<kbd>` だけ。** admonition もタブも、警告なしで別物になる。

`:::note` が admonition にならないのは、**MyST の記法が `:::{note}` だから**。
括弧の有無しか違わないので、見た目では気づきにくい。

### 1.3 和文の扱い

```
本書は、…基本設計を示す。 応答が 200 以外のとき…
                        ↑ 改行が空白になっている
```

soft break を空白に変換している。欧文では正しいが、**和文では余計な空白**になる。

テンプレートは lapreprint（学術プレプリント向け）で、`lang: "ja"` の指定が無い。
**禁則処理も和欧間のアキも効かない。**

---

## 2. MyST 記法で書けば、出力は良い

同じ内容を MyST 記法で書いた場合（`out/typst/myst.typ`）。

```typst
#noteBlock[
MyST の admonition は `:::{note}` で、Docusaurus の `:::note` とは括弧の有無が違う。
]

#warningBlock(heading: [在庫の反映は即時ではない])[
引当の要求を送った直後に在庫数を参照すると、反映前の値が返る。
]

#figure(
  image("files/architecture-91f8e503….png", width: 60%),
  caption: [システム構成図],
  kind: "figure",
  supplement: [Figure],
) <fig-arch>

図 #link(<fig-arch>)[Figure~1] に示す。

$ S = z dot.op sigma_L dot.op sqrt(L) $ <eq-safety>
#link(<eq-safety>)[(1)] で安全在庫を求める。
```

**参考になる点**

- admonition は `#noteBlock[...]`、タイトル付きは `heading:` 引数
- 図表は `#figure(...) <label>` で、ラベルが Typst 側に渡る
- 数式番号 `(1)` と図番号が振られる
- テンプレートを別ファイルに分け、本文は素直な Typst として読める

**真似しない点**

- 表が `#tablex(...)`（サードパーティ。Typst 0.11 以降はネイティブの `table` がある）
- そのセルが `[\n用語\n],` と縦に伸びる。列が増えると人が読めない
- 相互参照が**ビルド時に解決した文字列**（`Figure~1`）。supplement が英語のまま。
  和文なら「図 1」にしたいので、ここは自前でやる必要がある
- 引用の直後にコードフェンスが改行なしで続く箇所があった（`]` の直後に ` ``` `）

---

## 3. tex-to-typst は使える。ただし失敗を返さない

設計書に出る範囲の数式は、ほぼそのまま通る。

| | LaTeX | Typst |
|---|---|---|
| 分数 | `\frac{C}{I}` | `frac(C, I)` |
| 平方根と添字 | `z \cdot \sigma_L \cdot \sqrt{L}` | `z dot.op sigma_L dot.op sqrt(L)` |
| 総和 | `\sum_{i=1}^{n} x_i` | `sum_(i = 1)^n x_i` |
| 行列 | `\begin{pmatrix}a & b \\ c & d\end{pmatrix}` | `mat(delim: "(", a, b; c, d)` |
| 極限 | `\lim_{n \to \infty} a_n` | `lim_(n arrow.r infinity) a_n` |

### 3.1 ★ 未対応でも例外を投げない

| LaTeX | 返ってくるもの |
|---|---|
| `\textcolor{red}{x}` | `textcolor(r e d, x)` ← `red` が1文字ずつ分解されている |
| `\SI{3}{\kilo\gram}` | `SI 3 kilo gram` |
| `\ce{H2O}` | `ce H 2 O` |
| `\myMacro{x}` | `myMacro x` |

**どれも例外も警告も無い。** 戻り値は `{ value, macros }` で、`value` に
それらしい文字列が入って返る。呼び出し側からは成功と区別できない。

### 3.2 ★ 何が対応済みかを問い合わせる手段が無い

公開されているテーブルは3つだけで、**LaTeX 名の判定には使えない。**

```
typstMacros   972件  BbbA, mupalpha, wedge …   ← Typst / unicode-math 名
typstEnvs       9件  array, matrix, pmatrix …
typstStrings    6件  , & / ; ~ "
```

`\sigma` も `\lim` も正しく変換されるのに、**どのテーブルにも入っていない。**
LaTeX 名の対応表は非公開の `symbols` にあり、deep import も
`ERR_PACKAGE_PATH_NOT_EXPORTED` で塞がれている。

**→ 対応表は自前で持ち、外れたものに warning を出すしかない。**
`scripts/run-tex.mjs` にその形を実装してある（確認済みの命令だけを許可リストにし、
入力側を走査して外れたものを報告する）。

### 3.3 怪しい出力

```
\begin{cases} 1 & x > 0 \\ 0 & \text{otherwise} \end{cases}
  → cases(1, x > 0, 0, "otherwise")
```

Typst の `cases()` は引数1つが1分岐なので、**2分岐が4分岐に見える。**
場合分けを使うときは出力を確認すること。

---

## 4. myst-spec のノード型

42種。うち **18種が Markdown / GFM に無い概念**（`out/myst-spec-nodes.json`）。

```
abbreviation      admonition     admonitionTitle   block
blockBreak        caption        container         crossReference
inlineMath        legend         math              mystComment
mystDirective     mystRole       mystTarget        subscript
superscript       underline
```

**押さえるべきもの**

| | なぜ |
|---|---|
| `admonition` / `admonitionTitle` | タイトルに装飾が入りうるので、文字列では持てない |
| `container` / `caption` / `legend` | 図表を包んで採番する単位。Markdown には無い概念 |
| `crossReference` / `mystTarget` | 「図 3.2 を参照」を型として持つ |
| `mystDirective` / `mystRole` | 未対応のものを捨てずに退避する受け皿 |
| `math` / `inlineMath` | 数式をブロックとインラインで分ける |

⚠️ **myst-spec は「まだ開発中、予告なく変わる」と明記されている。** 概念を借りるだけで、
依存はしない。

---

## 5. この確認で決まったこと

```
1. 自前で書く方針は変わらない。Docusaurus 方言が通らないのは実物で確認した
2. 出力の形は myst-to-typst を参考にする。ただし表はネイティブの table を使う
3. 相互参照の supplement は自前で和文にする（「図 1」）
4. soft break を和文で空白にしない。mystmd は空白にしている
5. tex-to-typst は依存に入れる。対応表を自前で持ち、外れたら warning を出す
6. 未対応を黙って落とさない。mystmd は admonition もタブも無言で別物にした
```
