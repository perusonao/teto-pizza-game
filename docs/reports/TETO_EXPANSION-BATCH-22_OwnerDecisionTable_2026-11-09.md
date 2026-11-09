# Expansion Batch 22 — Owner 決定表（6 レシピ・10 食材）（#780、docs-only・提案と実測のみ）

2026-11-09 / 基準 main `719428e0`（#800 merge 後）。**この表の「提案」はどれも Owner の承認まで確定扱いにしない。承認までは B22 の HOT ファイルを編集しない。** 原典 pizzadb.jp は未確認（全値が GAMEPLAY ASSUMPTION）。凡例: 【確定】Owner 決定（2026-11-09）、【実測】コード・データの読取りと今回の測定、【推論】実測からの解釈、【提案】私の案（未承認）、【未確認】測っていない。構成の元は `docs/reports/TETO_EXPANSION-BATCH-22_Prep_2026-11-09.md`（#801）と staged（`src/data/staged/testSupport/*`）。

## 0. 確定済み（Owner 2026-11-09）と、本書で訂正する点
| 項目 | 内容 |
|---|---|
| 【確定】truffle | family = `vegetable`、size = `xs`。形は不規則な薄切り（既存 SVG `truffle-shavings`）。後乗せのトッピング |
| 【確定】sunflower-seeds | family = `spice`、size = `xs` |
| 【確定】brie | cheese、size = `l` |
| 【確定】balsamic-vinegar | 焼成前の第 2 ソース層（案 A） |
| 【確定】buffalo-sauce | 焼成前の PAINT ソース（buffalo-chicken は M7 から外れ B22 へ。M7 台帳は別 PR で更新） |
| 【確定・条件付き】通常レシピ | speck-e-brie・buffalo-chicken は通常 step 72・73（late 側の導出番号が +2 になることを実装時に検証） |
| 【確定・暫定】絵文字 | 🦬（buffalo-sauce）・🏺（balsamic-vinegar）を暫定許容 |
| **【訂正】#801 の balsamic の色案** | #801 は「暗い茶 `#3b2a2e` 付近、近い色は okonomiyaki-sauce・bbq-sauce」と書いたが、**測定の結果は誤りだった**。`#3b2a2e` は soy-sauce（`#2a1a12`）に **dE 11.5** まで近く、基準（他のソースと dE ≥ 25、late4 の先例）を満たさない。§3 に測定と代替案を示す。#801 の本文も同じ内容で訂正した |

## 1. 6 レシピの決定表（材料・個数・焼成前後・ソース・Hint）
材料と個数は staged の値（`minCount`）。焼成前後の割り当てと置き場所は【提案】（D-5 の「生の葉物・柑橘は原則後乗せ」に従う）。ID の改名は D-4（接尾辞を外す）。

| # | レシピ（現 id → B22 の id） | 材料（個数） | 焼成前 | 後乗せ（POST_BAKE） | ソース（sauce profile） | 置き場所・step |
|---|---|---|---|---|---|---|
| 1 | `pizza-finocchi-salad` | black-olive 2・fennel 2・mint 2・mozzarella 3・olive-oil 1・orange 2 | olive-oil 1（塗る）・mozzarella 3・black-olive 2・fennel 2・mint 2 | **orange 2** | olive-oil `PAINT_TEMPORARY`（§2 D3） | late（後乗せあり） |
| 2 | `pizza-cavolo-carote` | carrot 2・lemon 2・mozzarella 3・olive-oil 1・red-cabbage 2・sunflower-seeds 2 | olive-oil 1（塗る）・mozzarella 3・carrot 2・sunflower-seeds 2 | **lemon 2・red-cabbage 2** | olive-oil `PAINT_TEMPORARY`（§2 D3） | late |
| 3 | `pizza-radicchio-noci` | balsamic-vinegar 1・mozzarella 3・olive-oil 1・radicchio 2・walnut 2 | 第 1 層 balsamic 1 → 第 2 層 olive-oil 1（2 つの塗り層）・mozzarella 3・walnut 2 | **radicchio 2** | 主 = olive-oil `PAINT_TEMPORARY`、balsamic は profile 無しで「存在」採点（§2 D4） | late |
| 4 | `black-truffle-pizza` | mozzarella 3・parmigiano 3・truffle 2 | mozzarella 3・parmigiano 3 | **truffle 2**（staged が `POST_BAKE`） | **なし（NO_SAUCE）** | late |
| 5 | `speck-e-brie-pizzadb` → `speck-e-brie` | brie 3・mozzarella 3・prosciutto-crudo 2・walnut 2 | すべて焼成前（staged に後乗せの記述なし） | なし | **なし（NO_SAUCE）** | 通常 step 72（brie が新規。key レシピ） |
| 6 | `buffalo-chicken-pizzadb` → `buffalo-chicken` | buffalo-sauce 1・chicken 2・gorgonzola 3・mozzarella 3 | buffalo-sauce 1（**塗る**）・chicken 2・gorgonzola 3・mozzarella 3 | なし（staged の POST_BAKE は不可、§0） | buffalo-sauce `PAINT`（新しい値） | 通常 step 73（buffalo-sauce が新規。key レシピ） |

