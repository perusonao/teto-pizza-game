# Expansion Batch 23-a Result Report — apple-cinnamon-dessert と apple（#780、PR #814、Draft、Owner 決定 2026-11-10）

基準 main `07bb706c`（#810 merge 後）。**暫定仕様・原典（pizzadb.jp）未確認**: id・名前・数量・色・絵文字は GAMEPLAY ASSUMPTION。凡例: 【実測】コード・テストの実行、【未確認】測っていない。決定表: `TETO_EXPANSION-BATCH-23_OwnerDecisionTable_2026-11-10.md`（§8 に Owner 決定）。

## 0. Owner 判断の記録（PR #814、2026-11-10。本文の「承認待ち」「確認が必要」は判断前の記載で、§4 に各判断を反映した）
1. **Research**: apple 単独の差分を承認（`pizza-radicchio-noci` と `spinach-artichoke-pizza` の `A→B` の追加、`ikura-salmon-pizza` の `A→B` が出ないこと）。**正準順の変化 0・承認外の変更 0 が必須**（テストで固定。承認外が 1 件でも出れば停止）。
2. **cream-cheese のパック 20→30**: 承認。**価格は変更しない**。
3. **ladder の step 1〜73 の凍結拡張**: 承認。
4. **旧 DH4-2A の 291→257**: 再測定値として受領。ガードの漏れ 0 を維持。
5. **Hint の `alphaFamilyOnly` の既存 3 レシピの変更**: before/after とゲーム挙動への影響を提示する（§4-5）。**未確認のまま merge しない。**
6. **PR 専用 HV ページの公開**: 承認（共有 Preview は変更しない）。確認点: apple の小サイズ視認性、通常 step 74、B23-a の 1 レシピの通しプレイ、名前表示（§7）。
7. **B23-b**: other family とソース・チーズ無しのゲートの解決案を、既存ゲートを弱めない前提で提示（§6）。

merge は禁止。最新 HEAD で CI・独立レビュー・iPhone HV が揃うまで Draft・HOLD。

## 1. 範囲 — B23 を 2 つに分けた理由
Owner の決定（Q-1〜Q-7）で 3 レシピ・6 食材を実装したところ、**既存の 2 つのゲートに衝突**した。ゲートは弱めていない。

| 衝突 | 内容 | 影響 |
|---|---|---|
| 1. `other` family | DH4-PROD ゲート `deductionProduction.gate`（OD-DH4-2-9）は「`other` は到達不能」を固定している。chocolate・graham-cracker・marshmallow・powdered-sugar を `other`（Owner Q-4）にすると失敗した。前例の walnut・sunflower-seeds は spice にしている | nutella・smore |
| 2. ソースもチーズも無い NO_SAUCE | TQ-1D G7（`hint5Production.gate`）は「NO_SAUCE は先頭が CHEESE の rung」を固定している。nutella・smore（チーズ無し）は STRUCTURE から始まる。`hint5Ladder.test` G9・`gameReducer.hint5.test`（不足 Pitz の一様拒否）も nutella で崩れた | nutella・smore |

- **B23-a（本 PR）**: apple-cinnamon-dessert（通常 step 74）と apple。cream-cheese がチーズ rung になり、family は fruit と spice だけなので、衝突しない。
- **B23-b**: nutella・smore と late の 5 食材は、branch `claude/b23b-late-desserts-780` に**実装ごと残した**（衝突のため PR にしない）。解決案は §6。

## 2. 実装内容（B23-a）【実測】
- 食材 `apple`（topping、fruit、size s、`#d9453a`、🍎、専用 SVG `apple-dessert` を #798 の dessert glyph から配線）。
- レシピ `apple-cinnamon-dessert`（apple 2・cinnamon 2・cream-cheese 3・walnut 2、焼成前のみ、通常 step 74）。**NO_SAUCE は Owner の明示的な GAMEPLAY 判断（Q-1）であり、原典の事実ではない**（原典は「デザートソース」で未指定）。日本語名は変更なし（Q-7）。
- Reference（9 ピース、RT-01 の multi-ring interleaved）、Discovery target、Hint 役割（key-free）、注文台詞、Preview 限定 HV シード `?hv=b23-apple-cinnamon`、E2E `e2e/b23.spec.ts`。
- staged の 1 レシピ・1 食材を生成器で外した（staged 75 レシピ・53 食材）。

