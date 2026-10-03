# TETO Post-Production27 / 53 Recipe Scale — Fresh Audit

**監査・設計専用（docs / data / audit tool のみ）。** runtime（`src/**`）・save・schema・CSS・テスト・e2e は変更していない。
PR #376 / #377 / #378 / #360 には触れていない（#378 は Issue 本文と、その根拠である
`origin/claude/prod27-deadlock-audit-r8igs6` の監査文書を **読んだだけ**）。実装 PR は作らない。
Human Verification: **N/A**（UI / UX / gameplay 変更なし。`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` の適用対象外）。

| 成果物 | パス |
|---|---|
| 本書 | `docs/reports/TETO_POST-PROD27_53-RECIPE-SCALE_Fresh-Audit.md` |
| machine-readable companion | `docs/reports/data/TETO_POST-PROD27_53-RECIPE-SCALE_Fresh-Audit.json` |
| 生成 / 再現ツール（audit tool、`--check` あり） | `tools/post_prod27_53_scale_audit.py` |

---

## 0. 結論（先に読む）

1. **「27 → 53」は 53 の定義から再確認が必要。** 53 件は `data/recipes/pizza_master_catalog.json`（2026-09-19 凍結の research artifact, OD-T8）の候補数で、
   **そのうち 16 件はすでに Production にある**。Production にある 27 のうち 11 は 53 の catalog に存在しない（172 matrix 由来）。
   fresh 再計算では **union = 64 recipe / 65 ingredient**、Production に対する **新規 = 37 recipe（rejected_duplicate 2・deferred 5 を除くと 30） / 35 ingredient**。
   「53 recipe 到達」は **+26 recipe**、ingredient は **56〜65**（62 ではない）。
2. **+26 は現 engine だけでは作れない。** 現 engine（4 工程 + CUT、sauce は 1 種、ingredient set 一致 + 既定 dimension で発見）のまま出せる新 recipe は **9 件**
   （source 衝突のないものは **5 件**）。残り 17 件の不足は、後乗せ（FINISH）・新 sauce・second sauce・no-sauce・pan / 形・identity 衝突の解消が前提（§7, §9）。
3. **taxonomy は 22 具材の family が Owner 確定済み（未解決 family = 0）で、新 family id は不要。** 一方 **sauce 7 / cheese 6 の role は未確認（13、うち mascarpone は OD-T4 deferred）**、
   さらに「後乗せ sauce」（mayo / honey / chili-oil / buffalo / teriyaki）と spread 置きの `nduja` は **role と使い方が衝突**する（6）。
4. **進行（ladder / Shop / Research / Contract 2.1 / Hint / Dex）は、現 engine で作れる recipe に限れば全段階で到達可能。** 現 engine で作れない recipe を ladder 母集団に入れると
   **HARD DEADLOCK が生じる**（second sauce は物理的に置けない、identity 衝突は matcher が `AMBIGUOUS` にして既存 recipe（margherita / salsiccia / pepperoni）まで壊す）。
   #378（owned だが在庫 0 の Research Entry）は拡張で **薄まらず増幅**される（全材料 refill 1,150 → 1,520〜3,210 Pitz）。
5. **HAND 12 は実用上成立する**（sauce / cheese は 10 件で hand 非活性、具材は 45 件中 33 件が hand 外だが pantry 検索・family chip・pin で到達可能）。
   ただし **Dinner / Lunch Rush は paged tray のまま**で、具材 45 件では 8 ページになる（§6）。容量 12 は変更しない。
6. **推奨 first vertical slice = `artichoke` + `ai-carciofi`（ladder step 26、新 Cooking Step なし）**。新 Cooking Step の検証は次 slice
   （`quattro-stagioni` = zone、または `bbq-chicken` = FINISH）。source 権威付きの代替（53 の外）として `pesto-gamberi` も提示する（§8）。
7. **READY FOR 53 IMPLEMENTATION: NO**（ただし first vertical slice への着手可否は §6 の Owner Decision 次第。53 一括は NO）。

---

## 1. 監査基準 / 前提

| 項目 | 値 |
|---|---|
| audited main SHA | **`b8617ac0218bf20eb53f68ed12dea09db20e3fa8`**（`origin/main`、`LC-R6-e: Production Hand activation (formal capacity 12) (#376)`。fresh fetch、作業ブランチは同 SHA から作成） |
| 作業ブランチ | `claude/teto-pizza-recipe-scale-audit-e0kku1` |
| 注意（docs 乖離） | `docs/PROJECT_HANDOFF.md` 末尾の addendum は #376 を「pending Owner approval / not merged」と記すが、main の HEAD は #376 の merge commit。**本監査は記述を修正していない**（docs sync は別作業） |
| 読んだ authority | `docs/PROJECT_HANDOFF.md`、`CLAUDE.md`、`docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`、`docs/reports/TETO_INGREDIENT-TAXONOMY_x_CATALOG-SELECTION_Fresh-Audit.md`（§16 S-0）、`TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.md/.json`、`TETO_DISCOVERY-3_NO27_PESTO-POLLO_VERTICAL-SLICE_Result.md`、`docs/design/TETO_COOKING-TECHNIQUES_1.0_*`、`TETO_RECIPE-COOKING-STEPS_1.0.md`、`TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`、`data/recipes/*.json`、`src/data/{recipes,ingredients,ingredientTaxonomy,discoveryLadder,discoveryCatalog,recipeHintRoles,recipeSauceProfiles,cookingProfiles}.ts`、`src/logic/{discoveryLadder,materialShop}.ts`、`src/logic/discovery/{matcher,signature,researchEntry,researchResultFeedback}.ts`、`src/logic/catalog/{handPolicy,workingSet}.ts`、`src/state/{materialEntitlement,recipeChapters,persistence}.ts` |
| 読んだ（main 外、read-only） | Issue #378 本文、`claude/prod27-deadlock-audit-r8igs6` の `TETO_PROD27-DEADLOCK_Fresh-Audit.md`、PR #295 の `TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`（**未 merge の設計。authority 扱いしない**） |
| Duplicate Gate | open PR 18 件を確認。同 scope の実装 / 監査なし。近い docs-only PR は #295（Post-W1 Cooking Steps 設計）、#296 / #293 / #255（taxonomy / HCG、いずれも「PROPOSED / not authority」）。本書はこれらを変更・supersede しない |
| 方法 | `node_modules` が無いため **静的 parse + Python 再実装**。ladder 規則は `discoveryLadderRule.ts` の port で、**Production の ladder 25 step を完全に再現**（append-only 規則が step 25 = chicken / pesto-pollo を導出）し、**全 25 step で pool = 1** という既存監査（#378）の結果も再現できることを確認してから scenario を回している |
| 命名 | 「ソース / チーズ / 具材」は player-facing category。`topping` は内部 role id。**「トッピング」は置換していない**（OD-1b: 既存の操作 / 配置文言・`キートッピング` 等は本書でも対象外）。既存コピーを引用する箇所のみ原文のまま |

---

## 2. Production 現状（監査時点の事実）

| 項目 | 値 |
|---|---|
| recipe | **27**（ladder credit 26 = `brazilian-calabresa` のみ `ladderCredit:false`、Lunch Rush 参加 25 = calabresa / pesto-pollo は `lunchRush:false`） |
| ingredient | **30** = sauce 3 / cheese 4 / topping(具材) 23（starter 3: `tomato-sauce` / `mozzarella` / `basil`、finite 27） |
| taxonomy | family 7 / 23 rows、shelf 9、30 / 30 classified、未分類 0 |
| ladder | 25 step（W1 凍結 24 + step 25 = `chicken`/`pesto-pollo`）。T1 1–5 / T2 6–14 / T3 15–29 / T4 30+。chapter 6 / 10 / 11 |
| sauce 構成 | 全 27 recipe がちょうど 1 sauce（no-sauce 0、second sauce 0）。no-cheese は 6 |
| 全材料 refill（既定価格） | 1,150 Pitz（27 finite） |
| hand | 容量 **12**（OD-5）、`HAND_ENFORCEMENT_PRODUCTION = true`。具材は ladder step **12** で owned > 12 となり hand 活性 |
| Contract 2.1 | Production ON（#366）。K = 3、sauce / cheese は全件、Notebook ≤ 200 字 |

ソース hash（再現性）は JSON `production.sourceHashes`。

---

## 3. 53-recipe candidate population（fresh 再計算）

### 3.1 数値の訂正

