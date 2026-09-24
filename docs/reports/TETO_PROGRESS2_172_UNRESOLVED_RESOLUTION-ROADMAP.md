# Progression 2.0 — 104 Unresolved Rows Resolution Roadmap（Fresh Audit）

## 0. 結論

監査基準は PR #220 head `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（OPEN、未変更）と、その base である main `dff233c042d2df6ee1c3a92f2d2419830aa05460`。PR #220 の unresolved ledger（104 rows）を read-only input とし、各行を「何をすれば実装可能になるか」で再分類した。172 研究・#189 matrix・#220 の wave 判定はいずれも再作成・変更していない。

- 104 行の runtime 要否: **YES 62 / CONDITIONAL 34 / NO 8**。content-only で解決可能なのは **8 行**、decision 次第で runtime 不要になり得る（runtime-free option が全 conditional item に存在する）行は **12 行**。
- 最上流の blocker（primaryClass）は SAUCE_BASE_SELECTION 28、COMPOSITION_DECISION 23、INGREDIENT_ALIAS 20 の 3 種で 71 行。**evidence / decision が runtime より先に来る行が大半**である。
- 52 行は identity ingredient set が incomplete（alias / sauce 未確定）で、collision / overlap を計算できない。これらは stage 1 解消後に collision 再評価が必須。
- 1 件の runtime unit で複数 recipe を解放する効果が最も大きいのは `DOUGH_VARIANT`（確定依存 28 行、単独で runtime 依存が消える行 9、うち content-only follow-up だけで実装可能化 8）と `SAUCELESS_RECIPE_CONTRACT`（19 / 7 / 7）。
- 同じ型・同じ file を触る unit を束ねた composite cluster では、`DOUGH_VARIANT + PAN_BAKE + DOUGH_SHAPE_TARGET` が 15 行、`RecipeSauceProfile` 一般化（SAUCELESS + UNSUPPORTED_SAUCE_ID + MULTI_SPREAD_LAYER）が確定 33 行 + conditional 37 行に効く。
- 104 行内の確定 runtime 依存（62 行）は 11 unit ですべて被覆される（§5.3 greedy coverage）。
- 数量（minCount）と bakeTarget の evidence は #189 matrix に **0 件**。全 104 行（W1 を含む全 addition）で authoring が必要。
- **最終実装順は確定しない。** 本書の順位は件数・依存関係による客観指標のみ。Pitz price / unlock fee / star gate / non-star condition / Completion Gate は PR #220 同様 `TBD` / `OWNER_DECISION_REQUIRED` のまま。

## 1. 基準・入力・制約

| Input | Ref | 用途 |
|---|---|---|
| PR #220 `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_UNRESOLVED.json` | `e49dab9` | 104 rows、blocker / review item の SSOT |
| PR #220 `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json` | `e49dab9` | wave、requiredCapabilities、runtimeContractDependencies、new ingredient、collisionRisk |
| #189 `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` | `dff233c` | capability taxonomy、sauceFamilyTable、compositionDecisionLedger、namingClusterLedger、collisionLedger、dough / cut / cookingProfile |
| `src/data/recipeSauceProfiles.ts` / `.test.ts`, `cookingProfiles.ts`, `recipes.ts`, `ingredients.ts` | `dff233c` | runtime contract の read-only 確認 |

入力 JSON の sha256 は machine-readable JSON の `basis.inputs` に記録した。

制約の遵守: `src/**` 変更なし / runtime 実装なし / PR #220・既存 PR 変更なし / PR 作成なし / 未確認 evidence の確定なし（alias・sauce・mechanic はすべて「候補」と「必要 evidence」として記録し、選定はしていない）。

### 1.1 contract 確認（main 実コード）

- `RecipeSauceProfile.ingredientId` は `"tomato-sauce" | "pesto" | "olive-oil"` の closed union（`src/data/recipeSauceProfiles.ts`）。
- `RECIPE_SAUCE_PROFILES` は exhaustive `Record<RecipeId, RecipeSauceProfile>`。test は profile の `ingredientId` が recipe の sauce-category 必須 ingredient と一致することを assert する → sauce 無し recipe は型と test の両方の変更が必要（PR #220 の `SAUCELESS_RECIPE_CONTRACT` 判定と一致）。
- `deriveCoreSteps` は sauce category が無ければ SAUCE step を skip する（step 側は既に sauceless 対応済み。contract 側だけが未対応）。
- CUT は `CUT_ELIGIBLE_RECIPE_IDS` の opt-in allowlist（`src/data/cookingProfiles.ts`）。非 round / enclosed は「人が形状適合を再確認するまで追加しない」と明記。
- `Recipe` は `requiredIngredients[].minCount` と `bakeTarget {start,end}` を必須 field とする。

## 2. 分類体系

### 2.1 Resolution class（unresolved を解消するために必要な行為）

| class | ラベル | PR #220 / #189 の source type | 解消に必要なこと |
|---|---|---|---|
| `RECIPE_EVIDENCE` | recipe evidence不足 | `EVIDENCE_GAP`, `SCOPE_QUESTION`, `SOURCE_INCONSISTENCY`, `NAME_SPECIFICITY_GAP` | 一次 source の再確認、または owner による scope 判断。推測で具材・sauce を補完しない。 |
| `INGREDIENT_ALIAS` | ingredient alias確認 | `UNRESOLVED_INGREDIENT` | 曖昧 token を canonical ingredient id（relatedIds のいずれか／新 id／除外）に確定する evidence 付き判断。 |
| `SAUCE_BASE_SELECTION` | sauce base 未特定（sauce id 選定） | `BASE_SAUCE_UNSPECIFIED` | sauceFamily から具体的な sauce ingredient id を evidence 付きで選定する。選定 id が supported union 外なら UNSUPPORTED_SAUCE_CONTRACT が追加で必要。 |
| `UNSUPPORTED_SAUCE_CONTRACT` | unsupported sauce contract | `runtimeContractDependencies:UNSUPPORTED_SAUCE_ID_CONTRACT` | RecipeSauceProfile.ingredientId の closed union（tomato-sauce \| pesto \| olive-oil）拡張。runtime 変更。 |
| `SAUCELESS_CONTRACT` | sauceless recipe contract | `runtimeContractDependencies:SAUCELESS_RECIPE_CONTRACT` | exhaustive Record<RecipeId, RecipeSauceProfile> と test contract を sauce 無し recipe 対応に変更。runtime 変更。 |
| `NEW_MECHANIC` | new mechanic必要 | `requiredCapabilities` | #189 capability taxonomy の capability を runtime 実装する。 |
| `MECHANIC_CONFIRMATION` | mechanic 解釈確認（capability confirm/drop） | `MECHANIC_INTERPRETATION`, `CANDIDATE_CAPABILITY` | repo-inference / context-only の mechanic evidence を confirm か drop。confirm なら NEW_MECHANIC、drop なら content-only。 |
| `CAPABILITY_DEPENDENCY` | capability dependency（識別・衝突解消が capability 依存） | `SAME_INGREDIENT_SET_AS_CATALOG_RECIPE`, `collisionLedger.requiresCapabilities` | 同一 ingredient set の既存/候補 recipe との識別が特定 capability の存在に依存。capability 実装か統合/drop 判断。 |
| `COMPOSITION_DECISION` | composition conflict（product decision） | `COMPOSITION_CONFLICT_SHIPPED`, `COMPOSITION_CONFLICT_CANDIDATE` | #189 compositionDecisionLedger の options から owner が選択。shipped 側 adopt は既存 recipe migration review が別途必要。 |
| `COLLISION_RISK` | collision risk（discovery/naming） | `DISCOVERY_COLLISION`, `NAMING_CLUSTER`, `collisionRisk=HIGH` | discovery identity の区別次元の evidence、または naming/統合判断。 |
| `PREPARED_COMPOSITE` | prepared composite ingredient | `PREPARED_COMPOSITE_INGREDIENT` | 調理済み料理（例: 北京ダック）を単一 scatter ingredient とするか分解するかの content 判断。 |

`primaryClass` は上流優先の precedence（RECIPE_EVIDENCE → INGREDIENT_ALIAS → SAUCE_BASE_SELECTION → COMPOSITION_DECISION → MECHANIC_CONFIRMATION → COLLISION_RISK → PREPARED_COMPOSITE → CAPABILITY_DEPENDENCY → SAUCELESS_CONTRACT → UNSUPPORTED_SAUCE_CONTRACT → NEW_MECHANIC）で 1 つ選んだラベル。行が持つ全 class は `classes`。

### 2.2 Authoring class（全 addition 共通。blocker ではないが実装可能化に必要）

| class | 内容 |
|---|---|
| `INGREDIENT_VISUAL_AUTHORING` | 新 ingredient の nameJa / category / placement / color / emoji authoring（専用 bitmap は current renderer で不要 — PR #220 assetPolicy） |
| `QUANTITY_AUTHORING` | requiredIngredients[].minCount authoring。#189 matrix に数量 evidence は 0 件（全 172 rows） |
| `BAKE_TARGET` | bakeTarget {start,end} authoring。#189 matrix に bakeTarget evidence は 0 件 |
| `CUT_POLICY` | CUT_ELIGIBLE_RECIPE_IDS への opt-in 判断（非 round / enclosed は現 CUT geometry 不適合） |

### 2.3 判定の定義

