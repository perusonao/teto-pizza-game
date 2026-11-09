# Expansion Batch 22 — 準備（仕様案・調査・担当分離）6 レシピ・10 食材（#780）

> **更新 2026-11-09（Owner 決定を受けて）**: truffle（vegetable／xs、不規則な薄切り）・sunflower-seeds（spice／xs）・brie（size l）・balsamic（焼成前の第 2 ソース層）・buffalo-sauce（焼成前 PAINT）・通常 step 72・73・絵文字 🦬／🏺（暫定）は確定。**6 レシピの材料・個数・焼成前後・ソース・Hint・Research 文字などの決定表は `TETO_EXPANSION-BATCH-22_OwnerDecisionTable_2026-11-09.md`**（承認までは B22 の HOT 編集をしない）。以下の本文は提案時点の記述で、色の訂正だけ反映している。

2026-11-09 / 基準 main `e74383b4`（B21 merge 後）。**本書は仕様の提案であり、どの項目も Owner 承認までは確定扱いにしない**（データ・コードの実装は未着手。HOT ファイルは編集していない）。凡例: 【実測】コード・データ・GitHub の読取り、【提案】私の案（未承認）、【未確認】測っていない。原典 pizzadb.jp は未確認（全値が GAMEPLAY ASSUMPTION）。

## 1. 対象（B21 計画書の B22 に同じ。重複・漏れなし）【実測】
- レシピ 6: `pizza-finocchi-salad`・`pizza-cavolo-carote`・`pizza-radicchio-noci`・`black-truffle-pizza`・`speck-e-brie`（現 id `speck-e-brie-pizzadb`）・`buffalo-chicken`（現 id `buffalo-chicken-pizzadb`）。ID 改名 2 件は D-4（接尾辞を外す、衝突なし・参照なしを staged で検証済み）。
- 食材 10 + 再利用 1: fennel・orange・carrot・red-cabbage・sunflower-seeds・radicchio・balsamic-vinegar・truffle・brie・buffalo-sauce、再利用 blue-cheese-dressing→gorgonzola（I-1）。
- 既に出荷済みで再利用する材料: lemon・mint・black-olive・olive-oil・mozzarella・parmigiano・prosciutto-crudo・walnut・chicken・gorgonzola。
- 重複 Gate（staged の測定、B21 反映後）: 6 レシピとも同一・部分・上位集合・1 材料差・Jaccard > 0.4 の該当 **0**。D-6（Research 正準順の変化は未承認）に引っかからない 6 品（decisions golden の `nextPromotable`）。

## 2. 構成の提案【提案】
個数は staged の暫定値（チーズ 3・具材 2・ソース 1）。窓 58–78・100 Pitz・Lunch Rush なし・CUT なし・key-free Hint・ladder-credited は B21 と同じ規約。後乗せは D-5（生の葉物・柑橘は原則後乗せ）に従う。

| レシピ | 材料（個数）／後乗せ | ソース | 置き場所 |
|---|---|---|---|
| pizza-finocchi-salad | black-olive 2・fennel 2・mint 2・mozzarella 3・olive-oil 1（塗る）／**orange 2 後乗せ** | olive-oil（既存の PAINT_TEMPORARY） | late（後乗せあり） |
| pizza-cavolo-carote | carrot 2・mozzarella 3・olive-oil 1・sunflower-seeds 2／**lemon 2・red-cabbage 2 後乗せ** | olive-oil | late |
| pizza-radicchio-noci | mozzarella 3・olive-oil 1・balsamic-vinegar 1・walnut 2／**radicchio 2 後乗せ** | olive-oil＋balsamic（§4） | late |
| black-truffle-pizza | mozzarella 3・parmigiano 3／**truffle 2 後乗せ** | なし（NO_SAUCE） | late |
| speck-e-brie | brie 3・mozzarella 3・prosciutto-crudo 2・walnut 2 | なし（NO_SAUCE） | **通常**（後乗せなし） |
| buffalo-chicken | buffalo-sauce 1（**焼成前に塗る**、§5）・chicken 2・gorgonzola 3・mozzarella 3 | buffalo-sauce（新ソース PAINT） | **通常**（後乗せなし） |

