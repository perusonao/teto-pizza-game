# B20-A の正式な追加対象・承認条件と、次の 4 品の設計・Research 内訳（docs-only、Refs #780）

2026-11-08、main `4ba05597`、branch `claude/teto-pizza-parallel-tasks-ylyfe5`。**読み取りと scratch 測定のみ。** `src/`・HOT ファイル・golden・CSS は未変更。実装・PR・本番昇格・Production ON・共有 Preview 更新・他 PR の merge なし。HV 対象外（docs-only）。
ラベル: 【実測】= 今回 main のコード／GitHub で確認、【引用】= 既存 docs／Owner 判断、【推論】、【未確認】。データ: `docs/reports/data/TETO_NEXT-TRAIN_Research-ByUnit_2026-11-08.txt`（昇格単位別の ID・変更前後・原因）。

## 1. main の E2E WebKit run 42455506474【実測】
結論: **failure（1 テストのみ）。`4ba05597` の内容起因ではないと判断できるが、再実行はしていない。**
- 失敗は `webkit-390x844 shard 2/3` の 1 件: `e2e/expansion-grandma.spec.ts:138 E-AC2`。`Test timeout of 240000ms exceeded`、`mouse.move: Protocol error (Input.dispatchMouseEvent): Page closed`（塗りの操作ループ中）。254 件合格。同ファイルの E-AC3 など他の grandma テストは同じ run で合格。他の 7 シャード＋ layout-chromium は success。
- 切り分け【推論】: #789 は Staged のみで `vite build` の dist は前 main と一致（#789 本文）。同じ dist の直前 main `44460cbf` の run 42452827504 は success。タイムアウトちょうど 240.2s の描画ループは実行時間の揺れの形。**既知の不安定か新規回帰かの断定には、同じ SHA の再実行が必要**（過去にも main で WebKit の failure が複数回あり成功と混在）。再実行は Owner の指示が無いので未実行。
- Deploy run 42455506578: success（`waiting` は build→deploy の引き継ぎで承認待ちではなかった）。

## 2. B20-A の正式な追加対象・claim・仕様【引用＋実測】
**追加対象（正式）:** 食材 `honey`（sauce／spread、焼成前の第 2 層）・`walnut`（topping／scatter）と、レシピ `pesto-noci-pizza`（pesto 1／honey 1／gorgonzola 2／walnut 3、mozzarella なし）。出典の仕様書: `docs/reports/TETO_CONTENT-POOL_B20A_Implementation-Spec.md`（branch `claude/teto-pizza-parallel-plan-sh894e`）と T5 調査（branch `claude/teto-pizza-t5-t6-r9qup3`）。数量・価格・色はすべて GAMEPLAY ASSUMPTION。

開始条件（仕様書 §1）の現状:
| 条件 | 状態 |
|---|---|
| B19 の merge | **充足**（`44460cbf`） |
| #748 claim の解放 | 充足（#759 merge 済み、T5 調査） |
| walnut の SVG（PR-B20-0） | 充足（#777、**未配線**） |
| B20 用の新しい Issue／claim | **未充足**。#780 の最新 claim は Staged 用（`src/data/staged/**` のみ）と、HOT を持たない docs の claim だけ。B20-A の claim・ブランチ・PR は無い【実測】 |
| Owner の B20 実装 GO | **未充足（明示なし）**。#780 の判断 6706077215 は HOLD 後に再測定を求め、honey 層・mozzarella なし・walnut `spice` は「候補」と明記。今回の判断は 10 ID の Research 変化の条件付き承認のみ |
| 非正準順の Research 変化 | 10 ID を条件付き承認（今回）。下記 §3 の条件で検証 |

**承認条件（実装開始前に必要）:** (a) Owner の実装 GO、(b) 新 Issue と HOT ファイルの claim（`ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`IngredientGlyph.tsx`・`App.css`・`referencePizza.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`discoveryCatalog.ts`・golden）、(c) honey 層／mozzarella なし／walnut family の確定、(d) honey の代替表示（🍯 禁止、§6）、(e) 10 ID 以外の Research 変化が出たら停止。**実装は開始していません。**

