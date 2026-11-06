# 新工程 第二候補 — late／後乗せ 並行設計ブリーフ（#773、docs-only）

2026-11-06、main `ed159e9`。**Owner 方針: 第二候補として並行設計**。実装しない。既存の追跡（#579 DRIZZLE、#604 TQ-2、#611 BBQ late、#621 ikura、#518 描画の前提、#608 FINISH UI、#495 Scoring、PR #746 Gesture Lab、PR #650 E5 docs）を置き換えない。

## 1. 現状

- late カタログ（`lateCatalog.ts`）と FINISH エンジンは存在するが**本番 OFF**（`lateCatalogEnabled()`）。Pinsa・ikura・yuzu・dengaku・BBQ などが late に載っている。
- 後乗せソース（DRIZZLE）は PR #746 の **Preview/DEV 限定 Gesture Lab** のみ（open、Owner 判断待ち）。
- FINISH の本番化前提として、保存の非原子性（#617 R8）、後乗せピースの焼成フィルター分離（#518）が open。

## 2. late で解放されるレシピ（S2 の静的ゲート通過行）

teriyaki（新食材 0・ソース未特定）、buffalo-chicken、smore、eel、natto、nutella、black-truffle。**多くが BLOCKED**（ソース未特定・構成競合）。honey の後乗せ版（hot-honey-pepperoni）は**集合規則で不可**（pepperoni の上位集合）。

## 3. 並行設計の範囲（実装しない）

| 項目 | 内容 | 依存 |
|---|---|---|
| L1 本番化の前提一覧 | #617（保存）・#518（描画）・#608（FINISH UI）・#495（採点）の現状と残件 | 各 Issue の Owner 判断 |
| L2 DRIZZLE の扱い | #746 の Lab の評価結果（Owner HV）を受けて、後乗せソースをトッピングと同じ枠に載せるか | #746 の Owner 判断。**#746 には push しない** |
| L3 STEAM との競合 | `src/main.tsx`（#738・#746・#757 が変更）、`PizzaStage.tsx`・`GameScreen.tsx` の統合順。#755 の OD-V3-7 に従う | #738 の merge 後 |
| L4 計上 | late／後乗せは「新工程」か「調理方法」か（Owner 方針の計上規則に照らして） | Owner 判断 |

## 4. 順序

DOUGH_VARIANT（第一候補）とファイルが重ならないため並行可能。ただし late の実装は **#738 の merge 後**（HOT の共有）で、本番化には上記前提の解消が要る。
