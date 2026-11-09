# M7 POSTBAKE_SAUCE — 焼成後のソース・液体の設計（#780、docs-only・設計のみ）

2026-11-09 / 基準 `origin/main` = `348b1e4`。**設計案であり実装承認ではない。** 既存の DRIZZLE（#579、PR #776 = D1 純粋ロジック、PR #746 = Gesture Lab、いずれも open・未 merge）を**重複実装しない**ことを最優先にした分担を示す。

## 1. 何が M7 か【実測】
候補レシピのうち、**焼成後にソース（`category: "sauce"`）を置く**ものが 3 品ある（台帳の `postBakeSauceRecipes`、生成器が `applicationPhase: "POST_BAKE"` かつ非トッピングで検出）:

| レシピ | 焼成後の材料 | 他に必要な工程 | バッチ |
|---|---|---|---|
| buffalo-chicken-pizzadb | buffalo-sauce（新食材・ソース） | なし | RB-18 |
| hot-honey-pepperoni | honey（出荷済み・B20-A で焼成前の第 2 ソースとして出荷） | なし。重複ゲート X1（後乗せ軸で分離） | RB-18 |
| detroit-style-pizza | tomato-sauce（出荷済み。生地の上から後がけ） | M1 生地＋M2 天板（PAN_PROFILE） | RB-18 |

現行の制約: 後乗せ（FINISH）は**トッピング専用**（`PLACE_TOPPING` は `category !== "topping"` を拒否、`validateLateCatalog` も同様）。したがってこの 3 品は「判断済み」でも出荷できない。

## 2. 既存 DRIZZLE との分担（重複させない）
| 領域 | 担当 | M7 でやること |
|---|---|---|
| 液体の型 `PostBakeLiquid`（別コレクション `postBakeLiquids`、`stage: "post"`）、軌跡の変換・量子化・間引き・タップ代替線、保存向け検証 | **DRIZZLE D1（PR #776）** | **実装しない。** そのまま使う |
| ジェスチャー（線を引く／タップ）と実機 HV | **DRIZZLE Lab（PR #746）** | 実装しない。HV の結果待ち |
| journal・在庫の原子的な消費・採点／識別（OD-DZ-3／5／6）・UI（D2〜D5） | **DRIZZLE（#579、HOLD）** | M7 の前提として**待つ**。D2〜D5 の Owner ゲートが先 |
| 許可リスト `POST_BAKE_LIQUID_INGREDIENT_IDS = ["olive-oil"]` の**拡張** | M7 | buffalo-sauce・honey・（detroit のトマト）を追加するかを **Owner が決める**。拡張は DRIZZLE D1 の定数への 1 行ずつの追加で、型 `PostBakeLiquidIngredientId` が連動する |
| レシピ側の宣言: 要件 `{ ingredientId, applicationPhase: "POST_BAKE" }` が**ソース／液体**のときの扱い（`validateLateCatalog`、Reference、Hint、識別の `late` 軸） | **M7** | 液体の許可リストに載る食材なら、後乗せ要件として許可する検証の緩和（トッピング専用の例外を 1 点追加）。OD-DZ-6（`late` 軸に液体を算入するか）の結果に従う |
| 食材データ（buffalo-sauce の色・名称・family なし・T4） | M7（食材ライン IB-01 ほか） | 既存の New Sauces 手順（#578）。焼成前に塗るソースではなく**液体**として登録する点だけが違う |

## 3. 設計案（DRIZZLE の Owner ゲート通過後）
1. **データ**: `buffalo-chicken` の要件を `buffalo-sauce POST_BAKE` として宣言（現行のまま）。`RECIPE_SAUCE_PROFILES` には焼成前ソースが無いので、焼成前ソース無し（`sauce.status: "listed"` の base は buffalo-sauce だが焼成前には塗らない）扱いにする → **ここは新規の決定事項**（M7-1: 「焼成前に塗る base ソース」と「焼成後に置く液体」を別概念として持つか）。
2. **検証**: `validateLateCatalog` と `PLACE_TOPPING` 相当の経路に「許可リスト内の液体なら FINISH で受理」の分岐を追加（DRIZZLE D2 の journal が前提）。
3. **採点／識別**: OD-DZ-5（Reference に液体を持つか）・OD-DZ-6（`late` 軸に液体を算入するか）に従う。M7 は決定を待つだけで、独自に決めない。
4. **Hint 5.0**: ソース段（SAUCE rung）が「焼成前」のみを前提にしている可能性があり、液体を要件に含むと**漏えい判定（DH4）の再測定**が必要【未確認】。
5. **段階**: M7-0 設計 Gate（本書）→ DRIZZLE D2〜D4 の承認待ち → M7-1 許可リスト拡張＋検証緩和（挙動不変、液体 0 件の間は本番影響なし）→ M7-2 buffalo-chicken を最初の利用者に（1 レシピ列車、HV 1 回）→ M7-3 hot-honey-pepperoni → M7-4 detroit-style（M1・M2 後）。

## 4. 停止条件・影響
- DRIZZLE の D2〜D5 が Owner 承認される前に M7 の実装に入らない（二重実装の防止）。
- 許可リスト拡張で `postBakeLiquid.test.ts` の固定値（初期液体 = olive-oil）が変わる → DRIZZLE 側のテスト更新を伴うため、**PR #776 の merge 後**に別 PR で行う。
- 触る HOT: `lateCatalog.ts`（検証）、`gameReducer.ts`（FINISH 受理。DRIZZLE D2 と同じ領域で**直列**）。

## 5. Owner 判断
| ID | 論点 | 推奨 |
|---|---|---|
| M7-a | M7 を調理法の追加対象として台帳に維持（本書で設計済み）。実装は DRIZZLE D2〜D5 の後 | 承認（既に台帳に反映済み） |
| M7-b | 液体の許可リストの拡張対象（buffalo-sauce・honey・tomato-sauce） | buffalo-sauce と honey から。トマトは M1・M2 の後 |
| M7-c | 「焼成前の base ソース」と「焼成後の液体」を別概念にするか（M7-1） | 別概念（DRIZZLE の `postBakeLiquids` と整合） |