## 3. 件数
| 区分 | 前 | 後 | 増分 |
|---|---|---|---|
| レシピ | 101 | **102** | +1 |
| 食材 | 116 | **117** | +1 |
| credited | 89 | 90 | +1 |
| ladder step | 86（通常 73＋late 13） | 87（通常 74＋late 13） | +1 |
| 第 4 章 | 64 | 65 | +1 |
| 工程・調理法 | — | — | 追加 0 |
累計（目標 170／177）: 食材 117／170（残 53）、レシピ 102／177（残 75）。調理法・工程の実装済みは 7／27 のまま。

## 4. Owner 判断の反映と、残る確認【実測】
1. **Research 非正準（Owner 承認済み）**: 正準順の変化は **0**。変わる既存レシピは提示した 8 ID と同じ集合。提示表は late の dessert 2 品を含む母集団で測った値で、B23-a 単独では母集団が違い、提示表に無い変化が 2 件（`pizza-radicchio-noci` と `spinach-artichoke-pizza` の `A→B`）、提示表にあるのに出ない変化が 1 件（`ikura-salmon-pizza` の `A→B`）。**Owner がこの差分を承認した。**
   - 測定値（B23-a）: ikura-salmon-pizza `(なし)→B, B→C`／jalapeno-popper-pizza `(なし)→A`／moussaka-style-pizza `(なし)→B`／pesto-noci-pizza `(なし)→B, A→B`／pesto-salmone `(なし)→B, B→C, C→D, D→E`／pizza-radicchio-noci `(なし)→B, A→B, B→C`／speck-e-brie `(なし)→B, B→C, C→D`／spinach-artichoke-pizza `(なし)→B, A→B, B→C, C→D`。
   - テスト（`expansionBatch23.test.ts`）は、8 ID の集合・正準 0・「提示表または承認済みの 2 件の範囲内」を固定している。承認外の変更は失敗する。
2. **ショップのパック（承認済み）**: cream-cheese **20→30**（`materialK` の導出。価格 120／60 Pitz は不変、既存の所持数は不変）。購入・在庫系の既存テストは成功。
3. **ladder の step 凍結 1–73（承認済み）**: REC-04 の規則だけだと、新材料 1 個の 3 レシピの同点を recipe id で決め、apple が出荷済みの step 72・73 より前に来る。出荷済みの履歴は変えない（B22 で 1–71 に広げたのと同じ扱い）。
4. **旧 DH4-2A の再測定値 291→257（受領）**: 硬化したガードの漏れ 0 は不変（同テストの他の表明は全て成功）。
5. **Hint の `alphaFamilyOnly` レポート — before／after とゲーム挙動への影響（Owner 確認待ち）**
   - **何を測る指標か**: 「ヒントの SUB_CLASS（系統）が示す情報と整合する材料の割り当ての数」。プールは、そのレシピの材料の最大 ladder step 以下の topping（key を除く）で、各 SUB 行の候補は同じ family の topping。**数が大きいほど、ヒントから正解を絞りにくい**（情報が少ない）。テスト用の報告で、ゲートではなく、本番のコードから呼ばれない（`hint5Ladder.alphaReport.test.ts` の「NOT the alpha gate」）。
   - **before → after（既存 3 レシピ）**:

| レシピ | before | after | 理由 |
|---|---|---|---|
| eggplant-tahini-pizza | 110 | **206** | pomegranate（fruit）の行の候補に apple が加わる |
| pizza-finocchi-salad | 1199 | **1523** | orange（fruit）の行の候補に apple が加わる |
| pizza-cavolo-carote | 1430 | **1451** | lemon（fruit）の行の候補に apple が加わる |
| apple-cinnamon-dessert（新規） | — | 10 | 挿入のみ |

   - **なぜこの 3 つだけか**: apple の step は 74。プールに入るのは「最大 step が 74 以上」のレシピだけで、ordinary のレシピは最大 step が 74 未満のため apple がプールに入らない（値は不変）。late のレシピのうち、fruit の SUB 行を持つ上の 3 つだけが動いた（測定で値が変わったのはこの 3 つのみ）。fruit 以外の family の行は不変。
   - **ゲーム挙動への影響**: **ヒントの文言・rung の並び・費用・不足時の拒否は一切変わらない**（Hint の梯子の golden `hint5.ladders55.json` は 202 行の挿入のみで、既存の変更は 0）。変わるのは、この 3 つの late レシピの「果物系」ヒントと整合する候補が 1 つ増える（apple）ことだけで、プレイヤーにとってはヒントがわずかに絞り込みにくくなる方向（秘匿が増える方向）の変化。apple が出る step 74 以降でしか生じない（late のレシピで、ゲームの終盤）。プレイヤーに見える画面・数値は変わらない。
   - **私の判断**: 指標は秘匿が弱まる方向には動いていない（3 つとも増加）。ゲートの合否にも影響していない。ただし Owner の指示どおり、**確認が取れるまで merge しない**。
