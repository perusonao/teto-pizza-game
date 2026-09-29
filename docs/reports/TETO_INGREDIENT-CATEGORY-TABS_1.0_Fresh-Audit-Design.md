# 食材分類タブ 1.0 — Fresh Audit + Design（Phase 0）

**Status: docs / data / tools only。Authority ではない。Owner Decision ではない。**
src / CSS / e2e は変更していない。PR #297 / #298（Hint 5.0）、#275 / #293 / #295 / #296、W2-A、Cooking Steps / Techniques / Economy / Wave2 は read-only 参照のみ。

- audited `origin/main`: **`86b48fd51423a8f76db5398ab88ecfd944e2ae10`**（Merge PR #291, DH4-PROD）
- 生成物:
  - `docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_AUDIT.json`（実コードから生成。`--check` でドリフト検知）
  - `docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_MATRIX.csv`（ingredient × taxonomy × 3画面）
  - `docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_UI-MEASUREMENTS.json`（Chromium 実測 390×844 / 360×800）
  - `tools/ingredient-category-tabs/audit.mjs`（Vite SSR loader で本物の `ingredients.ts` / `ingredientTaxonomy.ts` / `prepareDock.ts` を読む。再実装なし）
  - `tools/ingredient-category-tabs/measure.spec.ts` + `playwright.measure.config.ts`（CI 外の計測ハーネス）
- 用語: 「タブ」は調理画面の `MakingStepTabs`（生地/ソース/チーズ/具材、`role=tablist`）と衝突する。本書では新機能を **分類 shelf（棚）チップ** と呼ぶ。ユーザー向け文言は「分類タブ」のままでよい。

---

## 0. 結論（先に）

1. **Taxonomy SSOT は既にある**: `src/data/ingredientTaxonomy.ts`（DH4-1、7 family / 4 group、topping 22 行）。Hint 5.0（#297）も同じ id を読む（`hintClassDisplay.ts` は id をそのまま使い、新 family を作らない）。新しい画面専用 category は不要で、作ってはいけない。
2. **runtime の 29 材料は 100% 分類できる**（topping 22/22 は family、sauce 3 / cheese 4 は category を shelf とする）。未分類 0。
3. **1 ingredient = 1 shelf は runtime で成立**（重複行 0、topping 以外の family 行 0）。ただし `FAMILY_BY_INGREDIENT` は `Map` なので重複行は黙って後勝ちになる → Phase 1 で「重複行 0」gate が必要。
4. **完全一致（Hint = Builder = Shop = Ingredients）は「id」では成立、「ラベル」では未成立**。Hint 5.0 は `肉系 / 魚介系 / 野菜・きのこ系 / … / ちょっと変わった材料`、DH4 の `labelJa` は `肉 / 魚介 / 野菜・きのこ / … / その他`。特に `other` は Hint 5.0 では「その他」を**使わない**（OD-TAX-8）。→ Owner Decision OD-CT-3。
5. **最大の論点は既存 authority との衝突**: Large Catalog UX（Issue #269 / PR #272、Owner Authority 2026-09-27）は LC-OD-1 で「調理トレイ内に family タブ行を足す案（B）」を**不採用**とし、「手元（≤12）+ 食材庫シート（family タブはシート内）」を設計方針として承認済み。今回の依頼（調理画面の具材工程に分類タブ）はその B に近い。→ **OD-CT-1（最優先）**。これが決まるまで Phase 2（Pizza Builder）は着手不可。
6. **Shop / Ingredients 画面には既に 3 分類タブがある**（すべて / ソース / チーズ / トッピング）。実装は各画面に重複コピーで、高さ 33px・12px 文字・`role=tab` だが tabpanel / 矢印キーなし。今回は「新設」ではなく「トッピングを family へ細分化 + 共通部品化 + アクセシビリティ是正」になる。
7. **新規 Issue は作成していない**（§1.2）。#269（LC）/ #292（Hint 5.0）と部分重複しており、Owner が OD-CT-1 を決めるまで別 Issue にすると track が分裂する。Issue 案文は §14 に置いた。

---

## 1. Fresh Check

### 1.1 GitHub 状態（2026-09-29 取得）

