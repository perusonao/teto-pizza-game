# TETO Discovery 3.0 — 172 Recipe Readiness Fresh Audit

**種別:** 監査・分類のみ（docs/data only）。production 実装・recipe 追加・Issue/PR 作成・merge・Owner Decision の確定は行っていない。`src/**` / `e2e/**` / generator / 既存 data は未変更。

| 項目 | 値 |
|---|---|
| audited main | `origin/main` = `ce2c07b9001ea6d7d65d54342252678940b1a328`（fresh fetch で expected と一致を確認） |
| production 基準（コードから再確認） | 26 recipes / 29 ingredients（sauce 3・cheese 4・topping 22）/ No.26 `brazilian-calabresa`（`ladderCredit:false`・`lunchRush:false`・key-free Hint）/ W1 ladder は step 1–24 凍結 / save schema v2 / Pantry・Search ON、Pin・Hand OFF |
| 機械可読 companion | `docs/reports/data/TETO_DISCOVERY-3_172-RECIPE_READINESS.json`（172 行 + ingredient efficiency + same-set groups） |
| 本書の立場 | 「次はこの recipe」とは決めない。`ladderCredit` / Lunch Rush 参加は全行 **UNDECIDED**。個数・bakeTarget・Reference 配置は gameplay calibration であり source authority ではない。 |

## 0. 再利用した 172 authority 資料（ゼロから再収集していない）

