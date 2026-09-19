# TETO Recipe Master Catalog — Design SSOT (candidate, v2, 160-scale data-first pass)

Status: **research/data artifact, not wired into `src/**`** — READ-ONLY design task
Audited `main` SHA: `8918fe4bd93816b0acefe4a35106fa1a4e8653e2`
Companion report: `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md`
Companion data: `data/recipes/pizza_master_catalog.json`,
`data/recipes/ingredient_master_catalog.json`, `data/recipes/gameplay_mechanic_master.json`
Companion tooling: `tools/validate_recipe_catalog.py` (docs/data-only, not wired into CI)
Predecessor design: `docs/design/TETO_RECIPE-EXPANSION-20.md` (kept, not deleted — see its
own preface note; this document supersedes its *catalog structure*, not its analysis, most
of which is carried forward here)

This document does not change `docs/design/PIZZA_GAME_SSOT.md`, Chapter 1's 7 recipes, or the
Economy & Progression 1.0 design. It runs independently of the EP1 Recipe Unlock foundation
implementation in progress in another session. Nothing here is wired into `src/**`.

## 0. What changed from the previous (20-recipe-first) pass

The task driving this document changed mid-session from "design the next 20 recipes" to
**"build the full candidate dataset first, then derive implementation order from analysis."**
Per that instruction:

- Nothing from the prior pass was discarded. Every recipe candidate, ingredient, alias,
  ambiguity note, and implementation-class judgment from
  `docs/design/TETO_RECIPE-EXPANSION-20.md` is carried into this catalog (all 13 previously
  "selected" candidates plus the 3 previously "deferred" ones — `prosciutto-e-funghi`,
  `romana`, `fugazzeta` — are present here with `gameDesignStatus` reflecting their prior
  disposition).
- The catalog was then substantially widened (7 Chapter-1 + 16 Chapter-2-era entries → **53
  total catalog entries, 51 viable**) using the same general-culinary-knowledge, no-PIZZA DB-
  copying discipline described in §2 below, specifically to make ingredient/mechanic-usage
  analysis meaningful (a 20-recipe sample is too small to reveal real reuse patterns).
- The "which 13/20 do we build first" question is **no longer answered by design judgment
  alone** — it's answered in the companion report by ranking every candidate by actual
  computed new-ingredient-cost and new-mechanic-cost against the full 51-recipe dataset (see
  report §"Derived implementation roadmap"). The numbers in that report come from
  `tools/validate_recipe_catalog.py`'s sibling analysis script's direct computation over the
  committed JSON, not from manual counting.

## 1. Catalog purpose

Prior sessions referenced "160 canonical pizzas / 181 unique ingredients" from PIZZA DB
(pizzadb.jp) research, but `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`
(read-only audit, verdict D) established that the underlying catalog files were **never
committed to this repository** — only a two-line prose summary survived, and even that was
later deleted. PR #79 (`claude/recipe-master-catalog-1j9jrb`, open) attempted fresh pizzadb.jp
research and found the site (and every other external domain tested) blocked at the network
level; it catalogued the current 7 recipes as a source-tracked baseline instead.

