# Expansion Batch 23-b Result Report — nutella-dessert-pizza・smore-dessert-pizza と late の 5 食材（#780、Draft、Owner 決定 2026-11-10）

基準 main `577dcfd7`（B23-a = PR #814 の merge 後）。**暫定仕様・原典（pizzadb.jp）未確認**: id・名前・数量・色・絵文字は GAMEPLAY ASSUMPTION。凡例: 【実測】コード・テストの実行、【未確認】測っていない。B23-a（PR #814、merge 済み）とは **branch・PR を分離**している。決定表: `TETO_EXPANSION-BATCH-23_OwnerDecisionTable_2026-11-10.md`、B23-a の報告: `TETO_B23_Result_2026-11-10.md`。

**merge・手動 Production ON・共有 Preview の更新は行わない。Draft・HOLD。**

## 0. Owner 判断の記録（2026-11-10）
| # | Owner 判断 | 本 PR での反映 |
|---|---|---|
| 1 | chocolate・graham-cracker・marshmallow・powdered-sugar を **spice** に分類（`other` にしない）。nutella・smore それぞれに **cream-cheese を 2 個**（焼成前）追加。既存ゲートは緩和せず、Research・Hint・在庫・重複判定・E2E を再測定 | §2・§5。ゲートの変更 0（テスト fixture 1 件の追従のみ、§5） |
| 2 | B23-a と B23-b の HEAD・PR を分離 | 本 PR は main `577dcfd7` から切った別 branch `claude/b23b-implementation-780` |
| 3 | 既存 5 レシピの **非正準 Research 差分を B23-b 限定で個別承認**（下表） | §4。**正準順の変化 0・承認外の変更 0・ゲート緩和なし・新しい差分が出たら停止**をテストで固定 |
| 4 | 既存テストの期待値は実測と照合し、失敗回避のためだけに変えない | §5（変更は全て実測値への追従で、旧値→実測値を各テストのコメントに残した） |
| 5 | PR は Draft、独立レビューを依頼。merge・手動 Production ON・共有 Preview 更新は禁止 | 実施（レビュー依頼は #780 のコメントと本 PR を参照） |
| 6 | #780 の HOT claim 保有者と実装 session の一致を確認し、不明なら HOT 編集を停止 | §6 |

## 1. 範囲
B23-a（apple-cinnamon-dessert と apple）は #814 で出荷済み。B23-b は **late** の dessert 2 品と 5 食材。
- `nutella-dessert-pizza`（ヌテラデザートピザ）: cream-cheese 2・banana 2・chocolate 2・powdered-sugar 2（**POST_BAKE**）。**NO_SAUCE は Owner の GAMEPLAY 判断（原典の事実ではない）**。chocolate は散らす食材（ソース層ではない）、walnut の追加なし（Q-2）。
- `smore-dessert-pizza`（スモアデザートピザ）: cream-cheese 2・chocolate 2・graham-cracker 2（**POST_BAKE**）・marshmallow 2。NO_SAUCE（同上）。
- late 食材（5）: banana（fruit・s）・chocolate（spice・s）・powdered-sugar（spice・xs）・graham-cracker（spice・m）・marshmallow（spice・s）。専用 SVG（#798 の dessert glyph）を `IngredientGlyph` から配線。
- late ladder: step **88**（banana・chocolate・powdered-sugar → nutella）・step **89**（graham-cracker・marshmallow → smore）。REC-04 の同点（新材料数が等しい）は recipe id が小さい nutella が先。Research cohort key は powdered-sugar／marshmallow（各 step の最後の材料）で、単独メンバーの cohort。late floor は 88／89 に固定（既存の floor は不変）。
- 既存の late 13 step の番号は変わらない（B23-b の late 2 step は末尾に追加）。ordinary ladder・ordinary レシピは不変。
- Reference（各 8 ピース）、Discovery target（`…-pizzadb-p6`／`…-pizzadb-p4`）、Hint 役割（key-free）、注文台詞、Preview 限定 HV シード `?hv=b23b-nutella`／`?hv=b23b-smore`（B23-a の `b23HvSeeds.ts` とは別 module）、E2E `e2e/b23b.spec.ts`。
- staged は生成器から再生成（75→73 レシピ、53→47 食材）。**注意（Owner 判断の候補）**: 47 は出荷した 5 食材に加え、`nutella-spread`（staged の MERGED_PROVISIONAL。provisional rule I-2 で `chocolate` に統合）を staged から外した結果。目標 170 食材は `nutella-spread` を 1 行として数えているため、独立した別食材として出荷しない限り、実効の目標は 169 になる（§7）。

