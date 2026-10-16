# FINISH D2-1 — 後乗せ piece の盤面描画（独立要素・本番では不活性、#294）

main `f76cc07`（P1-0 = #516 merge 後）。Owner 方針: モッツァレラ Canvas と #468 の描画処理は変更しない。D2-2 以降・本番レシピの有効化はしない。

## 変更

| ファイル | 内容 |
|---|---|
| `src/components/PostBakePiece.tsx`（新規） | `stage === "post"` の piece を 1 つ描く独立要素。`IngredientPieceVisual` に `style` を渡さない（= PREPARE と同じ無加工の見た目）。位置・回転・サイズ区分（`--piece-rank-scale`）は焼成前 piece と同じ。`data-topping-stage="post"` 付き |
| `src/components/PizzaStage.tsx` | `partitionPiecesByBakeClass`（D2-0）で焼成前/後乗せを分け、従来の `toppingsFor` は焼成前だけを対象に。後乗せは `postToppingsFor` → `PostBakePiece`。カット時の「全体が属する piece + 隣へはみ出した部分（half）」の判定は共通（`piecesIn`） |
| テスト | `PizzaStage.postBakePiece.test.tsx`（新規 5 件）。`pieceRankScale.test.tsx`（on-pizza ラッパーの許可リストに `PostBakePiece.tsx` を追加）、`finishD2Inert.test.ts`（`pieceBakeClass` の利用者を PizzaStage に限定。他の D2-0 ヘルパーは引き続き未使用を検証） |

## 変更していないもの

`CheesePoolCanvas` と Canvas モッツァレラの分岐、`cheeseStyle` / `cheesePieceStyle` 相当の焼成前の描画ブロック、`bakeVisual.ts`、`App.css`、`GameScreen`、tray、reducer、`RECIPES`、`cookingProfiles`。#468・#478・#503・#515 には触れていない。

## 不活性の根拠

- 焼成前 piece（`stage` なし / `"pre"`）だけのピザは、変更前と DOM が同一（テスト: `stage: "pre"` を明示した場合と無指定で `innerHTML` 一致。React の `useId` だけ正規化）。
- `stage: "post"` の piece を作れるのは FINISH ラウンドだけ（D1b）で、本番レシピに後乗せはない。
- 後乗せ piece にはフィルタ・溶けた Canvas・焼成変数が一切付かない（テスト: mozzarella でも `canvas` なし、`filter` なし、`--bake-cheese` なし）。
- 後乗せは焼成前の経路に二重に描かれない（`data-topping-id` が 1 つ）。カット後は 1 piece に全体、跨ぐ場合は隣に half が出る。RESULT でも描画される。
- ミューテーション確認: 実装を外す（`git stash`）と新テスト 4 件が失敗する。

## #468 との関係

`PizzaStage.tsx` は #468 と main（#507 の Canvas モッツァレラ）の間で、もともと 1 か所の content conflict がある。D2-1 を重ねても衝突は同じ 1 か所・同じ大きさで、追加した行（`postToppingsFor` の描画）は衝突範囲の外。#468 は HOLD のまま。

## 検証（ローカル）

- `npx vitest run`: 全 433 ファイル中、D2-1 の 2 件の見張りテスト更新後に PizzaStage / pieceRankScale / finishD2Inert を含む関連 17 ファイル 241 件が通過。直前の全件実行で失敗したのはこの 2 件の見張りのみ。
- `npx tsc -b`: エラーなし。`oxlint`: 変更ファイルに指摘なし。
- Human Verification: 不要（本番で見た目・操作が変わらない内部変更。D2-0 と同じ扱い）。D2-2 で FINISH 画面が出た時点で 390×844 の動画と before/after が必要。

## 次

D2-2（GameScreen / tray / 完了ボタン、タップ操作）。UD-E・OD-CS-8 は確定済み。#478 非依存。
