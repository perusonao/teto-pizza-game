# Post-W1 Runtime Recipe Expansion — Wave 2 Fresh Design

Status: **設計のみ（docs/data/tools）。production recipe set は確定していない — Owner Decision 待ち。**
src / e2e / CSS / runtime recipe / PR #252 / DH4 はいずれも変更していない。merge / deploy なし。

| 項目 | 値 |
|---|---|
| 基準 | fresh fetch した `origin/main` = `5a33d85`（PR #254 DH4-1 merge） |
| branch | `claude/wave2-runtime-recipe-design-os06j1` |
| machine-readable | `docs/design/data/TETO_WAVE2_RUNTIME-RECIPE_CANDIDATES.json`（172 行 + focus checks + 5 wave options） |
| generator / validator | `tools/progression2_wave2_candidates.py`（`--check` = 検証 + byte 比較）、入力 `tools/wave2_option_specs.json` |

次段: Owner Decision Gate（W2-A、main `51e0923` で再監査）→ `docs/reports/TETO_WAVE2_W2A_OWNER-DECISION-GATE.md`。

JSON が SSOT。本文の数値はすべて tool の出力を転記したもので、食い違えば JSON が正しい。

## 0. 読み直した authority

| 資料 | 使った内容 |
|---|---|
| 172 canonical audit / mechanic matrix（`TETO_RECIPE_172_MECHANIC-MATRIX*.md`, JSON） | 行ごとの identity set、sauceBase、dough、requiredCapabilities、blockers、reviewItems |
| 101 progression design（`TETO_PROGRESSION2_PHASE2_*`, SHIPPED_KEEP 101 targets） | decision-ready pool、identityDimensions、Phase-2 tier |
| gameplay mechanic matrix（11 capabilities, §4/§5） | capability → A–D 分類 |
| cooking profiles（`src/data/cookingProfiles.ts`） | `deriveCoreSteps`（SAUCE/CHEESE/TOPPING は材料カテゴリから派生）、CUT allowlist 24/25、`FINISH` は POST_BAKE 予約済み・未実装 |
| sauce profiles（`recipeSauceProfiles.ts`） | `Record<RecipeId, …>`、`ingredientId: tomato-sauce｜pesto｜olive-oil`、olive-oil は `PAINT_TEMPORARY`（DRIZZLE は TODO） |
| CUT profiles（Pizza Cutting 1.0 Phase 4B + REC-02 Q3） | opt-in allowlist。dough evidence が無い row は CUT なし（New Haven の前例） |
| ingredient taxonomy（DH4-1 `ingredientTaxonomy.ts`） | topping 22 行・7 family・k≥2 guard |
| progression authority（`discoveryLadder.ts` / REC-04 key-recipe rule, OD-REC04-1） | 1 発見 = 1 step、MATERIAL only、never relock、population ごとに再生成 |
| Scoring 2.0（`scoringV2/index.ts`, `referencePizza.ts`, `completionGate.ts`） | `ReferencePizza.sauce` 必須、Sauce weight 52/100、sauce quantity gate |

### runtime baseline（tool が src から parse）

recipes 25 / ingredients 29（sauce 3・cheese 4・topping 22）/ PAINT sauces 3 / CUT 24（なし: new-haven-apizza）/
taxonomy topping rows 22 / W1 ladder 24 steps。discovery は **ingredient set の完全一致**（全 25 target が default identity dimensions）。

## 1. 分類ルール（A–E）

| class | 意味 | 該当 mechanic（JSON `mechanicClass`） |
|---|---|---|
| **A** | 現行 mechanic だけ（既存材料・既存 sauce profile。CUT なしも A） | `NO_CUT_PROFILE` |
| **B** | 小さな data/profile 追加だけ | `NEW_INGREDIENT_DATA`（材料行 + visual + Shop 価格 + taxonomy 行）、`NEW_PAINT_SAUCE_PROFILE`（ingredientId union を広げる。gesture は既存 PAINT） |
| **C** | Cooking Steps 拡張（既存 seam 上） | `SAUCELESS_SCORING`、`FINISH_POST_BAKE`、`MULTI_SPREAD_LAYER`、`STEP_ORDER` |
| **D** | 新 mechanic | `DOUGH_VARIANT`、`PAN_BAKE`、`DOUGH_SHAPE_TARGET`、`ENCLOSE`、`PREP_STEP`、`ZONED_PLACEMENT`、`LAMINATE`、`FRY_COOK`、mid-bake `LATE_ADDITION` |
| **E** | evidence 不足 / Owner decision が先 | `E_EVIDENCE`（未解決 token・base sauce 不明・evidence gap・mechanic 解釈）、`E_OWNER_DECISION`（composition conflict・discovery collision・scope） |

行の class = 必要 mechanic の最大 class。Phase-1 で BLOCKED の行は mechanic に関係なく E。
capability は Phase-1 の REQUIRED strength の evidence だけを数える（candidate は昇格しない）。

**no-sauce を C にした理由（コードで確認）:** `deriveCoreSteps` は sauce 材料が無ければ SAUCE tab を出さないので
flow 自体は動く。しかし `ReferencePizza.sauce` は必須、`scoreSauceComponentV2` は Sauce に 52/100 の重みを
かけ（sauce 0 ならほぼ 0 点）、`RECIPE_SAUCE_PROFILES` は全 RecipeId に sauce を要求する。
sauce なし recipe を 1 つでも出すと Scoring 2.0 の重み配分を変える必要がある（authority 変更）ので、A/B にはできない。

## 2. 結果サマリ（172 行）

| class | 行数 |
|---|---|
| RUNTIME（W1 までに実装済みの PIZZA DB 行） | 11 |
| **A** | **1** |
| **B** | **26** |
| **C** | **31** |
| **D** | **18** |
| **E** | **85**（E_EVIDENCE 61 / E_OWNER_DECISION 24） |

