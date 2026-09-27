# Wave 2 — W2-A Owner Decision Gate

Status: **判定 A. W2-A READY FOR OWNER FINAL DECISIONS**（§13）。実装はしていない。
src / e2e / CSS / production runtime recipe は変更なし。PR / merge / deploy なし。Issue も作成していない（§10 は案だけ）。

| 項目 | 値 |
|---|---|
| 監査した main | `51e0923`（Merge PR #252 Dinner DM-3R-2）— fresh fetch |
| 前回 Fresh Design の base | `5a33d85`（PR #254）。design branch に main を merge 済み（conflict なし） |
| branch | `claude/wave2-runtime-recipe-design-os06j1` |
| machine-readable | `docs/design/data/TETO_WAVE2_W2A_OWNER-GATE.json` |
| 検証 tool | `tools/progression2_wave2_w2a_gate.py`（`--check`）。前回の `tools/progression2_wave2_candidates.py --check` も新 main で再実行して PASS |
| Owner 方針（採用候補として扱った） | OD-W2-1 = append-only（W1 step 1〜24 固定、Wave 2 は 25 以降）／Wave 2 第一候補 = W2-A／将来候補 = W2-C → W2-D |

## 1. Fresh Rebase Audit（`5a33d85` → `51e0923`）

### 1.1 GitHub state（2026-09-27 fetch）

| 対象 | 状態 | Wave 2 への関係 |
|---|---|---|
| PR #252 Dinner DM-3R-2 | **MERGED**（`51e0923`） | 下の §1.2 |
| PR #259 Dinner DM-4-1（reward/tier pure layer） | OPEN | `src/mission/dinner/dinnerSettlement*` だけ。recipe/材料データに触れない |
| PR #255 172 Ingredient Taxonomy Fresh Audit（OD-TAX-1..9 Owner 承認済み・authority ではない） | OPEN（docs/data/tools のみ） | **W2-A の 7 topping の family 提案の出典**。§3・OD-W2-5 |
| Issue #256 焼成失敗でも CUT へ進む | OPEN | CUT ありの W2-A 7 recipe も同じ挙動になる。W2-A は変えない |
| Issue #224 Lunch Rush ruleset 付きランキング | OPEN | §8 Lunch Rush |
| Issue #216 paid unlock Fresh Design | OPEN | ladder の unlock 方式。append-only と矛盾しない（W1 と同じ MATERIAL step） |

### 1.2 main の差分（`5a33d85..51e0923`、75 files）

変更は Dinner DM-3R-2 だけ: `src/mission/dinner/*`, `src/state/{gameReducer,dinnerView,useDinnerRuntime}.ts`, `src/screens/{GameScreen,HomeScreen,DinnerMissionScreen}.tsx`, `src/components/DinnerGameUi.tsx`, `App.tsx/App.css`, e2e 3 本、report。

**Wave 2 の入力（`src/data/**`, `src/logic/**`, `tools/**`, `docs/design/**`, `data/**`）の変更は 0 件。**
JSON `inputHashes` に 16 入力ファイルの hash を記録した。前回の分類（A1/B26/C31/D18/E85）と W2-A 評価は新 main でも byte 一致。

Wave 2 に効く意味上の変化は 2 つ（どちらも設計変更は不要、考慮事項として §8 に反映）:

1. **Dinner は recipe-free cooking になった。** tray は FREE と同じく「所持材料すべて」（`GameScreen.tsx` `recipeFreeTray = freeCook || dinner !== null`）。材料が増えると時間制限つきの Dinner でも tray のページが増える（§9）。
2. **Dinner の結果判定は FREE の matcher（`RECIPE_DISCOVERY_CATALOG`）で recipe を特定する。** W2-A recipe は Dinner 中に「target 外の recipe」として判定され、その recipe の BAKE window と CUT 有無が使われる。collision 0（§7）なので AMBIGUOUS は増えない。Dinner mission の定義（`populationId: "w1-25"`、target は W1 recipe だけ）は変わらない。

## 2. W2-A 9 recipes

canonical ID は Phase-1 の `canonicalCandidateId`（提案。production id は OD-W2-6/7）。discovery target id は W1 と同じく PIZZA DB evidenceId。

### 2.1 一覧（要約）

| # | 日本語名 | canonical ID（提案） | ingredients | sauce | cooking profile | CUT | 新規 ingredient | unlock（key step） | 章 | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ブラジリアン・カラブレーザ | `brazilian-calabresa` | black-olive, onion, oregano, sausage, tomato-sauce | tomato-sauce (PAINT) | DOUGH → SAUCE → TOPPING → CUT | あり (6) | — | step 12（onion、T2） | 第2章 | MEDIUM |
| 2 | ヴォンゴレピザ | `vongole` | clam, garlic, olive-oil, parsley | olive-oil (PAINT_TEMPORARY) | DOUGH → SAUCE → TOPPING | なし | parsley | step 30（parsley、T4） | 第4章 | HIGH |
| 3 | タルトフランベ | `flammkuchen` | bacon, fromage-blanc-sauce, onion | fromage-blanc-sauce (PAINT (new profile)) | DOUGH → SAUCE → TOPPING | なし | fromage-blanc-sauce | step 26（fromage-blanc-sauce、T3） | 第3章 | HIGH |
| 4 | ペストガンベリピザ | `pesto-gamberi` | fresh-tomato, garlic, pesto, shrimp | pesto (PAINT) | DOUGH → SAUCE → TOPPING → CUT | あり (6) | shrimp | step 28（shrimp、T3） | 第3章 | HIGH |
| 5 | ペストポッロピザ | `pesto-pollo` | chicken, fresh-tomato, mozzarella, pesto | pesto (PAINT) | DOUGH → SAUCE → CHEESE → TOPPING → CUT | あり (6) | chicken | step 29（chicken、T3） | 第3章 | HIGH |
| 6 | ラタトゥイユピザ | `ratatouille-pizza` | bell-pepper, eggplant, oregano, tomato-sauce, zucchini | tomato-sauce (PAINT) | DOUGH → SAUCE → TOPPING → CUT | あり (6) | bell-pepper, zucchini | step 31（bell-pepper+zucchini、T4） | 第4章 | HIGH |
| 7 | ペストベジタリアーナピザ | `pesto-vegetariana` | bell-pepper, eggplant, mozzarella, pesto, zucchini | pesto (PAINT) | DOUGH → SAUCE → CHEESE → TOPPING → CUT | あり (6) | bell-pepper, zucchini | step 31（bell-pepper+zucchini、T4） | 第4章 | HIGH |
| 8 | プロシュットフンギ | `prosciutto-funghi` | mozzarella, mushroom, prosciutto-crudo, tomato-sauce | tomato-sauce (PAINT) | DOUGH → SAUCE → CHEESE → TOPPING → CUT | あり (6) | prosciutto-crudo | step 25（prosciutto-crudo、T3） | 第3章 | MEDIUM |
| 9 | ハモンセラーノピザ | `jamon-serrano-pizza` | arugula, mozzarella, prosciutto-crudo, tomato-sauce | tomato-sauce (PAINT) | DOUGH → SAUCE → CHEESE → TOPPING → CUT | あり (6) | arugula, prosciutto-crudo | step 27（arugula、T3） | 第3章 | HIGH |