This session **re-confirmed the same network block** (a direct `en.wikipedia.org` fetch
attempt this session returned `EGRESS_BLOCKED`, matching PR #79's finding across many domains
— see the companion report's Source Limitations section). This catalog therefore does the
same thing PR #79 did, at larger scale: it does **not** reconstruct the 160/181 figures from
memory or from PIZZA DB. It builds a **Fresh Recipe Master Catalog** from general, widely-
corroborated culinary knowledge (the kind of fact repeated across many independent, mainstream
sources — that Margherita is tomato/mozzarella/basil, that Calzone is a folded pizza, that
prosciutto crudo is added after baking), explicitly separates that from PIZZA DB content, and
is honest about what has and hasn't been independently verified this session.

**The illustrative ceiling remains ~160, but this catalog does not claim to reach it.** It
reaches **51 viable recipe candidates** (see `catalogEntryCount`/`viableEntryCount` in the
JSON). The gap to 160 is not filled with fabricated entries — see report §"160-scale gap."

## 2. Source policy compliance (PIZZA DB)

Per `PIZZA_GAME_SSOT.md` §1: PIZZA DB (pizzadb.jp) is *inspiration/reference for UX and
world-view only*. Its text, images, and structured data are never copied into this game. This
catalog:

- Copies no PIZZA DB text, image, or structured data (the site was inaccessible this session
  — see report).
- Treats every candidate as independently designed game data, checked against general/
  independent culinary classification, not a single proprietary catalog.
- Labels every entry's `verificationStatus` honestly (§5) — nothing is marked `verified`
  against an external source this session; `verified_internal` is used only for the 7
  recipes that are literally already shipped in `src/data/recipes.ts`.
- Flags real-world naming ambiguities explicitly (§6) rather than silently resolving them.
- Explicitly rejects near-duplicate padding (§7) rather than inflating the count.

## 3. Schema

### 3.1 `pizza_master_catalog.json` — per-recipe record

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable catalog id (kebab-case, matches `RecipeId` in `src/data/recipes.ts` for the 7 shipped recipes). |
| `nameJa` / `nameOriginal` | string | Japanese display name / name in country of origin or common international name. |
| `aliases` | string[] | Alternate/confusable names. Never auto-merged with another entry. |
| `regionOrStyle` | string | Best-available country/region/style association. |
| `descriptionShort` | string | Free-text design note — kept as **game-design commentary**, not a factual claim. |
| `sauce` | string \| null | Ingredient id of the base sauce, or `null` for sauceless/composite recipes. |
| `ingredients` | string[] | Full resolved ingredient id set (sauce + cheese + toppings), resolvable against `ingredient_master_catalog.json`. |
| `optionalIngredients` | string[] | Reserved for future use (empty in this pass — no candidate needed optional-ingredient modeling yet). |
| `finishingIngredients` | string[] | Subset of `ingredients` that require `postBakeFinishing` (or another post-bake mechanic) rather than ordinary pre-bake placement. |
| `bakeProfile` | `{start, end}` \| null | Illustrative bake-target range, `null` for recipes whose bake profile is derived from other recipes (e.g. `mezza-e-mezza`) or not yet designed. |
| `mechanics` | string[] | Baseline (`spread`/`scatter`, present on nearly every recipe) plus any non-baseline mechanic ids from `gameplay_mechanic_master.json`. |
| `sourceReferences` | string[] | `internal://...` for the 7 shipped recipes; `general_culinary_knowledge (unverified...)` for every candidate — **never** a fabricated pizzadb.jp URL. |
| `verificationStatus` | enum | **Required field.** See §5. |
| `implementationClass` | `A`\|`B`\|`C`\|`D`\|`E` | See §4. Factual/mechanical judgment, kept separate from `gameDesignStatus`. |
| `difficulty` | 1–5 | Design judgement. |
| `progressionTier` | `starter`\|`early`\|`mid`\|`late`\|`master` | Design judgement (this pass's tier field; see report for why final Chapter assignment is analysis-derived, not identical to this per-recipe tier label). |
| `gameDesignStatus` | `shipped`\|`candidate`\|`deferred` | Whether this entry is already in production, an open candidate, or explicitly parked. |
| `currentGameRecipe` | boolean | `true` for the 7 recipes in `src/data/recipes.ts` today. |
| `rejectedDuplicateOf` | string \| null | Set only when `verificationStatus == "rejected_duplicate"`; names the canonical entry (or ingredient combination) this one duplicates. |
| `newIngredientsIntroduced` | string[] | Bookkeeping only — which new ingredients this recipe is the *first* catalogued user of. **Not** used for cost analysis (see §0 and the report) — cost analysis uses the recipe's full ingredient set minus the existing 14, because a later recipe reusing an already-introduced ingredient still needs that ingredient to exist. |

`gameDesignStatus`/`implementationClass`/`difficulty`/`progressionTier` are kept in
clearly-separate fields from the factual fields above them (name, region, ingredients,
sources), per the task's explicit instruction to separate recipe fact from game-design
judgment.

### 3.2 `ingredient_master_catalog.json` — per-ingredient record

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Matches `Ingredient.id` in `src/data/ingredients.ts` for the 14 existing ingredients. |
| `nameJa` / `nameOriginal` | string | Display names. |
| `aliases` | string[] | Known alternate names/spellings — used to prevent duplicate ingredient registration (e.g. a future "mozzarella cheese" entry must resolve to `mozzarella`, not become a new id). |
| `category` | `sauce`\|`cheese`\|`topping` | Matches `IngredientCategory` in `src/data/ingredients.ts`. |
| `placementType` | `spread`\|`scatter` | Matches `Ingredient.placement`. Notably **independent of category** — e.g. `nduja` is a `topping` applied via `spread`, reusing the existing spread operation with zero new mechanic. |
| `inventoryUnit` | `use`\|`piece` | Derived from `placementType` (spread→use, scatter→piece), consistent with the already-shipped Economy 1.0 inventory unit model. |
| `usedByRecipeIds` / `usedByRecipeCount` | string[] / number | **Derived**, cross-referenced from the recipe catalog — never hand-maintained. Validated by `tools/validate_recipe_catalog.py`. |
| `existingInGame` | boolean | `true` for the 14 shipped ingredients. |
| `visualDistinctiveness` | 1–5 \| null | Design judgment (null for existing ingredients — not re-litigated). |
| `implementationCost` | string | `"none (shipped)"` or `"new ingredient data row"` — this pass found no candidate that needed more than a data row (no ingredient required new *code*, only new mechanics do, tracked separately per-recipe). |
| `reusePotential` | `low`\|`medium`\|`high`\|`n/a` | Design judgment, used for the cost-warning flags in the report. |
| `mechanicDependency` | string \| absent | Set when this ingredient's real-world use requires a specific mechanic (almost always `postBakeFinishing`) to be built before the ingredient is meaningful. |

### 3.3 `gameplay_mechanic_master.json` — per-mechanic record

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Mechanic id. `spread`/`scatter` are the two existing/shipped baseline operations. |
| `label` | string | Japanese display label. |
| `status` | `existing_shipped`\|`gap_not_covered_by_any_new_candidate`\|`new_required` | |
| `recipeCount` | number | How many viable catalogued recipes depend on this mechanic. **This is the headline efficiency signal** — see report. |
| `implementationClass` | `C`\|`D` \| absent | Rough engineering-size judgment for mechanics that aren't baseline. |

## 4. Implementation classes

| Class | Meaning |
|---|---|
| A | Zero new ingredients, zero new mechanic — by construction, only the 7 shipped recipes qualify. |
| B | One or more new ingredients, but only `spread`/`scatter` placement — no new game logic. |
| C | A small, scoped extension of an existing operation (this pass found exactly one: `stuffed-crust`'s ring-only stuffing, smaller in scope than a full fold). |
| D | A genuinely new operation not in the current Making flow (`postBakeFinishing`, `quadrantPlacement`, `halfAndHalfSplit`, `foldDough`, `stuffedDough`, `specialShapePan`, `layeredReverseOrder`, `ringPlacement` is actually C not D — see above). |
| E | Deferred/rejected for *design* reasons (naming ambiguity, near-duplicate), independent of engineering cost — some Class-E recipes would be technically trivial to build (`romana`, `ny-style`) but are parked for identity reasons, not cost reasons. This distinction matters: don't conflate "hard to build" with "not worth building yet." |

See the companion report for the exact computed count per class (§"Implementation Class
counts") — reproduced from `tools/validate_recipe_catalog.py`'s sibling analysis, not
hand-tallied.

## 5. Verification status (required field, never silently upgraded)

| Status | Meaning |
|---|---|
| `verified_internal` | The 7 recipes already shipped in `src/data/recipes.ts` — verified against the actual production source, not against pizzadb.jp. |
| `game_design_candidate` | Real, well-established dish per general culinary knowledge (multiple independent, mainstream sources would agree on its core ingredient set), not independently source-checked this session. |
| `verification_pending` | Real dish, but either (a) fusion/less-standardized (e.g. `philly-cheesesteak`), (b) carries a specific factual claim this session couldn't independently confirm (e.g. `alla-norma`'s pizza-vs-pasta provenance), or (c) would benefit from an external source check once access is available. |
| `deferred` | A real, distinct dish, held back from the "ready to implement" set for a **design** reason (naming ambiguity, mechanic redundancy) — not a factual-accuracy reason. |
| `rejected_duplicate` | Considered and explicitly rejected as a near-duplicate of an already-catalogued recipe or a straight combination of two others — recorded (not deleted) specifically to stop it from being re-proposed later without this reasoning being visible. |

No entry is `verified_internal` or otherwise treated as externally verified without an actual
external-source check having been performed and logged in that entry's `sourceReferences`.

## 6. Naming ambiguities and dedup discipline (carried forward + expanded)

All ambiguities recorded in the prior `TETO_RECIPE-EXPANSION-20.md` pass are preserved here
(Marinara/pasta-sauce, Genovese/ragù, Quattro Formaggi/Quattro Stagioni, Napoletana/Romana,
Vegetariana/Ortolana, prosciutto crudo/cotto, Fugazza/Fugazzeta, Diavola/Pepperoni visual
closeness). New ones found while widening the catalog:

- **`ham` vs `prosciutto-crudo` vs `speck`**: three distinct cured/cooked pork ingredients
  kept as three separate ids specifically because they differ in preparation (cooked vs. raw-
  cured vs. smoked) and mechanic (pre-bake scatter vs. post-bake finishing vs. pre-bake
  scatter) — a concrete example of the "don't dedupe real distinctions" side of the discipline
  the task asked for, mirrored by the "don't duplicate the same thing twice" side below.
- **`ricotta` vs `ricotta-salata`**: fresh vs. salted-aged cheese, kept separate (different
  visual, different recipes — Calzone/Ricotta Bianca vs. Alla Norma-style).
- **`mushroom` vs `porcini`**: kept separate — porcini is a recognizably distinct, premium
  variety with different visual/cost tier, not a spelling variant of `mushroom`.
- **`chili-oil` vs `buffalo-sauce`**: both are "spicy finishing sauces" but from unrelated
  culinary traditions (Italian chili oil vs. American hot sauce) — kept separate rather than
  merged into one generic "spicy drizzle" ingredient, since they'd have different `nameJa`,
  different recipes, and no shared origin.
- **`bell-pepper`**: explicitly annotated that English "pepper" (the vegetable) and
  "pepperoni" (the cured meat) are etymologically related but refer to unrelated ingredients —
  flagged so a future session never conflates them.
- **Pizza Bianca (Italian, sauceless oil-based) vs. Ricotta Bianca (American "white pizza")**:
  two real, different dishes that could collide under a naive "white pizza" search; kept as
  two separate catalog entries with disambiguating names, cross-referenced in each other's
  `descriptionShort`.
- **Explicit rejected-duplicate examples** (§7 of the report): `bufalina` (premium-mozzarella
  Margherita variant — no mechanic/ingredient-set difference from the shipped recipe) and
  `contadina` (a straight combination of `salsiccia` + `ortolana`'s ingredient sets with no
  distinct identity) are both catalogued with `verificationStatus: rejected_duplicate` and a
  `rejectedDuplicateOf` pointer, specifically so a future session sees the reasoning instead
  of re-discovering (or worse, re-adding) the same near-duplicate.
- **Pan-style family** (`chicago-deep-dish`, `detroit-style`, `siciliana`, `greek-style`):
  four real, distinct dishes that all involve a thick/pan-baked format. Only `chicago-deep-
  dish` and `detroit-style` are catalogued as full `game_design_candidate`/`verification_
  pending`-grade entries with clear differentiators (reversed layering for Chicago; post-bake
  sauce stripe for Detroit); `siciliana` is `verification_pending`; `greek-style` is
  `deferred` specifically to avoid a 5th near-identical pan-style entry without its own
  distinguishing topping set, and its most-associated new ingredient (`feta`) is deliberately
  **not** added to the Ingredient Master while the recipe itself is deferred, to avoid
  speculative ingredient bloat.

## 7. Cross-reference

- Full computed analysis (ingredient/mechanic usage ranking, greedy incremental-unlock
  efficiency, implementation-class/tier distributions, the derived Chapter roadmap, source
  limitations, PR #79 disposition recommendation): see
  `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md`.
- Original per-recipe design rationale for the Chapter-2-era 13+3 candidates (mechanic
  clustering into `postBakeFinishing`/`quadrantPlacement`/`halfAndHalfSplit`/`foldDough`,
  Bismarck `eggCenter` retrofit recommendation, ring-placement gap): see
  `docs/design/TETO_RECIPE-EXPANSION-20.md` (kept as-is, now cross-referenced rather than
  the primary catalog structure).
- Economy & Progression 1.0 (unchanged): `docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`.
- Recovery Audit (unchanged): `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`.
- PR #79 (open, not modified by this change): `claude/recipe-master-catalog-1j9jrb`.

## 8. Future update rules (unchanged from PR #79's precedent, restated)

1. Never regress on traceability — every entry keeps a `sourceReferences` value.
2. Never merge on name similarity alone — record a suspected duplicate as an alias or a
   `rejected_duplicate` entry with a named target, never a silent merge.
3. Never inflate the count — `catalogEntryCount`/`viableEntryCount` must equal the actual
   array length (enforced by `tools/validate_recipe_catalog.py`) and must never be adjusted
   toward the illustrative 160 ceiling without that many *actual* entries existing.
4. Keep design judgment (`implementationClass`, `difficulty`, `progressionTier`,
   `gameDesignStatus`) separate from factual fields, and revisable independently.
5. Commit research and data together in the same change that produces them.
6. Respect source access constraints — state them plainly (as this session did) rather than
   filling gaps from memory.
7. **New in this pass**: never let `usedByRecipeCount`, mechanic references, or ingredient
   references drift from the actual catalog content — run `tools/validate_recipe_catalog.py`
   after any edit to any of the three JSON files.