| 項目 | 状態 |
|---|---|
| `origin/main` | `86b48fd`（PR #291 merge）。#293 / #295 / #296 / #297 / #298 は **未 merge**（open） |
| PR #297 | Hint 5.0 H5-1..H5-4 + Activation Gate（flag OFF）。`hintClassDisplay.ts` / `recipeHintRoles.ts` / `hint5Ladder.ts` はここにだけある（main には無い） |
| PR #298 | Hint 5.0 H5-5 Preview opt-in（#297 に依存） |
| PR #293 | Hint 5.0 taxonomy coverage audit（62 / 172、docs only、authority ではない） |
| PR #296 | 172 Recipe Taxonomy / HCG authority pack（docs/data/tools） |
| PR #255 | 172 taxonomy Fresh Audit + OD-TAX-1..9 |
| PR #272 / Issue #269 | Large Catalog UX LC-1 / LC-1b（pure catalog model、unwired）。`queryCatalog` は **family フィルタ済み**、`familyCounts` あり |
| PR #275 / #295 | 別 track。触らない |
| Issue #292 | Hint 5.0 parent |

### 1.2 Duplicate Gate

- Issue 検索（"ingredient category tab filter shop ingredients builder taxonomy tabs"）: 完全一致 0。
- ただし **意味的な重複**: #269 の Fresh Design §7.6 / §11 / §12（食材庫シートの family タブ、Shop / Inventory の family・検索）と目的が重なる。#269 は LC-1（pure 層）だけの Issue で、LC-2/3 の Issue は未作成。
- **判断: Issue は作らない。** 作る場合は #269 / #292 を参照する OD-CT-1 起点の Issue として（案文 §14）。

---

## 2. Authority 監査（どのデータを UI taxonomy の SSOT にするか）

| # | 対象 | 場所 | 種別 | UI での扱い |
|---|---|---|---|---|
| A1 | 材料 id / category / 名前 | `src/data/ingredients.ts`（29 材料、sauce 3 / cheese 4 / topping 22） | production | **正**（category 3 値） |
| A2 | topping → family | `src/data/ingredientTaxonomy.ts` `TOPPING_FAMILY_ROWS`（22 行、7 family、4 group） | production（DH4-1） | **UI shelf の SSOT** |
| A3 | Hint 5.0 の表示ラベル / 記号 | `src/data/hintClassDisplay.ts`（**#297 のみ**、H5-0 OD-H5-C4） | 未 merge | ラベル authority 候補（§8） |
| A4 | 62 / 172 への拡張候補 | #255 / #293 / #296 | PROPOSED / NEEDS_REVIEW | **参照のみ**。HCG 通過までは UI に使わない |
| A5 | recipe 内の役割（post-bake 等） | 172 matrix | taxonomy ではない（OD-TAX-6） | **shelf に使わない** |
| A6 | 62 catalog JSON | `data/recipes/ingredient_master_catalog.json` | 「NOT wired into src」 | 使わない |
| A7 | 画面独自 category | — | — | **作らない** |

優先順位（#293 §3 と同じ）: **A2 ＞ A1 category ＞ Owner Decision（H5-0 ＞ OD-TAX ＞ OD-DH4）＞ A4 提案**。

**推奨 SSOT**: `shelf(ingredient)` = `topping` なら A2 の family、`sauce` / `cheese` なら A1 の category。
これは新しい分類ではなく「A2 と A1 の合成ビュー」で、UI 用のデータを一切持たない。A2 に行が無い topping は **shelf なし（すべて でのみ表示）** とし、推測分類しない。Hint 5.0 も「family が 1 つに決まらない topping は対象外」（`hint5Ladder.ts`）なので挙動が揃う。

---

## 3. Fresh Audit（FT-1..15）

### FT-1 Production catalog 全体と category coverage
- 29 材料: sauce 3 / cheese 4 / topping 22。25 recipes。starter 3（tomato-sauce / mozzarella / basil）、finite 26。
- topping 22/22 に family 行（meat 4 / seafood 3 / vegetable 8 / fruit 1 / herb 4 / spice 1 / other 1）。sauce・cheese は family 行なし（DH4-1 の設計どおり「category が attribute」）。
- 孤児行（taxonomy にあって ingredients に無い id）0、topping 以外の family 行 0、重複行 0。

### FT-2..5 集合（`screenCoverage`、MATRIX.csv）