E の blocker 内訳（重複あり）: BASE_SAUCE_UNSPECIFIED 33、UNRESOLVED_INGREDIENT 21、COMPOSITION_CONFLICT_CANDIDATE 18、
MECHANIC_INTERPRETATION 11、COMPOSITION_CONFLICT_SHIPPED 9、EVIDENCE_GAP 2、SCOPE_QUESTION 2、DISCOVERY_COLLISION 2。

**要点: 現行 mechanic だけで足せる行は 1 つ（ブラジリアン・カラブレーザ）しかない。** A+B = 27 行が「mechanic なし」の上限。

候補同士の完全一致 collision（Phase-1 と同じ 5 組、どれも片方が D/E）: cauliflower/al-taglio、fathead/new-england-bar、
fugazza-pizzadb/fugazzetta、**jamon-serrano/pinsa-romana**、**ny-style/trenton**。
→ jamon-serrano を先に出すと、将来 pinsa は `DOUGH_VARIANT` が無いと入れられない（記録のみ、Wave 2 では衝突しない）。

## 3. 指定 10 観点の確認（JSON `focusChecks`）

| 観点 | runtime 今 | 候補数 | A/B/C/D/E | 所見 |
|---|---|---|---|---|
| no-sauce | 0 | 31 | C19 / D3 / E9 | evidence は「チーズ」family で明確。**SAUCELESS_SCORING さえあれば 19 行が開く**、最大レバレッジ。Aussie と Chilean Napolitana は新材料ゼロ |
| white sauce | 0 | 12 | B2 / C1 / D1 / E8 | 出せるのは flammkuchen（fromage-blanc）と eggplant-tahini（tahini）だけ。「ホワイトソース」token は canonicalizer で ambiguous → 8 行が E（decision: ホワイトソース = fresh-cream-sauce か） |
| pesto | 4 | 8 | B5 / C2 / E1 | pesto-gamberi / pollo / vegetariana / salmone / trapanese は B（材料だけ）。pesto-burrata / noci は drizzle 付き（C） |
| olive oil | 4 | 25 | B5 / C6 / D1 / E13 | base としては B で可（vongole, feta-eliniki, baba-ganoush, eggplant-ricotta, bianca）。**上がけ（2 層目）は MULTI_SPREAD_LAYER**（grandma, sfincione, burrata, crudaiola, pescatore …） |
| post-bake topping | 0 | 8 | C2 / E6 | decision-ready は bbq-chicken（cilantro）と wasabi-beef（wasabi）の 2 行のみ。残り 6 は composition conflict / sauce 不明で E。**FINISH 単独では Wave 2 の主役にならない** |
| multi-spread | 0 | 17 | C9 / E8 | grandma と sfincione は新材料ゼロ。honey を入れると hot-honey-pepperoni / pesto-noci も開く |
| unusual shape | 0 | 5 | D1 / E4 | al-taglio（square, D）以外は E。形状は Wave 2 の対象外 |
| pan / boat / piadina | 0 | 16 | D7 / E9 | boat（pide）は E。piadina は `DOUGH_VARIANT`+sauceless（D）。pan 系は全部 D/E |
| CUT なし | 1 | 23 | B4 / C7 / D2 / E10 | dough evidence が無い行は New Haven の前例で CUT なし。**Owner decision: この前例を Wave 2 でも維持するか**（vongole, flammkuchen, grandma, sfincione, aussie, chilean, bbq, trenton に効く） |
| ingredient timing | 0 | 16 | C3 / D2 / E11 | post-bake 2 + STEP_ORDER（trenton）が C。mid-bake（mentaiko-cream）と prep（yakiniku）は D。残り E |

## 4. A–D 候補の一覧（decision-ready 76 行）

新材料・必要 mechanic（NEW_INGREDIENT_DATA 以外）・CUT・discovery ambiguity・体験軸。全列は JSON `rows[*]`。