| 資料 | 用途 |
|---|---|
| `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（#188 Phase 1、172 行） | 主 authority。identity set・sauceBase・dough・requiredCapabilities・blockers・collisionLedger・namingClusterLedger |
| `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` / `_ROWS.md` | 判定ルール（FULL/PARTIAL/NOT_REPRESENTABLE、REQUIRED と CANDIDATE の区別） |
| `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` | 行ごとの corroborationCount / evidenceOrigin（authority 強度の判定） |
| `data/recipes/ingredient_master_catalog.json`（62 件） | 非 production 材料の category（sauce/cheese/topping） |
| `docs/reports/data/TETO_HINT-5_TAXONOMY-COVERAGE_Fresh-Audit.json` | 新 ingredient の Hint family 要件（T-COV）の根拠 |
| `docs/reports/TETO_DISCOVERY-3_PR-4b-B_Calabresa_Result.md` | source authority と gameplay calibration の区別（D-6）、OPEN_POOL の実測 |
| 現行 `src/data/{ingredients,recipes,discoveryCatalog,discoveryLadder,recipeHintRoles,recipeSauceProfiles,cookingProfiles}.ts`、`src/logic/discovery/hint5Ladder.ts`、`src/state/recipeDiscoveryState.ts` | production 現況（読み取りのみ） |

### 0.1 マトリクス（#188、base `5676ae9d`）から current main への差分

| 項目 | #188 当時 | current main | 影響 |
|---|---|---|---|
| shipped recipe | 15 | **26** | 12 行が production と一致（下記）。残り 14 production recipe は PIZZA DB 行を持たない shipped catalog 由来 |
| ingredient | 22 | **29** | `capers` `clam` `fresh-tomato` `eggplant` `corn` `pineapple` `potato` は production 材料として扱う |
| COMPOSITION_CONFLICT_SHIPPED | 15 shipped に対してのみ計算 | 26 shipped に対し **本書で再判定**（SAME_SET_AS_PRODUCTION / NAME_COLLIDES を追加検査） | 新規の production 衝突は §4 の 5 件（既存 blocker と重複） |
| production 行の identity set | — | 12 行すべて production の `requiredIngredients` の集合と**完全一致**（row-only / prod-only 差分 0） | calibration は個数のみ。集合 authority のずれなし |

**IN_PRODUCTION（172 行中 12 行、分類対象外）:** `tonno-e-cipolla-pizzadb`, `new-haven-apizza-pizzadb`, `hawaiian-pizzadb-row`, `parmigiana-pizza-pizzadb-p7`, `bambino-pizzadb-p7`, `pizza-portuguesa-pizzadb-p9`, `puttanesca-pizza-pizzadb-p10`, `brazilian-calabresa-pizzadb-p10`, `pesto-caprese-pizzadb-p11`, `pesto-tonno-pizzadb-p12`, `pesto-patate-pizzadb-p12`, `melanzane-pizza-pizzadb-p13`

## 1. 分類ルール

- **材料 tier（A/B/C）**: 行の identity set（sauce 含む）のうち、現行 29 ingredient に無い id の数。0 → A、1 → B、2+ → C。`unresolvedTokens` を持つ行は集合が不完全なので missing は下限値。
- **D（MECHANIC DEPENDENT）**: matrix の `requiredCapabilities` が空でない、または `MECHANIC_INTERPRETATION` blocker がある行。**「Discovery 不能」とは決めず**、必要 capability を明示して隔離する。`candidateCapabilities`（推測のみ）は昇格させず注記に留める。
- **E（AUTHORITY INCOMPLETE）**: `SAUCE_BASE_UNSPECIFIED` / `UNRESOLVED_INGREDIENT`（ambiguous token）/ `EVIDENCE_GAP` / `SCOPE_QUESTION` / プレースホルダー具材（お好みの具材）。gameplay calibration で補完しない。
- **primary blocker の優先順:** E > D > 材料 tier。複数該当は `secondary` に列挙。identity collision は分類軸ではなく別フラグ（`IDENTITY_COLLISION` を secondary に付記）。
- **Clean pool**: E なし・D なし・collision なし・matrix `FULL`・推測のみの capability なし・材料 tier A/B。
- **量（minCount）について:** 172 evidence には**個数が一切無い**（材料名のみ）。したがって全行で個数・bakeTarget・Reference 配置は gameplay calibration になる（No.26 と同じ扱い）。行ごとの authority 不足としては数えない。

## 2. 全体サマリ

| 項目 | 件数 |
|---|---|
| 全体 recipe 行 | 172 |
| IN_PRODUCTION（既に shipped） | 12 |
| 分類対象（非 production） | 160 |
| **primary = A CURRENT-MATERIAL READY** | **4** |
| **primary = B ONE-MATERIAL EXPANSION** | **26** |
| **primary = C MULTI-MATERIAL EXPANSION** | **26** |
| **primary = D MECHANIC DEPENDENT** | **50** |
| **primary = E AUTHORITY INCOMPLETE** | **54** |
| （参考）E に該当する行（secondary 含む） | 54 |
| （参考）D に該当する行（secondary 含む） | 71（E と重複 21） |
| 材料 tier のみで見た A / B / C（blocker 無視） | 34 / 45 / 81 |
| identity collision フラグ付き行 | **42** |
| Clean pool（E/D/collision なし・FULL・A/B） | 19（A 1・B 18） |
| Recommended Tier 1（strict） | **5** |
| Recommended Tier 2（条件付き） | 14 |

材料 tier × primary class（非 production 160 行）:

| primary \ 材料 tier | A | B | C |
|---|---|---|---|
| E | 11 | 11 | 32 |
| D | 19 | 8 | 23 |
| C | 0 | 0 | 26 |
| B | 0 | 26 | 0 |
| A | 4 | 0 | 0 |

> 読み方: 現行 29 材料だけで集合が組める行は 34 あるが、そのうち blocker 無しで入れられるのは 1 行（`aussie-pizzadb`、no-sauce）。残りは mechanic・authority・collision で止まる。+1 ingredient の 45 行も同様で、clean は 19（うち strict 5）。

## 3. 調査項目 1–7

### 3.1 現在の 29 ingredient だけで追加できる候補（材料 tier A、34 行）

| row id | primary | secondary | blocker 詳細 |
|---|---|---|---|
| `aussie-pizzadb` | A | — | — |
| `quattro-formaggi-pizzadb` | A | IDENTITY_COLLISION | COMPOSITION_CONFLICT_SHIPPED |
| `grandma-pizza-pizzadb` | D | — | MULTI_SPREAD_LAYER |
| `chicago-deep-dish-pizzadb` | D | IDENTITY_COLLISION | PAN_BAKE; STEP_ORDER; COMPOSITION_CONFLICT_CANDIDATE; NAMING_CLUSTER:NC-7-chicago |
| `siciliana-pizzadb` | D | IDENTITY_COLLISION | DOUGH_SHAPE_TARGET; DOUGH_VARIANT; PAN_BAKE; COMPOSITION_CONFLICT_CANDIDATE; NAMING_CLUSTER:NC-3-sicilian |
| `sfincione-pizzadb` | D | IDENTITY_COLLISION | MULTI_SPREAD_LAYER; NAMING_CLUSTER:NC-3-sicilian |
| `chilean-napolitana-pizzadb` | A | IDENTITY_COLLISION | NAMING_CLUSTER:NC-1-napoletana |
| `trenton-tomato-pie-pizzadb` | D | IDENTITY_COLLISION | STEP_ORDER; MATRIX_COLLISION_LEDGER:P0-COLL-1; SAME_SET_AS_ROWS:ny-style-pizzadb |
| `ny-style-pizzadb` | D | IDENTITY_COLLISION | DOUGH_VARIANT; MATRIX_COLLISION_LEDGER:P0-COLL-1; SAME_SET_AS_ROWS:trenton-tomato-pie-pizzadb |
| `margherita-pizzadb-row` | D | IDENTITY_COLLISION | MULTI_SPREAD_LAYER; COMPOSITION_CONFLICT_SHIPPED |
| `pizza-baiana` | E | — | UNRESOLVED_INGREDIENT |
| `pizza-a-caballo` | E | D | EVIDENCE_GAP; DOUGH_VARIANT; ENCLOSE |
| `fugazzeta-rellena` | D | — | DOUGH_VARIANT; ENCLOSE |
| `pizza-de-cancha` | E | D | UNRESOLVED_INGREDIENT; DOUGH_VARIANT; MULTI_SPREAD_LAYER |
| `st-louis-style-pizza-pizzadb-p4` | E | D | UNRESOLVED_INGREDIENT; DOUGH_VARIANT |
| `argentine-napolitana-pizzadb-p1` | D | IDENTITY_COLLISION | DOUGH_VARIANT; NAMING_CLUSTER:NC-1-napoletana |
| `old-forge-style-pizza-pizzadb-p1` | E | D | UNRESOLVED_INGREDIENT; DOUGH_SHAPE_TARGET; DOUGH_VARIANT; PAN_BAKE |
| `caponata-pizza-pizzadb-p2` | E | — | SAUCE_BASE_UNSPECIFIED |
| `cauliflower-crust-pizza-pizzadb-p2` | D | IDENTITY_COLLISION | DOUGH_VARIANT; MATRIX_COLLISION_LEDGER:P0-COLL-2; SAME_SET_AS_PRODUCTION:margherita; SAME_SET_AS_ROWS:pizza-al-taglio-romana-pizzadb-p9 |
| `keema-pizza-pizzadb-p2` | E | — | SAUCE_BASE_UNSPECIFIED; UNRESOLVED_INGREDIENT |
| `quad-cities-style-pizza-pizzadb-p2` | E | D | UNRESOLVED_INGREDIENT; DOUGH_VARIANT |
| `colorado-mountain-pie-pizzadb-p3` | E | D | EVIDENCE_GAP; PLACEHOLDER_TOPPING(お好みの具材); DOUGH_VARIANT |
| `chicago-stuffed-pizza-pizzadb-p3` | D | IDENTITY_COLLISION | DOUGH_VARIANT; ENCLOSE; NAMING_CLUSTER:NC-7-chicago; SAME_SET_AS_PRODUCTION:salsiccia |
| `new-england-bar-pizza-pizzadb-p6` | D | IDENTITY_COLLISION | DOUGH_VARIANT; PAN_BAKE; MATRIX_COLLISION_LEDGER:P0-COLL-3; SAME_SET_AS_PRODUCTION:pepperoni; SAME_SET_AS_ROWS:fathead-pizza-keto-pizzadb-p9 |
| `bismarck-pizza-pizzadb-p7` | A | IDENTITY_COLLISION | COMPOSITION_CONFLICT_SHIPPED |
| `pizza-chilena-pizzadb-p8` | E | — | UNRESOLVED_INGREDIENT |
| `pizza-romana-pizzadb-p9` | D | IDENTITY_COLLISION | DOUGH_VARIANT; COMPOSITION_CONFLICT_CANDIDATE |
| `pizza-al-taglio-romana-pizzadb-p9` | D | IDENTITY_COLLISION | DOUGH_SHAPE_TARGET; DOUGH_VARIANT; PAN_BAKE; MATRIX_COLLISION_LEDGER:P0-COLL-2; SAME_SET_AS_PRODUCTION:margherita; SAME_SET_AS_ROWS:cauliflower-crust-pizza-pizzadb-p2 |
| `fathead-pizza-keto-pizzadb-p9` | D | IDENTITY_COLLISION | DOUGH_VARIANT; MATRIX_COLLISION_LEDGER:P0-COLL-3; SAME_SET_AS_PRODUCTION:pepperoni; SAME_SET_AS_ROWS:new-england-bar-pizza-pizzadb-p6 |
| `fugazza-pizzadb-p10` | D | IDENTITY_COLLISION | DOUGH_VARIANT; COMPOSITION_CONFLICT_SHIPPED; DISCOVERY_COLLISION; MATRIX_COLLISION_LEDGER:P0-COLL-5; SAME_SET_AS_ROWS:fugazzetta-pizzadb-p10 |
| `fugazzetta-pizzadb-p10` | D | IDENTITY_COLLISION | DOUGH_VARIANT; COMPOSITION_CONFLICT_CANDIDATE; DISCOVERY_COLLISION; MATRIX_COLLISION_LEDGER:P0-COLL-5; SAME_SET_AS_ROWS:fugazza-pizzadb-p10 |
| `marinara-pizza-pizzadb-p13` | D | IDENTITY_COLLISION | MULTI_SPREAD_LAYER; COMPOSITION_CONFLICT_SHIPPED |
| `montreal-style-pizza-pizzadb-p13` | D | — | DOUGH_VARIANT; PAN_BAKE |
| `hokkaido-cheese-pizza-pizzadb-p15` | E | — | UNRESOLVED_INGREDIENT |

結論: **blocker 無しで current-material のみの候補は `aussie-pizzadb`（bacon, egg, mozzarella, onion／no-sauce）の 1 件だけ。** `quattro-formaggi-pizzadb` `bismarck-pizza-pizzadb-p7` `chilean-napolitana-pizzadb` は材料が揃うが、shipped / naming cluster と identity が衝突する（§3.3）。

### 3.2 新 ingredient 1 個で複数 recipe を解禁できるケース

「sole」= その ingredient を足すだけで集合が完成する B 行。「clean sole」= そのうち clean pool。「needing」= 材料に含む全行（E/D 含む）。

| 新 ingredient | category | needing（全行） | sole（B 行） | clean sole | strict sole | clean sole の行 |
|---|---|---|---|---|---|---|
| `chicken` | topping | 12 | 2 | 1 | 1 | `pesto-pollo-pizzadb-p12` |
| `parsley` | topping | 8 | 2 | 1 | 1 | `vongole-pizzadb` |
| `bell-pepper` | topping | 7 | 2 | 1 | 0 | `spanish-chorizo-pizza-pizzadb-p4` |
| `feta` | topping | 3 | 2 | 1 | 0 | `pizza-feta-eliniki-pizzadb-p9` |
| `palm-heart` | topping | 2 | 2 | 1 | 0 | `palmito-pizza-pizzadb-p7` |
| `green-onion` | topping | 6 | 1 | 1 | 0 | `tsukimi-pizza-pizzadb-p14` |
| `prosciutto-crudo` | topping | 6 | 1 | 1 | 1 | `prosciutto-funghi-pizzadb-p11` |
| `green-pepper` | topping | 5 | 1 | 1 | 0 | `veggie-supreme-pizza-pizzadb-p11` |
| `pork` | topping | 5 | 1 | 1 | 0 | `porchetta-pizza-pizzadb-p12` |
| `shrimp` | topping | 4 | 1 | 1 | 1 | `pesto-gamberi-pizzadb-p11` |
| `catupiry` | topping | 2 | 1 | 1 | 0 | `brazilian-catupiry-corn-pizza-pizzadb-p10` |
| `almond` | topping | 1 | 1 | 1 | 1 | `pesto-trapanese-pizzadb-p11` |
| `baked-beans` | topping | 1 | 1 | 1 | 0 | `full-english-pizza-pizzadb-p10` |
| `friarielli` | topping | 1 | 1 | 1 | 0 | `salsiccia-e-friarielli-pizzadb-p3` |
| `fromage-blanc-sauce` | sauce | 1 | 1 | 1 | 0 | `flammkuchen-pizzadb` |
| `hot-dog` | topping | 1 | 1 | 1 | 0 | `pizza-overload-pizzadb-p7` |
| `salt-cod` | topping | 1 | 1 | 1 | 0 | `bacalhau-pizzadb` |
| `sauerkraut` | topping | 1 | 1 | 1 | 0 | `polish-kielbasa-pizzadb-p12` |
| `beef` | topping | 9 | 2 | 0 | 0 | — |
| `honey` | sauce | 5 | 2 | 0 | 0 | — |
| `artichoke` | topping | 4 | 2 | 0 | 0 | — |
| `burrata` | topping | 3 | 2 | 0 | 0 | — |

2 個組（clean pool で集合が完成する行数が最大のもの。material A/B/C すべて含む）:

| 組 | 完成する clean 行（片方だけで完成する sole 行を含む） |
|---|---|
| `bell-pepper` + `zucchini` | 3: `spanish-chorizo-pizza-pizzadb-p4`, `pesto-vegetariana-pizzadb-p12`, `ratatouille-pizza-pizzadb-p13` |
| `catupiry` + `chicken` | 3: `brazilian-catupiry-corn-pizza-pizzadb-p10`, `frango-catupiry-pizzadb-p10`, `pesto-pollo-pizzadb-p12` |
| `almond` + `baked-beans` | 2: `full-english-pizza-pizzadb-p10`, `pesto-trapanese-pizzadb-p11` |
| `almond` + `bell-pepper` | 2: `spanish-chorizo-pizza-pizzadb-p4`, `pesto-trapanese-pizzadb-p11` |
| `almond` + `catupiry` | 2: `brazilian-catupiry-corn-pizza-pizzadb-p10`, `pesto-trapanese-pizzadb-p11` |

結論（正直な所見）: **「1 ingredient で大量解禁」できる hub 材料は無い。** clean な sole 行を 2 つ持つのは `chicken` `parsley` `bell-pepper` `feta` `palm-heart` だが、実際に clean と数えられる sole 行は各 1（もう 1 行は E/D/collision で止まる）。`chicken`（needing 12）は 10 行が sauce 未指定・ambiguous・late-add 等で blocked。再利用の効率は「材料 1 個で複数 recipe」ではなく「材料 2 個（`catupiry`+`chicken`）で 3 行」程度。**特に効率の良い新 ingredient**: `chicken`（pesto-pollo の strict 候補を含み、needing 最多）、`catupiry`+`chicken` の組、`parsley`（vongole strict + 将来 2 行）。ただし数値差は小さい。

### 3.3 同じ ingredient set を持つ recipe（matcher だけでは区別困難）

Discovery matcher は ingredient set（sauce 含む）の完全一致 + 11 identity dimensions で判定する。現行 flow は dimension を既定値に固定するため、集合が同じ行は dimension（dough/pan/layerOrder…）が実装されるまで**区別できない**。

**(a) 172 行どうしの同一集合:**

| 集合 | 行 | 区別に必要なもの |
|---|---|---|
| mozzarella, tomato-sauce | `trenton-tomato-pie-pizzadb`, `ny-style-pizzadb` | DOUGH_VARIANT + STEP_ORDER（P0-COLL-1） |
| basil, mozzarella, tomato-sauce | `cauliflower-crust-pizza-pizzadb-p2`, `pizza-al-taglio-romana-pizzadb-p9` | DOUGH_VARIANT + PAN_BAKE + DOUGH_SHAPE_TARGET（P0-COLL-2） |
| mozzarella | `quad-cities-style-pizza-pizzadb-p2`, `colorado-mountain-pie-pizzadb-p3` | どちらも E（UNRESOLVED / EVIDENCE_GAP）— 集合自体が不確定 |
| mozzarella, pepperoni, tomato-sauce | `new-england-bar-pizza-pizzadb-p6`, `fathead-pizza-keto-pizzadb-p9` | DOUGH_VARIANT + PAN_BAKE（P0-COLL-3） |
| arugula, mozzarella, prosciutto-crudo, tomato-sauce | `jamon-serrano-pizza-pizzadb-p7`, `pinsa-romana-pizzadb-p9` | DOUGH_VARIANT（P0-COLL-4） |
| mozzarella, onion, oregano | `fugazza-pizzadb-p10`, `fugazzetta-pizzadb-p10` | **区別不能**（fugazza / fugazzetta、DISCOVERY_RULE_BLOCKER、P0-COLL-5） |

**(b) production 26 件の集合と一致する非 production 行（5 件）:**

| row | 一致する production recipe | row の状態 |
|---|---|---|
| `cauliflower-crust-pizza-pizzadb-p2` | `margherita` | D（DOUGH_VARIANT） |
| `chicago-stuffed-pizza-pizzadb-p3` | `salsiccia` | D（DOUGH_VARIANT, ENCLOSE） |
| `new-england-bar-pizza-pizzadb-p6` | `pepperoni` | D（DOUGH_VARIANT, PAN_BAKE） |
| `pizza-al-taglio-romana-pizzadb-p9` | `margherita` | D（DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE） |
| `fathead-pizza-keto-pizzadb-p9` | `pepperoni` | D（DOUGH_VARIANT） |

これらは「新 recipe」ではなく、既存 recipe と同じ集合を mechanic（dough variant / pan / enclose）で言い分ける行。dimension 実装前に追加すると既存 recipe と区別できないため **追加不可（mechanic 隔離）**。

**(c) 名前・composition の衝突（identity collision フラグ 42 行の内訳）:**

| 種別 | 行数 |
|---|---|
| COMPOSITION_CONFLICT_CANDIDATE | 18 |
| NAMING_CLUSTER | 11 |
| MATRIX_COLLISION_LEDGER | 10 |
| SAME_SET_AS_ROWS | 10 |
| COMPOSITION_CONFLICT_SHIPPED | 9 |
| SAME_SET_AS_PRODUCTION | 5 |
| DISCOVERY_COLLISION | 2 |

（1 行が複数種別に該当し得る。行ごとの詳細は companion JSON の `identityCollisions`。）

**collision 総数:** 同一集合グループ 6（うち production との一致 5 行を別掲）、identity collision フラグ付き行 42。

### 3.4 sauce なし / cheese なし と現行 key-free Hint authority

`hint5Ladder.ts` の key-free 分岐は、sauce 材料があれば SAUCE rung、cheese 材料があれば CHEESE rung、STRUCTURE（常に 1）、topping ごとに SUB_CLASS を積み、**該当しない rung は存在させない**（空 rung / 「なし」回答なし）。

| ケース | Hint authority | 現行 production での実証 | 追加で必要なもの |
|---|---|---|---|
| **cheese なし** | rung 構成のみで表現可（CHEESE rung 省略） | **実証済み**: production 26 のうち cheese 無しは `marinara` `fugazza` `pizza-bianca` `pesto-tonno` `puttanesca-pizza` `brazilian-calabresa`（calabresa は key-free で出荷） | なし |
| **sauce なし** | Hint rung は表現可（SAUCE rung 省略） | **未実証**: production 26 全件が sauce-category 材料（tomato-sauce / olive-oil / pesto）を含む | `deriveCoreSteps` は SAUCE step を省く（コード上可）が、`RECIPE_SAUCE_PROFILES` は全 `RecipeId` の total Record で `ingredientId` が 3 値の union。**no-sauce 用の profile 表現が無い → 追加前に Owner/設計判断**。cooking/reference/scoring の no-sauce 経路は production で一度も通っていない |
| **新 sauce 材料**（bbq-sauce, fromage-blanc-sauce, miso-sauce 等） | sauce rung は category で成立 | 未実証 | `RecipeSauceProfile.ingredientId` union の拡張・PAINT 等の interaction 決定が必要（新 mechanic ではないが code 型変更） |
| **新 topping 材料** | 各 topping は SUB_CLASS で 1 rung | — | `hint5RolesValid` の T-COV: **topping は exactly-one の family 行が必須**（無いと fail-closed で Hint 不成立）。family 行は PR #255 の proposed 分類（OD-TAX-7 Human Classification Gate 未了）を要確認 |

no-sauce かつ E なしの非 production 行: 28（うち clean pool 18）。**key-free Hint 自体で表現可否が分かれる行は無いが、no-sauce の engine 経路が未実証のため Tier 2 に隔離**。E 行（54）は集合が不確定なので key-free Hint も authority が作れない。

### 3.5 CUT / thin crust / shape 等の mechanic dependency（隔離表、「不能」とは決めない）

CUT・薄生地は Owner 方針で今回対象外（#295 未着手）。`DOUGH_VARIANT` 等はここでは「必要 capability」として行を隔離するだけで、実装可否は判断しない。

| capability | 該当行（全 160 行中） | うち 材料 A/B かつ E なし | 備考 |
|---|---|---|---|
| DOUGH_VARIANT | 33 | 15 | 薄生地・低糖質・長時間発酵など。dough class が variant の行 |
| MULTI_SPREAD_LAYER | 17 | 7 | sauce が 2 層以上（例 tomato-sauce + olive-oil）。現行は sauce 1 種のみ |
| LATE_ADDITION | 12 | 2 | 焼成後追加（post-bake） |
| MECHANIC_INTERPRETATION(inferred, not promoted) | 11 | 0 | 推測のみの mechanic フラグ（昇格させない） |
| PAN_BAKE | 8 | 7 | tray / deep-dish 等 |
| ENCLOSE | 5 | 3 | calzone 系・stuffed |
| DOUGH_SHAPE_TARGET | 5 | 3 | 四角・半月 |
| PREP_STEP | 3 | 0 | 下準備工程 |
| STEP_ORDER | 2 | 2 | cheese→sauce 等の順序 |
| ZONED_PLACEMENT | 1 | 1 | 半々配置 |
| FRY_COOK | 1 | 0 | 揚げ |
| LAMINATE | 1 | 0 | 折り込み |

**mechanic だけが止めている行（材料 A/B・E なし、27 行。collision 無しは 8 行）:**

| row | 材料 | missing | 必要 capability | collision |
|---|---|---|---|---|
| `quattro-stagioni-pizzadb` | B | `artichoke` | ZONED_PLACEMENT | — |
| `grandma-pizza-pizzadb` | A | — | MULTI_SPREAD_LAYER | — |
| `greek-style-pizzadb` | B | `feta` | DOUGH_VARIANT, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE |
| `chicago-deep-dish-pizzadb` | A | — | PAN_BAKE, STEP_ORDER | COMPOSITION_CONFLICT_CANDIDATE; NAMING_CLUSTER:NC-7-chicago |
| `siciliana-pizzadb` | A | — | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE; NAMING_CLUSTER:NC-3-sicilian |
| `sfincione-pizzadb` | A | — | MULTI_SPREAD_LAYER | NAMING_CLUSTER:NC-3-sicilian |
| `trenton-tomato-pie-pizzadb` | A | — | STEP_ORDER | MATRIX_COLLISION_LEDGER:P0-COLL-1; SAME_SET_AS_ROWS:ny-style-pizzadb |
| `ny-style-pizzadb` | A | — | DOUGH_VARIANT | MATRIX_COLLISION_LEDGER:P0-COLL-1; SAME_SET_AS_ROWS:trenton-tomato-pie-pizzadb |
| `margherita-pizzadb-row` | A | — | MULTI_SPREAD_LAYER | COMPOSITION_CONFLICT_SHIPPED |
| `fugazzeta-rellena` | A | — | DOUGH_VARIANT, ENCLOSE | — |
| `scacciata-ragusana-pizzadb-p4` | B | `caciocavallo` | ENCLOSE | — |
| `argentine-napolitana-pizzadb-p1` | A | — | DOUGH_VARIANT | NAMING_CLUSTER:NC-1-napoletana |
| `cauliflower-crust-pizza-pizzadb-p2` | A | — | DOUGH_VARIANT | MATRIX_COLLISION_LEDGER:P0-COLL-2; SAME_SET_AS_PRODUCTION:margherita; SAME_SET_AS_ROWS:pizza-al-taglio-romana-pizzadb-p9 |
| `chicago-stuffed-pizza-pizzadb-p3` | A | — | DOUGH_VARIANT, ENCLOSE | NAMING_CLUSTER:NC-7-chicago; SAME_SET_AS_PRODUCTION:salsiccia |
| `detroit-style-pizza-pizzadb-p5` | B | `brick-cheese` | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, LATE_ADDITION, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE |
| `new-england-bar-pizza-pizzadb-p6` | A | — | DOUGH_VARIANT, PAN_BAKE | MATRIX_COLLISION_LEDGER:P0-COLL-3; SAME_SET_AS_PRODUCTION:pepperoni; SAME_SET_AS_ROWS:fathead-pizza-keto-pizzadb-p9 |
| `pizza-romana-pizzadb-p9` | A | — | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE |
| `pizza-al-taglio-romana-pizzadb-p9` | A | — | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | MATRIX_COLLISION_LEDGER:P0-COLL-2; SAME_SET_AS_PRODUCTION:margherita; SAME_SET_AS_ROWS:cauliflower-crust-pizza-pizzadb-p2 |
| `fathead-pizza-keto-pizzadb-p9` | A | — | DOUGH_VARIANT | MATRIX_COLLISION_LEDGER:P0-COLL-3; SAME_SET_AS_PRODUCTION:pepperoni; SAME_SET_AS_ROWS:new-england-bar-pizza-pizzadb-p6 |
| `fugazza-pizzadb-p10` | A | — | DOUGH_VARIANT | COMPOSITION_CONFLICT_SHIPPED; DISCOVERY_COLLISION; MATRIX_COLLISION_LEDGER:P0-COLL-5; SAME_SET_AS_ROWS:fugazzetta-pizzadb-p10 |
| `fugazzetta-pizzadb-p10` | A | — | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE; DISCOVERY_COLLISION; MATRIX_COLLISION_LEDGER:P0-COLL-5; SAME_SET_AS_ROWS:fugazza-pizzadb-p10 |
| `burrata-pizza-pizzadb-p10` | B | `burrata` | MULTI_SPREAD_LAYER | — |
| `pesto-burrata-pizzadb-p12` | B | `burrata` | MULTI_SPREAD_LAYER | — |
| `hot-honey-pepperoni-pizzadb-p12` | B | `honey` | MULTI_SPREAD_LAYER | — |
| `marinara-pizza-pizzadb-p13` | A | — | MULTI_SPREAD_LAYER | COMPOSITION_CONFLICT_SHIPPED |
| `montreal-style-pizza-pizzadb-p13` | A | — | DOUGH_VARIANT, PAN_BAKE | — |
| `black-truffle-pizza-pizzadb-p14` | B | `truffle` | LATE_ADDITION | COMPOSITION_CONFLICT_CANDIDATE |

`MULTI_SPREAD_LAYER`（grandma / burrata / pesto-burrata / hot-honey-pepperoni、2 層 sauce）と `DOUGH_VARIANT`/`PAN_BAKE`（montreal-style）は、capability が入れば A/B で入る行。**どの mechanic が何行を解禁するか**は Owner の優先度判断材料（§6）。

### 3.6 source authority が曖昧な行（calibration で補完しない）

| E の種別 | 行数 | 代表（全件は JSON / 付録） |
|---|---|---|
| SAUCE_BASE_UNSPECIFIED | 33 | `apple-cinnamon-dessert-pizzadb`, `swedish-kebab-pizza-pizzadb-p4`, `smore-dessert-pizza-pizzadb-p4`, `eel-pizza-pizzadb-p1`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `caponata-pizza-pizzadb-p2` … |
| UNRESOLVED_INGREDIENT | 21 | `pizza-baiana`, `pizza-de-cancha`, `swedish-kebab-pizza-pizzadb-p4`, `st-louis-style-pizza-pizzadb-p4`, `thai-chicken-pizza-pizzadb-p4`, `old-forge-style-pizza-pizzadb-p1` … |
| EVIDENCE_GAP | 2 | `pizza-a-caballo`, `colorado-mountain-pie-pizzadb-p3` |
| SCOPE_QUESTION | 2 | `feteer-meshaltet-pizzadb-p10`, `focaccia-genovese-pizzadb-p10` |
| PLACEHOLDER_TOPPING(お好みの具材) | 1 | `colorado-mountain-pie-pizzadb-p3` |

- `SAUCE_BASE_UNSPECIFIED`（33）: sauceFamily が カレー / ホットソース / ホワイト / その他 等の汎用ラベルで、具体 sauce が材料欄に無い。base を推測で決めない。
- `UNRESOLVED_INGREDIENT`（21）: ambiguous token（例: 「チーズ」「ソース」の種類不明）。identity set 自体が確定しない。
- `EVIDENCE_GAP`（2）/ `SCOPE_QUESTION`（2）/ プレースホルダー具材（1: `colorado-mountain-pie`）。
- authority 強度（companion JSON `authorityStrength`）: STRONG = corroboration 1 件以上 or 個別プロフィール由来で caveat なし／MODERATE = comparison-table 単独／MODERATE_WITH_CAVEATS = `likely_alias` token・taxonomy flag・sauce が family ラベル由来のいずれか／INCOMPLETE = E。

### 3.7 source authority と gameplay calibration の区別（No.26 の方針を維持）

| 区分 | 内容 | 本書での扱い |
|---|---|---|
| **source authority** | 材料の集合（sauce 含む）・sauceFamily・dough 記述・corroboration | 行ごとに記録。曖昧は E として保留 |
| **gameplay calibration** | minCount・bakeTarget・baseRewardPitz・Reference 配置・`ladderCredit` / `lunchRush`・Hint 順序 | **一切決めない**（UNDECIDED）。No.26 の「Counts / bake window は calibration（Owner D-6）」と同じ |
| **alias 判断** | `black-olive` ← source "olive"（likely_alias）のような正規化 | `likely_alias` を authorityCaveats に残す。caveat 付き行は strict から外す |

## 4. Recommended First Expansion Candidates

**条件:** current materials only または +1 ingredient／mechanic 不要（matrix FULL・推測のみ capability なし）／identity collision なし／E なし。Tier 1 はさらに「sauce 材料あり・薄生地記述なし・新 sauce 材料なし・`likely_alias`/taxonomy flag なし」。**ランキングではなく、実装しやすさの条件を満たす群。次の recipe はここでは決めない。**

**所見:** current-material only で条件を満たす行は **0**（唯一の clean A は no-sauce で Tier 2）。+1 ingredient の strict 該当は **5 件**。条件を満たす数が少ないため無理に増やしていない。

### 4.1 Tier 1（strict、5 件）

#### `vongole-pizzadb` — ヴォンゴレピザ

- **identity set:** `clam`, `garlic`, `olive-oil`, `parsley`（production 既存 3／missing `parsley`）
- **なぜ実装しやすいか:** E・D・collision いずれも無し／matrix FULL・READY系（READY）／sauce 材料あり／薄生地等の dough 記述なし／既存 flow（DOUGH→SAUCE→CHEESE→TOPPING）のみ。
- **新 ingredient:** 要（`parsley`、category `topping`）。Shop 登録は W1 ladder 凍結のため **append-only の step 25 以降**になる（`POST_W1_APPENDED_STEPS`）。
- **branching:** 同じ `parsley` を要する他行 7（clean 2: `eggplant-tahini-pizza-pizzadb-p5`, `baba-ganoush-pizza-pizzadb-p7`）。
- **OPEN_POOL の可能性:** 新 ingredient の append step で key recipe は本 recipe 自身になるため、それ単独では pool=1。ただし **`brazilian-calabresa`（未発見の間 pool 2 が step 12 以降持続）** と、同 step で DISCOVERABLE な他の未発見 recipe があれば pool≥2（No.26 と同じ機構）。実測は未実施（本タスク範囲外）。
- **Hint rung 構成（key-free 想定）:** SAUCE(olive-oil) → STRUCTURE → SUB_CLASS×3（topping の順序は catalog 順＝新 ingredient の登録位置で決まる）。
- **known authority caveat:** sauceFamily は「ノンソース」だが材料に `olive-oil` を含む（sauce 層として扱う解釈は Owner 確認）; 新 topping `parsley` は Hint family 行（T-COV）が必須（PR #255 proposed、OD-TAX-7 未了）; 個数・bakeTarget・Reference は全て gameplay calibration（source に量なし）。
- ladderCredit / Lunch Rush: **未決定**。

#### `prosciutto-funghi-pizzadb-p11` — プロシュットフンギ

- **identity set:** `mozzarella`, `mushroom`, `prosciutto-crudo`, `tomato-sauce`（production 既存 3／missing `prosciutto-crudo`）
- **なぜ実装しやすいか:** E・D・collision いずれも無し／matrix FULL・READY系（READY_WITH_REVIEW）／sauce 材料あり／薄生地等の dough 記述なし／既存 flow（DOUGH→SAUCE→CHEESE→TOPPING）のみ。
- **新 ingredient:** 要（`prosciutto-crudo`、category `topping`）。Shop 登録は W1 ladder 凍結のため **append-only の step 25 以降**になる（`POST_W1_APPENDED_STEPS`）。
- **branching:** 同じ `prosciutto-crudo` を要する他行 5（clean 1: `rucola-e-grana-pizzadb-p13`）。
- **OPEN_POOL の可能性:** 新 ingredient の append step で key recipe は本 recipe 自身になるため、それ単独では pool=1。ただし **`brazilian-calabresa`（未発見の間 pool 2 が step 12 以降持続）** と、同 step で DISCOVERABLE な他の未発見 recipe があれば pool≥2（No.26 と同じ機構）。実測は未実施（本タスク範囲外）。
- **Hint rung 構成（key-free 想定）:** SAUCE(tomato-sauce) → CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×2（topping の順序は catalog 順＝新 ingredient の登録位置で決まる）。
- **known authority caveat:** sauce base は sauceFamily「トマトソース」由来（matrix §1.2 の family_derived。材料欄に明記は無い）; 新 topping `prosciutto-crudo` は Hint family 行（T-COV）が必須（PR #255 proposed、OD-TAX-7 未了）; 個数・bakeTarget・Reference は全て gameplay calibration（source に量なし）; matrix status は READY_WITH_REVIEW（レビュー項目あり）; master catalog に同集合の candidate `prosciutto-e-funghi` があるが未 shipped（collision ではない。名前の統合は Owner 判断）。
- ladderCredit / Lunch Rush: **未決定**。

#### `pesto-gamberi-pizzadb-p11` — ペストガンベリピザ

- **identity set:** `fresh-tomato`, `garlic`, `pesto`, `shrimp`（production 既存 3／missing `shrimp`）
- **なぜ実装しやすいか:** E・D・collision いずれも無し／matrix FULL・READY系（READY）／sauce 材料あり／薄生地等の dough 記述なし／既存 flow（DOUGH→SAUCE→CHEESE→TOPPING）のみ。
- **新 ingredient:** 要（`shrimp`、category `topping`）。Shop 登録は W1 ladder 凍結のため **append-only の step 25 以降**になる（`POST_W1_APPENDED_STEPS`）。
- **branching:** 同じ `shrimp` を要する他行 3（clean 1: `yuzu-shrimp-pizza`）。
- **OPEN_POOL の可能性:** 新 ingredient の append step で key recipe は本 recipe 自身になるため、それ単独では pool=1。ただし **`brazilian-calabresa`（未発見の間 pool 2 が step 12 以降持続）** と、同 step で DISCOVERABLE な他の未発見 recipe があれば pool≥2（No.26 と同じ機構）。実測は未実施（本タスク範囲外）。
- **Hint rung 構成（key-free 想定）:** SAUCE(pesto) → STRUCTURE → SUB_CLASS×3（topping の順序は catalog 順＝新 ingredient の登録位置で決まる）。
- **known authority caveat:** sauce base は sauceFamily「バジル」由来（matrix §1.2 の family_derived。材料欄に明記は無い）; 新 topping `shrimp` は Hint family 行（T-COV）が必須（PR #255 proposed、OD-TAX-7 未了）; 個数・bakeTarget・Reference は全て gameplay calibration（source に量なし）。
- ladderCredit / Lunch Rush: **未決定**。

#### `pesto-trapanese-pizzadb-p11` — ペストトラパネーゼピザ

- **identity set:** `almond`, `fresh-tomato`, `garlic`, `pesto`（production 既存 3／missing `almond`）
- **なぜ実装しやすいか:** E・D・collision いずれも無し／matrix FULL・READY系（READY）／sauce 材料あり／薄生地等の dough 記述なし／既存 flow（DOUGH→SAUCE→CHEESE→TOPPING）のみ。
- **新 ingredient:** 要（`almond`、category `topping`）。Shop 登録は W1 ladder 凍結のため **append-only の step 25 以降**になる（`POST_W1_APPENDED_STEPS`）。
- **branching:** 同じ `almond` を要する他行 0（clean 0: —）。
- **OPEN_POOL の可能性:** 新 ingredient の append step で key recipe は本 recipe 自身になるため、それ単独では pool=1。ただし **`brazilian-calabresa`（未発見の間 pool 2 が step 12 以降持続）** と、同 step で DISCOVERABLE な他の未発見 recipe があれば pool≥2（No.26 と同じ機構）。実測は未実施（本タスク範囲外）。
- **Hint rung 構成（key-free 想定）:** SAUCE(pesto) → STRUCTURE → SUB_CLASS×3（topping の順序は catalog 順＝新 ingredient の登録位置で決まる）。
- **known authority caveat:** sauce base は sauceFamily「バジル」由来（matrix §1.2 の family_derived。材料欄に明記は無い）; 新 topping `almond` は Hint family 行（T-COV）が必須（PR #255 proposed、OD-TAX-7 未了）; 個数・bakeTarget・Reference は全て gameplay calibration（source に量なし）。
- ladderCredit / Lunch Rush: **未決定**。

#### `pesto-pollo-pizzadb-p12` — ペストポッロピザ

- **identity set:** `chicken`, `fresh-tomato`, `mozzarella`, `pesto`（production 既存 3／missing `chicken`）
- **なぜ実装しやすいか:** E・D・collision いずれも無し／matrix FULL・READY系（READY）／sauce 材料あり／薄生地等の dough 記述なし／既存 flow（DOUGH→SAUCE→CHEESE→TOPPING）のみ。
- **新 ingredient:** 要（`chicken`、category `topping`）。Shop 登録は W1 ladder 凍結のため **append-only の step 25 以降**になる（`POST_W1_APPENDED_STEPS`）。
- **branching:** 同じ `chicken` を要する他行 11（clean 1: `frango-catupiry-pizzadb-p10`）。
- **OPEN_POOL の可能性:** 新 ingredient の append step で key recipe は本 recipe 自身になるため、それ単独では pool=1。ただし **`brazilian-calabresa`（未発見の間 pool 2 が step 12 以降持続）** と、同 step で DISCOVERABLE な他の未発見 recipe があれば pool≥2（No.26 と同じ機構）。実測は未実施（本タスク範囲外）。
- **Hint rung 構成（key-free 想定）:** SAUCE(pesto) → CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×2（topping の順序は catalog 順＝新 ingredient の登録位置で決まる）。
- **known authority caveat:** sauce base は sauceFamily「バジル」由来（matrix §1.2 の family_derived。材料欄に明記は無い）; 新 topping `chicken` は Hint family 行（T-COV）が必須（PR #255 proposed、OD-TAX-7 未了）; 個数・bakeTarget・Reference は全て gameplay calibration（source に量なし）。
- ladderCredit / Lunch Rush: **未決定**。

### 4.2 Tier 2（条件付き、14 件 — 追加前に別の判断が要る）

| row | 材料 | missing | 条件（これが解消されるまで Tier 1 ではない） | Hint rung（key-free） |
|---|---|---|---|---|
| `aussie-pizzadb` | A | — | no-sauce の engine 経路が未実証（§3.4） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×3 |
| `flammkuchen-pizzadb` | B | `fromage-blanc-sauce` | 新 sauce 材料 → `RecipeSauceProfile` 型の拡張 | SAUCE(fromage-blanc-sauce) → STRUCTURE → SUB_CLASS×2 |
| `bacalhau-pizzadb` | B | `salt-cod` | no-sauce の engine 経路が未実証（§3.4） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×3 |
| `spanish-chorizo-pizza-pizzadb-p4` | B | `bell-pepper` | no-sauce の engine 経路が未実証（§3.4）; 薄生地記述「薄め」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×3 |
| `salsiccia-e-friarielli-pizzadb-p3` | B | `friarielli` | no-sauce の engine 経路が未実証（§3.4） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×2 |
| `palmito-pizza-pizzadb-p7` | B | `palm-heart` | no-sauce の engine 経路が未実証（§3.4）; 薄生地記述「薄めの生地」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外）; likely_alias×1 | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×2 |
| `pizza-overload-pizzadb-p7` | B | `hot-dog` | 薄生地記述「薄めの生地」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外）; taxonomyFlags×1; sauce_from_family_label | SAUCE(tomato-sauce) → CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×4 |
| `pizza-feta-eliniki-pizzadb-p9` | B | `feta` | 薄生地記述「薄めの生地」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外）; likely_alias×1 | SAUCE(olive-oil) → STRUCTURE → SUB_CLASS×4 |
| `brazilian-catupiry-corn-pizza-pizzadb-p10` | B | `catupiry` | no-sauce の engine 経路が未実証（§3.4）; 薄生地記述「薄めの生地」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×2 |
| `full-english-pizza-pizzadb-p10` | B | `baked-beans` | no-sauce の engine 経路が未実証（§3.4）; 薄生地記述「薄めの生地」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×4 |
| `veggie-supreme-pizza-pizzadb-p11` | B | `green-pepper` | 薄生地記述「薄めから中厚」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外）; likely_alias×1; sauce_from_family_label | SAUCE(tomato-sauce) → CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×5 |
| `polish-kielbasa-pizzadb-p12` | B | `sauerkraut` | no-sauce の engine 経路が未実証（§3.4）; 薄生地記述「薄めの生地」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×3 |
| `porchetta-pizza-pizzadb-p12` | B | `pork` | no-sauce の engine 経路が未実証（§3.4） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×2 |
| `tsukimi-pizza-pizzadb-p14` | B | `green-onion` | no-sauce の engine 経路が未実証（§3.4）; 薄生地記述「薄めの生地」（matrix は capability 不要と判定だが thin-crust mechanic は今回対象外） | CHEESE(mozzarella) → STRUCTURE → SUB_CLASS×3 |

Tier 2 の A 行 `aussie-pizzadb`（current material のみ、新 ingredient 不要）は唯一の「材料追加ゼロ」候補。key step = bacon(2)/egg(1)/onion(12)/mozzarella(starter) の最大 = **step 12**。step 12 は既に `pizza-portuguesa` と `brazilian-calabresa` が pool 2 であり、追加すると **pool 3（OPEN_POOL 継続）** になる（calabresa と同じく未発見の間、step 13–24 も pool が持続）。branching は最も増やせるが、no-sauce が未実証。

### 4.3 候補群の俯瞰

- **branching を増やす観点**: 材料が既存の key step と重なる A 行（aussie）が最も pool を厚くする。+1 行は append step で pool=1 から始まり、`catupiry`+`chicken` の 2 材料で 3 行（うち Tier 1 は `pesto-pollo` のみ）のような**小さな束**しか作れない。
- **大量追加は不可**: strict で 5 件。残りは mechanic / authority / collision が先に解決される必要がある（§3.5・3.6）。

## 5. Owner Decision Needed（本書では確定しない）

| # | 論点 | 影響行 |
|---|---|---|
| 1 | **no-sauce recipe を production で許すか**（`RECIPE_SAUCE_PROFILES` に none 表現を足すか、sauce を暗黙補完しないか）。source の「sauceFamily=チーズ」を sauce 無しと読む根拠は matrix 側にあるが engine 経路は未実証 | no-sauce・E なし 28 行（Tier 2 の 10 件を含む） |
| 2 | **薄生地記述（「薄め」）を identity dimension（DOUGH_VARIANT）として扱うか。** matrix は capability 不要と判定しているが、thin-crust mechanic は Owner 方針で今回対象外 | Tier 2 の薄生地 9 件ほか |
| 3 | **新 sauce 材料（bbq-sauce, fromage-blanc-sauce 等）の sauce profile**（PAINT / PAINT_TEMPORARY / 新 interaction）の方針 | `flammkuchen` ほか sauce 系 missing を持つ行 |
| 4 | **family_derived sauce（バジル→pesto、トマトソース→tomato-sauce）を identity 材料として採用してよいか**（matrix の既定ルールだが材料欄には記載無し） | pesto 系 Tier 1 3 件・prosciutto-funghi |
| 5 | **名前が既存 recipe と同系統の行**（napoletana / bianca / calabresa / sicilian family）の扱い（別 recipe 名として追加するか、統合/保留か） | NAMING_CLUSTER 11 行 |
| 6 | **新 ingredient の ladder 位置**（append-only step 25 以降の価格 tier）と、追加 recipe の `ladderCredit` / Lunch Rush 参加（全て UNDECIDED） | 全候補 |
| 7 | **新 topping の Hint family 分類**（PR #255 proposed / OD-TAX-7 Human Classification Gate） | 新 topping を要する全候補 |
| 8 | **どの mechanic を先に実装するか**（MULTI_SPREAD_LAYER・DOUGH_VARIANT・LATE_ADDITION の順が #188 推奨、A/B で mechanic だけが止めている 8 行の解禁量が材料） | §3.5 の 8 行 |

## 6. この監査の限界

- matrix の `identityIngredientSet` を identity authority とした（#188 の canonicalization と family_derived ルールをそのまま継承）。172 データの再収集・再 canonicalize はしていない。
- OPEN_POOL / branching は `recipeDiscoveryState` と W1 ladder の規則からの**机上評価**（simulation 未実施、実測は後続 slice）。
- 新 topping の Hint family 行の有無は PR #255 の proposed 状態に依存し、本書では個別に検証していない。
- 本書の集計は read-only の一時スクリプトで生成した（repo には追加していない）。companion JSON が再集計の入力になる。
- full Vitest / WebKit / Chromium / production build / Human Verification / Codex review は不要指示のため未実施。

## 付録 A: 172 行の分類一覧

凡例: **class** = primary（IN_PROD = 既存）／**sec** = secondary／**mat** = 材料 tier（missing 数）／**S/C** = sauce あり・cheese あり／**key-free** = Hint authority が作れるか（E 行は不可）／**tier** = §4。

| row id | class | sec | mat (missing) | S/C | key-free | mechanic | collision | tier |
|---|---|---|---|---|---|---|---|---|
| `bbq-chicken-pizzadb` | D | C | C(3) | S/C | Y | LATE_ADDITION |  |  |
| `apple-cinnamon-dessert-pizzadb` | E | C | C(4) | –/– | N |  |  |  |
| `calabresa-argentina-pizzadb` | B | IDENTITY_COLLISION | B(1) | S/C | Y |  | 1 |  |
| `vongole-pizzadb` | B |  | B(1) | S/– | Y |  |  | T1 |
| `aussie-pizzadb` | A |  | A(0) | –/C | Y |  |  | T2 |
| `capricciosa-pizzadb` | B | IDENTITY_COLLISION | B(1) | S/C | Y |  | 1 |  |
| `currywurst-pizzadb` | C |  | C(3) | S/C | Y |  |  |  |
| `calzone-pizzadb` | D | C,IDENTITY_COLLISION | C(2) | S/C | Y | ENCLOSE | 1 |  |
| `quattro-stagioni-pizzadb` | D | B | B(1) | S/C | Y | ZONED_PLACEMENT |  |  |
| `quattro-formaggi-pizzadb` | A | IDENTITY_COLLISION | A(0) | –/C | Y |  | 1 |  |
| `grandma-pizza-pizzadb` | D |  | A(0) | S/C | Y | MULTI_SPREAD_LAYER |  |  |
| `greek-style-pizzadb` | D | B,IDENTITY_COLLISION | B(1) | S/C | Y | DOUGH_VARIANT,PAN_BAKE | 1 |  |
| `chicago-deep-dish-pizzadb` | D | IDENTITY_COLLISION | A(0) | S/C | Y | PAN_BAKE,STEP_ORDER | 2 |  |
| `siciliana-pizzadb` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_SHAPE_TARGET,DOUGH_VARIANT,PAN_BAKE | 2 |  |
| `sfincione-pizzadb` | D | IDENTITY_COLLISION | A(0) | S/– | Y | MULTI_SPREAD_LAYER | 1 |  |
| `supreme-pizzadb` | B | IDENTITY_COLLISION | B(1) | S/– | Y |  | 1 |  |
| `taco-pizza-pizzadb` | D | C | C(5) | S/– | Y | INFERRED |  |  |
| `flammkuchen-pizzadb` | B |  | B(1) | S/– | Y |  |  | T2 |
| `chilean-napolitana-pizzadb` | A | IDENTITY_COLLISION | A(0) | –/C | Y |  | 1 |  |
| `trenton-tomato-pie-pizzadb` | D | IDENTITY_COLLISION | A(0) | S/C | Y | STEP_ORDER | 2 |  |
| `tonno-e-cipolla-pizzadb` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `new-haven-apizza-pizzadb` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `ny-style-pizzadb` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_VARIANT | 2 |  |
| `bacalhau-pizzadb` | B |  | B(1) | –/C | Y |  |  | T2 |
| `buffalo-chicken-pizzadb` | D | C,IDENTITY_COLLISION | C(3) | S/C | Y | LATE_ADDITION,MULTI_SPREAD_LAYER | 1 |  |
| `margherita-pizzadb-row` | D | IDENTITY_COLLISION | A(0) | S/C | Y | MULTI_SPREAD_LAYER | 1 |  |
| `pizza-baiana` | E |  | A(0)+? | –/C | N |  |  |  |
| `pizza-a-caballo` | E | D | A(0) | –/C | N | DOUGH_VARIANT,ENCLOSE |  |  |
| `fugazzeta-rellena` | D |  | A(0) | –/C | Y | DOUGH_VARIANT,ENCLOSE |  |  |
| `bianca-pizzadb-row` | B | IDENTITY_COLLISION | B(1) | S/C | Y |  | 1 |  |
| `pizza-de-cancha` | E | D | A(0)+? | S/– | N | DOUGH_VARIANT,MULTI_SPREAD_LAYER |  |  |
| `hawaiian-pizzadb-row` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `swedish-kebab-pizza-pizzadb-p4` | E | C | C(2)+? | S/C | N |  |  |  |
| `scacciata-ragusana-pizzadb-p4` | D | B | B(1) | S/C | Y | ENCLOSE |  |  |
| `spanish-chorizo-pizza-pizzadb-p4` | B |  | B(1) | –/C | Y |  |  | T2 |
| `spinach-artichoke-pizza-pizzadb-p4` | C |  | C(3) | –/C | Y |  |  |  |
| `speck-e-brie-pizzadb-p4` | C | IDENTITY_COLLISION | C(3) | –/C | Y |  | 2 |  |
| `smore-dessert-pizza-pizzadb-p4` | E | D,C | C(3) | –/– | N | LATE_ADDITION |  |  |
| `st-louis-style-pizza-pizzadb-p4` | E | D | A(0)+? | –/– | N | DOUGH_VARIANT |  |  |
| `thai-chicken-pizza-pizzadb-p4` | E | C | C(3)+? | S/C | N |  |  |  |
| `mentaiko-cream-pizza-pizzadb-p4` | D | C | C(4) | S/C | Y | LATE_ADDITION |  |  |
| `argentine-napolitana-pizzadb-p1` | D | IDENTITY_COLLISION | A(0) | –/C | Y | DOUGH_VARIANT | 1 |  |
| `ikura-salmon-pizza-pizzadb-p1` | C |  | C(4) | –/– | Y |  |  |  |
| `vegan-cashew-cheese-pizza-pizzadb-p1` | C |  | C(3) | S/– | Y |  |  |  |
| `eel-pizza-pizzadb-p1` | E | D,C | C(3) | –/C | N | LATE_ADDITION,INFERRED |  |  |
| `jerusalem-mixed-grill-pizza-pizzadb-p1` | E | C | C(3) | –/– | N |  |  |  |
| `old-forge-style-pizza-pizzadb-p1` | E | D | A(0)+? | –/– | N | DOUGH_SHAPE_TARGET,DOUGH_VARIANT,PAN_BAKE |  |  |
| `okonomiyaki-style-pizza-pizzadb-p1` | E | D,C | C(5)+? | S/– | N | MULTI_SPREAD_LAYER |  |  |
| `caponata-pizza-pizzadb-p2` | E |  | A(0) | –/C | N |  |  |  |
| `california-style-pizza-pizzadb-p2` | C |  | C(3) | –/– | Y |  |  |  |
| `cauliflower-crust-pizza-pizzadb-p2` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_VARIANT | 3 |  |
| `curry-pizza-japan-pizzadb-p2` | E | B | B(1)+? | –/C | N |  |  |  |
| `keema-pizza-pizzadb-p2` | E |  | A(0)+? | –/C | N |  |  |  |
| `kimchi-pizza-pizzadb-p2` | E | D,C | C(3) | –/C | N | PREP_STEP |  |  |
| `cuban-pizza-pizzadb-p2` | C |  | C(4) | S/– | Y |  |  |  |
| `quad-cities-style-pizza-pizzadb-p2` | E | D | A(0)+? | –/C | N | DOUGH_VARIANT |  |  |
| `goulash-pizza-pizzadb-p3` | E | C | C(3) | –/– | N |  |  |  |
| `colorado-mountain-pie-pizzadb-p3` | E | D | A(0) | –/C | N | DOUGH_VARIANT |  |  |
| `salsiccia-e-friarielli-pizzadb-p3` | B |  | B(1) | –/C | Y |  |  | T2 |
| `chicago-stuffed-pizza-pizzadb-p3` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_VARIANT,ENCLOSE | 2 |  |
| `potato-mayo-pizza-pizzadb-p3` | E | B | B(1) | S/C | N |  |  |  |
| `jamaican-jerk-chicken-pizza-pizzadb-p3` | E | C | C(2) | –/C | N |  |  |  |
| `shirasu-pizza-pizzadb-p3` | C |  | C(3) | –/C | Y |  |  |  |
| `tandoori-paneer-pizza-pizzadb-p5` | E | C | C(2) | –/C | N |  |  |  |
| `chicken-tikka-pizza-pizzadb-p5` | E | C | C(3) | –/C | N |  |  |  |
| `diavola-pizza-pizzadb-p5` | E | B,IDENTITY_COLLISION | B(1)+? | –/C | N |  | 1 |  |
| `detroit-style-pizza-pizzadb-p5` | D | B,IDENTITY_COLLISION | B(1) | S/– | Y | DOUGH_SHAPE_TARGET,DOUGH_VARIANT,LATE_ADDITION,PAN_BAKE | 1 |  |
| `turkish-pide-pizzadb-p5` | E | D,B | B(1)+? | –/– | N | DOUGH_SHAPE_TARGET,DOUGH_VARIANT |  |  |
| `nigerian-suya-pizza-pizzadb-p5` | E | C | C(2) | –/C | N |  |  |  |
| `eggplant-tahini-pizza-pizzadb-p5` | C |  | C(3) | S/– | Y |  |  |  |
| `eggplant-ricotta-pizza-pizzadb-p5` | C |  | C(2) | S/C | Y |  |  |  |
| `eggplant-dengaku-pizza-pizzadb-p6` | C |  | C(2) | S/C | Y |  |  |  |
| `nashville-hot-chicken-pizza-pizzadb-p6` | E | C | C(3) | S/C | N |  |  |  |
| `new-england-bar-pizza-pizzadb-p6` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_VARIANT,PAN_BAKE | 3 |  |
| `new-zealand-lamb-pizza-pizzadb-p6` | C |  | C(2) | –/C | Y |  |  |  |
| `nutella-dessert-pizza-pizzadb-p6` | E | D,C,IDENTITY_COLLISION | C(3)+? | S/– | N | LATE_ADDITION | 1 |  |
| `baingan-bharta-pizza-pizzadb-p6` | E | B | B(1) | –/C | N |  |  |  |
| `banh-mi-pizza-pizzadb-p6` | E | C | C(4) | –/C | N |  |  |  |
| `buffalo-cauliflower-pizza-pizzadb-p6` | E | C | C(2) | S/C | N |  |  |  |
| `baba-ganoush-pizza-pizzadb-p7` | C |  | C(2) | S/– | Y |  |  |  |
| `jamon-serrano-pizza-pizzadb-p7` | C | IDENTITY_COLLISION | C(2) | S/C | Y |  | 2 |  |
| `jalapeno-popper-pizza-pizzadb-p7` | C |  | C(2) | –/C | Y |  |  |  |
| `palmitos-salsa-golf-pizzadb-p7` | E | D,B | B(1) | –/C | N | DOUGH_VARIANT |  |  |
| `parmigiana-pizza-pizzadb-p7` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `palmito-pizza-pizzadb-p7` | B |  | B(1) | –/C | Y |  |  | T2 |
| `bambino-pizzadb-p7` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `piadina-romagnola-pizzadb-p7` | D | C | C(3) | –/– | Y | DOUGH_VARIANT |  |  |
| `pizza-overload-pizzadb-p7` | B |  | B(1) | S/C | Y |  |  | T2 |
| `pizza-salad-pizzadb-p7` | D | C | C(3) | S/C | Y | MULTI_SPREAD_LAYER |  |  |
| `bismarck-pizza-pizzadb-p7` | A | IDENTITY_COLLISION | A(0) | S/C | Y |  | 1 |  |
| `pizza-alla-crudaiola-pizzadb-p8` | D | C | C(2) | S/C | Y | MULTI_SPREAD_LAYER |  |  |
| `pizza-asparagi-limone-pizzadb-p8` | D | C | C(2) | S/C | Y | INFERRED |  |  |
| `pizza-carciofi-salad-pizzadb-p8` | D | C | C(3) | S/C | Y | DOUGH_VARIANT,INFERRED |  |  |
| `pizza-finocchi-salad-pizzadb-p8` | D | C | C(3) | S/C | Y | INFERRED |  |  |
| `pizza-cavolo-carote-pizzadb-p8` | D | C | C(4) | S/C | Y | INFERRED |  |  |
| `pizza-zucchine-menta-pizzadb-p8` | D | C | C(4) | S/C | Y | INFERRED |  |  |
| `pizza-cicoria-limone-pizzadb-p8` | E | D,C | C(3)+? | S/– | N | DOUGH_VARIANT,INFERRED |  |  |
| `pizza-puntarelle-pizzadb-p8` | D | C | C(2) | S/C | Y | DOUGH_VARIANT,INFERRED |  |  |
| `pizza-radicchio-noci-pizzadb-p8` | D | C | C(3) | S/C | Y | MULTI_SPREAD_LAYER,INFERRED |  |  |
| `pizza-chilena-pizzadb-p8` | E |  | A(0)+? | –/C | N |  |  |  |
| `pizza-portuguesa-pizzadb-p9` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `pizza-romana-pizzadb-p9` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_VARIANT | 1 |  |
| `pizza-alla-norma-pizzadb-p9` | B | IDENTITY_COLLISION | B(1) | S/C | Y |  | 1 |  |
| `pizza-al-taglio-romana-pizzadb-p9` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_SHAPE_TARGET,DOUGH_VARIANT,PAN_BAKE | 3 |  |
| `pizza-feta-eliniki-pizzadb-p9` | B |  | B(1) | S/– | Y |  |  | T2 |
| `pizza-fritta-pizzadb-p9` | D | C | C(2) | S/C | Y | FRY_COOK |  |  |
| `pizza-moscow-pizzadb-p9` | C |  | C(2) | –/C | Y |  |  |  |
| `pinsa-romana-pizzadb-p9` | D | C,IDENTITY_COLLISION | C(2) | S/C | Y | DOUGH_VARIANT | 2 |  |
| `fathead-pizza-keto-pizzadb-p9` | D | IDENTITY_COLLISION | A(0) | S/C | Y | DOUGH_VARIANT | 3 |  |
| `philly-cheesesteak-pizza-pizzadb-p9` | E | C | C(2)+? | –/– | N |  |  |  |
| `poutine-pizza-pizzadb-p10` | D | C | C(3) | S/C | Y | DOUGH_VARIANT |  |  |
| `feteer-meshaltet-pizzadb-p10` | E | D,C | C(3)+? | S/– | N | LAMINATE,MULTI_SPREAD_LAYER |  |  |
| `focaccia-genovese-pizzadb-p10` | E | D,B | B(1) | S/– | N | DOUGH_VARIANT |  |  |
| `fugazza-pizzadb-p10` | D | IDENTITY_COLLISION | A(0) | –/C | Y | DOUGH_VARIANT | 4 |  |
| `fugazzetta-pizzadb-p10` | D | IDENTITY_COLLISION | A(0) | –/C | Y | DOUGH_VARIANT | 4 |  |
| `puttanesca-pizza-pizzadb-p10` | IN_PROD |  | A(0) | S/– | Y |  |  |  |
| `burrata-pizza-pizzadb-p10` | D | B | B(1) | S/– | Y | MULTI_SPREAD_LAYER |  |  |
| `brazilian-calabresa-pizzadb-p10` | IN_PROD |  | A(0) | S/– | Y |  |  |  |
| `brazilian-catupiry-corn-pizza-pizzadb-p10` | B |  | B(1) | –/C | Y |  |  | T2 |
| `frango-catupiry-pizzadb-p10` | C |  | C(2) | –/C | Y |  |  |  |
| `full-english-pizza-pizzadb-p10` | B |  | B(1) | –/C | Y |  |  | T2 |
| `fruit-dessert-pizza-pizzadb-p11` | E | D,C | C(4) | –/– | N | DOUGH_VARIANT |  |  |
| `bulgogi-pizza-pizzadb-p11` | E | C | C(2) | –/C | N |  |  |  |
| `frutti-di-mare-pizzadb-p11` | C | IDENTITY_COLLISION | C(3) | S/– | Y |  | 2 |  |
| `breakfast-pizza-pizzadb-p11` | E | B,IDENTITY_COLLISION | B(1)+? | –/– | N |  | 1 |  |
| `prosciutto-funghi-pizzadb-p11` | B |  | B(1) | S/C | Y |  |  | T1 |
| `veggie-supreme-pizza-pizzadb-p11` | B |  | B(1) | S/C | Y |  |  | T2 |
| `pescatore-pizzadb-p11` | D | C,IDENTITY_COLLISION | C(3) | S/C | Y | MULTI_SPREAD_LAYER | 1 |  |
| `pesto-caprese-pizzadb-p11` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `pesto-gamberi-pizzadb-p11` | B |  | B(1) | S/– | Y |  |  | T1 |
| `pesto-salmone-pizzadb-p11` | C |  | C(3) | S/– | Y |  |  |  |
| `pesto-genovese-pizza-pizzadb-p11` | B | IDENTITY_COLLISION | B(1) | S/C | Y |  | 1 |  |
| `pesto-trapanese-pizzadb-p11` | B |  | B(1) | S/– | Y |  |  | T1 |
| `pesto-tonno-pizzadb-p12` | IN_PROD |  | A(0) | S/– | Y |  |  |  |
| `pesto-noci-pizzadb-p12` | D | C | C(2) | S/C | Y | MULTI_SPREAD_LAYER |  |  |
| `pesto-patate-pizzadb-p12` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `pesto-burrata-pizzadb-p12` | D | B | B(1) | S/– | Y | MULTI_SPREAD_LAYER |  |  |
| `pesto-vegetariana-pizzadb-p12` | C |  | C(2) | S/C | Y |  |  |  |
| `pesto-pollo-pizzadb-p12` | B |  | B(1) | S/C | Y |  |  | T1 |
| `venezuelan-reina-pepiada-pizzadb-p12` | E | C | C(4) | S/C | N |  |  |  |
| `peruvian-aji-amarillo-pizzadb-p12` | E | C | C(2) | –/C | N |  |  |  |
| `polish-kielbasa-pizzadb-p12` | B |  | B(1) | –/C | Y |  |  | T2 |
| `boscaiola-pizzadb-p12` | B | IDENTITY_COLLISION | B(1) | S/C | Y |  | 1 |  |
| `hot-honey-pepperoni-pizzadb-p12` | D | B | B(1) | S/C | Y | MULTI_SPREAD_LAYER |  |  |
| `porchetta-pizza-pizzadb-p12` | B |  | B(1) | –/C | Y |  |  | T2 |
| `natto-pizza` | E | D,C | C(4) | –/C | N | LATE_ADDITION |  |  |
| `peking-duck-pizza` | C |  | C(4) | S/C | Y |  |  |  |
| `mentaiko-mochi-pizza` | E | C | C(5) | S/– | N |  |  |  |
| `manakish` | D | C | C(2) | S/– | Y | DOUGH_VARIANT |  |  |
| `yuzu-shrimp-pizza` | C |  | C(3) | S/C | Y |  |  |  |
| `wasabi-beef-pizza` | D | C | C(3) | S/C | Y | LATE_ADDITION |  |  |
| `sichuan-eggplant-pizza` | C |  | C(2) | S/C | Y |  |  |  |
| `yakiniku-pizza` | D | C | C(3) | S/C | Y | PREP_STEP |  |  |
| `pizza-de-lomo-saltado` | E | D,C | C(2) | –/C | N | LATE_ADDITION,PREP_STEP |  |  |
| `lahmacun` | E | D,C | C(2)+? | –/– | N | DOUGH_VARIANT,MULTI_SPREAD_LAYER,INFERRED |  |  |
| `porcini-pizza-pizzadb-p13` | C | IDENTITY_COLLISION | C(2) | –/C | Y |  | 1 |  |
| `marinara-pizza-pizzadb-p13` | D | IDENTITY_COLLISION | A(0) | S/– | Y | MULTI_SPREAD_LAYER | 1 |  |
| `meat-lovers-pizza-pizzadb-p13` | B | IDENTITY_COLLISION | B(1) | S/– | Y |  | 1 |  |
| `moussaka-style-pizza-pizzadb-p13` | E | C | C(3)+? | –/– | N |  |  |  |
| `mexican-elote-pizza-pizzadb-p13` | E | C | C(4) | S/– | N |  |  |  |
| `melanzane-pizza-pizzadb-p13` | IN_PROD |  | A(0) | S/C | Y |  |  |  |
| `montreal-style-pizza-pizzadb-p13` | D |  | A(0) | S/C | Y | DOUGH_VARIANT,PAN_BAKE |  |  |
| `ratatouille-pizza-pizzadb-p13` | C |  | C(2) | S/– | Y |  |  |  |
| `rucola-e-grana-pizzadb-p13` | C |  | C(3) | S/– | Y |  |  |  |
| `rendang-pizza-pizzadb-p14` | E | B | B(1) | –/C | N |  |  |  |
| `nduja-pizza-pizzadb-p14` | E | B | B(1) | S/C | N |  |  |  |
| `tsukimi-pizza-pizzadb-p14` | B |  | B(1) | –/C | Y |  |  | T2 |
| `black-truffle-pizza-pizzadb-p14` | D | B,IDENTITY_COLLISION | B(1) | –/C | Y | LATE_ADDITION | 1 |  |
| `teriyaki-chicken-pizza-pizzadb-p14` | E | D,C,IDENTITY_COLLISION | C(3) | S/– | N | LATE_ADDITION | 1 |  |
| `south-african-boerewors-pizzadb-p14` | E | B | B(1) | S/C | N |  |  |  |
| `ume-shiso-pizza-pizzadb-p14` | E | C | C(3) | –/C | N |  |  |  |
| `hokkaido-cheese-pizza-pizzadb-p15` | E |  | A(0)+? | –/– | N |  |  |  |

