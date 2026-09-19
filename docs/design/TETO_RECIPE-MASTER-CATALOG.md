# TETO Recipe Master Catalog — Design SSOT (candidate)

Status: v1.0 — **research/data artifact, not wired into `src/**`**
Audited `main` SHA: `5d28c5dc996c0ea76aa6428f158a766165477213`
Companion report: `docs/reports/TETO_RECIPE-MASTER-CATALOG_Research-Result.md`
Companion data: `data/recipes/pizza_master_catalog.json`, `data/recipes/ingredient_master_catalog.json`

This document is a **candidate** Recipe Expansion SSOT. It does not supersede
`docs/design/PIZZA_GAME_SSOT.md` or `docs/PROJECT_HANDOFF.md`, and it changes no
production code, recipe data, Shop, Inventory, Save, Scoring, Pitz, RESULT, or Pizza Dex
behavior. Its purpose is to give future recipe-expansion work (P6 in the roadmap) a single,
source-tracked place to record real-world pizza research, separate from the production
`Recipe`/`Ingredient` types in `src/data/`.

## 1. Catalog purpose

Prior sessions referenced "160 canonical pizzas / 181 unique ingredients" from PIZZA DB
(pizzadb.jp) research, but `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`
(read-only audit, verdict D) established that the underlying catalog files were **never
committed to this repository** — only a two-line prose summary survived, and even that
was later deleted from `docs/PROJECT_HANDOFF.md`. This catalog exists to stop that class of
loss from recurring: **any future PIZZA DB-derived research must be committed as structured,
source-tracked data in the same change that produces it**, not left in an ephemeral session.