【実測】staged のその他の項目: 生地は 1〜3 が thin（standard クラス）、4・5 が neapolitan、6 が不明。6 品とも `mechanics: []`（新しい調理工程なし）。重複 Gate（同一・部分・上位集合・1 材料差・Jaccard > 0.4）は 6 品とも該当 0（B21 反映後の staged golden、`decisions.nextPromotable`）。

## 2. 決定が必要な項目（各に推奨つき）
| ID | 論点 | 推奨 | 根拠・注意 |
|---|---|---|---|
| **D1** | 上の 6 レシピの材料・個数・焼成前後の割り当てを承認するか | 承認 | 材料と個数は staged のまま。割り当ては D-5 に従う【提案】 |
| **D2** | 後乗せにする食材（orange／lemon・red-cabbage／radicchio／truffle）。**mint**（生のハーブ）は焼成前としたが、D-5 の原則では後乗せの候補でもある | 提案どおり（mint は焼成前）。mint を後乗せにする場合は finocchi の後乗せが 2 つになる | 【未確認】mint を出荷済みのレシピがどちらで扱っているかは今回確認していない。late カタログは後乗せを 1 つ以上要する（`validateLateCatalog`）ので、1〜3 を後乗せなしの通常レシピにすると通常 step が増える（選択肢。推奨しない） |
| **D3** | finocchi・cavolo の sauce profile。staged は `sauce: none`（原典の欄は「ノンソース」）だが olive-oil を要求する | **olive-oil `PAINT_TEMPORARY`**（出荷済みの先例: quattro-formaggi・fugazza・pizza-bianca・vongole・pizza-feta-eliniki ほか。`recipeSauceProfiles.ts` は「olive-oil はそのレシピ固有の mapping で一般規則ではない」と明記） | 【推論】NO_SAUCE（`null`）にすると、sauce カテゴリの olive-oil が材料にあるのに Hint の SAUCE 段が無い（key-free の規則は材料のカテゴリから段を作る）ため、`recipeSauceProfiles` の `null` ＝「sauce を塗らない」と矛盾する。radicchio-noci も同じ |
| **D4** | radicchio-noci の 2 つの塗り層。主ソース（Reference の目標）をどちらにするか | **主 = olive-oil**（既存の `ingredientId`）、balsamic は profile 無しで存在採点（B19 pesto-burrata の olive-oil、B20-A pesto-noci の honey と同じ方式）。層の順は matrix の `spreadLayers`（balsamic → olive-oil） | balsamic を主にすると `ingredientId` の型に `balsamic-vinegar` を足す必要があり、新しい PAINT 行が 1 つ増える |
| **D5** | ソースの色（§3）と、SVG の無い 2 種の見た目 | balsamic `#502040`、buffalo-sauce `#ff6a13`（測定値は §3） | SVG が無い buffalo-sauce・balsamic は絵文字（🦬・🏺）が**そのままチップに見える**（Owner の暫定許容どおり） |
| **D6** | 残りの family・size の確認（truffle・sunflower-seeds・brie は確定済み） | §4 の提案どおり | fennel・carrot・red-cabbage・radicchio = vegetable、orange = fruit。size は §4 |
| **D7** | step 配置（§5）と、各 step の食材の並び順（key 材料を最後） | §5 の提案 | Research 文字・コホートの key は step の最後の材料で決まるため、並び順は Research の測定結果に影響する |
| **D8** | **Research 文字の非正準順の変化**（§6、35 ID） | 実装時に実測し直した最終の ID 別一覧への承認。正準順は 0 の見込み | 承認外の 1 件でも出たら停止。B21 では 17 ID を個別承認した前例 |
| **D9** | NO_SAUCE の 2 品（black-truffle・speck-e-brie）の再監査 | 実装時に TQ-1D の `null` 行・Technique・DH4-PROD ゲート（NO_SAUCE 集合は sauce-profile 権威から導出）を再監査。ゲートは弱めない | black-truffle は late の「後乗せ」Technique とも重なる【未確認: 実際の重なり方は実装時に監査】 |
| **D10** | 列車を分割するか（全量は縮小しない） | 分割しない（1 PR）。ただし D8 の ID 数が多いので、分割も選べる（§6） | 分割しても対象は減らない |

