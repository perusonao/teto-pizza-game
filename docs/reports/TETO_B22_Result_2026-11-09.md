# Expansion Batch 22 — Result Report（6 レシピ・10 食材、暫定仕様・原典未確認、Refs #780）

**状態:** Draft・Gate HOLD（merge 不可。**merge・Production ON・共有 Preview 更新はしていない**）。**Research の非正準順の文字変化 35 ID は Owner の個別承認待ち**（§5。承認前は merge しない）。原典 pizzadb.jp は未確認で、id・名前・数量・色・絵文字・size class・注文台詞はすべて GAMEPLAY ASSUMPTION。
**branch:** `claude/b22-implementation-780`（main `300e4b16` 基準）。**claim:** #780 コメント 6747734941（T-B22 の HOT 範囲）。

## 1. 実装内容
| 区分 | 内容 |
|---|---|
| 通常レシピ 2 | `buffalo-chicken`（通常 **step 72**、buffalo-sauce、焼成前 PAINT）・`speck-e-brie`（通常 **step 73**、brie、NO_SAUCE）。ID 改名（D-4）済み |
| late レシピ 4 | `pizza-finocchi-salad`（late 83: fennel・orange）・`pizza-cavolo-carote`（84: carrot・red-cabbage・sunflower-seeds）・`pizza-radicchio-noci`（85: radicchio・balsamic-vinegar）・`black-truffle-pizza`（86: truffle）。後乗せ: orange／lemon・red-cabbage／radicchio／truffle |
| 食材 10 | brie（cheese・size l・専用 SVG）、buffalo-sauce（sauce・色 `#ec5a12`・絵文字 🦬 が表示される）、balsamic-vinegar（sauce・色 `#3c1a4a`・🏺 が表示される）、fennel／carrot／red-cabbage／radicchio（vegetable）、orange（fruit）、sunflower-seeds（spice・xs）、truffle（vegetable・xs・不規則な薄切り）。8 種は #797 の専用 SVG を配線（`IngredientGlyph.tsx`） |
| ソース | finocchi・cavolo・radicchio: olive-oil `PAINT_TEMPORARY`（radicchio は olive-oil が主、balsamic は profile 無しで存在採点＝B19／B20-A の方式）。buffalo-chicken: buffalo-sauce `PAINT`（`ingredientId` の型に 1 値）。speck-e-brie・black-truffle: NO_SAUCE（既存の `null` 行） |
| その他の登録 | Reference（6 本）、注文台詞 6、Discovery target id、Hint role（6 品とも key-free）、late の floors（83〜86 に固定）、taxonomy／size class、`recipeBatchManifest`（`B22_BATCH`・`B22_LATE_BATCH`）、`MULTI_SAUCE_RECIPE_IDS`（radicchio）、staged から 6 レシピ・10 食材を除外（76 レシピ・54 候補）、Preview 限定の HV シード `?hv=b22-*`（6 種） |
| テスト | `expansionBatch22.test.ts`（48 件: 宣言・色差 dE・G18・ladder・floors・manifest・Reference・重複 Gate・Free Cooking の全 6 品・Research・Hint）、`b22HvSeeds.test.ts`、`e2e/b22.spec.ts`（6 品を端から端まで）。既存テストの追従は §6 |

## 2. 件数（実装前 → 後）
| 項目 | 前（main `300e4b16`） | 後 | 増分 |
|---|---|---|---|
| レシピ（Pinsa 開／閉） | 95／94 | **101／100** | +6 |
| クレジット済みレシピ | 83 | **89** | +6 |
| 食材 | 106 | **116** | +10 |
| トッピング | 73 | **80** | +7 |
| ladder step | 80（通常 71＋late 9） | **86（通常 73＋late 13）** | +6 |
| 第 4 章のレシピ数 | 58 | **64** | +6 |
| 調理法・工程 | 0 | 0 | 0（新工程なし。既存の PAINT・scatter・後乗せのみ） |