| 項目 | 旧（catalog header / 旧監査） | **fresh 再計算** |
|---|---:|---:|
| 候補 recipe | 53（viable 51、rejected 2） | 53（同じ。凍結 artifact） |
| Production と id 重複 | （7 recipe 時代の値） | **16**（composition 差分 0） |
| Production にあるが catalog に無い recipe | — | **11**（`bambino` `brazilian-calabresa` `melanzane-pizza` `new-haven-apizza` `parmigiana-pizza` `pesto-caprese` `pesto-patate` `pesto-pollo` `pesto-tonno` `pizza-portuguesa` `puttanesca-pizza`） |
| 新規 recipe（Production 比） | 26（= 53 − 27 と誤読しやすい） | **37**（rejected_duplicate 2 除く **35**、deferred 5 も除く **30**、ingredient を持たない placeholder 1 を除く 29） |
| union recipe | — | **64**（ingredient を持たない `mezza-e-mezza` を除く 63 を sim 母集団にした） |
| 「53 到達」に必要な追加 | — | **+26**（live 29 件から 26 件を選ぶ） |
| 候補 ingredient | 62（existing 22 / new 40） | 62 + Production だけにある 3（`capers` `clam` `fresh-tomato`）= **union 65** |
| 現 30 ingredient との重複 | 22 | **27**（catalog 側 62 のうち 27 が Production にある） |
| 新規 ingredient | 40 | **35** = sauce 7 / cheese 6 / topping(具材) 22 |
| 53 recipe 到達時の ingredient 総数 | 62 | **56〜65**（26 recipe の選び方で新規 26〜35。最小構成は `speck-e-brie` `nutella-dessert` `honey-fig` を除く案） |

新規 recipe 37 の内訳（catalog status）: `game_design_candidate` 12 / `verification_pending` 18 / `deferred` 5 / `rejected_duplicate` 2。

### 3.2 stale / duplicate / alias

| 種別 | 内容 |
|---|---|
| **stale（catalog 側）** | `existingInGame:false` のまま Production 入りした 5 材料（`chicken` `corn` `eggplant` `pineapple` `potato`）。header の 62 / 22 / 40 は古い。`hawaiian` は `gameDesignStatus:candidate` のまま Production 済み。Production にだけある recipe 11 / ingredient 3。`eggplant` の表示名 catalog「なす」≠ Production「ナス」 |
| **identity 衝突（既存 recipe を含む）** | 下表。matcher は **ingredient set（base sauce 込み）+ 既定 dimension の完全一致**で発見する。`RUNTIME_SUPPORTED_CAPABILITIES = []` かつ全 dimension が `FIXED_BY_FLOW` / `UNAVAILABLE` なので、**同じ set の recipe を 2 つ ELIGIBLE にすると両方 `AMBIGUOUS`（発見不能）**になる（`matcher.ts` rule 4 / `matchDiscovery`） |
| **duplicate（catalog 自身）** | `contadina`（= salsiccia + ortolana、rejected）、`bufalina`（= margherita、rejected）。いずれも catalog が既に除外 |
| **naming cluster** | `pizza-bianca` / `ricotta-bianca` / `bianca-pizzadb-row`、`napoletana` 系 3、`siciliana` 系 3、`calabrese`（catalog）≠ `brazilian-calabresa`（Production, 別 target）、`frutti-di-mare` / `pescatore`、`chicago-deep-dish` / `chicago-stuffed`（172 matrix `namingClusterLedger`） |
| **alias / 近似 id** | `spicy-salami`↔`pepperoni`、`wurstel`↔`sausage`、`steak`、`prosciutto-crudo`↔`ham`、`speck`、`bell-pepper`↔`pepperoni`（検索誤認）、`cilantro`（コリアンダー）、`porcini`↔`mushroom`、`french-fries`↔`potato`。OD-T1/T2 で **独立 id** 確定済み（alias 化しない） |
| **source 衝突** | 新規 37 のうち 172 matrix の PIZZA DB 行と結び付くのは 21 件（残り 16 件は catalog 設計のみ）。composition が **一致するのは 3 件**（`quattro-stagioni` `bbq-chicken` `ny-style`）、**`DIVERGENT` 10 / `SUPERSET` 3 / `SUBSET` 2 / `INDETERMINATE` 3 の 18 件が catalog と食い違う**（`diavola` `frutti-di-mare` `calzone` `romana` `fugazzeta` `boscaiola` `siciliana` `alla-norma` `ai-funghi-porcini` `al-tartufo` `speck-e-brie` `buffalo-chicken` `supreme` `chicago-deep-dish` `detroit-style` `teriyaki-chicken` `nutella-dessert` `greek-style`）。**catalog の composition を source とみなせない** |

identity 衝突（default dimension で同一 signature になる組）:

| ingredient set（sauce 込み） | recipes |
|---|---|
| `basil`, `mozzarella`, `tomato-sauce` | `bufalina`, `margherita` |
| `mozzarella`, `sausage`, `tomato-sauce` | `chicago-deep-dish`, `salsiccia` |
| `mozzarella`, `pepperoni`, `tomato-sauce` | `detroit-style`, `pepperoni` |
| `mozzarella`, `tomato-sauce` | `greek-style`, `ny-style`, `stuffed-crust` |

→ `bufalina` は **starter recipe の margherita を AMBIGUOUS にする**。`chicago-deep-dish`（+ salsiccia）、`detroit-style`（+ pepperoni）も既存 Production recipe を壊す。
これらは「新 recipe を足す」問題ではなく **既存 Production の発見を壊す回帰リスク**であり、identity dimension（`pan` / `layerOrder` / `late` / `shape` …）を matcher が観測できるまで ship できない。

### 3.3 新規 recipe 37 の全件（現 engine 判定つき）

「現 engine 判定 = ready」は、ingredient set が単一の既存 sauce（tomato-sauce / olive-oil / pesto）+ 4 工程の範囲で組め、identity 衝突・second sauce・
後乗せ・新 mechanic・spread 置き具材を含まないこと（catalog の mechanics / finishing タグと 172 matrix の evidence に基づく。**推測で工程を足していない**）。