## 3. ソースの色（dE の測定）【実測】
測定方法は `expansionBatch17.test.ts` と同じ（sRGB → CIE Lab、ユークリッド距離）。比較対象は出荷済みの全ソース（tomato-sauce `#c73b2e`、olive-oil、pesto、fromage-blanc、doubanjiang、curry-ketchup、mustard、umeboshi、sour-cream、honey、yuzu-kosho、miso、tahini、bbq、soy、fresh-cream、okonomiyaki）。基準は「他のソースと dE ≥ 25」（late4 の先例。**この基準を B22 に適用するかは Owner の判断**）。

| 食材 | 候補色 | 最も近いソース（dE） | 2 番目 | 判定 |
|---|---|---|---|---|
| balsamic-vinegar | `#3b2a2e`（#801 の提案） | **soy-sauce 11.5** | okonomiyaki 21.4 | **不可** |
| balsamic-vinegar | `#4a1f33` | soy-sauce 21.6 | okonomiyaki 25.6 | 不可 |
| balsamic-vinegar | **`#502040`**（深いプラム色） | soy-sauce 28.8 | okonomiyaki 32.3 | 可（推奨） |
| balsamic-vinegar | `#2e1a3d`（藍黒） | soy-sauce 29.6 | okonomiyaki 40.6 | 可（紫が強い） |
| buffalo-sauce | `#d2491c` | **tomato-sauce 13.8** | doubanjiang 30.4 | 不可 |
| buffalo-sauce | `#e8651a` | curry-ketchup 24.7 | tomato 26.1 | わずかに不足 |
| buffalo-sauce | `#f26b21` | curry-ketchup 25.3 | tomato 27.5 | 可（境界） |
| buffalo-sauce | **`#ff6a13`**（明るい橙赤） | curry-ketchup 31.3 | tomato 33.2 | 可（推奨） |

- 注意: 本物のバルサミコの色（黒に近い茶）は soy-sauce と近く、dE ≥ 25 を満たすには**紫寄り**にする必要がある。見た目の判断は Owner（`#502040` は暗いワイン色に見える）。【未確認】ピザ上（生地・焼きチーズ）での視認は E2E の比較画像で確認する。
- 食材（トッピング）8 種の色は専用 SVG の `fill` に合わせる【提案】: fennel `#e4edc2`、orange `#f59a1c`、carrot `#ee7d28`、red-cabbage `#9a4a9e`、sunflower-seeds `#e6d49a`、radicchio `#a42a40`、truffle `#4a382e`、brie `#f6edc6`（`stagedGlyphPalette.ts`、PROVISIONAL）。