## 3. Owner 決定の反映と、**確認が必要な逸脱**
確定値（truffle vegetable／xs・薄切り、sunflower-seeds spice／xs、brie l、balsamic は焼成前の第 2 層、buffalo-chicken は焼成前 PAINT、絵文字 🦬・🏺、balsamic `#3c1a4a`・buffalo-sauce `#ec5a12`（dE ≥ 25: soy-sauce 37.3／tomato-sauce 26.0）、olive-oil `PAINT_TEMPORARY`、NO_SAUCE ゲート無変更）はそのまま実装した。次の点は、実装中に分かった事実による**判断・逸脱**で、Owner の確認を求める。
| # | 内容 | 理由（実測） |
|---|---|---|
| 1 | **通常 step の順は 72 = buffalo-chicken、73 = speck-e-brie**（決定表の提案は逆） | 既存の `discoveryLadder.test.ts` は「ladder は REC-04 の規則を production のレシピに適用した結果と一致する」ことを固定している。規則は新材料 1 個の 2 品の同点を**レシピ id の昇順**で決めるため、buffalo-chicken が先になる。提案の順だと既存テストを緩める必要があった。この順だと Research の 2 ID（frango-catupiry・curry-pizza-japan）の変化が事前の what-if より 1 段増える（§5 は最終値） |
| 2 | 同じ 2 つのテストの「凍結範囲」を step 1-68 から **1-71** に広げた | 規則をそのまま 69 から導出すると、buffalo-sauce（新材料 1）が honey＋walnut（新材料 2）より先に並び、**出荷済みの step 71 の順が変わってしまう**ため。出荷済みの履歴は変えない |
| 3 | **parmigiano・gorgonzola のショップのパックが 20 → 30**（k = 全レシピの最大個数。黒トリュフ pizza の parmigiano 3、buffalo-chicken の gorgonzola 3） | `materialK` の定義による自動の結果。価格は不変（60／100 Pitz）で 1 パックの個数だけ増える。既存の保存データへの影響は、在庫の補充量のみ |
| 4 | radicchio-noci の材料の並びは **olive-oil → balsamic**（matrix の `spreadLayers` は balsamic → olive-oil） | 主ソース（Reference の目標）を先に置く B19／B20-A の方式に合わせた。2 層とも採点は存在で見るため、塗る順は採点に影響しない |
| 5 | mint の着地は `LIGHT_LEAF` | 既存の規則「`bakeRoastResistant` の食材は LIGHT_LEAF」（`referencePizza.w1.test.ts`）に従った |
| 6 | black-truffle-pizza は NO_SAUCE の Technique として数え、`LATE_ADDITION_RECIPE_IDS` には載せない | ikura-salmon-pizza の先例（二重計上でテストが落ちる） |
| 7 | 名前: 3 品は staged のイタリア語の長い名前のまま、buffalo は「（PIZZA DB版）」を外した | 長い名前の表示は 390×844・360×800 の E2E で横スクロール無しを確認済み。実機で気になるなら短縮を提案できる |
| 8 | `expansionBatch18〜21` の過去バッチの Research 監査を、B22 の 6 レシピ・10 食材を除いて測る形に直した | B20-A の監査を B21 が「後のバッチを除く」形にした先例と同じ。各バッチが承認された標本は変えていない |
| 9 | `hint5Production.gate` の合成カタログ（family が 1 つだけの singleton）に sunflower-seeds を追加、DH4-2A の旧計測値 321 → 291（硬化したガードの漏れ 0 は不変） | spice に新食材が入ったため。ゲートは弱めていない |

## 4. 重複 Gate・G18・Hint
重複 Gate: 6 品とも、同一・部分集合・上位集合・1 材料差・Jaccard ≥ 0.4 の該当 0（`expansionBatch22.test.ts`）。G18／H5-INV-2: 10 食材の絵文字は一意で family 記号と重ならない。Hint 5.0: 6 品とも key-free。段の構成は speck-e-brie `CHEESE,STRUCTURE,SUB_CLASS×2`、buffalo-chicken `SAUCE,CHEESE,STRUCTURE,SUB_CLASS`、finocchi・cavolo `SAUCE,CHEESE,STRUCTURE,SUB_CLASS×4`、radicchio-noci `SAUCE,CHEESE,STRUCTURE,SUB_CLASS×2`、black-truffle `CHEESE,STRUCTURE,SUB_CLASS`。Hint のゴールデン 2 本は**挿入のみ**（既存 94 品の値は不変、6 行の追加）を確認した。

## 5. Research の文字変化 — **Owner の個別承認が必要**
- **正準順（ladder の順）で文字が変わる出荷済みレシピ: 0**（全 prefix で確認、停止条件に当たらない）。
- **非正準順で文字が変わる出荷済みレシピ: 35 ID**（実カタログ、既定の 40 本の seeded random 順、`expansionBatch22.test.ts` に固定）。実装前の what-if（#801）と **ID の集合は同一**。変化の中身は 2 ID（frango-catupiry・curry-pizza-japan）だけ段が 1 つ増えた（§3-1）。
- **承認前は merge しない。** 承認外の変化が 1 件でも出れば停止（B21 の方式）。新レシピ 1 つだけを足した場合の影響 ID 数: finocchi 22／cavolo 14／radicchio 13／black-truffle 4／speck-e-brie 2／buffalo-chicken 8。