## 3. Research 10 ID の変更前後と承認範囲の一致【実測】
B20-A を単独で追加（ladder は main＋step 71 [honey, walnut] のみ）して `researchLabelAudit` で測定。
- **対象 ID は承認範囲と完全一致**（10 件: genovese／pesto-burrata-pizza／pesto-caprese／pesto-patate／pesto-pollo／pesto-salmone／pesto-tonno／pesto-trapanese／pesto-vegetariana／quattro-formaggi）。**正準順の変化は 0**。10 ID 以外の変化なし。
- 遷移の文字列は ladder の長さで変わる。main＋step 71 のみ（実装 PR の時点）: genovese `-->B A->B B->C C->D E->F G->H`／pesto-burrata-pizza `B->C C->D G->H I->J J->K`／pesto-caprese `-->A`／pesto-patate `-->B B->C H->I I->J`／pesto-pollo `B->C C->D F->G`／pesto-salmone `-->B B->C F->G H->I`／pesto-tonno `-->A`／pesto-trapanese `B->C C->D D->E E->F`／pesto-vegetariana `-->A`／quattro-formaggi `-->A`。
- 次の 6 品まで入れた拡張 ladder では一部の遷移が違う（genovese の `E->F` が `F->G`、pesto-burrata-pizza に `H->I`、pesto-patate に `F->G`、pesto-pollo に `E->F`、pesto-salmone の `F->G` が `G->H`）。**承認の「既知の変化」は ID 単位で一致するが、遷移の文字列は実装 PR 時点の ladder で再測定し、golden に記録する必要がある**。
- 原因は 10 品とも共有材料 pesto／gorgonzola が最後に取得される順序で、pesto-noci-pizza が同じ cohort に入ること（`TETO_NEXT-TRAIN_Research-ByUnit` に各 ID の共有材料）。

## 4. honey・walnut・pesto-noci-pizza の実装依存
- 順序: PR-B20-1 食材（honey・walnut の行、walnut の `pieceVisual` 配線、taxonomy、size class、step 71）→ PR-B20-2 レシピ。ladder の不変条件が「レシピの無い step」を許さない場合は 1 PR（B13〜B18 の前例）。
- step 71 を入れると late の導出番号が +1（AC-4）。HOT の `discoveryLadder.ts`・golden が B20-A と他の昇格で競合するため、**直列化が必要**（B20-A → taco/okonomiyaki → 4 品）。
- walnut は #777 の `WalnutGlyph`（raw/baked）を `IngredientGlyph.tsx`／`App.css` に配線する（HOT）。生くるみ×焼成チーズのコントラストは 1.10 と弱く、外線を維持する（T5 の既知事項）。
- honey は sauce のため、`recipeSauceProfiles.ts` の第 2 ソース行と Reference／完成判定のテストが要る（B19 の pesto＋olive-oil の流用）。

## 5. taco・okonomiyaki の検証【実測】
main で `stagedPromotion.firstTrain.test.ts` 8/8 合格: 本番の `validateLateCatalog` 問題 0／材料の存在・POST_BAKE は topping のみ・数量が出荷範囲内／アイコン代替表示の一意（G18）／重複ゲート 0 件／Research 正準順 0・非正準順は golden（17 品）／**Hint 5.0**（両品とも key-free で SAUCE／CHEESE／STRUCTURE／SUB_CLASS の梯子、出荷済みの梯子は不変）／保存安全性（昇格後の Dex・所有材料・在庫が読み込みで保持、読み込みは書き込まない）。staged 全体 9 ファイル 30 件合格。**本番昇格は未承認、B20-A の後。**

## 6. buffalo-sauce の POST_BAKE と通常レシピの可否【実測】
- `POST_BAKE` はレシピの要求側の属性（`requiredIngredients[].applicationPhase`）で、FINISH 工程が「焼成後に置く駒」を扱う（`finishEngine.ts`、`cookingProfiles.ts#deriveCoreSteps`）。POST_BAKE を持つ内容は late カタログにだけ入る（`lateCatalog.ts` 冒頭、`validateLateCatalog`: late レシピは POST_BAKE 要求が必須）。**通常カタログに POST_BAKE のレシピは構造上置けない。**
- 現行の FINISH は「駒を置く」ものだけ。焼成後の液体（ソースを垂らす）は DRIZZLE（#579、PR #776・#746、いずれも本番 OFF・未 merge）で、まだ本番で使えない。
- したがって **buffalo-chicken-pizza を通常レシピで実装するには buffalo-sauce を焼成前にするしかなく、これは Owner が未承認**。承認が無い限り通常レシピとしての実装はできない（実装可能性の結論: 技術的には可能、方針的には不可）。
- 既存仕様を壊さない最小案（いずれも Owner 判断待ち、実装しない）:
  - 案 A（要承認）: 通常レシピ、buffalo-sauce は焼成前の spread ソース。追加の仕組み不要、出典の工程が変わる。
  - 案 B: late レシピ、buffalo-sauce を late 専用の **topping（点状のたまり）として POST_BAKE**。新しい仕組み不要、`tarako-cream-pizza`（nori）と同型。ソースを topping に分類する点が判断対象。Hint 5.0 には family と size class が要る。
  - 案 C: DRIZZLE（#776）の実装・本番化を待ち、液体として POST_BAKE。出典に最も忠実だが依存が大きく、時期が未定。
  - 推奨: 保留（A は未承認）。進めるなら B。