構造上の制約（late カタログ規則、`validateLateCatalog` と staged の 8 項目確認）: late レシピは後乗せ（トッピング）を 1 つ以上要し、**ソース・チーズは後乗せにできない**。staged の `buffalo-chicken` は buffalo-sauce を POST_BAKE としているが、ソースなので不可 → 焼成前の PAINT ソースに変える（提案）。後乗せのない speck-e-brie・buffalo-chicken は**通常カタログ**で、新しい通常 ladder step（72・73）を要し、late の導出 step 番号が +2 動く（floors は固定で不変、B19／B20-A と同じ扱い）。

## 3. 食材 10 種の提案【提案】
| id | 種別／配置 | family／size（提案） | 専用 SVG | 絵文字（提案、隠れる場合はフォールバック） |
|---|---|---|---|---|
| fennel | topping／scatter | vegetable／s | あり（`fennel-slices`、#797→main） | 🪻 |
| orange | topping／scatter | fruit／s | あり（`orange-slices`） | 🍊 |
| carrot | topping／scatter | vegetable／s | あり（`carrot-rounds`） | 🥕 |
| red-cabbage | topping／scatter | vegetable／s | あり（`red-cabbage-shreds`） | 🫐 |
| sunflower-seeds | topping／scatter | **spice**／xs（`other` は OD-DH4-2-9 で不可、walnut の前例） | あり（`sunflower-kernels`） | 🌻 |
| radicchio | topping／scatter | vegetable／m | あり（`radicchio-leaf`） | 🌹 |
| truffle | topping／scatter | vegetable／xs（staged の暫定行、§6） | あり（`truffle-shavings`） | 🍄‍🟫 |
| brie | cheese／scatter | なし／l（mozzarella・feta・cheddar と同じ `l`） | あり（`brie-wedge`） | 🌕 |
| buffalo-sauce | sauce／spread | なし | **なし（チップ面は絵文字が見える）** | 🦬（G18 は実装時のテストで検査） |
| balsamic-vinegar | sauce／spread | なし | **なし（見える）** | 🏺 |

- 絵文字の候補は、出荷済みの全絵文字と Hint の family 記号に対する重複を機械照合した未使用の値（実装時に G18 テストで再検査）。SVG のある 8 種は絵文字が表示されない（#799 の訂正どおり）。**SVG の無い buffalo-sauce・balsamic-vinegar は絵文字がそのままチップに見える**ので、Owner の見た目判断が要る（Q-3 と同じ扱い）。
- SVG の配線は B22 の列車 PR（HOT）か T-SVG 型の配線 PR で行う。SVG の色・形は PROVISIONAL のまま。

## 4. balsamic-vinegar の調査と仕様案【実測＋提案】
- **使用箇所**: 設計行 172 のうち `pizza-radicchio-noci-pizzadb-p8` の 1 レシピだけ（staged の使用数 1）。matrix の分類は `sauce_or_condiment`、`sauceBase` は「ノンソース」、`spreadLayers` = [balsamic-vinegar, olive-oil]（2 つの塗り層、`MULTI_SPREAD_LAYER`・`LATE_ADDITION`（radicchio）の工程証跡）。
- **既存の仕組み**: 出荷済みの 2 ソース工程（pesto＋olive-oil＝B19 の 2 品、pesto＋honey＝B20-A、grandma）が 2 層の塗りを表現できる。後がけの液体（DRIZZLE #579）は PR #776（D1 の純粋ロジック・未配線・本番 OFF、対象は olive-oil のみ）で、使えない。
- **選択肢**:
  - **A（推奨）**: 焼成前の第 2 ソース層（honey の前例と同じ）。既存の 2 ソース工程だけで成立し、新しい機構が要らない。現実の調理（仕上げの回しがけ）とのずれは B20-A と同じ「ゲーム上の仮定」として明記。
  - B: 後乗せのトッピング扱い（小さな液だまりの絵）。後乗せの規則（トッピングのみ）を満たすが、液体をトッピングで表す新しい絵・サイズが要る。
  - C: DRIZZLE（#579）の本番化まで保留。B22 の 1 品（radicchio-noci）だけが遅れるが、全量の順序が崩れる。
- **ソース色**: 他のソースと dE ≥ 25 の分離が必要（late4 の前例）。【訂正 2026-11-09・実測】当初の提案 `#3b2a2e` は soy-sauce（`#2a1a12`）に dE 11.5 まで近く、基準を満たさない（近い色は okonomiyaki-sauce・bbq-sauce と書いたのは誤り）。代替案と測定値は `TETO_EXPANSION-BATCH-22_OwnerDecisionTable_2026-11-09.md` §3（`#502040` は最小 dE 28.8）。
- **Owner 判断**: A／B／C の選択（推奨 A）、色、絵文字 🏺。**承認前は確定扱いにしない**。