| 画面 | 集合の定義（現行コード） | 件数 | shelf 分類 |
|---|---|---:|---|
| **Pizza Builder / FREE**（具材工程） | `trayIngredientsFor("topping", freeCook)` = **所持している topping 全部** | 最大 22（6 件/ページ → **4 ページ**） | 22/22 |
| **Pizza Builder / recipe 指定**（Guided・Lunch・Dinner） | 所持 ∧ `recipe.requiredIngredients` | 具材 **最大 4**（分布: 0 が 1、1 が 7、2 が 12、3 が 1、4 が 4）。1 recipe あたり最大 4 family | 一様に分類可 |
| **Shop** | `materialShopState` が NEW/OWNED（finite。starter は売らない。LOCKED は非表示） | 最大 26（sauce 2 / cheese 3 / topping 21） | 26/26 |
| **Ingredients（在庫）** | `ownedIngredientIds` すべて | 最大 29 | 29/29 |

- 差分: (a) Builder は **step ごとに category が固定**（生地 / ソース / チーズ工程には具材が出ない）、(b) Shop は starter を含まない・未解放を含まない、(c) Ingredients は starter を含む、(d) recipe 指定の Builder は ≤4 件で絞り込みの実益がない。
- **family の使い分け**: Builder では family だけ（sauce / cheese は step が分けている）。Shop / Ingredients では sauce / cheese / family を **1 本の shelf 軸**に並べる（現行の 4 タブを置き換える）。

### FT-6 100% 分類できるか
できる。上表のとおりすべての集合で未分類 0。ただし根拠は「runtime 29 材料」限定。

### FT-7 未分類材料
**runtime: なし。** ただし 62 catalog では topping 42 中 **23 が有効な family なし**（#293 §4.1: PROPOSED 16 + NEEDS_REVIEW 7）。id は #293 / #296 の HCG 行を参照（本 PR では複製しない）。2 件（garlic, black-olive）は行があるが境界が HCG queue にある。→ HCG 完了前に材料を出荷すると shelf なしになる。これは Hint 5.0 の `hint5Taxonomy.gate.test.ts`（#297）が fail-fast させる不変条件と同一。**Phase 1 で同じ不変条件を「shelf 未定義の出荷 topping は 0」として gate 化する**（Hint gate の再利用または同等）。

### FT-8 ソース・チーズと taxonomy
DH4-1 は sauce / cheese を family にしない（OD-TAX-9 / FR-2 未決）。→ Shop / Ingredients の shelf では **category をそのまま shelf にする**（ソース / チーズ）。新 family は作らない。Hint 5.0 も sauce / cheese は「ラダーの sauce 段 / cheese 段」で別扱いなので矛盾しない。Builder には出さない（step が同じ役割を果たしている）。

### FT-9 olive-oil など
runtime の olive-oil は `category: "sauce"`。SAUCE 工程にのみ出る。172 では post-bake finishing や spread として使われるが、**役割（タイミング）は taxonomy ではない**（OD-TAX-6）。よって 1 shelf = ソース で曖昧さなし。将来 honey / mayo（sauce かつ postBakeFinishing）、mascarpone（cheese か dairy か未決）、truffle / nori（NEEDS_REVIEW）は HCG 待ち。**UI で暫定分類しない。**

### FT-10 1 ingredient = 1 shelf
runtime で成立（`ingredient → shelf` は関数。tool は重複行を検出）。複数 category 化はしない。成立しない将来ケース（例: 「ソースにも具材にもなる」）は category と役割を混ぜている兆候で、HCG / Owner へ戻す（勝手に multi-shelf 化しない）。

### FT-11 mobile の空き（実測 `UI-MEASUREMENTS.json`）

| viewport | ステージ | トレイ（3×2） | pager | 焼くバー | MakingStepTabs |
|---|---:|---:|---:|---:|---:|
| 390×844 | 445 | 134（チップ 118×64） | 28 | 70 | 44（tab 40） |
| 360×800 | 401 | 134（チップ 108×64） | 28 | 70 | 44（tab 40） |

- 調理画面は両 viewport で 1 画面に収まり（`.game-screen` scroll なし）、**余白ゼロ**。分類行を足す分、ステージが縮む。
- Shop / Ingredients の現行タブ行: 高さ **33px**、文字 **12px**、4 個、1 行（横あふれなし）。一覧は縦スクロール。

### FT-12 タブ形式の比較

必要幅（Chromium canvas 計測、`candidateRowWidth`）: Builder 8 個（すべて + 7 family）は 14px 文字で **674px**（内容幅 328〜358px の約 2 倍）。Shop / Ingredients 10 個は **824px**。