| class | id | nameJa | new ingredients | mechanics | CUT | ambiguity | experience |
|---|---|---|---|---|---|---|---|
| A | brazilian-calabresa | ブラジリアン・カラブレーザ | — | — | STANDARD_6 | LOW | — |
| B | baba-ganoush-pizza | ババガヌーシュピザ | parsley, pine-nuts | — | STANDARD_6 | LOW | OLIVE_OIL_BASE |
| B | bianca | ピッツァビアンカ | ricotta | — | STANDARD_6 | LOW | OLIVE_OIL_BASE |
| B | calabresa-argentina | アルゼンチン風カラブレーサ | salami | NO_CUT_PROFILE | NONE | LOW | NO_CUT |
| B | cuban-pizza | キューバンピザ | mustard, pickles, pork, swiss-cheese | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW | NEW_SAUCE_COLOR |
| B | currywurst | カリーヴルストピザ | curry-ketchup, paprika-powder, wurstel | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE | NONE | LOW | NEW_SAUCE_COLOR, NO_CUT |
| B | eggplant-dengaku-pizza | ナス田楽ピザ | miso-sauce, white-sesame | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW | NEW_SAUCE_COLOR |
| B | eggplant-ricotta-pizza | ナスとリコッタのピザ | mint, ricotta | — | STANDARD_6 | LOW | OLIVE_OIL_BASE |
| B | eggplant-tahini-pizza | ナスとタヒニのピザ | parsley, pomegranate, tahini | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW | WHITE_BASE |
| B | flammkuchen | タルトフランベ | fromage-blanc-sauce | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE | NONE | LOW | NO_CUT, WHITE_BASE |
| B | jamon-serrano-pizza | ハモンセラーノピザ | arugula, prosciutto-crudo | — | STANDARD_6 | LOW | — |
| B | peking-duck-pizza | 北京ダックピザ | cucumber, green-onion, peking-duck, sweet-bean-sauce | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW | NEW_SAUCE_COLOR |
| B | pesto-gamberi | ペストガンベリピザ | shrimp | — | STANDARD_6 | LOW | PESTO_BASE |
| B | pesto-pollo | ペストポッロピザ | chicken | — | STANDARD_6 | LOW | PESTO_BASE |
| B | pesto-salmone | ペストサーモンピザ | cream-cheese, lemon, salmon | — | STANDARD_6 | LOW | PESTO_BASE |
| B | pesto-trapanese | ペストトラパネーゼピザ | almond | — | STANDARD_6 | LOW | PESTO_BASE |
| B | pesto-vegetariana | ペストベジタリアーナピザ | bell-pepper, zucchini | — | STANDARD_6 | LOW | PESTO_BASE |
| B | pizza-feta-eliniki | ピッツァフェッタエッリニキ | feta | — | STANDARD_6 | LOW | OLIVE_OIL_BASE |
| B | pizza-overload | ピザオーバーロード | hot-dog | — | STANDARD_6 | LOW | — |
| B | prosciutto-funghi | プロシュットフンギ | prosciutto-crudo | — | STANDARD_6 | MEDIUM | — |
| B | ratatouille-pizza | ラタトゥイユピザ | bell-pepper, zucchini | — | STANDARD_6 | LOW | — |
| B | rucola-e-grana | ルーコラエグラーナピザ | arugula, grana-padano, prosciutto-crudo | — | STANDARD_6 | LOW | — |
| B | sichuan-eggplant-pizza | 四川風ナスピザ | doubanjiang, green-onion | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW | NEW_SAUCE_COLOR |
| B | vegan-cashew-cheese-pizza | ヴィーガンカシューチーズピザ | bell-pepper, cashew-cheese, zucchini | — | STANDARD_6 | LOW | — |
| B | veggie-supreme-pizza | ベジースプリームピザ | green-pepper | — | STANDARD_6 | LOW | — |
| B | vongole | ヴォンゴレピザ | parsley | NO_CUT_PROFILE | NONE | LOW | NO_CUT, OLIVE_OIL_BASE |
| B | yuzu-shrimp-pizza | 柚子えびピザ | shiso, shrimp, yuzu-kosho | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW | NEW_SAUCE_COLOR |
| C | aussie | オージーピザ | — | NO_CUT_PROFILE, SAUCELESS_SCORING | NONE | LOW | NO_CUT, NO_SAUCE |
| C | bacalhau | バカリャウピザ | salt-cod | NO_CUT_PROFILE, SAUCELESS_SCORING | NONE | LOW | NO_CUT, NO_SAUCE |
| C | bbq-chicken | BBQチキンピザ | bbq-sauce, chicken, cilantro | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE, FINISH_POST_BAKE | NONE | LOW | NEW_SAUCE_COLOR, NO_CUT, POST_BAKE_TOPPING |
| C | brazilian-catupiry-corn-pizza | ブラジリアンカトゥピリコーンピザ | catupiry | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | burrata-pizza | ブラータピザ | burrata | MULTI_SPREAD_LAYER | STANDARD_6 | LOW | MULTI_SPREAD, OLIVE_OIL_BASE |
| C | california-style-pizza | カリフォルニアスタイルピザ | arugula, avocado, goat-cheese | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | chilean-napolitana | チリアンナポリターナ | — | NO_CUT_PROFILE, SAUCELESS_SCORING | NONE | LOW | NO_CUT, NO_SAUCE |
| C | frango-catupiry | フランゴ・コン・カトゥピリ | catupiry, chicken | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | full-english-pizza | フルイングリッシュピザ | baked-beans | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | grandma-pizza | グランマピザ | — | NO_CUT_PROFILE, MULTI_SPREAD_LAYER | NONE | LOW | MULTI_SPREAD, NO_CUT, OLIVE_OIL_BASE |
| C | hot-honey-pepperoni | ホットハニーペパロニピザ | honey | NEW_PAINT_SAUCE_PROFILE, MULTI_SPREAD_LAYER | STANDARD_6 | MEDIUM | MULTI_SPREAD, NEW_SAUCE_COLOR |
| C | ikura-salmon-pizza | いくらとサーモンのピザ | cream-cheese, salmon, salmon-roe, shiso | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | jalapeno-popper-pizza | ハラペーニョポッパーピザ | cream-cheese, jalapeno | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | new-zealand-lamb-pizza | ニュージーランドラムピザ | lamb, sweet-potato | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | palmito-pizza | パルミットピザ | palm-heart | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | pescatore | ペスカトーレ | mussel, parsley, shrimp | MULTI_SPREAD_LAYER | STANDARD_6 | LOW | MULTI_SPREAD, OLIVE_OIL_BASE |
| C | pesto-burrata | ペストブラータピザ | burrata | MULTI_SPREAD_LAYER | STANDARD_6 | LOW | MULTI_SPREAD, OLIVE_OIL_BASE, PESTO_BASE |
| C | pesto-noci | ペストノーチピザ | honey, walnut | NEW_PAINT_SAUCE_PROFILE, MULTI_SPREAD_LAYER | STANDARD_6 | LOW | MULTI_SPREAD, NEW_SAUCE_COLOR, PESTO_BASE |
| C | pizza-alla-crudaiola | ピッツァ・アッラ・クルダイオーラ | arugula, burrata | MULTI_SPREAD_LAYER | STANDARD_6 | LOW | MULTI_SPREAD, OLIVE_OIL_BASE |
| C | pizza-moscow | ピッツァモスクワ | salmon, sardine | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | pizza-salad | ピザサラダ | cucumber, lettuce, yogurt-sauce | NEW_PAINT_SAUCE_PROFILE, MULTI_SPREAD_LAYER | STANDARD_6 | LOW | MULTI_SPREAD, WHITE_BASE |
| C | polish-kielbasa | ポーリッシュキエルバサピザ | sauerkraut | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | porchetta-pizza | ポルケッタピザ | pork | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | salsiccia-e-friarielli | サルシッチャエフリアリエッリ | friarielli | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | sfincione | スフィンチョーネ | — | NO_CUT_PROFILE, MULTI_SPREAD_LAYER | NONE | LOW | MULTI_SPREAD, NO_CUT, OLIVE_OIL_BASE |
| C | shirasu-pizza | しらすピザ | lemon, shiso, whitebait | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | spanish-chorizo-pizza | スパニッシュチョリソピザ | bell-pepper | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | spinach-artichoke-pizza | スピナッチアーティチョークピザ | artichoke, cream-cheese, spinach | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | trenton-tomato-pie | トレントントマトパイ | — | NO_CUT_PROFILE, STEP_ORDER | NONE | MEDIUM | CHEESE_ONLY_TOP, NO_CUT |
| C | tsukimi-pizza | 月見ピザ | green-onion | SAUCELESS_SCORING | STANDARD_6 | LOW | NO_SAUCE |
| C | wasabi-beef-pizza | わさび牛ピザ | beef, soy-sauce, wasabi | NEW_PAINT_SAUCE_PROFILE, FINISH_POST_BAKE | STANDARD_6 | LOW | NEW_SAUCE_COLOR, POST_BAKE_TOPPING |
| D | argentine-napolitana | アルゼンチン風ナポリターナ | — | DOUGH_VARIANT, SAUCELESS_SCORING | STANDARD_6 | LOW | DOUGH_TYPE, NO_SAUCE |
| D | cauliflower-crust-pizza | カリフラワークラストピザ | — | DOUGH_VARIANT | STANDARD_6 | HIGH | DOUGH_TYPE |
| D | chicago-stuffed-pizza | シカゴスタッフドピザ | — | DOUGH_VARIANT, ENCLOSE | UNSPECIFIED | HIGH | DOUGH_TYPE, ENCLOSED |
| D | fathead-pizza-keto | ファットヘッドピザ（ケト風） | — | DOUGH_VARIANT | STANDARD_6 | HIGH | DOUGH_TYPE |
| D | fugazzeta-rellena | フガゼッタ・レジェーナ | — | DOUGH_VARIANT, SAUCELESS_SCORING, ENCLOSE | UNSPECIFIED | LOW | DOUGH_TYPE, ENCLOSED, NO_SAUCE |
| D | manakish | マナキーシュ | halloumi, zaatar | DOUGH_VARIANT | STANDARD_6 | LOW | DOUGH_TYPE, OLIVE_OIL_BASE |
| D | mentaiko-cream-pizza | たらこクリームピザ | cod-roe, fresh-cream-sauce, nori, shiso | NEW_PAINT_SAUCE_PROFILE, LATE_ADDITION_MID_BAKE | STANDARD_6 | LOW | TIMING, WHITE_BASE |
| D | montreal-style-pizza | モントリオールスタイルピザ | — | DOUGH_VARIANT, PAN_BAKE | STANDARD_6 | MEDIUM | DOUGH_TYPE, PAN |
| D | new-england-bar-pizza | ニューイングランドバーピザ | — | DOUGH_VARIANT, PAN_BAKE | STANDARD_6 | HIGH | DOUGH_TYPE, PAN |
| D | ny-style | ニューヨークスタイルピザ（PIZZA DB版） | — | NO_CUT_PROFILE, DOUGH_VARIANT | NONE | MEDIUM | CHEESE_ONLY_TOP, DOUGH_TYPE, NO_CUT |
| D | piadina-romagnola | ピアディーナ・ロマニョーラ | arugula, cream-cheese, prosciutto-crudo | DOUGH_VARIANT, SAUCELESS_SCORING | STANDARD_6 | LOW | DOUGH_TYPE, NO_SAUCE |
| D | pinsa-romana | ピンサロマーナ | arugula, prosciutto-crudo | DOUGH_VARIANT | STANDARD_6 | LOW | DOUGH_TYPE |
| D | pizza-al-taglio-romana | ピッツァアルタリオローマーナ | — | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | SHAPE_AWARE_REQUIRED | HIGH | DOUGH_TYPE, PAN, UNUSUAL_SHAPE |
| D | pizza-fritta | ピッツァフリッタ | pork, ricotta | FRY_COOK | UNSPECIFIED | LOW | — |
| D | poutine-pizza | プーティンピザ | cheese-curd, french-fries, gravy-sauce | NEW_PAINT_SAUCE_PROFILE, DOUGH_VARIANT | STANDARD_6 | LOW | DOUGH_TYPE, NEW_SAUCE_COLOR |
| D | quattro-stagioni | クアトロスタジオーニ（PIZZA DB版） | artichoke | NO_CUT_PROFILE, ZONED_PLACEMENT | NONE | LOW | NO_CUT |
| D | scacciata-ragusana | スカッチャラグザーナ | caciocavallo | ENCLOSE | UNSPECIFIED | LOW | ENCLOSED |
| D | yakiniku-pizza | 焼肉ピザ | beef, white-sesame, yakiniku-sauce | NEW_PAINT_SAUCE_PROFILE, PREP_STEP | STANDARD_6 | LOW | NEW_SAUCE_COLOR |

