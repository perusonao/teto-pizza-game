# FINISH D2 — P1-0 調査結果（docs-only、#294 / #465 項目 10）

main `573e2a6`、2026-10-16。コード・テスト・Issue・他 PR は変更していない（読み取りのみ）。Owner Decision 表は
`docs/decisions/TETO_FINISH-D2_OWNER-DECISION-TABLE.md`。

## 1. #468（HOLD 維持）— 最新 main との差分と、FINISH 描画の独立性

- #468 は base `41efe27`（古い）。`git merge-tree` で最新 main と合成すると **`src/components/PizzaStage.tsx` が content conflict**
  （main 側で #507 などが同ファイルを変更したため）。他の変更ファイル（`bakeVisual.ts`、`App.css`、テスト、e2e）は衝突なし。
  #468 を close / rebase / merge はしていない。HOLD のまま。
- #468 が `PizzaStage.tsx` で触るのは 19 行で、配置済み具材の描画部（`cheesePieceStyle` の導入と `IngredientPieceVisual` の `style` 引数）。
  FINISH の描画が必要とする変更は別の領域:
  1. `interactive` を POST_BAKE の FINISH で true にする条件（`GameScreen.tsx`、PizzaStage の props 側）
  2. 後乗せ piece の描画区分（D2-0 の `pieceBakeClass` / `partitionPiecesByBakeClass` は純粋層として main にあり、PizzaStage から未参照）
- **結論: FINISH 描画は #468 から独立して実装できる**。条件は「#468 が編集する描画ブロック（`IngredientPieceVisual` の style 引数）に
  触れず、後乗せ piece の描画は新しい小さな関数 / 要素として追加する」こと。そうすれば #468 の hunk と重ならない。
  ただし #468 は現状でも main と衝突しているため、将来 merge する場合の解消は #468 側の作業（FINISH とは無関係）。
- 要確認（Owner）: #501 で Canvas モッツァレラが本番既定になっており、#468（M1 の CSS 溶け表現）の位置づけが変わっている可能性。HOLD の理由
  （実機 HV で「判断できない」）と合わせて、#468 を今後どうするかは Owner 判断。

## 2. #478 非依存のタップ設計（FINISH の必須条件にしない）

- main の配置経路は、`PizzaStage` のポインタ入力（`interactive` が true のとき、押下→離す／タップで `activeIngredient` を置く）と
  トレイでの材料選択。**これはドラッグ統一（#478）とは別経路**で、#478 は `physicalDragEnabled`（PREPARE 限定）を追加するだけ。
- reducer は D1b で完成済み: `PLACE_TOPPING` は POST_BAKE の FINISH でも通る（Guided かつ FINISH を持つラウンドのみ、
  トッピング限定、後乗せ在庫ゲートあり）。Undo も FINISH 限定規則が入っている。
- 画面側の不足（D2-1/D2-2 で必要になるもの）:
  - `GameScreen`: FINISH で `PizzaStage` を `interactive` にし、トレイ（現状 `phase === "PREPARE"` でのみ描画）を FINISH でも出す
  - トレイの表示対象を FINISH 用に絞る方法（ガイドの BBQ は後乗せ要件の材料を主、他は Owner 判断）
  - 「仕上げ完了」ボタン（`CONFIRM_MAKING_STEP`）と、0 個スキップが FAILED になることの表示
  - 仕上げヒント（D2-0 の `buildFinishHintLine`）の配線
- タップは #478 がマージされてもされなくても動くようにする。#478 が後から入る場合、FINISH のトレイにも同じドラッグが効くかは
  #478 側のゲート（`physicalDragEnabled`）を拡張するかどうかであり、FINISH の完了条件には含めない。

## 3. #489 の取り扱い

- #489 は「ソース残量ゲージ」の Issue として維持（本文・題どおり）。複数ソース対応とは別。
- 注意: #498（B1: ソース別 ledger）と #500（B2: ソース別描画レイヤー）は commit 題が #489 参照だが、#489 の本文（残量ゲージ）とは
  内容が噛み合っていない。これらは複数ソース対応の基盤になり得る一方、#489 の範囲外に見える。
- 本 PR では #489 を編集しない。複数ソース（TQ-3）が必要になった時点で、既存 Issue の有無を再検索のうえ Owner 判断で扱いを決める。
  今の段階では**新規 Issue を作らない**。

## 4. #465 ロードマップ更新案（コメントとして追記する想定。本文は未変更）

最新 merged 基盤に合わせた項目 10 の内訳案:

| 項目 | 状態 | 根拠 |
|---|---|---|
| 8. PR-C `finalizeRound` | 完了（#490、MERGED） | 既記載 |
| 10-a. FINISH engine D1a 純粋層 | 完了（#491） | main |
| 10-b. D1b reducer 配線（fixture のみ） | 完了（#497） | main |
| 10-c. CS-4a 7 タブ圧縮チップ | 完了（#499、7 タブは fixture のみ） | main |
| 10-d. D2-0 選択ロジック・描画区分・ヒント | 完了（#504、未配線） | main |
| 10-e. P1-0 Owner Decision 表 | 本 PR（docs-only、merge 待ち） | — |
| 10-f. D2-1 FINISH の盤面描画 | 未着手（#468 非依存、設計は §1） | OD-CS-8、UD-E |
| 10-g. D2-2 GameScreen / トレイ / 完了ボタン | 未着手（#478 非依存、設計は §2） | D2-1 |
| 10-h. D2-3 Free Cooking の仕上げタブ | 保留 | UD-B / OD-CS-4 |
| 10-i. P4a TQ-2 技法基盤 | 保留 | UD-D / G、共通ゲート |
| 10-j. P4b BBQチキン有効化 | 保留 | UD-F / I、P4a |

実装と本番デプロイは区別する。上記「完了」は main への merge のみで、本番デプロイの確認は未実施。
同時に項目 4（Bake Human Feel）、5（#421）の最新状態は本調査では再確認していない。

## 5. FINISH 画面（D2-1/D2-2）に着手するための最小条件

1. Owner 回答: **OD-CS-10（BBQ 正式記録）、OD-CS-8（FINISH を Cooking Time に数えるか）、UD-E（ガイドの仕上げ表示範囲）**。
2. 本 docs PR（P1-0）のマージ判断は Owner（Claude はマージしない）。
3. 実装は BBQ 型の test-only fixture のまま（`RECIPES` への追加禁止は維持）。#503 / #515 には触れない。
4. HV: 390×844 の動画と before/after スクショ（`TETO_HUMAN-VERIFICATION-POLICY.md`）。FINISH が本番レシピで有効になるまで画面は変化しないため、
   fixture 用の dev 入口をどうするか（ハーネス方式は #499 の `e2e/harness` が前例）を D2-1 の設計で決める。
5. 競合管理: #468 の描画ブロックに触れない、#478 の `GameScreen` 差分とは `physicalDragEnabled` 周辺に近づかない。

## 6. 概算（私の見積もり、実測ではない）

D2-1 2〜3 日、D2-2 2〜3 日、D2-3 は UD-B 後 1〜2 日。P4a/P4b は別途（前回報告のとおり）。