## 5. buffalo-sauce の調査【実測＋提案】
- staged は POST_BAKE だが、ソースは後乗せ不可（上記制約）。`recipeSauceProfiles` に新しい PAINT 行が要る（`ingredientId` の型に 1 値、okonomiyaki-sauce と同じ手順）。blue-cheese-dressing は gorgonzola に再利用（I-1、重複 Gate 非該当を staged で確認済み）。
- **Owner 判断**: buffalo-sauce を焼成前の PAINT にする案（推奨）で良いか。色（赤橙、tomato-sauce と dE ≥ 25 を測る）と絵文字。

## 6. truffle の仕様案【提案】
- Owner の基本案: **薄切りの不規則な形**。→ 既存 SVG `truffle-shavings`（暗褐色の不規則な薄片 3 枚、外形線あり、焼きチーズ・生地・トマト地に対して外形線のコントラスト > 3）がそのまま合う。形の追加作業は無し。
- 置き場所: 後乗せのトッピング（matrix の `postBakeFinish` が `truffle`、`catalog_design_tag`）。family は staged の暫定行 `vegetable`（`other` は不可。`spice`・`vegetable` のどちらにするかは、Hint 5.0 と DH4-PROD の測定で決める【未確認】）。size class `xs`。
- 色: 暗い面に暗い薄片になるので、ピザ上（焼きチーズ・パルミジャーノ上）での視認は E2E の比較画像で確認する。
- **Owner 判断**: 薄切りの不規則な形（基本案、承認済みの方針）の確定、family、色。

## 7. 事前に分かっているリスク・停止条件【実測＋未確認】
- **Research**: 正準順の既存文字変化は 0 の見込み（decisions golden）。**非正準順の変化は B22 の実装時に測り、B19／B20-A／B21 と同様に ID ごとの Owner 承認が必要**（記載外の変化は停止）。【未確認】
- **NO_SAUCE 2 品**（black-truffle・speck-e-brie）: TQ-1D の Technique 機構と DH4-PROD ゲート（NO_SAUCE 集合は sauce-profile 権威から導出）の再監査が要る。black-truffle は late の「後乗せ」Technique とも重なる。ゲートは弱めない。
- **新通常 step 2 本**（72・73）: late の導出番号が +2（B19／B20-A と同じ）。後続バッチの claim 順序に影響。
- Hint 5.0: 6 品とも key-free。新ソース（buffalo-sauce・balsamic）の SAUCE 段の識別は実装時に測る。

## 8. 担当・競合の分離【実測】
| 範囲 | 担当（現状） | 備考 |
|---|---|---|
| B22 の仕様・HOT カタログの編集（`ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`catalogLedger.test.ts`・golden ほか）と B22 のテスト・E2E | **本セッション（T-B22、新 claim）**。仕様承認までは本書のみ | HOT の同時編集は 1 session |
| tortilla-chips の SVG 配線 | 本セッション（T-SVG、claim 6738179452）。`IngredientGlyph.tsx`・`lateCatalog.ts` の tortilla 行 | **B22 の HOT 編集は T-SVG の merge 後に開始**（同じファイルのため直列） |
| #797 | docs のみ（B21 計画・台帳・U1〜U3）。別セッションが main を取り込み済み | 編集しない |
| #798 | docs＋デザート SVG 6 種（`src/components/dessertGlyphs/**`、未配線）＋M7 設計。担当 `session_016YrGi3yiM4Eoi3VmAUPwTW` | B23（デザート）の SVG 先行。B22 とファイル重複なし。B23 の配線は B22 の後 |
| staged（T-FX claim 6711787241、〜11/21） | T-FX | B22 の merge 後に staged の基準値を更新 |
| 食材 SVG（B22 の 8 種は制作済み・配線待ち） | #417（本セッションの S2 範囲は終了） | 配線は B22 の列車 PR |

## 9. 次の手順
1. Owner が §2 の構成・§3 のファミリ・§4（balsamic A／B／C）・§5・§6 を決める（1 回、各に推奨あり）。
2. T-SVG が merge されたら、B22 の実装を開始（HOT、1 PR、全 Vitest・CI・Codex・iPhone HV）。
3. B22 merge 後に B23（デザート 6＋1）の準備。
