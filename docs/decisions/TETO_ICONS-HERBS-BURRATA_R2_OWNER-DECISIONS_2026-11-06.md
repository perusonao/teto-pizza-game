# Owner 決定記録 — ハーブ 4 食材のアイコン／burrata ／ pesto-burrata・crudaiola（R2、2026-11-06）

Status: **決定の記録（docs-only）。実装は未着手・HOLD（開始条件の一部が完了、残りは §2）。** 2026-11-06 に GitHub の状態へ合わせて更新（§2、§3）。 後続の実装セッションは、本書を権威として扱い、ここに記録した決定を再質問しない（`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` §8）。
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

### 2.1 条件の状況（GitHub で確認、2026-11-06）

| 条件 | 状況 |
|---|---|
| PR #760（#733 牛肉・ピーマン）の merge | **完了**（`537ed090`） |
| PR #765（#764 WebKit 360×800 の調理画面の横はみ出し）の merge | **完了**（`fa67c72a`） |
| PR #761（#758 大葉 1.35em）の merge | **完了**（`c308a3f`。※当初の条件には無かったが、`App.css` を共有するため追跡していた） |
| 最新の main | `c308a3f7`（上の 3 件が入った状態） |
| **PR #759（Batch 18）の merge** | **未完了**。open、HEAD `d9679e6`、Draft / HOLD。Owner の iPhone Safari 実機 HV は 5 項目 PASS 済み。merge は別途 Owner の承認待ち |
| **claims の整理** | **未完了**。#748 の `ingredients.ts` ほかの claim（〜2026-11-18、#759 に付随）が残る。#733・#758・#764 の claim は、各 PR の merge により役目を終えたが、期限切れまたは release の確認が要る |
| **Owner の明示 GO** | **未取得** |

### 2.2 残る開始条件

次の 3 つがすべて満たされるまで、実装を始めない。
1. **PR #759 が merge されること**（`ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts` などを共有するため）。
2. **claims の整理**: 開始時に、最新の main・`CLAUDE.md`・`docs/PROJECT_HANDOFF.md`・SESSION-OPERATIONS §1 を読み直し、open PR と Issue の claim（`teto-claim:v1`）を再確認して、重なるものが解消または調整済みであること。そのうえで、新しい独立ブランチと有効な claim を作る。
3. **Owner の明示的な GO**（実装の着手そのものについての承認。決定 D1〜D9 とは別）。

### 2.3 それまでの制約

既存の PR の HEAD を変えない。追加の実装・merge・Production ON・共有 Preview の更新は行わない。

## 3. 実装の分け方（方針は維持。順序と claim は実装時に再確認）

| PR | 内容 | 主な変更ファイル（HOT を含む） |
|---|---|---|
| **A: ハーブ 4 種のアイコン**（描画のみ。#759 の後。ハーブ 4 食材の行に `pieceVisual` を付けるため `ingredients.ts` の claim の解消が要る） | `rosemary-B`・`artichoke-A2`・`oregano-B`・`spinach-A2` を `IngredientGlyph.tsx` に実装し、4 食材に `pieceVisual` を付ける。サイズは 1.2em（既存のハーブ群と同じ補正）。識別テスト（#733 と同じ方式）。食材 ID・`emoji`・`color`・family・サイズクラス・採点・Research・保存は変更しない | `src/components/IngredientGlyph.tsx`、`src/data/ingredients.ts`（`DedicatedIngredientVisual` と 4 行）、`src/App.css`（補正、HOT。#765・#761 は merge 済みなので、main の現状に rebase して差分を作る）、`IngredientGlyph.test.tsx`、`docs/design/references/ingredient-icons-2.0/` の参照 SVG |
| **B: Batch 19（pesto-burrata・crudaiola・burrata）** | burrata を cheese として追加（`pieceVisual`、C の SVG）、pesto-burrata（通常 step 70 の key、ペスト＋オイル）、pizza-alla-crudaiola（通常レシピ・`ladderCredit:false`・トマト＋オイル、全食材を焼成前）。Research の取得順の監査（`researchLabelAudit`）を実装 PR で再実行して固定集合を確定。crudaiola の Jaccard 例外を `expansionBatch19.test.ts` と `recipes.ts` に「このレシピ限り」と記録 | `ingredients.ts`、`recipes.ts`、`discoveryLadder.ts`、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`referencePizza.ts`、`orders.ts`、`toppingSizeClass.ts`、`IngredientGlyph.tsx`、golden、新規テスト。`lateCatalog.ts` は触れない（D7） |

- **A と B は別 PR のまま維持する**（Owner、2026-11-06）。A は描画だけ、B は recipe・ladder・Research を含むため、承認と確認の観点が違う。
- **順序と claim は実装時に再確認する。** A と B は `ingredients.ts`・`IngredientGlyph.tsx`・（A の補正があれば）`App.css` を共有する。開始時に、どちらを先に merge するか、後の側が rebase することを、自分の claim の中で宣言する（SESSION-OPERATIONS §1 の HOT の規則）。同時に始めず、先の PR の claim が解消してから後の PR に着手するのが安全。
- **main（`c308a3f`）で変わった共有ファイル（実装時はこの版が出発点）:** `src/components/IngredientGlyph.tsx`（#760: `BeefSlices` / `GreenPepperStrips` の描画）、`src/App.css`（#765: 390px 未満のトレイのチップの余白・名前の字、#761: 大葉の 1.35em の独立ルール）、`src/components/CookingPrep.css`・`src/logic/prep/beefDoneness.ts`（#760）。`ingredients.ts`・`recipes.ts`・`lateCatalog.ts` ほか Batch 18 の対象は、#759 の merge まで main に入っていない。実装時は、ハーブ群の 1.2em の補正のルールの現在位置（大葉が独立ルールに分かれた後）を `App.css` で確認する。
- **実装時に確認すること（R2 レポートの「要確認」）:** pesto を主ソースとする 2 ソース recipe の Reference と完成判定（grandma 用の保証テストは tomato-sauce 前提の合成レシピ）。burrata の個数・価格・サイズクラス・焼成窓は GAMEPLAY ASSUMPTION として Result に明記する。元データ（172 matrix 行）にはブラータの後乗せの根拠がない。

## 4. 検証と人の確認

- 390×844（authority）と 360×800 の before / after の画像、390×844 の動画（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`）。動画は repo に含めない。
- **D4: 実装後に、実寸の HV**（トレイ 26px、ピザ上、焼成後、RESULT。ほうれん草・アーティチョークはグレースケールの見え方、burrata は白いチーズ類との区別）。iPhone Safari での確認は Owner の HV。Chromium の確認を実機 HV の合格として記録しない。
- ほうれん草 A2 の焼成後のグレースケール視認性は、現行の絵文字の面積には届かない（R2 レポート §3・§5）。実寸 HV で不足なら、A3 または A2 の中間色を再検討する（これは新しい Owner 判断になる）。

## 5. 保留（独立した将来タスク）

- FINISH でチーズを置く拡張（D9）: 着手条件は「後乗せのチーズを使うレシピを Owner が決めること」「mozzarella の後乗せ描画の方針」「#738 の merge」。詳細は `docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`。
- 追加のハーブ・チーズのアイコン（P1 の残り: パニール・カトゥピリ・ヤギ・スイス・グラナなどの白・黄の円盤、P5 の絵文字代用）は本決定の対象外。
