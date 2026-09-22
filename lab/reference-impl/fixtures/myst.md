---
title: MyST 記法で書いた比較用
authors:
  - name: 設計 太郎
abstract: |
  mystmd が本来想定している書き方をしたとき、どんな Typst が出るか。
---

# MyST の書き方

:::{note}
MyST の admonition は `:::{note}` で、Docusaurus の `:::note` とは括弧の有無が違う。
:::

:::{warning} 在庫の反映は即時ではない
引当の要求を送った直後に在庫数を参照すると、反映前の値が返る。
:::

```{figure} ./img/architecture.png
:name: fig-arch
:width: 60%

システム構成図
```

図 {ref}`fig-arch` に示す。数式は次のとおり。

```{math}
:label: eq-safety
S = z \cdot \sigma_L \cdot \sqrt{L}
```

{eq}`eq-safety` で安全在庫を求める。
