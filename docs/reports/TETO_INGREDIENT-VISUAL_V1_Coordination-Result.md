# Ingredient Visual V1 — 担当間調整 Result Report

Status: **調整と準備のみ（docs-only）。** V1 の実装・製品コード変更・共有 Preview 更新・merge・Monitor 作成は行っていない。
親資料: `TETO_INGREDIENT-VISUAL_B10-Fresh-Audit.md`（Audit）、`TETO_INGREDIENT-VISUAL_V1_Prep-Result.md`（準備）。

## 1. Owner 判断（2026-10-27、記録）

| # | 判断 |
|---|---|
| 1 | pickle / wurstel / paprika-powder の SVG 候補 3 点（`pickle-slices` / `wurstel-links` / `paprika-powder-pile`）を**暫定採用** |
| 2 | V1 の実装開始は **PR #679 の merge 後**（最新 main から） |
| 3 | V1 は 3 食材を **1 PR** にまとめる |
| 4 | SVG の**最終採用条件は 390×844 と 360×800 の実画面 HV** |
| 5 | mustard の色変更は**保留**（Audit の `#e8c814` 案は実施しない） |
| 6 | beef SVG は **PR-2 担当**。V1 では扱わない |

「暫定採用」なので、`docs/design/references/ingredient-icons-2.0/` への昇格と Style Lock 追記は、HV 合格後（V1 PR 内、Owner 最終確認）に行う。

## 2. 実施した調整（GitHub への書き込み 2 件）

| 宛先 | 場所 | 内容 |
|---|---|---|
| #679 担当（`01E7dMxPKhEEBDd9GWYtU64L`、担当一本化済み） | [#679 コメント](https://github.com/perusonao/teto-pizza-game/pull/679#issuecomment-6448920802) | V1 が同一ファイル（`IngredientGlyph.tsx` / `App.css` / `ingredients.ts` / `IngredientGlyph.test.tsx`）を触ること。V1 は #679 の追記位置を避ける（`hot-dog-slices` 直後・独立 CSS ルール、`git merge-tree` で V1 起因の追加衝突 0 を確認済み）。**#679 自身が現 main と 9 ファイルで衝突**していること（#686 取り込みが必要、late step・floors の再導出）。merge 時に一言ほしいとの依頼（任意） |
| PR-2 担当 | [#611 コメント](https://github.com/perusonao/teto-pizza-game/issues/611#issuecomment-6448924591)（claim の集約先。PR-2 の PR / claim はまだ無い） | **`beef` は #686 で main に既存**（PR-2 設計書の「新規」は古い）。既存 `beef` に `pieceVisual` を付与する形へ設計更新。牛肉 SVG は PR-2 側（候補 SVG はあくまで参考）。V1 との同一ファイルと順序 #679 → V1 → PR-2。V1 が再生成する golden は `lateCatalog.offSurface.json` の digest のみ |

- @メンションは使っていない（担当は個人アカウントでなくセッションのため、コメント本文で呼びかけ）。両コメントに Claude Code の attribution footer を付与。
- **限界:** 受信確認は取れていない（既読・返信は未確認）。PR-2 の担当セッションは特定できていない（PR-2 の claim が未投稿のため）。#611 は PR-2 の claim 予定先（設計書 §10-3）なので、そこに残した。
- V1 の claim は**投稿していない**（着手時に投稿。下書きは Prep-Result §8）。

## 3. 現況（確認時点）

- #679: **open・未マージ**、head `933e518`、`mergeable_state: clean`（#679 自身の base 基準）。現 main（`47268e3`）とは 9 ファイル衝突（Prep-Result §3.1）。
- main に描画関連の変化なし。V1 のブランチ・PR は未作成。

## 4. V1 開始時の手順（#679 merge 後）

1. 最新 main を取得し、再度 Duplicate Gate（open PR / Issue、#611 の claim、PR-2 の進捗）。
2. #611 に V1 の claim を投稿（files: `ingredients.ts` / `IngredientGlyph.tsx` / `IngredientGlyph.test.tsx` / `App.css` / `lateCatalog.offSurface.json` / `lateCatalog.offGolden.test.ts` / Style Lock doc）。
3. 実装: union・`VISUAL_VIEWBOX`・JSX 連鎖は `hot-dog-slices` の直後、コンポーネントは `HotDogSlices` の後、CSS は独立ルール（サイズ補正は実測後に要否判断）。3 食材の `pieceVisual` 1 行ずつ。**食材 ID・採点・在庫・レシピ定義・DH4・サイズクラスは不変。** golden は `lateCatalog.offSurface.json` の ingredients digest のみ意図して再生成（#667 と同じ理由。#679 の変更が digest に影響する場合は再確認）。
4. 検証: 対象テストのみ（`IngredientGlyph` / `IngredientPieceVisual` / `ingredients` / `lateCatalog.offGolden` / `expansionBatch10.pr1` / `ReferenceTruth`、`tsc -b`、`oxlint`）。全件は CI に任せる。
5. 実画面 HV: 390×844・360×800 × 3 状態（トレイ / 調理中 / 焼成後）。比較 **1 案 + 修正 1 回まで**。MP4（390×844）は Owner へ直接提出、スクショは `docs/reports/screenshots/ingredient-visual-v1/`。**HV 不合格の SVG は採用しない**（Owner 判断 4）。
6. PR 本文に「描画のみ」「暫定採用・最終採用は HV」「golden は digest のみ」を明記。merge は Owner 承認後。

## 5. 残る確認事項

- #679 の merge 時期（Owner の実機 HV 待ちで未定）。
- PR-2 担当の特定と、`beef` 設計更新の確認（#611 のコメントへの反応待ち）。
- #679 の merge 時に late catalog 側の変更で `lateCatalog.offSurface.json`（late OFF 時の表面）が動かないことの確認（動かない見込み。実装時にテストで確認）。