| id | catalog status | 新材料 | 現engine判定 | flags | PIZZA DB 行（関係 / 表現可否） |
|---|---|---|---|---|---|
| `ortolana` | game_design_candidate | `bell-pepper`, `zucchini` | **ready** | — | 行なし（catalog 設計のみ） |
| `prosciutto` | game_design_candidate | `arugula`, `prosciutto-crudo` | 要追加能力 | POST_BAKE_FINISH | 行なし（catalog 設計のみ） |
| `diavola` | game_design_candidate | `chili-oil`, `spicy-salami` | 要追加能力 | MULTI_SAUCE, NEW_SAUCE_ID, POST_BAKE_FINISH, SOURCE_COMPOSITION_CONFLICT | `diavola-pizza-pizzadb-p5` (INDETERMINATE_UNRESOLVED_TOKENS / FULL) |
| `frutti-di-mare` | game_design_candidate | `parsley`, `shrimp` | 要追加能力 | POST_BAKE_FINISH, SOURCE_COMPOSITION_CONFLICT | `frutti-di-mare-pizzadb-p11` (DIVERGENT / FULL) |
| `quattro-stagioni` | game_design_candidate | `artichoke` | 要追加能力 | NEW_MECHANIC:quadrantPlacement | `quattro-stagioni-pizzadb` (IDENTICAL / PARTIAL) |
| `mezza-e-mezza` | game_design_candidate | — | 要追加能力 | PLACEHOLDER_NO_INGREDIENTS, NEW_MECHANIC:halfAndHalfSplit | 行なし（catalog 設計のみ） |
| `calzone` | game_design_candidate | `ricotta` | 要追加能力 | NEW_MECHANIC:foldDough, SOURCE_COMPOSITION_CONFLICT | `calzone-pizzadb` (DIVERGENT / NOT_REPRESENTABLE) |
| `prosciutto-e-funghi` | deferred | `prosciutto-crudo` | 要追加能力 | DEFERRED, POST_BAKE_FINISH | 行なし（catalog 設計のみ） |
| `romana` | deferred | — | 要追加能力 | DEFERRED, SOURCE_COMPOSITION_CONFLICT | `pizza-romana-pizzadb-p9` (PIZZADB_SUPERSET / PARTIAL) |
| `fugazzeta` | deferred | — | 要追加能力 | DEFERRED, NEW_MECHANIC:stuffedDough, SOURCE_COMPOSITION_CONFLICT | `fugazzetta-pizzadb-p10` (PIZZADB_SUBSET / PARTIAL) |
| `boscaiola` | game_design_candidate | — | **ready** | SOURCE_COMPOSITION_CONFLICT | `boscaiola-pizzadb-p12` (DIVERGENT / FULL) |
| `pugliese` | verification_pending | `breadcrumb` | **ready** | — | 行なし（catalog 設計のみ） |
| `siciliana` | verification_pending | `breadcrumb`, `caciocavallo` | 要追加能力 | NEW_MECHANIC:specialShapePan, SOURCE_COMPOSITION_CONFLICT | `siciliana-pizzadb` (DIVERGENT / NOT_REPRESENTABLE) |
| `calabrese` | verification_pending | `nduja` | 要追加能力 | SPREAD_PLACED_TOPPING | 行なし（catalog 設計のみ） |
| `ai-carciofi` | game_design_candidate | `artichoke` | **ready** | — | 行なし（catalog 設計のみ） |
| `alla-norma` | verification_pending | `ricotta-salata` | **ready** | SOURCE_COMPOSITION_CONFLICT | `pizza-alla-norma-pizzadb-p9` (DIVERGENT / FULL) |
| `contadina` | rejected_duplicate | `bell-pepper` | 要追加能力 | REJECTED_DUPLICATE | 行なし（catalog 設計のみ） |
| `ai-funghi-porcini` | verification_pending | `porcini` | **ready** | SOURCE_COMPOSITION_CONFLICT | `porcini-pizza-pizzadb-p13` (DIVERGENT / FULL) |
| `al-tartufo` | verification_pending | `truffle` | 要追加能力 | POST_BAKE_FINISH, SOURCE_COMPOSITION_CONFLICT | `black-truffle-pizza-pizzadb-p14` (DIVERGENT / PARTIAL) |
| `speck-e-brie` | verification_pending | `arugula`, `brie`, `speck`, `walnut` | 要追加能力 | POST_BAKE_FINISH, SOURCE_COMPOSITION_CONFLICT | `speck-e-brie-pizzadb-p4` (DIVERGENT / FULL) |
| `wurstel-e-patatine` | verification_pending | `french-fries`, `wurstel` | 要追加能力 | POST_BAKE_FINISH | 行なし（catalog 設計のみ） |
| `bbq-chicken` | verification_pending | `bbq-sauce`, `cilantro` | 要追加能力 | NEW_SAUCE_ID, POST_BAKE_FINISH | `bbq-chicken-pizzadb` (IDENTICAL / PARTIAL) |
| `buffalo-chicken` | verification_pending | `buffalo-sauce` | 要追加能力 | MULTI_SAUCE, NEW_SAUCE_ID, POST_BAKE_FINISH, SOURCE_COMPOSITION_CONFLICT | `buffalo-chicken-pizzadb` (DIVERGENT / PARTIAL) |
| `supreme` | game_design_candidate | `bell-pepper` | **ready** | SOURCE_COMPOSITION_CONFLICT | `supreme-pizzadb` (PIZZADB_SUBSET / FULL) |
| `ricotta-bianca` | game_design_candidate | `ricotta` | **ready** | — | 行なし（catalog 設計のみ） |
| `philly-cheesesteak` | verification_pending | `bell-pepper`, `provolone`, `steak` | **ready** | — | 行なし（catalog 設計のみ） |
| `chicago-deep-dish` | verification_pending | — | 要追加能力 | IDENTITY_COLLISION, NEW_MECHANIC:layeredReverseOrder+specialShapePan, SOURCE_COMPOSITION_CONFLICT | `chicago-deep-dish-pizzadb` (PIZZADB_SUPERSET / NOT_REPRESENTABLE) |
| `detroit-style` | verification_pending | — | 要追加能力 | IDENTITY_COLLISION, POST_BAKE_FINISH, NEW_MECHANIC:specialShapePan, SOURCE_COMPOSITION_CONFLICT | `detroit-style-pizza-pizzadb-p5` (DIVERGENT / NOT_REPRESENTABLE) |
| `stuffed-crust` | game_design_candidate | — | 要追加能力 | IDENTITY_COLLISION, NEW_MECHANIC:ringPlacement | 行なし（catalog 設計のみ） |
| `shrimp-mayo` | verification_pending | `mayo`, `shrimp` | 要追加能力 | MULTI_SAUCE, NEW_SAUCE_ID, POST_BAKE_FINISH | 行なし（catalog 設計のみ） |
| `teriyaki-chicken` | verification_pending | `mayo`, `nori`, `teriyaki-sauce` | 要追加能力 | MULTI_SAUCE, NEW_SAUCE_ID, POST_BAKE_FINISH, SOURCE_COMPOSITION_CONFLICT | `teriyaki-chicken-pizza-pizzadb-p14` (INDETERMINATE_UNSPECIFIED_SAUCE_BASE / PARTIAL) |
| `potato-bacon` | verification_pending | `mayo` | 要追加能力 | MULTI_SAUCE, NEW_SAUCE_ID, POST_BAKE_FINISH | 行なし（catalog 設計のみ） |
| `nutella-dessert` | verification_pending | `nutella-spread`, `powdered-sugar`, `strawberry` | 要追加能力 | NEW_SAUCE_ID, POST_BAKE_FINISH, SOURCE_COMPOSITION_CONFLICT | `nutella-dessert-pizza-pizzadb-p6` (INDETERMINATE_UNRESOLVED_TOKENS / PARTIAL) |
| `honey-fig` | verification_pending | `fig`, `honey`, `mascarpone`, `walnut` | 要追加能力 | NO_SAUCE, NEW_SAUCE_ID, POST_BAKE_FINISH | 行なし（catalog 設計のみ） |
| `bufalina` | rejected_duplicate | — | 要追加能力 | REJECTED_DUPLICATE, IDENTITY_COLLISION | 行なし（catalog 設計のみ） |
| `ny-style` | deferred | — | 要追加能力 | DEFERRED, IDENTITY_COLLISION | `ny-style-pizzadb` (IDENTICAL / PARTIAL) |
| `greek-style` | deferred | — | 要追加能力 | DEFERRED, IDENTITY_COLLISION, NEW_MECHANIC:specialShapePan, SOURCE_COMPOSITION_CONFLICT | `greek-style-pizzadb` (PIZZADB_SUPERSET / NOT_REPRESENTABLE) |

---

## 4. Ingredient Taxonomy（新規 35 材料）

**サマリ**: 新規 35 = 具材 22 / ソース 7 / チーズ 6。

- **具材 22**: family は **全件 Owner 確定済み**（OD-T1 の 16 + OD-T2 の 7 − production 入りした `chicken`）。**family 未解決 = 0**、**新 family id は不要**（既存 7 id の範囲。`attr:family:<id>` は永続化 id なので rename / split / merge は禁止のまま）。
  各 row は導入 PR で `ingredientTaxonomy.ts` に追加する（OD-T7。事前に 2 つ目の runtime 台帳を作らない）。
- **ソース 7 / チーズ 6**: role は catalog artifact の値のみ。OD-T5 により **導入 PR ごとに Owner が確認**する。`mascarpone` は OD-T4 で明示 deferred。**role 未確認 13**。
- **role と使い方の衝突 6**: `mayo` `honey` `chili-oil` `buffalo-sauce` `teriyaki-sauce`（ソース role だが catalog 上は **焼成後の仕上げ** / **2 つ目の sauce**）と `nduja`（具材 role だが `placement=spread`）。
  OD-T2 は「placement / timing は family と別軸」と確定済みだが、**sauce 3 → 10 に増えると『ソース step で何を置けるか』が role 軸と timing 軸で食い違う**。
- **sauce 型の拡張が必要**: `RecipeSauceProfile.ingredientId` は `"tomato-sauce" | "pesto" | "olive-oil"` の literal union で、`Record<RecipeId, …>` が全 recipe に profile を要求する。
  新 sauce 7 は **型変更**を要し、no-sauce recipe は profile 自体が書けない（#295 の分類でも DATA_ONLY ではなく engine 側の前提）。
- **検索**: 新規名のうち漢字 / 英字を含む 7（`BBQソース` `パン粉` `粉砂糖` `生ハム` `サラミ（ピリ辛）` `ステーキ肉` `照り焼きソース`）は、かな入力で当たらない。
  Production の `readingJa` は 0 件・search alias は 3 件（Owner 承認済みのみ、生成禁止）なので **alias / reading は Owner 承認が必要**（具材 step の pantry 検索は常時、sauce / cheese は owned > 6 で出現）。