## 5. Wave 2 候補（Owner 比較用。どれも採用していない）

5 案とも 8–9 recipe（W1 と同規模）、候補はすべて decision-ready（A–D）で、25 runtime とも案内部でも
ingredient set の完全一致はない（validator が保証）。

### W2-A_LEAN_DATA_ONLY — Lean data-only (A+B, zero new mechanic)

Ship immediately on the W1 pipeline: 9 recipes, 8 new ingredients, first white (fromage-blanc) base, first seafood-in-oil and pesto-protein variants, two no-CUT pizzas. Adds count and flavour, few new ways to play.

| id | nameJa | class | ingredients | mechanics | CUT | ambiguity |
|---|---|---|---|---|---|---|
| brazilian-calabresa | ブラジリアン・カラブレーザ | A | black-olive, onion, oregano, sausage, tomato-sauce | — | STANDARD_6 | LOW |
| vongole | ヴォンゴレピザ | B | clam, garlic, olive-oil, parsley | NO_CUT_PROFILE | NONE | LOW |
| flammkuchen | タルトフランベ | B | bacon, fromage-blanc-sauce, onion | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE | NONE | LOW |
| pesto-gamberi | ペストガンベリピザ | B | fresh-tomato, garlic, pesto, shrimp | — | STANDARD_6 | LOW |
| pesto-pollo | ペストポッロピザ | B | chicken, fresh-tomato, mozzarella, pesto | — | STANDARD_6 | LOW |
| ratatouille-pizza | ラタトゥイユピザ | B | bell-pepper, eggplant, oregano, tomato-sauce, zucchini | — | STANDARD_6 | LOW |
| pesto-vegetariana | ペストベジタリアーナピザ | B | bell-pepper, eggplant, mozzarella, pesto, zucchini | — | STANDARD_6 | LOW |
| prosciutto-funghi | プロシュットフンギ | B | mozzarella, mushroom, prosciutto-crudo, tomato-sauce | — | STANDARD_6 | MEDIUM |
| jamon-serrano-pizza | ハモンセラーノピザ | B | arugula, mozzarella, prosciutto-crudo, tomato-sauce | — | STANDARD_6 | LOW |