## 7. アイコン案（G18: 代替表示は全カタログで一意【実測】）
| 食材 | 絵の案 | 代替表示（テキスト） | 備考 |
|---|---|---|---|
| honey | 専用 SVG は不要。琥珀の塗り（`#e8a93a`）。トレイの札は小さな蜜ろうの六角形 | 🐝 ✓ | 🍯は miso-sauce が使用済み（禁止）、🟡は mustard、🧈は fresh-cream-sauce。塗りの色が mustard と近いので、色差の確認が必要【未確認】 |
| fennel | 専用 SVG（白い球根の輪切り＋羽状の葉） | 🪻 ✓ | 🌱 artichoke、🥗 arugula、🍃 yuzu-kosho、🌾 green-onion は使用済み。🪻は花に見えるため SVG を先に推奨 |
| truffle | 専用 SVG: 焼成後に置く薄いスライス。濃い茶（`#3b2a20`）の不整形な輪切りに、淡いクリーム色の網目の筋。5〜7 枚の小さな輪切り | 🌑 ✓（🍘🪨🤎🍫も空き） | 焼成チーズ上でも暗色で読めるが、実機コントラストは未計測【未確認】。サイズ s、family は vegetable（staged の暫定） |
| buffalo-sauce | 案 B: 橙赤（`#d9481c`）の光る点状のたまり 3〜4 個。案 A: 塗りの色のみ | 🍷 ✓（🧨🔻も空き） | 🟥 pomegranate、🟧 paprika-powder、🔶 cheddar、🔴 pepperoni は使用済み |
- 4 つとも専用 SVG は未作成。#417 の担当領域で、配線は HOT（`IngredientGlyph.tsx`・`App.css`）のため B20-A の後。

## 8. 次の 4 品の Research 変更（昇格単位別、**全件 Owner 未承認**）
各単位は B20-A＋taco/okonomiyaki を先に入れた状態からの追加。全単位で **正準順の変化は 0**。ID・変更前後・原因レシピ（共有材料）の全件は data ファイル `TETO_NEXT-TRAIN_Research-ByUnit` に記載。要約:
| 単位 | 変わる既存 ID 数 | 原因レシピと主な共有材料 | 代表例（変更前後） |
|---|---|---|---|
| pizza-finocchi-salad | 22 | 材料の mozzarella／olive-oil／black-olive／mint を共有する既存レシピ | baba-ganoush-pizza `-->B B->C`、vongole `C->D B->C`、pizza-bianca-ricotta `B->C C->D` |
| pizza-cavolo-carote | 14 | olive-oil／mozzarella／lemon を共有 | grandma-pizza ほか |
| black-truffle-pizza（NO_SAUCE） | 4 | mozzarella／parmigiano を共有 | new-haven-apizza `-->A`、parmigiana-pizza、quattro-formaggi、spinach-artichoke-pizza |
| buffalo-chicken-pizza | 8 | gorgonzola／mozzarella／chicken／（pesto-noci-pizza 経由）を共有 | bbq-chicken-pizza `-->A`、curry-pizza-japan、frango-catupiry、jamaican-jerk-chicken-pizza、pesto-noci-pizza `-->A` など |
- **4 品の ID の和集合は 34**（単独の和 48）。うち B20-A の 10 ID と重なる 5（pesto-burrata-pizza／pesto-pollo／pesto-salmone／pesto-tonno／quattro-formaggi）、承認済み 17 品と重なる 5（pesto-burrata-pizza／pizza-alla-crudaiola／pizza-feta-eliniki／reina-pepiada-pizza／veggie-supreme-pizza）。**この 4 品だけで新しく増える ID は 25**。B20-A＋17＋4 品の ID の和集合は 50。
- 重なる ID は同じ ID でも遷移が増えるため、承認は ID だけでなく**昇格単位ごとの遷移**で取る必要がある。
- 限界【未確認】: 新食材は仮定義、数量・ladder は暫定。Hint 5.0 の golden と本番 `validateLateCatalog`（4 品分）は未実行。buffalo は通常／late の配置で ID の集合は変わらないが（Research は ID の集合で決まる）、ladder 上の位置は変わる。

## 9. Owner 判断事項
1. B20-A の実装 GO、新 Issue／HOT claim の開設。あわせて honey 層・mozzarella なし・walnut family の確定。
2. honey の代替表示（🐝 を推奨）と、トレイ札の絵。
3. buffalo-sauce の案 A／B／C。
4. WebKit run 42455506474 の失敗 1 件（grandma E-AC2）を、同じ SHA の再実行で確認してよいか。
5. 4 品の Research 34 ID（新規 25 ID）を、昇格単位ごとの遷移で承認する時期。
