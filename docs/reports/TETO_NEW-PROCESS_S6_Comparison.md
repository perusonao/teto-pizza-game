# New Process S6 — 新工程候補の比較（実装コスト・ゲーム性・既存コードへの影響）（#773、docs-only）

main `3a41bb6`、2026-11-06。新規ファイルのみ。**「推奨」は助言で Owner Decision ではない。** 解放レシピ数は `TETO_CONTENT-POOL_S2_Result.md` の静的ゲート（重複なし・Jaccard ≤ 0.4）を通った行の数で、【推論】。実装コストは既存コードの調査に基づく【見積り】で、実測ではない。

## 1. 比較表

| 候補 | 解放できる行（静的ゲート通過、READY/ブロッカー） | 実装コスト | ゲーム性（iPhone） | 既存コードへの影響・HOT | 既存 Issue／claim | 総合 |
|---|---|---|---|---|---|---|
| **A. DOUGH_VARIANT 3 値目**（piadina ほか） | **9 行**（piadina〔READY・新食材 0〕、manakish〔READY・+2〕、poutine〔READY・+3〕、turkish-pide、lahmacun、carciofi-salad、cicoria、puntarelle、fruit-dessert） | **中**。`DoughKind` は 2 値（`standard`／`material-multigrain-long-ferment`＝Pinsa）で基盤あり。3 値目はチップ UI の一般化（G5）、`pendingRound.dough` の旧ビルド互換（G6）、投入時機（G7）、原典（G8）が HOLD | 中。生地の見た目と焼成が変わる。操作の追加は小さい | `doughKind.ts`・`discoveryCatalog.ts`・Research チップ・保存。**Anti-Oracle と保存互換が要注意**。`recipes.ts`（HOT）は各レシピ PR | #577（Pinsa 出荷済み）、設計 Gate `TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md`。claim は取得範囲では無し | **最大のレシピ解放量。Owner 判断（G5〜G8）が先** |
| **B. late／後乗せ（POST_BAKE・DRIZZLE）の本番化** | **7 行**（teriyaki〔食材 0〕、buffalo-chicken、smore、eel、natto、nutella、truffle。多くが BLOCKED） | **大**。FINISH 工程・Scoring 2.0・Dex 表示・保存。late カタログは本番 OFF、後乗せ描画は #518 が前提 | **高**（操作の幅が最も増える）。#746 DRIZZLE Gesture Lab が試作済み | `PizzaStage.tsx`・`GameScreen.tsx`・`gameReducer.ts`・採点。**STEAM（#738）と HOT が衝突**。`src/main.tsx` は #738・#746・#757 が共有 | #579、#604、#611、#621、PR #746（open）、#608 | ゲーム性は最良だが**重く、#738 の後**。解放レシピは BLOCKED が多い |
| **C. FRY（揚げる）** | **1 行**（pizza-fritta〔READY・新食材 0〕）。Phase 1 は既存 3 レシピの体験のみ（新レシピ 0） | Phase 1 小（F1 の純粋ロジックは main）。Phase 2（`FRY_COOK`）は**大**（BAKE 置換・識別 cook 軸・Hint 5.0／DH4 再実行） | 高（泡の大きさと勢いで判断） | Phase 2 は `signature.ts`・matcher・採点・RESULT 文言 | #749（claim 〜11-18、F2 は #738 merge と eggplant 絵まで HOLD） | **工程としては「数える」候補だが、レシピ解放は 1** |
| **D. PREP「炒め」（Cooking Prep）** | **1 行**（kimchi〔新食材 1・BLOCKED〕）。yakiniku は 0.50（例外要） | 中（Phase 1 spec あり、beef の炒めは実装済み・Preview/DEV） | 中〜高 | #760 で beef の絵が刷新済み。本番 OFF 想定 | #696、Phase 1 spec §18（実装未承認） | 食材 yakiniku-sauce の前提。解放は少ない |
| **E. MULTI_SAUCE** | 新規 0（機構は出荷済み。Grandma は #540 HOLD） | — | — | — | #521、#540 | **新工程としては数えられない**（既に使える） |
| **F. ZONED（領域配置）** | **0 行**（quattro-stagioni は `funghi` を内包で禁止） | 大 | 高 | 配置・採点の全面 | #620 | **解放 0 のため非推奨** |
| **G. PAN_BAKE（天板焼き）** | **0 行**（候補は全て Jaccard>0.4 または重複） | 大（Epic #532、A〜D・F の多数 Issue） | 中 | 生地形状・描画 | #532（HOLD）、#540 | 解放 0 のため非推奨 |
| **H. LAMINATE／ENCLOSE** | feteer 1（BLOCKED）／scacciata・fugazzeta（Jaccard>0.4）ほか | 大 | — | 生地・形状 | なし | 非推奨 |

