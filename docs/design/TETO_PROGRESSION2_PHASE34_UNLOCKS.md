# Progression 2.0 Phase 3-4 — Final ingredient unlock / price design

Audited `origin/main`: `08b04f8f1c59b8adb38964d4ec3e08e6acb6cbc2`. Generated from the Phase-2 matrix; JSON is authoritative.

## Verdict

**READY WITH TWO OWNER CONFIRMATIONS.** The matrix is implementation-readable without prose reinterpretation once OD-01/OD-02 are confirmed.

Stars are monotonic progression and are never spent. Pitz is spendable. Permanent OWNED and consumable stock are separate.

## Counts and balance

- Ingredients: 105 (3 initial OWNED, 102 purchasable)
- All scheduled nodes including dough/pan/capability: 128
- Early reachable recipes after the first 10 purchases: 12
- Maximum availability burst: 3 nodes; full Phase-2 worst-case grind streak: 24 bakes
- One-recipe ingredients: 59
- Evidence/mechanic blockers outside the 101 pool: 53 / 8

Discovery is only granted after a simulated PASS free-cook bake (base reward + first-discovery bonus, ingredient stock consumption and refills included); reachability alone never marks a recipe discovered.

| Profile | Result | Reach | Total bakes | Discovery bakes | Grind bakes | Stock refills | Max opportunity gap (bakes) | Max burst (recipes) | Max purchase wait (bakes) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| low-score | COMPLETE | 101/101 | 483 | 101 | 382 | 6 | 25 | 3 | 9 |
| beginner | COMPLETE | 101/101 | 194 | 101 | 93 | 6 | 10 | 3 | 4 |
| standard | COMPLETE | 101/101 | 122 | 101 | 21 | 6 | 7 | 3 | 3 |
| skilled | COMPLETE | 101/101 | 101 | 101 | 0 | 6 | 1 | 3 | 0 |
| pitz-constrained | COMPLETE | 101/101 | 483 | 101 | 382 | 6 | 25 | 3 | 9 |

## First 10 purchasable unlocks

| # | Action / condition | Available item | Price | Newly reachable pizzas |
|---:|---|---|---:|---|
| 1 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":2,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Egg (`egg`) | 60 | shipped:bismarck |
| 2 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":2,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Bacon (`bacon`) | 60 | shipped:breakfast-pizza |
| 3 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":2,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Onion (`onion`) | 60 | aussie-pizzadb |
| 4 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":6,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Pepperoni (`pepperoni`) | 60 | shipped:pepperoni |
| 5 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":6,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Italian Sausage (Salsiccia) (`sausage`) | 60 | shipped:salsiccia |
| 6 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":6,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Cooked Ham (Prosciutto Cotto) (`ham`) | 60 | shipped:meat-lovers |
| 7 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":10,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Black Olive (`black-olive`) | 60 | pizza-portuguesa-pizzadb-p9 |
| 8 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":10,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Mushroom (`mushroom`) | 60 | shipped:funghi |
| 9 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":10,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Oregano (`oregano`) | 60 | brazilian-calabresa-pizzadb-p10, shipped:capricciosa |
| 10 | `{"type":"ALL","all":[{"type":"CUMULATIVE_STARS","minimum":14,"starModel":"HYBRID_MINIMUM_2_PER_DISCOVERY"}]}` | Fresh Tomato (`fresh-tomato`) | 60 | chilean-napolitana-pizzadb |

## Full unlock table

