# 次の昇格列車（B20-A・taco/okonomiyaki・4品）の設計と Research 再測定（docs-only、Refs #780）

2026-11-08、main `4ba05597`（PR #789 merge 後）。**読み取りと scratch 測定のみ。** `src/`・HOT ファイル・golden は未変更。本番昇格・Production ON・共有 Preview 更新・他 PR の merge なし。HV 対象外（docs-only）。
ラベル: 【実測】= main のコードで scratch 測定、【引用】= 既存 docs/GitHub、【推論】、【未確認】。測定データ: `docs/reports/data/TETO_NEXT-TRAIN_Research-Remeasure_2026-11-08.txt`。

## 1. main CI【実測】
- E2E WebKit run 42455506474: 確認時点で **実行中**（結果は未確認。PR #789 の同 HEAD 相当の WebKit は 11/11 成功）。
- Deploy run 42455506578: **success**。`waiting` は build→deploy の引き継ぎ待ちで、承認待ちではなかった（environment 承認なし。私は承認操作・再実行をしていない）。

## 2. B20-A（honey・walnut・pesto-noci-pizza）の Owner 判断一覧【引用＋実測】
Research 非正準順の変化が出る既存 **10 品**（B20-A 単独、main 基準）。**Owner 未承認。正準順の変化は 0。**
genovese／pesto-burrata-pizza／pesto-caprese／pesto-patate／pesto-pollo／pesto-salmone／pesto-tonno／pesto-trapanese／pesto-vegetariana／quattro-formaggi（遷移の文字列は data ファイル）。
Owner 判断事項: (1) 10 品の ID ごとの承認、(2) honey は焼成前の第 2 層（候補）、(3) mozzarella は足さない（候補）、(4) walnut の family `spice`（暫定）、(5) 数量・ラダー（普通ラダー step 71 想定）、(6) HOT ファイル（recipes.ts／ingredients.ts／discoveryLadder.ts 等）の新規 claim。**注意: honey の絵文字案 🍯 は miso-sauce が使用済み（G18 違反）。** 実装前に別の代替表示が必要。

## 3. taco・okonomiyaki
昇格準備は #789 で維持（Staged 内、late カタログ、nori 後乗せ）。**本番昇格は未承認、B20-A の後。** 17 品の Research 差分は承認済み。
【実測】B20-A を先に入れ、拡張ラダー（4 品の新ステップ込み）で再測定しても **対象 ID は同じ 17 品**（正準順 0）。ただし遷移の文字列（例 `pesto-burrata-pizza: B->C C->D` → `K->L B->C C->D H->I`）は、後続ステップで所有順の組合せが増えるため広がる。ID 単位の承認は有効だが、昇格時に golden を再記録する。

## 4. 次の 4 品の設計（暫定。Owner が確定したのは「開発準備 GO」と 2 点のみ）
| レシピ | 配置 | 材料（暫定数量） | 後乗せ | 新食材 |
|---|---|---|---|---|
| pizza-finocchi-salad | late | olive-oil 1／black-olive 2／fennel 2／mint 2／mozzarella 3／orange 2 | orange（D-5） | fennel, orange |
| pizza-cavolo-carote | late | olive-oil 1／carrot 2／mozzarella 3／sunflower-seeds 2／lemon 2／red-cabbage 2 | lemon, red-cabbage（D-5） | red-cabbage, carrot, sunflower-seeds |
| black-truffle-pizza | late | mozzarella 3／parmigiano 3／truffle 2 | truffle（薄いスライス、Owner 採用） | truffle |
| buffalo-chicken-pizza（旧 -pizzadb） | **普通（通常）** | buffalo-sauce 1／chicken 2／gorgonzola 3／mozzarella 3 | なし | buffalo-sauce |