## 4. 10 食材の決定表（family・size・SVG・絵文字）
| 食材 | 種別・配置 | family（【確定】は Owner 決定） | size | 専用 SVG | 絵文字（フォールバック） |
|---|---|---|---|---|---|
| fennel | topping／scatter | vegetable【提案】 | s【提案】 | あり `fennel-slices` | 🪻（隠れる） |
| orange | topping／scatter | fruit【提案】 | s【提案】 | あり `orange-slices` | 🍊（隠れる） |
| carrot | topping／scatter | vegetable【提案】 | s【提案】 | あり `carrot-rounds` | 🥕（隠れる） |
| red-cabbage | topping／scatter | vegetable【提案】 | s【提案】 | あり `red-cabbage-shreds` | 🫐（隠れる） |
| sunflower-seeds | topping／scatter | **spice【確定】**（`other` は OD-DH4-2-9 で不可、walnut の前例） | **xs【確定】** | あり `sunflower-kernels` | 🌻（隠れる） |
| radicchio | topping／scatter | vegetable【提案】 | m【提案】 | あり `radicchio-leaf` | 🌹（隠れる） |
| truffle | topping／scatter（後乗せ） | **vegetable【確定】** | **xs【確定】** | あり `truffle-shavings`（不規則な薄切り） | 🍄‍🟫（隠れる） |
| brie | cheese／scatter | なし | **l【確定】**（mozzarella・feta・cheddar と同じ） | あり `brie-wedge` | 🌕（隠れる） |
| buffalo-sauce | sauce／spread | なし | なし | **なし** | **🦬（そのままチップに見える・暫定許容【確定】）** |
| balsamic-vinegar | sauce／spread | なし | なし | **なし** | **🏺（そのままチップに見える・暫定許容【確定】）** |

【実測】G18／H5-INV-2: 上の 10 個の絵文字は、出荷済みの `ingredients.ts`・`lateCatalog.ts` のどの行の絵文字とも重ならず、Hint 5.0 の family 記号（🥬 vegetable・🪴 herb・🥩 meat・🌊 seafood・🧂 spice・🍇 fruit・✨ other）とも一致しない（実装時にテストで再検査）。注意: 🍄‍🟫（truffle）は Unicode 15.1（2023）の絵文字で古い iOS では 2 文字に分かれて表示されるが、truffle は専用 SVG で描くため絵文字は隠れたフォールバックのみ。

## 5. step 配置の提案【提案】
【実測】現在の ladder は通常 step 71 本＋late 9 本（late は通常の後ろに続き、導出番号は「通常 step 数 + k」）。B22 後の想定:
| step | 種別 | key レシピ | 解放する食材（key 材料を最後） | 備考 |
|---|---|---|---|---|
| 72 | 通常 | speck-e-brie | brie | 新規の通常 step |
| 73 | 通常 | buffalo-chicken | buffalo-sauce | 新規の通常 step |
| late（既存 9 本） | late | — | — | 導出番号が +2（B21 の 79・80 → 81・82）。`LATE_ENTITLEMENT_FLOORS` は固定のため floors は不変 |
| 新規 late 4 本（導出 83〜86） | late | pizza-finocchi-salad | fennel, orange | floors は導出番号（83）に固定 |
| | late | pizza-cavolo-carote | carrot, red-cabbage, sunflower-seeds | floors 84 |
| | late | pizza-radicchio-noci | radicchio, balsamic-vinegar | floors 85 |
| | late | black-truffle-pizza | truffle | floors 86 |

- 6 レシピとも ladder に新しい step を 1 本ずつ足し（通常 2・late 4）、クレジット済みレシピも 6 増えるので、スラック（余裕 1）は変わらない【推論。実装時に `catalogLedger.test.ts` と `ladderReachability.starGate.test.ts` で検証】。合計 step は 71 → 86。
- 測定用の仮想 ladder で step 数が 86 になることを確認した（§6 の測定）。

## 6. Research 文字の変化（非正準順）【実測】
測定方法: 実装前の what-if。`researchLetterChangesAcrossOrders`（B19〜B21 と同じ監査、既定の 40 本のランダム順・seed 20261105）を、仮想の食材 10 行・仮想の ladder（§5 の配置）・6 レシピを足した状態で実行した（test の mock のみ。出荷済みファイルは変更していない）。測定スクリプトと結果は `docs/reports/data/TETO_B22_research-what-if.test.ts.txt`・`TETO_B22_research-what-if.json`。