- 新材料 (8): arugula, bell-pepper, chicken, fromage-blanc-sauce, parsley, prosciutto-crudo, shrimp, zucchini
- append-only ladder: +7 steps（25–31）: prosciutto-crudo→prosciutto-funghi / fromage-blanc-sauce→flammkuchen / arugula→jamon-serrano-pizza / shrimp→pesto-gamberi / chicken→pesto-pollo / parsley→vongole / bell-pepper+zucchini→pesto-vegetariana
- 自前 step なし（W1 材料だけで作れる）: brazilian-calabresa
- 新しい体験軸: WHITE_BASE
- cost points: 36（mechanic 0 / content 36）

### W2-B_SAUCE_PALETTE — Sauce palette (B only, new PAINT sauces)

Keep the gesture, change what you paint: 6 new sauce colours (fromage-blanc white, miso, doubanjiang, curry-ketchup, tahini, yuzu-kosho) through the existing PAINT pipeline. Visible variety at the SAUCE step, but each sauce is a new ingredient + colour + Shop row.

| id | nameJa | class | ingredients | mechanics | CUT | ambiguity |
|---|---|---|---|---|---|---|
| flammkuchen | タルトフランベ | B | bacon, fromage-blanc-sauce, onion | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE | NONE | LOW |
| eggplant-dengaku-pizza | ナス田楽ピザ | B | eggplant, miso-sauce, mozzarella, white-sesame | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW |
| sichuan-eggplant-pizza | 四川風ナスピザ | B | doubanjiang, eggplant, garlic, green-onion, mozzarella | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW |
| currywurst | カリーヴルストピザ | B | curry-ketchup, mozzarella, paprika-powder, wurstel | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE | NONE | LOW |
| eggplant-tahini-pizza | ナスとタヒニのピザ | B | eggplant, parsley, pomegranate, tahini | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW |
| yuzu-shrimp-pizza | 柚子えびピザ | B | mozzarella, shiso, shrimp, yuzu-kosho | NEW_PAINT_SAUCE_PROFILE | STANDARD_6 | LOW |
| brazilian-calabresa | ブラジリアン・カラブレーザ | A | black-olive, onion, oregano, sausage, tomato-sauce | — | STANDARD_6 | LOW |
| pesto-gamberi | ペストガンベリピザ | B | fresh-tomato, garlic, pesto, shrimp | — | STANDARD_6 | LOW |

- 新材料 (14): curry-ketchup, doubanjiang, fromage-blanc-sauce, green-onion, miso-sauce, paprika-powder, parsley, pomegranate, shiso, shrimp, tahini, white-sesame, wurstel, yuzu-kosho
- append-only ladder: +7 steps（25–31）: shrimp→pesto-gamberi / fromage-blanc-sauce→flammkuchen / miso-sauce+white-sesame→eggplant-dengaku-pizza / doubanjiang+green-onion→sichuan-eggplant-pizza / shiso+yuzu-kosho→yuzu-shrimp-pizza / curry-ketchup+paprika-powder+wurstel→currywurst / parsley+pomegranate+tahini→eggplant-tahini-pizza
- 自前 step なし（W1 材料だけで作れる）: brazilian-calabresa
- 新しい体験軸: NEW_SAUCE_COLOR, WHITE_BASE
- cost points: 46（mechanic 0 / content 46）

### W2-C_NO_SAUCE_INTRO — No-sauce introduction (SAUCELESS_SCORING)

First pizzas with no SAUCE step: dough -> cheese -> toppings. Two need zero new ingredients (Aussie, Chilean Napolitana). Requires the sauce-less Scoring 2.0 / Reference / sauce-profile contract before any recipe ships.

| id | nameJa | class | ingredients | mechanics | CUT | ambiguity |
|---|---|---|---|---|---|---|
| aussie | オージーピザ | C | bacon, egg, mozzarella, onion | NO_CUT_PROFILE, SAUCELESS_SCORING | NONE | LOW |
| chilean-napolitana | チリアンナポリターナ | C | fresh-tomato, mozzarella, oregano | NO_CUT_PROFILE, SAUCELESS_SCORING | NONE | LOW |
| tsukimi-pizza | 月見ピザ | C | bacon, egg, green-onion, mozzarella | SAUCELESS_SCORING | STANDARD_6 | LOW |
| spanish-chorizo-pizza | スパニッシュチョリソピザ | C | bell-pepper, mozzarella, onion, sausage | SAUCELESS_SCORING | STANDARD_6 | LOW |
| porchetta-pizza | ポルケッタピザ | C | mozzarella, pork, rosemary | SAUCELESS_SCORING | STANDARD_6 | LOW |
| frango-catupiry | フランゴ・コン・カトゥピリ | C | catupiry, chicken, mozzarella, oregano | SAUCELESS_SCORING | STANDARD_6 | LOW |
| brazilian-calabresa | ブラジリアン・カラブレーザ | A | black-olive, onion, oregano, sausage, tomato-sauce | — | STANDARD_6 | LOW |
| vongole | ヴォンゴレピザ | B | clam, garlic, olive-oil, parsley | NO_CUT_PROFILE | NONE | LOW |

- 新材料 (6): bell-pepper, catupiry, chicken, green-onion, parsley, pork
- append-only ladder: +5 steps（25–29）: pork→porchetta-pizza / bell-pepper→spanish-chorizo-pizza / green-onion→tsukimi-pizza / parsley→vongole / catupiry+chicken→frango-catupiry
- 自前 step なし（W1 材料だけで作れる）: aussie, brazilian-calabresa, chilean-napolitana
- 新しい体験軸: NO_SAUCE
- cost points: 36（mechanic 8 / content 28）