### 2.2 recipe ごとの詳細

**1. ブラジリアン・カラブレーザ** — `brazilian-calabresa`（evidence `brazilian-calabresa-pizzadb-p10`、ブラジル / サンパウロ）

- ingredients: black-olive, onion, oregano, sausage, tomato-sauce
- sauce: `tomato-sauce` / PAINT（evidence family 「トマトソース」: family label names the existing tomato-sauce）
- cooking profile: DOUGH → SAUCE → TOPPING → CUT（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: STANDARD 6（dough evidence: 薄めの生地）
- discovery identity: target `brazilian-calabresa-pizzadb-p10`、items = {black-olive, onion, oregano, sausage, tomato-sauce}、sauceBase = [tomato-sauce]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: なし
- progression: key step 12（onion）→ 発見数 12 以上で材料が揃う。T2・第2章。自前の step なし（W1 材料だけで作れる）
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `salsiccia / capricciosa` と同じ
- evidence: Phase-1 READY_WITH_REVIEW、comparison_table_sample、token = exact_alias, likely_alias、likely alias: オリーブ->black-olive、review: NAMING_CLUSTER:NC-4-calabresa → **MEDIUM**
- unresolved: オリーブ -> black-olive is a likely_alias (colour not stated in PIZZA DB); NAMING_CLUSTER NC-4-calabresa (アルゼンチン風カラブレーサ is a blocked sibling); no cheese in evidence -> no CHEESE step (same as marinara / puttanesca)

**2. ヴォンゴレピザ** — `vongole`（evidence `vongole-pizzadb`、出自記載なし）

- ingredients: clam, garlic, olive-oil, parsley
- sauce: `olive-oil` / PAINT_TEMPORARY（evidence family 「ノンソース」: explicitly no sauce）
- cooking profile: DOUGH → SAUCE → TOPPING（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: なし（dough evidence: なし）
- discovery identity: target `vongole-pizzadb`、items = {clam, garlic, olive-oil, parsley}、sauceBase = [olive-oil]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: parsley
- progression: key step 30（parsley）→ 発見数 30 以上で材料が揃う。T4・第4章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `new-haven-apizza` と同じ
- evidence: Phase-1 READY、comparison_table_sample、token = phase0b_sample_canonical → **HIGH**
- unresolved: sauce family label is ノンソース but olive-oil is a listed spread layer; represented as the olive-oil PAINT_TEMPORARY base like fugazza / new-haven (Phase-1 FULL); a drizzle reading would move it to W2-D; dough evidence absent -> no CUT under the New Haven precedent (OD-W2-4); no cheese -> no CHEESE step

**3. タルトフランベ** — `flammkuchen`（evidence `flammkuchen-pizzadb`、出自記載なし）