| 案 | Builder 高さ | 文字 | 44px | 評価 |
|---|---|---|---|---|
| **A. 横スクロール chip 行（1 行）** | +44（pager は残す） | 14px 維持 | ○ | **推奨**。「すべて」固定 + 残りスクロール、端に fade cue。選択中を scrollIntoView |
| B. 折り返し | 8 個で 3 行 ≒ 132px | 14px | ○ | 調理画面では不可（ステージ −30%）。Shop / Ingredients の 10 個なら 3 行 ≒ 120px で許容だが縦を食う |
| C. 2 段固定 | +92 | 14px | ○ | 不可 |
| D. 「その他」に収納 | +44 | 14px | ○ | family 7 個は「その他」に隠す意味が薄い。隠すとヒントで知った分類を探せない（目的に反する）|
| E. 縮小して 1 行 | +32 | ≈8px | × | **禁止**（ユーザー要望・44px 未達）|
| F. 28px の pager 行を置換 | ±0 | – | × | #272 の shelf bar 案。44px 未達、かつ 2 ページ以上の family（vegetable 8）で pager が消せない |

推奨: **Builder / Shop / Ingredients すべて A（横スクロール chip 行）を共通コンポーネント化**。折り返しは採らない。

### FT-13 62 → 172 population への耐性
- shelf 軸は最大 **9〜10 個で固定**（family は増えない。#293: 172 でも新 family id は不要）。材料が増えても**タブ数は増えず、各 shelf 内の件数が増える**。→ タブ行の設計は population に非依存。
- 一方 **shelf 内の件数**は増える（#272: 105 材料で topping 71、179 で 123 と試算）。vegetable 単独で 30+ になり得るので、Builder の 1 ページ 6 件 pager は残す（ページ数は family で割られて減る）。件数が 30 を超える shelf は検索 / 並べ替え（LC-3）の領域で、本 track の範囲外。
- 62 catalog では topping 23 が shelf なし。HCG が終わらない限り 62 へは出荷できない（FT-7）。

### FT-14 アクセシビリティ（現行との差分）

| 項目 | 現行（Shop / Ingredients） | 推奨 |
|---|---|---|
| touch target | **33px**（<44）、12px | chip 高さ ≥ 44px（見た目 36 + 縦 padding で当たり判定 44）、文字 14px |
| 選択状態 | 色のみ（`--active`） | 色 + 太字/下線 + `aria-pressed` or `aria-selected`（色のみに頼らない） |
| semantics | `role=tablist/tab`、tabpanel・`aria-controls` なし、矢印キーなし | **toggle button group**: `role="group"` + `aria-label="材料の分類"` + `<button aria-pressed>`。Builder は既に `MakingStepTabs` の `role=tablist` があり、2 本目の tablist は混乱の元。`role=tab` を使うなら tabpanel と roving tabindex・←→ を実装 |
| keyboard | Tab で全部に止まる | 8〜10 個は Tab で足りる。スクロール行は focus で `scrollIntoView` |
| 横あふれ | flex-wrap で回避 | スクロール行は page-level の horizontal overflow を出さない（`overflow-x:auto` を chip 行だけに限定）+ `scroll-snap` なし（誤タップ防止）|
| live region | なし | 絞り込み後に「肉 4種」を `aria-live="polite"`（Builder の既存 sr-only announcer を再利用）|
| 空の shelf | 「このカテゴリで買える材料はまだありません」 | 下記 privacy 規則に従う |

### FT-15 pure display filter として実装できるか
できる。ただし条件がある。
- 状態は `activeShelf`（画面ローカル UI state）だけ。reducer / save / inventory / unlock / purchase / selection / scoring には触れない。
- **Builder の落とし穴 3 つ**（既存コードで確認）:
  1. `IngredientTray` は `useEffect(..., [activeCategory])` で `setPage(0)` する。shelf 変更でも page を 0 に戻す必要があるが、`goToPage` は「見えなくなる選択を `onClearSelection()` で解除する」既存契約を持つ（PR #197 review P2）。**shelf 変更で選択を解除しないという今回の要件は、この既存契約と衝突する。** 選択中の材料が絞り込みで非表示になると、次のピザタップで「見えない材料」が置かれる。→ 解決案: 選択中チップは常に絞り込み結果に**ピン留め表示**（先頭に 1 個追加）するか、非表示になる場合のみ選択解除する。Owner Decision OD-CT-5。
  2. `prepareDockReserve` は round 開始時の所持集合から行数を予約する。分類行を足すなら予約高さにも入れる（DM-3R-0 stage-size-stability）。絞り込み後の件数で高さが変わらないよう、トレイは常に 3×2 固定高（現行と同じ）。
  3. 物理ドラッグ中に shelf を切り替えると session が残る。`clearSession()` を shelf 変更でも呼ぶ（category / page と同様）。