6. `DessertGlyphs.test.tsx` の「未配線」の固定を「apple だけ配線済み、他の 5 つは未配線」に更新（取り込む module は `IngredientGlyph.tsx` だけ）。

## 5. テスト結果【実測】
- 全 Vitest（ローカル）: 12,122 件中、失敗は 2 件（旧 DH4-2A の 291→257、ordinaryRecipes の件数）で、修正後に両ファイル 25/25 成功。修正後の全件再実行は CI の `build`（全 Vitest 込み）で確認する。`tsc -b` エラー 0。
- E2E（Chromium、`e2e/b23.spec.ts`）: **390×844・360×800 の各 1/1 成功**（Shop NEW → 購入 → Research（正体の漏れなし）→ 各ピースを Reference の位置に → 焼成 → NEW DISCOVERY → Dex）。スクリーンショット: `docs/reports/screenshots/b23/`（apple の chip とピースの拡大は `compare-parts/`）。
- 新規テスト: `expansionBatch23.test.ts` と `b23HvSeeds.test.ts`（2 ファイル合計 24 件、全て成功）。

## 6. B23-b（nutella・smore）— ゲートを弱めない解決案【実測】
Owner の前提: 既存ゲートは弱めない。次の組み合わせで、B23-b の branch（`claude/b23b-late-desserts-780`）に仮に適用して関連ゲートを実行した。

**案 B23-b（推奨）**: ① dessert の 4 食材（chocolate・graham-cracker・marshmallow・powdered-sugar）の family を `other` ではなく **spice**（cinnamon・walnut・mayo の前例）にする。② nutella と smore の両方に **cream-cheese 2 個**（焼成前）を足し、チーズを持つ NO_SAUCE にする（apple-cinnamon-dessert と同じ形）。

| 確認 | 結果 |
|---|---|
| 衝突 1（`other` 到達不能、`deductionProduction.gate`） | **成功** |
| 衝突 2（NO_SAUCE の先頭は CHEESE、`hint5Production.gate` の G7） | **成功** |
| Hint の G9（不足 Pitz の一様拒否、`hint5Ladder.test`・`gameReducer.hint5.test`） | **成功** |
| `discoveryExpansion3.pestoTrapanese`（other は egg + almond） | **成功** |
| 重複 Gate（同一・部分集合・上位集合・1 材料差・Jaccard ≥ 0.4）との照合 | 出荷済み 102 品に該当 0。nutella と smore は cream-cheese・chocolate を共有（Jaccard 0.33 < 0.4） |
| `hint5Production.gate` の synthetic 形のテスト（spice を 1 食材だけの family とみなす fixture） | 失敗 1 件。spice に新しい食材が入ると fixture を直す必要がある（B22 の sunflower-seeds と同じ種類の fixture 調整。緩和ではない） |
- **変わる Owner 決定**: Q-4（4 食材の family を `other`→spice）と、nutella・smore の材料構成（cream-cheese の追加。Q-2 の「walnut 追加なし」は変わらない）。**Owner の承認が要る。**
- **実装後に再測定する項目**（案を承認された場合）: Research の非正準の影響（母集団が変わる）、Hint 5.0・DH4・alpha レポート、cream-cheese のパック k（既に 3）、E2E、HV。

**採らない案（既存ゲートを弱める・大きく変える）**: (b) `other` を到達可能にする／衝突 2 の NO_SAUCE 規則を緩める（Hint 3.0・5.0 の privacy の仕様変更）、(c) 新しい family を足す（全レシピの Hint 5.0 に影響）。Owner の前提どおり、提案しない。

## 7. iPhone Safari HV（公開は Owner の指示で行う）
`?hv=b23-apple-cinnamon`（Owner 承認済みの専用 PR ページ）。確認点（Owner 指示）: **apple の小サイズ視認性**（トレイのチップとピザ上のピース。赤い楔形が他の食材と区別できるか）、**通常 step 74**（ショップの NEW が step 74 の apple）、**B23-a の 1 レシピの通しプレイ**（NO_SAUCE のソース無しで、cream-cheese → apple・cinnamon・walnut を置いて焼成 → NEW DISCOVERY → Dex）、**名前の表示**（「アップルシナモンデザートピザ」が収まる）。

## 8. 範囲外
merge、Production ON、共有 Preview の更新、B23-b、M7・D-ING-1 R1 の実装。
