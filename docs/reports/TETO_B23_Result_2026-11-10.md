# Expansion Batch 23-a Result Report — apple-cinnamon-dessert と apple（#780、Draft、Owner 決定 2026-11-10）

基準 main `07bb706c`（#810 merge 後）。**暫定仕様・原典（pizzadb.jp）未確認**: id・名前・数量・色・絵文字は GAMEPLAY ASSUMPTION。凡例: 【実測】コード・テストの実行、【未確認】測っていない。決定表: `TETO_EXPANSION-BATCH-23_OwnerDecisionTable_2026-11-10.md`（§8 に Owner 決定）。

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

## 4. Owner の確認が必要な点
1. **Research 非正準の 2 件の追加（個別承認待ち、承認前は merge 不可）【実測】**
   - 正準順の変化は **0**。変わる既存レシピは提示した 8 ID と同じ集合。
   - ただし、提示した before→after は 3 品（late の dessert 2 品を含む）の母集団で測った値だった。B23-a 単独では母集団が違い、**提示表に無い変化が 2 件**出た: `pizza-radicchio-noci` の `A→B`、`spinach-artichoke-pizza` の `A→B`。逆に `ikura-salmon-pizza` は提示した `A→B` が出ない。他の 5 ID は提示表と完全一致。
   - 測定値（B23-a）: ikura-salmon-pizza `(なし)→B, B→C`／jalapeno-popper-pizza `(なし)→A`／moussaka-style-pizza `(なし)→B`／pesto-noci-pizza `(なし)→B, A→B`／pesto-salmone `(なし)→B, B→C, C→D, D→E`／pizza-radicchio-noci `(なし)→B, A→B, B→C`／speck-e-brie `(なし)→B, B→C, C→D`／spinach-artichoke-pizza `(なし)→B, A→B, B→C, C→D`。
   - テストは 8 ID の集合・正準 0・「提示表または保留の 2 件の範囲内」を固定している（`expansionBatch23.test.ts`、保留分は `PENDING_OWNER_APPROVAL_EXTRA`）。
2. **ショップのパック**: cream-cheese は apple-cinnamon-dessert が 3 個使うため、`materialK` の導出で **20 → 30**（価格 120／60 Pitz は不変、既存の所持数は不変）。B22 の parmigiano・gorgonzola と同じ導出の帰結。購入・在庫系の既存テストは成功。
3. **ladder の step 凍結を 1–73 に拡張**（`discoveryLadder.test.ts`・`discoveryLadder.appendOnly.test.ts`）: REC-04 の規則だけだと、新材料 1 個の 3 レシピ（apple-cinnamon-dessert・buffalo-chicken・speck-e-brie）の同点を recipe id で決め、apple が出荷済みの step 72・73 より前に来る。出荷済みの履歴は変えない（B22 で 1–71 に広げたのと同じ扱い）。
4. **旧 DH4-2A の再測定値 291 → 257**（`deductionGuard.gate.test.ts`）: 硬化したガードの漏れ 0 は不変。合成ファミリーが TOPPINGS の添字で切り出されるため、topping が 1 つ増えると形が変わる。B13・B14・B19・B21・B22 の再測定と同じ種類。
5. **Hint の `alphaFamilyOnly` レポート（golden）**: 既存 3 レシピの値が動いた（eggplant-tahini-pizza 110→206、pizza-finocchi-salad 1199→1523、pizza-cavolo-carote 1430→1451）。apple が fruit family に入って family 分布が変わったための派生指標で、Hint の梯子（`hint5.ladders55.json`）は**挿入のみ**（既存の変更 0）。
6. `DessertGlyphs.test.tsx` の「未配線」の固定を「apple だけ配線済み、他の 5 つは未配線」に更新した（取り込む module は `IngredientGlyph.tsx` だけ）。

## 5. テスト結果【実測】
- 全 Vitest（ローカル）: 12,122 件中、失敗は 2 件（旧 DH4-2A の 291→257、ordinaryRecipes の件数）で、修正後に両ファイル 25/25 成功。修正後の全件再実行は CI の `build`（全 Vitest 込み）で確認する。`tsc -b` エラー 0。
- E2E（Chromium、`e2e/b23.spec.ts`）: **390×844・360×800 の各 1/1 成功**（Shop NEW → 購入 → Research（正体の漏れなし）→ 各ピースを Reference の位置に → 焼成 → NEW DISCOVERY → Dex）。スクリーンショット: `docs/reports/screenshots/b23/`（apple の chip とピースの拡大は `compare-parts/`）。
- 新規テスト: `expansionBatch23.test.ts` と `b23HvSeeds.test.ts`（2 ファイル合計 24 件、全て成功）。

## 6. B23-b（nutella・smore）の解決案 — Owner の選択
- 衝突 1: (a) dessert の 4 食材を既存の family に割り当てる（cinnamon・walnut・mayo の前例のとおり spice を推奨）／(b) `other` を許すようにゲートを緩める（Hint 3.0 の仕様変更）／(c) 新しい family を足す（全レシピの Hint 5.0 に影響）。
- 衝突 2: (a) チーズを足す（Owner 決定済みの材料構成が変わる）／(b) Hint 5.0 の privacy 再監査とゲートの更新を Owner が承認する。

## 7. iPhone Safari HV（公開は Owner の指示で行う）
`?hv=b23-apple-cinnamon`。重点は **apple の小サイズ視認性**（トレイのチップとピザ上のピース。赤い楔形が他の食材と区別できるか）、NO_SAUCE（ソース無し）で成立すること、長い名前が無いので表示は問題なしの見込み。

## 8. 範囲外
merge、Production ON、共有 Preview の更新、B23-b、M7・D-ING-1 R1 の実装。