- **Shop の privacy**: 現行は LOCKED を一覧に出さない。shelf ごとの**件数バッジ・空 shelf の表示**は LOCKED 材料の存在を漏らす。→ Shop の shelf 行は「**表示行が 1 件以上ある shelf だけ**」を出し、件数は出さない（Phase 5 の「肉 8/12」は所持側 Ingredients のみ、かつ分母の扱いに Owner Decision OD-CT-6）。
- **ownership filter**（未所持 / 在庫少）は taxonomy と別の軸: 独立した `ownershipFilter` state とし、chip 行に混ぜず別 control（トグル）にする。Phase 1 には含めない。

---

## 4. ingredient × taxonomy × 画面 matrix

全 29 行は `TETO_INGREDIENT-CATEGORY-TABS_MATRIX.csv`（列: id, nameJa, category, family, shelf, starter, finite, builderFreeCook, builderGuided, shop, ingredients, recipesUsing）。shelf 別の要約:

| shelf | 表示名（案） | 材料数 | Builder(FREE) | Shop | Ingredients | 材料 |
|---|---|---:|:-:|:-:|:-:|---|
| sauce | ソース | 3 | –（step） | 2 | 3 | tomato-sauce*, olive-oil, pesto |
| cheese | チーズ | 4 | –（step） | 3 | 4 | mozzarella*, gorgonzola, parmigiano, fontina |
| meat | 肉 | 4 | 4 | 4 | 4 | sausage, pepperoni, bacon, ham |
| seafood | 魚介 | 3 | 3 | 3 | 3 | anchovy, tuna, clam |
| vegetable | 野菜・きのこ | 8 | 8 | 8 | 8 | mushroom, cherry-tomato, onion, black-olive, corn, eggplant, fresh-tomato, potato |
| fruit | 果物 | 1 | 1 | 1 | 1 | pineapple |
| herb | ハーブ・香味 | 4 | 4 | 3 | 4 | basil*, garlic, oregano, rosemary |
| spice | スパイス・薬味 | 1 | 1 | 1 | 1 | capers |
| other | その他 / ちょっと変わった材料 | 1 | 1 | 1 | 1 | egg |

`*` = starter（Shop に出ない）。

---

## 5. 推奨 tab / category 構成

共通の shelf 軸（順序固定、Hint 5.0 と同じ family 順）:

`すべて` ｜ `ソース` ｜ `チーズ` ｜ `肉` ｜ `魚介` ｜ `野菜・きのこ` ｜ `果物` ｜ `ハーブ・香味` ｜ `スパイス・薬味` ｜ `その他`

| 画面 | 出す shelf | 備考 |
|---|---|---|
| Pizza Builder（具材工程のみ） | すべて + **所持 topping が 1 件以上ある family** | 生地 / ソース / チーズ工程では行ごと出さない。**トレイが 1 ページに収まる round（≤6 件）では行を出さない**（recipe 指定の全 recipe が該当、現行 UI と ±0）→ 影響は FREE で >6 件所持のときだけ |
| Shop | すべて + **表示行が 1 件以上ある shelf**（ソース / チーズ含む） | 件数は出さない（privacy）。現行の「トッピング」タブは「すべて」に吸収するか残すか → OD-CT-4 |
| Ingredients | 同上（所持行がある shelf） | Phase 5 で `肉 8/12` 表示（分母は OD-CT-6）|

- 1 件しか無い family（fruit / spice / other）も出す。Hint 5.0 は「catalog に 1 件でも分類を出してよい」（OD-H5）ので、ヒントで「果物系」と出たらタブが必ずある状態を保つ。
- 表示名は §8 のラベル authority に従う。

---

## 6. Mobile UX 案（390×844 / 360×800）

Builder（具材工程・FREE・>6 件所持時のみ）:

```
[MakingStepTabs 生地 ✓ ソース ✓ チーズ ✓ 具材]   44   （既存）
[   PizzaStage                          ]   445 → 401 (390×844) / 401 → 357 (360×800)
[すべて][肉][魚介][野菜・きのこ][果物]→          44   ← 新規 chip 行（横スクロール、右端 fade）
[ トレイ 3×2                            ]   134   （既存、常に固定高）
[   ◀ 1 / 2 ▶ pager                     ]   28    （既存、family 内が >6 件のときだけ有効）
[ 焼く CTA bar                          ]   70
```