## 2. ゲートの結果【実測】
| 確認 | 結果 |
|---|---|
| `deductionProduction.gate`（OD-DH4-2-9「other 到達不能」） | 成功（4 食材 spice） |
| `hint5Production.gate` G7（NO_SAUCE は先頭が CHEESE） | 成功（cream-cheese 2 が CHEESE rung）。**fixture 1 件のみ追従**（§5-A） |
| Hint G9（不足 Pitz の一様拒否）`hint5Ladder.test`・`gameReducer.hint5.test` | 成功 |
| Hint 5.0 rung 形 | 両レシピとも `CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS`（key-free、名前・個数・焼成の時点を出さない） |
| G18／H5-INV-2（emoji の一意性・Hint family 記号と非衝突） | 成功（🍌🍫🧁🥠🍡） |
| 重複 Gate（同一・部分集合・上位集合・1 材料差・Jaccard ≥ 0.4） | 出荷済み 102 品に該当 0（nutella と smore は cream-cheese・chocolate を共有、Jaccard 0.33 < 0.4）。`expansionBatch23b.test.ts` で固定 |
| 保存互換（schema v2）・在庫・ショップ（5 食材は k=2 → パック 20、120／60 Pitz） | 成功。既存の保存データの読み込みは不変 |
| Research cohort（正準順） | **変化 0**（全 ladder prefix で既存レシピの文字が変わらない。ordinary と全カタログの両方） |

## 3. 件数
| 区分 | 前（#814 後） | 後 | 増分 |
|---|---|---|---|
| レシピ | 102 | **104** | +2 |
| 食材 | 117 | **122** | +5 |
| credited | 90 | 92 | +2 |
| ladder step | 87（通常 74＋late 13） | 89（通常 74＋late 15） | +2 |
| 第 4 章 | 65 | 67 | +2 |
| toppings | 81 | 86 | +5 |

## 4. Research の非正準差分 — Owner の個別承認の記録（B23-b 限定、2026-11-10）【実測】
測定: `researchLetterChangesAcrossOrders`（出荷済み ladder・既定の 40 本のランダム順）。**正準順の変化は 0**。変わる既存レシピは、Owner が承認した 5 ID と**完全に一致**（過不足 0）。テスト `expansionBatch23b.test.ts`（`OWNER_APPROVED_B23B`）は、5 ID の集合・各 ID の変化・正準 0 を固定し、**承認外の変更が 1 件でも出れば失敗する**。

| ID | 承認された変化（測定値と一致） | 承認 |
|---|---|---|
| pesto-salmone | (なし)→B、B→D、C→D、C→E、D→F、E→F、E→G | ✅ B23-b 限定 |
| jalapeno-popper-pizza | (なし)→A | ✅ |
| spinach-artichoke-pizza | (なし)→A | ✅ |
| apple-cinnamon-dessert | (なし)→A | ✅ |
| ikura-salmon-pizza | (なし)→A | ✅ |

承認条件: 正準順の変化 0（達成）／承認外 Research 変更 0（達成）／既存ゲートを緩和しない（達成）／新しい差分が出たら停止（テストで固定）。
- 原因: 先に提示した表（決定表 §4）は nutella・smore に cream-cheese が無い構成で測った値（当時は既存レシピに変化なし）。cream-cheese 2 を足した案 A では、2 つの late レシピが cream-cheese の cohort に加わる順序があり、上の 5 ID が動く。
- 前の batch の監査テスト（B20-A／B21／B22／B23-a）は、後続 batch の材料・レシピを除外して測る既存の方式（`excludedMaterials`）に B23-b を加えただけで、各 batch の承認済みの記録は不変。

## 5. テスト結果【実測】
- 全 Vitest（ローカル、最終）: **655 ファイル・12,183 件（成功 12,167・失敗 0〔最終修正後に該当ファイルを再実行して 68/68 成功〕・skip 13・todo 2）**。`tsc -b` エラー 0。oxlint は既存の警告のみ（新規のエラー 0）。
- E2E（Chromium、`e2e/b23b.spec.ts`）: **390×844・360×800 の各 2/2 成功**（nutella・smore それぞれ Shop NEW → 購入 → Research（正体の漏れなし）→ 各ピースを Reference の位置に → 焼成 → FINISH（POST_BAKE の powdered-sugar／graham-cracker）→ NEW DISCOVERY → Dex）。スクリーンショット: `docs/reports/screenshots/b23b/`（chip とピースの拡大は `compare-parts/`）。WebKit は CI の `e2e-webkit`。
- 新規テスト: `expansionBatch23b.test.ts`（28 件）と `b23bHvSeeds.test.ts`。

