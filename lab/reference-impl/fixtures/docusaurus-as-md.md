---
id: inventory-design
title: 在庫管理システム 基本設計書
sidebar_position: 2
tags: [設計, API]
---


# 在庫管理システム 基本設計書 <Badge type="draft">レビュー中</Badge>

本書は、在庫管理システム（以下「本システム」という。）の基本設計を示す。
応答が 200 以外のとき（タイムアウトを含む。）は、3回まで再送を行う。

:::note

Webhook の受信側は、同一の `orderId` が2回以上届くことを前提に実装すること。

:::

:::warning[在庫の反映は即時ではない]

引当の要求を送った直後に在庫数を参照すると、反映前の値が返ることがある（結果整合）。

:::

:::danger

本番の在庫データを検証環境へ複製してはならない。取引先名と単価が含まれる。

:::

## インタフェース

<Tabs groupId="lang">
  <TabItem value="ts" label="TypeScript" default>

```ts title="src/client.ts" showLineNumbers {2-3}
const res = await fetch("/api/v2/orders", {
  method: "POST",
  body: JSON.stringify(order),
});
```

  </TabItem>
  <TabItem value="py" label="Python">

```python title="client.py"
res = requests.post("/api/v2/orders", json=order)
```

  </TabItem>
</Tabs>

## 非機能要件

| 項目 | 目標値 | 測定方法 |
| --- | --- | --- |
| 応答時間 | 95%tile で 300ms 以内 | APM |
| 稼働率 | 平日 8:00〜20:00 で 99.9% | 死活監視 |

- [x] 性能試験の実施
- [ ] 負荷試験の実施
  - [ ] 想定の2倍で確認

在庫回転率は $r = C / I$ で表す。安全在庫は次式による。

$$
S = z \cdot \sigma_L \cdot \sqrt{L}
$$

詳細は [移行計画書](./migration.md#切り戻し) を参照[^1]。
キーボードは <kbd>Ctrl</kbd> + <kbd>S</kbd> で保存する。

![構成図](./img/architecture.png)

[^1]: 停止時間は最大2時間を見込む。