- ステージ −44px（−10%〜−11%）が代償。両 viewport とも `.game-screen` は 1 画面に収まる見込み。**Phase 2 の Gate で 390×844 / 360×800（+ #272 が使う 390×664 / 360×640）を実測して確定**する（本 Phase 0 は実装なしなので見込み）。
- 44px を確保できない、かつステージ縮小が許容できない場合の逃げ道は LC の「食材庫シート」（OD-CT-1 で A を選んだ場合）。
- 選択 chip: 背景反転 + 太字 + `aria-pressed=true`。chip は `white-space:nowrap`、`flex:0 0 auto`。「すべて」は左固定（sticky）。
- family を切り替えても**選択済みトッピングは解除しない**。既に置いたトッピングはピザ上に残る（display のみ）。選択中チップが絞り込みで隠れる場合の扱いは OD-CT-5。

Shop / Ingredients: 現行 33px 行を 44px の同じ chip 行に置換（文字 14px）。一覧の縦スクロールは変えない。

---

## 7. 3 画面で共通化できる範囲

| 層 | 共通化 | 場所（案） |
|---|---|---|
| shelf id / 順序 / 表示名 / 所属判定 | ✅ 1 か所 | `src/data/ingredientShelf.ts`（pure、DH4-1 と A1 から導出） |
| フィルタ関数 `filterByShelf(items, shelf)` | ✅ | 同上（pure）。#272 の `queryCatalog` が merge されるなら family / category の絞り込みはそれを使い、重複実装しない |
| chip 行コンポーネント | ✅ | `ShelfChips.tsx`（props: `shelves`, `active`, `onChange`, `label`）|
| どの shelf を出すか（可視性規則） | ❌ 画面ごと | Builder=所持 topping family / Shop=表示行あり / Ingredients=所持あり |
| 件数バッジ | ❌ Ingredients のみ | privacy |
| ownership filter | ❌ 別軸 | 後続 |

---

## 8. Hint 5.0 とのラベル整合（label authority）

| id | DH4 `labelJa`（main） | Hint 5.0 `HINT_CLASS_DISPLAY`（#297） | 記号（#297） |
|---|---|---|---|
| meat | 肉 | 肉系 | 🥩 |
| seafood | 魚介 | 魚介系 | 🦐 |
| vegetable | 野菜・きのこ | 野菜・きのこ系 | 🥬 |
| fruit | 果物 | 果物系 | 🍇 |
| herb | ハーブ・香味 | ハーブ・香味系 | 🪴 |
| spice | スパイス・薬味 | スパイス・薬味系 | 🧂 |
| other | **その他** | **ちょっと変わった材料**（「その他」は使わない, OD-TAX-8）| ✨ |

- id は**完全一致**。ラベルは「系」の有無だけがずれ、`other` だけが別語。
- 推奨: タブ表示名 = Hint 5.0 の `labelJa` から末尾「系」を除いたもの（肉 / 魚介 / 野菜・きのこ / 果物 / ハーブ・香味 / スパイス・薬味）。「Hint が『野菜・きのこ系』→ タブ『野菜・きのこ』」は依頼の「同じ意味だと明確に分かる表記」を満たす。記号を chip に併記すれば記号でも突合できる（H5-INV-2: 記号は材料 emoji と重複しないよう設計済み）。
- `other`: **依頼の例は「その他」だが、Hint 5.0 は「ちょっと変わった材料」を採用**。ヒントで「ちょっと変わった材料」と言われて「その他」タブを探すのは推理を壊す。→ OD-CT-3（推奨: Hint と同じ「ちょっと変わった材料」、chip が長いので `✨ ちょっと変わった` 等の短縮は Owner が決める）。
- **依存**: ラベル authority が #297（未 merge、本 track は変更不可）にある。Phase 1 は (a) #297 merge 後に `HINT_CLASS_DISPLAY` から導出、または (b) main の `ATTRIBUTE_FAMILIES.labelJa` を暫定に使い #297 merge 後に切替、のどちらか。**ラベルを本 track に複製して 2 つ目の SSOT にしてはいけない。** ラベル一致を保証する gate test（shelf label 導出 ＝ hint label 導出）を Phase 1 に入れる。

---

## 9. 実装 Phase 分割（最終決定）