### W2-D_DRIZZLE_MULTI_SPREAD — Drizzle / multi-spread introduction (MULTI_SPREAD_LAYER)

Two spreads in order: paint the base, then drizzle oil or honey on top. Grandma and Sfincione need zero new ingredients; burrata and honey add a strong visual finish. Resolves the olive-oil -> DRIZZLE TODO in recipeSauceProfiles.ts.

| id | nameJa | class | ingredients | mechanics | CUT | ambiguity |
|---|---|---|---|---|---|---|
| grandma-pizza | グランマピザ | C | garlic, mozzarella, olive-oil, tomato-sauce | NO_CUT_PROFILE, MULTI_SPREAD_LAYER | NONE | LOW |
| sfincione | スフィンチョーネ | C | anchovy, olive-oil, onion, oregano, tomato-sauce | NO_CUT_PROFILE, MULTI_SPREAD_LAYER | NONE | LOW |
| burrata-pizza | ブラータピザ | C | basil, burrata, olive-oil, tomato-sauce | MULTI_SPREAD_LAYER | STANDARD_6 | LOW |
| pesto-burrata | ペストブラータピザ | C | burrata, fresh-tomato, olive-oil, pesto | MULTI_SPREAD_LAYER | STANDARD_6 | LOW |
| hot-honey-pepperoni | ホットハニーペパロニピザ | C | honey, mozzarella, pepperoni, tomato-sauce | NEW_PAINT_SAUCE_PROFILE, MULTI_SPREAD_LAYER | STANDARD_6 | MEDIUM |
| pesto-noci | ペストノーチピザ | C | gorgonzola, honey, pesto, walnut | NEW_PAINT_SAUCE_PROFILE, MULTI_SPREAD_LAYER | STANDARD_6 | LOW |
| brazilian-calabresa | ブラジリアン・カラブレーザ | A | black-olive, onion, oregano, sausage, tomato-sauce | — | STANDARD_6 | LOW |
| vongole | ヴォンゴレピザ | B | clam, garlic, olive-oil, parsley | NO_CUT_PROFILE | NONE | LOW |

- 新材料 (4): burrata, honey, parsley, walnut
- append-only ladder: +4 steps（25–28）: burrata→burrata-pizza / honey→hot-honey-pepperoni / walnut→pesto-noci / parsley→vongole
- 自前 step なし（W1 材料だけで作れる）: brazilian-calabresa, grandma-pizza, sfincione
- 新しい体験軸: MULTI_SPREAD, NEW_SAUCE_COLOR
- cost points: 39（mechanic 13 / content 26）

### W2-E_EXPERIENCE_SAMPLER — Experience sampler (one pizza per new way to play)

Maximum variety per recipe: white base, no sauce, drizzle, post-bake topping, cheese-first order. Needs three to four mechanics at once (SAUCELESS_SCORING, MULTI_SPREAD_LAYER, FINISH, STEP_ORDER) -- highest cost and Human-Verification load.

| id | nameJa | class | ingredients | mechanics | CUT | ambiguity |
|---|---|---|---|---|---|---|
| brazilian-calabresa | ブラジリアン・カラブレーザ | A | black-olive, onion, oregano, sausage, tomato-sauce | — | STANDARD_6 | LOW |
| flammkuchen | タルトフランベ | B | bacon, fromage-blanc-sauce, onion | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE | NONE | LOW |
| aussie | オージーピザ | C | bacon, egg, mozzarella, onion | NO_CUT_PROFILE, SAUCELESS_SCORING | NONE | LOW |
| chilean-napolitana | チリアンナポリターナ | C | fresh-tomato, mozzarella, oregano | NO_CUT_PROFILE, SAUCELESS_SCORING | NONE | LOW |
| grandma-pizza | グランマピザ | C | garlic, mozzarella, olive-oil, tomato-sauce | NO_CUT_PROFILE, MULTI_SPREAD_LAYER | NONE | LOW |
| hot-honey-pepperoni | ホットハニーペパロニピザ | C | honey, mozzarella, pepperoni, tomato-sauce | NEW_PAINT_SAUCE_PROFILE, MULTI_SPREAD_LAYER | STANDARD_6 | MEDIUM |
| bbq-chicken | BBQチキンピザ | C | bbq-sauce, chicken, cilantro, mozzarella, onion | NO_CUT_PROFILE, NEW_PAINT_SAUCE_PROFILE, FINISH_POST_BAKE | NONE | LOW |
| trenton-tomato-pie | トレントントマトパイ | C | mozzarella, tomato-sauce | NO_CUT_PROFILE, STEP_ORDER | NONE | MEDIUM |

- 新材料 (5): bbq-sauce, chicken, cilantro, fromage-blanc-sauce, honey
- append-only ladder: +3 steps（25–27）: fromage-blanc-sauce→flammkuchen / honey→hot-honey-pepperoni / bbq-sauce+chicken+cilantro→bbq-chicken
- 自前 step なし（W1 材料だけで作れる）: aussie, brazilian-calabresa, chilean-napolitana, grandma-pizza, trenton-tomato-pie
- 新しい体験軸: CHEESE_ONLY_TOP, MULTI_SPREAD, NEW_SAUCE_COLOR, NO_SAUCE, POST_BAKE_TOPPING, WHITE_BASE
- cost points: 67（mechanic 39 / content 28）

### 5.1 比較表

