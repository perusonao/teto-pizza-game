# Cooking Fry — F2 前の非 HOT 拡張 Result Report (Issue #749)

Status: **Draft PR・merge は Owner 承認待ち**。Production OFF・未配線。base = `main` `cf0c865`。
Claim: Issue #749 コメント 6831100109（専用 claim、〜2026-11-19）。

## 1. 監査（着手前）

| 項目 | 結果 |
|---|---|
| 既存 FRY 実装 | F1 は #750 で main 済み（`src/logic/fry/**`、`fryIngredients`、`fryExperienceGate`、`fryPreview`）。reducer / UI 配線なし。`FRY_EXPERIENCE_PRODUCTION=false` |
| eggplant | `pieceVisual` なし → `canFryIngredient("eggplant")===false`（休眠）。専用 SVG は別ブランチ（`claude/eggplant-ingredient-svg-13rbjw`、#782）。本 PR は `ingredients.ts` を編集しない |
| 他 PR との重複 | open PR（#836〜）に FRY 系なし。#795 MID_BAKE 系（#829〜#834）、#738、#746 と変更ファイルの重なりなし。`midBakeArchitecture.test.ts` / `drizzle.architecture.test.ts` の fry 禁止検査は通る |
| claim の重なり | F1 claim（6633217463、〜11/18）と同一ファイルを編集。F1 は merge 済み、保持者へ直接連絡不可のため専用 claim に明記。Lab claim（6691360461）の `fryLab/**` / `main.tsx` とは重ならない |
| 未承認事項 | Lab 用 `LATER_SLICES` 2 行追加（コメント 6701290104）は**承認が無いため実施していない** |

## 2. 変更（テスト中心、挙動は不変）

- `data/fryIngredients.ts`: `fryTargetStatus()`（`not-target` / `dormant` / `active`）を追加。`canFryIngredient` は同じ規則のまま `status === "active"` に。
- `logic/fry/fryOffer.ts`: 任意の `pieceVisualOf` テスト seam を追加（本番の呼び出しは未指定）。
- テスト: 登録の整合（実在・重複なし・topping・理由の名前付け）、offer の有効側（GUIDED / FREE_COOK のみ、LUNCH_RUSH / DINNER は常に null、done 表示、各拒否条件、返り値に recipe / score を含まない）、fried look（決定性、単調性、有限小数、`--fry-*` のみ）。
- architecture test: `--fry-*` / `ingredient-piece--fried` の他ファイル混入禁止、opt-in 名の漏れ禁止、本番スイッチが `false` で gate の ON 経路が Preview/DEV のみ、offer / 登録が recipe・score・Research を読まない、登録の import が catalog の読み取り 1 件のみ。

## 3. 触っていないもの
`gameReducer.ts`、`GameScreen.tsx`、`PizzaStage.tsx`、`App.tsx`、`App.css`、`ingredients.ts`、Production 配線、共有 Preview、`fryPot/fryTap/fryDrag/fryPreview/fryExperienceGate`。

## 4. 検証
- 検出力: `App.css` に `--fry-` を追記 → architecture test が失敗、`FRY_EXPERIENCE_PRODUCTION=true` に変更 → 失敗（いずれも元に戻して確認）。
- 対象 Vitest（fry / fryIngredients / fryPreview / midBake / drizzle）: 15 files・190 tests pass。`tsc -b` clean、`oxlint` は既存警告のみ。
- 全 Vitest（ローカル）: 663 files passed | 3 skipped、12283 tests passed | 20 skipped | 2 todo、失敗 0。

## 5. HV
UI / ゲームプレイ / 見た目の変更なし（未配線のロジックとテストのみ）のため、HV 動画・スクリーンショットは対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` の適用範囲外）。実機 iPhone の確認は主張しない。

## 6. 未決・次
- Owner: Lab 用 2 行追加の可否、eggplant 専用絵の Gate、F2（reducer、HOT）の開始。
- merge は Owner 承認待ち。Production ON・共有 Preview 更新なし。
