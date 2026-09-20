// ============================================================================
// base.typ — 和文組版の基本設定
//
// これが「和文テンプレート」の中身。Markdown には無い情報を全部ここで足す。
// 変換器（md2typst）が出すのは本文だけで、体裁はこのファイルが決める。
// ============================================================================

#let doc-meta = state("meta", (:))

// ---------------------------------------------------------------------------
// 1. 承認欄（押印枠）— 日本の社内文書で実質必須。海外ツールは持っていない
// ---------------------------------------------------------------------------
#let approval-box(roles) = {
  table(
    columns: roles.len(),
    align: center,
    inset: 0pt,
    stroke: 0.6pt + rgb("#666"),
    ..roles.map(r => table.cell([
      #box(height: 46pt, width: 58pt)[
        #place(top + center, dy: 4pt, text(7.5pt, fill: rgb("#555"), r))
      ]
    ]))
  )
}

// ---------------------------------------------------------------------------
// 2. admonition — :::note の受け皿
//    ★ ラベル文字を必ず出す。色だけだと白黒印刷で判別できない
// ---------------------------------------------------------------------------
#let admonition(kind: "note", label: none, body) = {
  let conf = (
    note:    (c: rgb("#2f5f7f"), l: "NOTE"),
    tip:     (c: rgb("#4a7c46"), l: "TIP"),
    info:    (c: rgb("#2f5f7f"), l: "INFO"),
    warning: (c: rgb("#b06a00"), l: "WARNING"),
    danger:  (c: rgb("#c8442b"), l: "DANGER"),
  ).at(kind, default: (c: luma(120), l: upper(kind)))

  block(
    width: 100%, inset: (x: 10pt, y: 9pt), radius: 2pt, breakable: true,
    fill: conf.c.lighten(93%),
    stroke: (left: 3pt + conf.c),
    above: 1.0em, below: 1.0em,
  )[
    #text(8.5pt, weight: 600, fill: conf.c, tracking: 0.08em)[
      #if label != none { upper(label) } else { conf.l }
    ]
    #v(3pt, weak: true)
    #set par(first-line-indent: 0em)
    #body
  ]
}

// ---------------------------------------------------------------------------
// 3. 本体テンプレート
// ---------------------------------------------------------------------------
#let report(
  title: "",
  subtitle: none,
  company: none,
  version: "1.0",
  date: "",
  author: "",
  approvals: (),
  revisions: (),
  paper: "a4",
  landscape: false,
  body
) = {
  // --- ページ設定 --------------------------------------------------------
  set page(
    paper: paper,
    flipped: landscape,
    // 左右 30mm で本文幅 150mm → 10.5pt の和文で約 40 字/行
    // Typst 既定の 2.5cm だと 49 字になり、和文では長すぎる
    margin: (top: 24mm, bottom: 22mm, x: 30mm),

    header: context {
      if counter(page).get().first() > 1 {
        set text(8pt, fill: luma(115))
        grid(columns: (1fr, auto),
          align(left, title),
          align(right, version))
        v(-6pt)
        line(length: 100%, stroke: 0.4pt + luma(205))
      }
    },

    // ★ 「1 / 10」形式。日本のビジネス文書の定番
    footer: context {
      set text(8pt, fill: luma(115))
      align(center)[
        #counter(page).display("1") / #counter(page).final().first()
      ]
    },
  )

  // --- 和文の基本設定 ----------------------------------------------------
  // ★ lang: "ja" が禁則処理と CJK の行分割を有効にする。最重要の1行
  set text(
    font: ("Noto Sans CJK JP", "Noto Sans JP", "IBM Plex Sans JP"),
    size: 10.5pt,
    lang: "ja",
  )

  set par(
    justify: true,            // 両端揃え。和文では必須
    leading: 0.85em,          // Typst 既定 0.65em は和文には狭い
    first-line-indent: 1em,   // 段落の1字下げ。日本の文書の標準
    spacing: 1.1em,
  )

  // --- 見出し ------------------------------------------------------------
  set heading(numbering: "1.1")
  show heading: it => {
    // above を below より大きく → 前の段落から離れ、直後の本文と結びつく
    set text(weight: 600)
    set block(above: 1.7em, below: 0.85em)
    set par(first-line-indent: 0em)
    if it.level == 1 {
      block(width: 100%, inset: (y: 5pt), stroke: (bottom: 1.2pt + rgb("#2f5f7f")),
        text(15pt, it))
    } else if it.level == 2 {
      text(12.5pt, it)
    } else {
      text(11pt, it)
    }
  }

  // --- コードブロック ----------------------------------------------------
  show raw.where(block: true): it => block(
    width: 100%, fill: luma(247), inset: 9pt, radius: 2pt,
    stroke: 0.5pt + luma(222),
    breakable: true,          // 長いコードはページを跨いでよい
    text(8.5pt, font: ("Noto Sans Mono CJK JP", "DejaVu Sans Mono"), it),
  )
  show raw.where(block: false): it => box(
    fill: luma(243), inset: (x: 3pt), outset: (y: 2.5pt), radius: 1.5pt,
    text(9.5pt, font: ("Noto Sans Mono CJK JP", "DejaVu Sans Mono"), it),
  )

  // --- 表 ----------------------------------------------------------------
  set table(stroke: 0.4pt + luma(185), inset: 6pt)
  show table.cell.where(y: 0): set text(weight: 600)

  // --- リンクに下線（★ 白黒印刷で色が飛ぶため） --------------------------
  show link: it => underline(offset: 2pt, stroke: 0.4pt, text(rgb("#1d3b53"), it))

  // ======================= 表紙 =========================================
  page(header: none, footer: none, numbering: none)[
    #set par(first-line-indent: 0em)
    #v(46mm)
    #align(center)[
      #if company != none [ #text(9.5pt, fill: luma(105), company) #v(7mm) ]
      #text(21pt, weight: 600, title)
      #if subtitle != none [ #v(4mm) #text(12pt, fill: luma(85), subtitle) ]
      #v(18mm)
      #table(columns: 2, stroke: none, align: (right, left), inset: 4pt,
        text(9.5pt, fill: luma(105))[版　数], text(10pt)[#version],
        text(9.5pt, fill: luma(105))[作成日], text(10pt)[#date],
        text(9.5pt, fill: luma(105))[作成者], text(10pt)[#author],
      )
    ]
    #if approvals.len() > 0 {
      place(top + right, approval-box(approvals))
    }
  ]

  // ======================= 改訂履歴 =====================================
  if revisions.len() > 0 {
    set par(first-line-indent: 0em)
    heading(level: 1, numbering: none, outlined: false)[改訂履歴]
    table(
      columns: (auto, auto, auto, 1fr),
      table.header([版数], [日付], [担当], [内容]),
      ..revisions.map(r => (r.ver, r.date, r.by, r.note)).flatten()
    )
    pagebreak()
  }

  // ======================= 目次 =========================================
  {
    set par(first-line-indent: 0em)
    show outline.entry.where(level: 1): it => { v(6pt, weak: true); strong(it) }
    outline(title: [目次], indent: 1.2em, depth: 3)
  }
  pagebreak()

  // ======================= 本文 =========================================
  counter(page).update(1)
  body
}