| Phase | 内容 | 変更範囲 | 前提 |
|---|---|---|---|
| **0**（本 PR なし・push のみ） | Fresh Audit / 設計 | docs / data / tools | – |
| **1** shelf foundation | `ingredientShelf.ts`（pure）+ `ShelfChips.tsx`（未配線）+ gate tests。UI 変更なし | `src/data`, `src/components`（未 import） | OD-CT-1 が「inline chip を採る」と決まるか、A（食材庫）でも shelf 定義は共通なので **OD-CT-3 のみで可**。#297 merge 待ちか暫定ラベル（OD-CT-3）|
| **2** Pizza Builder | 具材工程に chip 行（FREE・>6 件時のみ）。`IngredientTray` / `prepareDock` / `GameScreen` / CSS | production | **OD-CT-1, OD-CT-5**、Phase 1、HV（video）|
| **3** Shop | 既存 4 タブを共通 chip 行へ置換 | `ShopOverlay` / CSS | Phase 1、OD-CT-4 |
| **4** Ingredients | 同上 | `InventoryOverlay` / CSS | Phase 1、OD-CT-4 |
| **5** polish | `肉 8/12` 件数、a11y 仕上げ、mobile HV、(任意) 選択ピン留め | 複数 | OD-CT-6 |

順序の理由: 共通基盤 → **Shop / Ingredients を先にしても良い**（既存の 4 タブの置換で低リスク・調理画面の高さに影響しない）。一方ユーザー価値が最大なのは Builder（ヒント → 探す）。Builder は OD-CT-1（LC-OD-1 との衝突）が未決のため、**衝突の無い Shop → Ingredients を Phase 2/3 に前倒しする入れ替えも可**（OD-CT-2）。

