# T5 — 次期レシピの実装前調査: honey・walnut・pesto-noci（docs-only、Refs #780 #772）

2026-11-07、main `06cfc06`（#778 merge 済み）、branch `claude/teto-pizza-t5-t6-r9qup3`。**新規ファイル 1 本のみ。`src/`・`e2e/`・CSS・golden・既存 docs は未変更。実装・merge・Production ON・共有 Preview 更新なし。**
HV: docs-only のため対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。「推奨」は助言で、Owner 決定ではない。
ラベル: 【実測】= 今回 main のコード／データで確認、【先行】= #772 ブランチの先行成果物（読み取り専用）の値で今回未再測定、【推論】、【未確認】。

先行成果物（重複させない）: `TETO_CONTENT-POOL_B20_HoneyWalnut_Result.md`、`TETO_CONTENT-POOL_B20A_Implementation-Spec.md`（branch `claude/teto-pizza-parallel-plan-sh894e`、#772 の claim）。本書はその**差分（main の変化）と Gate の再確認**だけを扱う。87 行の母集団・9 品の再判定は T2（#780）の領域で、ここでは扱わない。

---

## 0. 結論

1. **実装可能な候補は 1 つ: `pesto-noci-pizza`（honey＋walnut の 2 新食材 ＋ 1 レシピ、Batch 20-A）。** 新しい調理工程は不要（SAUCE×2 → CHEESE → TOPPING → BAKE、全て焼成前）。Duplicate Gate は main で再確認してクリーン【実測】。
2. **開始できるのは B19（#774、T1）が merge された後。** 理由は step 番号・golden・Research ラベルの基準が B19 で動くため。今は着手しない。
3. **walnut の SVG は #777 で merge 済み（未配線）【実測】。** 先行調査の「PR-B20-0」は完了。残りは配線と、PROVISIONAL の色・形の採否。
4. **honey を使う他の 4 レシピは今回の実装候補にしない:** hot-honey-pepperoni は集合規則で不可、nashville／nduja はホットソース未特定、feteer は LAMINATE 必須【実測】。
5. **Owner 判断が必要なのは 5 点（§7）。** うち 2 点（honey の層、mozzarella の有無）は先行調査と同じ推奨で、新しい論点は「B19 merge 後の再測定」と「walnut family」。

---

## 1. 差分（先行調査 `ed159e9` → 現在 `06cfc06`）

| 項目 | 先行調査時 | 現在【実測】 | 影響 |
|---|---|---|---|
| walnut の絵 | 存在しない | `src/components/walnutGlyph/`（#777、`state: raw/baked`、**どこからも import されない**） | PR-B20-0 が完了。配線 PR のみ残る |
| ハーブ 4 種の絵 | 未配線 | #778 で配線・merge | `IngredientGlyph.tsx`・`App.css`・`ingredients.ts` の HOT は B19 と B20 の順番待ち（B19 が先） |
| `ingredients.ts` の honey／walnut | なし | **なし**（id 一覧に無い） | 新食材 2 は変わらず必要 |
| 既存レシピ数 | 90 | 90（`recipes.ts`＋`lateCatalog.ts` を機械走査） | Jaccard の母集団は不変 |
| 通常 ladder の最終 step | 69（Batch 18） | 69。B19 の step 70 は T1 が実装中（未 merge） | B20 は **71 見込み**（B19 merge 後に再計算） |
| #748 の claim | B20 を塞いでいた | #759 が merge 済みで条件充足 | 開始条件のうち 1 つが解消 |

---

## 2. 候補の調査

172 行マトリクス【実測】（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）で `honey` または `walnut` を含む行は 8 行。#780 の「honey 5／walnut 4」と一致。