- **buffalo-chicken は late にできない【実測】**: 出典の buffalo-sauce は焼成後だが、POST_BAKE は topping だけに許され、sauce・cheese には使えない。late 配置には POST_BAKE の topping が要る。したがって普通レシピ（焼成前のソース）とする案、または POST_BAKE の topping を足す案（出典に無い材料なので非推奨）。**Owner 判断**。
- **truffle はソースなしにする【実測】**: olive-oil を足すと quattro-formaggi と Jaccard 0.50（重複ゲート >0.4）に当たり、Research 変化も 4 → 15 品に増える。出荷済み 22 品がソースなしなので、ソースなしでよい。
- 新食材の family／サイズ（暫定）: fennel=vegetable・s／orange=fruit・s／red-cabbage=vegetable・s／carrot=vegetable・xs／sunflower-seeds=spice・xs／truffle=vegetable・s（薄いスライス、専用 SVG は #417 の担当）／buffalo-sauce=sauce（family なし）。
- アイコン（G18 代替表示は全カタログで一意）【実測】: 空き確認済み = orange 🍊、carrot 🥕、red-cabbage 🟣、sunflower-seeds 🌻。fennel・truffle・buffalo-sauce・honey は未選定（🍯は miso-sauce、🥬は cabbage 候補が使用）。専用 SVG は walnut のみ存在（未配線）。
- **ID 衝突・保存互換【実測】**: `buffalo-chicken-pizza` は main の src・docs・e2e に存在せず、git 履歴にも無い（`-S` 検索）。出荷されたことがないので既存保存に影響しない。evidence ID は `buffalo-chicken-pizzadb` のまま保持する。保存は未知 ID を読み込みで落とすが書き込まない（stagedSaveSafety、既存）。staged 内の参照は `stagedRecipes.ts`／`stagedIngredients.ts` の各 1 か所のみ。
- 重複ゲート【実測】: 7 品（B20-A＋taco＋okonomiyaki＋4）すべてヒットなし（truffle はソースなしの場合）。

## 5. ラダー案と Research 再測定【実測】
ラダー案（正準順）: 普通 step 70 burrata の後に **step 71 [honey, walnut]（key pesto-noci-pizza）**、**step 72 [buffalo-sauce]（key buffalo-chicken-pizza）**、late 末尾に taco、okonomiyaki、finocchi [fennel, orange]、cavolo [red-cabbage, carrot, sunflower-seeds]、truffle [truffle]。ラダー材料 109。累積で 1 品ずつ追加して測定:
| 追加 | 正準順の変化 | 非正準順で変わる既存 ID 数 |
|---|---|---|
| pesto-noci-pizza | 0 | 10 |
| taco-pizza | 0 | 12（累積の中での値） |
| okonomiyaki-style-pizza | 0 | 5 |
| pizza-finocchi-salad | 0 | 22 |
| pizza-cavolo-carote | 0 | 15 |
| black-truffle-pizza | 0 | 4 |
| buffalo-chicken-pizza | 0 | 8（pesto-noci-pizza を含む） |
- 4 品を一緒に追加した場合は **34 ID**（単独の和 22＋14＋4＋8＝48 のうち重複あり）。B20-A の 10 品と重なるのは pesto-burrata-pizza／pesto-pollo／pesto-salmone／pesto-tonno／quattro-formaggi、承認済み 17 品と重なるのは pesto-burrata-pizza／pizza-alla-crudaiola／pizza-feta-eliniki／reina-pepiada-pizza／veggie-supreme-pizza。B20-A＋17＋4 品の ID の和集合は **50**。
- **正準順の変化は全段階で 0**（停止条件に当たらない）。非正準順は **未承認のまま、どれも適用していない**。Owner が言う「47 件」は 4 品の単独測定の和（22＋14＋4＋7）で、今回の累積測定では 48（buffalo に pesto-noci が加わる）。
- 限界【未確認】: 新食材は仮定義（スタブ）、数量は暫定。Hint 5.0 のラダー golden と本番 `validateLateCatalog` は未実行。実装時に再測定が必要。

## 6. Owner 判断事項
1. B20-A の 10 品の ID ごとの承認、honey の代替表示（🍯は使用済み）。
2. buffalo-chicken-pizza を普通レシピにするか（late は不可）。
3. 4 品の非正準順（34 ID）を、B20-A の 10 品・承認済み 17 品との重複を含めて ID ごとに承認するか。
4. truffle をソースなしにする（推奨）。
