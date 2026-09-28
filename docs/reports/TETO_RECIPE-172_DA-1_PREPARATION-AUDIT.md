# 172 Recipe — DA-1 Preparation Audit

**Docs/data/tools only. DA-1 is not implemented. Not an authority.**
- **No production change:** no recipe, ingredient, `src`, e2e or progression change.
- **Not changed:** Hint 5.0, the taxonomy, Cooking Technique authority, Cooking Steps, and PR #255 / #275 / #293 / #295.
- **Candidate vs authority:** every value that no lane has approved is labelled **CANDIDATE** or **MISSING**. In particular, the Authority Matrix's name-match key candidates are **not** promoted to Hint 5.0 authority.

| Deliverable | Path |
|---|---|
| Report (this file) | `docs/reports/TETO_RECIPE-172_DA-1_PREPARATION-AUDIT.md` |
| Machine-readable audit | `docs/reports/data/TETO_RECIPE-172_DA-1_PREPARATION-AUDIT.json`: 17 rows plus a summary |
| Generator / checker | `tools/recipe172_da1_preparation.py`. `--check` reports byte drift. It reads **pinned git objects only** and never writes to, or imports from, the Authority Matrix generator. |

**Terminology.** "DA-1" here means the data-only **production** PR(s) that add the B rows. The previous audit used "DA-1" for the authority pack that precedes it. This audit measures what is still missing before that PR is possible.

---

## 0. Result at a glance

- **B0: 0 rows.** No B row is authority-complete.
- **The reason is one lane, not many.** **Hint 5.0 key / sub-topping authority is missing for all 17 rows.** No row has exactly one topping, so no key is forced by the G17 gate. Every row needs an Owner choice among 2–120 valid assignments.
- **B1: 9 rows = the W2-A set.** Recipe authoring, ingredient art, progression and taxonomy are all Owner-approved for them. Only the Hint 5.0 lane is missing, and for 5 of the 9 also OD-H5-P4-CHEESE (they have no cheese).
- **B4: 8 rows = everything outside W2-A.** They have no recipe values, no approved wave, no approved ingredient rows, and 7 of them also have toppings with no family row.
- **Taxonomy / HCG completing by itself unlocks 0 rows.** The 9 W2-A rows do not wait for HCG (their taxonomy is already Owner-approved under OD-W2-5), and the 8 others wait on the Owner recipe authority lane first.
- **A gap between two lanes:** the HCG pack queues only the F=65 rows. The **8 topping ids** that 7 B rows lack a family for (each has a PROPOSED family, so they raise no question) are **not queued in it**. They still need an approval path.
- **Technique and Cooking Steps dependencies: 0 rows.** All 17 are single-sauce, need no technique and fit in 6 tabs.

**Sequencing finding that changes the plan.** `RECIPE_HINT_ROLES` is `Record<RecipeId, …>` and gate G17 walks `RECIPES`. Once Hint 5.0 and any new recipe are both on main, a recipe without a role entry is a type error. **Whichever of Hint 5.0 and DA-1 merges second must carry the Owner-approved key / sub roles.** The W2-A authoring was approved before Hint 5.0 existed, so it contains none.

---

## 1. Fresh Check

