# 将来タスク整理 — FINISH 工程でチーズを置けるようにする拡張（docs-only・未着手・Owner 判断待ち）

**位置づけ:** burrata / crudaiola の検討（`docs/reports/TETO_BURRATA-PREFLIGHT_2026-11-05_Result.md`、`..._R2_Result.md`）から切り出した、**別の将来タスク**です。今回の burrata 系の実装は、この拡張に**依存しません**（burrata は焼く前に置く通常のチーズにする方針のため）。実装はしておらず、`src/` も変更していません。
**根拠にしたコード:** `main` `d85b957`（行番号はこの版）。行番号は変わり得るので、着手時に引き直してください。
**Owner 決定の拘束:** OD-CS-3（後乗せは recipe 側の情報で、素材には持たせない）、OD-CS-11（後乗せの駒は既存の Pieces / Recipe の採点で評価し、加点や規則の変更をしない）、OD-CS-7（焼成に失敗したら FINISH を飛ばす）。`docs/decisions/TETO_COOKING-STEPS-2.0_FINISH-ENGINE_OWNER-DECISIONS.md`。

## 1. 現状（確認済み）

FINISH ではチーズを置けません。理由は 3 か所の明示的な制限です。

| # | 場所 | 規則 |
|---|---|---|
| 1 | `src/state/gameReducer.ts` L1111–1112（`PLACE_TOPPING`） | `inFinish` のとき `placingIngredient.category !== "topping"` なら拒否 |
| 2 | `src/logic/prepareDock.ts` L51–57（`finishTrayIngredients`） | `ingredientsByCategory("topping")` だけを並べる |
| 3 | `src/state/undoPlacement.ts` L40–48 | FINISH の「1つ戻す」は `category === "topping"` の後乗せの駒だけ |

実機の確認（Chromium、390×844 と 360×800）: Free Cooking の FINISH トレイは具材 68 種を出し、チーズは 0 種（`docs/reports/data/TETO_BURRATA-PREFLIGHT-20261105_finish-tray.json`）。

**すでにチーズに対応している（カテゴリに依存しない）部分:** 判定の `late` 軸（`signature.ts`、`stage === "post"` の id だけを見る）、`pizzaForFinalEvaluation`（`finishEngine.ts`、late の id で絞る）、`canPlacePostBakeIngredient`（`inventory.ts` L165–173、`placement === "scatter"` と在庫だけを見る）、`validateLateCatalog`（`lateCatalog.ts`、素材のカテゴリを検査しない）、`piecesComponent.ts`（`stage` を参照しない）。

## 2. 必要な変更（案）

| 領域 | 変更 | リスク・要確認 |
|---|---|---|
| Reducer | `PLACE_TOPPING` の FINISH 分岐を、topping に加えて cheese も許す。cheese の「現在の工程」検査（`makingStep !== "CHEESE"` で拒否）は FINISH では通らないようにする | `gameReducer.ts` は HOT ファイル。他の PR と衝突しやすい |
| トレイ | `finishTrayIngredients` に cheese を加える。Free Cooking では所持チーズ全部（現在 14 種）が加わり、FINISH のトレイは 68 種・12 ページ（1 ページ 6 個）から 82 種・14 ページになる。Guided では late の要件に載るものだけ | Free Cooking の FINISH のトレイの長さと、チーズと具材をどう並べるか（現在 FINISH では family フィルタを出さない：`IngredientTray.tsx` の `!finish`）。カテゴリの切替を足すかどうかは UI の判断 |
| Undo | `undoablePlacementIndex` の FINISH 分岐でチーズも戻せるようにする | 在庫・FINISH の在庫表示（`あと a/b`）との整合のテスト |
| 描画 | 後乗せの駒は `PostBakePiece` が `IngredientPieceVisual` を style なしで描く。チーズは `.pizza-cheese` のラッパーに入る | **mozzarella（`pieceVisual` なしの CSS 形状）は、焼く前は Canvas の溶けるチーズだが、後乗せでは CSS の塊になる**。見た目の食い違いをどうするか（後乗せのモッツァレラを溶けない白い玉として許すか、そもそも後乗せ不可にするか）の Owner 判断が要る。`pieceVisual` を持つチーズ（burrata・feta・ricotta など）は SVG で描かれるので影響は小さい |
| CUT | 後乗せの駒は `.pizza-post-layer` に別描画され、切ったときは切断面の複製が要る（既存の仕組み）。チーズが大きい（サイズクラス `l`）ため、切断をまたぐ表示の確認が要る | CUT の footprint（S3）が post の駒を含めるか、既存のテストで確認 |
| 採点 | OD-CS-11 により既存の評価。`piecesComponent.ts` は `stage` を見ない。**チーズ固有の指標（溶けチーズの被覆・Canvas のチーズ池の判定）が post の駒を含むか／除くか**は未確認 | 実装 PR で、Scoring V2 とチーズ池（`cheesePool*.ts`）が post のチーズをどう扱うかを調査する。保存・採点の契約を変えない前提 |
| Hint | `finishHint.ts` は late の要件に載る素材の名前を出す。チーズでも文面は同じ（後乗せのチーズ名を Guided でだけ名指しする既存の規則） | Hint 5.0 の CHEESE 段が、後乗せのチーズの名前を出す（時期は出さない）。ikura / tarako の先例と同じで、規則の変更は不要の見込み |
| 識別（発見） | `late` 軸は素材の id だけを見る。後乗せのチーズと焼く前のチーズは、別の識別になる | 既存の発見に影響しない（既存の late レシピは topping だけ） |
| Research | cohort の文字は「最後に取得した有限素材」で決まり、後乗せかどうかを見ない | 変化なし |
| 対象外の維持 | Lunch Rush・Dinner は FINISH なし（`finishAllowedForRound`）。この拡張でも変えない | — |

## 3. 前提と順序

1. **Owner 判断:** 後乗せのチーズを許すか。許す場合、mozzarella の扱い（§2 の描画の行）と、Free Cooking のトレイの構成。
2. **ファイルの重なり:** `gameReducer.ts`、`prepareDock.ts`、`undoPlacement.ts`、`IngredientTray.tsx`、`PizzaStage.tsx`（#738 が編集中）。実装は #738 の merge 後が安全。
3. **最初の利用者がいない:** burrata は焼く前の素材にする方針なので、この拡張は**単独では誰も使いません**。実際に後乗せのチーズを要求するレシピ（例: 焼いた後に burrata をのせる設計）が決まってから着手するのが妥当です。先に基盤だけ作る場合は、既存の late レシピに影響しないこと（`finishTrayIngredients` の出力が topping だけの Guided で不変であること）をテストで固定します。
4. **検証:** 390×844 の HV 動画（FINISH でチーズを選び、置き、戻し、完成する）、WebKit の 390 / 360 の E2E、Free Cooking の FINISH のトレイの長さの確認。

## 4. Issue 案（Owner が必要と判断したときに起票）

> **FINISH でチーズを置けるようにする（基盤・未着手）** — FINISH は topping 限定（reducer・tray・undo の 3 か所）。burrata の検討から切り出した。着手条件: 後乗せのチーズを使う recipe が Owner により決まること、mozzarella の後乗せ描画の方針、#738 の merge。本番の挙動は変えない（既存の late レシピと Lunch Rush / Dinner は不変）。詳細: `docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`。