**未解決数（要求の「taxonomy unresolved count」）**: family 未解決 **0** + role 未確認 **13** = **13**（うち usage 衝突 6 は別掲、重なりあり）。

| id | 名称(catalog) | role(内部) | 表示カテゴリ | family / shelf | 現authorityで分類可能か | Owner Decision | 注意 |
|---|---|---|---|---|---|---|---|
| `artichoke` | アーティチョーク | topping | 具材 | 野菜・きのこ(`vegetable`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `arugula` | ルッコラ | topping | 具材 | 野菜・きのこ(`vegetable`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `bell-pepper` | パプリカ | topping | 具材 | 野菜・きのこ(`vegetable`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID |
| `breadcrumb` | パン粉 | topping | 具材 | その他(`other`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NAME_NEEDS_SEARCH_ALIAS_OR_READING |
| `cilantro` | パクチー | topping | 具材 | ハーブ・香味(`herb`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID |
| `fig` | いちじく | topping | 具材 | 果物(`fruit`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `french-fries` | フライドポテト | topping | 具材 | その他(`other`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID |
| `nduja` | ンドゥイヤ | topping | 具材 | 肉(`meat`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | TOPPING_WITH_SPREAD_PLACEMENT |
| `nori` | のり | topping | 具材 | その他(`other`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `parsley` | パセリ | topping | 具材 | ハーブ・香味(`herb`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `porcini` | ポルチーニ | topping | 具材 | 野菜・きのこ(`vegetable`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID |
| `powdered-sugar` | 粉砂糖 | topping | 具材 | その他(`other`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NAME_NEEDS_SEARCH_ALIAS_OR_READING |
| `prosciutto-crudo` | 生ハム | topping | 具材 | 肉(`meat`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID, NAME_NEEDS_SEARCH_ALIAS_OR_READING |
| `shrimp` | エビ | topping | 具材 | 魚介(`seafood`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `speck` | スペック | topping | 具材 | 肉(`meat`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID |
| `spicy-salami` | サラミ（ピリ辛） | topping | 具材 | 肉(`meat`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID, NAME_NEEDS_SEARCH_ALIAS_OR_READING |
| `steak` | ステーキ肉 | topping | 具材 | 肉(`meat`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID, NAME_NEEDS_SEARCH_ALIAS_OR_READING |
| `strawberry` | いちご | topping | 具材 | 果物(`fruit`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `truffle` | トリュフ | topping | 具材 | 野菜・きのこ(`vegetable`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `walnut` | くるみ | topping | 具材 | その他(`other`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `wurstel` | ウインナー | topping | 具材 | 肉(`meat`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID |
| `zucchini` | ズッキーニ | topping | 具材 | 野菜・きのこ(`vegetable`) | 可（OD-T1/T2 確定済・runtime未反映） | 不要（OD-T7: 導入PRで row 追加） | — |
| `bbq-sauce` | BBQソース | sauce | ソース | —（family 無し。shelf=sauce） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | NEEDS_SAUCE_PROFILE_TYPE_EXTENSION, NAME_NEEDS_SEARCH_ALIAS_OR_READING |
| `buffalo-sauce` | バッファローソース | sauce | ソース | —（family 無し。shelf=sauce） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | SAUCE_ROLE_USED_AS_POST_BAKE_FINISH, SECOND_SAUCE_IN_RECIPE, NEEDS_SAUCE_PROFILE_TYPE_EXTENSION |
| `chili-oil` | チリオイル | sauce | ソース | —（family 無し。shelf=sauce） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | SAUCE_ROLE_USED_AS_POST_BAKE_FINISH, SECOND_SAUCE_IN_RECIPE, NEEDS_SAUCE_PROFILE_TYPE_EXTENSION |
| `honey` | はちみつ | sauce | ソース | —（family 無し。shelf=sauce） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | SAUCE_ROLE_USED_AS_POST_BAKE_FINISH, NEEDS_SAUCE_PROFILE_TYPE_EXTENSION |
| `mayo` | マヨネーズ | sauce | ソース | —（family 無し。shelf=sauce） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | SAUCE_ROLE_USED_AS_POST_BAKE_FINISH, SECOND_SAUCE_IN_RECIPE, NEEDS_SAUCE_PROFILE_TYPE_EXTENSION |
| `nutella-spread` | チョコヘーゼルナッツソース | sauce | ソース | —（family 無し。shelf=sauce） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | NEEDS_SAUCE_PROFILE_TYPE_EXTENSION |
| `teriyaki-sauce` | 照り焼きソース | sauce | ソース | —（family 無し。shelf=sauce） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | SECOND_SAUCE_IN_RECIPE, NEEDS_SAUCE_PROFILE_TYPE_EXTENSION, NAME_NEEDS_SEARCH_ALIAS_OR_READING |
| `brie` | ブリーチーズ | cheese | チーズ | —（family 無し。shelf=cheese） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | — |
| `caciocavallo` | カチョカヴァロ | cheese | チーズ | —（family 無し。shelf=cheese） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | — |
| `mascarpone` | マスカルポーネ | cheese | チーズ | —（family 無し。shelf=cheese） | 不可（OD-T4 deferred） | **要**（OD-T5/T4） | — |
| `provolone` | プロヴォローネ | cheese | チーズ | —（family 無し。shelf=cheese） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | — |
| `ricotta` | リコッタチーズ | cheese | チーズ | —（family 無し。shelf=cheese） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | — |
| `ricotta-salata` | リコッタサラータ | cheese | チーズ | —（family 無し。shelf=cheese） | role は catalog 値のみ（未確認） | **要**（OD-T5/T4） | — |

---

## 5. Progression / Shop / Discovery（27 → 53 の到達性）

### 5.1 ladder の仕組み（再確認）

- step `s` は **credited discovery 数 ≥ s** で到達。各 step は 1 回だけ材料を解放（`validateDiscoveryLadder`）。W1 step 1–24 は凍結、以降は **append-only**（OD-W2-1 / LAD-1）。
- append 規則（key-recipe rule）: 「まだ作れない recipe を 1 つ作れるようにする最小の材料集合」。この規則を Python に port し、**Production の step 25（chicken / pesto-pollo）を導出できること、全 25 step の pool = 1** を確認済み。
- 価格 / chapter は step の tier で決まる（T4 は step 30 から：初回 120 / 補充 60、**Dex に第 4 章が初めて出現**）。pack 量 = `10 × k`（k = recipe 中の最大 `minCount`）。
  **新 recipe の `minCount` は 172 / catalog のどちらにも無い**（Pesto-Pollo と同じく gameplay calibration が要る）ため、pack 量 / 経済は本監査では確定できない。

### 5.2 段階別の到達性（recipe の種類ごと）

| 段階 | A. 標準（既存 sauce、新規は具材 / cheese） | B. 新 sauce 単独（例 `bbq-chicken` の sauce） | D. 能力が要る（後乗せ / pan / 折り / zone） | E. no-sauce（`honey-fig` `mezza-e-mezza`） | F. identity 衝突 |
|---|---|---|---|---|---|
| unlock（ladder step） | ✓ append で到達 | ✓（role 確認 + 型拡張が前提） | step 自体は到達するが、**key recipe が作れないと詰む**（§5.3） | ✓ | **✗ AMBIGUOUS で発見不能（既存 recipe も巻き込む）** |
| shop availability | ✓ `materialOffer`（`unlockCondition` + ladder + k>0） | ✓ | ✓ | ✓ | — |
| ownership | ✓ `purchaseFirstPack` → `ownedIngredientIds` 追記（取得順は unlock fact に使われる） | ✓ | ✓ | ✓ | — |
| inventory | ✓ 在庫は id キー、pack = 10k。**0 になると #378 の状態** | ✓ | ✓ | ✓ | — |
| Research Entry | ✓ ownership のみで登録（在庫は見ない） | ✓ | ✓ 登録される | ✓ | ✓ 登録はされるが発見不能 |
| Research Target | ✓ DISCOVERABLE = 全 finite 所持 **かつ** 在庫 ≥ 1 | ✓ | ✓ | ✓ | ✓ |
| Contract 2.1 ○ / × | ✓ canonical(T) から計算、○ のみ保存、K = 3 | ✓（sauce 行は常に 1 件） | membership は出るが **全 ○ でも発見されない**。INV-D3 / D5 で原因を区別できず**永久に回る** | **✗ 標準 panel を target 非依存に出せない → panel 対象外**（Expansion Gate A） | 同左（全 ○ で AMBIGUOUS） |
| Hint | ✓ `RECIPE_HINT_ROLES` 行が型で必須（key-free 可）。具材は family 1 つ必須（`hint5Taxonomy.gate`） | SAUCE rung の対象が新 sauce | 後乗せ材料の rung 設計は未定 | sauce rung が RESERVED（Hint 5.0） | — |
| Dex | ✓ chapter = key step の tier。**step ≥ 30 で第 4 章（初）** | ✓ | ✓ | ✓ | — |

### 5.3 母集団ごとの simulation（`tools/post_prod27_53_scale_audit.py`）

pool = 「最小 slack（s − 1 件発見した状態）で step s に到達するために残っている『作れる未発見 recipe』の数」。Production は **全 25 step で pool = 1（単一 chokepoint）**。
「literal 詰み step」は、second sauce（物理的に置けない）・placeholder・identity 衝突（AMBIGUOUS）を **発見不能**として数えたとき、step s の必要発見数 s を満たせない step。

| シナリオ | recipe 数 | 追加 ladder step | 総 step | 新材料 | 単一 pool step | pool≥2 step | 最大同時 Research Entry | ⑩超 | 全材料 refill Pitz | literal 到達不能 recipe | literal 詰み step |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---|
| U64 全 union（27 ∪ 53） | 63 | 24 | 49 | 35 | 0 | 49 | 13 (step 28) | YES | 3210 | 14 | 1–15, 44–49（21 step） |
| U62（rejected 2 除く） | 61 | 24 | 49 | 35 | 0 | 49 | 11 (step 27) | YES | 3210 | 12 | 7–13, 44–49（13 step） |
| U57（+ deferred 5 除く） | 56 | 23 | 48 | 35 | 0 | 48 | 7 (step 27) | no | 3210 | 9 | 36–48（13 step） |
| ENGINE_READY（現 engine のみ） | 36 | 8 | 33 | 9 | 7 | 26 | 2 (step 7) | no | 1650 | 0 | なし |
| ENGINE_READY（既存3 sauce のみ） | 36 | 8 | 33 | 9 | 7 | 26 | 2 (step 7) | no | 1650 | 0 | なし |
| ENGINE_READY ∧ source 衝突なし | 32 | 5 | 30 | 7 | 30 | 0 | 1 (step 1) | no | 1520 | 0 | なし |

key 規則で append される step（抜粋）:

- ENGINE_READY（9 recipe）: 26:bell-pepper（supreme, T3） → 27:artichoke（ai-carciofi, T3） → 28:porcini（ai-funghi-porcini, T3） → 29:ricotta-salata（alla-norma, T3） → 30:zucchini（ortolana, T4） → 31:breadcrumb（pugliese, T4） → 32:ricotta（ricotta-bianca, T4） → 33:provolone+steak（philly-cheesesteak, T4）
- ENGINE_READY ∧ source 衝突なし（5 recipe）: 26:artichoke（ai-carciofi, T3） → 27:breadcrumb（pugliese, T3） → 28:ricotta（ricotta-bianca, T3） → 29:bell-pepper+zucchini（ortolana, T3） → 30:provolone+steak（philly-cheesesteak, T4）

読み取り:

1. **HARD DEADLOCK risk（条件付き YES）**
   - **現 engine で作れる 9 recipe の母集団（ENGINE_READY）では NO**: 追加 8 step、softlock 0、literal 詰み 0、unreachable 材料 0。
   - **second sauce 5 recipe（`shrimp-mayo` `potato-bacon` `teriyaki-chicken` `diavola` `buffalo-chicken`）は ingredient set を 1 つの pizza に載せられない**
     （`APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` が `sauceIds` を 1 要素で置換する）。これが key recipe になった step 以降は進めない。
   - **identity 衝突 6 recipe は既存 Production（margherita / salsiccia / pepperoni）を AMBIGUOUS にする**。bufalina を入れた U64 は **step 1 から詰む**（margherita が発見不能）。
   - U62 / U57 でも、後乗せ recipe を単に default dimension で入れて「発見可能」と扱うと **ingredient set は一致しても『焼成後に載せた』という正解を表現できない**（PARTIAL）。matcher 規則 2（要求能力が未対応の target は候補にならない）に従えば発見不能。
2. **SOFT DEADLOCK risk（YES、既存 #378 クラス B の増幅）**
   - Research Entry は ownership 基準、cookable は在庫基準。**stock 切れ Research Entry に oracle-safe な次の行動案内が無い**状態は拡張で消えず、頻度が上がる。
   - 全材料 refill 目安: Production 1,150 → ENGINE_READY 1,650 → union 3,210 Pitz（Margherita replay は 20〜120 Pitz / 回）。
   - 単一 chokepoint: source 衝突なしの 5 recipe 母集団は **30 / 30 step が pool = 1**（各 step で未発見の作れる recipe が key recipe 1 件のみ）。
   - **step 26 以降を足しても ladder 凍結 step の pool は変わらないが、既存材料だけで作れる recipe（`boscaiola`）を 1 件足すと、凍結 step 8〜25 の pool が 1 → 2 になる**。
     既存 save に突然 Research Entry が出現し、Hint の OPEN_POOL（自動 target なし）に切り替わる。「材料を増やさない recipe は ladder の影響を受けない」という前提は誤り（Owner 判断: ladderCredit 付与の可否 / 出現タイミング）。
   - Research Entry の匿名ラベルは ①〜⑩ のみで、11 件目以降は数字にフォールバックする（`researchEntryLabel`）。**U62 / U64 の最小発見経路では最大 11〜13 件が同時に出る**。
   - HOME「レシピ発見」は cookable な Research Entry が 2 件以上だと Dex の匿名カードから選ぶ（#373）。pool ≥ 2 の step が増えるほど、この経路を通る頻度が上がる。
   - #378 自体は **変更していない**。拡張前に #378 の方針（案 1 / 2 / 3）を Owner が決めておくことを Expansion Gate にする（§9.1 OD-S8）。
3. **Dex / Pizza Select**: 61〜63 recipe では第 4 章（T4、step ≥ 30）が初登場する。LC scale model の実測（25 recipe で Dex 全発見 4,452px）を線形外挿すると約 11,000px（360×640 で約 20 画面）。
   **外挿であり実測ではない**（slice 実装時に 390×844 / 360×800 で測る）。
4. **Notebook 200 字**: §9.4。

---

## 6. HAND 12 scale

**容量 12 は変更していない**（OD-5, 2026-10-03）。hand は **カテゴリ別・FREE Cooking のみ**（Dinner / Lunch Rush は paged tray）。

| 項目 | Production | 53 候補 union（65 材料） |
|---|---:|---:|
| 具材 | 23（hand 外 11） | **45（hand 外 33、全 owned 時 73 %）** |
| ソース / チーズ | 3 / 4 | **10 / 10**（≤ 12 → hand 非活性。paged tray 各 2 ページ） |
| 具材の family 構成 | 野菜 8 / 肉 5 / ハーブ 4 / 魚介 3 / 果物 1 / スパイス 1 / その他 1 | **野菜 14 / 肉 11 / ハーブ 6 / その他 6 / 魚介 4 / 果物 3 / スパイス 1**（新 family なし、chip 7 のまま） |
| 1 recipe の最大具材種数 | 4 | **6**（`supreme`。hand は placed を容量超過でも保護するので 12 に収まる） |
| paged tray（Dinner / Lunch Rush）worst taps | 4 ページ | **8 ページ**（hand は適用外） |

判定:

- **pin / hand 12**: 1 recipe の具材 ≤ 6、placed 保護（OD-R5d-2）、pin は placed の残り枠（Model C）。実験的な組み合わせでも 12 で足りる。
  自動枠は **在庫 ≥ 1 のみ**（OD-R5e-2）で、新規購入材料は `new` source で hand に入る。`fill` は catalog 順なので、**末尾追加の新材料は購入直後だけ hand に入り、以後は pin / recent 頼み**。
- **pantry 検索**: owned > 6 で出現、normalized substring のみ。kana 名 28 件は問題なし。漢字 / 英字名 7 件は alias / reading が必要（§4）。
- **family chip**: shelf 9（sauce / cheese + 7 family）の枠は増えない。最大 family（野菜 14）は pantry 内スクロール。tray 内 family chip は無い（OD-B1〜B5）。
- **要注意**: Dinner / Lunch Rush の具材 paged tray が 8 ページになる。LC OD-1 は「Dinner は別 audit」としており、**この監査では対処案を出さない**（Gate、§8）。

---

## 7. Cooking Steps candidate extraction

現在の通常工程（DOUGH → SAUCE → CHEESE → TOPPING[具材] → BAKE →（opt-in）CUT）だけでは忠実に表現できない新規 recipe は **28 件**（新規 37 − ready 9）。
各行に **根拠の強さ**を付けた（PIZZA DB の source field / profile 文 > PIZZA DB 行はあるが能力は catalog タグ由来 > catalog 設計タグのみ）。工程を追加する決定はしていない。

必要な能力の集計（延べ）:
`LATE_POST_BAKE_ADDITION` 15 / `IDENTITY_COLLISION_NEEDS_DIMENSION` 6 / `SECOND_SPREAD_LAYER` 5 / `PAN_SHAPE` 4 / `UNUSUAL_BASE_SPREAD` 3 / `NO_SAUCE` 1 / `ZONED_QUADRANT` 1 / `SPLIT_CANVAS` 1（+ placeholder 1）/ `FOLD_SEAL` 1 / `ENCLOSE_STUFF` 1 / `EDGE_RING_FILL` 1 / `REVERSE_LAYER` 1 / `SPREAD_PLACED_TOPPING` 1。

| id | 必要な工程/表現 | 根拠の強さ | catalog status |
|---|---|---|---|
| `prosciutto` | LATE_POST_BAKE_ADDITION | catalog 設計タグのみ（PIZZA DB 行なし） | game_design_candidate |
| `diavola` | SECOND_SPREAD_LAYER, LATE_POST_BAKE_ADDITION | PIZZA DB 行あり／能力は catalog タグ由来のみ | game_design_candidate |
| `frutti-di-mare` | LATE_POST_BAKE_ADDITION | PIZZA DB 行あり／能力は catalog タグ由来のみ | game_design_candidate |
| `quattro-stagioni` | ZONED_QUADRANT | PIZZA DB の source フィールド/profile 文に根拠あり | game_design_candidate |
| `mezza-e-mezza` | COMPOSITE_OF_TWO_RECIPES, SPLIT_CANVAS | catalog 設計タグのみ（PIZZA DB 行なし） | game_design_candidate |
| `calzone` | FOLD_SEAL | PIZZA DB の source フィールド/profile 文に根拠あり | game_design_candidate |
| `prosciutto-e-funghi` | LATE_POST_BAKE_ADDITION | catalog 設計タグのみ（PIZZA DB 行なし） | deferred |
| `fugazzeta` | ENCLOSE_STUFF | PIZZA DB の source フィールド/profile 文に根拠あり | deferred |
| `siciliana` | PAN_SHAPE | PIZZA DB の source フィールド/profile 文に根拠あり | verification_pending |
| `calabrese` | SPREAD_PLACED_TOPPING | catalog 設計タグのみ（PIZZA DB 行なし） | verification_pending |
| `al-tartufo` | LATE_POST_BAKE_ADDITION | PIZZA DB 行あり／能力は catalog タグ由来のみ | verification_pending |
| `speck-e-brie` | LATE_POST_BAKE_ADDITION | PIZZA DB 行あり／能力は catalog タグ由来のみ | verification_pending |
| `wurstel-e-patatine` | LATE_POST_BAKE_ADDITION | catalog 設計タグのみ（PIZZA DB 行なし） | verification_pending |
| `bbq-chicken` | LATE_POST_BAKE_ADDITION, UNUSUAL_BASE_SPREAD | PIZZA DB 行あり／能力は catalog タグ由来のみ | verification_pending |
| `buffalo-chicken` | SECOND_SPREAD_LAYER, LATE_POST_BAKE_ADDITION | PIZZA DB の source フィールド/profile 文に根拠あり | verification_pending |
| `chicago-deep-dish` | REVERSE_LAYER, PAN_SHAPE, IDENTITY_COLLISION_NEEDS_DIMENSION | PIZZA DB の source フィールド/profile 文に根拠あり | verification_pending |
| `detroit-style` | LATE_POST_BAKE_ADDITION, PAN_SHAPE, IDENTITY_COLLISION_NEEDS_DIMENSION | PIZZA DB の source フィールド/profile 文に根拠あり | verification_pending |
| `stuffed-crust` | EDGE_RING_FILL, IDENTITY_COLLISION_NEEDS_DIMENSION | catalog 設計タグのみ（PIZZA DB 行なし） | game_design_candidate |
| `shrimp-mayo` | SECOND_SPREAD_LAYER, LATE_POST_BAKE_ADDITION | catalog 設計タグのみ（PIZZA DB 行なし） | verification_pending |
| `teriyaki-chicken` | SECOND_SPREAD_LAYER, LATE_POST_BAKE_ADDITION | PIZZA DB 行あり／能力は catalog タグ由来のみ | verification_pending |
| `potato-bacon` | SECOND_SPREAD_LAYER, LATE_POST_BAKE_ADDITION | catalog 設計タグのみ（PIZZA DB 行なし） | verification_pending |
| `nutella-dessert` | LATE_POST_BAKE_ADDITION, UNUSUAL_BASE_SPREAD | PIZZA DB 行あり／能力は catalog タグ由来のみ | verification_pending |
| `honey-fig` | NO_SAUCE, LATE_POST_BAKE_ADDITION | catalog 設計タグのみ（PIZZA DB 行なし） | verification_pending |
| `bufalina` | IDENTITY_COLLISION_NEEDS_DIMENSION | catalog 設計タグのみ（PIZZA DB 行なし） | rejected_duplicate |
| `ny-style` | IDENTITY_COLLISION_NEEDS_DIMENSION | PIZZA DB の source フィールド/profile 文に根拠あり | deferred |
| `greek-style` | PAN_SHAPE, IDENTITY_COLLISION_NEEDS_DIMENSION | PIZZA DB の source フィールド/profile 文に根拠あり | deferred |

読み取り（authority との対応）:

- **no-sauce**: 新規で該当するのは `honey-fig`（catalog の `sauce` が null、`honey` は sauce role だが焼成後）と placeholder の `mezza-e-mezza`。
  Production に no-sauce recipe は 0。Techniques 1.0 は **no-sauce の production 追加を TQ-1D に限定**し、Contract 2.1 は **Expansion Gate A**（RESERVED / INV-D4 / INV-D7 の再設計）を要求する。
- **後乗せ（FINISH）**: 15 recipe で最大。`FINISH` は型だけで挙動なし、`late` 軸は `FIXED_BY_FLOW`。Techniques OD-TQ-2 は後乗せ = TQ-2、複数 spread = TQ-3 の **技法**に分類済み。
  #295（Post-W1 Cooking Steps 設計）は FINISH を test-only fixture で先に作る案だが **未 merge・Owner 未決**。**Dinner は START_BAKE で identity を確定する**（後乗せ recipe は Dinner で識別できない、#295 OD-R6）。
- **second spread**: 5 recipe はすべて「base sauce + 仕上げ sauce」（172 matrix で `MULTI_SPREAD_LAYER` の source field 根拠があるのは `buffalo-chicken` のみ。他は catalog 由来 / repo 推測）。
  #295 の分類では MAJOR（`sauceIds` 複数化・heatmap 2 層・score 成分・Hint 5.0 SAUCE rung）。Contract 2.1 の「sauce 行は常に 1 件」も崩れる。
- **unusual base / spread**: `bbq-sauce` `nutella-spread` `honey`（および `nduja` = spread 置きの具材）。同じ PAINT 経路に載るか DRIZZLE が要るかは未決（`recipeSauceProfiles.ts` の TODO）。
- **non-standard shape / pan / boat / piadina 等**: 新規 37 では `siciliana` `chicago-deep-dish` `detroit-style` `greek-style`（pan / 形）、`calzone` `fugazzeta`（折り / 包み）、`stuffed-crust`（ring）、`quattro-stagioni`（4 分割）、`mezza-e-mezza`（2 分割）。
  **boat / pide / piadina は 53 の候補に無い**（172 側。本監査の範囲外）。CUT は既存 allowlist が opt-in で、**非円形 recipe は人が形を確認するまで追加不可**。
- **既存 engine 外の dimension を要求する target は matcher 規則 2 で候補にならない**（`RUNTIME_SUPPORTED_CAPABILITIES = []`）。工程を足すだけでなく **signature 観測 + matcher 対応が同じ slice に必要**。

capability を足したとき何件 ship 可能になるか（live 候補 = rejected / deferred を除く 30、うち ingredient を持つ 29）:

| 追加する能力（累積・この順） | engine-ready になる新 recipe（累積） | その能力だけで足りる recipe |
|---|---:|---:|
| （現 engine のみ） | 9 | — |
| + SPREAD_PLACED_TOPPING | 10 | 1 |
| + NEW_SAUCE_ID | 10 | 0 |
| + POST_BAKE_FINISH | 17 | 5 |
| + MULTI_SAUCE | 22 | 0 |
| + NO_SAUCE | 23 | 0 |
| + NEW_MECHANIC:specialShapePan | 24 | 1 |
| + NEW_MECHANIC:quadrantPlacement | 25 | 1 |
| + NEW_MECHANIC:foldDough | 26 | 1 |
| + NEW_MECHANIC:ringPlacement | 26 | 0 |
| + NEW_MECHANIC:layeredReverseOrder | 26 | 0 |
| + NEW_MECHANIC:halfAndHalfSplit | 26 | 0 |
| + IDENTITY_COLLISION | 28 | 0 |
| + PLACEHOLDER_NO_INGREDIENTS | 29 | 0 |

→ **「+26 recipe」は 後乗せ・second sauce・no-sauce・pan・zone・fold の全部が揃ってはじめて届く**（累積 26 は `foldDough` 追加の段）。53 は engine-ready milestone ではなく、ほぼ全 capability track の完了点である。

---

## 8. Vertical Slice 提案（実装はしない）

### 8.1 選定条件への当てはめ

| 条件 | 満たし方 |
|---|---|
| 新材料を含む | step 26 で `artichoke`（具材 / `vegetable`、OD-T1 確定、role 衝突なし、alias 不要＝カタカナのみ） |
| Discovery 3.0 を実際に使う | ladder step 26 の key recipe として Research Entry → Target → Contract 2.1 ○× → Notebook → Hint → 発見。unlock fact は `artichoke` |
| HAND 12 を使う | 具材 24 件目（hand は step 12 から活性）。購入直後は `new` source で hand に入り、pantry 検索 / family chip（野菜・きのこ 8→9）/ pin の経路を通せる |
| Shop / unlock を通る | step 26 は **T3（初回 100 / 補充 50 Pitz）**。T4（step 30）や第 4 章には**まだ入らない** |
| 新 Cooking Step を 1 種類検証（可能なら） | **この slice では入れない**（理由は 8.3）。次 slice で `quattro-stagioni` を推奨 |
| 既存 save 互換 | 追加 id のみ（§9.3）。schemaVersion 2 のまま、migration なし |

### 8.2 推奨: Slice 1 = `ai-carciofi`（アーティチョークのピザ）+ `artichoke`

- recipe: `tomato-sauce` + `mozzarella` + `garlic` + `artichoke`（catalog class B、`game_design_candidate`）。新規 ingredient 1、既存 sauce、衝突なし、source 衝突フラグなし。
- 現 engine のまま実装できる（Pesto-Pollo と同じ 9 data file 構成: recipes / ingredients / ingredientTaxonomy / discoveryLadder / discoveryCatalog / recipeSauceProfiles / recipeHintRoles / orders / referencePizza）。
- `minCount` / `bakeTarget` / emoji・color / description は **gameplay calibration**（source 無し）。Pesto-Pollo と同様に「sibling の骨格を踏襲」し、source と明記しない。
- CUT: 生地の PIZZA DB 根拠が無いので **allowlist には入れない**（`new-haven-apizza` と同じ 5 tab、「既定の round は根拠ではない」）。Owner 判断。
- ladder: step 26（key = `ai-carciofi`）。**ladderCredit 付与、Lunch Rush 参加、Hint の key-free / authored** は Owner 判断（OD-S5）。
- 副効果の確認が slice の検証項目になる: pool（step 26 で 1 → `quattro-stagioni` 追加後は 2）、Research Entry 番号、第 3 章の slot 数、`shop` の NEW 行、既存 save の 26 credited 到達時の自動 entitlement。

選定理由: 候補のうち **新規 ingredient 1・既存 sauce・role 未確認なし・alias 問題なし・衝突なし・source 衝突なし**を同時に満たし、かつ後続の `quattro-stagioni`
（PIZZA DB 行と composition 完全一致、`artichoke` のみ新規）の材料を先に入れられるのは `ai-carciofi` だけ。他の ready 候補はいずれか欠ける:
`ortolana`（新規 2、`bell-pepper` の検索誤認）、`pugliese`（`breadcrumb` = other、catalog `verification_pending`）、`ricotta-bianca`（cheese role 未確認 + `pizza-bianca` と naming cluster）、
`philly-cheesesteak`（新規 3、cheese role 未確認）、`boscaiola` / `alla-norma` / `ai-funghi-porcini` / `supreme`（PIZZA DB と composition が衝突）。

**弱点（隠さない）**: `ai-carciofi` は PIZZA DB 行が無く **catalog の設計候補のみ**。Pesto-Pollo は 172 matrix で READY / FULL の source 権威付きだった。→ **OD-S2**。

### 8.3 新 Cooking Step の検証を Slice 1 に入れない理由 / 次の候補

- **Slice 2 候補 A: `quattro-stagioni`（zone / 4 分割）** — `artichoke` を共有、PIZZA DB 行と composition 完全一致（READY / PARTIAL / `ZONED_PLACEMENT`）。
  ただし `zones` は `UNAVAILABLE`（分類規則なし）で、**signature 観測 + matcher 対応 + 採点 / Reference** が必要（#295 の分類では SMALL_ENGINE だが未 merge）。
- **Slice 2 候補 B: `bbq-chicken`（FINISH / 後乗せ）** — 唯一 PIZZA DB が READY で `chicken` は Production 済み。新規は `bbq-sauce`（sauce role 未確認 + 型拡張）と `cilantro`（herb）。
  ただし後乗せは **TQ-2（技法）**に属し、FINISH engine（#295 CS-1 / CS-2）・Dinner identity（OD-R6）・Contract 2.1 の second sauce が前提。**first slice には不適**。
- **参考（53 の外、source 権威付き）**: `pesto-gamberi-pizzadb-p11`（`fresh-tomato` `garlic` `pesto` `shrimp`、172 matrix で FULL / READY、新規は `shrimp` = 魚介 OD-T1 確定、capability なし）。
  Pesto-Pollo と同格の source 根拠を持つ。**53 catalog には無い**ので、Owner が「source 権威を優先する」と決めた場合の代替（OD-S6）。

---

## 9. Expansion Gates（53 へ進む前に必要なもの）

### 9.1 Owner Decision（未決）

| ID | 論点 |
|---|---|
| **OD-S1** | 「53」の意味。**53 recipe 総数（+26）**か、catalog 53 件か。fresh の数値（§3.1）を新しい基準にするか。count を gate にせず capability 単位で段階化するか（推奨） |
| **OD-S2** | **composition authority**。catalog（設計タグのみ）と 172 matrix（PIZZA DB）が衝突する 18 件でどちらを採るか。`game_design_candidate` / `verification_pending` を source 無しで ship してよいか（Pesto-Pollo は source 必須だった） |
| **OD-S3** | **role 確認 13**（sauce 7 / cheese 6、mascarpone は OD-T4）。さらに **仕上げ sauce の role**（ソース role のまま timing 属性を足すか、別扱いか）と spread 置き具材（`nduja`） |
| **OD-S4** | **identity 衝突の方針**（bufalina / stuffed-crust / ny / greek / detroit / chicago）。「identity dimension が観測できるまで ship しない」を明文化するか。既存 margherita / salsiccia / pepperoni の保護 |
| **OD-S5** | 新 recipe ごとの **ladderCredit / Lunch Rush / Dinner 参加**。既存材料だけで作れる recipe（`boscaiola`）が凍結 step の pool を 1 → 2 に変える件の可否 |
| **OD-S6** | first slice の選択（8.2 `ai-carciofi` / source 優先の `pesto-gamberi` / その他）と 2 番目の順序 |
| **OD-S7** | step 30 = **T4 / 第 4 章**の初出（価格 120 / 60、Dex UI）を許容するか、tier 帯を見直すか |
| **OD-S8** | **#378 の方針**（案 1: 在庫切れ案内 + Shop CTA / 案 2: 在庫切れでも Hint・○× / 案 3: sample 在庫）。拡張前に決めるか、各 slice の前提にするか。**本監査は #378 を変更しない** |
| **OD-S9** | sauce 拡張方針（`RecipeSauceProfile` の型、PAINT か DRIZZLE か）、no-sauce（TQ-1D）、後乗せ（TQ-2）、複数 spread（TQ-3）の順序。**PR #295 の設計を採るか** |
| **OD-S10** | Contract 2.1 の **Expansion Gate A**（no-sauce / RESERVED population の panel）と second sauce 時の「sauce 行 = 1」の再設計。K = 3 の balance 再監査（OD-RB-10。具材 ≥ 4 種の recipe は Production 5 → 候補で `supreme` は 6 種） |
| **OD-S11** | 検索 alias / reading の Owner 承認（漢字 / 英字名 7 件） |
| **OD-S12** | Dinner / Lunch Rush の paged tray（具材 45 件で 8 ページ）を hand 化するか（LC OD-1 の「Dinner は別 audit」） |

**HAND 容量 12 は Owner Decision 済みであり、本書は変更を提案しない。**

### 9.2 data authority 不足

- 新 recipe の **`minCount`・`bakeTarget`・`baseRewardPitz`・description・ingredient の emoji / color / pieceVisual** は source 無し（catalog / 172 は ingredient list のみ）。pack 量・価格・Pitz 経済は確定できない。
- 凍結 catalog（OD-T8）は runtime authority ではない。stale 5 材料 / 11 recipe / 3 材料（§3.2）を **書き換えず**、導入 PR で `ingredients.ts` / `recipes.ts` を唯一の authority にする。
- composition 衝突 18 件、`UNRESOLVED_INGREDIENT`（`唐辛子` `ナッツ` 等）、`BASE_SAUCE_UNSPECIFIED`（`teriyaki-chicken` 等）は PIZZA DB 側の再確認が要る。
- 後乗せ 15 件はいずれも **late の根拠が catalog 設計タグ**（172 matrix は `catalog_design_tag` を required strength とするが、PIZZA DB の source field / profile 文に late の根拠を持つ recipe は 0）。repo 推測のみ（OD-TQ-12 で必須扱いしない）ではないが、**工程の追加は Owner の判断があるまで行わない**。

### 9.3 save / schema 影響

- **Slice 1（standard recipe + 新材料）: 影響なし。** 永続化の id whitelist は `RECIPES` / `INGREDIENTS` から導出され、未知 id は forward-compat で保持される（rollback 安全）。`schemaVersion` 2・field 追加なし・migration なし。
  既存 save が credited ≥ 26 なら次の resolve で `artichoke` が entitled になる（step 25 の chicken と同じ）。
- 永続化 id の制約: family id（`attr:family:<id>`）は不変。新 family を作らない。`discoveryHintFacts` の `ing:<id>` は ingredient id がそのまま入る。
- **後続 slice（後乗せ / second sauce / pan / identity dimension）** は GameState / PizzaState の型と signature に及ぶが、`GameState` は永続化されない。**save への影響は dex / 在庫 / hint facts の id 追加に留まる見込み**（各 slice で再監査）。
- 上限値: hint facts / recipe = 64、technique ledger = 64。新材料は `ing:` 1 件ずつなので現状では問題なし。

### 9.4 Contract 2.1 例外 / Notebook 200 字

- **例外**: no-sauce（Expansion Gate A）、second sauce（sauce 行 = 1 の前提崩壊）、後乗せ（`used(pizza)` と焼成後 placement の関係）、identity 衝突（全 ○ でも発見されない）。いずれも標準 panel を target 非依存に同一表示できない → **panel 対象外にする設計はカテゴリ行の条件付き省略を禁じる（INV-D4）ため採れない**。再設計が先。
- **Notebook**: `textJa` ≤ 200 字、**truncate しない**、超過すると `recordAttempt` が `INVALID_FEEDBACK` で**何も保存しない**（サイレントに記録が消える）。
  Production の最悪ケース 126 字は同じ式で再現した（sauce 3 方式）。現在の sauce 1 方式は 109 字。**65 材料（cheese 10 を全件使用）の最悪は 173 字（余裕 27）**。`具材` ラベル化（OD-1）後は 170 字。
  62 → 105 / 172 では超過し得るので、**cheese 行が無制限**（OD-RB-12）である限り材料拡大のたびにテストで再確認が要る。ラベルが ⑩ を超える（11 件目以降）と +1 字。
- 発見 attempt 数: Contract 2.1 の canonical number（97 / 27 recipe）は 27 専用。**53 では未算出**（OD-RB-10 / §13.1）。本監査も算出していない（要 balance audit）。

### 9.5 実装時に必ず通すゲート（slice 共通）

- ladder 検証（`validateLadderProgression` の SOFTLOCK / KEY_RECIPE / UNREACHABLE）と **Production 27 deadlock fixture の再実行**（各 append で）。
- identity 衝突の有無（matcher の AMBIGUOUS 回帰）、`hint5Taxonomy.gate`（具材は family 1 つ）、DH4 guard の re-run、`ingredientShelf.auditShelfAuthority`、`RECIPE_*` の `Record<RecipeId,…>` 型。
- 約 55 本の count pin（recipe 27→N / ingredient 30→N / ladder 25→N / chapter 数）の移行（Pesto-Pollo 実績）。
- UI に触れる場合は Human Verification（390×844 動画・before / after screenshot）。

---

## 10. 限界 / 未実施

- vitest / tsc / e2e は未実行（`node_modules` なし）。数値はすべて静的 parse + Python 再実装で、**Production に対する再現（25 step の ladder・pool = 1・126 字）で検証済み**だが、TypeScript 実装そのものの再実行ではない。
- 発見 attempt 数 / Pitz 経済 / Dex 画面高は **算出していない / 外挿のみ**（§5.3 / §9.4）。
- 172 matrix は PIZZA DB 由来の evidence であって production authority ではない。catalog 53 も同様。本書はどちらも authority に昇格させていない。
- 工程（FINISH / zone / pan 等）の設計は #295（未 merge）の整理を **参照のみ**。決定していない。

---

## 11. 最終報告

- **audited main SHA**: `b8617ac0218bf20eb53f68ed12dea09db20e3fa8`
- **Production current counts**: **27 recipe / 30 ingredient**（sauce 3 / cheese 4 / 具材 23）、ladder 25 step、family row 23、credited 26、hand 容量 12
- **corrected 53-scale counts**: union **64 recipe / 65 ingredient**（sim 母集団 63）。Production に対する新規 **37 recipe（35 / 30）/ 35 ingredient**。53 recipe 到達 = **+26 recipe、ingredient 56〜65**
- **new recipes / ingredients**: recipe 37（§3.3）、ingredient 35 = 具材 22 / ソース 7 / チーズ 6（§4）
- **taxonomy unresolved count**: **13**（family 未解決 0 / role 未確認 13。うち role と使い方の衝突 6）
- **Cooking Steps 特殊候補**: **28 recipe**（後乗せ 15 / identity 衝突 6 / second spread 5 / pan・形 4 / 特殊 base 3 / no-sauce 1 + placeholder 1 / zone・split・fold・enclose・ring・reverse 各 1 / spread 置き具材 1）。現 engine ready は 9
- **HARD DEADLOCK risk**: **条件付き YES**（second sauce 5 / identity 衝突 6 を ladder 母集団に入れた場合。ENGINE_READY 母集団では NO）
- **SOFT DEADLOCK risk**: **YES**（#378 クラス B が増幅: 単一 chokepoint、refill 1,150 → 1,520〜3,210 Pitz、Research Entry ⑩超、凍結 step の pool 変化）
- **recommended first vertical slice**: **`artichoke` + `ai-carciofi`（ladder step 26、新 Cooking Step なし）**。次 slice で `quattro-stagioni`（zone）または `bbq-chicken`（FINISH, TQ-2 後）。source 優先なら `pesto-gamberi`（53 の外）
- **Owner Decisions required**: **OD-S1〜S12**（§9.1）。HAND 12 は決定済みで変更なし
- **READY FOR 53 IMPLEMENTATION: NO**

監査結果を push したら STOP（実装 PR は作らない）。