## 2. 採点（0–5、実装コスト〔高いほど低コスト〕・ゲーム性・既存コードへの低影響・解放レシピ・Owner 判断の少なさ）

| 候補 | 低コスト | ゲーム性 | 低影響 | 解放 | 判断の少なさ | 合計 |
|---|---:|---:|---:|---:|---:|---:|
| A. DOUGH_VARIANT | 3 | 3 | 3 | **5** | 1（G5〜G8） | **15** |
| B. late／後乗せ | 1 | **5** | 1 | 3 | 2 | 12 |
| C. FRY | 2 | 4 | 3 | 1 | 3 | 13 |
| D. PREP 炒め | 3 | 3 | 4 | 1 | 2 | 13 |
| F. ZONED | 1 | 4 | 1 | 0 | 2 | 8 |
| G. PAN_BAKE | 1 | 3 | 2 | 0 | 1 | 7 |

数値は私の見積り（モデル計算ではない）。差が小さいので順位は Owner の価値判断（「遊びの新しさ」か「レシピ数」か）で入れ替わる。

## 3. 推奨

**目標（食材 8・レシピ 20）を優先するなら、「新調理方法 2」の 2 つ目に A（DOUGH_VARIANT 3 値目）を推奨**。理由: (1) 通過行の解放量が最大（9 行）。(2) STEAM／FRY／late と **`PizzaStage.tsx`・`GameScreen.tsx`・`gameReducer.ts` を共有しない**（生地・Research・保存の層）。(3) Pinsa で基盤は出荷済み。
**調理の遊びの新しさを優先するなら B（late／後乗せ）**。ただし #738 の後で、DRIZZLE の試作（#746）の Owner 判断が先。

STEAM／FRY との干渉: A はほぼ無し。B・C は `src/main.tsx`・`PizzaStage.tsx`・採点で競合。

## 4. 「追加調理方法 2」の数え方（Owner 判断案）

| 案 | 内容 | 注記 |
|---|---|---|
| 1 | STEAM＋FRY Phase 1 を本番 ON したら 2 | 新レシピ解放は 0。遊びの幅のみ |
| 2 | STEAM（本番 ON）＋ DOUGH_VARIANT 3 値目（piadina ほか） | **解放量が最大**。調理方法ではなく「生地の種類」を数えるか要判断 |
| 3 | STEAM＋late（DRIZZLE 本番化） | 最も重い |

## 5. 次に着手できる最小タスク（Owner 承認後）

| タスク | 範囲 | 備考 |
|---|---|---|
| A の Gate（G5〜G8）の Owner 回答資料 | docs-only | チップ UI の方針、旧ビルド互換、投入時機、原典（pizzadb.jp は未到達） |
| B の #746 Gesture Lab の HV 判断資料 | docs-only | 既存 PR に push しない |
| C F2 | #738 merge と eggplant 絵の後 | 保有セッションが継続 |

**重複の確認:** 本比較は #216・#294・#579・#521・#620・#577・#532・#696 を置き換えず、各 Issue の Gate をそのまま参照する。新規 Issue は作らない。
