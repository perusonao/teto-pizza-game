# Discovery Hint 4.0 — 172 Recipe Ingredient Taxonomy: Fresh Audit (Lane C)

Parent Issue: **#253** (Discovery Hint 4.0, OD-DH4-4). Docs/data-only.

**Status: NOT an authority.** Every classification here is PROPOSED, NEEDS_REVIEW or UNKNOWN. This audit:
- changes no production code;
- leaves DH4-1 untouched (merged via PR #254; it is read only);
- does not implement DH4-2.

**Owner review (2026-09-27):** OD-TAX-1…9 are **approved** as design direction (§18). They do not promote any classification row to production authority. That needs a separate Human Classification Gate (OD-TAX-7).

Machine-readable audit: `docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json`.
Generator: `tools/ingredient_taxonomy_audit.py`. It is deterministic, docs tooling only, and not wired into CI. `--check` reports byte drift.

---

## 1. Audited main SHA and GitHub gate

| Item | State (fetched 2026-09-27) |
|---|---|
| `origin/main` (first audit) | `22658f7f2313264b686d299ea9fc11ba8679e8e5` (Merge PR #251) |
| `origin/main` (**re-audited**, §1.1) | `5a33d855674652ab3483c3cedb8815859e88ce6e` (Merge PR #254, DH4-1) |
| Issue #253 | OPEN. It is the parent issue for every DH4 slice. OD-DH4-4 requires the taxonomy to be a data model extensible to 105 / 172 and to Technique Discovery, with no singleton or near-singleton classes. |
| PR #254 (DH4-1) | **MERGED** 2026-09-27T10:28Z as `5a33d85` (head `057e387`). Read only; never changed by this audit. |
| PR #252 (Dinner DM-3R-2) | OPEN, head `5e217ea7`. Not touched. |
| PR #251 (H3-4) | MERGED 2026-09-27T10:03Z. It carries the DH4 Fresh Design. |
| Duplicate gate | An issue search for taxonomy / 172 / attribute family found **0 other issues**. This work belongs to #253 (OD-DH4-4), so **no new issue** is created (§18). |

### 1.1 Latest-main follow (re-audit on `5a33d85`)

| Check | Result |
|---|---|
| Latest `origin/main` | `5a33d855674652ab3483c3cedb8815859e88ce6e` |
| DH4-1 merge state | PR #254 MERGED. `src/data/ingredientTaxonomy.ts` and `deductionHint.ts` on main are **byte-identical** to the PR head `057e387` that the first audit read (empty `git diff`). |
| Diff between the audit branch and main | main added only the 7 DH4-1 files (src, tests, result report, audit JSON). This branch adds only the 3 files of this audit. **No shared file.** |
| Conflict | None. `origin/main` was merged into the audit branch cleanly. |
| Semantic overlap | None. DH4-1 owns the runtime 22-row table and the guard. This audit only reads them and proposes rows for ids that are not in the runtime catalog. |
| Generator source | It now reads the **merged** `src/data/ingredientTaxonomy.ts` from the working tree instead of the PR-head git object. It fails if DH4-1's family or group ids or labels differ from the audit's layers. They match exactly: 7 families and 4 groups. |
| `tools/ingredient_taxonomy_audit.py --check` | OK, no drift |
| Deterministic regeneration | Two regenerations gave the same SHA-256 (`4638137f…c833`) |
| Audit values | **Unchanged.** universeCounts, classCounts, singletonReport, dh4_1CompatibilitySimulation, intersection, recipeIdentity and humanReviewQueue are identical to the first audit. The ingredient rows are identical except for the `familySource` wording (open PR → merged). Only metadata changed: `auditedMainSha`, `firstAuditedMainSha`, `dh4_1ReadFrom` and `ownerDecisions`. |
| DH4-1 compatibility | Unchanged (§14). All 22 DH4-1 rows agree with the proposed families. |

## 2. Audited source files

| Source | Role in this audit |
|---|---|
| `src/data/ingredients.ts`, `src/data/recipes.ts` | Runtime: 29 ingredients, 25 recipes |
| `data/recipes/ingredient_master_catalog.json` | Catalog v2: 62 rows. Gives category, aliases and `mechanicDependency` |
| `docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json` | The **105-ingredient** universe and its unlock sequence |
| `docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` | The **101-target** pool (`targets.SHIPPED_KEEP`) |
| `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` | The 172 rows: identity sets, unresolved tokens, token traces, post/mid-bake evidence, required capabilities |
| `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` | Raw `ingredientsJa`, used for alias frequency |
| `tools/progression2_ingredient_canonicalizer.py` + `docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md` | **Existing canonicalization authority**: alias, ambiguity, registry and taxonomy-flag tables |
| `src/data/ingredientTaxonomy.ts`, `src/logic/discovery/deductionHint.ts` (main, merged PR #254) | The DH4-1 taxonomy (7 families, 4 groups, 22 topping rows) and its guard |
| `docs/reports/TETO_DISCOVERY-HINT-4_DEDUCTION-HINTS_Fresh-Design.md` §7 / §13 | The earlier 181-name keyword heuristic, which this audit replaces with authored rows |

**Existing authorities that were reused, not duplicated:**
- **Canonical ids and aliases** come from the canonicalizer. No new canonical id was created.
- **Family ids, group ids and labels** are DH4-1's own. The generator fails if any proposed family disagrees with a DH4-1 row, and **no disagreement exists**.
- **Categories** are taken from runtime, then the catalog, then the 172 spread-layer list. The generator fails on any disagreement with evidence, and **none exists**.

## 3. Ingredient universe counts (Audit A)

| Population | Count | Notes |
|---|---:|---|
| Runtime ingredients | **29** | sauce 3 / cheese 4 / topping 22 |
| Runtime recipes | 25 | |
| Progression universe | **105** | sauce 18 / cheese 16 / topping 71. All 29 runtime ingredients are inside it. |
| 101-target pool | 101 | 87 evidence-ready + 14 shipped overlay |
| 172 evidence rows | 172 | 120 have a complete identity set; 52 are incomplete |
| 172 canonical ids | **169** | Includes `pesto`, which comes from the sauce-family derivation |
| 172 unresolved tokens | **13** | Canonicalizer `ambiguous` (§4) |
| 172 name universe | **182** | 169 + 13. The DH4 Fresh Design's keyword heuristic counted 181. The 1-name difference is probably the derived pesto (not verified). |
| Catalog-only ids | 9 | breadcrumb, chili-oil, fig, mascarpone, nduja, provolone, speck, steak, teriyaki-sauce |
| In 105 but absent from the 172 evidence | 1 | cherry-tomato (runtime genovese only) |
| **Union of canonical ids** | **179** | sauce 31 / cheese 25 / topping 123 |

## 4. Canonicalization status

| Status | Ids |
|---|---:|
| RUNTIME_CANONICAL | 29 |
| CATALOG_CANONICAL (catalog 62, not runtime) | 36 |
| REGISTERED_NEW_ID (canonicalizer registry or Phase 0B name) | 113 |
| ID_WITHOUT_NAME_EVIDENCE | 1 (`ground-beef`: it has no Japanese name anywhere in the repo) |
| UNRESOLVED_AMBIGUOUS tokens (no id) | 13 |

**Alias findings.** The counts are raw `ingredientsJa` occurrences in the 172 evidence.

- **mushroom / きのこ.** 「きのこ」 appears **0 times** in the evidence. Only マッシュルーム (4) and ポルチーニ茸 (2) appear. There is no generic mushroom token to canonicalize. The only open mushroom question is whether truffle belongs in the family (§16).
- **shiso / 大葉.** 大葉 appears 6 times and しそ 0 times. The registry name しそ comes from the Phase 0B.3 long-tail list. 大葉 → shiso is a **likely_alias**, which is a judgment call but justified (same plant).
- **mozzarella.** モッツァレラチーズ appears 90 times and モッツァレラ 9 times. This is an orthographic equivalent, so it is exact and needs no review.
- **Cured meat (`meat.cured`).**
  - ハム 10, 生ハム 6, ソーセージ 13, スパイシーソーセージ 1 (ambiguous), サラミピカンテ 1. Plain サラミ appears 0 times: the `salami` id comes from a Phase 0B sample.
  - ウインナー appears 0 times: `wurstel` comes from a sample canonical id.
  - This makes a 4-way sausage-like cluster: sausage / wurstel / hot-dog / スパイシーソーセージ. It needs a canonicalization call.
- **Seafood.**
  - エビ 4 and ツナ 2 are clean.
  - The registry maps タラ → `salt-cod`, but plain タラ (cod) is not necessarily salted cod.
  - たらこ / 明太子 are two ids for near-identical roe.
- **Olive.** オリーブ (12 recipes) → `black-olive` is only a **likely_alias** because the colour is unspecified. It is the largest single confidence risk in the universe.
- **Chili.** 唐辛子 5, 赤唐辛子 1 and 青唐辛子 1 are all unresolved. They are separate from chili-oil / chili-powder / jalapeno.
- **Generic tokens.** 肉, チーズ (3 rows), ナッツ, ひき肉 (5 rows). These have a certain **family** but no id, so they are UNKNOWN (§16).

## 5. Current DH4 taxonomy assessment (DH4-1, merged PR #254)

DH4-1 has 7 families and 4 groups:
- **Families:** 肉 / 魚介 / 野菜・きのこ / 果物 / ハーブ・香味 / スパイス・薬味 / その他.
- **Groups:** 肉・魚介 / 野菜・果物 / 香り・薬味 / その他.
- **Coverage:** 22 runtime topping rows. Sauce and cheese are answered at category level.

| Finding | Assessment |
|---|---|
| Runtime 25 | Privacy is sound. The DH4-1 guard, not the table, is what protects the 3 runtime singleton families (fruit = pineapple, spice = capers, other = egg; §8). |
| 105 / 172 extension | **Every one of the 179 ids fits the 7 families without a new family id.** No proposed row contradicts a DH4-1 row. |
| Mature class sizes (172) | meat 17 · seafood 15 · vegetable 39 · fruit 10 · herb 8 · spice 12 · other 16. **No family has fewer than 8.** |
| 105 class sizes | meat 13 · seafood 11 · vegetable 24 · herb 8 · other 7 · spice 5 · **fruit 3** |
| Weak points | fruit is near-singleton at 105. spice depends on boundary calls: it drops to **3** if jalapeno and capers move out (§16). 「その他」 has low semantic value (§9). |

**Verdict on DH4-1:** it is a sound **L2 (display) layer**. It must not grow finer for display. Finer information belongs in an internal layer (§6).

## 6. Proposed hierarchical taxonomy (Audit B) — PROPOSED, not authority

```
L1 group    (display fallback, DH4-1)   protein | produce | aroma | other
L2 family   (display, DH4-1 ids/labels) meat seafood | vegetable fruit | herb spice | other
L3 subfamily (INTERNAL ONLY, never shown) e.g.
  meat      -> meat.cured (加工肉) · meat.fresh (精肉) · meat.poultry (鶏・鴨)
  seafood   -> seafood.fish · seafood.shellfish (貝・エビ・イカ) · seafood.roe (魚卵)
  vegetable -> fruiting · leafy · allium · root · stem-flower · mushroom · legume · pickled
  fruit     -> citrus · tropical · berry · orchard
  herb      -> herb.leaf · herb.allium (garlic)
  spice     -> spice.dried · spice.chili · spice.condiment (薬味)
  other     -> egg · nut-seed · sweet · starch · dairy (non-cheese) · seaweed
  sauce     -> tomato · oil-fat · cream-dairy · sweet · paste · asian-savory · condiment  (category-level in DH4)
  cheese    -> fresh · soft · semi · hard · blue · processed                            (category-level in DH4)
```

**Display ≠ data.** The ingredient row stores the finest layer (subfamily). The hint *displays* at most the family, and only when the k ≥ 2 guard passes. The guard can always coarsen further, to group, then category, then existence.

Storing L3 has three uses:
- it lets DH4-1 derive L2 and L1 (a subfamily determines its family and group);
- it feeds future Cooking Steps or Dex copy;
- it lets a later owner-approved level be added without re-authoring rows.

Sauce and cheese families are also stored internally only. This is DH4-1's rule, "their category already is the attribute", and it is kept.

## 7. Multi-axis model (Audit E)

| Axis | Owner (authority) | Stored on the ingredient row? | Example (pepperoni) |
|---|---|---|---|
| Identity (family / subfamily) | Ingredient catalog | **Yes** | meat / meat.cured |
| Game category | Ingredient catalog (existing field) | Yes (already) | topping |
| Flavor / property | Ingredient catalog, optional, internal | Yes (`flavorTags`, PROPOSED) | spicy |
| Role (base spread / 2nd spread / scatter / garnish) | **Recipe × ingredient** (Cooking Steps) | **No** | scatter |
| Timing (pre / mid / post-bake) | **Recipe × ingredient** (Cooking Steps / Technique) | **No** | pre-bake |
| Preparation form (sliced / grated / paste / drizzle) | Recipe × ingredient or technique | **No** | sliced |

**Evidence that role and timing are not ingredient properties:**
- `tomato-sauce` is the base spread in 45 pool recipes and a **post-bake** layer in one catalog recipe (`finishingIngredients`).
- `prosciutto-crudo` and `arugula` are post-bake in some catalog recipes and plain scatter in others.
- `eel` has an unresolved mid/post-bake timing in its 172 row.
- Catalog v2 already puts `mechanicDependency: postBakeFinishing` on 12 ingredient rows. That is a **boundary leak in existing data**: timing written on the ingredient. Keep it as a catalog hint. It must not become taxonomy.

## 8. Singleton / near-singleton report (Audit C)

**L2 family (topping)**

| Population | size 1 | size 2 | size 3 |
|---|---|---|---|
| runtime 29 | fruit {pineapple}, spice {capers}, other {egg} | — | seafood {anchovy, clam, tuna} |
| 105 | — | — | fruit {lemon, pineapple, pomegranate} |
| 172 / union | — | — | — |

**L3 subfamily (internal).** It is too fine for display:
- runtime: 15 singletons;
- 105: 13 singletons and 12 pairs;
- 172: 5 singletons (cheese.blue = gorgonzola, cheese.soft = brie, herb.allium = garlic, other.egg = egg, other.seaweed = nori), 8 pairs and 11 triples.

**Label ≈ ingredient name (must never be a display class):**
- たまご = egg in every population.
- きのこ has 1 member at runtime and 105, and 3 at 172.
- 海藻 = のり.
- 魚卵 = 3 members.
- にんにく-as-香味 (herb.allium) = garlic.

DH4-1 already folds egg and mushroom correctly.

**Recipe reach (172, complete rows):** vegetable 78 · meat 50 · herb 45 · seafood 19 · other 18 · fruit 11 · spice 7.
- Spice and fruit are rare in recipes. A reserve of those families is uncommon, which limits the practical exposure.

## 9. Japanese UI terminology (Audit D)

Three kinds of term must not be mixed:
- **WHAT IT IS** (identity): 肉 / 魚介 / 野菜・きのこ / 果物 / ハーブ / スパイス / チーズ / ソース.
- **HOW IT IS USED** (role and timing): 仕上げ / 焼いたあとにのせる / 塗る. These are **not** identity labels.
- **FLAVOR**: ピリ辛 / 甘い / しょっぱい.

| Label | Natural? | Note |
|---|---|---|
| 肉 (「肉の仲間」, casual 「肉系」) | ✓ | Clear, with a large class |
| 魚介 | ✓ | Clear. Seaweed (のり) is not 魚介 to most players, so keep it out (§16). |
| 野菜・きのこ | ✓ | Good. It removes the きのこ singleton. |
| 果物 | ✓ | Clear, but near-singleton at 105 |
| ハーブ・香味 | △ | にんにく reads as 香味野菜 or 薬味 to many players. It overlaps with スパイス・薬味 (わさび, 青ねぎ, 柚子胡椒). |
| スパイス・薬味 | △ | It mixes dried spice (クミン), condiment (わさび) and pickled bud (ケッパー). 岩塩 is not a スパイス. |
| その他 | ✗ as a hint | Semantically weak: 「その他の仲間があるよ」 tells the player only "not in the other six". Candidate copy: 「ちょっと変わった材料があるよ」. It is passed to the DH4-2 UI audit; the final wording is a DH4-2 Owner Decision (**approved OD-TAX-8**). |
| 仕上げ系 / 乳製品系 | Do not use | Role, and non-cheese dairy (2 ids) respectively. Both fail the boundary or the size rule. |

**Aroma group alternatives (still open; not decided by OD-TAX-1…9, so these stay in the Human Review Queue under OD-TAX-7):**
- **(a)** Keep DH4-1 as is.
- **(b)** ハーブ (leafy herbs only) + 薬味・スパイス, with garlic moved to 野菜・きのこ.

(b) reads more naturally. It costs herb 1 member (8 → 7 at 172) and needs a data-only change to one DH4-1 row, which is an Owner decision and **not done here**.

## 10. Runtime 25 coverage

- **Topping families:** all 22 runtime toppings have a DH4-1 family. The proposed rows reproduce them exactly.
- **Answer levels:** the DH4-1 guard was re-implemented and every runtime (recipe, ingredient) pair was treated as a hypothetical reserve, with MATURE owned = all 29. Result:
  - toppings: family 41 · group 6 · category 3;
  - sauce: category 25;
  - cheese: category 20 · existence 4 (quattro-formaggi uses all 4 cheeses).
- **NEEDS_REVIEW rows:** 3 of 29 runtime rows, **black-olive, capers and garlic**. They are the only boundary calls that would change a DH4-1 row.

## 11. 105-ingredient scalability

- **Classification:** 83 PROPOSED and 22 NEEDS_REVIEW (17 topping, 3 sauce, 2 cheese).
- **Families:** all 7 have at least 3 members, but fruit (3) and spice (5) are near-singleton.
- **DH4-1 guard over the 101-pool.** Every (recipe, ingredient) pair is a hypothetical reserve (417 pairs).
  - **EARLIEST** = owned exactly as the Phase 3/4 sequence first makes the recipe reachable:
    - toppings: family 208 · group 5 · category 14 · existence 1;
    - cheese: category 90 · existence 11;
    - sauce: category 78 · existence 10.
  - **MATURE** = all 105 owned: every topping answers at **family** (228/228).
  - Coarsening is concentrated early. This matches the Fresh Design's finding that inventory size drives the risk.
- **What if the internal subfamily were an extra first level?** It would pass k ≥ 2 for 155 early and 194 mature topping pairs. So it *could* be privacy-safe per answer, but it multiplies the intersection surface (§13). **Keep it out of display in DH4.**

## 12. 172-recipe scalability

- **Classification:** 169 ids (125 PROPOSED, 44 NEEDS_REVIEW) plus 13 UNKNOWN tokens.
- **Family sizes** at 172 are all ≥ 8 (§5). OD-DH4-4's "no singleton or near-singleton" is met at 172 **for L2 only**.
- **What is left:**
  - 52 incomplete rows. Their unresolved tokens (唐辛子 ×5, ひき肉 ×5, チーズ ×3, …) cannot get taxonomy rows until they are canonicalized. The **family** of most of them is already certain (meat, cheese, spice), so they will not create new families.
  - No new family id is needed at 172. Every addition is one data row.

## 13. Intersection / privacy analysis (Audit E + F)

**Cross-axis singletons (topping cells holding exactly 1 ingredient):**

| Axes sold together | 105 | 172 |
|---|---|---|
| family | 0 | 0 |
| family + spicy | 1 (**pepperoni** = 「肉 + ピリ辛」) | 2 (kimchi, mentaiko) |
| family + sweet | 1 (lemon) | 2 (cinnamon, eel) |
| family + post-bake evidence | 2 (prosciutto-crudo, wasabi) | 3 |
| family + spicy + post-bake | 4 | 5 |
| subfamily | 10 | 3 |
| subfamily + spicy | 13 | 8 |

**Conclusion:**
- The single-axis k ≥ 2 check is **not sufficient** once more than one axis is sold about the same ingredient.
- Example: 「肉の仲間」 + 「ピリ辛」 names pepperoni in the 105 universe, and the combination is a singleton with no owned-state help.
- **FR-3 (future requirement):** if a second attribute axis is ever sold about the same reserve, k must be computed on the **joint** class (the AND of every sold predicate, over the same privacy worst-case universe).
- DH4-1 sells exactly one attribute answer about the reserve. Its worst-case universe already excludes every other recipe ingredient, so material facts and the structure total add nothing for the reserve. **No change is needed for DH4-1.**

**Recipe identity (Audit F).** The table shows the share of recipes made unique by each signature, over the population.

| Signature | runtime 25 | pool 101 | 172 complete (120) |
|---|---:|---:|---:|
| total ingredient count | 4 % | 2 % | 1 % |
| total + topping count | 20 % | 6 % | 4 % |
| family set | 44 % | 17 % | 19 % |
| **family multiset (full signature)** | **60 %** | **57 %** | **51 %** |
| family multiset + techniques | 60 % | **74 %** | **75 %** |
| subfamily multiset | 92 % | 82 % | 79 % |

- A **single** family fact ("contains 肉") leaves at least 5 pool recipes (min) and 40 (median) consistent.
- **Composition closure:** if the full family signature were sold, how many ingredient sets over the owned inventory fit it?
  - MATURE 105: never 1 (median 34,944).
  - **EARLIEST: 5 recipes are pinned to one composition.** They are margherita, bismarck, breakfast-pizza, meat-lovers and aussie. 8 recipes have 3 or fewer compositions.
- **Rule confirmed:** never sell a taxonomy signature. Sell **one fact at a time**, about one unknown ingredient.
- Techniques add identity on top of families: 57 % → 74 % unique in the pool. That is another reason to keep technique facts out of the attribute family.

**FREE LEAK vs PAID INFERENCE (unchanged from OD-DH4-10):**
- **FREE LEAK (forbidden):** anything the pre-purchase UI reveals, such as the answer granularity, a family's existence or class sizes.
- **PAID INFERENCE (allowed):** closure the player derives from purchased facts.
- This audit adds one more rule: an **axis combination** sold across purchases counts as one joint answer (FR-3).

## 14. DH4-1 compatibility (Audit H)

| Question | Answer |
|---|---|
| Can 105 / 172 be supported by data only? | **Yes.** Add rows to `TOPPING_FAMILY_ROWS` (or a future catalog field) when each ingredient lands in `src/data/ingredients.ts`. No new `AttributeFamilyId` or `AttributeGroupId` is needed. |
| Guard, fallback chain, Rule W, `privacyWorstCaseCandidates` | Unchanged. The simulation in §11 runs the same algorithm over 105. |
| Ingredients without a row | DH4-1 already answers at category level, never guessed. That is correct for NEEDS_REVIEW and UNKNOWN rows. |
| **FR-1** internal subfamily as a display level | Would need a new level in `reserveLevels`. That is an algorithm change. **Not recommended.** Recorded as a future requirement only. |
| **FR-2** sauce and cheese families | Would need the `category === "topping"` gate lifted. That is an algorithm change. It becomes useful at about 31 sauces / 25 cheeses, which is still category-level today. |
| **FR-3** joint-axis k | Needed only if a second attribute axis is sold (§13). |
| **FR-4** coverage test | When the runtime catalog grows, add a test that every runtime topping has a family and every family has at least N members in the runtime catalog. Before that, singleton families rely on the guard (as documented in DH4-1). |

DH4-1 (merged PR #254) is not touched. None of FR-1 to FR-4 blocks DH4-1 or DH4-2. By OD-TAX-9, none of them is in DH4-2's required scope.

## 15. Technique Discovery boundary (Audit G)

| Belongs to **ingredient taxonomy** ("what it is") | Belongs to **Cooking Steps / Technique Discovery** ("how it is used") |
|---|---|
| family, subfamily, group | post-bake topping / finishing (`LATE_ADDITION`, `postBakeFinishing`) |
| game category (sauce / cheese / topping) | multi-spread (`MULTI_SPREAD_LAYER`), no-sauce base |
| optional flavor tags (internal) | special cut, pan / boat shape (`PAN_BAKE`, `DOUGH_SHAPE_TARGET`) |
| | fold / enclose / piadina (`ENCLOSE`, `LAMINATE`), `ZONED_PLACEMENT`, `FRY_COOK` |

- An ingredient row **may** carry an optional *capability* hint for tooling, such as "has been seen post-bake". Evidence already exists for this: catalog `mechanicDependency` and 172 `postBakeFinish`.
- It **must not** carry a player-facing class derived from that hint.
- The fact grammar already separates `attr:` (identity) from the future `finish:` / `tech:` / `pan:` / `shape:` kinds (OD-H3-12).
- Truffle, honey, arugula and prosciutto-crudo keep their identity family. Their finishing use is a technique row.

## 16. Human Review Queue

There are **60 entries**: 47 NEEDS_REVIEW ids and 13 UNKNOWN tokens. The full list is in the `humanReviewQueue` of the JSON, one row each with the proposed class and the reason. The main clusters:

| Bucket | Entries |
|---|---|
| **Runtime-affecting** (would change a DH4-1 row) | garlic (herb vs vegetable.allium), capers (spice vs vegetable.pickled), black-olive (vegetable vs fruit or condiment; オリーブ is only a likely_alias) |
| Herb vs vegetable vs spice | green-onion, fennel, jalapeno, aji-amarillo, zaatar, rock-salt |
| Condiment vs topping vs spread | wasabi, umeboshi-paste, mustard, yuzu-kosho, balsamic-vinegar, chutney, melted-butter, kebab-sauce, curry-ketchup |
| Meat aliases / cuts | beef · steak · ground-beef · ひき肉 · 肉; sausage · wurstel · hot-dog · スパイシーソーセージ; salami · spicy-salami; nduja (spread salami); liver-pate |
| Prepared / composite | hot-dog, chicken-tikka, peking-duck, baked-beans, french-fries |
| Seafood / seaweed | nori (seafood vs other vs condiment), bonito-flakes (seafood vs 薬味), mentaiko vs cod-roe, タラ → salt-cod mapping |
| Cheese vs dairy | cashew-cheese (plant-based), catupiry, mascarpone, sour-cream, condensed-milk |
| Pickled / fermented / legume | kimchi, sauerkraut, pickles, natto |
| Near-alias produce | red-cabbage / cabbage, puntarelle / chicory, avocado (vegetable vs fruit), mochi |
| Finishing | truffle (mushroom identity, finishing use) |
| Unresolved tokens (UNKNOWN) | 肉, ひき肉, スパイシーソーセージ, チーズ, プロヴェルチーズ, チーズソース, ホワイトソース, カレーソース, 唐辛子, 赤唐辛子, 青唐辛子, 青のり, ナッツ |

**Sensitivity:**
- If jalapeno → vegetable and capers → vegetable.pickled, then spice at 105 = {paprika-powder, wasabi, zaatar} (3), which is near-singleton.
- If garlic → vegetable, then herb at 172 = 7.
- The three runtime calls should therefore be decided **together** with the spice-family label.

## 17. Machine-readable audit

`docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json`

**Per-ingredient rows (179), with these fields:**
- `id`, `nameJa`, `aliasesObserved`, `likelyAliasNames`, `canonicalizationStatus`
- `category` + `categorySource`
- `broadGroup`, `family` + `familySource` (DH4-1 or proposed), `subfamily`, `flavorTags`
- `classificationStatus` (PROPOSED | NEEDS_REVIEW), `confidence`, `note`
- `evidence`:
  - `runtime`, `runtimeRecipeCount`
  - `universe105`, `pool101RecipeCount`
  - `evidence172RecipeCount`, `catalog62`
  - `postBakeEvidenceRows`, `midBakeEvidenceRows`, `catalogMechanicDependency`

**Other sections:**
- `unresolvedTokens` (13): each carries `indicativeFamily` and `classificationStatus: UNKNOWN`.
- `layers`, `axes`
- `universeCounts`
- `classCounts`: the per-node size for runtime / 105 / 172 / union, plus the recipes containing it (the privacy class sizes).
- `singletonReport`
- `dh4_1CompatibilitySimulation`
- `intersection`, `recipeIdentity`
- `humanReviewQueue`
- `ownerDecisions`: OD-TAX-1…9 and FR-1…4 / HCG, with status `APPROVED_BY_OWNER_AS_DESIGN_DIRECTION (not production authority)`.
- `auditedMainSha` (`5a33d85`), `firstAuditedMainSha` (`22658f7`), `dh4_1ReadFrom` (merged PR #254)

The generator refuses to write:
- when an id has no row, or a row has no evidence (no silent guess);
- when a proposed category disagrees with the evidence;
- when a proposed family disagrees with DH4-1.

## 18. Owner Decisions (approved 2026-09-27)

The Owner approved OD-TAX-1…9 as below. The IDs are the Owner's. They **replace** the numbering of the proposal table in the first audit revision. They are design decisions, not production authority.

| ID | Owner Decision |
|---|---|
| **OD-TAX-1** | Adopt the 3-layer taxonomy: **L1 = group, L2 = family, L3 = subfamily**. |
| **OD-TAX-2** | Keep DH4-1's **7 family ids**. Do not rebuild the existing DH4-1 algorithm for the taxonomy. |
| **OD-TAX-3** | The player may be shown **at most the L2 family**. L3 subfamily is internal metadata only. It is not shown or sold as a hint now. |
| **OD-TAX-4** | Keep **k ≥ 2**. If a future hint combines several axes, k ≥ 2 is re-checked on the **intersected** candidate set, not per axis. This is a future requirement (FR-3). DH4-1 is not changed. |
| **OD-TAX-5** | Never show or sell the **whole taxonomy signature**. Discovery Hint stays **one fact per hint**. |
| **OD-TAX-6** | **Ingredient identity** is separate from **cooking role / timing / technique**. Late topping, post-bake, multi-spread, shape and special cut are not ingredient families. They belong to Cooking Steps / Technique Discovery. |
| **OD-TAX-7** | The **47 NEEDS_REVIEW** and **13 UNKNOWN** entries are not decided by guess. They stay in the Human Review Queue. Promoting the 105 / 172 taxonomy to production authority needs a separate **Human Classification Gate**. |
| **OD-TAX-8** | The internal `other` family / group ids may stay for compatibility. Player copy must not use a weak label such as 「その他系」. The candidate 「ちょっと変わった材料があるよ」 goes to the **DH4-2 UI audit**. The final wording is a DH4-2 Owner Decision. |
| **OD-TAX-9** | Subfamily hints, sauce families, cheese families and multi-axis hints are **not** in DH4-2's required scope. They are recorded as future requirements. |

**Future requirements (recorded, not scheduled):**
- **FR-1:** L3 subfamily as a display level (OD-TAX-3, OD-TAX-9).
- **FR-2:** sauce and cheese families (OD-TAX-9).
- **FR-3:** joint-axis k ≥ 2 on the intersected candidate set (OD-TAX-4, OD-TAX-9).
- **FR-4:** a runtime family coverage test when the runtime catalog grows.
- **HCG:** the Human Classification Gate (OD-TAX-7).

**First-revision proposals that the approved decisions do not settle.** They are left open. They are not assumed.

| First-revision proposal | State after Owner review |
|---|---|
| Runtime boundary calls: garlic, capers, black-olive, and the aroma-group labels (§9 a / b) | **Open.** They stay in the Human Review Queue (OD-TAX-7). DH4-1's merged rows stay as they are. |
| Where the family lives (DH4-1 table now, or a catalog field later) | **Open.** The DH4-1 table remains the only runtime source. |
| Canonicalization clusters (beef / steak / ground-beef / ひき肉, the sausage cluster, salami / spicy-salami, cod-roe / mentaiko, オリーブ → black-olive, タラ → salt-cod, cabbage / red-cabbage, chicory / puntarelle) | **Open.** Part of the Human Classification Gate (OD-TAX-7), through the existing canonicalizer tables |
| Near-singleton fruit (3) and spice (≤ 5) at the 105 stage | **Open** as a note. The k ≥ 2 guard (OD-TAX-4) covers privacy. |
| Issue handling | **Settled by the Owner's instruction:** tracked under **#253**, no new issue. |

## 19. Recommended implementation phase

1. **Now:** nothing to implement. DH4-1 is merged and unchanged. DH4-2 proceeds without taxonomy scope (OD-TAX-9). It receives only the 「ちょっと変わった材料があるよ」 copy candidate (OD-TAX-8).
2. **Human Classification Gate (OD-TAX-7):** work through the Human Review Queue and the canonicalization clusters. If the Owner changes a runtime boundary (garlic / capers / black-olive), a tiny data-only follow-up (**DH4-T1**) changes at most 3 DH4-1 rows plus the DH4-1 audit snapshot.
3. **With each Progression 2.0 ingredient batch** (when ingredients are added to `src/data/ingredients.ts`):
   - add the family row in the same PR, from this audit's PROPOSED rows;
   - resolve its Human Review Queue entries first;
   - add the FR-4 coverage test.
4. **Later, only by a new Owner decision:** FR-1 (subfamily display), FR-2 (sauce / cheese families), FR-3 (a second axis).

## 20. Non-goals

- No change to production runtime code, `src/**` (including the merged DH4-1 files), the reducer, persistence, HintSheet, `App.css`, Dinner, PR #243 or PR #252.
- No DH4-2 implementation, no prices, no UI.
- No new canonical ids, no change to canonicalizer tables, no ingredient added to any catalog.
- No classification promoted to authority. PROPOSED rows are proposals.
- No merge to main. No new issue.

---

## Final verdict

**A. TAXONOMY OWNER DECISIONS RECORDED — READY FOR DOCS PR REVIEW**

- **Owner decisions:** OD-TAX-1…9 are recorded here (§18) and in the audit JSON (`ownerDecisions`). They are design direction, not production authority.
- **Latest main:** the re-audit on `5a33d85` (DH4-1 merged) gave the same audit values, with no conflict and no semantic overlap (§1.1).
- **DH4-1:** unchanged. Its 7 family and 4 group ids and labels match this audit exactly.
- **Still open (by design):**
  - the Human Review Queue (47 NEEDS_REVIEW + 13 UNKNOWN);
  - the canonicalization clusters;
  - the garlic / capers / black-olive boundary.

  All of them wait for the Human Classification Gate (OD-TAX-7). They block neither DH4-2 nor any current slice.

<details><summary>First-revision verdict (audit on <code>22658f7</code>)</summary>

A. TAXONOMY DESIGN READY FOR OWNER DECISIONS. The design was ready, and the 105 / 172 data rows needed human classification (B-type caveat).
</details>