- **正準順（ladder の順）で文字が変わる出荷済みレシピ: 0**（停止条件に当たらない）。
- **非正準順で文字が変わる出荷済みレシピ: 35 ID**（付録 A に ID ごとの before→after）。承認は ID ごとに必要。承認外の 1 件でも出れば停止。
- 新レシピ 1 つだけを足した場合の影響 ID 数: finocchi 22／cavolo 14／radicchio 13／black-truffle 4／speck-e-brie 2／buffalo-chicken 8。3 品の合計（truffle・speck・buffalo）は 12 ID、6 品の和集合は 35 ID（組み合わせだけで出る変化は無い）。
- 影響の大半は、olive-oil を最後に所持する順の合成シナリオ（finocchi・cavolo・radicchio が olive-oil を共有するため）。承認の前例: B21 では 17 ID を ID ごとに承認した（変化の形は同じ「非正準順」）。
- **この測定は仮想の配置・構成に依存する**。D1・D7 で配置や構成が変わると ID の集合が変わりうる。最終の承認対象は、実装時に出荷前の実カタログで測り直した一覧とする（B21 と同じ手順）。

## 7. Hint 5.0（key-free、段の構成）【推論】
`hint5Ladder.ts` のキー無し規則（SAUCE があれば先頭、CHEESE があれば次、STRUCTURE、その後トッピングごとの SUB_CLASS）から導出。実装時に `buildHint5Ladder` で測定する【未確認】。6 品とも key-free（`recipeHintRoles` に `{ keyFree: true }`）の提案。
| レシピ | 段の構成 |
|---|---|
| pizza-finocchi-salad | SAUCE[olive-oil] → CHEESE[mozzarella] → STRUCTURE → SUB_CLASS ×4（black-olive・fennel・mint・orange） |
| pizza-cavolo-carote | SAUCE[olive-oil] → CHEESE[mozzarella] → STRUCTURE → SUB_CLASS ×4（carrot・lemon・red-cabbage・sunflower-seeds） |
| pizza-radicchio-noci | SAUCE[balsamic-vinegar, olive-oil] → CHEESE[mozzarella] → STRUCTURE → SUB_CLASS ×2（radicchio・walnut） |
| black-truffle-pizza | CHEESE[mozzarella, parmigiano] → STRUCTURE → SUB_CLASS ×1（truffle）。SAUCE 段なし |
| speck-e-brie | CHEESE[brie, mozzarella] → STRUCTURE → SUB_CLASS ×2（prosciutto-crudo・walnut）。SAUCE 段なし |
| buffalo-chicken | SAUCE[buffalo-sauce] → CHEESE[gorgonzola, mozzarella] → STRUCTURE → SUB_CLASS ×1（chicken） |
- 識別性: 新ソース 2 種（buffalo-sauce・balsamic）の SAUCE 段の開示が他のレシピと区別できるか、truffle（vegetable・xs）の SUB_CLASS の family 記号が DH4-PROD の「other 不可」を保つかは、実装時の Hint 5.0・DH4-PROD の測定で確認する【未確認】。ゲートは弱めない。

## 8. 承認文の案（Owner がそのまま使える）
「B22 の D1・D2・D3・D4・D5（色は balsamic `#502040`／buffalo-sauce `#ff6a13`）・D6・D7・D9 を推奨どおり承認。D8（Research 文字）は、実装時に測り直した ID 別一覧の個別承認とする。D10 は分割しない。」
承認後の順序: ① T-B22 の claim を HOT 範囲へ更新 → ② HOT 編集（1 PR）→ ③ 全 Vitest・CI・Codex・Chromium／WebKit E2E → ④ Research の ID 別一覧と Owner の承認 → ⑤ iPhone HV 依頼（merge は Owner のみ）。

