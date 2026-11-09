# M7 最初の適用（hot-honey-pepperoni の honey）— 二重適用・二重在庫消費の独立テスト設計（#780、docs-only）


> **Owner 承認（2026-11-09）:** 本書の設計方針、T-1〜T-6 の採用、honey を初号機とすること、buffalo-sauce は許可リストに追加しないこと。#776 merge 済み（`1d5f5a1e`）、#800 merge 済み。HOT 編集は B22 の claim 競合が解消するまで開始しない。
> **M7 の完成条件:** 許可リストへの 1 行追加だけでは**完成ではない**。M7 の完成には DRIZZLE D2 以降（journal、在庫の原子的消費、採点・識別、工程遷移、UI 接続）が要る。§4 の M7-PR1〜PR3 は「基盤の登録」までで、完成の判定は D2〜D5 の Owner ゲートを通った後。

2026-11-09 / 基準 main（#776 merge 済み `1d5f5a1e`）。**実装・HOT 編集はしていない。** 順序（Owner 承認 2026-11-09）: #776 merge ✔ → B22 の HOT 編集 → M7。HOT の claim が空くまで、本書（設計）と、HOT に触れない独立テストの形だけを進める。凡例: 【実測】読取り、【推論】設計。

## 1. 対象と現状【実測】
- 対象: `hot-honey-pepperoni`（staged）。要件は honey 1（`applicationPhase: "POST_BAKE"`）・mozzarella 3・pepperoni 2・tomato-sauce 1。ソースは `tomato-sauce`（family_derived）。RB-18。
- main の許可リスト: `POST_BAKE_LIQUID_INGREDIENT_IDS = ["olive-oil"]`（`src/logic/drizzle/postBakeLiquid.ts`）。型 `PostBakeLiquidIngredientId` が連動。M7 はここに `"honey"` を **1 行追加**する（M7-b）。buffalo-sauce は B22 で焼成前 PAINT（M7-d）なので**追加しない**。
- honey は B20-A で **焼成前の第 2 ソース（pesto＋honey、PAINT 系）として出荷済み**。同じ食材が、別レシピでは PAINT、hot-honey では POST_BAKE になる。

## 2. 必須条件と、それを保証する独立テスト【推論】
| # | 必須条件 | テスト（新規ファイル案 `src/data/m7HoneyNoDoubleApply.test.ts`、実装後に追加） | HOT |
|---|---|---|---|
| T-1 | **同一レシピ内の二重適用の禁止**: 1 つのレシピの `requiredIngredients` で、同じ `ingredientId` が **`applicationPhase: "POST_BAKE"` の要件と、そうでない要件（焼成前＝`applicationPhase` なし。カタログに `PAINT` という値は無く、型は `"POST_BAKE"` のみ）の両方に現れない**（全レシピを走査） | 本番カタログ全件。**hot-honey-pepperoni は現時点で staged のみ**（`stagedRecipes.ts`）なので、honey が POST_BAKE の 1 件のみであることは M7-PR3 までは staged データで検証し、本番カタログでは「0 件」のベースライン | なし（テストのみ） |
| T-2 | **レシピ間の排他の確認**: honey を焼成前の要件として持つレシピ（例: pesto-noci-pizza。honey は `recipeSauceProfiles` に行が無く「存在で採点」される、`recipeSauceProfiles.ts:392`）と、honey を POST_BAKE で持つレシピの集合は互いに素。**`recipeSauceProfiles` の PAINT 行は honey には無いので、判定は上の T-1 と同じ `applicationPhase` の有無で行う** | honey を焼成前で持つレシピ集合と POST_BAKE で持つレシピ集合が**互いに素**（hot-honey の追加後は、同一レシピが両方に入っていない） | なし |
| T-3 | **許可リストの一貫**: `applicationPhase: "POST_BAKE"` のソース／液体要件の食材はすべて `POST_BAKE_LIQUID_INGREDIENT_IDS` に載る（許可リストの各 id が実在する食材であることも確認する。「許可リストの食材が他の工程で使われない」という逆の条件は**課さない**: honey は焼成前でも使われるため） | 全 POST_BAKE 要件を走査、許可リストの食材 id が実在 | なし |
| T-4 | **二重在庫消費の禁止**: 1 回の調理で honey を 1 つの経路でしか消費しない。PAINT 経路の消費と、液体（journal）経路の消費が同じ食材について同時に起きない | 在庫の消費を数える純粋関数（D2 の journal 設計に依存）。**D2 は HOLD のため、今は「消費経路は 1 つ」の契約テストの形（入力＝レシピ＋置き方、出力＝消費する食材と回数）だけを固定**し、実装は D2 で | D2（HOLD） |
| T-5 | **バッファロー**: buffalo-chicken は POST_BAKE 要件を持たず、許可リストに buffalo-sauce が無い（M7-d） | カタログ・許可リストの断言 | なし |
| T-6 | 許可リストの変更は 1 行・honey のみ（Owner 承認範囲の固定）: `POST_BAKE_LIQUID_INGREDIENT_IDS` が `["olive-oil","honey"]` に等しい | 固定値のピン（拡張には Owner 承認が要ることを明示） | なし |

**検証可能性（独立レビュー 2026-11-09 の指摘を反映して訂正）:** T-6 は固定値のピンで今すぐ書ける。T-3 の前半・T-5 の許可リスト側も今書ける。T-1 は `applicationPhase` の有無で判定でき、hot-honey は M7-PR3 まで staged データが要る。T-5 の「buffalo-chicken が POST_BAKE 要件を持たない」は B22 の merge まで main にレシピが無いので自明に真（B22 後に意味を持つ）。T-3 と T-6 は honey の追加（M7-PR1）と同時に通るため、その PR にだけ同梱する（今は書かない）。T-4 は D2（HOLD）待ちで、契約の形だけ。

## 3. HOT に触れずに今できること
1. 本書の確定（Owner の追認）。
2. T-1・T-2 の**現状の本番カタログに対する事前測定**（今は honey が POST_BAKE のレシピが 0 件であることの確認＝ベースライン）を docs に記録する。HOT・テストコードは変更しない。
3. #776 が main に入ったので、`olive-oil` の**既存の回帰**（許可リストの型連動・`isPostBakeLiquidIngredient`）が honey 追加で壊れないことの確認項目を整理する（実装時）。

## 4. 実装の順序と停止条件
1. B22 の HOT 編集が完了（`lateCatalog.ts`・`ingredients.ts`・`recipeSauceProfiles.ts` 等の claim が空く）。
2. M7-PR1: 許可リストに `"honey"` 追加（1 行）＋ T-3・T-6。
3. M7-PR2: `validateLateCatalog` の緩和（許可リストの液体は POST_BAKE 要件可）＋ T-1・T-2・T-5。
4. M7-PR3: hot-honey-pepperoni の登録（RB-18）。UI・採点・在庫は D2〜D5（HOLD）。
**停止条件:** T-1/T-2 が落ちる、Research／Hint 5.0／DH4 の既存項目が動く、重複 Gate（X1: 後乗せ軸で分離）の再測定が通らない、HOT の claim が競合する。