- ingredients: bacon, fromage-blanc-sauce, onion
- sauce: `fromage-blanc-sauce` / PAINT (new profile)（evidence family 「ホワイトソース」: generic white sauce -- ambiguous in the canonicalizer (ホワイトソース); satisfied only by a listed white-sauce item）
- cooking profile: DOUGH → SAUCE → TOPPING（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: なし（dough evidence: なし）
- discovery identity: target `flammkuchen-pizzadb`、items = {bacon, fromage-blanc-sauce, onion}、sauceBase = [fromage-blanc-sauce]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: fromage-blanc-sauce
- progression: key step 26（fromage-blanc-sauce）→ 発見数 26 以上で材料が揃う。T3・第3章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `fugazza (no cheese, painted base)` と同じ
- evidence: Phase-1 READY、comparison_table_sample、token = phase0b_sample_canonical → **HIGH**
- unresolved: first non-tomato/pesto/oil PAINT sauce: RecipeSauceProfile.ingredientId union must widen; white-on-dough visibility needs a Human Visual check (olive-oil needed a --oil class, PR #45); dough evidence absent -> no CUT (real-world flammkuchen is often rectangular; evidence is silent on shape, so round is kept); no cheese -> no CHEESE step

**4. ペストガンベリピザ** — `pesto-gamberi`（evidence `pesto-gamberi-pizzadb-p11`、イタリア / 各地）

- ingredients: fresh-tomato, garlic, pesto, shrimp
- sauce: `pesto` / PAINT（evidence family 「バジル」: all 11 バジル-family rows are ペスト-named dishes; the existing basil sauce is pesto (ジェノベーゼソース). pesto-trapanese is a pesto variant -- flagged as a content note, not a separate sauce id）
- cooking profile: DOUGH → SAUCE → TOPPING → CUT（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: STANDARD 6（dough evidence: ナポリピッツァ生地）
- discovery identity: target `pesto-gamberi-pizzadb-p11`、items = {fresh-tomato, garlic, pesto, shrimp}、sauceBase = [pesto]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: shrimp
- progression: key step 28（shrimp）→ 発見数 28 以上で材料が揃う。T3・第3章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `pesto-tonno` と同じ
- evidence: Phase-1 READY、comparison_table_sample、token = exact_alias → **HIGH**
- unresolved: no cheese in evidence -> no CHEESE step

**5. ペストポッロピザ** — `pesto-pollo`（evidence `pesto-pollo-pizzadb-p12`、イタリア / 各地）

- ingredients: chicken, fresh-tomato, mozzarella, pesto
- sauce: `pesto` / PAINT（evidence family 「バジル」: all 11 バジル-family rows are ペスト-named dishes; the existing basil sauce is pesto (ジェノベーゼソース). pesto-trapanese is a pesto variant -- flagged as a content note, not a separate sauce id）
- cooking profile: DOUGH → SAUCE → CHEESE → TOPPING → CUT（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: STANDARD 6（dough evidence: ナポリピッツァ生地）
- discovery identity: target `pesto-pollo-pizzadb-p12`、items = {chicken, fresh-tomato, mozzarella, pesto}、sauceBase = [pesto]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: chicken
- progression: key step 29（chicken）→ 発見数 29 以上で材料が揃う。T3・第3章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `pesto-caprese` と同じ
- evidence: Phase-1 READY、comparison_table_sample、token = exact_alias → **HIGH**
- unresolved: なし

**6. ラタトゥイユピザ** — `ratatouille-pizza`（evidence `ratatouille-pizza-pizzadb-p13`、フランス / プロヴァンス）

- ingredients: bell-pepper, eggplant, oregano, tomato-sauce, zucchini
- sauce: `tomato-sauce` / PAINT（evidence family 「トマトソース」: family label names the existing tomato-sauce）
- cooking profile: DOUGH → SAUCE → TOPPING → CUT（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: STANDARD 6（dough evidence: ナポリピッツァ生地）
- discovery identity: target `ratatouille-pizza-pizzadb-p13`、items = {bell-pepper, eggplant, oregano, tomato-sauce, zucchini}、sauceBase = [tomato-sauce]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: bell-pepper, zucchini
- progression: key step 31（bell-pepper+zucchini）→ 発見数 31 以上で材料が揃う。T4・第4章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `melanzane-pizza` と同じ
- evidence: Phase-1 READY、comparison_table_sample、token = exact_alias → **HIGH**
- unresolved: no cheese in evidence -> no CHEESE step

**7. ペストベジタリアーナピザ** — `pesto-vegetariana`（evidence `pesto-vegetariana-pizzadb-p12`、イタリア / 各地）

- ingredients: bell-pepper, eggplant, mozzarella, pesto, zucchini
- sauce: `pesto` / PAINT（evidence family 「バジル」: all 11 バジル-family rows are ペスト-named dishes; the existing basil sauce is pesto (ジェノベーゼソース). pesto-trapanese is a pesto variant -- flagged as a content note, not a separate sauce id）
- cooking profile: DOUGH → SAUCE → CHEESE → TOPPING → CUT（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: STANDARD 6（dough evidence: ナポリピッツァ生地）
- discovery identity: target `pesto-vegetariana-pizzadb-p12`、items = {bell-pepper, eggplant, mozzarella, pesto, zucchini}、sauceBase = [pesto]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: bell-pepper, zucchini
- progression: key step 31（bell-pepper+zucchini）→ 発見数 31 以上で材料が揃う。T4・第4章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `pesto-patate` と同じ
- evidence: Phase-1 READY、comparison_table_sample、token = exact_alias → **HIGH**
- unresolved: なし

**8. プロシュットフンギ** — `prosciutto-funghi`（evidence `prosciutto-funghi-pizzadb-p11`、イタリア / 各地）

- ingredients: mozzarella, mushroom, prosciutto-crudo, tomato-sauce
- sauce: `tomato-sauce` / PAINT（evidence family 「トマトソース」: family label names the existing tomato-sauce）
- cooking profile: DOUGH → SAUCE → CHEESE → TOPPING → CUT（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: STANDARD 6（dough evidence: ナポリピッツァ生地）
- discovery identity: target `prosciutto-funghi-pizzadb-p11`、items = {mozzarella, mushroom, prosciutto-crudo, tomato-sauce}、sauceBase = [tomato-sauce]、dimensions = default。1 材料差の runtime recipe: funghi
- 新規 ingredient: prosciutto-crudo
- progression: key step 25（prosciutto-crudo）→ 発見数 25 以上で材料が揃う。T3・第3章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `funghi` と同じ
- evidence: Phase-1 READY_WITH_REVIEW、comparison_table_sample、token = exact_alias、review: SAME_INGREDIENT_SET_AS_CATALOG_RECIPE:prosciutto-e-funghi → **MEDIUM**
- unresolved: SAME_INGREDIENT_SET_AS_CATALOG_RECIPE prosciutto-e-funghi (catalog-only, not runtime): naming decision; prosciutto-crudo is post-bake in catalog finishing tags; this row has no REQUIRED late-addition evidence, so it is placed pre-bake (OD-TAX-6: timing is not identity); one ingredient from runtime funghi (near-miss ADD_ONE / REMOVE_ONE neighbour)

**9. ハモンセラーノピザ** — `jamon-serrano-pizza`（evidence `jamon-serrano-pizza-pizzadb-p7`、スペイン / 各地）

- ingredients: arugula, mozzarella, prosciutto-crudo, tomato-sauce
- sauce: `tomato-sauce` / PAINT（evidence family 「トマトソース」: family label names the existing tomato-sauce）
- cooking profile: DOUGH → SAUCE → CHEESE → TOPPING → CUT（deriveCoreSteps (category-derived) + CUT allowlist）
- CUT: STANDARD 6（dough evidence: 薄めの生地）
- discovery identity: target `jamon-serrano-pizza-pizzadb-p7`、items = {arugula, mozzarella, prosciutto-crudo, tomato-sauce}、sauceBase = [tomato-sauce]、dimensions = default。1 材料差の runtime recipe: なし
- 新規 ingredient: arugula, prosciutto-crudo
- progression: key step 27（arugula）→ 発見数 27 以上で材料が揃う。T3・第3章。append step が key
- expected ★: Sauce 52 / Pieces 16 / Recipe 12 / Bake 20、★上限 5（bake が perfect 以外なら ★4 cap）。sauce reference は全 recipe 共通の mechanical 値。未較正（minCount・bakeTarget・reference 配置は OD-W2-6）。想定カーブは W1 の類似 recipe `hawaiian` と同じ
- evidence: Phase-1 READY、comparison_table_sample、token = exact_alias → **HIGH**
- unresolved: reserves the P0-COLL-4 pair: pinsa-romana can later ship only with DOUGH_VARIANT; arugula / prosciutto-crudo are post-bake in catalog finishing tags; no REQUIRED evidence here -> pre-bake

## 3. W2-A で追加する 8 ingredients

| canonical ID | 表示名（提案） | category | taxonomy（family / subfamily） | shop 価格候補（pack / refill） | inventory unit | unlock step | recipe dependency | evidence |
|---|---|---|---|---|---|---|---|---|
| `arugula` | ルッコラ | topping | vegetable / vegetable.leafy | 100 / 50 Pitz（T3） | piece (scatter, k = max minCount) | 27 | jamon-serrano-pizza | catalog v2 あり、identity set が確定した 172 行のうち 6 行 |
| `bell-pepper` | パプリカ | topping | vegetable / vegetable.fruiting | 120 / 60 Pitz（T4） | piece (scatter, k = max minCount) | 31 | pesto-vegetariana, ratatouille-pizza | catalog v2 あり、identity set が確定した 172 行のうち 5 行 |
| `chicken` | チキン | topping | meat / meat.poultry | 100 / 50 Pitz（T3） | piece (scatter, k = max minCount) | 29 | pesto-pollo | catalog v2 あり、identity set が確定した 172 行のうち 4 行 |
| `fromage-blanc-sauce` | フロマージュブラン | sauce | （category レベル） / sauce.cream-dairy | 100 / 50 Pitz（T3） | use (spread, k=1) | 26 | flammkuchen | catalog v2 なし、identity set が確定した 172 行のうち 1 行 |
| `parsley` | パセリ | topping | herb / herb.leaf | 120 / 60 Pitz（T4） | piece (scatter, k = max minCount) | 30 | vongole | catalog v2 あり、identity set が確定した 172 行のうち 5 行 |
| `prosciutto-crudo` | 生ハム | topping | meat / meat.cured | 100 / 50 Pitz（T3） | piece (scatter, k = max minCount) | 25 | jamon-serrano-pizza, prosciutto-funghi | catalog v2 あり、identity set が確定した 172 行のうち 6 行 |
| `shrimp` | エビ | topping | seafood / seafood.shellfish | 100 / 50 Pitz（T3） | piece (scatter, k = max minCount) | 28 | pesto-gamberi | catalog v2 あり、identity set が確定した 172 行のうち 4 行 |
| `zucchini` | ズッキーニ | topping | vegetable / vegetable.fruiting | 120 / 60 Pitz（T4） | piece (scatter, k = max minCount) | 31 | pesto-vegetariana, ratatouille-pizza | catalog v2 あり、identity set が確定した 172 行のうち 4 行 |

## 4. ingredient 表の注記（表示名・taxonomy・価格・sauce）

- 表示名は ingredient master catalog v2 の nameJa（fromage-blanc-sauce だけ catalog にないので PR #255 の nameJa）。production の表示名は OD-W2-6。
- taxonomy は PR #255 の提案（7 topping すべて `PROPOSED / confidence high`、DH4-1 の 7 family と一致）。PR #255 の OD-TAX-7 により production 化には Human Classification Gate が必要 → OD-W2-5。sauce は DH4-1 の方針どおり family 行なし（category がそのまま attribute）。
- 価格は **既存の REC-04 tier 定義（`materialShop.ts` `MATERIAL_PRICE_TIERS`: T3 = 15–29、T4 = 30+）がそのまま適用される値**。新しい価格表は作っていない。pack 数量 = `10 × k`（k = recipe 群の最大 minCount、OD-W2-6 の authoring 値）。
- 所持（OWNED）後は在庫 0 でも FREE tray に出る（W1 と同じ）。unlock は無料で在庫を付けない（OD-REC04-2）。
- **fromage-blanc-sauce は初めての「新しい PAINT sauce」**: sauce の塗り色は `Ingredient.color` から来る（`SauceHeatmapCanvas`）ので描画はデータで足りるが、`RecipeSauceProfile.ingredientId` の型 union を広げる必要がある。白系は生地色との対比が弱いので Human Visual で確認が要る（olive-oil は PR #45 で `--oil` class が必要だった）。

## 5. Owner Decisions OD-W2-2〜9

OD-W2-1（append-only）は Owner の採用候補として扱い、§6 で機械検証した。

### OD-W2-2 追加 step の price tier と章

決める内容: step 25–31 の Shop 価格と、W2-A recipe が Pizza Select / Dex のどの章に入るか。
現行ルール: 価格 = `MATERIAL_PRICE_TIERS`（T3 15–29、T4 30+）、章 = key step の tier（`recipeChapters.ts`）。

| 選択肢 | メリット | デメリット | save 互換 | W1 への影響 |
|---|---|---|---|---|
| **(a) 現行ルールのまま**（step 25–29 = T3 100/50、30–31 = T4 120/60） | コード・定数の変更ゼロ。REC-04 が 30+ を最初から T4 として定義済み | 章が混ざる: 第2章に calabresa（9→10）、第3章が 10→15、第4章は 3 recipe だけ（vongole, ratatouille, pesto-vegetariana） | 影響なし | なし |
| (b) tier 境界を「W1 = 1–24、Wave 2 = 25+」に変える（T4 = 25+） | Wave 2 が第4章にまとまる（calabresa は key step 12 なので第2章のまま） | `MATERIAL_PRICE_TIERS` の変更（REC-04 authority の改訂）。step 25–29 が 100 → 120 Pitz | 影響なし（価格は保存されない） | W1 の価格・章は不変（step ≤24 は同じ tier） |
| (c) wave ごとの章（recipe に wave を持たせる） | 見た目上いちばん分かりやすい | 章が ladder から独立した新しい authority になる（OD-DISC-9 の「章は ladder 由来だけ」に反する） | 影響なし | Pizza Select / Dex の章ロジック変更 |

**推奨: (a)**。既存 authority だけで決まり、変更点がない。第3章 15 枚は Pizza Select pager（UX-4）の範囲内。Wave 2 を「新しい章」として見せたいなら (b)。

### OD-W2-3 Wave の選択

決める内容: Wave 2 の実装対象。

| 選択肢 | メリット | デメリット | save 互換 | W1 への影響 |
|---|---|---|---|---|
| **(a) W2-A のみ（9 recipe）** | 新 mechanic なし、W1 と同じ pipeline、最短で遊べる | 遊び方の種類は増えない（白ベースと CUT なし 2 枚が新しい程度） | 追加のみ | なし（append-only） |
| (b) W2-A + 後続 W2-C → W2-D | 量を先に出し、体験の種類は mechanic slice ごとに足す | 合計スケジュールは長い。W2-C/W2-D はそれぞれ独立 slice（§11, §12） | 追加のみ | なし |
| (c) W2-E（sampler）など mechanic 同時投入 | 1 wave で体験が最も増える | mechanic 4 本、HV 負荷最大 | 同上 | なし |

**推奨: (b)**（= Owner 方針どおり W2-A 先行、次に W2-C、その次に W2-D）。

### OD-W2-4 dough evidence が無い recipe の CUT

決める内容: vongole と flammkuchen（dough evidence なし）に CUT を付けるか。

| 選択肢 | メリット | デメリット | save 互換 | W1 への影響 |
|---|---|---|---|---|
| **(a) New Haven の前例を維持（CUT なし）** | evidence 規律と一貫。CUT なしの一枚が増えて変化になる | 同じ丸いピザなのに切らない理由が player には見えない | なし | なし |
| (b) 丸生地なら CUT を付ける | CUT 体験が揃う | 「evidence がないものはデフォルトで埋めない」原則（REC-02 Q3）を曲げる。New Haven との不整合 | なし | New Haven も揃えるなら W1 の変更 |

**推奨: (a)**。W2-A は CUT なし 2 / あり 7 になる。

### OD-W2-5 新 topping 7 種の taxonomy 行

決める内容: `ingredientTaxonomy.ts` に追加する family（arugula/bell-pepper/zucchini = vegetable、chicken/prosciutto-crudo = meat、shrimp = seafood、parsley = herb）。

| 選択肢 | メリット | デメリット | save 互換 | W1 への影響 |
|---|---|---|---|---|
| **(a) この 7 行だけを scoped Human Classification Gate で確定** | W2-A に必要な分だけ。PR #255 で全部 high confidence・DH4-1 と矛盾なし | 172 全体の gate とは別に 1 回判断が要る | なし（taxonomy は保存しない） | なし。family サイズが増えるだけ（vegetable 11、meat 6、seafood 4、herb 5）で k≥2 は強くなる |
| (b) 172 全体の Human Classification Gate を待つ | 一度で済む | W2-A の開始が PR #255 の後続に依存 | なし | なし |
| (c) 行を付けずに出す | 待たない | その材料の特徴ヒントが category レベルに落ちる（DH4 の質が下がる） | なし | なし |

**推奨: (a)**。

### OD-W2-6 authoring 値（nameJa・description・minCount・bakeTarget・reference 配置・材料 visual）

決める内容: 9 recipe と 8 材料の production 値。W1 では #221 の authoring + REC-01〜03 + I5a の専用 visual で決めた。

| 選択肢 | メリット | デメリット | save 互換 | W1 への影響 |
|---|---|---|---|---|
| **(a) W1 と同じ authoring gate（値の表 + Human Visual）を W2-A 専用に 1 回** | 実績のある流れ。★ 較正と RT-01 配置を一度に確認できる | 1 slice 余分にかかる | なし | なし |
| (b) W1 の類似 recipe から機械的に写す（§2.2 の analog） | 速い | 味の違う料理で数が同じになる、visual は結局必要 | なし | なし |

**推奨: (a)**。新しい材料 visual が 8 つ（W1 は 7）。minCount は RT-01 Candidate B の容量内に収める（現行最大は 10 piece）。

### OD-W2-7 naming と evidence の review 項目

決める内容: §2.2 の unresolved の扱い。

| 項目 | 選択肢 | 推奨 |
|---|---|---|
| brazilian-calabresa: オリーブ → black-olive は likely alias、Calabresa naming cluster | (a) black-olive で確定 / (b) 別 recipe に差し替え | (a)。W1 の black-olive 表現と同じ |
| vongole: family が「ノンソース」なのに olive-oil が spread | (a) fugazza / New Haven と同じ PAINT_TEMPORARY の塗り（Phase-1 FULL）/ (b) drizzle と読んで W2-D へ移す | (a)。(b) なら W2-A は 8 recipe、parsley は他の W2-A recipe が使わないので新材料 7 |
| prosciutto-funghi: catalog の prosciutto-e-funghi と同じ材料集合、runtime funghi と 1 材料差 | (a) id `prosciutto-funghi` で採用 / (b) catalog id に合わせる / (c) 外す | (a)。catalog 側は runtime ではない |
| jamon-serrano: pinsa-romana（P0-COLL-4）を将来 DOUGH_VARIANT 必須にする | (a) 採用して予約を記録 / (b) rucola-e-grana に差し替え（grana-padano が増える） | (a) |
| prosciutto-crudo / arugula を焼く前にのせる（catalog は焼成後 tag） | (a) 焼く前（required evidence なし、OD-TAX-6: timing は identity ではない）/ (b) FINISH ができるまで保留 | (a) |

save 互換・W1: どれも影響なし。

### OD-W2-8 sauce-less scoring 方針（W2-C 用。W2-A では不要）

決める内容: sauce のない recipe の Scoring 2.0（§11）。

| 選択肢 | メリット | デメリット | save 互換 | W1 への影響 |
|---|---|---|---|---|
| **(a) Sauce 52 を他 component に比例配分**（Pieces/Recipe/Bake = 16:12:20 → 33.3:25:41.7） | 既存 weight の比率を保つ。sauce ありの recipe は完全に不変 | sauce なし recipe だけ Bake の比重が大きい | Dex BEST は保存値なので影響なし | なし（sauce ありは byte 同一） |
| (b) sauce なしを「正しく何も塗らなかった」= Sauce 満点 | 実装が小さい | ★が出やすすぎる（52 点が無条件） | なし | なし |
| (c) sauce component の代わりに「cheese coverage」など新 component | 意味が一番正しい | 新しい評価軸の設計・較正が要る | なし | なし |

**推奨: (a)**。W2-A の判定には関係しないので、W2-C の mechanic slice で改めて決める。

### OD-W2-9 multi-spread の 2 層目 gesture（W2-D 用。W2-A では不要）

| 選択肢 | メリット | デメリット | save 互換 | W1 への影響 |
|---|---|---|---|---|
| **(a) 既存 PAINT を 2 回（base → 上がけ）** | 既存 dispense controller を再利用 | 「かける」感じは弱い | round state のみ（PizzaState は保存されない） | 既存 recipe は 1 層のまま |
| (b) 新 DRIZZLE（線を引く gesture） | 見た目・操作とも新しい | gesture・評価・HV を新規に作る | 同上 | なし |

**推奨: (a) で導入、DRIZZLE は後続**。W2-D の slice で決める。

## 6. OD-W2-1 append-only の機械検証

方法: `src/data/discoveryLadder.ts` の `W1_25_DISCOVERY_LADDER` を parse し、W2-A の材料だけに REC-04 key-recipe rule
（`buildKeyRecipeLadder` の Python mirror）を適用して step 25 以降に append した。

| check | 結果 |
|---|---|
| L-1 parse した W1 ladder = runtime 25 への REC-04 rule（本番 test と同じ前提） | ✓ |
| **L-2 W1 step 1〜24 が完全一致** | ✓ |
| **L-3 Wave 2 の材料は 25 以降だけ、W1 材料は移動しない** | ✓（25–31、7 step・8 材料） |
| **L-4 既存 save の次 unlock が変わらない**（発見数 0〜25 の全 save） | ✓（0〜23 は同じ step、24 以上は新しい step 25/26） |
| **L-5 ingredient unlock collision**（同じ材料が 2 step / starter の再 unlock） | 0 |
| **L-6 deadlock**（どの発見順でも: 発見数 c のとき作れる recipe ≥ c + 1） | 0（slack は全域で ≥ 1、最後だけ 0） |
| **L-7 unreachable recipe** | 0（34 / 34） |
| **D-1 recipe discovery collision**（§7） | 0 |

負の検証: append の代わりに全体再生成を入れると L-3・L-5 が失敗し deadlock 8 を検出する（tool で確認）。

#### 既存 save の次 unlock（発見数ごと）

| 発見数 | W1 の次 step | W1+W2-A の次 step | その step の材料 | 変化なし |
|---|---|---|---|---|
| 0 | 1 | 1 | egg | ✓ |
| 1 | 2 | 2 | bacon | ✓ |
| 2 | 3 | 3 | mushroom | ✓ |
| 3 | 4 | 4 | eggplant | ✓ |
| 4 | 5 | 5 | parmigiano | ✓ |
| 5 | 6 | 6 | pepperoni | ✓ |
| 6 | 7 | 7 | sausage | ✓ |
| 7 | 8 | 8 | ham | ✓ |
| 8 | 9 | 9 | corn | ✓ |
| 9 | 10 | 10 | pineapple | ✓ |
| 10 | 11 | 11 | black-olive, oregano | ✓ |
| 11 | 12 | 12 | onion | ✓ |
| 12 | 13 | 13 | olive-oil | ✓ |
| 13 | 14 | 14 | garlic | ✓ |
| 14 | 15 | 15 | anchovy | ✓ |
| 15 | 16 | 16 | tuna | ✓ |
| 16 | 17 | 17 | pesto | ✓ |
| 17 | 18 | 18 | cherry-tomato | ✓ |
| 18 | 19 | 19 | clam | ✓ |
| 19 | 20 | 20 | fresh-tomato | ✓ |
| 20 | 21 | 21 | potato | ✓ |
| 21 | 22 | 22 | rosemary | ✓ |
| 22 | 23 | 23 | capers | ✓ |
| 23 | 24 | 24 | fontina, gorgonzola | ✓ |
| 24 | —（完了） | 25 | prosciutto-crudo | ✓ |
| 25 | —（完了） | 26 | fromage-blanc-sauce | ✓ |

#### ladder（step 23 以降、append 後）

| step | 材料 | key recipe |
|---|---|---|
| 23 | capers | puttanesca-pizza |
| 24 | fontina, gorgonzola | quattro-formaggi |
| 25 | prosciutto-crudo | prosciutto-funghi |
| 26 | fromage-blanc-sauce | flammkuchen |
| 27 | arugula | jamon-serrano-pizza |
| 28 | shrimp | pesto-gamberi |
| 29 | chicken | pesto-pollo |
| 30 | parsley | vongole |
| 31 | bell-pepper, zucchini | pesto-vegetariana |


注意点（検証で分かったこと）:
- 発見数 25（W1 完了）の save は、W2-A 公開後の最初の load で step 25（生ハム）が即解放される（`resolveShopEntitlement` は発見数から導くので save 変更不要）。
- **brazilian-calabresa は自前の step を持たない**（W1 の材料だけで作れる、key は step 12 = onion）。W1 途中の player がこれを先に発見すると発見数が 1 増え、**W1 の step 順は同じまま、各 step に 1 発見早く到達する**。これは「並べ替え」ではないが pacing の変化なので Owner に明示しておく。
- 実装時の contract 変更: 現行 `discoveryLadder.test.ts` は「`DISCOVERY_LADDER` = rule(RECIPES 全体)」を pin している。append-only ではこれを「W1 prefix（固定 fixture）+ rule(delta)」に置き換える必要がある（W2-A 実装 slice の最初の作業。`populationId` は例: `w2a-34`）。

## 7. discovery matcher collision 監査（25 + 9 = 34 recipe、全 561 組）

距離は `nearMiss.ts` と同じ定義（不足 + 余分の非 sauce 材料数 + sauce base が違えば 1）。dimension はすべて default。

| 距離 | W1 25 だけ（前） | 34（後） | 意味 |
|---|---|---|---|
| d = 0（完全一致 = matcher collision） | 0 | **0** | AMBIGUOUS は発生しない |
| d = 1 | 3 | 4 | near-miss ADD_ONE / REMOVE_ONE が 2 recipe に向き得る組 |
| d = 2 | 13 | 16 | CLOSE |

#### d = 1 の組（34 recipe 全組み合わせ）

- bismarck ↔ breakfast-pizza（差: bacon）
- funghi ↔ prosciutto-funghi（差: prosciutto-crudo）  ← Wave 2 を含む
- margherita ↔ melanzane-pizza（差: eggplant）
- melanzane-pizza ↔ parmigiana-pizza（差: parmigiano）

新しい d = 1 は **funghi ↔ prosciutto-funghi** の 1 組だけ（W1 にも margherita ↔ melanzane などの前例がある）。near-miss は発見可能な recipe だけを候補にして同距離なら hint-target 順で決まるので、誤判定ではなく「どちらに近いか」の表示差だけ。
部分集合の関係（例: funghi ⊂ prosciutto-funghi）は matcher 上 collision ではない（exact match only）。

## 8. W2-A 追加後の監査

| 観点 | 今（main） | W2-A 後 | 所見 |
|---|---|---|---|
| recipe 数 | 25 | **34** | `RECIPES` は `as const` 配列、`RecipeId` は自動で広がる。`RECIPE_DISCOVERY_TARGET_IDS` / `RECIPE_SAUCE_PROFILES` は `Record<RecipeId>` なので追加漏れは型エラーで検出 |
| ingredient 数 | 29（sauce 3 / cheese 4 / topping 22） | **37**（sauce 4 / cheese 4 / topping 29） | cheese は増えない |
| Dex progression | 24 step、Dex pill `n/25` | 31 step、`n/34` | 章: 第1章 6 / 第2章 9→10 / 第3章 10→15 / 第4章 0→3（OD-W2-2 (a) の場合） |
| Shop | NEW 行は ladder から | step 25–31 で 8 行が順に NEW | 価格は既存 tier（T3/T4）。restock は同じ |
| Hint（H3 / DH4 / near-miss） | — | hint の key 材料は `recipeKeyStep` から自動（calabresa = onion） | 新 topping 7 種は family 行がないと特徴ヒントが category に落ちる（OD-W2-5）。family サイズは増えるので k≥2 guard は緩まない |
| Lunch Rush | pool = 発見済み ∩ 在庫あり | W2-A も発見後に pool に入る | 注文の混ざり方が変わる。ランキングの比較可能性は Issue #224（ruleset 付き ranking）の論点。W2-A 側で pool を絞る必要はない |
| Dinner | mission は W1 recipe だけ（`w1-25`） | 定義は不変 | W2-A 材料が tray に増える（§9）。Dinner 中に W2-A を作れば target 外 recipe として判定。collision 0 で AMBIGUOUS なし |
| save compatibility | schemaVersion 2 | **変更なし** | Dex / 所持 / 在庫 / Shop ledger はすべて id の追加だけ。旧 build が新 save を開いても未知 id は P3-4B の forward-compat extras で保持される。ladder は発見数から導く（保存しない）ので append は save migration 不要 |
| mobile ingredient UI | §9 | §9 | |
| e2e | `/25` 固定 7 spec、LC-5 `toHaveCount(25)` | `/34` へ更新が必要 | 実装 slice の作業（今回は触らない） |

## 9. ingredient tray / category UI（390×844 / 360×800）

tray の構造（コードで確認）: 1 ページ `MAX_INGREDIENT_PALETTE_SLOTS = 6`、3 列 × 最大 2 行、category ごとにページ送り（`◀ n/N ▶`）。
DM-3R-0 の PREPARE dock は「このラウンドで最も高い step の行数 + pager 行」を最初に確保するので、**材料数が増えても dock の高さは 2 行 + pager 行を超えない**。

| category | 今（全所持） | W2-A 後（全所持） | FREE / Dinner のページ数 |
|---|---|---|---|
| sauce | 3 | 4 | 1 → 1 |
| cheese | 4 | 4 | 1 → 1 |
| topping | 22 | 29 | **4 → 5** |

- **guided（recipe 指定）ラウンド**: W2-A の 1 category あたり最大 4 材料 → 常に 1 ページ。W1 と同じ。
- **FREE / Dinner**: topping が 5 ページになる。**レイアウトは壊れない**（dock の高さは既に「2 行 + pager」で、I5b-5 Layout Contract が 22 topping・4 ページを 7 profile で PASS 済み。W2-A はページが 1 枚増えるだけで高さ・幅は同じ）。
- ただし **操作性は悪化する**: 新しい材料は `INGREDIENTS` の末尾に並ぶので 5 ページ目に集まり、新材料を試すのに 4 回ページ送りが要る。Dinner は時間制限つきなので影響が大きい。
- 既存の `TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md` の scale gate は「topping 16–40 → Recommended-first（案3）が必要」としており、**topping 22 の今すでにその帯に入っている**。W2-A は新しい問題を作るのではなく、既存の未着手項目を 1 ページ分重くする。

**結論: W2-A は tray の破綻を起こさない（Layout Contract の範囲内）。Large Catalog UX（Recommended-first / 新着材料の先頭表示）は W2-A の blocker ではないが、Wave 3（topping 30 超）より前に必要。** W2-A 実装時は Layout Contract（LC-1 FREE の 5 ページ、LC Dinner）を 390×844 / 360×800 で再実行すること。Owner に判断してほしい小項目: 新材料を tray の先頭側に並べるか（データ順の変更だけで済む。OD-W2-6 に含める）。

## 10. 既存 `tools/progression2_mechanic_matrix.py --check` の失敗（Wave 2 とは別の既存 drift）

fresh 確認（clean な `origin/main` `51e0923` の worktree で実行）:

- `progression2_mechanic_matrix.py --check` → **失敗**（committed JSON が再生成と違う）。
- 差分の中身を全 key で比較した: `rows[].ingredients.newContentIngredientIds` 45 か所、`shippedRecipeIdsInSrc` 1、`summary.ingredientIdsNotYetInShippedGame`（148 → 141）1。**分類（representability・status・capability・blocker）は 1 つも変わらない。**
- 原因: tool が `src/data/recipes.ts` / `ingredients.ts` を実行時に読み、「まだ出荷していない材料」を計算している。W1（I5b-3）で recipe 15 → 25、材料 22 → 29 になった時点から drift している。
- 同じ種類の drift が **`progression2_phase2_progression.py --check`** にもある: W1 の 10 recipe が `shipped:<id>` と PIZZA DB 行の両方として出て「runtime signature collision」を 10 件報告し、JSON / MD も再生成と違う。これも src を読むことによる false positive。
- その他の既存 tool（phase34_unlocks、validate_recipe_catalog、recipe_row_ingest、evidence_invariants、full172_deadlock_analysis、canonicalizer）は PASS。
- CI には組み込まれていない（`.github` に参照なし）。

**判断: Wave 2 とは別の既存 drift。W2-A 実装には混ぜない。** Wave 2 の tool（`progression2_wave2_candidates.py` / `_w2a_gate.py`）は src から parse した値を検証に使うが、出力が src に依存することは `inputHashes` で明示している。

duplicate gate: issue 検索（mechanic matrix / --check / drift）で該当は closed の #188（元の作業）だけ。**Issue は作成していない。** 案:

> **Title:** Progression 2.0 design tools drift from `src` after W1: `progression2_mechanic_matrix.py --check` / `progression2_phase2_progression.py --check` fail on clean main
>
> **Body:** 両 tool は committed JSON を再生成と比べるが、`src/data/recipes.ts` / `ingredients.ts` を実行時に読むため、W1 I5b-3（15 → 25 recipe）以降 clean main で `--check` が失敗する。mechanic matrix の差分は `newContentIngredientIds` / `shippedRecipeIdsInSrc` / `ingredientIdsNotYetInShippedGame` だけで分類は不変。phase2 は W1 10 recipe が `shipped:<id>` と PIZZA DB 行の両方になり collision を 10 件誤報する。
> **選択肢:** (a) 設計時点の src snapshot（shipped 15）を入力として固定する / (b) PIZZA DB evidence id を持つ runtime recipe を「corroborated row」として扱い、src 由来 field を別 section に分離する / (c) 再生成して committed を更新（Wave ごとに再発）。
> **Scope:** tools + docs/design data のみ。src / e2e 変更なし。Wave 2 実装とは別 PR。

## 11. W2-C No-sauce — 独立 mechanic slice「sauce-less scoring」の範囲（実装しない）

今でも動くもの: `deriveCoreSteps` は sauce 材料が無ければ SAUCE tab を出さない。FREE の完成条件は「sauce か piece があれば良い」。matcher は `sauceBase = []` 同士を一致として扱える。near-miss の sauce 項も空配列で動く。

変更が要る箇所（コードで確認）:

| 層 | 箇所 | 今の前提 | 必要な変更 |
|---|---|---|---|
| data | `recipeSauceProfiles.ts` | `Record<RecipeId, RecipeSauceProfile>`、全 recipe に sauce | sauce なしを表せる型（profile optional か `ingredientId: null`） |
| reference | `referencePizza.ts` `ReferencePizza.sauce`（必須）、`computeMechanicalSauceReference` | 必ず 1 sauce | `sauce` を optional に。preview（`ReferencePreview` / `ReferenceThumbnail` / `PlayerReferencePreview` / `DinnerGameUi`）は sauce 無しの描画 |
| scoring | `scoringV2/index.ts`（Sauce 52）、`sauceComponent.ts` | sauce 0 ならほぼ 0 点 | OD-W2-8 の配分。`toLegacyScoreBreakdown` と RESULT の「ソース」行（A1 で追加）の非表示 |
| completion | `completionGate.ts` `checkSauceQuantity`（`reference.sauce`） | sauce 必須の recipe だけ判定 | reference に sauce がなければ skip |
| UI | `GameScreen.tsx` の reference sauce 表示、`PizzaStage.tsx` `sauceIds[0]` | sauce 前提の表示 | 空の場合の表示確認（HV） |
| discovery | FREE で sauce を塗らなかった一枚 | 今は必ず「不一致」 | 初めて discovery になり得る。near-miss 文言（SAUCE_ONLY）と Hint の確認 |
| tests | Golden Matrix（`scoringV2.test.ts`）、completion gate、reference parity | 全 recipe に sauce | sauce なしの fixture 追加 |

Scoring 2.0 authority の変更になる（A1 以降の authority）ので、**単独 slice + Human Verification** が必要。sauce ありの recipe の点数は byte 同一であることを regression で固定する。
これが入ると C 分類の no-sauce 19 行が開く（Aussie と Chilean Napolitana は新材料ゼロ）。

## 12. W2-D Drizzle — 独立 mechanic slice「multi-spread」の範囲（実装しない）

今の前提（コードで確認）: `COMMIT_SAUCE_DISPENSE` は別の sauce を塗ると **置き換える**（`sauceIds: [id]`、deposit をリセット）。`SauceDeposit` は `{x, y, amount}` で sauce id を持たない。

| 層 | 箇所 | 必要な変更 |
|---|---|---|
| state | `PizzaState.sauceIds` / `sauceDeposits`、reducer `COMMIT_SAUCE_DISPENSE` | 層ごとの deposit（layer = sauce id + deposits）。置き換えではなく追加。stock 消費は層ごと |
| data | `RecipeSauceProfile` | 1 profile → 順序つき layer list（base / drizzle）。olive-oil の `PAINT_TEMPORARY` TODO（DRIZZLE candidate）をここで解消 |
| identity | matcher `sauceBase`、signature `spreadLayers`（今は FIXED_BY_FLOW） | spreadLayers を OBSERVED に。Phase-2 の identity 次元に既にある |
| scoring | Sauce component | base 層だけを今の評価、drizzle 層は量/分布の別評価（OD-W2-9） |
| completion | `checkSauceQuantity` | 層ごとの最低量 |
| render | `SauceHeatmapCanvas`（1 色）、oil の `--oil` class | 2 枚重ね |
| UI | SAUCE step | 層の切り替え（base → 上がけ）。gesture は OD-W2-9 |
| save | PizzaState は round state（保存されない） | save 変更なし |

W2-C より変更範囲が広い（state・identity・render に及ぶ）。W2-C を先にする Owner 方針は妥当。

## 13. 判定

**A. W2-A READY FOR OWNER FINAL DECISIONS**

根拠:
- 最新 main（`51e0923`）で Wave 2 の入力に変更はなく、前回設計の分類・評価は byte 一致（§1）。
- append-only（OD-W2-1）は全 check PASS: W1 step 1〜24 完全一致、既存 save の次 unlock 不変、Wave 2 は 25–31 だけ、deadlock 0、unreachable 0、unlock collision 0（§6）。
- 34 recipe・561 組で matcher collision 0（§7）。
- tray は Layout Contract の範囲内で壊れない。Large Catalog UX は W2-A の blocker ではない（§9）。
- 新 mechanic は不要。W2-A で新しい型の作業は fromage-blanc の sauce 型 union 拡張と、ladder test の pin を「W1 prefix + delta」に変える contract 変更の 2 点だけ（どちらも実装 slice の範囲）。

B（設計の修正が必要）にしなかった理由: 見つかった論点（vongole の「ノンソース」読み、calabresa による pacing の前倒し、tray 5 ページ）はどれも Owner が選べば済む項目で、設計の作り直しは要らない。
C（blocked）にしなかった理由: 未解決の evidence や mechanic 依存がない。

### Owner が確定する項目（ここで STOP）

| ID | 決める内容 | 推奨 |
|---|---|---|
| OD-W2-1 | append-only ladder | 採用（検証済み） |
| OD-W2-2 | 価格 tier / 章 | (a) 現行ルールのまま |
| OD-W2-3 | Wave 構成 | W2-A → W2-C → W2-D |
| OD-W2-4 | dough evidence なしの CUT | (a) CUT なしを維持（vongole, flammkuchen） |
| OD-W2-5 | 新 topping 7 種の taxonomy | (a) 7 行だけ scoped 確定 |
| OD-W2-6 | authoring 値・visual・tray 並び順 | (a) W2-A 専用の authoring gate |
| OD-W2-7 | naming / evidence review 5 項目 | 各 (a) |
| OD-W2-8 / 9 | W2-C / W2-D 用 | W2-A には不要。各 mechanic slice で決める |
| 別件 | tool drift の follow-up Issue（§10） | 作成するかどうか（Wave 2 とは別） |

## 14. 再現

```
$ python3 tools/progression2_wave2_w2a_gate.py --check
W2-A gate: all checks passed; JSON byte-identical.
$ python3 tools/progression2_wave2_candidates.py --check
Wave 2 candidates: all validations passed; JSON byte-identical.
```