This slice does **not** reconstruct the 160/181 figures from memory (explicitly out of scope
— see the Research Result report's limitations). It instead:

1. Catalogs the 7 recipes that already exist in production (`src/data/recipes.ts`) as a
   verified, source-tracked baseline (`currentGameRecipe: true`).
2. Documents, with evidence, why fresh pizzadb.jp research could not be performed this
   session (network egress block — see report).
3. Defines the schema and process so a future session with working external access can
   extend `pizza_master_catalog.json` incrementally, recipe by recipe, without ever again
   losing the underlying data.

## 2. Source policy

- **Primary intended source:** [PIZZA DB](https://pizzadb.jp/), per the task's own source
  policy and per `PIZZA_GAME_SSOT.md` section 1, which already names pizzadb.jp as this
  project's UX/world-view inspiration.
- **What this catalog stores:** factual, structured attributes needed for game design
  (name, region, sauce family, ingredient list, cheese/topping counts, boolean flags). It
  never stores long-form site text, images, or verbatim descriptions.
- **What this catalog never does:** bulk-scrape pizzadb.jp, copy its prose/images, or
  fabricate a recipe count to match a historical figure (160) that can no longer be
  verified.
- **Traceability:** every recipe/ingredient entry carries a `sourceUrl` so it can be
  re-checked later. Where the primary source was unreachable this session, `sourceUrl`
  points at the actual current source of truth instead — the repository's own
  `src/data/recipes.ts` / `src/data/ingredients.ts` (`internal://` scheme) — and
  `researchStatus` says plainly that this has not been independently re-verified against
  pizzadb.jp.
- **Respecting the source when reachable:** a future session must check pizzadb.jp's
  robots.txt and terms of use before any automated fetching, and fall back to manual/
  low-frequency lookups (documenting the constraint) if bulk automated access is
  disallowed or unclear — per the task's own instruction. This session could not reach
  that decision point at all because the domain was blocked at the network layer before
  any request reached the site (see the Research Result report).

## 3. Schema

### 3.1 `pizza_master_catalog.json`

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable catalog id. For current-game recipes, matches `RecipeId` in `src/data/recipes.ts`. |
| `nameJa` | string | Japanese display name (matches in-game name for current recipes). |
| `nameOriginal` | string | Name in the dish's country of origin / common international name. |
| `aliases` | string[] | Known alternate names or names that could be confused with this dish. Never auto-merged with another entry — an alias is recorded, not assumed identical, per the task's explicit instruction. |
| `countryOrRegion` | string | Best-available country/region association. |
| `styleCategory` | string | Free-text style bucket (e.g. "Neapolitan classic", "four-cheese"). Not a fixed enum yet — a future session with broader source coverage should formalize this once more entries exist. |
| `sauceFamily` | string | `tomato` \| `pesto` \| `olive-oil` \| `none` \| (extend as needed). |
| `ingredients` | string[] | Ingredient canonical ids, resolvable against `ingredient_master_catalog.json`. |
| `ingredientFamilies` | string[] | Parallel array of ingredient family labels (same order as `ingredients`, informational). |
| `cheeseCount` | number | Count of distinct cheese ingredients required. |
| `toppingVarietyCount` | number | Count of distinct non-cheese, non-sauce topping ingredients. |
| `hasTomatoSauce` | boolean | |
| `hasCheese` | boolean | |
| `sourceUrl` | string | External source URL when verified, or `internal://` repo reference when the entry is sourced from existing production data instead. Never empty. |
| `researchStatus` | string | e.g. `existing_game_data_unverified_against_pizzadb`, `pizzadb_verified` (future), `pizzadb_unreachable`. |
| `currentGameRecipe` | boolean | `true` for the 7 recipes in `src/data/recipes.ts` today. |
| `gameDesign.implementationClass` | `"A"`\|`"B"`\|`"C"`\|`"D"`\|`"E"` | See section 5. |
| `gameDesign.difficultyTier` | 1–5 | Design judgement, not a game-code value. |
| `gameDesign.progressionTier` | `starter`\|`early`\|`mid`\|`late`\|`master` | Design judgement; for current recipes, cross-checked against actual unlock gates where one exists (e.g. fugazza's `minTotalStars`). |
| `mechanicFlags` | string[] | See section 6. |
| `notes` | string | Free-text research notes (naming ambiguity, implementation gaps vs. the real dish, etc.). |

`gameDesign` is explicitly a separate, clearly-labeled sub-object so design judgement is
never confused with the factual research fields above it, per the task's Phase 3
instruction.

### 3.2 `ingredient_master_catalog.json`

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Matches `Ingredient.id` in `src/data/ingredients.ts` for current ingredients. |
| `displayName` | string | Japanese / English display name. |
| `aliases` | string[] | Known alternate names, including any unverified "specific variety" caveats. |
| `family` | string | `sauce:*`, `cheese`, `topping:herb`, `topping:aromatic`, `topping:vegetable`, `topping:protein` (extend as needed). |
| `usedByRecipeCount` | number | Derived by cross-referencing `pizza_master_catalog.json`; validated programmatically (section 8). |
| `currentlyImplemented` | boolean | `true` if it exists in `src/data/ingredients.ts` today. |
| `candidateShopTier` | string | `starter-not-for-sale` for current Starter Set ingredients, or the actual unlock/price gate (e.g. onion's `minTotalStars`/`pricePitz`) when one exists. Not a new Shop tier system — just a label for future Shop/Inventory design to read. |

## 4. Current game mapping (7/7)

All 7 recipes in `src/data/recipes.ts` are represented with `currentGameRecipe: true`:
margherita, marinara, quattro-formaggi, genovese, bismarck, funghi, fugazza. No name was
silently unified with another catalog entry; naming ambiguities found during this pass
(marinara sauce vs. marinara pizza; Genovese pesto vs. Neapolitan Genovese ragù; Quattro
Formaggi vs. Quattro Stagioni; Fugazza vs. Fugazzeta) are recorded as `notes`/`aliases` on
the relevant entries instead, exactly as the task instructed ("名前揺れがある場合も勝手に
同一化せずaliasとして記録").

## 5. Implementation classes

| Class | Meaning |
|---|---|
| A | Buildable today with existing ingredients and existing operations (spread/scatter, DOUGH→SAUCE→CHEESE→TOPPING→BAKE). |
| B | Needs only new ingredient data (`src/data/ingredients.ts` entries), no new interaction. |
| C | Needs an extension of an existing operation (e.g. placement rules, sauce behavior). |
| D | Needs a genuinely new cooking operation not in the current Making flow (fold, stuff, post-bake topping, etc. — see section 6). |
| E | Not well represented by the current game model at all. |

All 7 current recipes are Class A by construction — they were built with exactly the
ingredients/operations the game already has. This becomes a meaningful classification only
once new candidate recipes (section 7 of the Research Result report) are catalogued
alongside them.

## 6. New-mechanic flags (vocabulary)

Seed vocabulary from the task, plus additions found useful while cataloguing the current 7:

- `foldDough`, `stuffCrust`, `postBakeTopping`, `halfAndHalf`, `quarteredPlacement`,
  `eggCenter`, `multipleCheeseZones`, `noSauce`, `whiteSauce`, `oilBase`,
  `veryHighToppingCount`, `specialBake` (seed list, per task).
- `noCheese` — recipe requires zero cheese ingredients (marinara, fugazza already exercise
  this in production).
- `noTomatoSauce` — recipe's sauce family is not tomato (already true for quattro-formaggi,
  genovese, fugazza).

`eggCenter` is flagged on bismarck as an **implementation gap**, not a met mechanic: the
real dish's whole-egg-in-the-center presentation is not currently distinguished from
ordinary scatter-topping placement in-game. This is exactly the kind of finding Phase 4
asks the catalog to surface.

## 7. Future update rules

1. **Never regress on traceability.** Any new entry must carry a `sourceUrl`. A
   PIZZA DB-sourced entry needs the actual page URL; an entry sourced from existing game
   data uses `internal://` and says so in `researchStatus`.
2. **Never merge on name similarity alone.** Record a suspected duplicate as an `alias`
   with a note; only fold two entries together once a specific source confirms they are
   the same dish.
3. **Never inflate the count.** `canonicalRecipeCount` / `uniqueIngredientCount` must equal
   `recipes.length` / `ingredients.length` (enforced by the validation script referenced in
   the Research Result report) and must never be adjusted to match a historical figure.
4. **Keep `gameDesign` and factual fields separate.** Implementation class, difficulty, and
   progression tier are design judgement and may be revised without touching the factual
   research fields, and vice versa.
5. **Commit research and data together.** Per the Recovery Audit's own recommendation,
   any future PIZZA DB research session must commit its raw findings (URLs, structured
   extracts) in the same PR that updates these JSON files — never leave them in an
   ephemeral session workspace only.
6. **Respect source access constraints.** If pizzadb.jp (or any other external source) is
   unreachable in a given session, say so explicitly (as this session did) rather than
   filling gaps from memory or fabricating counts.
