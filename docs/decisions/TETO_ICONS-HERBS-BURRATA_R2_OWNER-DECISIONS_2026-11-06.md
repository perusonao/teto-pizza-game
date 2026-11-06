# Owner 決定記録 — ハーブ 4 食材のアイコン／burrata ／ pesto-burrata・crudaiola（R2、2026-11-06）

Status: **決定の記録（docs-only）。実装は未着手・HOLD。** 後続の実装セッションは、本書を権威として扱い、ここに記録した決定を再質問しない（`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` §8）。
根拠のレポート（各ブランチ、いずれも docs-only）:
- ハーブ: `claude/herb-icons-compare-docs-8auzii` の `docs/reports/TETO_HERB-ICONS-COMPARE_2026-11-05_R2_Result.md`（`c9351e4`）
- burrata: `claude/burrata-preflight-docs-8auzii` の `docs/reports/TETO_BURRATA-PREFLIGHT_2026-11-05_R2_Result.md`（`d39a680`）
- FINISH チーズ: 同ブランチの `docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`

## 1. 決定（Owner、2026-11-06）

| # | 決定 |
|---|---|
| D1 | **ほうれん草は A2**（濃い葉 2 枚＋明るい内側の縁・葉脈）を採用 |
| D2 | **アーティチョークは A2**（断面 1/4＋明るい内側の縁）を採用 |
| D3 | ローズマリー B（2 枝）、オレガノ B（乾燥フレークの小山）は前回の採用判断を維持 |
| D4 | **初期サイズは 1.2em**（既存のハーブ群と同じ。レイアウト上の占有は 1em）。**実装後に実寸の HV を行う** |
| D5 | **burrata の専用 SVG は C**（上が裂けてクリームが溢れる玉）を採用 |
| D6 | **crudaiola の Jaccard 0.429 を、このレシピに限り例外として承認**（jamon-serrano-pizza・grandma-pizza・pinsa-romana。全体の 0.4 基準、同一／部分集合／上位集合の禁止、Research の規則は変えない。将来の recipe の一括承認ではない） |
| D7 | **crudaiola はトマトソース＋オリーブオイルの 2 層を維持し、全食材を焼成前に配置**（R2 レポート §3.6 の案 P。late のカタログには入れない） |
| D8 | **pesto-burrata はペスト＋オリーブオイルの 2 層を維持**（主ソース pesto） |
| D9 | **FINISH でチーズを置く拡張は、独立した将来タスクとして保留**（今回の burrata 系はこれに依存しない） |

## 2. 実装開始の条件と、それまでの制約

- **開始条件:** PR **#765**（WebKit 360×800 の調理画面の横はみ出し、Issue #764）、PR **#759**（Batch 18）、PR **#760**（#733 牛肉・ピーマン）が merge され、関連する claims（#748 の `ingredients.ts` ほか、#733 の `IngredientGlyph.tsx` ほか、#764 の `App.css`）が解消していること。開始時に、最新の main・`CLAUDE.md`・`docs/PROJECT_HANDOFF.md`・SESSION-OPERATIONS・claims を読み直し、新しい独立ブランチと有効な `teto-claim:v1` を作る。
- **それまで:** 既存の PR の HEAD を変えない。追加の実装・merge・Production ON・共有 Preview の更新は行わない。
- 2026-11-06 の確認時点: #765（HEAD `1e332c1`）・#759（`33bc275`）・#760（`5ac2462`）はいずれも open・Draft または未 merge、main は `d85b957`。

## 3. 実装の分け方（案、claims の解消後に確定）

| PR | 内容 | 主な変更ファイル（HOT を含む） |
|---|---|---|
| **A: ハーブ 4 種のアイコン**（描画のみ） | `rosemary-B`・`artichoke-A2`・`oregano-B`・`spinach-A2` を `IngredientGlyph.tsx` に実装し、4 食材に `pieceVisual` を付ける。サイズは 1.2em（既存のハーブ群と同じ補正）。識別テスト（#733 と同じ方式）。食材 ID・`emoji`・`color`・family・サイズクラス・採点・Research・保存は変更しない | `src/components/IngredientGlyph.tsx`、`src/data/ingredients.ts`（`DedicatedIngredientVisual` と 4 行）、`src/App.css`（補正、HOT。#765・#761 の後）、`IngredientGlyph.test.tsx`、`docs/design/references/ingredient-icons-2.0/` の参照 SVG |
| **B: Batch 19（pesto-burrata・crudaiola・burrata）** | burrata を cheese として追加（`pieceVisual`、C の SVG）、pesto-burrata（通常 step 70 の key、ペスト＋オイル）、pizza-alla-crudaiola（通常レシピ・`ladderCredit:false`・トマト＋オイル、全食材を焼成前）。Research の取得順の監査（`researchLabelAudit`）を実装 PR で再実行して固定集合を確定。crudaiola の Jaccard 例外を `expansionBatch19.test.ts` と `recipes.ts` に「このレシピ限り」と記録 | `ingredients.ts`、`recipes.ts`、`discoveryLadder.ts`、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`referencePizza.ts`、`orders.ts`、`toppingSizeClass.ts`、`IngredientGlyph.tsx`、golden、新規テスト。`lateCatalog.ts` は触れない（D7） |

- **順序:** A は B と `ingredients.ts`・`IngredientGlyph.tsx` を共有するため、片方を先に merge し、後の側が rebase する。どちらを先にするかは、claims の解消後に claim の中で宣言する（SESSION-OPERATIONS §1 の HOT の規則）。
- **実装時に確認すること（R2 レポートの「要確認」）:** pesto を主ソースとする 2 ソース recipe の Reference と完成判定（grandma 用の保証テストは tomato-sauce 前提の合成レシピ）。burrata の個数・価格・サイズクラス・焼成窓は GAMEPLAY ASSUMPTION として Result に明記する。元データ（172 matrix 行）にはブラータの後乗せの根拠がない。

## 4. 検証と人の確認

- 390×844（authority）と 360×800 の before / after の画像、390×844 の動画（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`）。動画は repo に含めない。
- **D4: 実装後に、実寸の HV**（トレイ 26px、ピザ上、焼成後、RESULT。ほうれん草・アーティチョークはグレースケールの見え方、burrata は白いチーズ類との区別）。iPhone Safari での確認は Owner の HV。Chromium の確認を実機 HV の合格として記録しない。
- ほうれん草 A2 の焼成後のグレースケール視認性は、現行の絵文字の面積には届かない（R2 レポート §3・§5）。実寸 HV で不足なら、A3 または A2 の中間色を再検討する（これは新しい Owner 判断になる）。

## 5. 保留（独立した将来タスク）

- FINISH でチーズを置く拡張（D9）: 着手条件は「後乗せのチーズを使うレシピを Owner が決めること」「mozzarella の後乗せ描画の方針」「#738 の merge」。詳細は `docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`。
- 追加のハーブ・チーズのアイコン（P1 の残り: パニール・カトゥピリ・ヤギ・スイス・グラナなどの白・黄の円盤、P5 の絵文字代用）は本決定の対象外。