### 既存テストの更新（実測値への追従。失敗回避のための変更ではない）
| 種類 | 内容 |
|---|---|
| 件数・step | catalogLedger（104／92／122／86／89／第 4 章 67）、late 15 step、ordinary 74 不変、materialShop の 5 行（step 88／89、k=2、20 個、120／60 Pitz）、recipeChapters（late 16）、e5／pinsa／lateAxis／lateCatalog.* の late リスト、`steps.at(-N)` の位置の +2 |
| floor | `LATE_ENTITLEMENT_FLOORS` に 5 食材を**追加のみ**（既存 floor は不変。各テストの toEqual に追記） |
| manifest | 既存の late batch の `followedBy` と Pinsa の `afterRecipeId` に nutella／smore を追加 |
| 旧 DH4-2A | **257→291（実測）**。硬化したガードの漏れ 0（同テストの他の表明は全て無修正で成功） |
| golden | `hint5.ladders55.json`: **404 行の挿入のみ・既存の変更 0**。`hint5.alphaFamilyOnly.json`: 2 行の追加（nutella 92・smore 220、既存の値は不変）。staged の golden 5 件と DH4-1 の audit json は報告用の再生成（staged の母集団と topping 数の変化のみ） |
| A. fixture | `hint5Production.gate` の synthetic（spice を capers 1 食材だけの family とみなす fixture）に、新しい spice 4 食材を「別 family」の再割当てに追加（B22 の sunflower-seeds と同じ種類の fixture 調整。**主張自体は不変**） |
| matcher | `matcher.test` の「blocked 行は target に入らない」に、Owner 承認済みの 2 行（nutella／smore の pizzadb 行）を追加（Q-1 と案 A の承認） |
| DessertGlyphs | 「apple だけ配線済み」→「6 つ全て配線済み。importer は `IngredientGlyph.tsx` だけ、各 `<id>-dessert` は data ファイルで 1 回ずつ宣言」 |

## 6. #780 の claim — 権限の確認
- claim 6759257331 の保有者は本 session（`session_016YrGi1RVoi7RJtRnB3cKLU`）。Owner から本 session への直接指示（上記 §0-3〜5）が最新で、B23-b は本 session が実装。B23-b 用の claim（branch `claude/b23b-implementation-780`）を #780 に投稿済み。
- #780 には「B23-b を Codex に引き継ぎたい」というコメント（6761398593）があったが、**本 session は release していない**（Owner から本 session への release 指示は無い）。Owner が直接指示した場合は `released:true` を投稿して HOT を止める。二重実装を避けるため、それまで本 session が唯一の実装担当。
- 重なる claim: `src/data/staged/**`（T-FX 6711787241）は出荷品を staged から外す最小追従のみ（B22／B23-a と同じ）。

## 7. 進捗（目標 170 食材／177 レシピ／27 調理法、縮小なし）
| 区分 | 累計 | 今回の増分 | 残数 |
|---|---|---|---|
| レシピ | **104** | +2 | **73**（staged 73） |
| 食材 | **122** | +5 | **48**（staged 47＋`nutella-spread`〔chocolate に統合済み〕1） |
| 調理法・工程（実装済み） | 7 | +0 | 20 |

- 食材の残 48 と staged 47 の差 1 は `nutella-spread`。**Owner 判断**: ① chocolate に統合したまま（実効の目標 169）にするか、② 別の食材（ソース）として後で出荷するか。決めるまで目標 170 は縮めず、残数は 48 と報告する。

## 8. iPhone Safari HV（公開は Owner の指示で行う）
`?hv=b23b-nutella`／`?hv=b23b-smore`（Owner の指示後に PR 専用ページを公開。共有 Preview は変更しない）。確認点:
1. **chocolate（s）と powdered-sugar（xs）の小サイズ視認性**（トレイのチップとピザ上のピース。粉砂糖の白い粒が生地の上で見えるか、チョコの角ブロックが他の食材と区別できるか。ローカルのスクリーンショットでは見えるが小さい）。
2. **late step 88／89**（ショップの NEW が banana・chocolate・powdered-sugar と graham-cracker・marshmallow）。
3. **nutella・smore の通しプレイ**（NO_SAUCE のソース無し、cream-cheese → 具材 → 焼成 → **FINISH で粉砂糖／グラハムクラッカーをのせる**→ NEW DISCOVERY）。
4. **日本語名表示**（ヌテラデザートピザ・スモアデザートピザ・5 食材の名前）。
5. 既存レシピに影響が無いこと（図鑑の件数 104 と既存の保存データの読み込み）。

## 9. 範囲外
merge・手動 Production ON・共有 Preview の更新、B23 の他の Owner 判断、`nutella-spread` の扱い（§7）の決定、調理法の追加。