| Id | Name | Kind | Tier | Condition type | Price | Prerequisite | Reuse | New | Rationale | Blocked/deferred |
|---|---|---|---|---|---:|---|---:|---:|---|---|
| `basil` | Basil | ingredient | early | INITIAL_OWNED | 0 |  | 7 | 0 | Initial unlimited income/discovery guarantee. |  |
| `mozzarella` | Mozzarella | ingredient | early | INITIAL_OWNED | 0 |  | 72 | 0 | Initial unlimited income/discovery guarantee. |  |
| `tomato-sauce` | Tomato Sauce | ingredient | early | INITIAL_OWNED | 0 |  | 45 | 1 | Initial unlimited income/discovery guarantee. |  |
| `egg` | Egg | ingredient | early | CUMULATIVE_STARS | 60 |  | 6 | 1 | Phase-2 step 1; 6 target reuse, placed in early tier. |  |
| `bacon` | Bacon | ingredient | early | CUMULATIVE_STARS | 60 |  | 9 | 1 | Phase-2 step 1; 9 target reuse, placed in early tier. |  |
| `onion` | Onion | ingredient | early | CUMULATIVE_STARS | 60 |  | 17 | 1 | Phase-2 step 1; 17 target reuse, placed in early tier. |  |
| `pepperoni` | Pepperoni | ingredient | early | CUMULATIVE_STARS | 60 |  | 6 | 1 | Phase-2 step 2; 6 target reuse, placed in early tier. |  |
| `sausage` | Italian Sausage (Salsiccia) | ingredient | early | CUMULATIVE_STARS | 60 |  | 9 | 1 | Phase-2 step 2; 9 target reuse, placed in early tier. |  |
| `ham` | Cooked Ham (Prosciutto Cotto) | ingredient | early | CUMULATIVE_STARS | 60 |  | 9 | 1 | Phase-2 step 2; 9 target reuse, placed in early tier. |  |
| `black-olive` | Black Olive | ingredient | early | CUMULATIVE_STARS | 60 |  | 11 | 1 | Phase-2 step 3; 11 target reuse, placed in early tier. |  |
| `mushroom` | Mushroom | ingredient | early | CUMULATIVE_STARS | 60 |  | 6 | 1 | Phase-2 step 3; 6 target reuse, placed in early tier. |  |
| `oregano` | Oregano | ingredient | early | CUMULATIVE_STARS | 60 |  | 13 | 2 | Phase-2 step 3; 13 target reuse, placed in early tier. |  |
| `fresh-tomato` | Fresh Tomato | ingredient | early | CUMULATIVE_STARS | 60 |  | 11 | 1 | Phase-2 step 4; 11 target reuse, placed in early tier. |  |
| `olive-oil` | Olive Oil | ingredient | early | CUMULATIVE_STARS | 60 |  | 16 | 1 | Phase-2 step 4; 16 target reuse, placed in early tier. |  |
| `feta` | Feta | ingredient | early | CUMULATIVE_STARS | 60 |  | 1 | 1 | Phase-2 step 4; 1 target reuse, placed in early tier. |  |
| `DOUGH_VARIANT` | Dough_Variant | capability | early | CUMULATIVE_STARS | 0 |  | 13 | 0 | Phase-2 step 5; 13 target reuse, placed in early tier. |  |
| `dough:material-cauliflower` | Dough / Material Cauliflower | dough | early | CUMULATIVE_STARS | 60 | DOUGH_VARIANT | 1 | 1 | Phase-2 step 5; 1 target reuse, placed in early tier. |  |
| `pesto` | Pesto Genovese | ingredient | early | CUMULATIVE_STARS | 60 |  | 11 | 1 | Phase-2 step 6; 11 target reuse, placed in early tier. |  |
| `tuna` | Tuna | ingredient | early | CUMULATIVE_STARS | 60 |  | 3 | 2 | Phase-2 step 6; 3 target reuse, placed in early tier. |  |
| `bell-pepper` | Bell Pepper | ingredient | early | CUMULATIVE_STARS | 60 |  | 4 | 1 | Phase-2 step 7; 4 target reuse, placed in early tier. |  |
| `eggplant` | Eggplant | ingredient | early | CUMULATIVE_STARS | 60 |  | 9 | 1 | Phase-2 step 7; 9 target reuse, placed in early tier. |  |
| `zucchini` | Zucchini | ingredient | early | CUMULATIVE_STARS | 60 |  | 3 | 2 | Phase-2 step 7; 3 target reuse, placed in early tier. |  |
| `STEP_ORDER` | Step_Order | capability | early | CUMULATIVE_STARS | 0 |  | 1 | 1 | Phase-2 step 8; 1 target reuse, placed in early tier. |  |
| `garlic` | Garlic | ingredient | mid | CUMULATIVE_STARS | 100 |  | 10 | 1 | Phase-2 step 9; 10 target reuse, placed in mid tier. |  |
| `parmigiano` | Parmigiano Reggiano | ingredient | mid | CUMULATIVE_STARS | 100 |  | 5 | 1 | Phase-2 step 9; 5 target reuse, placed in mid tier. |  |
| `clam` | Clam | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 1 | Phase-2 step 9; 3 target reuse, placed in mid tier. |  |
| `prosciutto-crudo` | Prosciutto Crudo | ingredient | mid | CUMULATIVE_STARS | 100 |  | 5 | 1 | Phase-2 step 10; 5 target reuse, placed in mid tier. |  |
| `arugula` | Arugula (Rucola) | ingredient | mid | CUMULATIVE_STARS | 100 |  | 6 | 1 | Phase-2 step 10; 6 target reuse, placed in mid tier. |  |
| `dough:material-multigrain-long-ferment` | Dough / Material Multigrain Long Ferment | dough | mid | CUMULATIVE_STARS | 100 | DOUGH_VARIANT | 1 | 1 | Phase-2 step 10; 1 target reuse, placed in mid tier. |  |
| `MULTI_SPREAD_LAYER` | Multi_Spread_Layer | capability | mid | CUMULATIVE_STARS | 0 |  | 9 | 1 | Phase-2 step 11; 9 target reuse, placed in mid tier. |  |
| `burrata` | Burrata | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 3 | Phase-2 step 11; 3 target reuse, placed in mid tier. |  |
| `anchovy` | Anchovy | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 2 | Phase-2 step 12; 3 target reuse, placed in mid tier. |  |
| `PAN_BAKE` | Pan_Bake | capability | mid | CUMULATIVE_STARS | 0 |  | 3 | 0 | Phase-2 step 13; 3 target reuse, placed in mid tier. |  |
| `dough:thick` | Dough / Thick | dough | mid | CUMULATIVE_STARS | 100 | DOUGH_VARIANT | 3 | 0 | Phase-2 step 13; 3 target reuse, placed in mid tier. |  |
| `pan:deep-pan` | Pan / Deep Pan | pan | mid | CUMULATIVE_STARS | 100 | PAN_BAKE | 1 | 1 | Phase-2 step 13; 1 target reuse, placed in mid tier. |  |
| `parsley` | Parsley | ingredient | mid | CUMULATIVE_STARS | 100 |  | 4 | 1 | Phase-2 step 14; 4 target reuse, placed in mid tier. |  |
| `shrimp` | Shrimp | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 1 | Phase-2 step 14; 3 target reuse, placed in mid tier. |  |
| `mussel` | Mussel | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 14; 1 target reuse, placed in mid tier. |  |
| `rosemary` | Rosemary | ingredient | mid | CUMULATIVE_STARS | 100 |  | 4 | 1 | Phase-2 step 15; 4 target reuse, placed in mid tier. |  |
| `pork` | Pork | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 1 | Phase-2 step 15; 3 target reuse, placed in mid tier. |  |
| `ZONED_PLACEMENT` | Zoned_Placement | capability | mid | CUMULATIVE_STARS | 0 |  | 1 | 0 | Phase-2 step 16; 1 target reuse, placed in mid tier. |  |
| `artichoke` | Artichoke | ingredient | mid | CUMULATIVE_STARS | 100 |  | 2 | 1 | Phase-2 step 16; 2 target reuse, placed in mid tier. |  |
| `chicken` | Chicken | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 1 | Phase-2 step 17; 3 target reuse, placed in mid tier. |  |
| `catupiry` | Catupiry | ingredient | mid | CUMULATIVE_STARS | 100 |  | 2 | 1 | Phase-2 step 17; 2 target reuse, placed in mid tier. |  |
| `corn` | Corn | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 2 | Phase-2 step 18; 3 target reuse, placed in mid tier. |  |
| `green-onion` | Green Onion | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 1 | Phase-2 step 19; 3 target reuse, placed in mid tier. |  |
| `doubanjiang` | Doubanjiang | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 19; 1 target reuse, placed in mid tier. |  |
| `LATE_ADDITION` | Late_Addition | capability | mid | CUMULATIVE_STARS | 0 |  | 3 | 0 | Phase-2 step 20; 3 target reuse, placed in mid tier. |  |
| `bbq-sauce` | BBQ Sauce | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 0 | Phase-2 step 20; 1 target reuse, placed in mid tier. |  |
| `cilantro` | Cilantro | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 20; 1 target reuse, placed in mid tier. |  |
| `ricotta` | Ricotta | ingredient | mid | CUMULATIVE_STARS | 100 |  | 3 | 1 | Phase-2 step 21; 3 target reuse, placed in mid tier. |  |
| `mint` | Mint | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 21; 1 target reuse, placed in mid tier. |  |
| `pineapple` | Pineapple | ingredient | mid | CUMULATIVE_STARS | 100 |  | 2 | 1 | Phase-2 step 22; 2 target reuse, placed in mid tier. |  |
| `hot-dog` | Hot Dog | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 22; 1 target reuse, placed in mid tier. |  |
| `dough:thick-fluffy` | Dough / Thick Fluffy | dough | mid | CUMULATIVE_STARS | 100 | DOUGH_VARIANT | 2 | 1 | Phase-2 step 23; 2 target reuse, placed in mid tier. |  |
| `FRY_COOK` | Fry_Cook | capability | mid | CUMULATIVE_STARS | 0 |  | 1 | 1 | Phase-2 step 24; 1 target reuse, placed in mid tier. |  |
| `honey` | Honey | ingredient | mid | CUMULATIVE_STARS | 100 |  | 2 | 1 | Phase-2 step 25; 2 target reuse, placed in mid tier. |  |
| `almond` | Almond | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 26; 1 target reuse, placed in mid tier. |  |
| `baked-beans` | Baked Beans | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 27; 1 target reuse, placed in mid tier. |  |
| `capers` | Capers | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 28; 1 target reuse, placed in mid tier. |  |
| `cashew-cheese` | Cashew Cheese | ingredient | mid | CUMULATIVE_STARS | 100 |  | 1 | 1 | Phase-2 step 29; 1 target reuse, placed in mid tier. |  |
| `ENCLOSE` | Enclose | capability | late | CUMULATIVE_STARS | 0 |  | 3 | 2 | Phase-2 step 30; 3 target reuse, placed in late tier. |  |
| `caciocavallo` | Caciocavallo | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 30; 1 target reuse, placed in late tier. |  |
| `cherry-tomato` | Cherry Tomato | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 31; 1 target reuse, placed in late tier. |  |
| `dough:material-keto-mozzarella-almond` | Dough / Material Keto Mozzarella Almond | dough | late | CUMULATIVE_STARS | 140 | DOUGH_VARIANT | 1 | 1 | Phase-2 step 32; 1 target reuse, placed in late tier. |  |
| `dough:thin-large-pliable` | Dough / Thin Large Pliable | dough | late | CUMULATIVE_STARS | 140 | DOUGH_VARIANT | 1 | 1 | Phase-2 step 33; 1 target reuse, placed in late tier. |  |
| `DOUGH_SHAPE_TARGET` | Dough_Shape_Target | capability | late | CUMULATIVE_STARS | 0 |  | 1 | 0 | Phase-2 step 34; 1 target reuse, placed in late tier. |  |
| `dough:long-ferment` | Dough / Long Ferment | dough | late | CUMULATIVE_STARS | 140 | DOUGH_VARIANT | 1 | 0 | Phase-2 step 34; 1 target reuse, placed in late tier. |  |
| `pan:tray` | Pan / Tray | pan | late | CUMULATIVE_STARS | 140 | PAN_BAKE | 1 | 1 | Phase-2 step 34; 1 target reuse, placed in late tier. |  |
| `friarielli` | Friarielli | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 35; 1 target reuse, placed in late tier. |  |
| `fromage-blanc-sauce` | Fromage Blanc Sauce | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 36; 1 target reuse, placed in late tier. |  |
| `grana-padano` | Grana Padano | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 37; 1 target reuse, placed in late tier. |  |
| `green-pepper` | Green Pepper | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 38; 1 target reuse, placed in late tier. |  |
| `palm-heart` | Palm Heart | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 39; 1 target reuse, placed in late tier. |  |
| `pine-nuts` | Pine Nuts | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 40; 1 target reuse, placed in late tier. |  |
| `potato` | Potato | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 41; 1 target reuse, placed in late tier. |  |
| `salami` | Salami | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 42; 1 target reuse, placed in late tier. |  |
| `salt-cod` | Salt Cod | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 43; 1 target reuse, placed in late tier. |  |
| `sauerkraut` | Sauerkraut | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 44; 1 target reuse, placed in late tier. |  |
| `cream-cheese` | Cream Cheese | ingredient | late | CUMULATIVE_STARS | 140 |  | 5 | 0 | Phase-2 step 45; 5 target reuse, placed in late tier. |  |
| `dough:flatbread-unleavened` | Dough / Flatbread Unleavened | dough | late | CUMULATIVE_STARS | 140 | DOUGH_VARIANT | 1 | 1 | Phase-2 step 45; 1 target reuse, placed in late tier. |  |
| `jalapeno` | Jalapeno | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 46; 1 target reuse, placed in late tier. |  |
| `spinach` | Spinach | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 47; 1 target reuse, placed in late tier. |  |
| `lemon` | Lemon | ingredient | late | CUMULATIVE_STARS | 140 |  | 2 | 0 | Phase-2 step 48; 2 target reuse, placed in late tier. |  |
| `salmon` | Salmon | ingredient | late | CUMULATIVE_STARS | 140 |  | 3 | 1 | Phase-2 step 48; 3 target reuse, placed in late tier. |  |
| `sardine` | Sardine | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 49; 1 target reuse, placed in late tier. |  |
| `salmon-roe` | Salmon Roe | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 0 | Phase-2 step 50; 1 target reuse, placed in late tier. |  |
| `shiso` | Shiso | ingredient | late | CUMULATIVE_STARS | 140 |  | 4 | 1 | Phase-2 step 50; 4 target reuse, placed in late tier. |  |
| `whitebait` | Whitebait | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 51; 1 target reuse, placed in late tier. |  |
| `yuzu-kosho` | Yuzu Kosho | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 52; 1 target reuse, placed in late tier. |  |
| `fontina` | Fontina | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 0 | Phase-2 step 53; 1 target reuse, placed in late tier. |  |
| `gorgonzola` | Gorgonzola | ingredient | late | CUMULATIVE_STARS | 140 |  | 2 | 1 | Phase-2 step 53; 2 target reuse, placed in late tier. |  |
| `walnut` | Walnut | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 54; 1 target reuse, placed in late tier. |  |
| `miso-sauce` | Miso Sauce | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 0 | Phase-2 step 55; 1 target reuse, placed in late tier. |  |
| `white-sesame` | White Sesame | ingredient | late | CUMULATIVE_STARS | 140 |  | 2 | 1 | Phase-2 step 55; 2 target reuse, placed in late tier. |  |
| `PREP_STEP` | Prep_Step | capability | late | CUMULATIVE_STARS | 0 |  | 1 | 0 | Phase-2 step 56; 1 target reuse, placed in late tier. |  |
| `beef` | Beef | ingredient | late | CUMULATIVE_STARS | 140 |  | 2 | 0 | Phase-2 step 56; 2 target reuse, placed in late tier. |  |
| `yakiniku-sauce` | Yakiniku Sauce | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 56; 1 target reuse, placed in late tier. |  |
| `avocado` | Avocado | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 0 | Phase-2 step 57; 1 target reuse, placed in late tier. |  |
| `goat-cheese` | Goat Cheese | ingredient | late | CUMULATIVE_STARS | 140 |  | 1 | 1 | Phase-2 step 57; 1 target reuse, placed in late tier. |  |
| `dough:thin-crisp` | Dough / Thin Crisp | dough | endgame | CUMULATIVE_STARS | 180 | DOUGH_VARIANT | 1 | 0 | Phase-2 step 58; 1 target reuse, placed in endgame tier. |  |
| `pan:shallow-pan` | Pan / Shallow Pan | pan | endgame | CUMULATIVE_STARS | 180 | PAN_BAKE | 1 | 1 | Phase-2 step 58; 1 target reuse, placed in endgame tier. |  |
| `lamb` | Lamb | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 59; 1 target reuse, placed in endgame tier. |  |
| `sweet-potato` | Sweet Potato | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 59; 1 target reuse, placed in endgame tier. |  |
| `pomegranate` | Pomegranate | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 60; 1 target reuse, placed in endgame tier. |  |
| `tahini` | Tahini | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 60; 1 target reuse, placed in endgame tier. |  |
| `soy-sauce` | Soy Sauce | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 61; 1 target reuse, placed in endgame tier. |  |
| `wasabi` | Wasabi | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 61; 1 target reuse, placed in endgame tier. |  |
| `cucumber` | Cucumber | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 2 | 0 | Phase-2 step 62; 2 target reuse, placed in endgame tier. |  |
| `lettuce` | Lettuce | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 62; 1 target reuse, placed in endgame tier. |  |
| `yogurt-sauce` | Yogurt Sauce | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 62; 1 target reuse, placed in endgame tier. |  |
| `peking-duck` | Peking Duck | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 63; 1 target reuse, placed in endgame tier. |  |
| `sweet-bean-sauce` | Sweet Bean Sauce | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 63; 1 target reuse, placed in endgame tier. |  |
| `cheese-curd` | Cheese Curd | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 64; 1 target reuse, placed in endgame tier. |  |
| `french-fries` | French Fries | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 64; 1 target reuse, placed in endgame tier. |  |
| `gravy-sauce` | Gravy Sauce | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 64; 1 target reuse, placed in endgame tier. |  |
| `cod-roe` | Cod Roe | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 65; 1 target reuse, placed in endgame tier. |  |
| `fresh-cream-sauce` | Fresh Cream Sauce | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 65; 1 target reuse, placed in endgame tier. |  |
| `nori` | Nori (Seaweed) | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 65; 1 target reuse, placed in endgame tier. |  |
| `curry-ketchup` | Curry Ketchup | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 66; 1 target reuse, placed in endgame tier. |  |
| `paprika-powder` | Paprika Powder | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 66; 1 target reuse, placed in endgame tier. |  |
| `wurstel` | Wurstel | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 66; 1 target reuse, placed in endgame tier. |  |
| `dough:flatbread-pita-soft` | Dough / Flatbread Pita Soft | dough | endgame | CUMULATIVE_STARS | 180 | DOUGH_VARIANT | 1 | 0 | Phase-2 step 67; 1 target reuse, placed in endgame tier. |  |
| `halloumi` | Halloumi | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 67; 1 target reuse, placed in endgame tier. |  |
| `zaatar` | Zaatar | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 67; 1 target reuse, placed in endgame tier. |  |
| `mustard` | Mustard | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 68; 1 target reuse, placed in endgame tier. |  |
| `pickles` | Pickles | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 0 | Phase-2 step 68; 1 target reuse, placed in endgame tier. |  |
| `swiss-cheese` | Swiss Cheese | ingredient | endgame | CUMULATIVE_STARS | 180 |  | 1 | 1 | Phase-2 step 68; 1 target reuse, placed in endgame tier. |  |