### Human Verification（CLAUDE.md 必須）
Phase 2〜5 は UI 変更なので `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従い、390×844 の HV 動画（ユーザーへ直接、repo には commit しない）と before/after スクリーンショット（`docs/reports/screenshots/<task-name>/`）が DoD。本 Phase 0 は docs / data / tools のみで UI 変更なし → 動画・スクリーンショットは不要。

---

## 10. Test plan

**Phase 1（pure）**
- G-SHELF-1: runtime の全 ingredient が shelf を 1 つだけ持つ（`shelf(i)` は topping なら family、他は category、`null` を許さない）。
- G-SHELF-2: `TOPPING_FAMILY_ROWS` に重複 id 0、topping 以外の行 0、孤児行 0。
- G-SHELF-3: shelf の順序・id は `ATTRIBUTE_FAMILIES` の順と一致（追加・削除で fail）。
- G-LABEL-1: shelf 表示名の導出 ＝ Hint 5.0 表示名の導出（#297 merge 後）。`other` の語も一致。
- G-LABEL-2: どのラベルにも材料名を含まない（Hint H5-INV-2 と同じ）。
- G-FILTER-1: `filterByShelf` は入力の部分集合・順序保存・副作用なし。`all` は恒等。
- G-FILTER-2: 未知 shelf / `__proto__` / 非 string で throw せず空。
- G-PURE-1: static import 境界 — reducer / save / inventory / progression / scoring を import しない。
- G-SHIP-1（将来）: 出荷 topping で shelf なし 0（Hint 5.0 の `hint5Taxonomy.gate.test.ts` と同一不変条件）。

**Phase 2〜4（UI）**
- 絞り込み前後で `state`（reducer 全体）が deep-equal（filter 操作で action が 1 つも dispatch されない）。
- 選択済みトッピングが shelf 変更後も pizza 上に残る / `selectedIngredientId` が OD-CT-5 の規則どおり。
- 物理ドラッグ中の shelf 切替で session が破棄される。
- stage-size-stability / layout-contract（Free / Dinner / Guided / Lunch の floor 0px 回帰）、390×844 / 360×800 でページ横あふれ 0、chip 高さ ≥44。
- Shop: LOCKED 材料が shelf 行・件数・空メッセージのどこにも現れない。
- a11y: `aria-pressed` 状態、キーボード（Tab / Space / Enter）、`aria-live` 通知。
- Playwright: 3 画面 × 2 viewport のスクリーンショット + 横スクロール chip 行の端到達。

---

## 11. Blocker / Owner Decision

| ID | 内容 | 推奨 | 影響 |
|---|---|---|---|
| **OD-CT-1** | **LC-OD-1（承認済み設計方針: 手元 ≤12 + 食材庫シート。トレイ内 family 行は B として不採用）と今回の「具材工程に分類タブ」をどう両立するか** | 二段: Phase 2 は「>6 件所持時のみの 44px chip 行」を暫定採用し、LC-2 の working set が来たら shelf bar に統合。または LC-OD-1 を A のまま、分類タブは食材庫シート（LC-3）と Shop / Ingredients のみにする | **Phase 2 の blocker** |
| OD-CT-2 | Phase 順: Builder 先行か、Shop / Ingredients 先行か | 衝突の無い Shop → Ingredients を先に、Builder は OD-CT-1 後 | Phase 順 |
| OD-CT-3 | `other` のラベル（「その他」vs Hint 5.0「ちょっと変わった材料」）と「系」の有無 | Hint に揃える（系のみ除去、other は Hint と同語）| Phase 1 |
| OD-CT-4 | Shop / Ingredients の既存「トッピング」タブを残すか（残す＝ソース / チーズ / トッピング / 各 family の 2 階層）、family に置換するか | 置換（1 軸、すべて で全 topping が見える）| Phase 3/4 |
| OD-CT-5 | Builder で選択中チップが絞り込みで隠れるとき: (a) 先頭にピン留め表示 (b) 選択解除（PR #197 契約）(c) 絞り込み中は選択維持のまま非表示 | (a)。(c) は「見えない材料が置かれる」ので不可 | Phase 2 |
| OD-CT-6 | `肉 8/12` の分母: 「発見済みレシピに関係なく catalog 全数」は未解放材料の存在を漏らす | 分母は **Shop が解放した（NEW/OWNED）材料数**。catalog 全数は出さない | Phase 5 |
| OD-CT-7 | 172 population 向けに shelf を増やすか（family を増やす場合は Owner へ戻す — #293/H5-0 と同じ規則）| 増やさない（7 family 固定）| 将来 |

**Blocker（技術）**
1. **B-1** ラベル authority（`hintClassDisplay.ts`）が **#297（未 merge）** にある。Phase 1 のラベル gate は #297 待ち。
2. **B-2** PR #272（LC-1）が未 merge。merge されると `catalogQuery`（family / category 絞り込み・`familyCounts`）が Phase 1 の関数と重複する。Phase 1 開始時に #272 の状態を再確認し、merge 済みなら `queryCatalog` を使い、`ingredientShelf` は「shelf id / ラベル / 所属」だけに絞る。
3. **B-3** `MakingStepTabs` の `role=tablist` と新 chip 行の semantics 衝突（§3 FT-14 の toggle group で回避）。
4. **B-4** 62 catalog の topping 23 件が shelf なし（HCG 待ち）。runtime 29 材料には影響なし。

---

## 12. 最小 slice（次に実装してよい）

**Phase 1 の最小 slice**（OD-CT-3 の回答だけで開始可能。production の挙動は 0 変更）:
- `src/data/ingredientShelf.ts`（pure）: `SHELF_ORDER`, `shelfOf(ingredient)`, `filterByShelf`, `shelvesPresent(items)`。ラベルは main の `ATTRIBUTE_FAMILIES.labelJa` を暫定入力（OD-CT-3 で確定）。
- gate tests G-SHELF-1..3, G-FILTER-1/2, G-PURE-1。
- `ShelfChips.tsx` は Phase 1b（未配線）。
- 触るファイルは新規 3〜4 個のみ。`ingredients.ts` / `ingredientTaxonomy.ts` / `IngredientTray` / Shop / Inventory / CSS は触らない。

---

## 13. 制約の遵守

- 変更したのは `docs/reports/**`（新規）と `tools/ingredient-category-tabs/**`（新規）のみ。`src/`, CSS, `e2e/` は 0 diff。
- #297 / #298 / #275 / #293 / #295 / #296 / #255 / #272 のブランチは `git fetch` で read-only 参照。commit・comment・review なし。
- 計測ハーネスは dev server を localhost:5184 で起動して本番 UI を読むだけ（保存データは Playwright の使い捨て profile）。

## 14. （参考）Issue 案文 — 作成していない

> **Title:** Ingredient Category Tabs 1.0: shared ingredient shelf chips for Builder / Shop / Ingredients (Hint 5.0-aligned)
> **Refs:** #269 (LC-OD-1), #292 (Hint 5.0), #297. **Blocking decision:** OD-CT-1.
> **Authority:** `docs/reports/TETO_INGREDIENT-CATEGORY-TABS_1.0_Fresh-Audit-Design.md`
> Phase 1 (pure shelf foundation) → Shop → Ingredients → Builder → polish.

## 15. 再生成

```
node tools/ingredient-category-tabs/audit.mjs --check docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_AUDIT.json
node tools/ingredient-category-tabs/audit.mjs --csv | diff - docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_MATRIX.csv
PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  npx playwright test -c tools/ingredient-category-tabs/playwright.measure.config.ts
```