| 行 | 材料 | 要求能力 | 状態 | 今回の扱い |
|---|---|---|---|---|
| **pesto-noci-pizzadb-p12** | pesto(sauce)・gorgonzola・honey・walnut | MULTI_SPREAD_LAYER | **READY** | **候補（B20-A）** |
| hot-honey-pepperoni-pizzadb-p12 | tomato-sauce・honey・mozzarella・pepperoni | MULTI_SPREAD_LAYER（後乗せは推論） | READY_WITH_REVIEW | **不可**: 既存 `pepperoni` の上位集合（Jaccard 0.75、1 材料差）【実測】 |
| nashville-hot-chicken-pizzadb-p6 | chicken・honey・mozzarella・pickles | ―（ソース未特定） | BLOCKED（BASE_SAUCE_UNSPECIFIED） | Owner 判断待ち（ホットソースの決定） |
| nduja-pizza-pizzadb-p14 | honey・mozzarella・sausage | ―（ソース未特定） | BLOCKED | 不可寄り: 仮に tomato-sauce なら `salsiccia` の上位集合（0.75、1 材料差）【実測】 |
| apple-cinnamon-dessert-pizzadb | apple・cinnamon・cream-cheese・walnut | ― | BLOCKED（デザートソース未特定） | apple が新食材。Owner 判断待ち |
| speck-e-brie-pizzadb-p4 | brie・mozzarella・prosciutto-crudo・walnut | ― | BLOCKED（構成競合 DIVERGENT） | brie が新食材。Owner 判断待ち |
| pizza-radicchio-noci-pizzadb-p8 | balsamic-vinegar・mozzarella・olive-oil・radicchio・walnut | MULTI_SPREAD_LAYER／後乗せは推論 | BLOCKED（後乗せ解釈が未確定） | 新食材 2（radicchio・balsamic）＋工程判断。Owner 判断待ち |
| feteer-meshaltet-pizzadb-p10 | condensed-milk・honey・melted-butter | MULTI_SPREAD_LAYER・LAMINATE | NOT_REPRESENTABLE | 対象外（T6 で LAMINATE を比較） |

原典は**比較表のみ（pizzadb.jp p12）で個別ページ未確認**【先行・未確認】。B16〜B19 と同じ「暫定仕様・原典未確認」ラベルで進める前提。

### 2.1 pesto-noci の既存食材・新食材の区別

| 食材 | 区分 | 現状【実測】 | 必要な作業 |
|---|---|---|---|
| pesto | **既存**（sauce、`spread`、starter grant） | `ingredients.ts` にあり | なし。主ソース（PAINT） |
| gorgonzola | **既存**（cheese、`scatter`） | あり、step 24 の取得 | なし |
| **honey** | **新食材** | なし | 行追加。絵は不要（塗りの色のみ）。推奨は sauce／`spread`（焼成前の第 2 層） |
| **walnut** | **新食材** | なし。**SVG は #777 で用意済み・未配線** | 行追加＋ `pieceVisual` 配線＋ taxonomy family＋ size class |

---

## 3. Duplicate Gate（main `06cfc06` で再測定【実測】）

`recipes.ts`＋`lateCatalog.ts` の `requiredIngredients` の id 集合のみで比較（minCount 無視、ソースも材料として計上）。母集団 90。ゲーム本体の validator ではなく静的な事前確認で、正式な確認は実装 PR で行う。

| 組成 | 最大 Jaccard | 近傍（対称差） | 同一／部分／上位集合／1 材料差 | 判定 |
|---|---|---|---|---|
| **A: pesto・honey・gorgonzola・walnut（原典どおり）** | **0.167** | genovese（5） | **なし** | **クリーン（例外不要）** |
| B: A ＋ mozzarella | 0.333 | genovese（4）、pesto-pollo／pesto-patate 0.286 | なし | クリーン |
| hot-honey-pepperoni | 0.75 | pepperoni（1） | 部分集合: pepperoni／1 材料差: pepperoni | **不可** |
| nduja（仮 tomato-sauce） | 0.75 | salsiccia（1） | 部分集合: salsiccia／1 材料差: salsiccia | **不可寄り** |
| nashville（仮 tomato-sauce） | 0.333 | salsiccia／pepperoni／margherita（4） | なし | クリーン（ただしソース未決） |
| apple-cinnamon-dessert | 0.143 | pesto-salmone 他（6） | なし | クリーン（ソース未決） |
| speck-e-brie | 0.333 | prosciutto-funghi 他（4） | なし | クリーン（構成競合は別問題） |
| radicchio-noci | 0.286 | pizza-bianca-ricotta 他（5） | なし | クリーン（工程判断が別） |

**B19 の影響【推論】:** B19 は pesto 系の `pesto-burrata-pizza` を追加する。merge 後は pesto 系の近傍が 1 つ増えるため、B20-A の Jaccard・1 材料差・Research ラベルは **B19 merge 後の main で再測定が必須**（burrata は B20-A の材料に無いので、集合関係は変わらない見込み）。

---

## 4. Research ラベル

- 先行の一時測定【先行・今回未再測定】: 正準順の既存ラベル変化 **0 件**。非正準順で影響を受け得る既存レシピ **9 件**（quattro-formaggi・genovese・pesto-patate・pesto-pollo・pesto-trapanese・pesto-salmone・pesto-tonno・pesto-caprese・pesto-vegetariana）。共有材料 pesto・gorgonzola が最後に取得された順序で文字がずれる、というB15〜B18 と同種の現象。
- 今回は再測定していない: 測定器 `src/logic/catalog/testSupport/researchLabelAudit.ts` は main にあるが、この環境には `node_modules` がなく、docs-only の本作業でテストを走らせる前提ではない【実測】。B19 が ladder を動かすため、**どのみち B19 merge 後に実測が必要**。
- 規則（B19 と同じ、T1 の停止条件に準拠）: 正準順で 1 件でも変化したら停止。非正準順の変化は**全件列挙して 1 件ずつ Owner 承認**。未承認が 1 件でも残れば HOLD。
- 注意: B19 が pesto 系を増やすため、影響を受け得る既存レシピは 9 件より増える可能性がある【推論】。