## Phase 2 differences

- Converts group/step candidates into deterministic per-node conditions and a stable purchase order.
- Freezes tier prices at 60/100/140/180 Pitz and preserves Phase-2 S10/R10 stock policy.
- Every non-initial step derives its gate from the selected `G4_HYBRID_060` hybrid-star curve (minimum = 2 x ceil(before x 0.6)); it does not restore the rejected fixed ★10 ladder and does not alternate with a discovery-count gate.
- Reduces the decision ledger to the two confirmations that genuinely change production behavior.

## Fresh-audit findings

- Phase-2 input: 172 rows; recommended pool 101 targets (87 evidence-ready + 14 shipped overlay). Input SHA-256 `1ee8bb0900d365ec927862525e5cc2f02bf71d3ec172e8876ff1d5a072d165a3`.
- Phase-1 mechanic matrix remains the evidence authority: 53 evidence blockers, 22 product-decision blockers, 8 mechanic-interpretation blockers, and 2 discovery-rule blockers stay outside this matrix.
- Current production catalog has 15 shipped recipes and 22 ingredient records; this design matrix deliberately describes the future 105-ingredient 101-target pool and does not mutate production data.
- Current production contract derives LOCKED/AVAILABLE_TO_BUY/OWNED from `minTotalStars` and ownership, treats ownership as permanent, and stock as a separate consumable map. `starterGrantOnly` suppresses first purchase today; Phase 3-4 must replace that path for this matrix.
- Current FREE reward is base 100 with multipliers 0/0.5/0.8/1.0/1.2. Therefore OD-02 is real: ★1 currently earns 0, while this matrix requires floor 20 and +50 on first discovery. Lunch Rush remains 40 + quality + served bonus (max 140/run) and is not required for deadlock freedom.

## Validation

Run `python tools/progression2_phase34_unlocks.py --check`. It rebuilds twice, validates conditions, prices, counts, 101/101 reachability, and byte drift.