| 観点 | W2-A Lean data | W2-B Sauce palette | W2-C No-sauce | W2-D Drizzle | W2-E Sampler |
|---|---|---|---|---|---|
| recipes（→ 合計） | 9（→34） | 8（→33） | 8（→33） | 8（→33） | 8（→33） |
| 必要 mechanic（C/D） | なし | なし | SAUCELESS_SCORING | MULTI_SPREAD_LAYER | SAUCELESS + MULTI_SPREAD + FINISH + STEP_ORDER |
| 新材料 | 8 | **14** | 6 | **4** | 5 |
| 新 sauce profile | fromage-blanc | 6 種 | — | honey | fromage-blanc, bbq, honey |
| 新しい体験軸 | 白ベース | 白ベース + 新色ソース | **SAUCE 工程なし** | **2 層目を上がけ** | 白・ソースなし・上がけ・焼成後トッピング・チーズ先 |
| append-only ladder | +7 | +7 | +5 | +4 | +3 |
| ambiguity MEDIUM | 1（prosciutto-funghi ↔ funghi） | 0 | 0 | 1（hot-honey ↔ pepperoni） | 2（hot-honey ↔ pepperoni、trenton ↔ runtime 5 recipe） |
| cost points（相対） | 36 | 46 | 36 | 39 | **67** |
| 実装開始の前提 | Owner decision のみ | Owner decision のみ | **mechanic slice が先** | **mechanic slice が先** | **mechanic 3–4 本が先** |
| Human Verification 負荷 | 低（W1 と同型） | 中（色 6 種） | 中（新 flow） | 中（新 gesture） | 高 |

「ゲーム体験の種類が増えるか」で見ると、A/B は **量と味の幅**（プレイは同じ）、C/D は **1 種類ずつ新しい遊び方**、
E は最大だが 1 wave で mechanic を 4 本入れるのは Cooking Steps 1.0 §21 の「1 slice = 1 mechanic」方針と
W1 の Human Verification 運用から見て重い。

### 5.2 設計上の推奨（決定ではない）

- **案 1（推奨）: 2 段構え — W2a = W2-A（data only）を先に、W2b = W2-C か W2-D のどちらか 1 つを mechanic slice の後に。**
  W2a は今日から着手可能で、W2b の mechanic 実装と並行できる。
- W2b の候補比較: **W2-C（no-sauce）** は開く行が最多（C 19 行、将来の piadina/argentine も必要）で、
  flow は既に SAUCE 省略に対応済み — 残るのは scoring/reference/profile の契約。
  **W2-D（drizzle）** は見た目の変化が最も大きく、olive-oil TODO を解消し、新材料が最少（4）。
- FINISH（焼成後トッピング）は decision-ready が 2 行しかないので、Wave 2 の主軸にしない方がよい
  （buffalo-chicken / black-truffle / teriyaki の composition decision が出れば価値が上がる）。
- shape / pan / boat / piadina は全部 D/E。Wave 3 以降。

## 6. 影響分析

### 6.1 progression impact — **重要な発見: ladder の再生成は W1 の順番を並べ替える**

OD-REC04-1 のとおり「population ごとに REC-04 rule で再生成」すると、**5 案すべてで既存の 24 steps の順番が変わる**
（例: W2-A では eggplant が step 1 に上がる。JSON `waveOptions[*].evaluation.existingLadderReordered = true`、`ladder`）。
entitlement は relock しないが、途中まで進んだ save では「step N で何が解放されるか」が変わり、
Shop NEW 行・章（`recipeChapters.ts` は key step の price tier で決まる）・Dinner mission の `populationId` にも波及する。

代替として **append-only ladder**（W1 の 1–24 を固定し、W2 の材料だけを同じ rule で 25 以降に並べる）を全案で計算した
（`appendOnlyLadder`）。こちらは既存 save の意味を変えない。**Owner decision OD-W2-1** として選んでほしい。

- append-only では、W1 材料だけで作れる recipe（brazilian-calabresa, aussie, chilean-napolitana, grandma, sfincione, trenton）は
  自前の step を持たず、W1 を終えた player には **wave 公開時点ですぐ発見可能** になる（小さな burst）。
  1 発見 = 1 step なので、これらの発見は W2 の材料 step を前倒しする。
- 章: 追加 step の price tier が未定（MATERIAL_PRICE_TIERS は 24 step 前提）。W2 step の tier と章割り（第4章を足すか）は OD-W2-2。

### 6.2 discovery ambiguity

- exact collision: 5 案とも 0。
- one-ingredient-from-runtime（MEDIUM）: prosciutto-funghi（funghi + prosciutto-crudo）、hot-honey-pepperoni（pepperoni + honey）、
  trenton-tomato-pie（mozzarella + tomato-sauce だけなので margherita / funghi / pepperoni / salsiccia / bismarck の 5 つから 1 材料差。判定は STEP_ORDER の観測に依存）。near-miss / DH4 deduction hint の候補集合が近くなる。
- no-sauce 導入後は、**sauce を塗り忘れた FREE の一枚が初めて discovery になり得る**（例: Aussie = bacon/egg/mozzarella/onion）。
  今までは「sauce なし = 必ず不一致」だったので、near-miss 文言と hint の前提が変わる（W2-C / W2-E）。
- 将来の衝突予約: jamon-serrano を出すと pinsa-romana は `DOUGH_VARIANT` なしでは追加不可（Phase-1 P0-COLL-4）。
  trenton を出すと ny-style は `DOUGH_VARIANT` 必須（P0-COLL-1）。

### 6.3 taxonomy impact（DH4 `ingredientTaxonomy.ts`）

topping の新材料はすべて family 行が必要（無いと category レベルに落ちるだけで壊れはしない）。提案 family は JSON
`rows[*].taxonomyImpact`（`familyProposed: true` は提案、Owner 確認が必要）。

| 案 | 新 topping 行 | family サイズ（追加後） |
|---|---|---|
| W2-A | arugula, bell-pepper, chicken, parsley, prosciutto-crudo, shrimp, zucchini | meat 6, seafood 4, vegetable 11, herb 5, fruit 1, spice 1, other 1 |
| W2-B | green-onion, paprika-powder, parsley, pomegranate, shiso, shrimp, white-sesame, wurstel | fruit 2, spice 3 … |
| W2-C | bell-pepper, chicken, green-onion, parsley, pork | meat 6, vegetable 10 … |
| W2-D | parsley, walnut | other 2 … |
| W2-E | chicken, cilantro | … |