| # | 出荷済みレシピ | 変化（before→after、非正準順） |
|---|---|---|
| 1 | `baba-ganoush-pizza` | (なし)→B B→C F→G G→I I→K J→L K→M L→N L→O |
| 2 | `bacalhau` | (なし)→A |
| 3 | `bbq-chicken-pizza` | (なし)→A |
| 4 | `boscaiola` | (なし)→A (なし)→B A→B B→C D→E E→F F→G |
| 5 | `brazilian-calabresa` | (なし)→A |
| 6 | `calabresa-argentina` | (なし)→A |
| 7 | `capricciosa` | (なし)→A |
| 8 | `curry-pizza-japan` | (なし)→B B→C C→D D→E E→F |
| 9 | `eggplant-ricotta-pizza` | (なし)→A (なし)→B B→C F→G H→I |
| 10 | `frango-catupiry` | (なし)→B B→C C→D D→E E→F F→G |
| 11 | `fugazza` | (なし)→A (なし)→B A→B B→C C→D D→E E→F |
| 12 | `grandma-pizza` | (なし)→A (なし)→B A→B B→C C→D E→F G→H |
| 13 | `jamaican-jerk-chicken-pizza` | (なし)→B A→B C→D |
| 14 | `new-haven-apizza` | (なし)→A |
| 15 | `palmito-pizza` | (なし)→A |
| 16 | `parmigiana-pizza` | (なし)→B B→C D→E |
| 17 | `pesto-burrata-pizza` | (なし)→A (なし)→B B→C D→E G→I H→I I→K J→K J→L |
| 18 | `pesto-noci-pizza` | (なし)→A (なし)→B B→C |
| 19 | `pesto-pollo` | (なし)→B A→B B→C C→D D→E |
| 20 | `pesto-salmone` | (なし)→B B→C |
| 21 | `pesto-tonno` | (なし)→A |
| 22 | `pizza-alla-crudaiola` | (なし)→A (なし)→B A→B B→C C→D |
| 23 | `pizza-bianca` | (なし)→A (なし)→B A→B B→C C→D D→E |
| 24 | `pizza-bianca-ricotta` | B→C C→D D→E E→F F→H H→J I→J I→K J→L K→M K→N |
| 25 | `pizza-feta-eliniki` | (なし)→A (なし)→B B→C F→H G→H H→I H→J I→J I→K |
| 26 | `pizza-portuguesa` | (なし)→A |
| 27 | `prosciutto-funghi` | (なし)→A |
| 28 | `puttanesca-pizza` | (なし)→A |
| 29 | `quattro-formaggi` | (なし)→A (なし)→B A→B B→C |
| 30 | `reina-pepiada-pizza` | (なし)→A |
| 31 | `shirasu-pizza` | (なし)→B A→B |
| 32 | `spinach-artichoke-pizza` | (なし)→B A→B B→C C→D |
| 33 | `supreme-pizza` | (なし)→A |
| 34 | `veggie-supreme-pizza` | (なし)→A |
| 35 | `vongole` | B→C C→D F→G H→J J→L L→N M→O M→P |

## 6. テスト結果（HEAD は PR で確認）
- 全 Vitest（ローカル）: 651 ファイル・12,075 件のうち **12,059 件成功**、13 件 skip、**失敗 1 件**。失敗は `researchAttempt.replayAudit.test.ts`（研究の再挑戦シミュレーションの解析用テスト）の **600 秒タイムアウト**で、B22 のアサーション失敗ではない。REPLAY_AUDIT_RESULT
- `tsc -b`: エラー 0。
- E2E（`e2e/b22.spec.ts`、Chromium、`HV_SCREENSHOT_DIR=docs/reports/screenshots/b22`）: **390×844 の 6／6、360×800 の 6／6 成功**（Shop NEW → 購入 → Research → ソース層 → 各ピース → 焼成 → 後乗せ → NEW DISCOVERY → Dex、コンソールエラー 0、横スクロール 0）。スクリーンショットは `docs/reports/screenshots/b22/`。
- WebKit E2E・CI・Codex・iPhone Safari HV は PR で確認する（Codex は利用上限のため通常のレビューが受けられない可能性がある。その場合は別コンテキストの独立レビューを記録する）。

## 7. Owner に確認いただくこと
1. §5 の Research 35 ID の個別承認（または対象の変更の指示）。
2. §3 の逸脱 1（step 72／73 の順）・3（parmigiano・gorgonzola のパック 30）・4（radicchio の層の順）・7（長い名前）の可否。
3. iPhone Safari 実機 HV（専用 PR ページ。`?hv=b22-speck-e-brie`・`b22-buffalo-chicken`・`b22-finocchi`・`b22-cavolo`・`b22-radicchio`・`b22-truffle` の 6 本。公開は Owner が指示した時に行う）。重点: 8 種の専用 SVG（特に xs の truffle・sunflower-seeds がピザ上で読めるか）、絵文字のまま見える 🦬・🏺 のチップ、2 層ソース（radicchio-noci）の塗りと操作性、長い名前の表示。

## 8. 範囲外（行っていない）
merge、Production ON、共有 Preview の更新、B23 以降、M7・D-ING-1 R1 の実装。