- **runtime 変更**: 型・logic・reducer・gesture・step 構成・closed union 等の変更（src/logic/**, 型定義, test contract の変更を含む）。既存 data 構造への entry 追加（recipes.ts / ingredients.ts / supported sauce の profile entry / CUT allowlist entry）は content とみなす。
- runtimeChangeRequired `YES`: evidenced な required capability / contract 依存が確定
- runtimeChangeRequired `CONDITIONAL`: 確定 runtime 依存は無いが、未決の evidence/decision の結果次第で runtime 依存が生じ得る
- runtimeChangeRequired `NO`: evidence/decision/authoring のみで解決可能
- contentOnlyResolvable: YES = runtime NO / NO = runtime YES / DEPENDS_ON_DECISION = runtime CONDITIONAL
- runtimeFreePathExists: CONDITIONAL 行について、全 conditional item に runtime を伴わない選択肢（supported sauce 選定・mechanic drop・shipped keep・統合/drop）が存在するか。選択肢の存在を示すだけで、その選択が evidence 上正しいことは確定しない。
- runtimeSoleDependency: その runtime unit（群）だけで行の確定 runtime 依存がすべて満たされ、conditional runtime 依存も残らない
- unblockedWithContentOnlyFollowUp: runtimeSoleDependency かつ残る evidence/decision item がすべて runtime NO（cluster に含まれる unit で結果が必ず覆われる conditional item も clear とみなす）
- unblockedByRuntimeAlone: 上記かつ runtime 以外の item が 0（authoring は全行共通なので除外）

## 3. 全体集計

| 指標 | 値 |
|---|---|
| rows | 104 |
| wave | W0_CORRESPONDENCE 9, W3 45, W4 38, W5 12 |
| runtimeChangeRequired | CONDITIONAL 34, NO 8, YES 62 |
| contentOnlyResolvable | DEPENDS_ON_DECISION 34, NO 62, YES 8 |
| runtimeFreePathExists (CONDITIONAL 34 行中) | NO 22, YES 12 |
| identity set complete | false 52, true 52 |
| 1 行あたり class 数 | 1種: 26行, 2種: 54行, 3種: 19行, 4種: 5行 |

### 3.1 class 別

| class | primary rows | rows (any) | items |
|---|---:|---:|---:|
| `RECIPE_EVIDENCE` | 7 | 7 | 7 |
| `INGREDIENT_ALIAS` | 20 | 21 | 24 |
| `SAUCE_BASE_SELECTION` | 28 | 33 | 33 |
| `UNSUPPORTED_SAUCE_CONTRACT` | 0 | 6 | 6 |
| `SAUCELESS_CONTRACT` | 0 | 19 | 19 |
| `NEW_MECHANIC` | 0 | 48 | 68 |
| `MECHANIC_CONFIRMATION` | 10 | 25 | 26 |
| `CAPABILITY_DEPENDENCY` | 6 | 8 | 8 |
| `COMPOSITION_DECISION` | 23 | 27 | 27 |
| `COLLISION_RISK` | 8 | 14 | 14 |
| `PREPARED_COMPOSITE` | 2 | 3 | 3 |

### 3.2 primaryClass × runtime 要否

| primaryClass | YES | CONDITIONAL | NO |
|---|---:|---:|---:|
| `RECIPE_EVIDENCE` | 5 | 2 | 0 |
| `INGREDIENT_ALIAS` | 12 | 7 | 1 |
| `SAUCE_BASE_SELECTION` | 8 | 20 | 0 |
| `MECHANIC_CONFIRMATION` | 10 | 0 | 0 |
| `CAPABILITY_DEPENDENCY` | 5 | 0 | 1 |
| `COMPOSITION_DECISION` | 15 | 5 | 3 |
| `COLLISION_RISK` | 6 | 0 | 2 |
| `PREPARED_COMPOSITE` | 1 | 0 | 1 |

## 4. Content / evidence / decision cluster（同じ判断・同じ調査で束ねられる作業）

同じ判断・同じ evidence 調査で複数行を同時に進められる単位。`closes` = この cluster を解くと runtime 以外の未決 item が 0 になる行数、`full` = さらに確定 runtime 依存も conditional item も無く、authoring だけで実装可能になる行数。

| cluster | class | rows | item runtime | 起こり得る runtime unit | closes | full | rows |
|---|---|---:|---|---|---:|---:|---|
| `COMPOSITION:CANDIDATE` | COMPOSITION_DECISION | 18 | NO | — | 10 | 2 | `black-truffle-pizza-pizzadb-p14`, `boscaiola-pizzadb-p12`, `buffalo-chicken-pizzadb`, `calzone-pizzadb`, `chicago-deep-dish-pizzadb`, `detroit-style-pizza-pizzadb-p5` 他12 |
| `NAMING:NC-4-calabresa` | COLLISION_RISK | 2 | NO | — | 2 | 2 | `brazilian-calabresa-pizzadb-p10`, `calabresa-argentina-pizzadb` |
| `PREPARED_COMPOSITE` | PREPARED_COMPOSITE | 3 | NO | — | 2 | 1 | `chicken-tikka-pizza-pizzadb-p5`, `peking-duck-pizza`, `pizza-overload-pizzadb-p7` |
| `ALIAS:ひき肉` | INGREDIENT_ALIAS | 5 | NO | — | 1 | 1 | `feteer-meshaltet-pizzadb-p10`, `keema-pizza-pizzadb-p2`, `lahmacun`, `pizza-chilena-pizzadb-p8`, `turkish-pide-pizzadb-p5` |
| `CAPDEP:NONE` | CAPABILITY_DEPENDENCY | 1 | NO | — | 1 | 1 | `prosciutto-funghi-pizzadb-p11` |
| `SAUCE_FAMILY:その他` | SAUCE_BASE_SELECTION | 10 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 10 | 0 | `banh-mi-pizza-pizzadb-p6`, `caponata-pizza-pizzadb-p2`, `goulash-pizza-pizzadb-p3`, `jamaican-jerk-chicken-pizza-pizzadb-p3`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `natto-pizza` 他4 |
| `MECHANIC_CONFIRM:LATE_ADDITION` | MECHANIC_CONFIRMATION | 12 | CONDITIONAL | LATE_ADDITION | 9 | 0 | `eel-pizza-pizzadb-p1`, `hot-honey-pepperoni-pizzadb-p12`, `lahmacun`, `pizza-asparagi-limone-pizzadb-p8`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cavolo-carote-pizzadb-p8` 他6 |
| `COMPOSITION:SHIPPED` | COMPOSITION_DECISION | 9 | CONDITIONAL | — | 5 | 0 | `bismarck-pizza-pizzadb-p7`, `breakfast-pizza-pizzadb-p11`, `capricciosa-pizzadb`, `fugazza-pizzadb-p10`, `margherita-pizzadb-row`, `marinara-pizza-pizzadb-p13` 他3 |
| `SAUCE_FAMILY:カレー` | SAUCE_BASE_SELECTION | 5 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 3 | 0 | `baingan-bharta-pizza-pizzadb-p6`, `chicken-tikka-pizza-pizzadb-p5`, `keema-pizza-pizzadb-p2`, `rendang-pizza-pizzadb-p14`, `tandoori-paneer-pizza-pizzadb-p5` |
| `SAUCE_FAMILY:デザートソース` | SAUCE_BASE_SELECTION | 4 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 3 | 0 | `apple-cinnamon-dessert-pizzadb`, `feteer-meshaltet-pizzadb-p10`, `fruit-dessert-pizza-pizzadb-p11`, `smore-dessert-pizza-pizzadb-p4` |
| `SAUCE_FAMILY:ホットソース` | SAUCE_BASE_SELECTION | 6 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 2 | 0 | `buffalo-cauliflower-pizza-pizzadb-p6`, `kimchi-pizza-pizzadb-p2`, `nashville-hot-chicken-pizza-pizzadb-p6`, `nduja-pizza-pizzadb-p14`, `peruvian-aji-amarillo-pizzadb-p12`, `swedish-kebab-pizza-pizzadb-p4` |
| `ALIAS:唐辛子` | INGREDIENT_ALIAS | 5 | CONDITIONAL | MULTI_SPREAD_LAYER | 2 | 0 | `diavola-pizza-pizzadb-p5`, `lahmacun`, `pizza-baiana`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-de-cancha` |
| `ALIAS:チーズ` | INGREDIENT_ALIAS | 3 | NO | — | 2 | 0 | `hokkaido-cheese-pizza-pizzadb-p15`, `old-forge-style-pizza-pizzadb-p1`, `turkish-pide-pizzadb-p5` |
| `CAPDEP:DOUGH_VARIANT` | CAPABILITY_DEPENDENCY | 3 | YES | DOUGH_VARIANT | 2 | 0 | `cauliflower-crust-pizza-pizzadb-p2`, `fathead-pizza-keto-pizzadb-p9`, `ny-style-pizzadb` |
| `EVIDENCE:EVIDENCE_GAP` | RECIPE_EVIDENCE | 2 | NO | — | 2 | 0 | `colorado-mountain-pie-pizzadb-p3`, `pizza-a-caballo` |
| `NAMING:NC-1-napoletana` | COLLISION_RISK | 2 | NO | — | 2 | 0 | `argentine-napolitana-pizzadb-p1`, `chilean-napolitana-pizzadb` |
| `SAUCE_FAMILY:甘辛だれ` | SAUCE_BASE_SELECTION | 4 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 1 | 0 | `bulgogi-pizza-pizzadb-p11`, `eel-pizza-pizzadb-p1`, `south-african-boerewors-pizzadb-p14`, `teriyaki-chicken-pizza-pizzadb-p14` |
| `ALIAS:ホワイトソース` | INGREDIENT_ALIAS | 2 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 1 | 0 | `breakfast-pizza-pizzadb-p11`, `moussaka-style-pizza-pizzadb-p13` |
| `EVIDENCE:SCOPE_QUESTION` | RECIPE_EVIDENCE | 2 | NO | — | 1 | 0 | `feteer-meshaltet-pizzadb-p10`, `focaccia-genovese-pizzadb-p10` |
| `MECHANIC_CONFIRM:SERVE_FORM` | MECHANIC_CONFIRMATION | 2 | CONDITIONAL | SERVE_FORM | 1 | 0 | `lahmacun`, `ny-style-pizzadb` |
| `NAMING:NC-3-sicilian` | COLLISION_RISK | 2 | NO | — | 1 | 0 | `sfincione-pizzadb`, `siciliana-pizzadb` |
| `NAMING:NC-6-frutti-pescatore` | COLLISION_RISK | 2 | NO | — | 1 | 0 | `frutti-di-mare-pizzadb-p11`, `pescatore-pizzadb-p11` |
| `NAMING:NC-7-chicago` | COLLISION_RISK | 2 | NO | — | 1 | 0 | `chicago-deep-dish-pizzadb`, `chicago-stuffed-pizza-pizzadb-p3` |
| `ALIAS:カレーソース` | INGREDIENT_ALIAS | 1 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 1 | 0 | `curry-pizza-japan-pizzadb-p2` |
| `ALIAS:スパイシーソーセージ` | INGREDIENT_ALIAS | 1 | NO | — | 1 | 0 | `quad-cities-style-pizza-pizzadb-p2` |
| `ALIAS:チーズソース` | INGREDIENT_ALIAS | 1 | NO | — | 1 | 0 | `philly-cheesesteak-pizza-pizzadb-p9` |
| `ALIAS:プロヴェルチーズ` | INGREDIENT_ALIAS | 1 | NO | — | 1 | 0 | `st-louis-style-pizza-pizzadb-p4` |
| `ALIAS:赤唐辛子` | INGREDIENT_ALIAS | 1 | CONDITIONAL | MULTI_SPREAD_LAYER | 1 | 0 | `thai-chicken-pizza-pizzadb-p4` |
| `ALIAS:青のり` | INGREDIENT_ALIAS | 1 | NO | — | 1 | 0 | `okonomiyaki-style-pizza-pizzadb-p1` |
| `CAPDEP:DOUGH_VARIANT+PAN_BAKE` | CAPABILITY_DEPENDENCY | 1 | YES | DOUGH_VARIANT, PAN_BAKE | 1 | 0 | `new-england-bar-pizza-pizzadb-p6` |
| `CAPDEP:DOUGH_VARIANT+PAN_BAKE+DOUGH_SHAPE_TARGET` | CAPABILITY_DEPENDENCY | 1 | YES | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | 1 | 0 | `pizza-al-taglio-romana-pizzadb-p9` |
| `CAPDEP:STEP_ORDER` | CAPABILITY_DEPENDENCY | 1 | YES | STEP_ORDER | 1 | 0 | `trenton-tomato-pie-pizzadb` |
| `EVIDENCE:SOURCE_INCONSISTENCY` | RECIPE_EVIDENCE | 1 | NO | — | 1 | 0 | `manakish` |
| `NAMING:NC-2-bianca` | COLLISION_RISK | 1 | NO | — | 1 | 0 | `bianca-pizzadb-row` |
| `MECHANIC_CONFIRM:MULTI_SPREAD_LAYER` | MECHANIC_CONFIRMATION | 10 | CONDITIONAL | MULTI_SPREAD_LAYER | 0 | 0 | `buffalo-cauliflower-pizza-pizzadb-p6`, `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `nashville-hot-chicken-pizza-pizzadb-p6`, `nduja-pizza-pizzadb-p14`, `potato-mayo-pizza-pizzadb-p3` 他4 |
| `SAUCE_FAMILY:ホワイトソース` | SAUCE_BASE_SELECTION | 4 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 0 | 0 | `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `potato-mayo-pizza-pizzadb-p3`, `venezuelan-reina-pepiada-pizzadb-p12` |
| `COLLISION:P0-COLL-5` | COLLISION_RISK | 2 | CONDITIONAL | — | 0 | 0 | `fugazza-pizzadb-p10`, `fugazzetta-pizzadb-p10` |
| `EVIDENCE:NAME_SPECIFICITY_GAP` | RECIPE_EVIDENCE | 2 | NO | — | 0 | 0 | `nduja-pizza-pizzadb-p14`, `south-african-boerewors-pizzadb-p14` |
| `MECHANIC_CONFIRM:ZONED_PLACEMENT` | MECHANIC_CONFIRMATION | 2 | CONDITIONAL | ZONED_PLACEMENT | 0 | 0 | `bismarck-pizza-pizzadb-p7`, `capricciosa-pizzadb` |
| `ALIAS:ナッツ` | INGREDIENT_ALIAS | 1 | NO | — | 0 | 0 | `nutella-dessert-pizza-pizzadb-p6` |
| `ALIAS:肉` | INGREDIENT_ALIAS | 1 | NO | — | 0 | 0 | `swedish-kebab-pizza-pizzadb-p4` |
| `ALIAS:青唐辛子` | INGREDIENT_ALIAS | 1 | CONDITIONAL | UNSUPPORTED_SAUCE_ID_CONTRACT | 0 | 0 | `keema-pizza-pizzadb-p2` |
| `CAPDEP:DOUGH_VARIANT+ENCLOSE` | CAPABILITY_DEPENDENCY | 1 | YES | DOUGH_VARIANT, ENCLOSE | 0 | 0 | `chicago-stuffed-pizza-pizzadb-p3` |
| `NAMING:NC-5-speck-e-brie` | COLLISION_RISK | 1 | NO | — | 0 | 0 | `speck-e-brie-pizzadb-p4` |

補足:

- `SAUCE_FAMILY:*`: #189 `sauceFamilyTable` の family 候補は、`その他`（任意の spread）以外すべて supported union 外。family 候補から選ぶ限り `UNSUPPORTED_SAUCE_ID_CONTRACT` が付く。`その他` の 10 行は supported sauce（olive-oil / pesto / tomato-sauce）を選べる余地があるが、それを裏付ける evidence があるかは未確認。
- `ALIAS:唐辛子` / `赤唐辛子` / `青唐辛子`: relatedIds が `chili-oil`（spread-layer ingredient）。確定すると spread layer 追加（MULTI_SPREAD_LAYER）または sauce contract 変更になり得るため CONDITIONAL。scatter の新 id（例: 生唐辛子）として別 id を切るかは evidence 判断で、本書では確定しない。
- `ALIAS:ホワイトソース` / `カレーソース`: relatedIds が supported union 外の sauce（`fromage-blanc-sauce` / `curry-ketchup`）。
- `COMPOSITION:SHIPPED`（9 行）は shipped recipe との食い違い。keep を選べば runtime も src 変更も不要、adopt なら shipped recipe の composition 変更（save / Dex への影響 review が別途必要）。

## 5. Runtime capability cluster（1 件の runtime 追加で複数 recipe を解放）

### 5.1 単一 unit / composite

並びは `content-only follow-up で実装可能化` → `runtime 単独依存` → `確定依存` → `conditional` の降順。costClass / structural は #189 taxonomy の既存ラベル（本書で再見積もりしていない）。

| cluster | cost | structural | 確定依存 | conditional | runtime 単独依存 | +content-only で実装可能 | runtime のみで実装可能 | 確定依存の wave 内訳 |
|---|---|---|---:|---:|---:|---:|---:|---|
| `COMPOSITE:DOUGH_AND_PAN` | — | mixed | 29 | 0 | 15 | 14 | 4 | W0_CORRESPONDENCE 1, W4 18, W5 10 |
| `COMPOSITE:SAUCE_PROFILE_GENERALIZATION` | — | mixed | 33 | 37 | 14 | 12 | 0 | W0_CORRESPONDENCE 2, W3 9, W4 20, W5 2 |
| `RUNTIME:DOUGH_VARIANT` | S | no | 28 | 0 | 9 | 8 | 2 | W0_CORRESPONDENCE 1, W4 18, W5 9 |
| `RUNTIME:SAUCELESS_RECIPE_CONTRACT` | — | no | 19 | 0 | 7 | 7 | 0 | W3 7, W4 11, W5 1 |
| `RUNTIME:MULTI_SPREAD_LAYER` | M | no | 11 | 14 | 4 | 2 | 0 | W0_CORRESPONDENCE 2, W4 8, W5 1 |
| `RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT` | — | no | 6 | 36 | 1 | 1 | 0 | W3 2, W4 4 |
| `RUNTIME:ENCLOSE` | L | yes | 3 | 0 | 1 | 1 | 0 | W5 3 |
| `RUNTIME:STEP_ORDER` | S | no | 2 | 0 | 1 | 1 | 1 | W4 1, W5 1 |
| `RUNTIME:LATE_ADDITION` | M | no | 9 | 11 | 0 | 0 | 0 | W4 8, W5 1 |
| `RUNTIME:PAN_BAKE` | M | yes | 7 | 0 | 0 | 0 | 0 | W5 7 |
| `RUNTIME:DOUGH_SHAPE_TARGET` | L | yes | 5 | 0 | 0 | 0 | 0 | W5 5 |
| `RUNTIME:PREP_STEP` | M | no | 2 | 0 | 0 | 0 | 0 | W4 2 |
| `RUNTIME:LAMINATE` | L | yes | 1 | 0 | 0 | 0 | 0 | W5 1 |
| `RUNTIME:SERVE_FORM` | M | no | 0 | 2 | 0 | 0 | 0 |  |
| `RUNTIME:ZONED_PLACEMENT` | M | no | 0 | 2 | 0 | 0 | 0 |  |

### 5.2 cluster ごとの解放対象

**`COMPOSITE:DOUGH_AND_PAN`** — DOUGH_VARIANT は dough-base parameter（visual + bakeTarget）、PAN_BAKE は pan-specific bakeTarget/visual、DOUGH_SHAPE_TARGET は doughShape.ts + CUT geometry を触る（#189 taxonomy reuses）。collisionLedger P0-COLL-2/3 がこの組合せを要求。

- runtime 単独依存 (15): `cauliflower-crust-pizza-pizzadb-p2`, `colorado-mountain-pie-pizzadb-p3`, `fathead-pizza-keto-pizzadb-p9`, `focaccia-genovese-pizzadb-p10`, `fugazza-pizzadb-p10`, `greek-style-pizzadb`, `manakish`, `new-england-bar-pizza-pizzadb-p6`, `old-forge-style-pizza-pizzadb-p1`, `pizza-al-taglio-romana-pizzadb-p9`, `pizza-romana-pizzadb-p9`, `quad-cities-style-pizza-pizzadb-p2`, `siciliana-pizzadb`, `st-louis-style-pizza-pizzadb-p4`, `turkish-pide-pizzadb-p5`
- うち content-only follow-up で実装可能 (14): `cauliflower-crust-pizza-pizzadb-p2`, `colorado-mountain-pie-pizzadb-p3`, `fathead-pizza-keto-pizzadb-p9`, `focaccia-genovese-pizzadb-p10`, `greek-style-pizzadb`, `manakish`, `new-england-bar-pizza-pizzadb-p6`, `old-forge-style-pizza-pizzadb-p1`, `pizza-al-taglio-romana-pizzadb-p9`, `pizza-romana-pizzadb-p9`, `quad-cities-style-pizza-pizzadb-p2`, `siciliana-pizzadb`, `st-louis-style-pizza-pizzadb-p4`, `turkish-pide-pizzadb-p5`
- 確定依存（他 unit と併用が必要な行を含む） (29): `argentine-napolitana-pizzadb-p1`, `cauliflower-crust-pizza-pizzadb-p2`, `chicago-deep-dish-pizzadb`, `chicago-stuffed-pizza-pizzadb-p3`, `colorado-mountain-pie-pizzadb-p3`, `detroit-style-pizza-pizzadb-p5`, `fathead-pizza-keto-pizzadb-p9`, `focaccia-genovese-pizzadb-p10`, `fruit-dessert-pizza-pizzadb-p11`, `fugazza-pizzadb-p10`, `fugazzetta-pizzadb-p10`, `greek-style-pizzadb`, `lahmacun`, `manakish`, `new-england-bar-pizza-pizzadb-p6`, `ny-style-pizzadb`, `old-forge-style-pizza-pizzadb-p1`, `palmitos-salsa-golf-pizzadb-p7`, `pizza-a-caballo`, `pizza-al-taglio-romana-pizzadb-p9`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-de-cancha`, `pizza-puntarelle-pizzadb-p8`, `pizza-romana-pizzadb-p9`, `quad-cities-style-pizza-pizzadb-p2`, `siciliana-pizzadb`, `st-louis-style-pizza-pizzadb-p4`, `turkish-pide-pizzadb-p5`

**`COMPOSITE:SAUCE_PROFILE_GENERALIZATION`** — 3 unit とも src/data/recipeSauceProfiles.ts の RecipeSauceProfile 型を変更する（#189 taxonomy: MULTI_SPREAD_LAYER は 'generalizes RecipeSauceProfile ... to an ordered list'; PR #220 runtimeContractPolicy）。同一型変更で束ねられる可能性を示す客観指標であり、実装方針の確定ではない。

- runtime 単独依存 (14): `bianca-pizzadb-row`, `boscaiola-pizzadb-p12`, `chilean-napolitana-pizzadb`, `hokkaido-cheese-pizza-pizzadb-p15`, `margherita-pizzadb-row`, `marinara-pizza-pizzadb-p13`, `okonomiyaki-style-pizza-pizzadb-p1`, `peking-duck-pizza`, `pescatore-pizzadb-p11`, `philly-cheesesteak-pizza-pizzadb-p9`, `porcini-pizza-pizzadb-p13`, `sfincione-pizzadb`, `speck-e-brie-pizzadb-p4`, `thai-chicken-pizza-pizzadb-p4`
- うち content-only follow-up で実装可能 (12): `bianca-pizzadb-row`, `boscaiola-pizzadb-p12`, `chilean-napolitana-pizzadb`, `hokkaido-cheese-pizza-pizzadb-p15`, `okonomiyaki-style-pizza-pizzadb-p1`, `peking-duck-pizza`, `pescatore-pizzadb-p11`, `philly-cheesesteak-pizza-pizzadb-p9`, `porcini-pizza-pizzadb-p13`, `sfincione-pizzadb`, `speck-e-brie-pizzadb-p4`, `thai-chicken-pizza-pizzadb-p4`
- 確定依存（他 unit と併用が必要な行を含む） (33): `argentine-napolitana-pizzadb-p1`, `bianca-pizzadb-row`, `black-truffle-pizza-pizzadb-p14`, `boscaiola-pizzadb-p12`, `buffalo-chicken-pizzadb`, `chilean-napolitana-pizzadb`, `feteer-meshaltet-pizzadb-p10`, `fugazzetta-pizzadb-p10`, `hokkaido-cheese-pizza-pizzadb-p15`, `hot-honey-pepperoni-pizzadb-p12`, `lahmacun`, `margherita-pizzadb-row`, `marinara-pizza-pizzadb-p13`, `nutella-dessert-pizza-pizzadb-p6`, `okonomiyaki-style-pizza-pizzadb-p1`, `peking-duck-pizza`, `pescatore-pizzadb-p11`, `philly-cheesesteak-pizza-pizzadb-p9`, `pizza-a-caballo`, `pizza-asparagi-limone-pizzadb-p8`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cavolo-carote-pizzadb-p8`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-de-cancha`, `pizza-finocchi-salad-pizzadb-p8`, `pizza-puntarelle-pizzadb-p8`, `pizza-radicchio-noci-pizzadb-p8`, `pizza-zucchine-menta-pizzadb-p8`, `porcini-pizza-pizzadb-p13`, `sfincione-pizzadb`, `speck-e-brie-pizzadb-p4`, `taco-pizza-pizzadb`, `thai-chicken-pizza-pizzadb-p4`
- conditional (37): `apple-cinnamon-dessert-pizzadb`, `baingan-bharta-pizza-pizzadb-p6`, `banh-mi-pizza-pizzadb-p6`, `breakfast-pizza-pizzadb-p11`, `buffalo-cauliflower-pizza-pizzadb-p6`, `bulgogi-pizza-pizzadb-p11`, `caponata-pizza-pizzadb-p2`, `chicken-tikka-pizza-pizzadb-p5`, `curry-pizza-japan-pizzadb-p2`, `diavola-pizza-pizzadb-p5`, `eel-pizza-pizzadb-p1`, `fruit-dessert-pizza-pizzadb-p11`, `goulash-pizza-pizzadb-p3`, `jamaican-jerk-chicken-pizza-pizzadb-p3`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `keema-pizza-pizzadb-p2`, `kimchi-pizza-pizzadb-p2`, `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `moussaka-style-pizza-pizzadb-p13`, `nashville-hot-chicken-pizza-pizzadb-p6`, `natto-pizza`, `nduja-pizza-pizzadb-p14`, `nigerian-suya-pizza-pizzadb-p5`, `palmitos-salsa-golf-pizzadb-p7`, `peruvian-aji-amarillo-pizzadb-p12`, `pizza-baiana`, `pizza-de-lomo-saltado`, `potato-mayo-pizza-pizzadb-p3`, `rendang-pizza-pizzadb-p14`, `smore-dessert-pizza-pizzadb-p4`, `south-african-boerewors-pizzadb-p14`, `swedish-kebab-pizza-pizzadb-p4`, `tandoori-paneer-pizza-pizzadb-p5`, `teriyaki-chicken-pizza-pizzadb-p14`, `ume-shiso-pizza-pizzadb-p14`, `venezuelan-reina-pepiada-pizzadb-p12`

**`RUNTIME:DOUGH_VARIANT`** — reuses: existing DOUGH step gesture; adds a per-recipe dough-base parameter (visual + bakeTarget), no new gesture

- runtime 単独依存 (9): `cauliflower-crust-pizza-pizzadb-p2`, `colorado-mountain-pie-pizzadb-p3`, `fathead-pizza-keto-pizzadb-p9`, `focaccia-genovese-pizzadb-p10`, `fugazza-pizzadb-p10`, `manakish`, `pizza-romana-pizzadb-p9`, `quad-cities-style-pizza-pizzadb-p2`, `st-louis-style-pizza-pizzadb-p4`
- うち content-only follow-up で実装可能 (8): `cauliflower-crust-pizza-pizzadb-p2`, `colorado-mountain-pie-pizzadb-p3`, `fathead-pizza-keto-pizzadb-p9`, `focaccia-genovese-pizzadb-p10`, `manakish`, `pizza-romana-pizzadb-p9`, `quad-cities-style-pizza-pizzadb-p2`, `st-louis-style-pizza-pizzadb-p4`
- 確定依存（他 unit と併用が必要な行を含む） (28): `argentine-napolitana-pizzadb-p1`, `cauliflower-crust-pizza-pizzadb-p2`, `chicago-stuffed-pizza-pizzadb-p3`, `colorado-mountain-pie-pizzadb-p3`, `detroit-style-pizza-pizzadb-p5`, `fathead-pizza-keto-pizzadb-p9`, `focaccia-genovese-pizzadb-p10`, `fruit-dessert-pizza-pizzadb-p11`, `fugazza-pizzadb-p10`, `fugazzetta-pizzadb-p10`, `greek-style-pizzadb`, `lahmacun`, `manakish`, `new-england-bar-pizza-pizzadb-p6`, `ny-style-pizzadb`, `old-forge-style-pizza-pizzadb-p1`, `palmitos-salsa-golf-pizzadb-p7`, `pizza-a-caballo`, `pizza-al-taglio-romana-pizzadb-p9`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-de-cancha`, `pizza-puntarelle-pizzadb-p8`, `pizza-romana-pizzadb-p9`, `quad-cities-style-pizza-pizzadb-p2`, `siciliana-pizzadb`, `st-louis-style-pizza-pizzadb-p4`, `turkish-pide-pizzadb-p5`

**`RUNTIME:SAUCELESS_RECIPE_CONTRACT`** — reuses: RECIPE_SAUCE_PROFILES is an exhaustive Record<RecipeId, RecipeSauceProfile>; every profile must point to a sauce-category required ingredient, and RecipeSauceProfile.ingredientId is the closed union olive-oil | pesto | tomato-sauce.

- runtime 単独依存 (7): `bianca-pizzadb-row`, `boscaiola-pizzadb-p12`, `chilean-napolitana-pizzadb`, `hokkaido-cheese-pizza-pizzadb-p15`, `philly-cheesesteak-pizza-pizzadb-p9`, `porcini-pizza-pizzadb-p13`, `speck-e-brie-pizzadb-p4`
- うち content-only follow-up で実装可能 (7): `bianca-pizzadb-row`, `boscaiola-pizzadb-p12`, `chilean-napolitana-pizzadb`, `hokkaido-cheese-pizza-pizzadb-p15`, `philly-cheesesteak-pizza-pizzadb-p9`, `porcini-pizza-pizzadb-p13`, `speck-e-brie-pizzadb-p4`
- 確定依存（他 unit と併用が必要な行を含む） (19): `argentine-napolitana-pizzadb-p1`, `bianca-pizzadb-row`, `black-truffle-pizza-pizzadb-p14`, `boscaiola-pizzadb-p12`, `chilean-napolitana-pizzadb`, `fugazzetta-pizzadb-p10`, `hokkaido-cheese-pizza-pizzadb-p15`, `philly-cheesesteak-pizza-pizzadb-p9`, `pizza-a-caballo`, `pizza-asparagi-limone-pizzadb-p8`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cavolo-carote-pizzadb-p8`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-finocchi-salad-pizzadb-p8`, `pizza-puntarelle-pizzadb-p8`, `pizza-radicchio-noci-pizzadb-p8`, `pizza-zucchine-menta-pizzadb-p8`, `porcini-pizza-pizzadb-p13`, `speck-e-brie-pizzadb-p4`

**`RUNTIME:MULTI_SPREAD_LAYER`** — reuses: existing SAUCE paint controller; generalizes RecipeSauceProfile from one ingredient to an ordered list of spread layers

- runtime 単独依存 (4): `margherita-pizzadb-row`, `marinara-pizza-pizzadb-p13`, `pescatore-pizzadb-p11`, `sfincione-pizzadb`
- うち content-only follow-up で実装可能 (2): `pescatore-pizzadb-p11`, `sfincione-pizzadb`
- 確定依存（他 unit と併用が必要な行を含む） (11): `buffalo-chicken-pizzadb`, `feteer-meshaltet-pizzadb-p10`, `hot-honey-pepperoni-pizzadb-p12`, `lahmacun`, `margherita-pizzadb-row`, `marinara-pizza-pizzadb-p13`, `okonomiyaki-style-pizza-pizzadb-p1`, `pescatore-pizzadb-p11`, `pizza-de-cancha`, `pizza-radicchio-noci-pizzadb-p8`, `sfincione-pizzadb`
- conditional (14): `buffalo-cauliflower-pizza-pizzadb-p6`, `diavola-pizza-pizzadb-p5`, `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `nashville-hot-chicken-pizza-pizzadb-p6`, `nduja-pizza-pizzadb-p14`, `pizza-baiana`, `pizza-cicoria-limone-pizzadb-p8`, `potato-mayo-pizza-pizzadb-p3`, `south-african-boerewors-pizzadb-p14`, `swedish-kebab-pizza-pizzadb-p4`, `teriyaki-chicken-pizza-pizzadb-p14`, `thai-chicken-pizza-pizzadb-p4`, `venezuelan-reina-pepiada-pizzadb-p12`

**`RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT`** — reuses: RECIPE_SAUCE_PROFILES is an exhaustive Record<RecipeId, RecipeSauceProfile>; every profile must point to a sauce-category required ingredient, and RecipeSauceProfile.ingredientId is the closed union olive-oil | pesto | tomato-sauce.

- runtime 単独依存 (1): `peking-duck-pizza`
- うち content-only follow-up で実装可能 (1): `peking-duck-pizza`
- 確定依存（他 unit と併用が必要な行を含む） (6): `buffalo-chicken-pizzadb`, `nutella-dessert-pizza-pizzadb-p6`, `okonomiyaki-style-pizza-pizzadb-p1`, `peking-duck-pizza`, `taco-pizza-pizzadb`, `thai-chicken-pizza-pizzadb-p4`
- conditional (36): `apple-cinnamon-dessert-pizzadb`, `baingan-bharta-pizza-pizzadb-p6`, `banh-mi-pizza-pizzadb-p6`, `breakfast-pizza-pizzadb-p11`, `buffalo-cauliflower-pizza-pizzadb-p6`, `bulgogi-pizza-pizzadb-p11`, `caponata-pizza-pizzadb-p2`, `chicken-tikka-pizza-pizzadb-p5`, `curry-pizza-japan-pizzadb-p2`, `eel-pizza-pizzadb-p1`, `feteer-meshaltet-pizzadb-p10`, `fruit-dessert-pizza-pizzadb-p11`, `goulash-pizza-pizzadb-p3`, `jamaican-jerk-chicken-pizza-pizzadb-p3`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `keema-pizza-pizzadb-p2`, `kimchi-pizza-pizzadb-p2`, `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `moussaka-style-pizza-pizzadb-p13`, `nashville-hot-chicken-pizza-pizzadb-p6`, `natto-pizza`, `nduja-pizza-pizzadb-p14`, `nigerian-suya-pizza-pizzadb-p5`, `palmitos-salsa-golf-pizzadb-p7`, `peruvian-aji-amarillo-pizzadb-p12`, `pizza-de-lomo-saltado`, `potato-mayo-pizza-pizzadb-p3`, `rendang-pizza-pizzadb-p14`, `smore-dessert-pizza-pizzadb-p4`, `south-african-boerewors-pizzadb-p14`, `swedish-kebab-pizza-pizzadb-p4`, `tandoori-paneer-pizza-pizzadb-p5`, `teriyaki-chicken-pizza-pizzadb-p14`, `ume-shiso-pizza-pizzadb-p14`, `venezuelan-reina-pepiada-pizzadb-p12`

**`RUNTIME:ENCLOSE`** — reuses: reserved FOLD/SEAL MakingStep values; hides the filling and normally disables CUT

- runtime 単独依存 (1): `calzone-pizzadb`
- うち content-only follow-up で実装可能 (1): `calzone-pizzadb`
- 確定依存（他 unit と併用が必要な行を含む） (3): `calzone-pizzadb`, `chicago-stuffed-pizza-pizzadb-p3`, `pizza-a-caballo`

**`RUNTIME:STEP_ORDER`** — reuses: CookingProfile.steps ordering (today fixed by deriveCoreSteps)

- runtime 単独依存 (1): `trenton-tomato-pie-pizzadb`
- うち content-only follow-up で実装可能 (1): `trenton-tomato-pie-pizzadb`
- 確定依存（他 unit と併用が必要な行を含む） (2): `chicago-deep-dish-pizzadb`, `trenton-tomato-pie-pizzadb`

**`RUNTIME:LATE_ADDITION`** — reuses: reserved FINISH MakingStep in the existing POST_BAKE phase; mode mid_bake adds a short re-bake after FINISH

- runtime 単独依存 (0): —
- うち content-only follow-up で実装可能 (0): —
- 確定依存（他 unit と併用が必要な行を含む） (9): `black-truffle-pizza-pizzadb-p14`, `buffalo-chicken-pizzadb`, `detroit-style-pizza-pizzadb-p5`, `eel-pizza-pizzadb-p1`, `natto-pizza`, `nutella-dessert-pizza-pizzadb-p6`, `pizza-de-lomo-saltado`, `smore-dessert-pizza-pizzadb-p4`, `teriyaki-chicken-pizza-pizzadb-p14`
- conditional (11): `hot-honey-pepperoni-pizzadb-p12`, `lahmacun`, `pizza-asparagi-limone-pizzadb-p8`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cavolo-carote-pizzadb-p8`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-finocchi-salad-pizzadb-p8`, `pizza-puntarelle-pizzadb-p8`, `pizza-radicchio-noci-pizzadb-p8`, `pizza-zucchine-menta-pizzadb-p8`, `taco-pizza-pizzadb`

**`RUNTIME:PAN_BAKE`** — reuses: BAKE step with a pan/tray container and pan-specific bakeTarget/visual (crisp bottom, walls)

- runtime 単独依存 (0): —
- うち content-only follow-up で実装可能 (0): —
- 確定依存（他 unit と併用が必要な行を含む） (7): `chicago-deep-dish-pizzadb`, `detroit-style-pizza-pizzadb-p5`, `greek-style-pizzadb`, `new-england-bar-pizza-pizzadb-p6`, `old-forge-style-pizza-pizzadb-p1`, `pizza-al-taglio-romana-pizzadb-p9`, `siciliana-pizzadb`

**`RUNTIME:DOUGH_SHAPE_TARGET`** — reuses: doughShape.ts shape-validation seam; requires CUT geometry to stop assuming an ideal circle

- runtime 単独依存 (0): —
- うち content-only follow-up で実装可能 (0): —
- 確定依存（他 unit と併用が必要な行を含む） (5): `detroit-style-pizza-pizzadb-p5`, `old-forge-style-pizza-pizzadb-p1`, `pizza-al-taglio-romana-pizzadb-p9`, `siciliana-pizzadb`, `turkish-pide-pizzadb-p5`

**`RUNTIME:PREP_STEP`** — reuses: new PREPARE step before TOPPING; output is an ordinary scatter topping

- runtime 単独依存 (0): —
- うち content-only follow-up で実装可能 (0): —
- 確定依存（他 unit と併用が必要な行を含む） (2): `kimchi-pizza-pizzadb-p2`, `pizza-de-lomo-saltado`

**`RUNTIME:LAMINATE`** — reuses: new DOUGH-preparation gesture (repeated fold of the dough itself)

- runtime 単独依存 (0): —
- うち content-only follow-up で実装可能 (0): —
- 確定依存（他 unit と併用が必要な行を含む） (1): `feteer-meshaltet-pizzadb-p10`

**`RUNTIME:SERVE_FORM`** — reuses: POST_BAKE presentation step (alternative to CUT)

- runtime 単独依存 (0): —
- うち content-only follow-up で実装可能 (0): —
- 確定依存（他 unit と併用が必要な行を含む） (0): —
- conditional (2): `lahmacun`, `ny-style-pizzadb`

**`RUNTIME:ZONED_PLACEMENT`** — reuses: SAUCE/TOPPING modifier (regions) per docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md section 4

- runtime 単独依存 (0): —
- うち content-only follow-up で実装可能 (0): —
- 確定依存（他 unit と併用が必要な行を含む） (0): —
- conditional (2): `bismarck-pizza-pizzadb-p7`, `capricciosa-pizzadb`

### 5.3 greedy coverage（104 行内・確定 runtime 依存のみ）

104 行内で、各 step に『確定 runtime 依存がすべて満たされる行』を最も増やす unit を選ぶ。tie は costClass 安い順→unit 名順。coverage 指標のみで実装順ではない。conditional 依存は数えない。

| step | unit | cost | 新たに runtime 依存が消える行 | 累計 |
|---:|---|---|---:|---:|
| 1 | `DOUGH_VARIANT` | S | 12 | 12 |
| 2 | `SAUCELESS_RECIPE_CONTRACT` | — | 16 | 28 |
| 3 | `MULTI_SPREAD_LAYER` | M | 8 | 36 |
| 4 | `LATE_ADDITION` | M | 5 | 41 |
| 5 | `UNSUPPORTED_SAUCE_ID_CONTRACT` | — | 6 | 47 |
| 6 | `ENCLOSE` | L | 3 | 50 |
| 7 | `PAN_BAKE` | M | 2 | 52 |
| 8 | `DOUGH_SHAPE_TARGET` | L | 5 | 57 |
| 9 | `STEP_ORDER` | S | 2 | 59 |
| 10 | `PREP_STEP` | M | 2 | 61 |
| 11 | `LAMINATE` | L | 1 | 62 |

注: 「runtime 依存が消える」は evidence / decision item の解消を意味しない。実装可能化には §4 の cluster と §7 の authoring が別途必要。

### 5.4 UNSUPPORTED_SAUCE_ID_CONTRACT の sauce id 内訳（確定依存 6 行）

| sauce id | rows |
|---|---|
| `buffalo-sauce` | `buffalo-chicken-pizzadb` |
| `nutella-spread` | `nutella-dessert-pizza-pizzadb-p6` |
| `okonomiyaki-sauce` | `okonomiyaki-style-pizza-pizzadb-p1` |
| `peanut-sauce` | `thai-chicken-pizza-pizzadb-p4` |
| `salsa` | `taco-pizza-pizzadb` |
| `sweet-bean-sauce` | `peking-duck-pizza` |

6 行すべて sauce id が異なるため、sauce id 単位ではまとまらない。まとまるのは union を開く型変更（1 回）であり、各 sauce の ingredient authoring は行ごとに必要。conditional 側（sauce family 選定・alias）でこの unit を要求し得る行は 36 行。

## 6. 解決効果が大きい順の候補（客観指標のみ・実装順ではない）

以下は件数と依存関係だけで並べた候補であり、最終実装順・優先度・価格・unlock 条件を決めるものではない。

### 6.1 runtime を伴わない（content-only）で閉じる行 — 8 行

| evidenceId | nameJa | wave | classes | 必要な行為 |
|---|---|---|---|---|
| `calabresa-argentina-pizzadb` | アルゼンチン風カラブレーサ | W3 | COLLISION_RISK | naming disambiguation / 統合判断 |
| `supreme-pizzadb` | スプリームピザ | W3 | COMPOSITION_DECISION | compositionDecisionLedger の option を owner が選択 |
| `pizza-overload-pizzadb-p7` | ピザオーバーロード | W3 | PREPARED_COMPOSITE | 単一 ingredient 化 or 分解の content 判断 |
| `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | W3 | INGREDIENT_ALIAS | token「ひき肉」の canonical id 確定（候補: ['ground-beef']） |
| `pizza-alla-norma-pizzadb-p9` | ピッツァアッラノルマ | W3 | COMPOSITION_DECISION | compositionDecisionLedger の option を owner が選択 |
| `brazilian-calabresa-pizzadb-p10` | ブラジリアン・カラブレーザ | W3 | COLLISION_RISK | naming disambiguation / 統合判断 |
| `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | W3 | COMPOSITION_DECISION, COLLISION_RISK | compositionDecisionLedger の option を owner が選択; naming disambiguation / 統合判断 |
| `prosciutto-funghi-pizzadb-p11` | プロシュットフンギ | W3 | CAPABILITY_DEPENDENCY | 区別次元が無いため統合/drop 判断（または区別 evidence 取得） |

### 6.2 decision 次第で runtime 不要になり得る行 — 12 行

全 conditional item に runtime-free option がある行。option が evidence 上正しいかは未確認。

| evidenceId | nameJa | wave | runtime-free option |
|---|---|---|---|
| `capricciosa-pizzadb` | カプリチョーザ（PIZZA DB版） | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:capricciosa-pizzadb->capricciosa → keep shipped composition; MECHANIC_CONFIRMATION:ZONED_PLACEMENT → drop（evidence が工程を裏付けない場合） |
| `quattro-formaggi-pizzadb` | クアトロフォルマッジ（PIZZA DB版） | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:quattro-formaggi-pizzadb->quattro-formaggi → keep shipped composition |
| `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | W3 | SAUCE_BASE_SELECTION:その他 → supported sauce ['olive-oil', 'pesto', 'tomato-sauce'] を選定（evidence が裏付ける場合のみ） |
| `caponata-pizza-pizzadb-p2` | カポナータピザ | W3 | SAUCE_BASE_SELECTION:その他 → supported sauce ['olive-oil', 'pesto', 'tomato-sauce'] を選定（evidence が裏付ける場合のみ） |
| `goulash-pizza-pizzadb-p3` | グヤーシュピザ | W3 | SAUCE_BASE_SELECTION:その他 → supported sauce ['olive-oil', 'pesto', 'tomato-sauce'] を選定（evidence が裏付ける場合のみ） |
| `jamaican-jerk-chicken-pizza-pizzadb-p3` | ジャマイカンジャークチキンピザ | W3 | SAUCE_BASE_SELECTION:その他 → supported sauce ['olive-oil', 'pesto', 'tomato-sauce'] を選定（evidence が裏付ける場合のみ） |
| `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | W3 | SAUCE_BASE_SELECTION:その他 → supported sauce ['olive-oil', 'pesto', 'tomato-sauce'] を選定（evidence が裏付ける場合のみ） |
| `banh-mi-pizza-pizzadb-p6` | バインミーピザ | W3 | SAUCE_BASE_SELECTION:その他 → supported sauce ['olive-oil', 'pesto', 'tomato-sauce'] を選定（evidence が裏付ける場合のみ） |
| `bismarck-pizza-pizzadb-p7` | ビスマルク | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:bismarck-pizza-pizzadb-p7->bismarck → keep shipped composition; MECHANIC_CONFIRMATION:ZONED_PLACEMENT → drop（evidence が工程を裏付けない場合） |
| `pesto-genovese-pizza-pizzadb-p11` | ペストジェノヴェーゼピザ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:pesto-genovese-pizza-pizzadb-p11->genovese → keep shipped composition |
| `meat-lovers-pizza-pizzadb-p13` | ミートラバーズピザ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:meat-lovers-pizza-pizzadb-p13->meat-lovers → keep shipped composition |
| `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | W3 | SAUCE_BASE_SELECTION:その他 → supported sauce ['olive-oil', 'pesto', 'tomato-sauce'] を選定（evidence が裏付ける場合のみ） |

### 6.3 runtime unit の候補順（指標）

| cluster | +content-only で実装可能 | runtime 単独依存 | 確定依存 | conditional | cost | 前提 |
|---|---:|---:|---:|---:|---|---|
| `COMPOSITE:DOUGH_AND_PAN` | 14 | 15 | 29 | 0 | — | なし（taxonomy dependsOn は全 capability で空） |
| `COMPOSITE:SAUCE_PROFILE_GENERALIZATION` | 12 | 14 | 33 | 37 | — | SAUCE_FAMILY / ALIAS の選定結果で conditional 行数が変わる |
| `RUNTIME:DOUGH_VARIANT` | 8 | 9 | 28 | 0 | S | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:SAUCELESS_RECIPE_CONTRACT` | 7 | 7 | 19 | 0 | — | SAUCE_FAMILY / ALIAS の選定結果で conditional 行数が変わる |
| `RUNTIME:MULTI_SPREAD_LAYER` | 2 | 4 | 11 | 14 | M | SAUCE_FAMILY / ALIAS の選定結果で conditional 行数が変わる |
| `RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT` | 1 | 1 | 6 | 36 | — | SAUCE_FAMILY / ALIAS の選定結果で conditional 行数が変わる |
| `RUNTIME:ENCLOSE` | 1 | 1 | 3 | 0 | L | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:STEP_ORDER` | 1 | 1 | 2 | 0 | S | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:LATE_ADDITION` | 0 | 0 | 9 | 11 | M | MECHANIC_CONFIRM:LATE_ADDITION の confirm/drop で conditional 行数が変わる |
| `RUNTIME:PAN_BAKE` | 0 | 0 | 7 | 0 | M | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:DOUGH_SHAPE_TARGET` | 0 | 0 | 5 | 0 | L | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:PREP_STEP` | 0 | 0 | 2 | 0 | M | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:LAMINATE` | 0 | 0 | 1 | 0 | L | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:SERVE_FORM` | 0 | 0 | 0 | 2 | M | なし（taxonomy dependsOn は全 capability で空） |
| `RUNTIME:ZONED_PLACEMENT` | 0 | 0 | 0 | 2 | M | なし（taxonomy dependsOn は全 capability で空） |

### 6.4 content / decision cluster の候補順（指標）

| cluster | full | closes | rows | item runtime |
|---|---:|---:|---:|---|
| `COMPOSITION:CANDIDATE` | 2 | 10 | 18 | NO |
| `NAMING:NC-4-calabresa` | 2 | 2 | 2 | NO |
| `PREPARED_COMPOSITE` | 1 | 2 | 3 | NO |
| `ALIAS:ひき肉` | 1 | 1 | 5 | NO |
| `CAPDEP:NONE` | 1 | 1 | 1 | NO |
| `SAUCE_FAMILY:その他` | 0 | 10 | 10 | CONDITIONAL |
| `MECHANIC_CONFIRM:LATE_ADDITION` | 0 | 9 | 12 | CONDITIONAL |
| `COMPOSITION:SHIPPED` | 0 | 5 | 9 | CONDITIONAL |
| `SAUCE_FAMILY:カレー` | 0 | 3 | 5 | CONDITIONAL |
| `SAUCE_FAMILY:デザートソース` | 0 | 3 | 4 | CONDITIONAL |
| `SAUCE_FAMILY:ホットソース` | 0 | 2 | 6 | CONDITIONAL |
| `ALIAS:唐辛子` | 0 | 2 | 5 | CONDITIONAL |
| `ALIAS:チーズ` | 0 | 2 | 3 | NO |
| `CAPDEP:DOUGH_VARIANT` | 0 | 2 | 3 | YES |
| `EVIDENCE:EVIDENCE_GAP` | 0 | 2 | 2 | NO |
| `NAMING:NC-1-napoletana` | 0 | 2 | 2 | NO |
| `SAUCE_FAMILY:甘辛だれ` | 0 | 1 | 4 | CONDITIONAL |
| `ALIAS:ホワイトソース` | 0 | 1 | 2 | CONDITIONAL |
| `EVIDENCE:SCOPE_QUESTION` | 0 | 1 | 2 | NO |
| `MECHANIC_CONFIRM:SERVE_FORM` | 0 | 1 | 2 | CONDITIONAL |
| `NAMING:NC-3-sicilian` | 0 | 1 | 2 | NO |
| `NAMING:NC-6-frutti-pescatore` | 0 | 1 | 2 | NO |
| `NAMING:NC-7-chicago` | 0 | 1 | 2 | NO |
| `MECHANIC_CONFIRM:MULTI_SPREAD_LAYER` | 0 | 0 | 10 | CONDITIONAL |
| `SAUCE_FAMILY:ホワイトソース` | 0 | 0 | 4 | CONDITIONAL |
| `COLLISION:P0-COLL-5` | 0 | 0 | 2 | CONDITIONAL |
| `EVIDENCE:NAME_SPECIFICITY_GAP` | 0 | 0 | 2 | NO |
| `MECHANIC_CONFIRM:ZONED_PLACEMENT` | 0 | 0 | 2 | CONDITIONAL |

### 6.5 依存関係（順序制約として客観的に言えること）

1. `SAUCE_BASE_SELECTION` / `INGREDIENT_ALIAS` の結果が出るまで、52 行の identity set は incomplete のまま → collision / overlap / new ingredient 数（下限値）が確定しない。runtime cluster の conditional 行数もここで確定する。
2. `MECHANIC_CONFIRMATION`（26 item）の confirm/drop は、`LATE_ADDITION`（conditional 11 行）・`MULTI_SPREAD_LAYER`（conditional 14 行の一部）・`ZONED_PLACEMENT` / `SERVE_FORM` の対象行数を変える。
3. `CAPABILITY_DEPENDENCY` の 7 行（`prosciutto-funghi` を除く）は、既存 / 候補 recipe と同一 ingredient set で、区別が capability にしか無い。capability 未実装のまま追加すると discovery collision になる。
4. `COMPOSITION:SHIPPED`（9 行、全て W0_CORRESPONDENCE）は shipped recipe に関わるため、adopt を選ぶ場合は save / Dex migration の review が前提。
5. `DOUGH_SHAPE_TARGET` は CUT geometry の円前提を外す必要がある（#189 taxonomy）。対象 5 行は CUT policy も `SHAPE_AWARE_CUT_RUNTIME_OR_NO_CUT`。

## 7. Authoring（quantity / bake target / cut policy / ingredient visual）

| authoring | 対象行 | 内訳 |
|---|---|---|
| QUANTITY_AUTHORING | 104 | #189 matrix に数量 evidence 0 件。全行で minCount を authoring |
| BAKE_TARGET | 104 | CAPABILITY_DEPENDENT 33, STANDARD_AUTHORING 71（CAPABILITY_DEPENDENT = DOUGH_VARIANT / PAN_BAKE / FRY_COOK / ENCLOSE / LAMINATE / mid-bake LATE_ADDITION を要求、または pan / fry profile。capability 側の bakeTarget 仕様が先に要る） |
| CUT_POLICY | 104 | NO_CUT 1, OPT_IN_DECISION 95, SHAPE_AWARE_CUT_RUNTIME_OR_NO_CUT 5, UNSPECIFIED_EVIDENCE_NO_CUT_BY_DEFAULT 3 |
| INGREDIENT_VISUAL_AUTHORING | 78 | distinct 新 ingredient 111 種（下限。52 行は identity set incomplete のため下限値） |

### 7.1 複数行で共有される新 ingredient（visual authoring をまとめられる単位）

| ingredientId | rows | spread-layer | rows |
|---|---:|---|---|
| `chicken` | 9 |  | `buffalo-chicken-pizzadb`, `curry-pizza-japan-pizzadb-p2`, `jamaican-jerk-chicken-pizza-pizzadb-p3`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `nashville-hot-chicken-pizza-pizzadb-p6` 他4 |
| `beef` | 7 |  | `bulgogi-pizza-pizzadb-p11`, `goulash-pizza-pizzadb-p3`, `meat-lovers-pizza-pizzadb-p13`, `nigerian-suya-pizza-pizzadb-p5`, `philly-cheesesteak-pizza-pizzadb-p9` 他2 |
| `fresh-tomato` | 7 |  | `argentine-napolitana-pizzadb-p1`, `baingan-bharta-pizza-pizzadb-p6`, `chilean-napolitana-pizzadb`, `lahmacun`, `pizza-de-lomo-saltado` 他2 |
| `lemon` | 6 |  | `pizza-asparagi-limone-pizzadb-p8`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cavolo-carote-pizzadb-p8`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-puntarelle-pizzadb-p8` 他1 |
| `mayo` | 6 | yes | `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `okonomiyaki-style-pizza-pizzadb-p1`, `potato-mayo-pizza-pizzadb-p3`, `teriyaki-chicken-pizza-pizzadb-p14` 他1 |
| `cilantro` | 5 |  | `baingan-bharta-pizza-pizzadb-p6`, `banh-mi-pizza-pizzadb-p6`, `chicken-tikka-pizza-pizzadb-p5`, `thai-chicken-pizza-pizzadb-p4`, `venezuelan-reina-pepiada-pizzadb-p12` |
| `parsley` | 5 |  | `jerusalem-mixed-grill-pizza-pizzadb-p1`, `lahmacun`, `pescatore-pizzadb-p11`, `porcini-pizza-pizzadb-p13`, `turkish-pide-pizzadb-p5` |
| `eggplant` | 4 |  | `baingan-bharta-pizza-pizzadb-p6`, `caponata-pizza-pizzadb-p2`, `moussaka-style-pizza-pizzadb-p13`, `pizza-alla-norma-pizzadb-p9` |
| `green-onion` | 4 |  | `eel-pizza-pizzadb-p1`, `kimchi-pizza-pizzadb-p2`, `natto-pizza`, `peking-duck-pizza` |
| `green-pepper` | 4 |  | `jamaican-jerk-chicken-pizza-pizzadb-p3`, `nigerian-suya-pizza-pizzadb-p5`, `philly-cheesesteak-pizza-pizzadb-p9`, `tandoori-paneer-pizza-pizzadb-p5` |
| `honey` | 4 | yes | `feteer-meshaltet-pizzadb-p10`, `hot-honey-pepperoni-pizzadb-p12`, `nashville-hot-chicken-pizza-pizzadb-p6`, `nduja-pizza-pizzadb-p14` |
| `bell-pepper` | 3 |  | `chicken-tikka-pizza-pizzadb-p5`, `lahmacun`, `supreme-pizzadb` |
| `corn` | 3 |  | `hokkaido-cheese-pizza-pizzadb-p15`, `mexican-elote-pizza-pizzadb-p13`, `potato-mayo-pizza-pizzadb-p3` |
| `nori` | 3 |  | `mentaiko-mochi-pizza`, `natto-pizza`, `teriyaki-chicken-pizza-pizzadb-p14` |
| `potato` | 3 |  | `hokkaido-cheese-pizza-pizzadb-p15`, `pesto-genovese-pizza-pizzadb-p11`, `potato-mayo-pizza-pizzadb-p3` |
| `ricotta` | 3 |  | `bianca-pizzadb-row`, `calzone-pizzadb`, `pizza-zucchine-menta-pizzadb-p8` |
| `walnut` | 3 |  | `apple-cinnamon-dessert-pizzadb`, `pizza-radicchio-noci-pizzadb-p8`, `speck-e-brie-pizzadb-p4` |

2 行以下の ingredient は JSON `sharedNewIngredients` を参照。spread-layer ingredient（`mayo`, `honey` など）は scatter と違い sauce / spread contract の影響を受ける。

## 8. 行別 ledger（104 行）

列: runtime = runtimeChangeRequired、content-only = contentOnlyResolvable、free = runtimeFreePathExists、確定 / conditional unit = 実装に要る runtime unit、batch = 他行と共有する cluster、bake / cut = authoring status。詳細（item ごとの required evidence / action、options、prerequisites の stage 順）は JSON `rows[]`。

### 8.1 primaryClass `RECIPE_EVIDENCE`（7 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pizza-a-caballo` | ピッツァ・ア・カバージョ | W5 | RECIPE_EVIDENCE:pizza-a-caballo | 一次 source の ingredient list / profile text の再取得・照合 | YES | NO | N/A | DOUGH_VARIANT, ENCLOSE, SAUCELESS_RECIPE_CONTRACT | — | EVIDENCE:EVIDENCE_GAP, RUNTIME:DOUGH_VARIANT, RUNTIME:ENCLOSE, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 0 | CAP | UNSPECIFIED |
| `colorado-mountain-pie-pizzadb-p3` | コロラドマウンテンパイ | W4 | RECIPE_EVIDENCE:colorado-mountain-pie-pizzadb-p3 | 一次 source の ingredient list / profile text の再取得・照合 | YES | NO | N/A | DOUGH_VARIANT | — | EVIDENCE:EVIDENCE_GAP, RUNTIME:DOUGH_VARIANT | 0+ | CAP | OPT_IN |
| `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | W5 | SAUCE_BASE_SELECTION:デザートソース<br>RECIPE_EVIDENCE:feteer-meshaltet-pizzadb-p10<br>INGREDIENT_ALIAS:ひき肉 | owner による pizza 収録 scope 判断（分割・除外・そのまま収録）<br>source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | LAMINATE, MULTI_SPREAD_LAYER | UNSUPPORTED_SAUCE_ID_CONTRACT | ALIAS:ひき肉, EVIDENCE:SCOPE_QUESTION, RUNTIME:MULTI_SPREAD_LAYER, SAUCE_FAMILY:デザートソース | 3+ | CAP | UNSPECIFIED |
| `focaccia-genovese-pizzadb-p10` | フォカッチャジェノヴェーゼ | W4 | RECIPE_EVIDENCE:focaccia-genovese-pizzadb-p10 | owner による pizza 収録 scope 判断（分割・除外・そのまま収録） | YES | NO | N/A | DOUGH_VARIANT | — | EVIDENCE:SCOPE_QUESTION, RUNTIME:DOUGH_VARIANT | 1 | CAP | OPT_IN |
| `manakish` | マナキーシュ | W4 | RECIPE_EVIDENCE:manakish | source 内の矛盾（header vs Q&A）をどちらに合わせるかの evidence 判断 | YES | NO | N/A | DOUGH_VARIANT | — | RUNTIME:DOUGH_VARIANT | 2 | CAP | OPT_IN |
| `nduja-pizza-pizzadb-p14` | ンドゥイヤピザ | W3 | SAUCE_BASE_SELECTION:ホットソース<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER<br>RECIPE_EVIDENCE:nduja-pizza-pizzadb-p14 | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録）<br>名称が示す具体 ingredient を source が裏付けるかの確認（裏付け無しなら generic 維持） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | EVIDENCE:NAME_SPECIFICITY_GAP, MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホットソース | 1+ | STANDARD | OPT_IN |
| `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | W3 | SAUCE_BASE_SELECTION:甘辛だれ<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER<br>RECIPE_EVIDENCE:south-african-boerewors-pizzadb-p14 | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録）<br>名称が示す具体 ingredient を source が裏付けるかの確認（裏付け無しなら generic 維持） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | EVIDENCE:NAME_SPECIFICITY_GAP, MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:甘辛だれ | 1+ | STANDARD | OPT_IN |

### 8.2 primaryClass `INGREDIENT_ALIAS`（20 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pizza-baiana` | ピッツァ・バイアーナ | W3 | INGREDIENT_ALIAS:唐辛子 | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER | ALIAS:唐辛子 | 0+ | STANDARD | OPT_IN |
| `pizza-de-cancha` | ピッツァ・デ・カンチャ | W4 | INGREDIENT_ALIAS:唐辛子 | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | DOUGH_VARIANT, MULTI_SPREAD_LAYER | — | ALIAS:唐辛子, RUNTIME:DOUGH_VARIANT, RUNTIME:MULTI_SPREAD_LAYER | 0+ | CAP | OPT_IN |
| `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | W3 | SAUCE_BASE_SELECTION:ホットソース<br>INGREDIENT_ALIAS:肉<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホットソース | 2+ | STANDARD | OPT_IN |
| `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | W4 | INGREDIENT_ALIAS:プロヴェルチーズ | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | DOUGH_VARIANT | — | RUNTIME:DOUGH_VARIANT | 0+ | CAP | OPT_IN |
| `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | W3 | INGREDIENT_ALIAS:赤唐辛子 | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | UNSUPPORTED_SAUCE_ID_CONTRACT | MULTI_SPREAD_LAYER | RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT | 3+ | STANDARD | OPT_IN |
| `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | W5 | INGREDIENT_ALIAS:チーズ | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | — | ALIAS:チーズ, RUNTIME:DOUGH_SHAPE_TARGET, RUNTIME:DOUGH_VARIANT, RUNTIME:PAN_BAKE | 0+ | CAP | SHAPE |
| `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | W4 | INGREDIENT_ALIAS:青のり | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | — | RUNTIME:MULTI_SPREAD_LAYER, RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT | 5+ | STANDARD | OPT_IN |
| `curry-pizza-japan-pizzadb-p2` | カレーピザ | W3 | INGREDIENT_ALIAS:カレーソース | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | — | 1+ | STANDARD | OPT_IN |
| `keema-pizza-pizzadb-p2` | キーマピザ | W3 | SAUCE_BASE_SELECTION:カレー<br>INGREDIENT_ALIAS:ひき肉<br>INGREDIENT_ALIAS:青唐辛子 | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | ALIAS:ひき肉, SAUCE_FAMILY:カレー | 0+ | STANDARD | OPT_IN |
| `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | W4 | INGREDIENT_ALIAS:スパイシーソーセージ | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | DOUGH_VARIANT | — | RUNTIME:DOUGH_VARIANT | 0+ | CAP | OPT_IN |
| `diavola-pizza-pizzadb-p5` | ディアボラ | W3 | COMPOSITION_DECISION:COMP:diavola-pizza-pizzadb-p5->diavola<br>INGREDIENT_ALIAS:唐辛子 | compositionDecisionLedger の option を owner が選択<br>source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER | ALIAS:唐辛子, COMPOSITION:CANDIDATE | 1+ | STANDARD | OPT_IN |
| `turkish-pide-pizzadb-p5` | トルコピデ | W5 | INGREDIENT_ALIAS:ひき肉<br>INGREDIENT_ALIAS:チーズ | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | DOUGH_SHAPE_TARGET, DOUGH_VARIANT | — | ALIAS:ひき肉, ALIAS:チーズ, RUNTIME:DOUGH_SHAPE_TARGET, RUNTIME:DOUGH_VARIANT | 2+ | CAP | SHAPE |
| `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | W4 | COMPOSITION_DECISION:COMP:nutella-dessert-pizza-pizzadb-p6->nutella-dessert<br>INGREDIENT_ALIAS:ナッツ | compositionDecisionLedger の option を owner が選択<br>source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT | — | COMPOSITION:CANDIDATE, RUNTIME:LATE_ADDITION, RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT | 3+ | STANDARD | OPT_IN |
| `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION<br>INGREDIENT_ALIAS:唐辛子 | LATE_ADDITION を confirm / drop<br>source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | DOUGH_VARIANT, SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION, MULTI_SPREAD_LAYER | ALIAS:唐辛子, MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:DOUGH_VARIANT, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 3+ | CAP | OPT_IN |
| `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | W3 | INGREDIENT_ALIAS:ひき肉 | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | NO | YES | N/A | — | — | ALIAS:ひき肉 | 0+ | STANDARD | OPT_IN |
| `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | W3 | INGREDIENT_ALIAS:チーズソース | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | — | RUNTIME:SAUCELESS_RECIPE_CONTRACT | 2+ | STANDARD | OPT_IN |
| `breakfast-pizza-pizzadb-p11` | ブレックファーストピザ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:breakfast-pizza-pizzadb-p11->breakfast-pizza<br>INGREDIENT_ALIAS:ホワイトソース | compositionDecisionLedger の option を owner が選択<br>source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | ALIAS:ホワイトソース, COMPOSITION:SHIPPED | 1+ | STANDARD | OPT_IN |
| `lahmacun` | ラフマジュン | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION<br>MECHANIC_CONFIRMATION:SERVE_FORM<br>INGREDIENT_ALIAS:ひき肉<br>INGREDIENT_ALIAS:唐辛子 | LATE_ADDITION を confirm / drop<br>SERVE_FORM を confirm / drop<br>source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | DOUGH_VARIANT, MULTI_SPREAD_LAYER | LATE_ADDITION, SERVE_FORM | ALIAS:ひき肉, ALIAS:唐辛子, MECHANIC_CONFIRM:LATE_ADDITION, MECHANIC_CONFIRM:SERVE_FORM, RUNTIME:DOUGH_VARIANT, RUNTIME:MULTI_SPREAD_LAYER | 3+ | CAP | OPT_IN |
| `moussaka-style-pizza-pizzadb-p13` | ムサカ風ピザ | W3 | INGREDIENT_ALIAS:ホワイトソース | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | ALIAS:ホワイトソース | 4+ | STANDARD | OPT_IN |
| `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | W3 | INGREDIENT_ALIAS:チーズ | source の具体名（部位・種類・製品）で relatedIds のどれに当たるか、または新 id かを裏付ける | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | — | ALIAS:チーズ, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 2+ | STANDARD | OPT_IN |

### 8.3 primaryClass `SAUCE_BASE_SELECTION`（28 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `apple-cinnamon-dessert-pizzadb` | アップルシナモンデザートピザ | W3 | SAUCE_BASE_SELECTION:デザートソース | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:デザートソース | 4+ | STANDARD | OPT_IN |
| `smore-dessert-pizza-pizzadb-p4` | スモアデザートピザ | W4 | SAUCE_BASE_SELECTION:デザートソース | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | LATE_ADDITION | UNSUPPORTED_SAUCE_ID_CONTRACT | RUNTIME:LATE_ADDITION, SAUCE_FAMILY:デザートソース | 3+ | STANDARD | OPT_IN |
| `eel-pizza-pizzadb-p1` | うなぎピザ | W4 | SAUCE_BASE_SELECTION:甘辛だれ<br>MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | LATE_ADDITION | UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:LATE_ADDITION, SAUCE_FAMILY:甘辛だれ | 3+ | STANDARD | OPT_IN |
| `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | W3 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:その他 | 3+ | STANDARD | OPT_IN |
| `caponata-pizza-pizzadb-p2` | カポナータピザ | W3 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:その他 | 2+ | STANDARD | OPT_IN |
| `kimchi-pizza-pizzadb-p2` | キムチピザ | W4 | SAUCE_BASE_SELECTION:ホットソース | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | PREP_STEP | UNSUPPORTED_SAUCE_ID_CONTRACT | RUNTIME:PREP_STEP, SAUCE_FAMILY:ホットソース | 3+ | STANDARD | OPT_IN |
| `goulash-pizza-pizzadb-p3` | グヤーシュピザ | W3 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:その他 | 3+ | STANDARD | OPT_IN |
| `potato-mayo-pizza-pizzadb-p3` | じゃがマヨピザ | W3 | SAUCE_BASE_SELECTION:ホワイトソース<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホワイトソース | 3+ | STANDARD | OPT_IN |
| `jamaican-jerk-chicken-pizza-pizzadb-p3` | ジャマイカンジャークチキンピザ | W3 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:その他 | 3+ | STANDARD | OPT_IN |
| `tandoori-paneer-pizza-pizzadb-p5` | タンドリーパニールピザ | W3 | SAUCE_BASE_SELECTION:カレー | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:カレー | 2+ | STANDARD | OPT_IN |
| `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | W3 | SAUCE_BASE_SELECTION:カレー<br>PREPARED_COMPOSITE:チキンティッカ | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録）<br>単一 ingredient 化 or 分解の content 判断 | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | PREPARED_COMPOSITE, SAUCE_FAMILY:カレー | 3+ | STANDARD | OPT_IN |
| `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | W3 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:その他 | 2+ | STANDARD | OPT_IN |
| `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | W3 | SAUCE_BASE_SELECTION:ホットソース<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホットソース | 3+ | STANDARD | OPT_IN |
| `baingan-bharta-pizza-pizzadb-p6` | バインガンバルタピザ | W3 | SAUCE_BASE_SELECTION:カレー | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:カレー | 3+ | STANDARD | OPT_IN |
| `banh-mi-pizza-pizzadb-p6` | バインミーピザ | W3 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:その他 | 4+ | STANDARD | OPT_IN |
| `buffalo-cauliflower-pizza-pizzadb-p6` | バッファローカリフラワーピザ | W3 | SAUCE_BASE_SELECTION:ホットソース<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホットソース | 2+ | STANDARD | OPT_IN |
| `palmitos-salsa-golf-pizzadb-p7` | パルミートス・イ・サルサ・ゴルフ | W4 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | DOUGH_VARIANT | UNSUPPORTED_SAUCE_ID_CONTRACT | RUNTIME:DOUGH_VARIANT, SAUCE_FAMILY:その他 | 1+ | CAP | OPT_IN |
| `fruit-dessert-pizza-pizzadb-p11` | フルーツデザートピザ | W4 | SAUCE_BASE_SELECTION:デザートソース | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | DOUGH_VARIANT | UNSUPPORTED_SAUCE_ID_CONTRACT | RUNTIME:DOUGH_VARIANT, SAUCE_FAMILY:デザートソース | 4+ | CAP | OPT_IN |
| `bulgogi-pizza-pizzadb-p11` | プルコギピザ | W3 | SAUCE_BASE_SELECTION:甘辛だれ | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:甘辛だれ | 2+ | STANDARD | OPT_IN |
| `venezuelan-reina-pepiada-pizzadb-p12` | ベネズエラレイナペピアーダピザ | W3 | SAUCE_BASE_SELECTION:ホワイトソース<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホワイトソース | 4+ | STANDARD | OPT_IN |
| `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | W3 | SAUCE_BASE_SELECTION:ホットソース | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:ホットソース | 2+ | STANDARD | OPT_IN |
| `natto-pizza` | 納豆ピザ | W4 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | LATE_ADDITION | UNSUPPORTED_SAUCE_ID_CONTRACT | RUNTIME:LATE_ADDITION, SAUCE_FAMILY:その他 | 4+ | CAP | OPT_IN |
| `mentaiko-mochi-pizza` | 明太子もちピザ | W3 | SAUCE_BASE_SELECTION:ホワイトソース<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホワイトソース | 5+ | STANDARD | OPT_IN |
| `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | W4 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | LATE_ADDITION, PREP_STEP | UNSUPPORTED_SAUCE_ID_CONTRACT | RUNTIME:LATE_ADDITION, RUNTIME:PREP_STEP, SAUCE_FAMILY:その他 | 3+ | CAP | OPT_IN |
| `mexican-elote-pizza-pizzadb-p13` | メキシカンエロテピザ | W3 | SAUCE_BASE_SELECTION:ホワイトソース<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, SAUCE_FAMILY:ホワイトソース | 5+ | STANDARD | OPT_IN |
| `rendang-pizza-pizzadb-p14` | ルンダンピザ | W3 | SAUCE_BASE_SELECTION:カレー | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | NO | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:カレー | 1+ | STANDARD | OPT_IN |
| `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | W4 | SAUCE_BASE_SELECTION:甘辛だれ<br>COMPOSITION_DECISION:COMP:teriyaki-chicken-pizza-pizzadb-p14->teriyaki-chicken<br>MECHANIC_CONFIRMATION:MULTI_SPREAD_LAYER | MULTI_SPREAD_LAYER を confirm / drop<br>compositionDecisionLedger の option を owner が選択<br>source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | YES | NO | N/A | LATE_ADDITION | MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | COMPOSITION:CANDIDATE, MECHANIC_CONFIRM:MULTI_SPREAD_LAYER, RUNTIME:LATE_ADDITION, SAUCE_FAMILY:甘辛だれ | 3+ | STANDARD | OPT_IN |
| `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | W3 | SAUCE_BASE_SELECTION:その他 | source/profile text で具体 sauce を裏付ける（無ければ owner の content decision として記録） | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | UNSUPPORTED_SAUCE_ID_CONTRACT | SAUCE_FAMILY:その他 | 3+ | STANDARD | OPT_IN |

### 8.4 primaryClass `COMPOSITION_DECISION`（23 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `capricciosa-pizzadb` | カプリチョーザ（PIZZA DB版） | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:capricciosa-pizzadb->capricciosa<br>MECHANIC_CONFIRMATION:ZONED_PLACEMENT | ZONED_PLACEMENT を confirm / drop<br>compositionDecisionLedger の option を owner が選択 | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | ZONED_PLACEMENT | COMPOSITION:SHIPPED, MECHANIC_CONFIRM:ZONED_PLACEMENT | 1 | STANDARD | OPT_IN |
| `calzone-pizzadb` | カルツォーネ（PIZZA DB版） | W5 | COMPOSITION_DECISION:COMP:calzone-pizzadb->calzone | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | ENCLOSE | — | COMPOSITION:CANDIDATE, RUNTIME:ENCLOSE | 2 | CAP | NO |
| `quattro-formaggi-pizzadb` | クアトロフォルマッジ（PIZZA DB版） | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:quattro-formaggi-pizzadb->quattro-formaggi | compositionDecisionLedger の option を owner が選択 | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | — | COMPOSITION:SHIPPED | 0 | STANDARD | OPT_IN |
| `greek-style-pizzadb` | グリークスタイルピザ（PIZZA DB版） | W5 | COMPOSITION_DECISION:COMP:greek-style-pizzadb->greek-style | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | DOUGH_VARIANT, PAN_BAKE | — | COMPOSITION:CANDIDATE, RUNTIME:DOUGH_VARIANT, RUNTIME:PAN_BAKE | 1 | CAP | OPT_IN |
| `chicago-deep-dish-pizzadb` | シカゴディープディッシュ（PIZZA DB版） | W5 | COMPOSITION_DECISION:COMP:chicago-deep-dish-pizzadb->chicago-deep-dish<br>COLLISION_RISK:NC-7-chicago | compositionDecisionLedger の option を owner が選択<br>naming disambiguation / 統合判断 | YES | NO | N/A | PAN_BAKE, STEP_ORDER | — | COMPOSITION:CANDIDATE, NAMING:NC-7-chicago, RUNTIME:PAN_BAKE, RUNTIME:STEP_ORDER | 0 | CAP | OPT_IN |
| `siciliana-pizzadb` | シチリアンピザ（PIZZA DB版） | W5 | COMPOSITION_DECISION:COMP:siciliana-pizzadb->siciliana<br>COLLISION_RISK:NC-3-sicilian | compositionDecisionLedger の option を owner が選択<br>naming disambiguation / 統合判断 | YES | NO | N/A | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | — | COMPOSITION:CANDIDATE, NAMING:NC-3-sicilian, RUNTIME:DOUGH_SHAPE_TARGET, RUNTIME:DOUGH_VARIANT, RUNTIME:PAN_BAKE | 0 | CAP | SHAPE |
| `supreme-pizzadb` | スプリームピザ | W3 | COMPOSITION_DECISION:COMP:supreme-pizzadb->supreme | compositionDecisionLedger の option を owner が選択 | NO | YES | N/A | — | — | COMPOSITION:CANDIDATE | 1 | STANDARD | OPT_IN |
| `buffalo-chicken-pizzadb` | バッファローチキンピザ（PIZZA DB版） | W4 | COMPOSITION_DECISION:COMP:buffalo-chicken-pizzadb->buffalo-chicken | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | LATE_ADDITION, MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | — | COMPOSITION:CANDIDATE, RUNTIME:LATE_ADDITION, RUNTIME:MULTI_SPREAD_LAYER, RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT | 3 | STANDARD | OPT_IN |
| `margherita-pizzadb-row` | マルゲリータ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:margherita-pizzadb-row->margherita | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | MULTI_SPREAD_LAYER | — | COMPOSITION:SHIPPED, RUNTIME:MULTI_SPREAD_LAYER | 0 | STANDARD | OPT_IN |
| `speck-e-brie-pizzadb-p4` | スペックエブリー | W3 | COMPOSITION_DECISION:COMP:speck-e-brie-pizzadb-p4->speck-e-brie<br>COLLISION_RISK:NC-5-speck-e-brie | compositionDecisionLedger の option を owner が選択<br>naming disambiguation / 統合判断 | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | — | COMPOSITION:CANDIDATE, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 3 | STANDARD | OPT_IN |
| `detroit-style-pizza-pizzadb-p5` | デトロイトスタイルピザ | W5 | COMPOSITION_DECISION:COMP:detroit-style-pizza-pizzadb-p5->detroit-style | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, LATE_ADDITION, PAN_BAKE | — | COMPOSITION:CANDIDATE, RUNTIME:DOUGH_SHAPE_TARGET, RUNTIME:DOUGH_VARIANT, RUNTIME:LATE_ADDITION, RUNTIME:PAN_BAKE | 1 | CAP | SHAPE |
| `bismarck-pizza-pizzadb-p7` | ビスマルク | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:bismarck-pizza-pizzadb-p7->bismarck<br>MECHANIC_CONFIRMATION:ZONED_PLACEMENT | ZONED_PLACEMENT を confirm / drop<br>compositionDecisionLedger の option を owner が選択 | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | ZONED_PLACEMENT | COMPOSITION:SHIPPED, MECHANIC_CONFIRM:ZONED_PLACEMENT | 0 | STANDARD | OPT_IN |
| `pizza-romana-pizzadb-p9` | ピッツァ・ロマーナ | W4 | COMPOSITION_DECISION:COMP:pizza-romana-pizzadb-p9->romana | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | DOUGH_VARIANT | — | COMPOSITION:CANDIDATE, RUNTIME:DOUGH_VARIANT | 1 | CAP | OPT_IN |
| `pizza-alla-norma-pizzadb-p9` | ピッツァアッラノルマ | W3 | COMPOSITION_DECISION:COMP:pizza-alla-norma-pizzadb-p9->alla-norma | compositionDecisionLedger の option を owner が選択 | NO | YES | N/A | — | — | COMPOSITION:CANDIDATE | 2 | STANDARD | OPT_IN |
| `fugazza-pizzadb-p10` | フガザ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:fugazza-pizzadb-p10->fugazza<br>COLLISION_RISK:P0-COLL-5 | compositionDecisionLedger の option を owner が選択<br>区別次元の evidence 取得、または統合/片方 drop 判断 | YES | NO | N/A | DOUGH_VARIANT | — | COLLISION:P0-COLL-5, COMPOSITION:SHIPPED, RUNTIME:DOUGH_VARIANT | 0 | CAP | OPT_IN |
| `fugazzetta-pizzadb-p10` | フガゼッタ | W4 | COMPOSITION_DECISION:COMP:fugazzetta-pizzadb-p10->fugazzeta<br>COLLISION_RISK:P0-COLL-5 | compositionDecisionLedger の option を owner が選択<br>区別次元の evidence 取得、または統合/片方 drop 判断 | YES | NO | N/A | DOUGH_VARIANT, SAUCELESS_RECIPE_CONTRACT | — | COLLISION:P0-COLL-5, COMPOSITION:CANDIDATE, RUNTIME:DOUGH_VARIANT, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 0 | CAP | OPT_IN |
| `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | W3 | COMPOSITION_DECISION:COMP:frutti-di-mare-pizzadb-p11->frutti-di-mare<br>COLLISION_RISK:NC-6-frutti-pescatore | compositionDecisionLedger の option を owner が選択<br>naming disambiguation / 統合判断 | NO | YES | N/A | — | — | COMPOSITION:CANDIDATE, NAMING:NC-6-frutti-pescatore | 4 | STANDARD | OPT_IN |
| `pesto-genovese-pizza-pizzadb-p11` | ペストジェノヴェーゼピザ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:pesto-genovese-pizza-pizzadb-p11->genovese | compositionDecisionLedger の option を owner が選択 | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | — | COMPOSITION:SHIPPED | 2 | STANDARD | OPT_IN |
| `boscaiola-pizzadb-p12` | ボスカイオーラ | W3 | COMPOSITION_DECISION:COMP:boscaiola-pizzadb-p12->boscaiola | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | — | COMPOSITION:CANDIDATE, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 1 | STANDARD | OPT_IN |
| `porcini-pizza-pizzadb-p13` | ポルチーニ茸のピザ | W3 | COMPOSITION_DECISION:COMP:porcini-pizza-pizzadb-p13->ai-funghi-porcini | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | — | COMPOSITION:CANDIDATE, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 2 | STANDARD | OPT_IN |
| `marinara-pizza-pizzadb-p13` | マリナーラ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:marinara-pizza-pizzadb-p13->marinara | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | MULTI_SPREAD_LAYER | — | COMPOSITION:SHIPPED, RUNTIME:MULTI_SPREAD_LAYER | 0 | STANDARD | OPT_IN |
| `meat-lovers-pizza-pizzadb-p13` | ミートラバーズピザ | W0_CORRESPONDENCE | COMPOSITION_DECISION:COMP:meat-lovers-pizza-pizzadb-p13->meat-lovers | compositionDecisionLedger の option を owner が選択 | CONDITIONAL | DEPENDS_ON_DECISION | YES | — | — | COMPOSITION:SHIPPED | 1 | STANDARD | OPT_IN |
| `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | W4 | COMPOSITION_DECISION:COMP:black-truffle-pizza-pizzadb-p14->al-tartufo | compositionDecisionLedger の option を owner が選択 | YES | NO | N/A | LATE_ADDITION, SAUCELESS_RECIPE_CONTRACT | — | COMPOSITION:CANDIDATE, RUNTIME:LATE_ADDITION, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 1 | STANDARD | OPT_IN |

### 8.5 primaryClass `MECHANIC_CONFIRMATION`（10 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `taco-pizza-pizzadb` | タコピザ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | UNSUPPORTED_SAUCE_ID_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT | 6 | STANDARD | OPT_IN |
| `ny-style-pizzadb` | ニューヨークスタイルピザ（PIZZA DB版） | W4 | MECHANIC_CONFIRMATION:SERVE_FORM | SERVE_FORM を confirm / drop | YES | NO | N/A | DOUGH_VARIANT | SERVE_FORM | CAPDEP:DOUGH_VARIANT, MECHANIC_CONFIRM:SERVE_FORM, RUNTIME:DOUGH_VARIANT | 0 | CAP | OPT_IN |
| `pizza-asparagi-limone-pizzadb-p8` | ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 2 | STANDARD | OPT_IN |
| `pizza-carciofi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・カルチョーフィ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | DOUGH_VARIANT, SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:DOUGH_VARIANT, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 3 | CAP | OPT_IN |
| `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 3 | STANDARD | OPT_IN |
| `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 4 | STANDARD | OPT_IN |
| `pizza-zucchine-menta-pizzadb-p8` | ピッツァ・コン・ズッキーネ・クルーデ・エ・メンタ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 4 | STANDARD | OPT_IN |
| `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | DOUGH_VARIANT, SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:DOUGH_VARIANT, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 2 | CAP | OPT_IN |
| `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | MULTI_SPREAD_LAYER, SAUCELESS_RECIPE_CONTRACT | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:MULTI_SPREAD_LAYER, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 3 | STANDARD | OPT_IN |
| `hot-honey-pepperoni-pizzadb-p12` | ホットハニーペパロニピザ | W4 | MECHANIC_CONFIRMATION:LATE_ADDITION | LATE_ADDITION を confirm / drop | YES | NO | N/A | MULTI_SPREAD_LAYER | LATE_ADDITION | MECHANIC_CONFIRM:LATE_ADDITION, RUNTIME:MULTI_SPREAD_LAYER | 1 | STANDARD | OPT_IN |

### 8.6 primaryClass `COLLISION_RISK`（8 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `calabresa-argentina-pizzadb` | アルゼンチン風カラブレーサ | W3 | COLLISION_RISK:NC-4-calabresa | naming disambiguation / 統合判断 | NO | YES | N/A | — | — | NAMING:NC-4-calabresa | 1 | STANDARD | OPT_IN |
| `sfincione-pizzadb` | スフィンチョーネ | W4 | COLLISION_RISK:NC-3-sicilian | naming disambiguation / 統合判断 | YES | NO | N/A | MULTI_SPREAD_LAYER | — | NAMING:NC-3-sicilian, RUNTIME:MULTI_SPREAD_LAYER | 0 | STANDARD | OPT_IN |
| `chilean-napolitana-pizzadb` | チリアンナポリターナ | W3 | COLLISION_RISK:NC-1-napoletana | naming disambiguation / 統合判断 | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | — | NAMING:NC-1-napoletana, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 1 | STANDARD | OPT_IN |
| `bianca-pizzadb-row` | ピッツァビアンカ | W3 | COLLISION_RISK:NC-2-bianca | naming disambiguation / 統合判断 | YES | NO | N/A | SAUCELESS_RECIPE_CONTRACT | — | RUNTIME:SAUCELESS_RECIPE_CONTRACT | 1 | STANDARD | OPT_IN |
| `argentine-napolitana-pizzadb-p1` | アルゼンチン風ナポリターナ | W4 | COLLISION_RISK:NC-1-napoletana | naming disambiguation / 統合判断 | YES | NO | N/A | DOUGH_VARIANT, SAUCELESS_RECIPE_CONTRACT | — | NAMING:NC-1-napoletana, RUNTIME:DOUGH_VARIANT, RUNTIME:SAUCELESS_RECIPE_CONTRACT | 1 | CAP | OPT_IN |
| `chicago-stuffed-pizza-pizzadb-p3` | シカゴスタッフドピザ | W5 | COLLISION_RISK:NC-7-chicago | naming disambiguation / 統合判断 | YES | NO | N/A | DOUGH_VARIANT, ENCLOSE | — | NAMING:NC-7-chicago, RUNTIME:DOUGH_VARIANT, RUNTIME:ENCLOSE | 0 | CAP | UNSPECIFIED |
| `brazilian-calabresa-pizzadb-p10` | ブラジリアン・カラブレーザ | W3 | COLLISION_RISK:NC-4-calabresa | naming disambiguation / 統合判断 | NO | YES | N/A | — | — | NAMING:NC-4-calabresa | 0 | STANDARD | OPT_IN |
| `pescatore-pizzadb-p11` | ペスカトーレ | W4 | COLLISION_RISK:NC-6-frutti-pescatore | naming disambiguation / 統合判断 | YES | NO | N/A | MULTI_SPREAD_LAYER | — | NAMING:NC-6-frutti-pescatore, RUNTIME:MULTI_SPREAD_LAYER | 4 | STANDARD | OPT_IN |

### 8.7 primaryClass `PREPARED_COMPOSITE`（2 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pizza-overload-pizzadb-p7` | ピザオーバーロード | W3 | PREPARED_COMPOSITE:ホットドッグ | 単一 ingredient 化 or 分解の content 判断 | NO | YES | N/A | — | — | PREPARED_COMPOSITE | 2 | STANDARD | OPT_IN |
| `peking-duck-pizza` | 北京ダックピザ | W3 | PREPARED_COMPOSITE:北京ダック | 単一 ingredient 化 or 分解の content 判断 | YES | NO | N/A | UNSUPPORTED_SAUCE_ID_CONTRACT | — | PREPARED_COMPOSITE, RUNTIME:UNSUPPORTED_SAUCE_ID_CONTRACT | 4 | STANDARD | OPT_IN |

### 8.8 primaryClass `CAPABILITY_DEPENDENCY`（6 行）

| evidenceId | nameJa | wave | blocker（item） | required evidence / action | runtime | content-only | free | 確定 unit | conditional unit | batch | 新材料 | bake | cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `trenton-tomato-pie-pizzadb` | トレントントマトパイ | W4 | — | — | YES | NO | N/A | STEP_ORDER | — | RUNTIME:STEP_ORDER | 0 | STANDARD | OPT_IN |
| `cauliflower-crust-pizza-pizzadb-p2` | カリフラワークラストピザ | W4 | — | — | YES | NO | N/A | DOUGH_VARIANT | — | CAPDEP:DOUGH_VARIANT, RUNTIME:DOUGH_VARIANT | 0 | CAP | OPT_IN |
| `new-england-bar-pizza-pizzadb-p6` | ニューイングランドバーピザ | W5 | — | — | YES | NO | N/A | DOUGH_VARIANT, PAN_BAKE | — | RUNTIME:DOUGH_VARIANT, RUNTIME:PAN_BAKE | 0 | CAP | OPT_IN |
| `pizza-al-taglio-romana-pizzadb-p9` | ピッツァアルタリオローマーナ | W5 | — | — | YES | NO | N/A | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | — | RUNTIME:DOUGH_SHAPE_TARGET, RUNTIME:DOUGH_VARIANT, RUNTIME:PAN_BAKE | 0 | CAP | SHAPE |
| `fathead-pizza-keto-pizzadb-p9` | ファットヘッドピザ（ケト風） | W4 | — | — | YES | NO | N/A | DOUGH_VARIANT | — | CAPDEP:DOUGH_VARIANT, RUNTIME:DOUGH_VARIANT | 0 | CAP | OPT_IN |
| `prosciutto-funghi-pizzadb-p11` | プロシュットフンギ | W3 | CAPABILITY_DEPENDENCY:prosciutto-e-funghi | 区別次元が無いため統合/drop 判断（または区別 evidence 取得） | NO | YES | N/A | — | — | — | 1 | STANDARD | OPT_IN |

## 9. 本書が決めないこと

- 最終実装順、wave の再編、PR 分割。
- alias の確定先、sauce id の選定、mechanic の confirm/drop、composition option の選択、naming の決定（いずれも evidence 取得または owner decision が必要）。
- 価格・unlock: `pitzPrice=TBD`, `unlockFee=TBD`, `starGate=TBD`, `nonStarCondition=OWNER_DECISION_REQUIRED`, `completionGate=OWNER_DECISION_REQUIRED`。
- runtime capability の設計・見積もり（costClass は #189 の既存ラベルを転記しただけ）。

## 10. Validation

- 104 行 = PR #220 `count` と一致、evidenceId 重複なし、PR #220 の全 blocker / review item（14 type）が resolution class に写像済み（未写像 type は generator が停止する）。
- 各行の `requiredCapabilities` / `runtimeContractDependencies` は PR #220 WAVES json の値をそのまま使用。
- PR #220 の typeCounts（BASE_SAUCE_UNSPECIFIED 33 など）と §3.1 の item 数は、class 合算で一致（例: INGREDIENT_ALIAS 24 = UNRESOLVED_INGREDIENT 24、SAUCE_BASE_SELECTION 33、MECHANIC_CONFIRMATION 26 = MECHANIC_INTERPRETATION 11 + CANDIDATE_CAPABILITY 14 + lahmacun の `LATE_ADDITION,SERVE_FORM` 分割 1）。
- 入力 JSON の sha256 を `basis.inputs` に記録。

## 11. Machine-readable

- `docs/reports/data/TETO_PROGRESS2_172_UNRESOLVED_RESOLUTION-ROADMAP.json`
  - `rows[]`: 104 行。`resolutionItems[]`（class / sourceType / ref / requiredAction / requiredEvidence / runtimeChange / runtimeUnitsIfYes / runtimeFreeOption / clusterId）、`runtimeChangeRequired`、`contentOnlyResolvable`、`runtimeFreePathExists`、`definiteRuntimeUnits`、`conditionalRuntimeUnits`、`batchableClusters`、`authoring`、`prerequisites[]`（stage 1_EVIDENCE → 2_DECISION → 3_RUNTIME → 4_AUTHORING → 5_OWNER_PROGRESSION）。
  - `runtimeClusters[]`、`greedyDefiniteRuntimeCoverage`、`contentDecisionClusters[]`、`sharedNewIngredients[]`、`unsupportedSauceIdsInUnresolved`、`summary`。
