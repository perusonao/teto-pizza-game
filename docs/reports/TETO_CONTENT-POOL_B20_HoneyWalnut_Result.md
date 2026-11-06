# Batch 20 優先調査 — Honey・Walnut・ペスト・ノーチ（#772、docs-only）

2026-11-06、main `ed159e9`。新規ファイルのみ。**実装していない**（`ingredients.ts`・`recipes.ts` などは #748 の claim 対象のため触れていない）。数値は静的測定と、使い捨て worktree での一時テスト（コミットしていない、§4）。

## 1. 原典

| 項目 | 内容 | 確度 |
|---|---|---|
| 出典 | 172 マトリクス行 `pesto-noci-pizzadb-p12`。`sourceUrl`: pizzadb.jp 比較表 p12（`/compare/world-pizzas/page/12/`）、`evidenceOrigin: comparison_table_sample` | **比較表のみ。個別ページは未確認**（本環境から pizzadb.jp に到達不可。B16〜B19 と同じく原典未確認） |
| 名称 | ペストノーチピザ（イタリア／各地） | 比較表 |
| 原文の材料 | くるみ（`walnut`、exact alias）／ゴルゴンゾーラチーズ（`gorgonzola`、likely alias）／蜂蜜（`honey`、exact alias） | 比較表 |
| ソース | 系統「バジル」→ 既存の `pesto`（family_derived） | マトリクスの規則 |
| 層 | **spread 2 層: pesto ＋ honey**（`MULTI_SPREAD_LAYER`、`source_ingredient_field`） | マトリクスの解釈 |
| 生地・調理 | ナポリ生地（standard）、bake、後乗せの記載なし（`postBakeFinish: []`） | 比較表 |
| 状態 | **READY**（ブロッカーなし） | |

**モッツァレラは原典の材料に無い。** 既存の B19（pesto-burrata、D7）と同じく「原典にない mozzarella を足さない」を推奨（足すかは Owner 判断、§3 で両方を測定）。

## 2. 材料と新食材

| 材料 | 状態 | カテゴリ案 | 必要な絵 | 工程 |
|---|---|---|---|---|
| pesto | 既存（ソース） | sauce（主ソース） | 不要 | SAUCE |
| gorgonzola | 既存（チーズ、step 24） | cheese | 既存 | CHEESE |
| **honey** | **新食材** | **要判断:** (a) sauce（第 2 の spread 層・焼成前。MULTI_SAUCE の既存機構＝B19 の pesto＋oil と同型）／(b) 後乗せ（DRIZZLE。late 本番 OFF・Owner 方針の第 2 候補） | sauce なら塗りの色だけ（絵不要）。後乗せなら垂らし表現が要る | (a) なら新工程なし |
| **walnut** | **新食材** | topping（scatter、family `nut` は既存に無い可能性 → `spice` か新 family は要判断） | **専用 SVG 推奨**（割ったくるみ。cashew-cheese・sesame 等の淡色系と識別） | なし |

**推奨:** honey は **(a) 焼成前の第 2 ソース層**。根拠: 原典の比較表は「spread 層」で、後乗せの記載がない。後乗せにすると late（本番 OFF）待ちになり、B20 が工程に縛られる。後乗せ版の hot-honey 系は late の設計（第 2 候補）で別に扱う。

## 3. 重複（Jaccard・集合関係、静的）

| 組成 | 最大 Jaccard | 近傍 | 同一／部分／上位集合 | 判定 |
|---|---|---|---|---|
| **A: pesto・honey・gorgonzola・walnut（原典どおり）** | **0.167** | genovese（対称差 5） | なし | **クリーン（例外不要）** |
| B: A＋mozzarella | 0.333 | genovese（対称差 4）、pesto-pollo・pesto-patate 0.286 | なし | クリーン |

同じ honey を使う他候補（Batch 20 に**入れない**もの）:

| 候補 | 判定 | 理由 |
|---|---|---|
| hot-honey-pepperoni | **不可（例外ではなく規則違反）** | 既存 `pepperoni` を内包する上位集合（0.75、1 材料差）。Owner 方針「Jaccard 例外は原則認めない」以前に集合規則で不可 |
| nashville-hot-chicken | **Owner 判断待ち** | ホットソース未特定。クリーン（0.333）だがソースの決定が要る |
| nduja-pizza | Owner 判断待ち | ホットソース未特定、0.50（例外が要る→原則不可） |
| speck-e-brie（walnut） | Owner 判断待ち | brie が新食材、構成競合（DIVERGENT）。0.333 |
| pizza-radicchio-noci（walnut） | Owner 判断待ち | 新食材 2（radicchio・balsamic）、後乗せ解釈が未確定 |

## 4. Research ラベル（実コードで測定、使い捨て worktree）

`src/logic/catalog/testSupport/researchLabelAudit.ts` の `researchLetterChangesAcrossOrders` を、一時テストで実行（honey・walnut を一時的に finite 材料としてメモリ上に追加、ラダーの最後に step を 1 つ追加、新レシピ `pesto-noci-pizza` を加えて比較）。**コミットしていない。正式な測定は実装 PR で行う。**

| 組成 | 正準順の既存ラベル変化 | 非正準順で影響を受け得る既存レシピ | 新レシピ自身 |
|---|---|---|---|
| A | **0 件** | **9 件**: quattro-formaggi、genovese、pesto-patate、pesto-pollo、pesto-trapanese、pesto-salmone、pesto-tonno、pesto-caprese、pesto-vegetariana（共有材料 pesto・gorgonzola が最後に取得された順序で、文字がずれる／付く） | 全ラダー取得時は単独 cohort（文字なし） |
| B | 0 件 | 同じ 9 件 | 同じ |

- これは B15（19）・B16（4）・B17（18）・B18（39）と同じ種類の「取得順に依存する表示ラベルの変化」。**B19 と同じ規則（正準順 0 件必須、非正準順は全件列挙して 1 件ずつ Owner 承認）を適用**すると、9 件の個別承認が要る。
- **測定の限界:** ladder step 番号は仮（実際は B19 の step 70 の後に入る）。late カタログ・Pinsa の開閉は未測定。Hint 5.0（AC-8b 相当）は未測定。

## 5. Batch 20 の構成案（Owner 判断待ち）

| 案 | 内容 | 新食材 | 新レシピ | 例外 | 工程 |
|---|---|---|---|---|---|
| **20-A（推奨）** | honey（sauce）＋walnut＋**pesto-noci-pizza**（原典どおり、mozzarella なし） | 2 | 1 | なし | なし |
| 20-B | 20-A ＋ nashville-hot-chicken（ホットソースの決定後） | 2（＋ソース 1） | 2 | なし | なし |

食材 2 に対してレシピ 1 で効率は低いが、**例外なし・工程なしで確実に足せる唯一の honey／walnut 系**。

## 6. 依存と開始条件

- 開始条件: **B19 の merge 後**（カタログ lane の直列化、step 番号は B19 の後で確定）＋#748 の claim 解放＋Owner の B20 GO。
- 別 PR: (1) walnut の SVG（描画 lane、未配線で先行可能。claim 対象外のファイルで）→ (2) 食材 PR（honey・walnut）→ (3) レシピ PR（pesto-noci）。Owner 方針どおり食材とレシピを分ける。

## 7. Owner 判断（B20）

| # | 判断 | 推奨 |
|---|---|---|
| 1 | honey の扱い: 焼成前の第 2 ソース層／後乗せ | 焼成前（原典の比較表に合わせる） |
| 2 | mozzarella を足すか | 足さない（原典どおり、B19 D7 と同じ方針） |
| 3 | walnut の family（新 family `nut` か既存か） | Hint 5.0 の分類への影響を S2 で測ってから |
| 4 | 非正準順ラベル変化 9 件の扱い | 実装 PR で正式測定後、1 件ずつ承認 |
| 5 | 原典の個別ページ未確認のまま暫定仕様で進めるか | B16〜B19 と同じく「暫定・原典未確認」と明記して進める |