fruit / spice / other は小さいまま（k≥2 guard が守る）。cheese（burrata, catupiry）と sauce（fromage-blanc 等）は
DH4-1 の方針どおり category がそのまま attribute なので行は不要。sauce 側は `RecipeSauceProfile.ingredientId` の union 拡張が必要。

### 6.4 test impact（共通 + 案別）

共通（どの案でも）:
- `recipes.test.ts`, `discoveryCatalog.test.ts`（`RECIPE_DISCOVERY_TARGET_IDS` は Record なので型エラーで漏れを検出）,
  `discoveryLadder.test.ts`（新 population の pin。OD-W2-1 次第で 24 steps の pin も変わる）,
  `recipeSauceProfiles.test.ts`, `cookingProfiles.test.ts`（CUT allowlist）, reference fixture（`referencePizza.w1.test.ts` 型）,
  `deductionHint.audit.test.ts`（population 変化）, economy / material shop simulation。
- e2e: Dex pill の `/25` 固定が 7 spec（discovery-dex-hint, discovery-hint-facts-save, layout-contract, discovery-hint-sheet,
  discovery-near-miss-result, lunch-rush-material-shortage, save-forward-compat-3-4b）、LC-5 の `toHaveCount(25)`。
- 新材料ごとに ingredient art（Human Visual）と Layout Contract（tray paging）。

案別の mechanic suite: W2-C = sauceless の scoring / completion gate / reference / RESULT 表示、W2-D = 2 層 deposit・drizzle gesture・
Scoring の layer 評価、W2-E = それに FINISH（POST_BAKE reducer）と STEP_ORDER。

### 6.5 implementation cost（相対 points、JSON `mechanicCostPoints`）

content = recipe 2 + 新材料 2（visual 込み）+ 新 sauce profile 2。mechanic = SAUCELESS 8、STEP_ORDER 5、MULTI_SPREAD 13、FINISH 13、
DOUGH_VARIANT 8、PAN 13、SHAPE/ENCLOSE/LAMINATE/FRY 21。スケジュールではなく比較用の相対値。

## 7. Owner Decisions（Wave 2 開始前に必要）

| ID | 質問 | 選択肢 | 設計の推奨 |
|---|---|---|---|
| OD-W2-1 | ladder を再生成するか append-only にするか | (a) REC-04 rule で全体再生成（W1 順が変わる）/ (b) W1 の 1–24 固定 + 25 以降を append | (b) |
| OD-W2-2 | 追加 step の price tier と章 | 新 tier T4 + 第4章 / 既存 T3 に含める | T4 + 第4章（Dex の区切りが明確） |
| OD-W2-3 | Wave の選択 | W2-A / B / C / D / E / 2 段構え | 2 段構え（W2a = A、W2b = C か D） |
| OD-W2-4 | dough evidence なし → CUT なし（New Haven 前例）を維持するか | 維持 / 丸生地なら CUT | 維持（evidence 規律） |
| OD-W2-5 | 新材料の family 提案（`familyProposed`） | 承認 / 修正 | — |
| OD-W2-6 | 各 recipe の nameJa / description / minCount / bakeTarget | W1 と同じく authoring slice で決める | — |
| OD-W2-7 | naming review（brazilian-calabresa = Calabresa cluster、prosciutto-funghi = catalog prosciutto-e-funghi と同 set、hot-honey の candidate LATE_ADDITION） | 採用 / 差し替え | — |
| OD-W2-8（W2-C 採用時） | sauceless の scoring 方針 | Sauce weight を他 component に再配分 / sauce component を「塗らなかった」ことで満点 | 再配分（Scoring 2.0 authority の変更として別 slice で審査） |
| OD-W2-9（W2-D 採用時） | 2 層目の gesture | 既存 PAINT のまま 2 回 / 新 DRIZZLE（線） | 既存 PAINT で 2 層 → DRIZZLE は後続 |

E を開く高レバレッジ decision（Wave 3 向け）: 「ホワイトソース」token の解決（8 行）、base sauce family の命名（33 行）、
唐辛子・ひき肉（9 行）。

## 8. 結論 — Wave 2 は実装開始できるか

- **W2-A（lean data-only）は mechanic なしで実装開始できる。** 前提は Owner Decision OD-W2-1〜7 だけ。
  W1 の I5b と同じ pipeline（recipe data → ingredient visual → sauce profile → reference fixture → ladder → CUT allowlist → HV）で進められる。
  ただし **OD-W2-1（ladder 再生成 vs append-only）は実装前に必須**: 決めずに現行 rule を回すと W1 の順番が変わる。
- **ゲーム体験の種類を増やす案（W2-C / W2-D / W2-E）は、先に mechanic が必要:**
  - W2-C → `SAUCELESS_SCORING`（Scoring 2.0 / Reference / Completion Gate / sauce profile の契約変更）
  - W2-D → `MULTI_SPREAD_LAYER`（SAUCE step の 2 層化）
  - W2-E → 上記 2 つ + `FINISH_POST_BAKE` + `STEP_ORDER`
- shape / pan / boat / piadina / timing（mid-bake, prep）は D か E で、Wave 2 の範囲外。

production recipe set は確定していない。Owner の選択を待って STOP。

## 9. 再現

```
$ python3 tools/progression2_wave2_candidates.py --check
Wave 2 candidates: all validations passed; JSON byte-identical.
byClass {'A': 1, 'B': 26, 'C': 31, 'D': 18, 'E': 85, 'RUNTIME': 11}
```

validator: 172 行、runtime 25 / 29 材料 / sauce union / discovery Record を src から parse して一致確認、RUNTIME = 11、
decision-ready（A–D）はすべて Phase-2 target、各 option の recipe は A–D のみ、option population 内の完全一致 collision 0、
再生成との byte 比較。

注: 既存の `tools/progression2_mechanic_matrix.py --check` は、この branch でも clean な main でも
「committed JSON differs from a fresh deterministic regeneration」で失敗する（src の recipe が 15 → 25 に増えたため、
tool が src を読み直すと shipped 集合が変わる）。本作業ではその JSON を変更していない（既存事象として記録のみ）。