| Item | State (fetched 2026-09-28) |
|---|---|
| `origin/main` | `86b48fd51423a8f76db5398ab88ecfd944e2ae10`. Unchanged since the Authority Matrix audit. |
| Authority Matrix | branch `claude/172-recipe-authority-matrix` @ `79873c0`. No PR. Class counts re-verified by the generator: A 11 · B 17 · C 24 · D 16 · E 39 · F 65. |
| Hint 5.0 (#292) | branch `claude/hint-5-0-fresh-audit-cdgm9e` @ `5eadb96`. It holds H5-3 `1ec4253` plus the **H5-4 Fresh Gate report**. No PR, not on main. `recipeHintRoles.ts` is unchanged since `abce62a` (25 roles, C1a / C1b / C1-P). Issue #292 has no new comments. |
| H5-4 Fresh Gate | Verdict **B, conditionally adoptable**. It is **waiting for the Owner's decision** on OD-H5-P4-CHEESE, P4b, P4-SAUCE (deferred to TQ-1D) and M2. |
| Taxonomy / HCG | The HCG lane pushed **`claude/recipe172-taxonomy-hcg` @ `7792bc8`** while this audit ran: a docs pack for the **F=65** rows (54 blocker ingredients, 31 questions). It states that it is **not an authority and decides nothing**, and it has no PR. **None of the 8 topping ids that B rows lack a family for is among its items, and neither `garlic` nor `black-olive` is the subject of a question.** PR #293 (`1bb4f9d`) and PR #255 (`e221e36`) are unchanged. So no HCG result is consumable yet; every taxonomy item that is not on main or Owner-approved is treated as open. |
| Wave 2 | branch `claude/wave2-runtime-recipe-design-os06j1` @ `2bc40e4` (W2-A1: 8 ingredient rows, 7 family rows, visuals). **No PR.** Its base is `7bb0116`, so it would need a rebase onto main. |
| Cooking Steps | PR #295 is open @ `13d6836` and carries **CS-1a** (the 6-tab gate and generic post-bake rendering). CS-1b waits for PR #275, which is open. |
| LAD-1 | Merged on main (`POST_W1_APPENDED_STEPS = []`). This is the append seam W2-A2 uses. |
| TQ | TQ-1C is on main and inert (INV-TQ-4). TQ-1D has not started. |

## 2. Method

The 17 B rows are selected from the Authority Matrix (`classification.primary == B`). For each row the audit decides, per **lane**, whether something is still missing.

| Lane | Family | Missing when |
|---|---|---|
| **H** | Hint 5.0 | key topping and sub-topping order are not authority (OD-H5-C1: explicit authority; nothing is derived from ingredient order) |
| **N** | Hint 5.0 | the recipe has no cheese, so its CHEESE rung is empty until OD-H5-P4-CHEESE is decided (H5-4) |
| **T** | Taxonomy | a topping has no production family and no Owner-approved row |
| **I** | Owner recipe authority | a new ingredient or paint sauce has no approved authoring row |
| **R** | Owner recipe authority | recipe values (name, description, minCount, bakeTarget, reference) are not decided |
| **P** | Owner recipe authority | no approved wave (OD-W2-3 approves only W2-A → W2-C → W2-D) |
| **O** | Owner recipe authority | a matrix review item is open and no approved decision covers it |

**Groups** come from the lane families that are missing:

| Group | Meaning |
|---|---|
| **B0** | no missing lane |
| **B1** | only the Hint 5.0 family is missing |
| **B2** | only the Taxonomy family is missing |
| **B3** | only the Owner recipe authority family is missing |
| **B4a / B4b** | two / three families are missing |

Names may be adjusted. **Implementation state** (a branch not merged, code not written) is tracked separately and is not counted as a missing authority.

## 3. The B=17 rows

| Recipe | Missing lanes | Lane families | Group |
|---|---|---|---|
| `calabresa-argentina` | H T I R P O | Hint 5.0, Owner recipe authority, Taxonomy | **B4b** |
| `vongole` | H N | Hint 5.0 | **B1** |
| `flammkuchen` | H N | Hint 5.0 | **B1** |
| `eggplant-tahini-p5` | H N T I R P | Hint 5.0, Owner recipe authority, Taxonomy | **B4b** |
| `eggplant-dengaku-p6` | H T I R P | Hint 5.0, Owner recipe authority, Taxonomy | **B4b** |
| `baba-ganoush-p7` | H N T I R P | Hint 5.0, Owner recipe authority, Taxonomy | **B4b** |
| `jamon-serrano-p7` | H | Hint 5.0 | **B1** |
| `brazilian-calabresa-p10` | H N | Hint 5.0 | **B1** |
| `prosciutto-funghi-p11` | H | Hint 5.0 | **B1** |
| `veggie-supreme-p11` | H T I R P | Hint 5.0, Owner recipe authority, Taxonomy | **B4b** |
| `pesto-gamberi-p11` | H N | Hint 5.0 | **B1** |
| `pesto-salmone-p11` | H T I R P | Hint 5.0, Owner recipe authority, Taxonomy | **B4b** |
| `pesto-trapanese-p11` | H N T I R P | Hint 5.0, Owner recipe authority, Taxonomy | **B4b** |
| `pesto-vegetariana-p12` | H | Hint 5.0 | **B1** |
| `pesto-pollo-p12` | H | Hint 5.0 | **B1** |
| `ratatouille-p13` | H N | Hint 5.0 | **B1** |
| `rucola-e-grana-p13` | H I R P | Hint 5.0, Owner recipe authority | **B4a** |

**W2-A (9 rows):** `vongole` · `flammkuchen` · `jamon-serrano` · `brazilian-calabresa` · `prosciutto-funghi` · `pesto-gamberi` · `pesto-vegetariana` · `pesto-pollo` · `ratatouille-pizza`.

**Non-W2-A (8 rows):** `calabresa-argentina` · `eggplant-tahini` · `eggplant-dengaku` · `baba-ganoush` · `veggie-supreme` · `pesto-salmone` · `pesto-trapanese` · `rucola-e-grana`.

## 4. Per-recipe authority inventory

Ingredient rows in **bold** are new to main. "branch" means Owner-approved on the W2-A1 branch but not on main.

### 4.1 Identity, catalog relation and ingredients

| # | Recipe ID | Canonical name | W2-A | Runtime | Catalog relation (matrix / master catalog) | Canonical ingredient IDs (new to main in **bold**) |
|---|---|---|---|---|---|---|
| 1 | `calabresa-argentina-pizzadb` | アルゼンチン風カラブレーサ (candidate) | — | NONE | NAMING_CLUSTER; NC-4-calabresa | black-olive, mozzarella, oregano, **salami**, tomato-sauce |
| 2 | `vongole-pizzadb` | ヴォンゴレピザ (approved) | ✅ | NONE | covered: OD-W2-7 (a) | clam, garlic, olive-oil, **parsley** |
| 3 | `flammkuchen-pizzadb` | タルトフランベ (approved) | ✅ | NONE | — | bacon, **fromage-blanc-sauce**, onion |
| 4 | `eggplant-tahini-pizza-pizzadb-p5` | ナスとタヒニのピザ (candidate) | — | NONE | — | eggplant, **parsley**, **pomegranate**, **tahini** |
| 5 | `eggplant-dengaku-pizza-pizzadb-p6` | ナス田楽ピザ (candidate) | — | NONE | — | eggplant, **miso-sauce**, mozzarella, **white-sesame** |
| 6 | `baba-ganoush-pizza-pizzadb-p7` | ババガヌーシュピザ (candidate) | — | NONE | — | eggplant, olive-oil, **parsley**, **pine-nuts** |
| 7 | `jamon-serrano-pizza-pizzadb-p7` | ハモンセラーノピザ (approved) | ✅ | NONE | P0-COLL-4; covered: OD-W2-7 (a) | **arugula**, mozzarella, **prosciutto-crudo**, tomato-sauce |
| 8 | `brazilian-calabresa-pizzadb-p10` | ブラジリアン・カラブレーザ (approved) | ✅ | NONE | NAMING_CLUSTER; NC-4-calabresa; covered: OD-W2-7 (a) | black-olive, onion, oregano, sausage, tomato-sauce |
| 9 | `prosciutto-funghi-pizzadb-p11` | プロシュットフンギ (approved) | ✅ | NONE | SAME_INGREDIENT_SET_AS_CATALOG_RECIPE; covered: OD-W2-7 (a) | mozzarella, mushroom, **prosciutto-crudo**, tomato-sauce |
| 10 | `veggie-supreme-pizza-pizzadb-p11` | ベジースプリームピザ (candidate) | — | NONE | — | black-olive, fresh-tomato, **green-pepper**, mozzarella, mushroom, onion, tomato-sauce |
| 11 | `pesto-gamberi-pizzadb-p11` | ペストガンベリピザ (approved) | ✅ | NONE | — | fresh-tomato, garlic, pesto, **shrimp** |
| 12 | `pesto-salmone-pizzadb-p11` | ペストサーモンピザ (candidate) | — | NONE | — | **cream-cheese**, **lemon**, pesto, **salmon** |
| 13 | `pesto-trapanese-pizzadb-p11` | ペストトラパネーゼピザ (candidate) | — | NONE | — | **almond**, fresh-tomato, garlic, pesto |
| 14 | `pesto-vegetariana-pizzadb-p12` | ペストベジタリアーナピザ (approved) | ✅ | NONE | — | **bell-pepper**, eggplant, mozzarella, pesto, **zucchini** |
| 15 | `pesto-pollo-pizzadb-p12` | ペストポッロピザ (approved) | ✅ | NONE | — | **chicken**, fresh-tomato, mozzarella, pesto |
| 16 | `ratatouille-pizza-pizzadb-p13` | ラタトゥイユピザ (approved) | ✅ | NONE | — | **bell-pepper**, eggplant, oregano, tomato-sauce, **zucchini** |
| 17 | `rucola-e-grana-pizzadb-p13` | ルーコラエグラーナピザ (candidate) | — | NONE | — | **arugula**, **grana-padano**, **prosciutto-crudo**, tomato-sauce |

None of the 17 rows matches a runtime recipe, and none is a runtime-set collision. `jamon-serrano` shares its full ingredient set with `pinsa-romana` (P0-COLL-4). OD-W2-7 (a) adopted `jamon-serrano` with a reservation that a later DOUGH_VARIANT slice separates the two.

### 4.2 Sauce, cheese, topping and taxonomy

| Recipe | Sauce authority | Cheese authority | Toppings and their family status | Taxonomy lane |
|---|---|---|---|---|
| `calabresa-argentina` | `tomato-sauce` PRODUCTION_PROFILE_ON_MAIN | `mozzarella` PRODUCTION | `black-olive`→vegetable, `oregano`→herb, `salami`→none (**missing**; proposed meat) | MISSING; HCG watch ['black-olive'] |
| `vongole` | `olive-oil` PRODUCTION_PROFILE_ON_MAIN | NO_CHEESE | `clam`→seafood, `garlic`→herb, `parsley`→herb (branch) | approved, lands with W2-A1; HCG watch ['garlic'] |
| `flammkuchen` | `fromage-blanc-sauce` APPROVED_W2A | NO_CHEESE | `bacon`→meat, `onion`→vegetable | complete on main |
| `eggplant-tahini-p5` | `tahini` MISSING | NO_CHEESE | `eggplant`→vegetable, `parsley`→herb (branch), `pomegranate`→none (**missing**; proposed fruit) | MISSING |
| `eggplant-dengaku-p6` | `miso-sauce` MISSING | `mozzarella` PRODUCTION | `eggplant`→vegetable, `white-sesame`→none (**missing**; proposed other) | MISSING |
| `baba-ganoush-p7` | `olive-oil` PRODUCTION_PROFILE_ON_MAIN | NO_CHEESE | `eggplant`→vegetable, `parsley`→herb (branch), `pine-nuts`→none (**missing**; proposed other) | MISSING |
| `jamon-serrano-p7` | `tomato-sauce` PRODUCTION_PROFILE_ON_MAIN | `mozzarella` PRODUCTION | `arugula`→vegetable (branch), `prosciutto-crudo`→meat (branch) | approved, lands with W2-A1 |
| `brazilian-calabresa-p10` | `tomato-sauce` PRODUCTION_PROFILE_ON_MAIN | NO_CHEESE | `black-olive`→vegetable, `onion`→vegetable, `oregano`→herb, `sausage`→meat | complete on main; HCG watch ['black-olive'] |
| `prosciutto-funghi-p11` | `tomato-sauce` PRODUCTION_PROFILE_ON_MAIN | `mozzarella` PRODUCTION | `mushroom`→vegetable, `prosciutto-crudo`→meat (branch) | approved, lands with W2-A1 |
| `veggie-supreme-p11` | `tomato-sauce` PRODUCTION_PROFILE_ON_MAIN | `mozzarella` PRODUCTION | `black-olive`→vegetable, `fresh-tomato`→vegetable, `green-pepper`→none (**missing**; proposed vegetable), `mushroom`→vegetable, `onion`→vegetable | MISSING; HCG watch ['black-olive'] |
| `pesto-gamberi-p11` | `pesto` PRODUCTION_PROFILE_ON_MAIN | NO_CHEESE | `fresh-tomato`→vegetable, `garlic`→herb, `shrimp`→seafood (branch) | approved, lands with W2-A1; HCG watch ['garlic'] |
| `pesto-salmone-p11` | `pesto` PRODUCTION_PROFILE_ON_MAIN | `cream-cheese` MISSING (new ingredient row) | `lemon`→none (**missing**; proposed fruit), `salmon`→none (**missing**; proposed seafood) | MISSING |
| `pesto-trapanese-p11` | `pesto` PRODUCTION_PROFILE_ON_MAIN | NO_CHEESE | `almond`→none (**missing**; proposed other), `fresh-tomato`→vegetable, `garlic`→herb | MISSING; HCG watch ['garlic'] |
| `pesto-vegetariana-p12` | `pesto` PRODUCTION_PROFILE_ON_MAIN | `mozzarella` PRODUCTION | `bell-pepper`→vegetable (branch), `eggplant`→vegetable, `zucchini`→vegetable (branch) | approved, lands with W2-A1 |
| `pesto-pollo-p12` | `pesto` PRODUCTION_PROFILE_ON_MAIN | `mozzarella` PRODUCTION | `chicken`→meat (branch), `fresh-tomato`→vegetable | approved, lands with W2-A1 |
| `ratatouille-p13` | `tomato-sauce` PRODUCTION_PROFILE_ON_MAIN | NO_CHEESE | `bell-pepper`→vegetable (branch), `eggplant`→vegetable, `oregano`→herb, `zucchini`→vegetable (branch) | approved, lands with W2-A1 |
| `rucola-e-grana-p13` | `tomato-sauce` PRODUCTION_PROFILE_ON_MAIN | `grana-padano` MISSING (new ingredient row) | `arugula`→vegetable (branch), `prosciutto-crudo`→meat (branch) | approved, lands with W2-A1 |

### 4.3 Hint 5.0 key and sub-topping order

| Recipe | Toppings | Valid role assignments (G17) | Key authority | Key candidate (basis) | C1-P assessment | Sub order authority | Sub order seed candidate |
|---|---:|---:|---|---|---|---|---|
| `calabresa-argentina` | 3 | 6 | CANDIDATE_ONLY | `salami` (READING) | CANDIDATE by this audit's reading only (low confidence) | CANDIDATE_ONLY (seed) | `black-olive`, `oregano` |
| `vongole` | 3 | 6 | CANDIDATE_ONLY | `clam` (APPROVED_ROLE) | CANDIDATE consistent with C1-P (Owner-approved W2-A role) | CANDIDATE_ONLY (seed) | `garlic`, `parsley` |
| `flammkuchen` | 2 | 2 | MISSING | — (owner choice) | OWNER_CHOICE (no unique main under C1-P) | MISSING | — |
| `eggplant-tahini-p5` | 3 | 6 | CANDIDATE_ONLY | `eggplant` (NAME_MATCH) | CANDIDATE consistent with C1-P (name match; guideline only) | CANDIDATE_ONLY (seed) | `pomegranate`, `parsley` |
| `eggplant-dengaku-p6` | 2 | 2 | CANDIDATE_ONLY | `eggplant` (NAME_MATCH) | CANDIDATE consistent with C1-P (name match; guideline only) | CANDIDATE_ONLY (seed) | `white-sesame` |
| `baba-ganoush-p7` | 3 | 6 | CANDIDATE_ONLY | `eggplant` (READING) | CANDIDATE by this audit's reading only (low confidence) | CANDIDATE_ONLY (seed) | `parsley`, `pine-nuts` |
| `jamon-serrano-p7` | 2 | 2 | CANDIDATE_ONLY | `prosciutto-crudo` (APPROVED_ROLE) | CANDIDATE consistent with C1-P (Owner-approved W2-A role) | CANDIDATE_ONLY (seed) | `arugula` |
| `brazilian-calabresa-p10` | 4 | 24 | CANDIDATE_ONLY | `sausage` (APPROVED_ROLE) | CANDIDATE consistent with C1-P (Owner-approved W2-A role) | CANDIDATE_ONLY (seed) | `onion`, `black-olive`, `oregano` |
| `prosciutto-funghi-p11` | 2 | 2 | MISSING | — (owner choice) | OWNER_CHOICE (no unique main under C1-P) | MISSING | — |
| `veggie-supreme-p11` | 5 | 120 | MISSING | — (owner choice) | OWNER_CHOICE (no unique main under C1-P) | MISSING | — |
| `pesto-gamberi-p11` | 3 | 6 | CANDIDATE_ONLY | `shrimp` (APPROVED_ROLE) | CANDIDATE consistent with C1-P (Owner-approved W2-A role) | CANDIDATE_ONLY (seed) | `fresh-tomato`, `garlic` |
| `pesto-salmone-p11` | 2 | 2 | CANDIDATE_ONLY | `salmon` (NAME_MATCH) | CANDIDATE consistent with C1-P (name match; guideline only) | CANDIDATE_ONLY (seed) | `lemon` |
| `pesto-trapanese-p11` | 3 | 6 | MISSING | — (owner choice) | OWNER_CHOICE (no unique main under C1-P) | MISSING | — |
| `pesto-vegetariana-p12` | 3 | 6 | MISSING | — (owner choice) | OWNER_CHOICE (no unique main under C1-P) | MISSING | — |
| `pesto-pollo-p12` | 2 | 2 | CANDIDATE_ONLY | `chicken` (APPROVED_ROLE) | CANDIDATE consistent with C1-P (Owner-approved W2-A role) | CANDIDATE_ONLY (seed) | `fresh-tomato` |
| `ratatouille-p13` | 4 | 24 | MISSING | — (owner choice) | OWNER_CHOICE (no unique main under C1-P) | MISSING | — |
| `rucola-e-grana-p13` | 2 | 2 | MISSING | — (owner choice) | OWNER_CHOICE (no unique main under C1-P) | MISSING | — |

- **Authority exists: 0 of 17.** `keyToppingAuthority` is `CANDIDATE_ONLY` for 10 rows and `MISSING` (no unique main) for 7.
- **Candidate basis:** APPROVED_ROLE 5 (the W2-A A1 authoring tags the topping "primary") · NAME_MATCH 3 (guideline only) · READING 2 (this audit's own reading, low confidence) · none 7.
- **No row is forced by G17.** G17 allows `null` only without toppings, and a key must be one of the recipe's toppings. A recipe with n toppings has n! valid assignments. The smallest B row has 2 toppings (2 assignments); the largest has 5 (120).
- **Sub-order seed.** H5-0 §6.1 made the sub order "a one-time copy of the recipe's own listing order" for the 25 runtime recipes only. Applied to the B rows it yields the seeds above (W2-A: the approved authoring order; others: the PIZZA DB listing order). **That rule is not approved for 172**, so the seeds stay candidates.
- **Aroma keys:** 0 candidates are herb or spice.

### 4.4 Recipe authoring, progression and engine

| Recipe | Recipe authoring values | Progression / wave | CUT | Tabs | Technique dep. | CS engine dep. | PR #295 class |
|---|---|---|---|---:|---:|---:|---|
| `calabresa-argentina` | **MISSING** | **no approved wave** | NO_CUT | 5 | 0 | 0 | DATA_ONLY |
| `vongole` | APPROVED (minCount {'olive-oil': 1, 'clam': 3, 'garlic': 2, 'parsley': 2}, bake 62–82) | APPROVED: key step 30 (parsley), T4 | NO_CUT | 4 | 0 | 0 | DATA_ONLY |
| `flammkuchen` | APPROVED (minCount {'fromage-blanc-sauce': 1, 'bacon': 3, 'onion': 2}, bake 56–76) | APPROVED: key step 26 (fromage-blanc-sauce), T3 | NO_CUT | 4 | 0 | 0 | DATA_ONLY |
| `eggplant-tahini-p5` | **MISSING** | **no approved wave** (option: W2-B_SAUCE_PALETTE) | CUT | 5 | 0 | 0 | DATA_ONLY |
| `eggplant-dengaku-p6` | **MISSING** | **no approved wave** (option: W2-B_SAUCE_PALETTE) | CUT | 6 | 0 | 0 | DATA_ONLY |
| `baba-ganoush-p7` | **MISSING** | **no approved wave** | CUT | 5 | 0 | 0 | DATA_ONLY |
| `jamon-serrano-p7` | APPROVED (minCount {'tomato-sauce': 1, 'mozzarella': 2, 'prosciutto-crudo': 3, 'arugula': 2}, bake 55–75) | APPROVED: key step 27 (arugula), T3 | CUT | 6 | 0 | 0 | DATA_ONLY |
| `brazilian-calabresa-p10` | APPROVED (minCount {'tomato-sauce': 1, 'sausage': 3, 'onion': 2, 'black-olive': 2, 'oregano': 1}, bake 62–82) | APPROVED: key step 12 (onion), T2 | CUT | 5 | 0 | 0 | CURRENT_ENGINE |
| `prosciutto-funghi-p11` | APPROVED (minCount {'tomato-sauce': 1, 'mozzarella': 2, 'prosciutto-crudo': 2, 'mushroom': 3}, bake 58–78) | APPROVED: key step 25 (prosciutto-crudo), T3 | CUT | 6 | 0 | 0 | DATA_ONLY |
| `veggie-supreme-p11` | **MISSING** | **no approved wave** | CUT | 6 | 0 | 0 | DATA_ONLY |
| `pesto-gamberi-p11` | APPROVED (minCount {'pesto': 1, 'shrimp': 3, 'fresh-tomato': 2, 'garlic': 2}, bake 50–70) | APPROVED: key step 28 (shrimp), T3 | CUT | 5 | 0 | 0 | DATA_ONLY |
| `pesto-salmone-p11` | **MISSING** | **no approved wave** | CUT | 6 | 0 | 0 | DATA_ONLY |
| `pesto-trapanese-p11` | **MISSING** | **no approved wave** | CUT | 5 | 0 | 0 | DATA_ONLY |
| `pesto-vegetariana-p12` | APPROVED (minCount {'pesto': 1, 'mozzarella': 2, 'zucchini': 2, 'bell-pepper': 2, 'eggplant': 2}, bake 50–70) | APPROVED: key step 31 (bell-pepper+zucchini), T4 | CUT | 6 | 0 | 0 | DATA_ONLY |
| `pesto-pollo-p12` | APPROVED (minCount {'pesto': 1, 'mozzarella': 2, 'chicken': 3, 'fresh-tomato': 2}, bake 50–70) | APPROVED: key step 29 (chicken), T3 | CUT | 6 | 0 | 0 | DATA_ONLY |
| `ratatouille-p13` | APPROVED (minCount {'tomato-sauce': 1, 'eggplant': 2, 'zucchini': 2, 'bell-pepper': 2, 'oregano': 1}, bake 58–78) | APPROVED: key step 31 (bell-pepper+zucchini), T4 | CUT | 5 | 0 | 0 | DATA_ONLY |
| `rucola-e-grana-p13` | **MISSING** | **no approved wave** | CUT | 6 | 0 | 0 | DATA_ONLY |

## 5. C1-P check

C1-P: *the key is the main topping that characterises the recipe, preferring a main ingredient over an aroma or garnish, and never duplicating sauce / cheese information.*

| Check | Result |
|---|---|
| The key is a topping, never a sauce or cheese | Holds for every candidate (and it is a G17 rule). |
| The key is not an aroma / garnish | No candidate is in the herb or spice family (checked by family). Whether a candidate is a garnish is not machine-checked; it is the Owner's judgement. |
| A unique main exists | **Only for 10 rows.** For 7 rows C1-P has no unique main and the choice is the Owner's. |

**The 7 rows without a unique main, and why:**

| Row | Reason |
|---|---|
| `flammkuchen` | W2-A A1: "two co-defining toppings (bacon + onion)". The §6.4 tie-break would pick bacon (largest amount), but the tie-break is not authority. |
| `prosciutto-funghi` | W2-A A1: "two name-giving toppings". The tie-break steps disagree: name order → prosciutto-crudo, largest amount → mushroom. |
| `pesto-vegetariana` | W2-A A1: three co-equal vegetables at 2 each. |
| `ratatouille-pizza` | W2-A A1: three co-equal vegetables. `oregano` is an accent and is excluded by C1-P. |
| `veggie-supreme` | five co-equal vegetables. |
| `pesto-trapanese` | almond, fresh-tomato, garlic: none is name-giving or clearly the main. |
| `rucola-e-grana` | The name gives arugula, but arugula is a leaf garnish and prosciutto-crudo is the protein main. C1-P and the name point in different directions. |

**The 10 candidates.** The 5 with an Owner-approved role are the strongest: `clam` (vongole), `prosciutto-crudo` (jamon-serrano), `sausage` (brazilian-calabresa), `shrimp` (pesto-gamberi) and `chicken` (pesto-pollo). Even these are **candidates**: OD-H5-C1 requires explicit Hint 5.0 authority, and the W2-A minCount roles are not that. The 3 name matches (`eggplant` ×2, `salmon`) and the 2 readings (`salami`, `eggplant` for baba-ganoush) are weaker. **The name-match candidates are not promoted.**

## 6. What is really undecided for the 9 W2-A rows

| Item | State | Evidence |
|---|---|---|
| **1. Taxonomy** | **Decided**, but 7 rows are not on main | OD-W2-5 (Owner, scoped) approved the 7 topping families (prosciutto-crudo, chicken → meat; arugula, bell-pepper, zucchini → vegetable; shrimp → seafood; parsley → herb), consistent with PR #255. They exist only on the W2-A1 branch (no PR). Open only as a **watch**: `garlic` (vongole, pesto-gamberi) and `black-olive` (brazilian-calabresa) are production rows that PR #255 / #293 still list as under review (OD-TAX-7). A change there would not break the "exactly one family" gate. |
| **2. Hint 5.0 key** | **Undecided, 9 of 9** | Nothing authored. 5 rows have an Owner-approved primary topping to build on. 4 rows (flammkuchen, prosciutto-funghi, pesto-vegetariana, ratatouille) are recorded as co-equal, so the Owner must choose. |
| **3. Sub order** | **Undecided, 9 of 9** | Once the key is chosen, the 4 two-topping rows have a forced order. The others need an order: brazilian-calabresa (3 subs), ratatouille (3), vongole, pesto-gamberi, pesto-vegetariana (2 each). |
| **4. Recipe authoring** | **Decided** | A1 (minCount), A2 (bakeTarget), A3 (description), A4 (name) are all `APPROVED_OWNER` in the authoring JSON and the ledger. The Authoring Gate report still prints the description as `OWNER_REQUIRED`; that text predates the approval and is superseded. |
| **5. Progression / wave** | **Decided** | OD-W2-1 / 2 / 3 approve the append-only ladder, the price / chapter rules and the wave order. The Authoring Gate verified the ladder steps (key steps 25–31 for 8 rows; `brazilian-calabresa` is at step 12, from a W1 material). Steps are derived from the rule, not stored. |

**Also open, and not on that list.** OD-H5-P4-CHEESE (undecided) applies to 5 W2-A rows: vongole, flammkuchen, brazilian-calabresa, pesto-gamberi and ratatouille have no cheese. In the Hint 5.0 design an empty CHEESE rung is `RESERVED_EMPTY_RUNG`, and H5-4 proposes a production gate that no target may reach it.

**Implementation state, not authority:**
- W2-A1 (materials, visuals and the 7 family rows) is unmerged and has no PR.
- W2-A2 is not written.
- The W2-A gate requires a re-audit of the DH4 topping-count audit for 34 recipes. This is more pressing now that DH4-PROD (#291) is enabled in production.
- W2-A2 needs a mandatory Human Verification.

`brazilian-calabresa` is the only W2-A row that uses **no** new ingredient and no W2-A1 row. Its only missing lane is Hint 5.0 (key / sub, and P4-CHEESE).

## 7. Taxonomy lane

- **No family row anywhere** (on main or on the W2-A1 branch): 7 rows, 8 topping ids: `salami`, `pomegranate`, `white-sesame`, `pine-nuts`, `green-pepper`, `lemon`, `salmon`, `almond`. Each has a PROPOSED family in PR #255 / #293 (none of them is a new family id).
- **They are not in the HCG pack.** The pack (`7792bc8`) covers the F=65 rows only, and a PROPOSED family raises no question, so none of the 8 ids is among its 54 items or 31 questions (checked by the generator: `summary.hcgPack`). No lane currently owns approving them. Neither `garlic` nor `black-olive` is the subject of any of its questions (HCG-04 mentions `garlic` only as related context).
- **Approved on the W2-A1 branch, not on main:** 10 rows depend on those rows (the 7 W2-A rows that use them, plus `eggplant-tahini`, `baba-ganoush` and `rucola-e-grana` through `parsley`, `arugula` and `prosciutto-crudo`).
- **HCG watch (a production family under review):** `black-olive` (calabresa-argentina, brazilian-calabresa, veggie-supreme), `garlic` (vongole, pesto-gamberi, pesto-trapanese).
- **Rows with no taxonomy dependency on any open HCG item:** flammkuchen, jamon-serrano, prosciutto-funghi, pesto-vegetariana, pesto-pollo, ratatouille, rucola-e-grana.
- **Canonicalization:** `calabresa-argentina` also depends on the unresolved salami / spicy-salami / sausage cluster (OD-TAX-7). It is part of its open review item.

## 8. Technique and Cooking Steps

| Check | Result |
|---|---|
| Rows requiring a technique | **0.** All 17 are single-sauce. `vongole` has an olive-oil base (OD-W2-7 a), so it is not a no-sauce row. Hint 5.0 gate G7 (single sauce, no technique) is satisfied. |
| Rows with a Cooking Steps engine dependency | **0.** PR #295 classes: DATA_ONLY 16, CURRENT_ENGINE 1. |
| Candidate-only capabilities | **0.** |
| Tab ceiling (CS-1a's ≤ 6 invariant) | Max 6 tabs (DOUGH, SAUCE, CHEESE, TOPPING, BAKE, CUT). Holds for all 17. |
| CUT | A data opt-out. `vongole` and `flammkuchen` have no CUT (no dough evidence, OD-W2-4; approved). `calabresa-argentina` has the same candidate (dough evidence unknown). The other 14 keep CUT. |
| Textual overlap risk | W2-A2 edits `cookingProfiles.ts` (the CUT allowlist). PR #295 also changes `cookingProfiles.ts` and adds `cookingProfiles.tabGate.test.ts`. **Not trial-merged.** It is a sequencing note, not a blocker. |

## 9. Grouping

| Group | Rows | Members |
|---|---:|---|
| **B0** | 0 | — |
| **B1** | 9 | the W2-A set (5 of them also wait on OD-H5-P4-CHEESE: vongole, flammkuchen, brazilian-calabresa, pesto-gamberi, ratatouille) |
| **B2** | 0 | — |
| **B3** | 0 | — |
| **B4a** | 1 | rucola-e-grana (Hint 5.0 + Owner recipe authority) |
| **B4b** | 7 | calabresa-argentina, eggplant-tahini, eggplant-dengaku, baba-ganoush, veggie-supreme, pesto-salmone, pesto-trapanese (all three families) |

**Missing lane counts (all 17):** H 17 · N 8 · T 7 · I 8 · R 8 · P 8 · O 1. **Among the W2-A 9:** H 9 · N 5 and nothing else.

**Sub-splits that help ordering (objective, not a ranking):**
- B1 rows that wait only on key / sub authoring: jamon-serrano, prosciutto-funghi, pesto-vegetariana, pesto-pollo (4). B1 rows that also wait on OD-H5-P4-CHEESE: vongole, flammkuchen, brazilian-calabresa, pesto-gamberi, ratatouille (5).
- B1 rows with a unique-main candidate (the Owner may confirm rather than choose): vongole, jamon-serrano, brazilian-calabresa, pesto-gamberi, pesto-pollo. Rows that need a real choice: flammkuchen, prosciutto-funghi, pesto-vegetariana, ratatouille.

## 10. After the Taxonomy / HCG lane completes

Stated as dependency facts only.

| Set | Rows |
|---|---|
| Rows unlocked by HCG **alone** (Taxonomy is their only missing family) | **0** |
| Rows whose only remaining family, once HCG is complete, is Hint 5.0 | **9**: the W2-A set. Their taxonomy is **already** complete or Owner-approved, so HCG does not create this set. |
| — of which insensitive to every open HCG item | flammkuchen, jamon-serrano, prosciutto-funghi, pesto-vegetariana, pesto-pollo, ratatouille |
| — of which touch an open HCG watch item | vongole (`garlic`), pesto-gamberi (`garlic`), brazilian-calabresa (`black-olive`) |
| Rows for which HCG completion clears their **last** taxonomy item but that still wait on the Owner recipe authority and Hint 5.0 lanes | calabresa-argentina, eggplant-tahini, eggplant-dengaku, baba-ganoush, veggie-supreme, pesto-salmone, pesto-trapanese |

So HCG completion does **not** by itself make any row a data-PR candidate. What removes the remaining blockers is in other lanes: Hint 5.0 (17 rows), OD-H5-P4-CHEESE (8 rows) and an Owner Authoring Gate for the 8 non-W2-A rows.

## 11. DA-1 Start Gate

DA-1 may start only when every item below reads PASS for the rows in scope. Status is as of this audit.

| # | Gate | Status |
|---|---|---|
| SG-1 | Fresh check: `main` unchanged from `86b48fd` (or re-audited), and the Authority Matrix classes unchanged | **PASS** today |
| SG-2 | Scope decided by the Owner. The W2-A 9 have an implementation-ready gate. The 8 others have no Authoring Gate, so they cannot be in DA-1 yet. | **OPEN** |
| SG-3 | Hint 5.0 roles (key + sub order) Owner-approved for every row in scope, or an agreed merge order that carries them (the `Record<RecipeId>` type gate) | **OPEN** (0 of 17) |
| SG-4 | OD-H5-P4-CHEESE decided, or the cheeseless rows are split off, or the release keeps the Hint 5.0 flag OFF | **OPEN** (H5-4 waits on the Owner) |
| SG-5 | The 7 W2-A family rows are on main and consistent with the HCG lane (a `garlic` / `black-olive` change is a watch item, not a blocker) | **OPEN** (branch only) |
| SG-6 | W2-A1 merged (8 ingredient rows, visuals) and rebased on main. `brazilian-calabresa` does not need it. | **OPEN** (no PR) |
| SG-7 | Technique and Cooking Steps: no dependency. The ≤ 6-tab gate passes. `cookingProfiles.ts` merge order against PR #295 is agreed. | **PASS** on authority; merge order **OPEN** |
| SG-8 | Implementation gates from the W2-A gate §11 exist as tests: ladder append and W1 sha pin, discovery uniqueness, DH4 topping-count re-audit at 34 recipes, e2e `/25` pins, Dinner / Lunch Rush | Implementation items, **not started** |
| SG-9 | Human Verification plan for the visible change (390×844 video, screenshots) | Required by the policy; **not started** |

## 12. Remaining Owner Decisions

These are queued, not made. The IDs are this audit's working labels.

| ID | Decision | Rows | Owner lane |
|---|---|---:|---|
| **OD-DA1-1** | Author `hintKeyToppingId` / `hintSubToppingOrder` for every DA-1 row (7 rows have no unique main), and whether the H5-0 §6.4 tie-break becomes the 172 guideline | 17 (9 in W2-A) | Hint 5.0 (#292) |
| **OD-DA1-2** | OD-H5-P4-CHEESE, and the merge order between Hint 5.0 and DA-1 | 8 (5 in W2-A) | Hint 5.0 (#292, H5-4) |
| **OD-DA1-3** | Authoring Gate for 12 new ingredient / paint-sauce rows (salami, pomegranate, tahini, miso-sauce, white-sesame, pine-nuts, green-pepper, cream-cheese, lemon, salmon, almond, grana-padano) | 8 | Owner / Wave 2 |
| **OD-DA1-4** | Recipe values (name, description, minCount, bakeTarget, reference) for the non-W2-A rows | 8 | Owner / Wave 2 |
| **OD-DA1-5** | An approved wave for the non-W2-A rows (OD-W2-3 covers only W2-A → W2-C → W2-D; W2-B is not in it) | 8 | Owner / Wave 2 |
| **OD-DA1-6** | `calabresa-argentina`: the NC-4 naming cluster with `brazilian-calabresa`, and the salami cluster | 1 | Owner + Taxonomy |
| **OD-DA1-7** | W2-A1 to main with a rebase from `7bb0116`, and the `cookingProfiles.ts` order against PR #295 | 9 | Wave 2 / Cooking Steps |
| **OD-DA1-8** | An approval path for the family rows of 8 topping ids (salami, pomegranate, white-sesame, pine-nuts, green-pepper, lemon, salmon, almond): they are **not queued in the HCG pack**. Also the `garlic` / `black-olive` watch, which the pack does not ask about. | 7 | **Taxonomy / HCG** (not decided here) |

## 13. Findings worth the Owner's attention

1. **B0 is empty for one reason.** Hint 5.0 authority is missing for all 17 rows. The roles are needed even while the Hint 5.0 flag stays OFF, as soon as both Hint 5.0 and DA-1 are on main.
2. **W2-A is authority-complete except Hint 5.0.** The 9 rows lack no taxonomy, recipe, art or progression decision.
3. **`brazilian-calabresa` is the smallest independent slice:** no new ingredient, no W2-A1 dependency, no taxonomy dependency other than the `black-olive` watch, and its only missing lane is Hint 5.0.
4. **Five W2-A rows are cheeseless.** They interact with OD-H5-P4-CHEESE, which H5-4 has not resolved.
5. **The 8 non-W2-A rows are not "data-only" in practice.** Each needs 1–3 new ingredient rows and their art, recipe values and a wave. B is a fair class for the engine axis, not for the authority axis.
6. **The HCG pack does not cover the B rows.** It queues the F=65 rows. The 8 PROPOSED topping families the B rows need are outside its questions, and no lane owns their approval yet.
7. **A stale line in the W2-A gate report** (description `OWNER_REQUIRED`) is superseded by the ledger (A3). It is worth correcting in that lane.

## 14. Non-goals / not changed

- No recipe, ingredient, `src`, e2e, CSS or test change. No progression change.
- No Hint 5.0, taxonomy, Technique or Cooking Steps change; no candidate is promoted to authority.
- PR #255, #275, #293 and #295 are untouched. The Authority Matrix branch and generator are untouched.
- No merge. **DA-1 is not implemented.**

**Verdict:** the preparation audit is complete. **STOP.** No DA-1 implementation.
