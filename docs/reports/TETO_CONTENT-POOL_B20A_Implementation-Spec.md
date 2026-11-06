# Batch 20-A 実装仕様（実装担当への引き渡し用）— honey・walnut・pesto-noci-pizza（#772、docs-only）

2026-11-06。**実装は未着手。開始条件（§1）を満たすまでカタログを編集しない。** 根拠: `TETO_CONTENT-POOL_B20_HoneyWalnut_Result.md`。数値（個数・価格・窓・色）はすべて **GAMEPLAY ASSUMPTION（暫定・原典未確認）**で、HV 後に調整する。

## 1. 開始条件（すべて必須）

- [ ] B19（#774）が merge 済み（カタログ lane の直列化。step 番号・golden は B19 の後で確定）
- [ ] #748 の claim が解放済み、かつ B20 用の新 claim（Issue は新規起票、Owner 承認）
- [ ] Owner の B20 GO と、§6 の判断 1〜3 の回答
- [ ] walnut の SVG（PR-B20-0）が merge 済み

## 2. PR 分割（Owner 方針: 食材とレシピは別 PR）

| PR | 内容 | 主なファイル | 依存 |
|---|---|---|---|
| **PR-B20-0** | walnut の専用 SVG（未配線のコンポーネント＋テスト、描画のみ） | `src/components/herbGlyphs/` と同様の新規ディレクトリ（例 `src/components/nutGlyphs/`）、比較画像 | なし（**#748 と無関係に先行可**） |
| **PR-B20-1 食材** | honey・walnut の 2 行、`pieceVisual`（walnut）、taxonomy・size class、ladder step（2 素材 1 step、key は pesto-noci-pizza）、golden の挿入追従 | `ingredients.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`discoveryLadder.ts`・`IngredientGlyph.tsx`・`App.css`（必要時）・golden | B19 merge、PR-B20-0 |
| **PR-B20-2 レシピ** | `pesto-noci-pizza` 1 件、Reference・sauce profile・hint roles、Research 監査、E2E、HV | `recipes.ts`・`referencePizza.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`discoveryCatalog.ts`・`expansionBatch20.test.ts`・`e2e/b20.spec.ts` | PR-B20-1 |

※ 食材 PR を先に merge すると、レシピの無い step が一時的に存在する。これが ladder の不変条件（key レシピ必須など）に反する場合は **PR-B20-1 と -2 を 1 PR にまとめる**（B13〜B18 はすべて 1 PR）。実装開始時に `discoveryLadder.test.ts` の不変条件を確認して決める。

## 3. 食材の仕様（暫定）

| 項目 | honey | walnut |
|---|---|---|
| id | `honey` | `walnut` |
| nameJa | はちみつ | くるみ |
| category | **sauce**（第 2 の spread 層、焼成前） | topping |
| placement | `spread` | `scatter` |
| 色（暫定） | `#e8a93a`（琥珀） | `#9a6a3c` |
| 絵 | 不要（塗り） | 専用 SVG（割ったくるみ、白系・ナッツ系と識別） |
| family（Hint 5.0） | 既存 sauce の扱いに従う | **要判断**（新 family `nut` か既存 `spice`） |
| size class | — | `s` 案 |
| 価格・補充数 | 既存の第 2 ソース（olive-oil 65 Pitz／3）を基準に暫定 | 既存の finite topping を基準に暫定 |
| unlock | 通常 ladder の 1 step（B19 の step 70 の次＝**71 見込み、実装時に再計算**） | 同じ step |

## 4. レシピの仕様（暫定）

| 項目 | 値 |
|---|---|
| id | `pesto-noci-pizza`（暫定） |
| nameJa | ペスト・ノーチピザ（暫定） |
| requiredIngredients（順序はソース→チーズ→具） | pesto 1（PAINT、主ソース）／honey 1（第 2 ソース層）／gorgonzola 2／walnut 3（個数は暫定） |
| mozzarella | **入れない**（原典に無い。§6 判断 2） |
| 工程 | SAUCE×2 → CHEESE → TOPPING → BAKE。全て焼成前。FINISH・prep・steam・sear なし |
| bakeTarget | 58–78（Free Cooking と同値の暫定） |
| ladderCredit | true（step の key） |
| lunchRush | false |
| CUT | なし |
| 先例 | 主ソース＋第 2 ソース層は B19（pesto＋olive-oil）と同型。**B19 で pesto 主＋副ソースの Reference／完成判定のテストが入るので、それを流用** |

## 5. 受入条件

| # | 条件 |
|---|---|
| AC-1 | Jaccard ≤ 0.4（静的 0.167、近傍 genovese）。同一／部分／上位集合・1 材料差 0。**例外なし**をテストで固定 |
| AC-2 | Research: 正準順の既存ラベル変化 **0 件**。非正準順の変化は `researchLabelAudit` で全件列挙し、**1 件ずつ Owner 承認**（一時測定では 9 件: quattro-formaggi・genovese・pesto-patate・pesto-pollo・pesto-trapanese・pesto-salmone・pesto-tonno・pesto-caprese・pesto-vegetariana）。未承認が 1 件でも残れば HOLD |
| AC-3 | Hint 5.0: SAUCE または CHEESE の有料ヒント 1 段で、近い pesto 系と区別できる |
| AC-4 | 既存 step の番号は凍結（B19 後の 1–70）。late の導出番号は +1 |
| AC-5 | 保存・Dex・在庫の既存データ不変（`persistence.batch20.test.ts`、B18 方式） |
| AC-6 | 390×844・360×800 の 1 画面 UX。トレイの名前（はちみつ・くるみ）の幅を WebKit 360×800 で確認 |
| AC-7 | HV ポリシー: before/after の画像（`docs/reports/screenshots/b20/`）、390×844 の動画は repo に含めない |

## 6. 実装前の Owner 判断

| # | 判断 | 推奨 |
|---|---|---|
| 1 | honey は焼成前の第 2 ソース層か、後乗せ（late）か | 焼成前 |
| 2 | mozzarella を足すか | 足さない |
| 3 | walnut の family | Hint 5.0 の分類影響を実装時に測定して決める（暫定 `spice`） |
| 4 | 非正準ラベル変化の個別承認（実装後） | 1 件ずつ |