---

## 5. 必要な調理工程

**新しい工程は不要。** 先行仕様どおり SAUCE（pesto、PAINT）→ SAUCE（honey、第 2 層）→ CHEESE（gorgonzola）→ TOPPING（walnut）→ BAKE。FINISH・prep・steam・sear・fry・drizzle は使わない。

| 論点 | 内容 |
|---|---|
| 2 ソースの機構 | `grandma-pizza`（tomato-sauce＋olive-oil）が出荷済みの 2 ソース先例【実測】。B19（pesto＋olive-oil）も同型。pesto-noci の主＋副ソースの Reference・完成判定は B19 のテストを流用する想定 |
| honey を後乗せ（DRIZZLE）にする場合 | DRIZZLE は #579／PR #746・#776 の線で本番 OFF。B20 が工程に縛られるため**推奨しない**。原典の比較表は spread 層で、後乗せの記載は無い【先行】 |
| mozzarella | 原典の材料に無い。B19 D7（原典にないものを足さない）と同方針で**足さない**のを推奨 |
| 1 画面 UX | 食材名「はちみつ」「くるみ」のトレイ幅を WebKit 360×800 で確認（AC-6）。実装 PR で確認 |

---

## 6. 実装順と依存

| 順 | 内容 | 依存 | 状態 |
|---|---|---|---|
| 0 | walnut の SVG（未配線） | ― | **完了（#777）** |
| 1 | **B19（#774、T1）の merge** | T1 の Owner 承認 | 実装中（本作業の範囲外） |
| 2 | B20 用の Issue 起票・claim・Owner の B20 GO | 1、本書の判断 | 未 |
| 3 | 食材＋レシピ（1 PR を推奨。ladder の不変条件がレシピの無い step を許さない場合。B13〜B18 は全て 1 PR） | 1、2 | 未 |
| 4 | 本番 Production ON／共有 Preview | 別途 Owner 承認 | 禁止事項 |

編集が重なる HOT: `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`IngredientGlyph.tsx`・`App.css`・`src/data/__golden__/**`。**B19 の claim（T1）と同じファイル群**なので、並行実装は不可。直列化する。

---

## 7. Owner 判断（まとめて 1 回、推奨つき）

| # | 判断 | 推奨 | 備考 |
|---|---|---|---|
| 1 | B20-A（honey＋walnut＋pesto-noci-pizza）を B19 の次に実装するか | **GO（B19 merge 後）** | 例外なし・新工程なし。食材 2 に対しレシピ 1 で効率は低いが、honey／walnut 系で唯一クリーン |
| 2 | honey は焼成前の第 2 ソース層か、後乗せか | 焼成前 | 先行調査と同じ。#772 の決定は未記録のため再確認 |
| 3 | mozzarella を足すか | 足さない | B19 D7 と同方針 |
| 4 | walnut の Hint 5.0 family（新 `nut`／既存 `spice`） | 実装時に影響を測定して決める（暫定 `spice`） | 新 family は分類の Gate が増える |
| 5 | 非正準順ラベル変化（先行測定で 9 件、B19 後に増える可能性）の承認方法 | 実装 PR の正式測定後に 1 件ずつ | 先行調査のまま |

付随（判断ではなく確認）: #777 の walnut の色・形は **PROVISIONAL**。生くるみ × 焼成チーズの塗りコントラストは 1.10 と弱く、外線で読む設計【実測: `TETO_WALNUT-GLYPH_B20A_Result.md`】。配線時に生を焼成チーズ上で使うなら外線を維持する。

---

## 8. 未確認・限界

- 原典の個別ページ（pizzadb.jp）は未確認。ペスト・ノーチの個数・窓・価格・色は全て **GAMEPLAY ASSUMPTION**（暫定）。
- Research ラベルは今回再測定していない（§4）。Hint 5.0（AC-8b 相当）・late カタログ・Pinsa の開閉も未測定。
- 87 行の母集団・9 品の再判定（T2）、#772 の成果物の更新分は未反映。#772 側に追加があれば差分だけ測り直す。
- テスト・build は未実行（docs-only）。
