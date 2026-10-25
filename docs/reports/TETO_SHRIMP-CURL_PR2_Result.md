# むきエビ SVG（`shrimp-curl`）— Result Report（PR-2）

柚子胡椒の色変更（PR-1）とは別 PR。Style Lock v2 §1d に採用変更を記録。

## 変更
- `shrimp` に `pieceVisual: "shrimp-curl"` を追加（`ingredients.ts`）。型 `DedicatedIngredientVisual`、`IngredientGlyph.tsx`（viewBox 64×64・`ShrimpCurl`）、`App.css`（1.2em 補正、既存グループへ追記のみ）。
- 図は Owner 承認済みの比較試作 `shrimp-p1.svg` をそのまま使用（細身 C 字・淡ピンクの身・橙の輪郭、目・触角・足なし）。
- テスト: `IngredientGlyph.test.tsx`（dedicated 一覧・SVG 描画・絵文字非表示・`circle` なし・`id=`/`url(#` なし）。`lateCatalog.offGolden` の ingredients digest を再生成（arugula と同じ理由: `pieceVisual` 追加のみ、id・順序・配置・解禁は不変）。
- 文書: `TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` §1d（理由・Lock との差分・原典との関係）。

## 変更していないもの
採点、材料 ID（`shrimp`）、レシピ、ladder、セーブ形式、`emoji`（テキストフォールバックのまま）、トッピングのサイズ区分（`m`）。

## 影響レシピ
`pesto-gamberi`、`yuzu-shrimp-pizza`（描画のみ）。

## 検証
下記スクリーンショット（390×844 / 360×800）と vitest / tsc / oxlint の結果は PR 本文を参照。実機 HV は Owner。

## 検証結果
- vitest 全体: 526 files passed / 1 skipped、9698 tests PASS（`lateCatalog.offGolden` の ingredients digest は arugula と同じ理由で再生成）。`tsc -b` OK、`oxlint` は既存警告のみ。
- e2e の更新: `expansion1-pesto-gamberi.spec.ts` が絵文字 `🦐` の文字列を assert していたため、`svg[data-ingredient-visual="shrimp-curl"]` の存在確認に変更（ショップ行・在庫行）。
- 実ゲーム e2e（390×844 / 360×800、`new-sauces-u1` と `expansion1-pesto-gamberi`）: 上記変更後、シナリオは最後まで完走。`expansion1-pesto-gamberi` の末尾 `expect(errors).toEqual([])` が console の `404 (Not Found)` で失敗するが、**origin/main でも同一に失敗**（サンドボックス起因、本変更と無関係）。`new-sauces-u1` の同アサートは実行ごとに揺れる（main でも同様）。
- 20px / 28px: 実ゲーム画面（トレイチップ・ピザ上・ショップ・在庫）と、比較モック（`size-check-28px-comparison-mock.png`、モックであり実画面ではない）で確認。28px は橙の輪郭でチーズ（クリーム〜白の楕円）と判別可。20px は C 字の形が残る。焼成後（生地・チーズが黄色寄り）は淡色のコントラストが下がるが輪郭で判別可。

## スクリーンショット
`docs/reports/screenshots/shrimp-curl-pr2/`: `before-after-390x844.png` / `before-after-360x800.png`（上段 before=main、下段 after。左から yuzu 具材配置 / yuzu 焼成後（FINISH）/ pesto-gamberi RESULT / ショップのチップ / 在庫）、および個別画像。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| shrimp-curl-pr2-pesto-gamberi-390x844.webm | 390×844 | 63.2s | 3.1MB (VP8) | PASS |
| shrimp-curl-pr2-yuzu-shrimp-390x844.webm | 390×844 | 35.0s | 1.4MB (VP8) | PASS |

Download: セッション内直接提出（repository 未 commit）。

Video Verification: PASS

この動画で確認すること:
- エビがむきエビ（淡ピンクの身・橙の輪郭）に見え、殻付きの赤い小エビに見えないか。
- ピザ上（約28px）・トレイチップ・ショップ・在庫で、チーズ・生地・ソースと見分けられるか。
- 焼成前後で淡色が生地に埋もれないか（pesto-gamberi の緑背景、yuzu-shrimp の黄緑〜オリーブ背景の両方）。
- 2 レシピ（pesto-gamberi / yuzu-shrimp-pizza）の操作・判定・スコアが以前と同じか。

## iPhone HV 手順
1. 在庫にエビがある状態で「ピザを作る」→ pesto-gamberi を作る。ジェノベーゼ→モッツァレラ→エビ配置→焼く→完成。ピザ上のエビの見た目を確認。
2. 柚子えびピザ（PR-1 の色変更が先にマージされていれば新色、そうでなければ旧色）でも同様に確認。
3. ショップ・在庫・図鑑・ヒントで 20px 前後のエビを確認。
4. 見づらければ Owner が 案2（太め・節線）または Style Lock 採用案（殻付き）へ戻す判断をする。

## 残リスク
- 焼成後の黄色寄りの背景で淡ピンクのコントラストが下がる（輪郭で判別可だが実機で要確認）。
- `App.css` は HOT ファイル。open の #468（モッツァレラ溶解）も `App.css` を触るため、後から merge する側が rebase する（本 PR の変更は既存の 1.2em グループにセレクタを 1 つ追記するのみ）。
- 実 e2e の末尾 404 はサンドボックス起因で main と同一。