## 付録 A. Research 文字の変化（非正準順、35 ID）
`-` は文字なし（例 `-->A` は「文字なし → A」）。同じ ID でも順序によって複数の変化が出る。
| # | 出荷済みレシピ | 変化（before→after） | 一例の所持順 |
|---|---|---|---|
| 1 | `baba-ganoush-pizza` | (なし)→B B→C F→G G→I I→K J→L K→M L→N L→O | every ladder material, olive-oil last |
| 2 | `bacalhau` | (なし)→A | bacalhau + pizza-finocchi-salad materials only, black-olive last |
| 3 | `bbq-chicken-pizza` | (なし)→A | bbq-chicken-pizza + buffalo-chicken materials only, chicken last |
| 4 | `boscaiola` | (なし)→A (なし)→B A→B B→C D→E E→F F→G | every ladder material, olive-oil last |
| 5 | `brazilian-calabresa` | (なし)→A | brazilian-calabresa + pizza-finocchi-salad materials only, black-olive last |
| 6 | `calabresa-argentina` | (なし)→A | calabresa-argentina + pizza-finocchi-salad materials only, black-olive last |
| 7 | `capricciosa` | (なし)→A | capricciosa + pizza-finocchi-salad materials only, black-olive last |
| 8 | `curry-pizza-japan` | (なし)→B B→C D→E E→F | every ladder material, chicken last |
| 9 | `eggplant-ricotta-pizza` | (なし)→A (なし)→B B→C F→G H→I | every ladder material, olive-oil last |
| 10 | `frango-catupiry` | (なし)→B B→C C→D E→F F→G | every ladder material, chicken last |
| 11 | `fugazza` | (なし)→A (なし)→B A→B B→C C→D D→E E→F | every ladder material, olive-oil last |
| 12 | `grandma-pizza` | (なし)→A (なし)→B A→B B→C C→D E→F G→H | every ladder material, olive-oil last |
| 13 | `jamaican-jerk-chicken-pizza` | (なし)→B A→B C→D | every ladder material, chicken last |
| 14 | `new-haven-apizza` | (なし)→A | new-haven-apizza + black-truffle-pizza materials only, parmigiano last |
| 15 | `palmito-pizza` | (なし)→A | palmito-pizza + pizza-finocchi-salad materials only, black-olive last |
| 16 | `parmigiana-pizza` | (なし)→B B→C D→E | quattro-formaggi + black-truffle-pizza materials + eggplant, parmigiano last |
| 17 | `pesto-burrata-pizza` | (なし)→A (なし)→B B→C D→E G→I H→I I→K J→K J→L | every ladder material, olive-oil last |
| 18 | `pesto-noci-pizza` | (なし)→A (なし)→B B→C | every ladder material, gorgonzola last |
| 19 | `pesto-pollo` | (なし)→B A→B B→C C→D D→E | pesto-pollo + buffalo-chicken materials only, chicken last |
| 20 | `pesto-salmone` | (なし)→B B→C | pesto-salmone + pizza-cavolo-carote materials only, lemon last |
| 21 | `pesto-tonno` | (なし)→A | pesto-tonno + pizza-finocchi-salad materials only, black-olive last |
| 22 | `pizza-alla-crudaiola` | (なし)→A (なし)→B A→B B→C C→D | every ladder material, olive-oil last |
| 23 | `pizza-bianca` | (なし)→A (なし)→B A→B B→C C→D D→E | every ladder material, olive-oil last |
| 24 | `pizza-bianca-ricotta` | B→C C→D D→E E→F F→H H→J I→J I→K J→L K→M K→N | every ladder material, olive-oil last |
| 25 | `pizza-feta-eliniki` | (なし)→A (なし)→B B→C F→H G→H H→I H→J I→J I→K | every ladder material, olive-oil last |
| 26 | `pizza-portuguesa` | (なし)→A | pizza-portuguesa + pizza-finocchi-salad materials only, black-olive last |
| 27 | `prosciutto-funghi` | (なし)→A | prosciutto-funghi + speck-e-brie materials only, prosciutto-crudo last |
| 28 | `puttanesca-pizza` | (なし)→A | puttanesca-pizza + pizza-finocchi-salad materials only, black-olive last |
| 29 | `quattro-formaggi` | (なし)→A (なし)→B A→B B→C | quattro-formaggi + pizza-finocchi-salad materials only, olive-oil last |
| 30 | `reina-pepiada-pizza` | (なし)→A | reina-pepiada-pizza + buffalo-chicken materials only, chicken last |
| 31 | `shirasu-pizza` | (なし)→B A→B | every ladder material, lemon last |
| 32 | `spinach-artichoke-pizza` | (なし)→B A→B B→C C→D | every ladder material, parmigiano last |
| 33 | `supreme-pizza` | (なし)→A | supreme-pizza + pizza-finocchi-salad materials only, black-olive last |
| 34 | `veggie-supreme-pizza` | (なし)→A | veggie-supreme-pizza + pizza-finocchi-salad materials only, black-olive last |
| 35 | `vongole` | B→C C→D F→G H→J J→L L→N M→O M→P | every ladder material, olive-oil last |
